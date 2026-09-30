import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {createDecipheriv} from 'node:crypto'
const root=resolve(import.meta.dirname,'..')
const require=createRequire(resolve(root,'apps/api/package.json'))
const {parse}=require('dotenv'), {Client}=require('pg')
const config=parse(readFileSync(resolve(root,'apps/admin/.env')))
const url=new URL(config.ADMIN_DATABASE_URL ?? config.DATABASE_URL)
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/rwa_lat_dev') throw new Error('Only local rwa_lat_dev may be inspected')
const db=new Client({connectionString:url.toString()});await db.connect()
try {
  const {rows:counts}=await db.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE disabled_at IS NULL)::int AS enabled,
    count(*) FILTER(WHERE password_hash LIKE 'scrypt$%')::int AS credentials_configured,
    count(*) FILTER(WHERE locked_until>now())::int AS temporarily_locked FROM app.admin_users`)
  const {rows:attempts}=await db.query(`SELECT a.action,a.occurred_at, a.actor_id IS NOT NULL AS recognized_account,
    u.disabled_at IS NOT NULL AS disabled,u.locked_until>now() AS locked,
    u.password_hash LIKE 'scrypt$%' AS credentials_configured,
    u.password_hash ~ '^scrypt[$][0-9a-f]{32}[$][0-9a-f]{128}$' AS credential_encoding_valid,u.failed_login_count,u.mfa_state
    FROM app.audit_logs a LEFT JOIN app.admin_users u ON a.actor_id=u.id
    WHERE a.action IN ('admin.session.login_failed','admin.session.mfa_required','admin.session.login_succeeded')
    ORDER BY a.occurred_at DESC LIMIT 4`)
  console.log(JSON.stringify({database:url.pathname.slice(1),administrators:counts[0],recentAttempts:attempts},null,2))
  if(process.argv[2]==='--recovery-check') {
    const id='00000000-0000-4000-8000-000000000001'
    await db.query(`EXPLAIN UPDATE app.admin_users SET password_hash=$2,failed_login_count=0,locked_until=NULL WHERE id=$1`,[id,'syntax-check-only'])
    await db.query(`EXPLAIN UPDATE app.admin_sessions SET revoked_at=now() WHERE admin_user_id=$1 AND revoked_at IS NULL`,[id])
    await db.query(`EXPLAIN INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
      VALUES($1,'admin',$2::uuid,'admin.local_password_recovered','admin_user',$2::text,$3,$4::jsonb)`,[id,id,id,'{}'])
    console.log('Recovery SQL preflight passed. EXPLAIN only; no database rows changed.')
  }
  if(process.argv[2]==='--mfa-check') {
    const {rows}=await db.query('SELECT mfa_state,mfa_secret_ciphertext FROM app.admin_users WHERE disabled_at IS NULL')
    if(rows.length!==1)throw new Error('Exactly one local administrator required for this check')
    const report={state:rows[0].mfa_state,keyConfigured:false,keyVersionAvailable:false,ciphertextAuthenticated:false,secretEncodingValid:false}
    try{
      const mfaConfig=Object.fromEntries(['ADMIN_MFA_KEYS_JSON','ADMIN_MFA_ACTIVE_KEY_VERSION','ADMIN_MFA_ENCRYPTION_KEY'].map(key=>[key,process.env[key]??config[key]]))
      const parsed=mfaConfig.ADMIN_MFA_KEYS_JSON?JSON.parse(mfaConfig.ADMIN_MFA_KEYS_JSON):{'1':mfaConfig.ADMIN_MFA_ENCRYPTION_KEY}
      const active=mfaConfig.ADMIN_MFA_KEYS_JSON?Number(mfaConfig.ADMIN_MFA_ACTIVE_KEY_VERSION):1
      const keys=new Map(Object.entries(parsed).map(([v,key])=>[Number(v),Buffer.from(String(key),'base64')]))
      report.keyConfigured=keys.size>0&&[...keys.values()].every(k=>k.length===32)
      const parts=String(rows[0].mfa_secret_ciphertext??'').split('.'),versioned=parts[0]==='v2'
      const [iv,tag,data]=versioned?parts.slice(2):parts.slice(1)
      const versions=versioned?[Number(parts[1])]:[active,...[...keys.keys()].filter(v=>v!==active)]
      report.keyVersionAvailable=versions.some(v=>keys.has(v))
      for(const version of versions){
        try{const decipher=createDecipheriv('aes-256-gcm',keys.get(version),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'))
          const plain=Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]);report.ciphertextAuthenticated=true;report.secretEncodingValid=/^[A-Z2-7]+$/.test(plain.toString('utf8'));plain.fill(0);break
        }catch{/* Report only success flags, never key, ciphertext or plaintext. */}
      }
    }catch{/* Do not serialize sensitive configuration errors. */}
    console.log(JSON.stringify({mfa:report}))
    const candidates=[['API local configuration',parse(readFileSync(resolve(root,'apps/api/.env')))],['root local configuration',existsSync(resolve(root,'.env.local'))?parse(readFileSync(resolve(root,'.env.local'))):{}],['inherited environment',process.env]]
    for(const [source,candidate] of candidates){
      let matches=false,keyPresent=false
      try{
        const parsed=candidate.ADMIN_MFA_KEYS_JSON?JSON.parse(candidate.ADMIN_MFA_KEYS_JSON):{'1':candidate.ADMIN_MFA_ENCRYPTION_KEY}
        const active=candidate.ADMIN_MFA_KEYS_JSON?Number(candidate.ADMIN_MFA_ACTIVE_KEY_VERSION):1
        const keys=new Map(Object.entries(parsed).map(([v,key])=>[Number(v),Buffer.from(String(key),'base64')]))
        keyPresent=[...keys.values()].some(key=>key.length===32)
        const parts=String(rows[0].mfa_secret_ciphertext??'').split('.'),versioned=parts[0]==='v2'
        const [iv,tag,data]=versioned?parts.slice(2):parts.slice(1)
        for(const version of versioned?[Number(parts[1])]:[active,...keys.keys()]){
          try{const decipher=createDecipheriv('aes-256-gcm',keys.get(version),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));const plain=Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]);matches=/^[A-Z2-7]+$/.test(plain.toString());plain.fill(0);if(matches)break}catch{}
        }
      }catch{}
      console.log(JSON.stringify({source,keyPresent,authenticatesExistingMfa:matches}))
    }
  }
}finally{await db.end()}
