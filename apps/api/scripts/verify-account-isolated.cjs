/* Fresh local PostgreSQL database only. Does not touch the configured app/test database.
 * Run from apps/api: node scripts/verify-account-isolated.cjs
 * Builds to tmp, runs database regressions, starts a private API, tests normal demo sign-in,
 * then drops only the uniquely named database this process successfully created.
 */
const { Client } = require('pg')
const { randomBytes } = require('node:crypto')
const { spawn } = require('node:child_process')
const { once } = require('node:events')
const { mkdirSync, existsSync, writeFileSync, unlinkSync } = require('node:fs')
const { resolve } = require('node:path')
const net = require('node:net')
const assert = require('node:assert/strict')

const cwd = resolve(__dirname, '..')
const databaseName = `rwa_codex_${Date.now()}_${randomBytes(4).toString('hex')}_test`
const pgBin = process.env.RWA_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/17/bin'
const exe = (name) => resolve(pgBin, `${name}${process.platform === 'win32' ? '.exe' : ''}`)
const cluster = resolve(cwd, 'tmp', databaseName)
let admin
let pgStarted = false
let created = false
let api
let apiExit
let passed = 0

function run(args, env = process.env) {
  return new Promise((ok, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit', windowsHide: true })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? ok() : reject(new Error(`Check exited with code ${code}`)))
  })
}
function pgRun(name, args, input) {
  return new Promise((ok, reject) => {
    const child = spawn(exe(name), args, { cwd, stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true })
    let diagnostic = ''
    child.stderr.on('data', (chunk) => { diagnostic = (diagnostic + chunk).slice(-1600) })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? ok() : reject(new Error(`${name} exited with code ${code}: ${diagnostic}`)))
    child.stdin.end(input)
  })
}
const delay = (ms) => new Promise((done) => setTimeout(done, ms))
async function freePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise((done) => server.close(done))
  return port
}

