// Writes /app-pack/manifest.json into the deployed assets: the files the Android app keeps on the phone (code,
// styles, fonts, common images), each with its SHA-256. The app ships a copy of them in the APK and, in the
// background, downloads whatever a newer build adds, so pages load from the phone instead of the network.
// usage: node scripts/app-pack-manifest.mjs [assetsDir=.open-next/assets] [buildIdFile=.next/BUILD_ID]
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { resolveBrand } from '../lib/brand/config.mjs'
const brand = resolveBrand(process.env.SITE_BRAND)

const assets = process.argv[2] ?? '.open-next/assets'
const build = readFileSync(process.argv[3] ?? '.next/BUILD_ID', 'utf8').trim()

// Hashed build output is immutable; the public files listed here change rarely and are re-checked by hash.
const INCLUDE = [
  /^\/_next\/static\/.+\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico|gif)$/,
  /^\/icons\/[^/]+\.(?:png|svg|ico)$/,
  new RegExp(`^${brand.assets}/[^/]+\\.(?:png|svg|webp|ico)$`),
  /^\/media\/home\/[^/]+\.(?:webp|png|jpe?g|svg)$/,
  /^\/media\/home\/derived\/[^/]+\.webp$/,
  // Home 为你精选 card photos (2026-11-04: they were missing, so the first home screen fetched them).
  /^\/media\/home\/cards\/[^/]+\.webp$/,
  /^\/auth\/[^/]+\.(?:png|svg|webp)$/,
  // Paper & Glass: its images (home, guide, sign-in cabinet, avatars; ~1.8 MB) and the Latin font (Satoshi, ~110 KB).
  // Both the app-specific Chinese font and full slices for names/news ship below.
  /^\/media\/palette-a\/.+\.(?:webp|png|jpe?g|svg)$/,
  /^\/fonts\/satoshi\/[^/]+\.woff2$/,
  /^\/fonts\/noto-sans-sc-app\/[^/]+\.woff2$/,
  /^\/avatars\/(?:porcelain|professions)\/[^/]+\.webp$/,
  /^\/media\/porcelain\/[^/]+\.webp$/,
  // Quant covers, invitation posters and full Chinese font slices.
  // Desktop-only media, retired product originals and videos stay on the network.
  // Every folder here must also be in AppPack.PATH (apps/android-client), or it ships but is never served.
  /^\/media\/quant\/.+\.(?:webp|png|jpe?g|svg)$/,
  /^\/media\/referral\/.+\.(?:webp|png|jpe?g|svg)$/,
  /^\/fonts\/noto-sans-sc\/[^/]+\.woff2$/,
  // Mobile product variants, basket thumbnails/covers and their original fallbacks.
  /^\/media\/products\/[^/]+\/derived\/[^/]+\.(?:webp|avif|png|jpe?g)$/,
  /^\/baskets\/[^/]+\.(?:webp|avif|png|jpe?g|svg)$/,
  /^\/asset-icons\/[^/]+\.(?:webp|avif|png|jpe?g|svg)$/,
  /^\/media\/(?:generated|login|brand)\/.+\.(?:webp|avif|png|jpe?g|svg)$/,
  // PDF reading and QR decoding: executable support files, not user documents or OCR language archives.
  /^\/ai-ocr\/pdf\.worker\.min\.mjs$/,
  /^\/vendor\/jsqr\/[^/]+\.js$/,
  ...(brand.id === 'kimeng' ? [/^\/offline-kimeng\.html$/] : []),
]
const MAX_FILE = 8 * 1024 * 1024
// Match the native client's per-launch update budget. Fail visibly instead of silently producing an oversized pack.
const MAX_PACK = 128 * 1024 * 1024

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const candidates = walk(assets)
  .map(full => ({ full, path: '/' + relative(assets, full).split(sep).join('/') }))
  .filter(({ path }) => INCLUDE.some(pattern => pattern.test(path)))
  // 2026-11-04 (user: the APK downloads slowly in China): leave out what the phone screens do not show — the retired
  // product art in /media/generated (28 MB) and PNG originals over 500 KB that have WebP copies (basket covers, asset
  // icons, old sign-in stills; ~28 MB). The pack drops from ~90 MB to ~33 MB; anything still used loads from the network.
  .filter(({ path, full }) => !/^\/media\/generated\//.test(path) && !(/\.png$/.test(path) && statSync(full).size > 500 * 1024))
for (const { path, full } of candidates) {
  if (statSync(full).size > MAX_FILE) throw new Error(`app-pack: selected file exceeds 8 MiB: ${path}`)
}
const files = candidates
  .map(({ full, path }) => {
    const body = readFileSync(full)
    return { p: path, h: createHash('sha256').update(body).digest('hex'), s: body.length }
  })
  .sort((a, b) => a.p.localeCompare(b.p))

const total = files.reduce((sum, file) => sum + file.s, 0)
if (total > MAX_PACK) throw new Error(`app-pack: ${(total / 1048576).toFixed(1)} MiB exceeds the 128 MiB native update budget`)
const manifest = { v: 1, brand: brand.id, build, generatedAt: new Date().toISOString(), files }
mkdirSync(join(assets, 'app-pack'), { recursive: true })
writeFileSync(join(assets, 'app-pack', 'manifest.json'), JSON.stringify(manifest))
console.log(`app-pack: build ${build}, ${files.length} files, ${(total / 1048576).toFixed(1)} MB`)
