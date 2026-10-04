import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { chromium } = require(resolve(process.env.RWA_PLAYWRIGHT_DIR, 'playwright'))
const browser = await chromium.launch({ channel: process.env.RWA_BROWSER_CHANNEL || 'chrome', headless: true })
const results = [], errors = [], output = resolve(process.env.RWA_PREVIEW_OUTPUT || 'artifacts/mobile-polish')
try {
  for (const locale of ['zh-CN', 'en', 'es', 'fr', 'ar', 'hi', 'pt']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
    await context.addInitScript(locale => { localStorage.setItem('rwa.theme', 'light'); localStorage.setItem('rwa-language', locale) }, locale)
    await context.route('**/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, configured: true }) }))
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${process.env.RWA_PREVIEW_URL || 'http://localhost:3034'}/dev/mobile-polish?screen=ai`, { waitUntil: 'networkidle', timeout: 120000 })
    const field = page.locator('textarea').first()
    await field.waitFor(); await field.focus(); await field.fill('Mobile layout check')
    assert.equal(await page.locator('html').getAttribute('lang'), locale)
    assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr')
    const box = await page.locator('form[data-expanded]').boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= 321)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 320), true)
    const sendBox = await page.locator('form button[type=submit]').boundingBox()
    assert.ok(sendBox.x >= 0 && sendBox.x + sendBox.width <= 320)
    await page.evaluate(() => { Object.defineProperty(window.visualViewport, 'height', { value: window.innerHeight - 220, configurable: true }); window.visualViewport.dispatchEvent(new Event('resize')) })
    await page.waitForTimeout(100)
    const shifted = await page.locator('form[data-expanded]').boundingBox()
    assert.ok(shifted.y + shifted.height <= 568 - 215, 'composer remains above the simulated keyboard')
    if (locale === 'ar') await page.screenshot({ path: resolve(output, 'ai-arabic-320-light.png') })
    results.push({ locale, width: 320, overflow: false, keyboard: 'visualViewport event simulated', sendVisible: true })
    await context.close()
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  await context.addInitScript(() => localStorage.setItem('rwa.theme', 'light'))
  const page = await context.newPage()
  await page.goto(`${process.env.RWA_PREVIEW_URL || 'http://localhost:3034'}/dev/mobile-polish?screen=startup`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.locator('[data-startup-visual] canvas').waitFor(); await page.waitForTimeout(600)
  await page.screenshot({ path: resolve(output, 'startup-light.png') })
  await context.close()
  assert.deepEqual(errors, [])
  await writeFile(resolve(output, 'layout-acceptance.json'), JSON.stringify({ isolated: true, results, errors, physicalIphone: 'pending' }, null, 2))
  console.log('PASS: seven locales at 320px, RTL, send hit bounds, simulated keyboard and live particle renderer')
} finally { await browser.close() }
