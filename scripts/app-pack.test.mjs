import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generate = join(root, 'scripts/app-pack-manifest.mjs')
const bundle = join(root, 'scripts/android-bundle-pack.mjs')
const native = readFileSync(join(root, 'apps/android-client/app/src/main/java/lat/rwa/trial/AppPack.java'), 'utf8')
const nativePath = new RegExp(JSON.parse(native.match(/PATH = Pattern.compile\((".*?")\)/)[1]))
const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'areit-pack-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const assets = join(dir, 'assets'), build = join(dir, 'BUILD_ID')
  mkdirSync(assets)
  writeFileSync(build, 'test-build')
  const put = (path, body = path) => {
    const file = join(assets, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, body)
  }
  return { dir, assets, build, put }
}

test('expanded mobile resources reach the native whitelist and hash-verified APK bundle', t => {
  const { dir, assets, build, put } = fixture(t)
  const included = [
    '_next/static/chunks/app/[[...rwa]]/page-123.js',
    'fonts/noto-sans-sc/slice-12.woff2', 'media/referral/posters/night.webp',
    'media/products/hengxu-v2/derived/liujin-gold-720.webp',
    'media/generated/project-assets/solar-income-ops-v1.png',
    'baskets/hengxu-liujin_cover.webp', 'baskets/hengxu-liujin.png', 'asset-icons/compute.png',
    'media/login/welcome.webp', 'media/brand/mark.svg',
    'ai-ocr/pdf.worker.min.mjs', 'vendor/jsqr/jsQR.js',
  ]
  const excluded = [
    'download/a-reit.apk', 'media/desktop/hero.webp', 'auth/loop.mp4',
    'media/products/hengxu-v1/original.png', 'api/me.json',
    '_next/static/chunks/source.js.map', 'ai-ocr/lang/eng.traineddata.gz',
  ]
  for (const path of [...included, ...excluded]) put(path)
  const result = run(generate, assets, build)
  assert.equal(result.status, 0, result.stderr)
  const manifest = JSON.parse(readFileSync(join(assets, 'app-pack/manifest.json')))
  assert.equal(manifest.v, 1) // Existing clients retain the same wire format.
  assert.equal(manifest.build, 'test-build')
  assert.deepEqual(manifest.files.map(f => f.p), included.map(p => '/' + p).sort((a, b) => a.localeCompare(b)))
  const output = join(dir, 'pack')
  const packed = run(bundle, assets, output)
  assert.equal(packed.status, 0, packed.stderr)
  for (const file of manifest.files) {
    assert.ok(nativePath.test(file.p), `native cannot serve ${file.p}`)
    const body = readFileSync(join(output, 'files', file.h))
    assert.equal(body.length, file.s)
    assert.equal(createHash('sha256').update(body).digest('hex'), file.h)
  }
  put(included[0], 'changed after generation')
  assert.notEqual(run(bundle, assets, join(dir, 'corrupt-pack')).status, 0)
})

test('oversized selected files fail visibly before publishing a manifest', t => {
  const { assets, build, put } = fixture(t)
  put('baskets/too-large.png', Buffer.alloc(8 * 1024 * 1024 + 1))
  const result = run(generate, assets, build)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /exceeds 8 MiB/)
  assert.equal(existsSync(join(assets, 'app-pack/manifest.json')), false)
})

test('whole-pack budget matches native download budget', t => {
  assert.match(native, /MAX_UPDATE = 128L \* 1024 \* 1024/)
  const { assets, build, put } = fixture(t)
  for (let i = 0; i < 17; i++) put(`baskets/${i}.png`, Buffer.alloc(8 * 1024 * 1024, i))
  const result = run(generate, assets, build)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /exceeds the 128 MiB/)
  assert.equal(existsSync(join(assets, 'app-pack/manifest.json')), false)
})