async function main() {
  assert(existsSync(exe('initdb')), 'Set RWA_TEST_PG_BIN to a local PostgreSQL bin directory')
  mkdirSync(resolve(cwd, 'tmp'), { recursive: true })
  const pgPort = await freePort()
  const password = randomBytes(32).toString('hex')
  const passwordFile = `${cluster}.bootstrap`
  writeFileSync(passwordFile, `${password}\n`, { mode: 0o600, flag: 'wx' })
  try {
    await pgRun('initdb', ['-D', cluster, '-U', 'codexqa', '-A', 'scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C'])
  } finally { unlinkSync(passwordFile) }
  await pgRun('pg_ctl', ['-D', cluster, '-l', resolve(cluster, 'server.log'), '-o', `-p ${pgPort} -h 127.0.0.1`, '-w', 'start'])
  pgStarted = true
  const source = new URL(`postgresql://codexqa:${password}@127.0.0.1:${pgPort}/postgres`)
  const databaseUrl = new URL(source)
  databaseUrl.pathname = `/${databaseName}`
  admin = new Client({ connectionString: source.toString(), connectionTimeoutMillis: 5000 })
  await admin.connect()
  assert(/^rwa_codex_\d+_[a-f0-9]+_test$/.test(databaseName))
  await admin.query(`CREATE DATABASE "${databaseName}"`)
  created = true
  console.log('Created a new isolated local database (existing databases untouched).')
  await run(['node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath',
    'test/notification/user-ops.integration.spec.ts', 'test/portfolio/portfolio.integration.spec.ts'],
    { ...process.env, NODE_ENV: 'test', APP_ENV: 'test', DATABASE_URL: '', TEST_DATABASE_URL: databaseUrl.toString() })
  await run(['node_modules/typescript/bin/tsc', '--outDir', 'tmp/b1-build', '--incremental', 'false'])
  const port = await freePort()
  const runtime = resolve(cwd, 'tmp/b1-runtime')
  mkdirSync(runtime, { recursive: true })
  const env = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
    NODE_ENV: 'test', APP_ENV: 'test', TEST_DATABASE_URL: databaseUrl.toString(), PORT: String(port),
    AUTH_ADAPTER: 'demo', IDENTITY_HMAC_KEY: randomBytes(32).toString('hex'), IDENTITY_ENC_KEY: randomBytes(32).toString('hex'),
    WALLET_CUSTODY_ADAPTER: 'stub', WALLET_EXECUTION_ENABLED: 'false', WALLET_EXECUTION_WORKER_ENABLED: 'false',
    POLYMARKET_TRADING_ENABLED: 'false', OBJECT_STORAGE_ENABLED: 'false',
  }
  // Run in a directory without .env: never inherit provider credentials or production workers.
  api = spawn(process.execPath, [resolve(cwd, 'tmp/b1-build/main.js')], { cwd: runtime, env, stdio: 'ignore', windowsHide: true })
  apiExit = once(api, 'exit')
  const base = `http://127.0.0.1:${port}`
  let ready = false
  for (let i = 0; i < 80; i++) {
    if (api.exitCode !== null) throw new Error(`Isolated API exited: ${api.exitCode}`)
    try { ready = (await fetch(`${base}/v1/health`, { signal: AbortSignal.timeout(1000) })).ok } catch {}
    if (ready) break
    await delay(500)
  }
  assert(ready, 'Isolated API must become ready')
  async function call(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(`${base}/v1/${path}`, {
      method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000),
    })
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null }
  }
  function check(name, result, predicate) {
    assert(predicate(result), `${name}: unexpected response (HTTP ${result.status}, code ${result.body?.code ?? result.body?.error?.code ?? 'none'})`)
    passed++
    console.log(`PASS ${name}`)
    return result.body
  }
  const ok = (r) => r.status >= 200 && r.status < 300
  async function signIn(suffix) {
    const email = `codex-b1-${suffix}@example.test`
    check(`register isolated ${suffix}`, await call('auth/demo/register', { method: 'POST', body: { email, locale: 'en' } }), ok)
    const login = check(`normal demo login ${suffix}`, await call('auth/demo/login', { method: 'POST', body: { email } }), (r) => ok(r) && typeof r.body.token === 'string')
    return login.token
  }
  const token = await signIn('owner')
  const other = await signIn('other')
  const auth = (path, options = {}) => call(path, { ...options, token })
  check('session contract', await auth('auth/session'), (r) => ok(r) && typeof r.body.emailVerified === 'boolean' && typeof r.body.userId === 'string')
  check('anonymous preferences denied', await call('user-ops/preferences'), (r) => r.status === 401)
  check('default preferences', await auth('user-ops/preferences'), (r) => ok(r) && r.body.channels.in_app === true && r.body.communicationConsent === false)
  check('save preferences', await auth('user-ops/preferences', { method: 'PUT', body: { locale: 'zh-CN', channels: { in_app: true, email: false }, communication_consent: true } }), (r) => ok(r) && r.body.locale === 'zh-CN' && r.body.communicationConsent === true)
  check('partial preferences preserve channels', await auth('user-ops/preferences', { method: 'PUT', body: { communication_consent: false } }), (r) => ok(r) && r.body.channels.email === false && r.body.communicationConsent === false)
  check('reject string channel boolean', await auth('user-ops/preferences', { method: 'PUT', body: { channels: { email: 'false' } } }), (r) => r.status === 400)
  check('reject overlong locale', await auth('user-ops/preferences', { method: 'PUT', body: { locale: 'english' } }), (r) => r.status === 400)
  check('other account preferences isolated', await call('user-ops/preferences', { token: other }), (r) => ok(r) && r.body.communicationConsent === false && r.body.locale !== 'zh-CN')
  const ticket = check('create support ticket', await auth('user-ops/tickets', { method: 'POST', body: { subject: 'Isolated QA', body: 'Contract test', category: 'support' } }), (r) => ok(r) && /^TKT-/.test(r.body.reference))
  check('ticket list', await auth('user-ops/tickets'), (r) => ok(r) && r.body.some((t) => t.id === ticket.id))
  check('ticket timeline', await auth(`user-ops/tickets/${ticket.id}/timeline`), (r) => ok(r) && r.body.messages.length === 1 && r.body.events[0].eventType === 'created')
  check('reply support ticket', await auth(`user-ops/tickets/${ticket.id}/messages`, { method: 'POST', body: { body: 'Follow-up' } }), (r) => ok(r) && r.body.messages.length === 2)
  check('cross-account ticket denied', await call(`user-ops/tickets/${ticket.id}/timeline`, { token: other }), (r) => r.status === 404)
  check('close support ticket', await auth(`user-ops/tickets/${ticket.id}/close`, { method: 'PUT' }), (r) => ok(r) && r.body.status === 'closed')
  check('closed ticket reply rejected', await auth(`user-ops/tickets/${ticket.id}/messages`, { method: 'POST', body: { body: 'Should fail' } }), (r) => r.status === 409)
  check('empty support subject rejected', await auth('user-ops/tickets', { method: 'POST', body: { subject: '', body: 'No subject' } }), (r) => r.status === 400)
  check('KYC nullable contract', await auth('compliance/kyc/status'), (r) => ok(r) && (r.body === null || typeof r.body.state === 'string'))
  const questionnaire = check('public risk questionnaire', await call('compliance/risk-profile/questionnaire'), (r) => ok(r) && r.body.questions.length === 6)
  const answers = Object.fromEntries(questionnaire.questions.map((q) => [q.key, 3]))
  check('risk answer decimal rejected', await auth('compliance/risk-profile', { method: 'POST', body: { answers: { ...answers, experience: 2.5 } } }), (r) => r.status === 400)
  check('risk profile save', await auth('compliance/risk-profile', { method: 'POST', body: { answers } }), (r) => ok(r) && r.body.score === 50 && r.body.band === 'balanced')
  check('risk profile readback', await auth('compliance/risk-profile'), (r) => ok(r) && r.body.answers.experience === 3)
  check('eligibility evaluation', await auth('compliance/eligibility/evaluate', { method: 'POST', body: { productScope: 'default' } }), (r) => ok(r) && Array.isArray(r.body.reasonCodes))
  check('sessions contract', await auth('security/sessions'), (r) => ok(r) && r.body.some((s) => s.isCurrent))
  check('devices contract', await auth('security/devices'), (r) => ok(r) && Array.isArray(r.body))
  check('factors contract', await auth('security/factors'), (r) => ok(r) && Array.isArray(r.body.totp) && Array.isArray(r.body.passkeys))
  const invitation = check('create invitation', await auth('user-ops/invitations', { method: 'POST', body: { role: 'member' } }), (r) => ok(r) && typeof r.body.token === 'string' && r.body.view.state === 'pending')
  check('invitation list hides token', await auth('user-ops/invitations'), (r) => ok(r) && r.body.every((i) => !('token' in i)))
  check('revoke invitation', await auth(`user-ops/invitations/${invitation.view.id}/revoke`, { method: 'PUT' }), (r) => ok(r) && r.body.state === 'revoked')
  check('rewards contract', await auth('user-ops/rewards'), (r) => ok(r) && Array.isArray(r.body))
  console.log(`Account HTTP checks: ${passed} passed; no production providers or financial operations used.`)
}

main().catch((error) => { console.error(`FAIL ${error.message}`); process.exitCode = 1 }).finally(async () => {
  if (api && api.exitCode === null) { api.kill(); await apiExit }
  if (created) {
    assert(/^rwa_codex_\d+_[a-f0-9]+_test$/.test(databaseName))
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`)
    console.log('Removed only the isolated database created by this run.')
  }
  if (admin) await admin.end()
  if (pgStarted) {
    await pgRun('pg_ctl', ['-D', cluster, '-m', 'fast', '-w', 'stop'])
    console.log('Stopped the private PostgreSQL cluster; existing database services untouched.')
  }
})
