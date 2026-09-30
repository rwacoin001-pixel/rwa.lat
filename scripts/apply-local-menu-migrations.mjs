import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, 'apps/api/package.json'))
const { parse } = require('dotenv')
const { DataSource, MigrationExecutor } = require('typeorm')
const buildFolder=process.env.LOCAL_OPS_ISOLATED_BUILD==='true'?'.local-runtime':'dist'
const { buildDatabaseOptions } = require(resolve(root, `apps/api/${buildFolder}/database/database-options.js`))
const config = parse(readFileSync(resolve(root, 'apps/api/.env')))
const expected = new Set(['CommunityMemberWrites1790000000016', 'AiPlanning1790000000017', 'AccountClosure1790000000018', 'GeneratedDocuments1790000000019', 'PublicResourceShares1790000000020'])
const mode = process.argv[2]
if (!['--check', '--apply'].includes(mode)) throw new Error('Use --check or --apply')
const url = new URL(config.DATABASE_URL)
if (config.APP_ENV !== 'development' || !['postgres:', 'postgresql:'].includes(url.protocol)
  || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  || decodeURIComponent(url.pathname.slice(1)) !== 'rwa_lat_dev') throw new Error('Only local development rwa_lat_dev is allowed')
const db = new DataSource(buildDatabaseOptions({ ...config, NODE_ENV: 'development', APP_ENV: 'development' }))
try {
  await db.initialize()
  const [connected] = await db.query('SELECT current_database() AS name')
  if (connected.name !== 'rwa_lat_dev') throw new Error('Connected database mismatch')
  const pending = await new MigrationExecutor(db).getPendingMigrations()
  if (pending.some(item => !expected.has(item.name))) throw new Error('Unexpected pending migration; refusing automatic application')
  const [duplicates] = await db.query('SELECT count(*)::int AS count FROM (SELECT user_id FROM app.community_profiles WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1) d')
  if (duplicates.count !== 0) throw new Error('Duplicate community identities require manual review')
  console.log(JSON.stringify({ database: connected.name, pending: pending.map(item => item.name), duplicateProfiles: duplicates.count, mode }))
  if (mode === '--apply' && pending.length) {
    const applied = await db.runMigrations({ transaction: 'all' })
    console.log(JSON.stringify({ applied: applied.map(item => item.name), remaining: (await new MigrationExecutor(db).getPendingMigrations()).length }))
  }
} catch (error) {
  // Connection/configuration errors may contain credentials; never print raw errors.
  console.error(JSON.stringify({ failed: true, code: typeof error?.code === 'string' ? error.code : 'LOCAL_MIGRATION_CHECK_FAILED' }))
  process.exitCode = 1
} finally {
  if (db.isInitialized) await db.destroy()
}
