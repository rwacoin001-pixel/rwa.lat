import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Local browser fixtures only. This exercises real jsQR, MediaStream/canvas capture,
// and FormData submission. No request is sent to a live KYC provider or account.
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.RWA_PLAYWRIGHT_DIR ? resolve(process.env.RWA_PLAYWRIGHT_DIR, 'playwright') : 'playwright')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { QRCodeSVG } = require('qrcode.react')
const base = process.env.RWA_PREVIEW_URL || 'http://localhost:3034'
const output = resolve(process.env.RWA_CAPTURE_OUTPUT || 'artifacts/mobile-polish/capture')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, ...(process.env.RWA_BROWSER_CHANNEL ? { channel: process.env.RWA_BROWSER_CHANNEL } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const results = []
const contexts = []
const pageFailures = new WeakMap()

async function makeContext({ denied = false, theme = 'dark', locale = 'en', width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale, permissions: ['camera'], colorScheme: theme === 'dark' ? 'dark' : 'light' })
  contexts.push(context)
  await context.addInitScript(({ denied, theme, locale }) => {
    localStorage.setItem('rwa.theme', theme)
    localStorage.setItem('rwa-language', locale)
    window.__captureTracks = []
    window.__cameraCalls = 0
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.__cameraCalls += 1
      if (denied) throw new DOMException('Fixture camera denial', 'NotAllowedError')
      const stream = await original(constraints)
      window.__captureTracks.push(...stream.getTracks())
      return stream
    }
  }, { denied, theme, locale })
  // Intercept any unrelated API read and deny external traffic in this isolated harness.
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/v1/')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'ISOLATED_QA', message: 'Isolated browser fixture' }) })
    if (url.origin !== new URL(base).origin && !['data:', 'blob:'].includes(url.protocol)) return route.abort()
    return route.continue()
  })
  return context
}

async function open(context, screen) {
  const page = await context.newPage()
  const failures = []
  pageFailures.set(page, failures)
  page.on('pageerror', error => failures.push(error.stack || error.message))
  page.on('console', event => { if (event.type() === 'error' && !event.text().includes('Failed to load resource')) failures.push(`${event.text()} ${JSON.stringify(event.location())}`) })
  const response = await page.goto(`${base}/dev/mobile-polish?screen=${screen}`, { waitUntil: 'networkidle', timeout: 120_000 })
  assert.equal(response?.status(), 200, 'isolated capture fixture must return HTTP 200')
  try { await page.getByRole('dialog').waitFor() }
  catch (cause) {
    await page.screenshot({ path: resolve(output, `${screen}-render-failed.png`) })
    throw new Error(`Capture dialog did not render at ${page.url()}: ${JSON.stringify(failures)}; ${await page.locator('body').innerText()}`, { cause })
  }
  assert.deepEqual(failures, [], 'capture must render without app-boundary/console errors')
  return page
}

async function closeQaPage(page) {
  assert.deepEqual(pageFailures.get(page), [], 'capture actions must not throw app-boundary/console errors')
  await page.close()
}

async function photograph(page, screenshot) {
  await page.getByRole('button', { name: 'Open camera', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0)
  if (screenshot) await page.screenshot({ path: resolve(output, `${screenshot}-live.png`) })
  await page.getByRole('button', { name: 'Capture', exact: true }).click()
  await page.locator('img[src^="blob:"]').first().waitFor()
  if (screenshot) await page.screenshot({ path: resolve(output, `${screenshot}-photo.png`) })
  assert.equal(await page.evaluate(() => window.__captureTracks.every(track => track.readyState === 'ended')), true, 'capturing must release every camera track before review')
}

async function qrImage(text) {
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
  const svg = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: text, size: 300, marginSize: 4, bgColor: '#fff', fgColor: '#000', level: 'M' }))
  await page.setContent(`<html><body style="margin:0;background:white">${svg}</body></html>`)
  const png = await page.locator('svg').screenshot()
  await page.close()
  return { name: 'fixture-qr.png', mimeType: 'image/png', buffer: png }
}

