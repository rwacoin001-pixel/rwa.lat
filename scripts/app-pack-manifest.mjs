// Writes /app-pack/manifest.json into the deployed assets: the files the Android app keeps on the phone (code,
// styles, fonts, common images), each with its SHA-256. The app ships a copy of them in the APK and, in the
// background, downloads whatever a newer build adds, so pages load from the phone instead of the network.
// usage: node scripts/app-pack-manifest.mjs [assetsDir=.open-next/assets] [buildIdFile=.next/BUILD_ID]
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const assets = process.argv[2] ?? '.open-next/assets'
const build = readFileSync(process.argv[3] ?? '.next/BUILD_ID', 'utf8').trim()

// Hashed build output is immutable; the public files listed here change rarely and are re-checked by hash.
const INCLUDE = [
  /^\/_next\/static\/.+\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico|gif)$/,
  /^\/icons\/[^/]+\.(?:png|svg|ico)$/,
  /^\/brand\/a-reit\/[^/]+\.(?:png|svg|webp)$/,
  /^\/media\/home\/[^/]+\.(?:webp|png|jpe?g|svg)$/,
  /^\/media\/home\/derived\/[^/]+\.webp$/,
  /^\/auth\/[^/]+\.(?:png|svg|webp)$/,
  // Paper & Glass: its images (home, guide, sign-in cabinet, avatars; ~1.8 MB) and the Latin font (Satoshi, ~110 KB).
  // The Chinese font slices stay on the network: browsers fetch only the slices a page uses, and cache them.
  /^\/media\/palette-a\/.+\.(?:webp|png|jpe?g|svg)$/,
  /^\/fonts\/satoshi\/[^/]+\.woff2$/,
]
const MAX_FILE = 8 * 1024 * 1024

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = walk(assets)
  .map(full => ({ full, path: '/' + relative(assets, full).split(sep).join('/') }))
  .filter(({ path, full }) => INCLUDE.some(pattern => pattern.test(path)) && statSync(full).size <= MAX_FILE)
  .map(({ full, path }) => {
    const body = readFileSync(full)
    return { p: path, h: createHash('sha256').update(body).digest('hex'), s: body.length }
  })
  .sort((a, b) => a.p.localeCompare(b.p))

const manifest = { v: 1, build, generatedAt: new Date().toISOString(), files }
mkdirSync(join(assets, 'app-pack'), { recursive: true })
writeFileSync(join(assets, 'app-pack', 'manifest.json'), JSON.stringify(manifest))
const total = files.reduce((sum, file) => sum + file.s, 0)
console.log(`app-pack: build ${build}, ${files.length} files, ${(total / 1048576).toFixed(1)} MB`)
