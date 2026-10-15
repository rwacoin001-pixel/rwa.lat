import { randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, relative } from 'node:path'
import net from 'node:net'

// Fresh loopback-only cluster. Never resets, connects to, or reuses an application DB.
const root = resolve(import.meta.dirname, '..')
const bin = process.env.TEST_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/17/bin'
const base = resolve(root, 'tmp', `prediction-pg-${randomUUID()}`)
const data = resolve(base, 'data')
if (!relative(resolve(root, 'tmp'), base).startsWith('prediction-pg-')) throw new Error('Invalid isolated path')
const password = randomBytes(32).toString('hex')
const passwordFile = resolve(base, 'bootstrap-password')
const require = createRequire(resolve(root, 'apps/api/package.json'))
const { Client } = require('pg')
const socket = net.createServer()
await new Promise((ok, fail) => { socket.once('error', fail); socket.listen(0, '127.0.0.1', ok) })
const port = socket.address().port
await new Promise(ok => socket.close(ok))
if (port === 5432) throw new Error('Refusing application database port')
function command(exe, args, options = {}) {
  const result = spawnSync(exe, args, { encoding:'utf8', windowsHide:true, timeout:120_000, ...options })
  if (result.error || result.status !== 0) throw new Error(`Isolated setup failed: ${exe.split(/[\\/]/).pop()} (credentials omitted)`)
  return result.stdout
}
const env = { ...process.env }
for (const key of ['DATABASE_URL','PRODUCTION_DATABASE_URL','STAGING_DATABASE_URL','DEMO_DATABASE_URL','ADMIN_DATABASE_URL','CORE_DATABASE_URL']) delete env[key]
Object.assign(env, { APP_ENV:'test', NODE_ENV:'test', PG_SSL:'false',
  TEST_DATABASE_URL:`postgres://postgres:${password}@127.0.0.1:${port}/prediction_settlement_test`,
  PREDICTION_FEE_BPS_PLACE:'300', PREDICTION_FEE_BPS_PAYOUT:'300',
  IDENTITY_HMAC_KEY:randomBytes(32).toString('hex'), IDENTITY_ENC_KEY:randomBytes(32).toString('hex'),
  NOTIFICATION_DELIVERY_WORKER_ENABLED:'false', PREDICTION_SETTLEMENT_WORKER_ENABLED:'false',
})
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd:resolve(root,'apps/api'), env, stdio:'inherit', windowsHide:true,
  })
  if (result.error || result.status !== 0) throw new Error('Isolated verification failed; inspect preceding output')
}
try {
  mkdirSync(base,{recursive:true})
  const sid = command('whoami.exe',['/user','/fo','csv','/nh']).match(/S-1-[\d-]+/)?.[0]
  if (!sid) throw new Error('Could not identify isolated cluster owner')
  command('icacls.exe',[base,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`])
  writeFileSync(passwordFile,password+'\n',{flag:'wx'})
  try {
    command(resolve(bin,'initdb.exe'),['-D',data,'-U','postgres','--auth=scram-sha-256',`--pwfile=${passwordFile}`,'--encoding=UTF8','--no-locale','--no-instructions'])
  } finally { writeFileSync(passwordFile,'') }
  command(resolve(bin,'pg_ctl.exe'),['-D',data,'-l',resolve(base,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -c shared_buffers=64MB -c max_connections=30`,'-w','start'],{stdio:'ignore'})
  const setup = new Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres'})
  try {
    await setup.connect()
    if(resolve((await setup.query("SELECT current_setting('data_directory') AS path")).rows[0].path)!==data) throw new Error('Unexpected cluster')
    await setup.query('CREATE DATABASE prediction_settlement_test')
  } finally { await setup.end() }
  console.log('New private PostgreSQL cluster: prediction_settlement_test; existing databases untouched.')
  run(['node_modules/typeorm/cli-ts-node-commonjs.js','migration:run','-d','src/database/data-source.ts'])
  run(['--max-old-space-size=1024','node_modules/jest/bin/jest.js','--runInBand','--no-cache','--runTestsByPath',
    'test/prediction/prediction-resolution.integration.spec.ts','test/prediction/prediction.integration.spec.ts',
    'test/prediction/prediction-resolution.spec.ts','test/polymarket/polymarket-public.adapter.spec.ts',
    'test/polymarket/polymarket.service.spec.ts','test/prediction/prediction-quote.spec.ts',
    'test/prediction/prediction-limits.spec.ts',
  ])
  console.log('Prediction settlement isolated verification passed.')
} catch(error) {
  console.error(error.message)
  process.exitCode=1
} finally {
  if(existsSync(resolve(data,'postmaster.pid'))) {
    try { command(resolve(bin,'pg_ctl.exe'),['-D',data,'-w','-m','fast','stop']); console.log('Owned temporary PostgreSQL stopped.') }
    catch { console.error(`Cleanup needs attention: ${base}`); process.exitCode=1 }
  }
}
