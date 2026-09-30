import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(resolve(root, 'apps/api/package.json'))
const { parse } = require('dotenv')
const { DataSource, MigrationExecutor } = require('typeorm')
const { buildDatabaseOptions } = require(resolve(root, 'apps/api/.local-runtime/database/database-options.js'))
const config = parse(readFileSync(resolve(root, 'apps/api/.env')))
const target = new URL(config.DATABASE_URL)
const mode = process.argv[2]
if (!['--check','--apply'].includes(mode)) throw new Error('Use --check or --apply')
if (config.APP_ENV !== 'development' || !['localhost','127.0.0.1','[::1]'].includes(target.hostname)
  || target.pathname !== '/rwa_lat_dev') throw new Error('Only local rwa_lat_dev is allowed')
const db = new DataSource(buildDatabaseOptions({ ...config, APP_ENV: 'development', NODE_ENV: 'development' }))
try {
  await db.initialize()
  const [connected] = await db.query('SELECT current_database() AS name')
  if (connected.name !== 'rwa_lat_dev') throw new Error('Connected database mismatch')
  const pending = await new MigrationExecutor(db).getPendingMigrations()
  if (pending.some(row => row.name !== 'EmailCodeChallenges1790000000021')) throw new Error('Unexpected pending migrations; refusing application')
  console.log(JSON.stringify({ database: connected.name, mode, pending: pending.map(row => row.name) }))
  if (mode === '--apply' && pending.length) {
    const applied = await db.runMigrations({ transaction: 'all' })
    console.log(JSON.stringify({ applied: applied.map(row => row.name) }))
  }
} catch {
  console.error('Local email code migration check failed. No credentials printed.')
  process.exitCode = 1
} finally { if (db.isInitialized) await db.destroy() }
