#!/usr/bin/env node
// Scene art for /desktop via Alibaba Bailian image models. Images only: never call a Wan video model.
// Key comes from env DASHSCOPE_API_KEY, or from the git-ignored .env.imagegen.local (DASHSCOPE_API_KEY=...).
// Usage:
//   node scripts/wanx-gen.mjs gen  <scene> [--model qwen-image-3.0-pro] [--size 2688*1536] [--seed 1]
//   node scripts/wanx-gen.mjs edit <scene> <input.png|jpg> [--model qwen-image-edit-plus] [--size 2048*1168]
// "edit" uses the scene's `plate` instruction (subject removed, background filled) from desktop-scenes.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [mode, scene, input] = process.argv.slice(2)
const flag = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback }

const keyFile = join(root, '.env.imagegen.local')
const key = (process.env.DASHSCOPE_API_KEY || (existsSync(keyFile) ? (readFileSync(keyFile, 'utf8').match(/^DASHSCOPE_API_KEY=(.+)$/m)?.[1] ?? '') : '')).trim()
if (!key) { console.error('Missing DASHSCOPE_API_KEY (env or .env.imagegen.local).'); process.exit(1) }

const config = JSON.parse(readFileSync(join(root, 'scripts/desktop-scenes.json'), 'utf8'))
const spec = config.scenes[scene]
if (!spec || !['gen', 'edit'].includes(mode)) { console.error(`Usage: gen|edit <scene>. Scenes: ${Object.keys(config.scenes).join(', ')}`); process.exit(1) }

let content, parameters, model
if (mode === 'gen') {
  model = flag('model', 'qwen-image-3.0-pro')
  content = [{ text: spec.prompt }]
  parameters = { negative_prompt: config.negative, size: flag('size', '2688*1536'), n: 1, prompt_extend: false, watermark: false, ...(flag('seed') ? { seed: Number(flag('seed')) } : {}) }
} else {
  if (!input || !existsSync(input)) { console.error('edit needs an existing input image'); process.exit(1) }
  if (!spec.plate) { console.error(`Scene "${scene}" has no plate instruction`); process.exit(1) }
  model = flag('model', 'qwen-image-edit-plus')
  const mime = extname(input).toLowerCase() === '.png' ? 'image/png' : extname(input).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg'
  content = [{ image: `data:${mime};base64,${readFileSync(input).toString('base64')}` }, { text: spec.plate }]
  parameters = { size: flag('size', '2048*1168'), n: 1, watermark: false, prompt_extend: false }
}

const host = process.env.DASHSCOPE_HOST || 'dashscope.aliyuncs.com'
const res = await fetch(`https://${host}/api/v1/services/aigc/multimodal-generation/generation`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: JSON.stringify({ model, input: { messages: [{ role: 'user', content }] }, parameters }),
})
const body = await res.json()
if (!res.ok) { console.error('Request failed:', res.status, body.code, body.message); process.exit(1) }
const url = body.output?.choices?.[0]?.message?.content?.find((item) => item.image)?.image
if (!url) { console.error('No image in response.'); process.exit(1) }

const outDir = join(root, 'public/media/desktop/raw')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
const out = join(outDir, `${scene}-${mode === 'gen' ? 'full' : 'plate'}-${stamp}.png`)
writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()))
console.log(`saved ${out} (${model})`)
