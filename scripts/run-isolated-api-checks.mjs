import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(resolve(root,'apps/api/package.json'))
const {parse}=require('dotenv'),{Client}=require('pg')
const config=parse(readFileSync(resolve(root,'apps/api/.env')))
const url=new URL(config.DATABASE_URL)
if(config.APP_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/rwa_lat_dev')throw new Error('Only local development configuration is allowed')
const mode=process.argv[2]
if(!['--database','--unit','--targeted-rollback'].includes(mode))throw new Error('Use --database, --unit or --targeted-rollback')
if(mode==='--unit'){
  const child=spawn(process.execPath,['scripts/test-unit-low-memory.mjs'],{cwd:resolve(root,'apps/api'),env:{...process.env,APP_ENV:'test',NODE_ENV:'test',TEST_DATABASE_URL:'',TEST_UNIT_HEAP_MB:process.env.TEST_UNIT_HEAP_MB??'1536'},stdio:'inherit',windowsHide:true})
  child.on('exit',code=>{process.exitCode=code??1})
  child.on('error',()=>{console.error('Could not start unit checks.');process.exitCode=1})
  await new Promise(resolve=>child.on('close',resolve))
  process.exit(process.exitCode??0)
}
if(mode==='--targeted-rollback'){
  const target=new URL(config.TEST_DATABASE_URL??'')
  if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/rwa_lat_test')throw new Error('Only the verified local test target is allowed')
  // These allowlisted suites keep fixtures and optional schema preparation inside
  // a rolled-back transaction. Never invoke the database-reset queue here.
  const suites=['test/generated-documents/generated-documents.integration.spec.ts','test/orders/manual-settlement.integration.spec.ts','test/sharing/public-share.integration.spec.ts']
  console.log(JSON.stringify({mode,database:'rwa_lat_test',reset:false,fixtures:'transaction rollback',suites}))
  for(const suite of suites){
    const child=spawn(process.execPath,['--max-old-space-size=1024','node_modules/jest/bin/jest.js','--runInBand',suite],{cwd:resolve(root,'apps/api'),env:{...process.env,APP_ENV:'test',NODE_ENV:'test',TEST_DATABASE_URL:target.toString()},stdio:'inherit',windowsHide:true})
    const code=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('exit',code=>resolve(code??1))})
    if(code!==0)process.exit(code)
  }
  process.exit(0)
}
const name='rwa_lat_codex_20260927_test'
const setup=new Client({connectionString:config.DATABASE_URL})
try{
  await setup.connect()
  if(!(await setup.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rows.length)await setup.query('CREATE DATABASE rwa_lat_codex_20260927_test')
}catch(error){console.error(JSON.stringify({failed:true,code:error?.code??'LOCAL_TEST_DATABASE_SETUP_FAILED',message:'Could not prepare dedicated local verification database. No credentials printed.'}));process.exitCode=1}
finally{await setup.end()}
if(process.exitCode)process.exit(process.exitCode)
url.pathname='/'+name
console.log(JSON.stringify({mode,database:name,developmentDatabaseUntouched:true,sharedTestDatabaseUntouched:true}))
const env={...process.env,...config,APP_ENV:'test',NODE_ENV:'test',TEST_DATABASE_URL:url.toString(),TEST_UNIT_HEAP_MB:'1536',TEST_DATABASE_HEAP_MB:'1024'}
const script=mode==='--database'?'scripts/test-database-low-memory.mjs':'scripts/test-unit-low-memory.mjs'
const child=spawn(process.execPath,[script],{cwd:resolve(root,'apps/api'),env,stdio:'inherit',windowsHide:true})
child.on('exit',code=>{process.exitCode=code??1})
child.on('error',()=>{console.error('Could not start isolated checks.');process.exitCode=1})
