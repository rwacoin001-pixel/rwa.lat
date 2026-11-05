import { createRequire } from 'node:module'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const sharp = createRequire(require.resolve('next/package.json'))('sharp')
const brand = resolve(root, 'public/brand/kimeng')
const startup = resolve(root, 'public/startup')
await mkdir(startup, { recursive: true })
const icon = await readFile(resolve(brand, 'app-icon.svg'))
let count = 0
for (const file of await readdir(startup)) {
  const match = /^a-reit-(\d+)x(\d+)-(\d)x-(light|dark)\.png$/.exec(file)
  if (!match) continue
  const [, w, h, scale, theme] = match
  const width = Number(w) * Number(scale), height = Number(h) * Number(scale)
  const size = 112 * Number(scale)
  const image = await sharp(icon).resize(size, size).png().toBuffer()
  await sharp({ create: { width, height, channels: 3, background: theme === 'light' ? '#F5F6F8' : '#0B0D10' } })
    .composite([{ input: image, left: Math.round((width - size) / 2), top: Math.round((height - size) / 2) }])
    .png().toFile(resolve(startup, file.replace('a-reit-', 'kimeng-')))
  count++
}
if (count !== 24) throw new Error(`Expected 24 launch images, generated ${count}`)
const lockup = await sharp(resolve(brand, 'logo-bilingual-light.svg')).resize(880).png().toBuffer()
const { height } = await sharp(lockup).metadata()
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#F5F6F8' } })
  .composite([{ input: lockup, left: 160, top: Math.round((630 - height) / 2) }])
  .png().toFile(resolve(brand, 'share-card.png'))
console.log(`Generated ${count} Kimeng launch images and share card`)
