/* Only read the configured development DB. Tests always use a brand-new local database. */
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { spawnSync,execFileSync } = require('node:child_process')
const os = require('node:os')
const net = require('node:net')
const { Client } = require('pg')
require('dotenv').config({ path: path.join(__dirname,'../.env'),quiet:true })
const out=path.join(__dirname,'../tools/referral-stage0-evidence')
fs.mkdirSync(out,{recursive:true})

async function inspect() {
  const client=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000})
  try {
    await client.connect(); await client.query('BEGIN READ ONLY')
    const {rows:database}=await client.query('SELECT current_database() AS database')
    const {rows:constraints}=await client.query(`SELECT c.relname AS table_name,con.conname,pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='app' AND c.relname IN ('rewards','ledger_accounts','ledger_transactions') ORDER BY c.relname,con.conname`)
    const {rows:migrations}=await client.query('SELECT name FROM public.schema_migrations ORDER BY id')
    const {rows:counts}=await client.query(`SELECT (SELECT count(*) FROM app.rewards)::text AS rewards,
      (SELECT count(*) FROM app.invitations)::text AS invitations,(SELECT count(*) FROM app.ledger_entries)::text AS ledger_entries,
      (SELECT md5(coalesce(string_agg(account_id::text||':'||current_atomic_balance::text,',' ORDER BY account_id),'')) FROM app.ledger_account_balances) AS balance_digest`)
    await client.query('ROLLBACK')
    const result={database:database[0].database,constraints,migrations,counts:counts[0]}
    const file=path.join(out,'development-schema-readonly.json'),before=path.join(out,'development-schema-before.json')
    if(fs.existsSync(file)&&!fs.existsSync(before))fs.copyFileSync(file,before)
    fs.writeFileSync(file,JSON.stringify(result,null,2))
    if(fs.existsSync(before)) {
      const old=JSON.parse(fs.readFileSync(before,'utf8'))
      fs.writeFileSync(path.join(out,'development-unchanged.json'),JSON.stringify({database:result.database,
        unchanged:JSON.stringify(old.counts)===JSON.stringify(result.counts),before:old.counts,after:result.counts},null,2))
    }
    console.log(JSON.stringify({mode:'read-only',database:result.database,counts:result.counts,evidence:'development-schema-readonly.json'}))
  } finally {await client.end()}
}
async function test(connection = process.env.DATABASE_URL) {
  const raw=connection
  if(!raw) throw new Error('Development connection unavailable')
  const url=new URL(raw)
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('Isolated rehearsal requires a local PostgreSQL server')
  const name='rwa_referral_stage0_'+crypto.randomBytes(6).toString('hex')+'_test'
  if(!/^rwa_referral_stage0_[a-f0-9]{12}_test$/.test(name)) throw new Error('Unsafe test database name')
  const admin=new Client({connectionString:raw,connectionTimeoutMillis:5000})
  let created=false
  try {
    await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`);created=true
    const testUrl=new URL(raw);testUrl.pathname='/'+name
    const env={...process.env,NODE_ENV:'test',APP_ENV:'test',TEST_DATABASE_URL:testUrl.toString(),REFERRAL_ISOLATED_DATABASE:name}
    const foundationOnly=process.argv.includes('--foundation-only')
    const tests=['test/referral/referral-stage0.spec.ts','test/referral/referral-stage0.integration.spec.ts']
    if(!foundationOnly)tests.push('test/identity/identity.service.spec.ts','test/identity/email-code.integration.spec.ts','test/identity/oauth-provider.spec.ts')
    const result=spawnSync(process.execPath,[path.join(__dirname,'../node_modules/jest/bin/jest.js'),'--runInBand',...tests,
      ...(process.argv.includes('--low-memory')?['--globals',JSON.stringify({'ts-jest':{isolatedModules:true}})]:[]),
      '--json','--outputFile',path.join(out,foundationOnly?'jest-foundation-results.json':'jest-results.json')],{cwd:path.join(__dirname,'..'),env,stdio:'inherit',windowsHide:true})
    if(result.status!==0) process.exitCode=result.status||1
    fs.writeFileSync(path.join(out,'isolated-rehearsal.json'),JSON.stringify({database:name,createdByThisRun:true,exitCode:result.status},null,2))
    const reconciliation=spawnSync(process.execPath,['-r','ts-node/register/transpile-only','tools/referral-reconcile.ts'],
      {cwd:path.join(__dirname,'..'),env,encoding:'utf8',windowsHide:true})
    fs.writeFileSync(path.join(out,'reconciliation-cli.json'),JSON.stringify({exitCode:reconciliation.status,output:reconciliation.stdout?.trim()},null,2))
    if(reconciliation.status!==0)process.exitCode=1
  } finally {
    // Never enumerate or reuse databases. Only the exact random DB created by this run is removable.
    if(created){await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`,[name]);await admin.query(`DROP DATABASE "${name}"`)}
    await admin.end()
  }
}
async function localTest() {
  const bin=process.env.REFERRAL_POSTGRES_BIN || 'C:/Program Files/PostgreSQL/17/bin'
  if(!fs.existsSync(path.join(bin,'initdb.exe')))throw new Error('PostgreSQL binaries unavailable')
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rwa-referral-stage0-'))
  const data=path.join(root,'data'),log=path.join(root,'postgres.log')
  const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})})
  const command=(name,args)=>execFileSync(path.join(bin,name+'.exe'),args,{windowsHide:true,stdio:'ignore',timeout:60000})
  let started=false
  try {
    command('initdb',['-D',data,'-A','trust','-U','referral_test','--encoding=UTF8','--locale=C'])
    started=true
    command('pg_ctl',['-D',data,'-l',log,'-o',`-h 127.0.0.1 -p ${port}`,'-w','start'])
    fs.writeFileSync(path.join(out,'isolated-server.json'),JSON.stringify({independentCluster:true,host:'127.0.0.1',port,directory:root,existingServiceModified:false},null,2))
    await test(`postgresql://referral_test@127.0.0.1:${port}/postgres`)
  } finally {
    if(started && fs.existsSync(path.join(data,'postmaster.pid')))command('pg_ctl',['-D',data,'-m','fast','-w','stop'])
    const evidence=path.join(out,'isolated-server.json')
    if(fs.existsSync(evidence)){const state=JSON.parse(fs.readFileSync(evidence,'utf8'));state.stopped=true;fs.writeFileSync(evidence,JSON.stringify(state,null,2))}
  }
}
const mode=process.argv[2]||'inspect'
Promise.resolve(mode==='inspect'?inspect():mode==='test'?test():mode==='test-local'?localTest():Promise.reject(new Error('Use inspect, test or test-local')))
  .catch(error=>{console.error(JSON.stringify({error:error.code||'REFERRAL_REHEARSAL_FAILED'}));process.exitCode=1})
