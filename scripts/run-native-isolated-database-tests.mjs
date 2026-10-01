import { randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, relative } from 'node:path'
import net from 'node:net'

// A new private local cluster avoids resetting any existing database or role.
const root = resolve(import.meta.dirname, '..')
const bin = process.env.TEST_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/17/bin'
const base = resolve(root, 'tmp', `isolated-pg-20260928-${randomUUID().slice(0, 8)}`)
const data = resolve(base, 'data')
if (!relative(resolve(root, 'tmp'), base).startsWith('isolated-pg-20260928-')) throw new Error('Invalid test data directory')
const password = randomBytes(32).toString('hex')
const passwordFile = resolve(base, 'bootstrap-password')
const require = createRequire(resolve(root, 'apps/api/package.json'))
const { Client } = require('pg')
const database = 'rwa_lat_codex_20260928_test'
const socket = net.createServer()
await new Promise((ok, fail) => { socket.once('error', fail); socket.listen(0, '127.0.0.1', ok) })
const port = socket.address().port
await new Promise(ok => socket.close(ok))
if (port === 5432) throw new Error('Refusing the application database port')
function command(exe, args, options = {}) {
  const result = spawnSync(exe, args, { encoding: 'utf8', windowsHide: true, timeout: 120_000, ...options })
  if (result.error || result.status !== 0) throw new Error(`Isolated setup failed: ${exe.split(/[\\/]/).pop()} (credentials omitted)`)
  return result.stdout
}
function run(cwd, args, env) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit', windowsHide: true })
  if (result.error || result.status !== 0) throw new Error('Isolated verification failed; inspect preceding test output')
}
try {
  mkdirSync(base, { recursive: true })
  const sid = command('whoami.exe', ['/user', '/fo', 'csv', '/nh']).match(/S-1-[\d-]+/)?.[0]
  if (!sid) throw new Error('Could not identify local cluster owner')
  // Restrict this newly created directory before writing its temporary password.
  command('icacls.exe', [base, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`])
  writeFileSync(passwordFile, password + '\n', { flag: 'wx' })
  try {
    command(resolve(bin, 'initdb.exe'), ['-D', data, '-U', 'postgres', '--auth=scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--no-locale', '--no-instructions'])
  } finally { writeFileSync(passwordFile, '') }
  // Do not give the daemon inherited output pipes: on Windows they keep a
  // synchronous parent waiting even after pg_ctl has successfully returned.
  command(resolve(bin, 'pg_ctl.exe'), ['-D', data, '-l', resolve(base, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -c shared_buffers=64MB -c max_connections=30`, '-w', 'start'], { stdio: 'ignore' })
  const setup = new Client({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres' })
  try {
    await setup.connect()
    const actual = (await setup.query("SELECT current_setting('data_directory') AS path")).rows[0].path
    if (resolve(actual) !== data) throw new Error('Refusing an unexpected database cluster')
    await setup.query('CREATE DATABASE rwa_lat_codex_20260928_test')
  } finally { await setup.end() }
  console.log(JSON.stringify({ database, version: 17, newPrivateCluster: true, host: 'loopback', authentication: 'scram-sha-256', existingDatabasesAndRolesUntouched: true }))
  const connectionString = `postgres://postgres:${password}@127.0.0.1:${port}/${database}`
  const env = { ...process.env, APP_ENV: 'test', NODE_ENV: 'test', TEST_DATABASE_URL: connectionString,
    ADMIN_DATABASE_URL: connectionString, RUN_AUTH_ROLLBACK: '1',
    AUTH_ADAPTER: 'demo', IDENTITY_HMAC_KEY: randomBytes(32).toString('hex'), IDENTITY_ENC_KEY: randomBytes(32).toString('hex'),
    KYC_PROVIDER: 'stub', SANCTIONS_PROVIDER: 'stub', WALLET_CUSTODY_ADAPTER: 'stub',
    PUBLIC_APP_URL: 'http://localhost:3033', PASSKEY_RP_ID: 'localhost', PASSKEY_ORIGIN: 'http://localhost:3033',
    TEST_DATABASE_HEAP_MB: '1024', PG_SSL: 'false', RECURRING_INVESTMENT_WORKER_ENABLED: 'false',
    NOTIFICATION_DELIVERY_WORKER_ENABLED: 'false', DOCUMENT_GENERATION_WORKER_ENABLED: 'false' }
  const onlyAdmin=process.argv[2]==='--admin-only'
  const onlyQuotes=process.argv[2]==='--quote-only'
  if(process.argv[2]!=='--extra-only'&&!onlyAdmin&&!onlyQuotes)run(resolve(root, 'apps/api'), ['scripts/test-database-low-memory.mjs', ...process.argv.slice(2)], env)
  else run(resolve(root,'apps/api'),['node_modules/typeorm/cli-ts-node-commonjs.js','migration:run','-d','src/database/data-source.ts'],env)
  if(onlyQuotes)run(resolve(root,'apps/api'),['--max-old-space-size=1024','node_modules/jest/bin/jest.js','--runInBand','--testTimeout=120000','--runTestsByPath','test/catalog/automatic-quote.integration.spec.ts','test/catalog/catalog.integration.spec.ts'],env)
  if(!onlyAdmin&&!onlyQuotes)run(resolve(root, 'apps/api'), ['--max-old-space-size=1024', 'node_modules/jest/bin/jest.js', '--runInBand', '--testTimeout=120000', '--runTestsByPath',
    'test/identity/password-auth.rollback.spec.ts', 'test/prediction/prediction.integration.spec.ts',
    'test/ai/ai-knowledge.integration.spec.ts', 'test/ai/ai-execution.integration.spec.ts',
    'test/community/community-member.integration.spec.ts'], env)
  if(!onlyAdmin)run(resolve(root, 'apps/api'), ['scripts/verify-migration-rehearsal.mjs'], env)
  const adminEnv={...env}
  // The admin fixture supplies its isolated DataSource explicitly; preserve its
  // safety guard against any application URL matching the destructive target.
  for(const key of ['ADMIN_DATABASE_URL','CORE_DATABASE_URL','DATABASE_URL'])delete adminEnv[key]
  run(resolve(root, 'apps/admin'), ['--max-old-space-size=1024', 'node_modules/jest/bin/jest.js', '--runInBand', '--testTimeout=120000'], adminEnv)
  run(root, ['scripts/verify-admin-passwordless-isolated.cjs'], adminEnv)
  console.log(onlyAdmin?'Admin isolated database queue passed.':'API supplemental and admin isolated database queues passed.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (existsSync(resolve(data, 'postmaster.pid'))) {
    try { command(resolve(bin, 'pg_ctl.exe'), ['-D', data, '-w', '-m', 'fast', 'stop']); console.log('Owned temporary PostgreSQL instance stopped.') }
    catch { console.error(`Cleanup needs attention: ${base}`); process.exitCode = 1 }
  }
}
