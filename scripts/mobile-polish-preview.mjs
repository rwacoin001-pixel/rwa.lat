import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.RWA_PLAYWRIGHT_DIR ? resolve(process.env.RWA_PLAYWRIGHT_DIR, 'playwright') : 'playwright')
const base = process.env.RWA_PREVIEW_URL || 'http://localhost:3034'
const output = resolve(process.env.RWA_PREVIEW_OUTPUT || 'artifacts/mobile-polish')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.RWA_BROWSER_CHANNEL ? { channel: process.env.RWA_BROWSER_CHANNEL } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'zh-CN', permissions: ['camera', 'microphone'] })
await context.addInitScript(() => { localStorage.setItem('rwa.theme', 'dark'); localStorage.setItem('rwa-language', 'zh-CN') })
const failures = []
const page = await context.newPage()
page.on('pageerror', error => failures.push(error.message))
page.on('console', event => { if (event.type() === 'error' && !event.text().includes('Failed to load resource')) { failures.push(event.text()); console.error(event.text().slice(0, 1200)) } })
for (const screen of ['startup', 'scanner', 'kyc', 'ai']) {
  await page.goto(`${base}/dev/mobile-polish?screen=${screen}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForTimeout(screen === 'startup' ? 900 : 400)
  await page.screenshot({ path: resolve(output, `${screen}-dark.png`) })
  console.log(`Preview ${screen}: ${await page.title()}`)
}
await writeFile(resolve(output, 'preview-errors.json'), JSON.stringify(failures, null, 2))
await browser.close()
if (failures.length) { console.error(failures); process.exitCode = 1 }
console.log(`Screenshots: ${output}`)
