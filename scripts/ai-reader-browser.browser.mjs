import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(resolve(process.env.RWA_PLAYWRIGHT_DIR, 'playwright'))
const output = resolve(process.env.RWA_PREVIEW_OUTPUT || 'artifacts/mobile-polish')
const fixtures = resolve(process.env.RWA_READER_FIXTURES || output + '/fixtures')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.RWA_BROWSER_CHANNEL || 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: 'en-US' })
await context.addInitScript(() => { localStorage.setItem('rwa.theme', 'dark'); localStorage.setItem('rwa-language', 'en') })
const sent = [], errors = [], assetRequests = []
await context.route('**/v1/**', async route => {
  const path = new URL(route.request().url()).pathname
  let body = path === '/v1/ai/status' ? { available: true, configured: true } : {}
  if (path === '/v1/ai/chat') { sent.push(route.request().postDataJSON()); body = { sessionId: 'isolated', reply: 'Parsed local fixture.', questions: [], citations: [] } }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
page.on('console', event => { if (event.type() === 'error' && !event.text().includes('Failed to load resource')) errors.push(event.text()) })
page.on('request', request => { if (request.url().includes('/ai-ocr/')) assetRequests.push(request.url()) })
try {
  await page.goto(`${process.env.RWA_PREVIEW_URL || 'http://localhost:3034'}${process.env.RWA_READER_PAGE || '/dev/mobile-polish?screen=ai'}`, { waitUntil: 'networkidle', timeout: 120000 })
  const fileInput = page.locator('input[type=file]').first()
  for (const name of ['reader.pdf', 'reader.docx', 'reader.png']) {
    await fileInput.setInputFiles(resolve(fixtures, name))
    await page.locator('form summary').filter({ hasText: name }).waitFor({ timeout: 120000 })
    console.log(`PASS: browser extraction ${name}`)
  }
  const excerpts = await page.locator('form details pre').allTextContents()
  assert.equal(excerpts.length, 3)
  for (const text of excerpts) assert.match(text, /balance 200 USDT/i)
  await page.locator('form details summary').last().click()
  await page.screenshot({ path: resolve(output, 'ai-attachments-dark.png') })
  await page.locator('form button[type=submit]').click()
  await page.getByText('Parsed local fixture.', { exact: true }).waitFor()
  assert.deepEqual(sent[0].attachments.map(row => row.method), ['pdf', 'docx', 'ocr'])
  assert.equal(sent[0].attachments.every(row => typeof row.text === 'string' && !('data' in row) && !('base64' in row)), true)
  assert.equal(assetRequests.some(url => url.includes('pdf.worker')), true)
  assert.equal(assetRequests.some(url => url.includes('worker.min.js')), true)
  assert.equal(assetRequests.some(url => url.includes('eng.traineddata')), true)
  assert.deepEqual(errors, [])
  await writeFile(resolve(output, 'ai-reader-acceptance.json'), JSON.stringify({ isolated: true, methods: ['pdf', 'docx', 'ocr'], excerpt: excerpts, localAssets: assetRequests, binaryUpload: false, errors }, null, 2))
  console.log('PASS: actual PDF/DOCX/OCR text reaches isolated API; local workers and language data')
} finally { await browser.close() }
