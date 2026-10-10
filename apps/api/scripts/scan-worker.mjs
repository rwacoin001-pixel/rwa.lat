#!/usr/bin/env node
/**
 * scan-worker.mjs -- A-REIT 对象存储恶意文件扫描 worker（ClamAV）
 *
 * 职责：把 object_storage_objects 里 scan_status='pending' 的对象，
 *       下载 → ClamAV 扫描 → 以 HMAC 签名回调 POST /v1/object-storage/scan
 *
 * 设计要点（严格匹配后端契约）：
 *   · 回调头：x-rwa-event-id / x-rwa-timestamp / x-rwa-signature
 *   · 签名：HMAC-SHA256(secret, canonicalCallbackJson({eventId, payload, timestamp}))
 *     canonicalCallbackJson = 递归键排序的稳定 JSON（复刻 partner-callback.verifier.ts）
 *   · provider 必须等于 OBJECT_STORAGE_SCAN_PROVIDER
 *   · checksumSha256 传回实际值；只有一致才会被判 clean
 *
 * 用法：
 *   node scan-worker.mjs --once        # 扫一轮后退出（默认）
 *   node scan-worker.mjs --loop 30     # 每 30 秒一轮
 *   node scan-worker.mjs --dry-run     # 只报告将处理什么，不调 API
 *
 * 依赖：pg、@aws-sdk/client-s3（apps/api 已装），Node 18+（内置 fetch）
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const API_ROOT = path.resolve(HERE, '..')            // apps/api
const REPO = path.resolve(API_ROOT, '../..')          // repo root

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const loopIdx = args.indexOf('--loop')
const LOOP_SECONDS = loopIdx >= 0 ? Number(args[loopIdx + 1] || 30) : 0
const ONCE = args.includes('--once') || !LOOP_SECONDS

// ── 支持的 ClamAV 连接：容器 127.0.0.1:3310 ──
const CLAMD_HOST = process.env.CLAMD_HOST || '127.0.0.1'
const CLAMD_PORT = Number(process.env.CLAMD_PORT || 3310)
const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS || 120000)

// ─────────────────────────── env 加载 ───────────────────────────
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[line.slice(0, eq).trim()] = v
  }
  return out
}
const ENV = { ...loadEnvFile(path.join(API_ROOT, '.env')), ...loadEnvFile(path.join(REPO, '.env.local')) }

const cfg = (k, d = '') => process.env[k] ?? ENV[k] ?? d

const DATABASE_URL = cfg('DATABASE_URL')
const S3_ENDPOINT = cfg('S3_ENDPOINT')
const S3_REGION = cfg('S3_REGION') || 'us-east-1'
const S3_FORCE_PATH_STYLE = (cfg('S3_FORCE_PATH_STYLE', 'false') === 'true')
const S3_ACCESS_KEY = cfg('S3_ACCESS_KEY_ID') || cfg('S3_ACCESS_KEY')
const S3_SECRET_KEY = cfg('S3_SECRET_ACCESS_KEY') || cfg('S3_SECRET_KEY')
const SCAN_PROVIDER = cfg('OBJECT_STORAGE_SCAN_PROVIDER', 'clamav')
const SCAN_SECRET = cfg('OBJECT_STORAGE_SCAN_CALLBACK_SECRET')
const API_BASE = cfg('SCAN_WORKER_API_BASE', 'http://127.0.0.1:4000')
const BUCKET_MAP = (() => {
  try { return JSON.parse(cfg('S3_BUCKET_MAP_JSON', '{}')) } catch { return {} }
})()

function die(msg) { console.error('[scan-worker] FATAL:', msg); process.exit(1) }
if (!DATABASE_URL) die('DATABASE_URL 未配置（apps/api/.env）')
if (!S3_ENDPOINT) die('S3_ENDPOINT 未配置')
if (!S3_ACCESS_KEY || !S3_SECRET_KEY) die('S3 凭据未配置')
if (!SCAN_SECRET || SCAN_SECRET.length < 32) die('OBJECT_STORAGE_SCAN_CALLBACK_SECRET 未配置或短于 32 字符')
if (!/^[a-z][a-z0-9_-]{1,63}$/i.test(SCAN_PROVIDER)) die(`OBJECT_STORAGE_SCAN_PROVIDER 非法: ${SCAN_PROVIDER}`)

// ─────────────────── canonical JSON（复刻后端实现）───────────────────
function canonicalCallbackJson(value) {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalCallbackJson).join(',')}]`
  const rec = value
  return `{${Object.keys(rec).sort().map((k) => `${JSON.stringify(k)}:${canonicalCallbackJson(rec[k])}`).join(',')}}`
}

function signCallback(eventId, timestamp, payload) {
  const canonical = canonicalCallbackJson({ eventId, payload, timestamp })
  return 'sha256=' + crypto.createHmac('sha256', SCAN_SECRET).update(canonical).digest('hex')
}

// ─────────────────────────── ClamAV (INSTREAM over TCP) ───────────────────────────
function clamdScanBuffer(buf) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: CLAMD_HOST, port: CLAMD_PORT })
    const chunks = []
    let done = false
    const finish = (err, val) => { if (!done) { done = true; try { sock.destroy() } catch {} ; err ? reject(err) : resolve(val) } }
    const timer = setTimeout(() => finish(new Error(`ClamAV 扫描超时（${SCAN_TIMEOUT_MS}ms）`)), SCAN_TIMEOUT_MS)
    sock.on('connect', () => {
      sock.write('zINSTREAM\0')
      const CHUNK = 64 * 1024
      for (let off = 0; off < buf.length; off += CHUNK) {
        const part = buf.subarray(off, Math.min(off + CHUNK, buf.length))
        const len = Buffer.alloc(4); len.writeUInt32BE(part.length, 0)
        sock.write(len); sock.write(part)
      }
      const end = Buffer.alloc(4); end.writeUInt32BE(0, 0); sock.write(end)
    })
    sock.on('data', (d) => { chunks.push(d) })
    sock.on('end', () => {
      clearTimeout(timer)
      const text = Buffer.concat(chunks).toString('utf8').trim().replace(/\0/g, '')
      // 形如 "stream: OK" / "stream: Eicar-Signature FOUND" / "stream: <name> FOUND"
      if (/\bOK$/.test(text)) return finish(null, { status: 'clean', raw: text })
      const found = /:\s*(.+?)\s+FOUND$/i.exec(text)
      if (found) return finish(null, { status: 'infected', signature: found[1], raw: text })
      finish(null, { status: 'error', raw: text })
    })
    sock.on('error', (e) => { clearTimeout(timer); finish(e) })
  })
}

// ─────────────────────────── DB / S3 / API ───────────────────────────
async function loadPg() { const m = await import('pg'); return m.default ?? m }

async function fetchPending(pool, limit) {
  const { rows } = await pool.query(
    `SELECT id, bucket, key, size_bytes::text AS size, checksum_sha256
       FROM app.object_storage_objects
      WHERE scan_status = 'pending' AND size_bytes > 0
      ORDER BY uploaded_at ASC NULLS FIRST
      LIMIT $1`, [limit])
  return rows
}

async function s3Get(bucketKey, b2Bucket, key) {
  const mod = await import('@aws-sdk/client-s3')
  const client = new mod.S3Client({
    region: S3_REGION, endpoint: S3_ENDPOINT, forcePathStyle: S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  })
  const res = await client.send(new mod.GetObjectCommand({ Bucket: b2Bucket, Key: key }))
  const parts = []
  for await (const c of res.Body) parts.push(c)
  return Buffer.concat(parts)
}

async function postScanResult(objectId, payloadObj, checksumSha256) {
  const eventId = crypto.randomUUID()
  const timestamp = String(Date.now())
  const payload = {
    objectId,
    provider: SCAN_PROVIDER,
    status: payloadObj.status,
    ...(checksumSha256 ? { checksumSha256 } : {}),
    ...(payloadObj.providerReference ? { providerReference: payloadObj.providerReference } : {}),
    ...(payloadObj.details ? { details: payloadObj.details } : {}),
  }
  const signature = signCallback(eventId, timestamp, payload)
  const res = await fetch(`${API_BASE}/v1/storage/callbacks/scan`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-rwa-event-id': eventId,
      'x-rwa-timestamp': timestamp,
      'x-rwa-signature': signature,
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text.slice(0, 300) }
}

async function runOnce(pool, limit = 25) {
  const pending = await fetchPending(pool, limit)
  if (!pending.length) { console.log('[scan-worker] 无待扫描对象'); return { scanned: 0 } }
  console.log(`[scan-worker] 待扫描 ${pending.length} 个对象`)
  let scanned = 0
  for (const obj of pending) {
    const b2 = BUCKET_MAP[obj.bucket] || obj.bucket
    const label = `${obj.bucket}/${obj.key}`
    if (DRY) { console.log(`  [dry-run] 将扫描 ${label}（${obj.size} bytes）`); continue }
    try {
      const buf = await s3Get(obj.bucket, b2, obj.key)
      const actualSha = crypto.createHash('sha256').update(buf).digest('hex')
      const r = await clamdScanBuffer(buf)
      const payload = r.status === 'clean'
        ? { status: 'clean', providerReference: `clamav:${actualSha.slice(0, 16)}`, details: { engine: 'clamav', raw: r.raw } }
        : r.status === 'infected'
          ? { status: 'infected', providerReference: `clamav:${(r.signature || 'unknown').slice(0, 120)}`, details: { engine: 'clamav', raw: r.raw } }
          : { status: 'error', providerReference: 'clamav:scan-error', details: { engine: 'clamav', raw: r.raw } }
      const ack = await postScanResult(obj.id, payload, actualSha)
      scanned++
      console.log(`  ${r.status === 'clean' ? '✅' : r.status === 'infected' ? '🦠' : '⚠️'} ${label} → ${r.status} | 回调 HTTP ${ack.status}${ack.ok ? '' : ' ' + ack.body}`)
    } catch (e) {
      console.error(`  ❌ ${label} → 处理失败: ${String(e.message || e).slice(0, 160)}`)
    }
  }
  return { scanned }
}

async function main() {
  console.log('[scan-worker] 启动')
  console.log(`  provider=${SCAN_PROVIDER} · clamd=${CLAMD_HOST}:${CLAMD_PORT} · api=${API_BASE}`)
  console.log(`  模式=${DRY ? 'dry-run' : LOOP_SECONDS ? `loop ${LOOP_SECONDS}s` : 'once'}`)
  const pgMod = await loadPg()
  const { Client } = pgMod
  const pool = new Client({ connectionString: DATABASE_URL })
  await pool.connect()
  try {
    if (ONCE || DRY) { await runOnce(pool); return }
    for (;;) {
      try { await runOnce(pool) } catch (e) { console.error('[scan-worker] 轮次失败:', String(e.message || e).slice(0, 200)) }
      await new Promise((r) => setTimeout(r, LOOP_SECONDS * 1000))
    }
  } finally { await pool.end() }
}

main().catch((e) => { console.error('[scan-worker] 退出:', e); process.exit(1) })
