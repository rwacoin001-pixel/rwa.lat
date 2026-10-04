import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(resolve(process.env.RWA_PLAYWRIGHT_DIR, 'playwright'))
const output = resolve(process.env.RWA_PREVIEW_OUTPUT || 'artifacts/mobile-polish')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.RWA_BROWSER_CHANNEL || 'chrome', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN', permissions: ['camera', 'microphone'] })
const errors = [], requests = [], checks = []
let failNext = false, count = 0
await context.addInitScript(() => {
  localStorage.setItem('rwa.theme', 'dark'); localStorage.setItem('rwa-language', 'zh-CN')
  localStorage.setItem('rwa.session', JSON.stringify({ sessionToken: 'isolated-test-only', userId: 'isolated-owner', loggedInAt: new Date().toISOString() }))
  window.SpeechRecognition = class { start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: '测试语音文字' }]] }); this.onend?.() }, 20) } stop() { this.onend?.() } abort() {} }
  window.__speechCalls = 0
  Object.defineProperty(window, 'speechSynthesis', { value: { speak(utterance) { window.__speechCalls++; setTimeout(() => utterance.onend?.(), 50) }, cancel() {}, getVoices() { return [] } }, configurable: true })
})
await context.route('**/v1/**', async route => {
  const url = new URL(route.request().url()), body = route.request().postDataJSON()
  requests.push({ path: url.pathname, body })
  let data = {}, status = 200
  if (url.pathname === '/v1/ai/status') data = { available: true, configured: true }
  if (url.pathname === '/v1/ai/chat') {
    if (failNext) { failNext = false; status = 503; data = { code: 'AI_UPSTREAM_UNAVAILABLE', message: 'Isolated retry test' } }
    else { count++; data = { sessionId: 'isolated-chat', messageId: `isolated-message-${count}`, reply: count === 1 ? 'PREMATURE_ANSWER_MUST_STAY_HIDDEN' : '最终答案：这是隔离交互验证。', citations: [], questions: count === 1 ? [{ id: 'goal', title: '请选择目标', multiple: false, options: [{ id: 'income', label: '收益' }, { id: 'risk', label: '风险' }] }] : [] } }
  }
  if (url.pathname === '/v1/ai/investment/mandate') data = { mandate: null, executionEnabled: false, termsVersion: 'test', currency: 'USDT', decimals: 6 }
  if (url.pathname === '/v1/ai/investment/choices') data = { products: [], positions: [] }
  if (url.pathname === '/v1/ai/sessions' || url.pathname === '/v1/ai/investment/runs') data = []
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
})
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.stack || error.message))
page.on('console', event => { if (event.type() === 'error' && !event.text().includes('Failed to load resource')) errors.push(event.text()) })
const go = async screen => { const path = screen === 'ai' && process.env.RWA_UI_PAGE ? process.env.RWA_UI_PAGE : `/dev/mobile-polish?screen=${screen}`; await page.goto(`${process.env.RWA_PREVIEW_URL || 'http://localhost:3034'}${path}`, { waitUntil: 'networkidle', timeout: 120000 }); assert.equal(await page.getByText('This view could not be loaded.').count(), 0) }
const check = name => { checks.push(name); console.log(`PASS: ${name}`) }
try {
  await go('ai')
  const input = page.locator('textarea').first()
  await input.waitFor({ state: 'visible' })
  assert.equal(await page.locator('form button[type=submit]').count(), 0)
  await page.screenshot({ path: resolve(output, 'ai-idle-dark.png') })
  await input.focus(); await page.waitForTimeout(300)
  assert.equal(await page.locator('form[data-expanded]').count(), 1)
  await page.screenshot({ path: resolve(output, 'ai-focused-dark.png') })
  await input.fill('帮我了解产品')
  await page.locator('form[data-expanded] button[type=submit]').click()
  await page.getByText('请选择目标', { exact: true }).first().waitFor()
  assert.equal(await page.getByText('PREMATURE_ANSWER_MUST_STAY_HIDDEN').count(), 0)
  await page.screenshot({ path: resolve(output, 'ai-question-first-dark.png') })
  await page.locator('label').filter({ hasText: '收益' }).click()
  assert.equal(await page.getByRole('radio', { name: /收益/ }).isChecked(), true)
  // Clarification card and text composer each have a send action; the card owns the first.
  await page.getByRole('button', { name: '发送', exact: true }).first().click()
  await page.getByText('最终答案：这是隔离交互验证。', { exact: true }).waitFor()
  check('question choices precede answer; send only appears for text')
  await page.getByRole('button', { name: '朗读', exact: true }).click()
  assert.equal(await page.evaluate(() => window.__speechCalls), 1)
  await page.getByRole('button', { name: '有帮助', exact: true }).click()
  await page.waitForTimeout(100)
  assert.equal(requests.some(row => row.path === '/v1/ai/feedback' && row.body.helpful === true), true)
  check('answer playback and authenticated feedback actions use their actual handlers')
  await page.screenshot({ path: resolve(output, 'ai-answer-dark.png') })
  await input.fill(''); await input.blur()
  await page.getByRole('button', { name: '语音输入', exact: true }).click()
  await page.waitForTimeout(100)
  assert.equal(await input.inputValue(), '测试语音文字')
  check('voice transcript enters composer')
  await input.fill('读取文件')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'statement.txt', mimeType: 'text/plain', buffer: Buffer.from('A statement with a 200 USDT balance.') })
  await page.locator('form summary').filter({ hasText: 'statement.txt' }).waitFor()
  failNext = true
  await page.locator('form[data-expanded] button[type=submit]').click()
  await page.getByRole('button', { name: '重新发送', exact: true }).waitFor()
  assert.equal(await input.inputValue(), '读取文件')
  assert.equal(await page.locator('form summary').filter({ hasText: 'statement.txt' }).count(), 1)
  await page.getByRole('button', { name: '重新发送', exact: true }).click()
  await page.waitForTimeout(500)
  const sent = requests.filter(row => row.path === '/v1/ai/chat').at(-1).body
  assert.equal(sent.attachments[0].text, 'A statement with a 200 USDT balance.')
  check('real text extraction reaches API; failed send and retry preserve attachments/draft')

  if (process.env.RWA_UI_PAGE) {
    assert.deepEqual(errors, [])
    await writeFile(resolve(output, 'ui-acceptance.json'), JSON.stringify({ isolated: true, checks, errors, runtimePage: process.env.RWA_UI_PAGE }, null, 2))
    console.log('PASS: production app page handlers')
  } else {
  await go('scanner')
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.waitForTimeout(500)
  const cameraPlaying = await page.locator('video').evaluate(video => video.readyState >= 2 && !!video.srcObject)
  assert.equal(cameraPlaying, true)
  await page.screenshot({ path: resolve(output, 'scanner-dark.png') })
  await dialog.locator('button').first().click()
  await dialog.waitFor({ state: 'detached' })
  check('scanner mounts focus-managed camera dialog and closes cleanly')

  await go('kyc')
  await page.getByRole('dialog').waitFor()
  await page.screenshot({ path: resolve(output, 'kyc-choice-dark.png') })
  check('KYC dialog renders without modifying compliance status')
  await writeFile(resolve(output, 'ui-acceptance.json'), JSON.stringify({ isolated: true, checks, errors }, null, 2))
  assert.deepEqual(errors, [])
  }
} finally { await browser.close() }
