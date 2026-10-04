import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'package.json'))
const output = resolve(root, 'public/ai-ocr')
await mkdir(resolve(output, 'core'), { recursive: true })
await mkdir(resolve(output, 'lang'), { recursive: true })
const ocr = dirname(require.resolve('tesseract.js/package.json'))
const core = dirname(createRequire(resolve(ocr, 'package.json')).resolve('tesseract.js-core/package.json'))
const pdf = dirname(require.resolve('pdfjs-dist/package.json'))
await Promise.all([
  copyFile(resolve(pdf, 'build/pdf.worker.min.mjs'), resolve(output, 'pdf.worker.min.mjs')),
  copyFile(resolve(ocr, 'dist/worker.min.js'), resolve(output, 'worker.min.js')),
  copyFile(resolve(ocr, 'LICENSE.md'), resolve(output, 'LICENSE-tesseract.txt')),
  readFile(resolve(core, 'LICENSE'), 'utf8').then(text => writeFile(resolve(output, 'LICENSE-core.txt'), text.trimEnd() + '\n')),
  copyFile(resolve(pdf, 'LICENSE'), resolve(output, 'LICENSE-pdfjs.txt')),
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map(name => copyFile(resolve(core, name), resolve(output, 'core', name))),
])

// Extract exactly one regular file, never arbitrary archive paths or executable scripts.
function extractFile(tar, expected) {
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512)
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '')
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8) || 0
    const start = offset + 512
    if (name === expected && [0, 48].includes(header[156])) return tar.subarray(start, start + size)
    offset = start + Math.ceil(size / 512) * 512
  }
  throw new Error(`Missing trained data ${expected}`)
}
const languages = await Promise.all(['eng', 'chi_sim', 'spa', 'fra', 'ara', 'hin', 'por'].map(async language => {
  const response = await fetch(`https://registry.npmjs.org/@tesseract.js-data%2F${language}/1.0.0`)
  if (!response.ok) throw new Error(`Language metadata ${language}: ${response.status}`)
  const meta = await response.json()
  const archiveUrl = new URL(meta.dist.tarball)
  if (archiveUrl.origin !== 'https://registry.npmjs.org') throw new Error('Unexpected data origin')
  const archiveResponse = await fetch(archiveUrl)
  if (!archiveResponse.ok) throw new Error(`Language download ${language}: ${archiveResponse.status}`)
  const archive = Buffer.from(await archiveResponse.arrayBuffer())
  const expectedIntegrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`
  if (expectedIntegrity !== meta.dist.integrity) throw new Error(`Integrity check failed: ${language}`)
  const bytes = extractFile(gunzipSync(archive), `package/4.0.0_best_int/${language}.traineddata.gz`)
  await writeFile(resolve(output, 'lang', `${language}.traineddata.gz`), bytes)
  return { language, package: `@tesseract.js-data/${language}@1.0.0`, source: archiveUrl.href, integrity: meta.dist.integrity, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }
}))
await writeFile(resolve(output, 'assets.json'), JSON.stringify({ languages, versions: { pdfjs: JSON.parse(await readFile(resolve(pdf, 'package.json'), 'utf8')).version, ocr: JSON.parse(await readFile(resolve(ocr, 'package.json'), 'utf8')).version } }, null, 2) + '\n')
console.log(`Prepared local PDF/OCR workers and ${languages.length} languages; ${Math.round(languages.reduce((sum, item) => sum + item.bytes, 0) / 1024 / 1024)} MiB trained data.`)
