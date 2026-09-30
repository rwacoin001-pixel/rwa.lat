#!/usr/bin/env node
// Probe which Bailian image models this key can call (images only; no video models are listed or allowed).
// Key: env DASHSCOPE_API_KEY or git-ignored .env.imagegen.local. Usage: node scripts/wanx-probe.mjs [model ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const keyFile = join(root, '.env.imagegen.local')
const key = (process.env.DASHSCOPE_API_KEY || (existsSync(keyFile) ? (readFileSync(keyFile, 'utf8').match(/^DASHSCOPE_API_KEY=(.+)$/m)?.[1] ?? '') : '')).trim()
if (!key) { console.error('Missing DASHSCOPE_API_KEY'); process.exit(1) }
const host = process.env.DASHSCOPE_HOST || 'dashscope.aliyuncs.com'
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }
const scenes = JSON.parse(readFileSync(join(root, 'scripts/desktop-scenes.json'), 'utf8'))
const prompt = scenes.scenes.open.prompt
const negative = scenes.negative
const editSource = `data:image/webp;base64,${readFileSync(join(root, 'public/media/products/hengxu-v2/derived/chengyuan-reserve-1440.webp')).toString('base64')}`
const editPrompt = 'Remove the main object in the centre and fill the area naturally with the surrounding background. Keep lighting, colour and everything else unchanged.'

// kind: sync = multimodal-generation messages; legacy = async text2image/image-synthesis; edit = sync messages with an image
const MODELS = [
  ['wan2.6-t2i', 'sync', '1920*1080'],
  ['qwen-image-3.0-pro', 'sync', '2688*1536'],
  ['qwen-image-3.0', 'sync', '2688*1536'],
  ['qwen-image-2.0-pro', 'sync', '2688*1536'],
  ['qwen-image-2.0', 'sync', '2688*1536'],
  ['qwen-image-max', 'sync', '1664*928'],
  ['qwen-image-plus', 'sync', '1664*928'],
  ['qwen-image', 'sync', '1664*928'],
  ['wan2.5-t2i-preview', 'legacy', '1920*1080'],
  ['wan2.2-t2i-plus', 'legacy', '1440*810'],
  ['wan2.2-t2i-flash', 'legacy', '1440*810'],
  ['wanx2.1-t2i-plus', 'legacy', '1440*810'],
  ['wanx2.1-t2i-turbo', 'legacy', '1440*810'],
  ['qwen-image-edit-plus', 'edit'],
  ['qwen-image-edit', 'edit'],
  ['wan2.6-image', 'edit'],
]
const only = process.argv.slice(2)
const list = only.length ? MODELS.filter(([name]) => only.includes(name)) : MODELS

async function poll(taskId) {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 6000))
    const res = await (await fetch(`https://${host}/api/v1/tasks/${taskId}`, { headers })).json()
    const status = res.output?.task_status
    if (status === 'SUCCEEDED') return res.output.results?.[0]?.url
    if (['FAILED', 'CANCELED', 'UNKNOWN'].includes(status)) throw new Error(`${status} ${res.output?.code ?? ''} ${res.output?.message ?? ''}`)
  }
  throw new Error('poll timeout')
}

async function run([model, kind, size]) {
  let url
  if (kind === 'legacy') {
    const res = await fetch(`https://${host}/api/v1/services/aigc/text2image/image-synthesis`, { method: 'POST', headers: { ...headers, 'X-DashScope-Async': 'enable' },
      body: JSON.stringify({ model, input: { prompt: prompt.slice(0, 800), negative_prompt: negative }, parameters: { size, n: 1, prompt_extend: false, watermark: false } }) })
    const body = await res.json()
    if (!res.ok || !body.output?.task_id) throw new Error(`${res.status} ${body.code} ${body.message}`)
    url = await poll(body.output.task_id)
  } else {
    const content = kind === 'edit' ? [{ image: editSource }, { text: editPrompt }] : [{ text: prompt }]
    const parameters = kind === 'edit' ? { n: 1, watermark: false } : { negative_prompt: negative, size, n: 1, prompt_extend: false, watermark: false }
    const res = await fetch(`https://${host}/api/v1/services/aigc/multimodal-generation/generation`, { method: 'POST', headers,
      body: JSON.stringify({ model, input: { messages: [{ role: 'user', content }] }, parameters }) })
    const body = await res.json()
    if (!res.ok) throw new Error(`${res.status} ${body.code} ${body.message}`)
    url = body.output?.choices?.[0]?.message?.content?.find((item) => item.image)?.image
  }
  if (!url) throw new Error('no image in response')
  const dir = join(root, 'public/media/desktop/raw/probe')
  mkdirSync(dir, { recursive: true })
  const out = join(dir, `${model}-${kind === 'edit' ? 'edit' : 'open'}.png`)
  writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()))
  return out
}

for (const entry of list) {
  try { console.log(`OK   ${entry[0]} -> ${await run(entry)}`) }
  catch (error) { console.log(`FAIL ${entry[0]}: ${String(error.message).slice(0, 180)}`) }
}
