import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

// Local development only. Share configuration in child process environments;
// credentials are never printed, passed in command arguments or written to files.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'apps/api/package.json'))
const { parse } = require('dotenv')
const api = parse(readFileSync(resolve(root, 'apps/api/.env')))
const admin = parse(readFileSync(resolve(root, 'apps/admin/.env')))

function assertLocalDatabase(value, key) {
  if (!value) throw new Error(`${key} is required`)
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || decodeURIComponent(url.pathname.slice(1)) !== 'rwa_lat_dev') throw new Error(`${key} must target local rwa_lat_dev`)
}
assertLocalDatabase(api.DATABASE_URL, 'DATABASE_URL')
assertLocalDatabase(admin.ADMIN_DATABASE_URL ?? admin.DATABASE_URL, 'ADMIN_DATABASE_URL')
if (admin.CORE_DATABASE_URL) assertLocalDatabase(admin.CORE_DATABASE_URL, 'CORE_DATABASE_URL')
if (api.APP_ENV !== 'development' || (admin.APP_ENV && admin.APP_ENV !== 'development')) throw new Error('This launcher requires APP_ENV=development')
if (api.PRODUCTION_FINANCIAL_FEATURES_ENABLED === 'true' || api.WALLET_EXECUTION_ENABLED === 'true') throw new Error('Local acceptance requires financial execution switches to remain off')
if (admin.CORE_API_URL && !/^http:\/\/(localhost|127\.0\.0\.1):4000\/v1\/?$/.test(admin.CORE_API_URL)) throw new Error('CORE_API_URL must target the local API')

const tokens = [api.ADMIN_SERVICE_TOKEN, admin.ADMIN_SERVICE_TOKEN].filter(Boolean)
if (new Set(tokens).size > 1) throw new Error('Local API and admin service tokens do not match')
const token = tokens[0] ?? randomBytes(32).toString('base64url')
if (token.length < 32) throw new Error('ADMIN_SERVICE_TOKEN must contain at least 32 characters')
const apiPort = process.env.LOCAL_OPS_API_PORT ?? '4000'
if (!['4000', '4001'].includes(apiPort)) throw new Error('Local API port must be 4000 or 4001')
const storage = Object.fromEntries(Object.entries(api).filter(([key]) => key.startsWith('S3_') || key.startsWith('OBJECT_STORAGE_')))
const apiEnv = { ...process.env, ...api, NODE_ENV: 'development', APP_ENV: 'development', PORT: apiPort, ADMIN_SERVICE_TOKEN: token }
const adminEnv = { ...process.env, ...storage, ...admin, NODE_ENV: 'development', APP_ENV: 'development', PORT: '4100',
  CORE_DATABASE_URL: admin.CORE_DATABASE_URL ?? api.DATABASE_URL, CORE_API_URL: `http://localhost:${apiPort}/v1`, ADMIN_SERVICE_TOKEN: token }
const mode = process.argv[2]
const buildFolder = process.env.LOCAL_OPS_ISOLATED_BUILD === 'true' ? '.local-runtime' : 'dist'
for (const app of ['api', 'admin']) {
  if (!existsSync(resolve(root, `apps/${app}/${buildFolder}/main.js`))) throw new Error(`The ${app} ${buildFolder} build is missing`)
}
if (mode === '--check') {
  console.log(`Local configuration validated: API ${apiPort}, admin 4100, local rwa_lat_dev, shared operations channel, ${buildFolder} build. No credentials printed.`)
} else {
  if (mode) throw new Error('Usage: local-ops-runtime.mjs [--check]')
  const children = [spawn(process.execPath, [`${buildFolder}/main.js`], { cwd: resolve(root, 'apps/api'), env: apiEnv, stdio: 'inherit', windowsHide: true }),
    spawn(process.execPath, [`${buildFolder}/main.js`], { cwd: resolve(root, 'apps/admin'), env: adminEnv, stdio: 'inherit', windowsHide: true })]
  let stopping = false
  function stop(code = 0) {
    if (stopping) return
    stopping = true
    for (const child of children) child.kill()
    process.exitCode = code
  }
  for (const child of children) {
    child.on('error', () => { console.error('Local service could not start.'); stop(1) })
    child.on('exit', code => { if (!stopping) stop(code ?? 1) })
  }
  process.on('SIGINT', () => stop())
  process.on('SIGTERM', () => stop())
}
