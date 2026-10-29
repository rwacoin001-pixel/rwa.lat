// Copies one website build's on-phone files into the Android app (app/src/main/assets/pack): the manifest written by
// scripts/app-pack-manifest.mjs plus every listed file stored under its SHA-256, re-verified while copying.
// usage: node scripts/android-bundle-pack.mjs <assetsDir (.open-next/assets)> <androidAssetsPackDir>
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [assets, out] = process.argv.slice(2)
if (!assets || !out) throw new Error('usage: android-bundle-pack.mjs <assetsDir> <outDir>')
const manifest = JSON.parse(readFileSync(join(assets, 'app-pack', 'manifest.json'), 'utf8'))
// The app serves only paths matching AppPack.PATH; a packed file outside it would ship and never be used (10/30 bug).
const java = readFileSync(new URL('../apps/android-client/app/src/main/java/lat/rwa/trial/AppPack.java', import.meta.url), 'utf8')
const served = new RegExp(JSON.parse(java.match(/Pattern PATH = Pattern\.compile\(("(?:[^"\\]|\\.)*")\)/)[1]))
const unserved = manifest.files.filter(file => !served.test(file.p)).map(file => file.p)
if (unserved.length) throw new Error(`AppPack.PATH does not serve ${unserved.length} packed files, e.g. ${unserved.slice(0, 3).join(', ')}`)
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'files'), { recursive: true })
let total = 0
for (const file of manifest.files) {
  if (!file.p.startsWith('/') || file.p.split('/').some(part => part === '..' || part === '.')) throw new Error(`bad path ${file.p}`)
  const body = readFileSync(join(assets, file.p.slice(1)))
  const hash = createHash('sha256').update(body).digest('hex')
  if (hash !== file.h || body.length !== file.s) throw new Error(`${file.p} does not match the manifest`)
  writeFileSync(join(out, 'files', hash), body)
  total += body.length
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest))
console.log(`android pack: build ${manifest.build}, ${manifest.files.length} files, ${(total / 1048576).toFixed(1)} MB`)
