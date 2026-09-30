import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root=resolve(import.meta.dirname,'..')
const require=createRequire(resolve(root,'apps/api/package.json'))
const {parse}=require('dotenv'),{DataSource,MigrationExecutor}=require('typeorm')
const {buildDatabaseOptions}=require(resolve(root,'apps/api/.local-runtime/database/database-options.js'))
const config=parse(readFileSync(resolve(root,'apps/api/.env'))),target=new URL(config.DATABASE_URL)
const mode=process.argv[2]
if(!['--check','--apply'].includes(mode))throw new Error('Use --check or --apply')
if(config.APP_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/rwa_lat_dev')throw new Error('Only local rwa_lat_dev is allowed')
const db=new DataSource(buildDatabaseOptions({...config,NODE_ENV:'development',APP_ENV:'development'}))
try {
  await db.initialize()
  const [connected]=await db.query('SELECT current_database() AS name')
  if(connected.name!=='rwa_lat_dev')throw new Error('Connected database mismatch')
  const pending=await new MigrationExecutor(db).getPendingMigrations()
  if(pending.some(row=>row.name!=='LegalPublications1790000000022'))throw new Error('Unexpected pending migrations')
  console.log(JSON.stringify({database:connected.name,mode,pending:pending.map(row=>row.name)}))
  if(mode==='--apply'&&pending.length)console.log(JSON.stringify({applied:(await db.runMigrations({transaction:'all'})).map(row=>row.name)}))
} catch(error) { console.error(JSON.stringify({failed:true,code:typeof error?.code==='string'?error.code:'LOCAL_LEGAL_MIGRATION_CHECK_FAILED'}));process.exitCode=1 }
finally {if(db.isInitialized)await db.destroy()}
