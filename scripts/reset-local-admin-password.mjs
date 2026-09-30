import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID, randomBytes, scryptSync } from 'node:crypto'
const root=resolve(import.meta.dirname,'..'), require=createRequire(resolve(root,'apps/api/package.json'))
const {parse}=require('dotenv'), {Client}=require('pg')
const {hashAdminPassword}=require(resolve(root,'apps/admin/dist/admin-auth.service.js'))
// This local recovery helper is invoked only by the user's secure prompt wrapper.
// No credential is accepted in command arguments, environment variables or files.
const temporaryLocal=process.argv.includes('--local-temporary')
if(process.stdin.isTTY){
  if(!temporaryLocal||!process.stdin.setRawMode)throw new Error('Use the secure PowerShell prompt wrapper')
  process.stdin.setRawMode(true)
  console.log('Local recovery ready for confidential input. Input echo disabled.')
}
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>16000)throw new Error('Input too large');const end=input.search(/[\r\n]/);if(end>=0){input=input.slice(0,end);break}}
const payload=JSON.parse(input);input=''
if(typeof payload.password!=='string'||payload.password.length<(temporaryLocal?8:12)||payload.password.length>512)throw new Error('Password length is not allowed')
const config=parse(readFileSync(resolve(root,'apps/admin/.env')))
const url=new URL(config.ADMIN_DATABASE_URL??config.DATABASE_URL)
if(config.APP_ENV && config.APP_ENV!=='development')throw new Error('Only local development recovery is allowed')
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/rwa_lat_dev')throw new Error('Only local rwa_lat_dev may be changed')
const salt=randomBytes(16)
const hash=temporaryLocal&&payload.password.length<12?`scrypt$${salt.toString('hex')}$${scryptSync(payload.password,salt,64).toString('hex')}`:hashAdminPassword(payload.password);payload.password=''
const db=new Client({connectionString:url.toString()});await db.connect()
try{
  await db.query('BEGIN')
  const email=typeof payload.email==='string'?payload.email.trim().toLowerCase():''
  const {rows}=await db.query(`SELECT id,mfa_state FROM app.admin_users WHERE disabled_at IS NULL ${email?'AND lower(email)=$1':''} FOR UPDATE`,email?[email]:[])
  if(rows.length!==1)throw new Error('Specify an email matching exactly one enabled local administrator')
  const admin=rows[0]
  await db.query('UPDATE app.admin_users SET password_hash=$2,failed_login_count=0,locked_until=NULL WHERE id=$1',[admin.id,hash])
  await db.query('UPDATE app.admin_sessions SET revoked_at=now() WHERE admin_user_id=$1 AND revoked_at IS NULL',[admin.id])
  await db.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
    VALUES($1,'admin',$2::uuid,'admin.local_password_recovered','admin_user',$2::text,$3,$4::jsonb)`,[randomUUID(),admin.id,randomUUID(),JSON.stringify({localOnly:true,mfaPreserved:true,sessionsRevoked:true,temporaryLocal})])
  await db.query('COMMIT')
  console.log('Local administrator password updated. MFA and permissions preserved; previous sessions revoked. No password printed or stored in a file.')
}catch{await db.query('ROLLBACK');throw new Error('Local recovery failed; database transaction rolled back. No credentials printed.')}
finally{await db.end()}