try {
  const denied = await makeContext({ denied: true })
  const deniedPage = await open(denied, 'scanner')
  await deniedPage.getByText('Allow camera access and retry, or choose an image.', { exact: true }).waitFor()
  assert.equal(await deniedPage.evaluate(() => window.__cameraCalls), 1)
  await deniedPage.getByRole('button', { name: 'Retry camera', exact: true }).click()
  await deniedPage.waitForFunction(() => window.__cameraCalls === 2)
  await deniedPage.locator('input[type=file]').setInputFiles(await qrImage('https://evil.example/assets/cash/transfer?to=029f652b-6dc2-4b04-ac9f-2f69ff50daaf'))
  await deniedPage.getByText('No valid platform receive code. Reposition it or choose another image.', { exact: true }).waitFor()
  assert.equal(await deniedPage.getByRole('dialog').count(), 1, 'invalid decoded QR must keep capture open')
  await deniedPage.screenshot({ path: resolve(output, 'scanner-invalid-qr.png') })
  await deniedPage.getByRole('button', { name: 'Close scanner', exact: true }).click()
  await deniedPage.getByRole('dialog').waitFor({ state: 'detached' })
  results.push('scanner camera denial, retry, real jsQR image decoding, invalid QR rejection, close')
  await closeQaPage(deniedPage)

  const active = await makeContext()
  const scannerPage = await open(active, 'scanner')
  await scannerPage.getByText('Looking for a receive code', { exact: true }).waitFor()
  assert.equal(await scannerPage.getByRole('button', { name: 'Light on', exact: true }).count(), 0, 'unsupported flash must not be offered')
  await scannerPage.screenshot({ path: resolve(output, 'scanner-live.png') })
  await scannerPage.keyboard.press('Escape')
  await scannerPage.getByRole('dialog').waitFor({ state: 'detached' })
  assert.equal(await scannerPage.evaluate(() => window.__captureTracks.every(track => track.readyState === 'ended')), true, 'scanner dismissal must stop the stream')
  results.push('scanner live stream, unsupported torch hidden, Escape dismissal, stream cleanup')
  await closeQaPage(scannerPage)

  const validScannerPage = await open(active, 'scanner')
  await validScannerPage.getByText('Looking for a receive code', { exact: true }).waitFor()
  const recipient = '029f652b-6dc2-4b04-ac9f-2f69ff50daaf'
  await validScannerPage.locator('input[type=file]').setInputFiles(await qrImage(`https://rwa.lat/assets/cash/transfer?to=${recipient}`))
  await validScannerPage.getByRole('dialog').waitFor({ state: 'detached' })
  assert.equal(await validScannerPage.locator('output[data-recipient]').textContent(), recipient, 'valid decoded platform QR must reach the recipient callback')
  assert.equal(await validScannerPage.evaluate(() => window.__captureTracks.every(track => track.readyState === 'ended')), true, 'successful QR acceptance must release the stream')
  results.push('scanner real jsQR valid platform receive code, exact recipient callback, stream cleanup on acceptance')
  await closeQaPage(validScannerPage)

  const kyc = await makeContext()
  const submissions = []
  let finishThird
  let thirdArrived
  const thirdReady = new Promise(resolve => { thirdArrived = resolve })
  await kyc.route('**/v1/compliance/kyc/capture', async route => {
    const req = route.request()
    const body = await new Request('http://fixture.local', { method: 'POST', headers: { 'Content-Type': req.headers()['content-type'] }, body: req.postDataBuffer() }).formData()
    assert.equal(body.get('documentType'), 'id_card')
    for (const key of ['front', 'back', 'selfie']) {
      const file = body.get(key)
      assert.ok(file instanceof File && file.size > 1000 && file.size <= 5 * 1024 * 1024, `${key} must be an actual captured file`)
      assert.equal(file.type, 'image/jpeg')
      assert.deepEqual([...new Uint8Array(await file.arrayBuffer()).slice(0, 2)], [255, 216], `${key} must contain JPEG pixels`)
    }
    submissions.push(req.headers()['idempotency-key'])
    if (submissions.length < 3) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'PROVIDER_UNAVAILABLE', message: 'Fixture provider temporarily unavailable' }) })
    await new Promise(resolve => { finishThird = resolve; thirdArrived() })
    const now = '2026-10-04T00:00:00Z'
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'qa-case', userId: 'qa-user', state: 'submitted', provider: 'didit', reasonCode: null, submittedAt: now, decidedAt: null, expiresAt: null, createdAt: now, updatedAt: now }) })
  })
  const kycPage = await open(kyc, 'kyc')
  await kycPage.screenshot({ path: resolve(output, 'kyc-document-choice.png') })
  await kycPage.getByRole('button', { name: 'ID / driving licence / residence card Front & back · Selfie', exact: true }).click()
  await photograph(kycPage, 'kyc-front')
  await kycPage.getByRole('button', { name: 'Continue', exact: true }).click()
  await photograph(kycPage, 'kyc-back')
  await kycPage.getByRole('button', { name: 'Continue', exact: true }).click()
  await kycPage.screenshot({ path: resolve(output, 'kyc-selfie-guide.png') })
  await photograph(kycPage, 'kyc-selfie')
  await kycPage.getByRole('button', { name: 'Continue', exact: true }).click()
  assert.equal(await kycPage.locator('figure img').count(), 3)
  await kycPage.screenshot({ path: resolve(output, 'kyc-review.png') })
  const firstSubmitted = kycPage.waitForResponse('**/v1/compliance/kyc/capture')
  await kycPage.getByRole('button', { name: 'Submit verification', exact: true }).click()
  await firstSubmitted
  await kycPage.getByRole('alert').filter({ hasText: 'PROVIDER_UNAVAILABLE' }).waitFor()
  const retried = kycPage.waitForResponse('**/v1/compliance/kyc/capture')
  await kycPage.getByRole('button', { name: 'Submit verification', exact: true }).click()
  await retried
  await kycPage.waitForFunction(() => document.querySelector('[role=alert]')?.textContent?.includes('PROVIDER_UNAVAILABLE'))
  assert.equal(submissions.length, 2)
  assert.ok(submissions[0], 'submission must carry an idempotency key')
  assert.equal(submissions[0], submissions[1], 'retry without changed photos must reuse the key')
  await kycPage.getByRole('button', { name: 'Retake: Document front', exact: true }).click()
  await photograph(kycPage)
  await kycPage.getByRole('button', { name: 'Continue', exact: true }).click()
  await kycPage.getByRole('button', { name: 'Submit verification', exact: true }).click()
  await kycPage.getByRole('button', { name: 'Verifying…', exact: true }).waitFor()
  await thirdReady
  assert.notEqual(submissions[2], submissions[0], 'changed evidence must start a new idempotency key')
  await kycPage.keyboard.press('Escape')
  assert.equal(await kycPage.getByRole('dialog').count(), 1, 'in-flight submission must not dismiss')
  finishThird()
  await kycPage.getByRole('dialog').waitFor({ state: 'detached' })
  results.push('KYC actual document front/back/selfie capture, camera release, photo review/retake, JPEG multipart, retry key reuse/change, submitted response only')
  await closeQaPage(kycPage)

  const deniedKycPage = await open(denied, 'kyc')
  await deniedKycPage.getByRole('button', { name: 'Passport Personal details page · Selfie', exact: true }).click()
  await deniedKycPage.getByRole('button', { name: 'Open camera', exact: true }).click()
  await deniedKycPage.getByRole('alert').filter({ hasText: 'Camera unavailable. Allow camera access and retry.' }).waitFor()
  assert.equal(await deniedKycPage.getByRole('button', { name: 'Submit verification', exact: true }).count(), 0, 'denied camera must not bypass required photos')
  await deniedKycPage.screenshot({ path: resolve(output, 'kyc-camera-denied.png') })
  results.push('KYC camera denial remains retryable; no submit without required captured photos')
  await closeQaPage(deniedKycPage)

  const arabic = await makeContext({ denied: true, locale: 'ar', width: 320, height: 700 })
  const arabicPage = await open(arabic, 'scanner')
  await arabicPage.getByText('اسمح بالكاميرا وأعد المحاولة أو اختر صورة.', { exact: true }).waitFor()
  const bounds = await arabicPage.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  assert.ok(bounds.scroll <= bounds.width, 'RTL narrow capture must fit the viewport')
  await arabicPage.screenshot({ path: resolve(output, 'scanner-arabic-320.png') })
  results.push('Arabic scanner at 320px with no horizontal overflow')
  await closeQaPage(arabicPage)
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ passed: results, scope: 'Isolated browser fixtures; real device, permissions, camera focus and Didit acceptance remain pending.' }, null, 2))
  console.log(results.map(result => `PASS ${result}`).join('\n'))
} finally {
  await Promise.all(contexts.map(context => context.close()))
  await browser.close()
}
