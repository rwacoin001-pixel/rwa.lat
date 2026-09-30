import { randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

// A fresh disposable PostgreSQL container is the only destructive test target.
// Credentials remain in process environments and are never written or printed.
const root = resolve(import.meta.dirname, '..')
const require = createRequire(resolve(root, 'apps/api/package.json'))
const { Client } = require('pg')
const name = `rwa-codex-db-${randomUUID().slice(0, 8)}`
const database = 'rwa_lat_codex_20260928_test'
const password = randomBytes(32).toString('hex')
const emailCodeOnly = process.argv[2] === '--email-code'
const legalHttpOnly = process.argv[2] === '--legal-http'
const legalOnly = legalHttpOnly || process.argv[2] === '--legal'
if (process.argv[2] && !emailCodeOnly && !legalOnly) throw new Error('Use no argument for the full queue, --email-code, --legal, or --legal-http')
const dockerEnv = { ...process.env, POSTGRES_PASSWORD: password }
let container
function docker(args) {
  const result = spawnSync('docker', args, { env: dockerEnv, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
  if (result.error || result.status !== 0) throw new Error(`Docker operation failed: ${args[0]} (credentials omitted)`)
  return result.stdout.trim()
}
function run(cwd, args, env) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit', windowsHide: true })
  if (result.error || result.status !== 0) throw new Error(`Verification failed in ${cwd.endsWith('api') ? 'API' : 'admin'}; inspect preceding test failure`)
}
try {
  container = docker(['run', '--detach', '--rm', '--name', name, '--label', 'rwa.verification=codex-20260928',
    '--memory', '512m', '--cpus', '1', '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD',
    '--env', `POSTGRES_DB=${database}`, 'postgres:16-bookworm'])
  if (!/^[a-f0-9]{64}$/.test(container)) throw new Error('Unexpected disposable container identity')
  const port = docker(['port', container, '5432/tcp']).match(/^127\.0\.0\.1:(\d+)$/)?.[1]
  if (!port) throw new Error('Database must be exposed only on loopback')
  const connectionString = `postgres://postgres:${password}@127.0.0.1:${port}/${database}`
  let ready = false
  for (let attempt = 0; attempt < 45; attempt++) {
    const db = new Client({ connectionString, connectionTimeoutMillis: 1000 })
    try {
      await db.connect()
      const row = (await db.query('SELECT current_database() AS name')).rows[0]
      if (row.name !== database) throw new Error('Unexpected isolated database')
      ready = true
    } catch { /* Startup is bounded; never print a connection string. */ }
    finally { await db.end().catch(() => {}) }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready')
  console.log(JSON.stringify({ database, container: name, version: 16, newDisposableDatabase: true, sharedAndDevelopmentDatabasesUntouched: true }))
  const env = { ...process.env, APP_ENV: 'test', NODE_ENV: 'test', TEST_DATABASE_URL: connectionString,
    TEST_DATABASE_HEAP_MB: '1024', PG_SSL: 'false', RECURRING_INVESTMENT_WORKER_ENABLED: 'false',
    NOTIFICATION_DELIVERY_WORKER_ENABLED: 'false', DOCUMENT_GENERATION_WORKER_ENABLED: 'false' }
  run(resolve(root, 'apps/api'), emailCodeOnly || legalOnly
    ? ['--max-old-space-size=1024', 'node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', ...(legalHttpOnly ? ['test/legal/legal-publications.integration.spec.ts'] : legalOnly ? ['test/legal/legal-publications.integration.spec.ts','test/identity/email-code.integration.spec.ts','test/identity/identity.integration.spec.ts'] : ['test/identity/email-code.integration.spec.ts'])]
    : ['scripts/test-database-low-memory.mjs'], env)
  if (!legalHttpOnly) run(resolve(root, 'apps/api'), ['scripts/verify-migration-rehearsal.mjs'], env)
  if (!emailCodeOnly && !legalHttpOnly) run(resolve(root, 'apps/admin'), ['--max-old-space-size=1024', 'node_modules/jest/bin/jest.js', '--runInBand', '--runTestsByPath', 'test/admin.integration.spec.ts'], env)
  console.log(legalHttpOnly ? 'Legal HTTP isolated database verification passed.' : legalOnly ? 'Legal publication and identity isolated database verification passed.' : emailCodeOnly ? 'Mobile email code isolated database verification passed.' : 'Full API and admin isolated database queues passed.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (container && /^[a-f0-9]{64}$/.test(container)) {
    try { docker(['stop', '--time', '5', container]); console.log('Owned disposable database container stopped and automatically removed.') }
    catch { console.error(`Cleanup needs attention: owned test container ${name}`); process.exitCode = 1 }
  }
}
