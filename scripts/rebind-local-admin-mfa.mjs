import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createDecipheriv, randomBytes, randomUUID, scryptSync, timingSafeEqual} from 'node:crypto'
import {createServer} from 'node:http'

const root=resolve(import.meta.dirname,'..')
const require=createRequire(resolve(root,'apps/api/package.json'))
const {parse}=require('dotenv'),{Client}=require('pg')
const {encryptAdminMfaSecret,createAdminTotp}=require(resolve(root,'apps/admin/dist/admin-auth.service.js'))
const config=parse(readFileSync(resolve(root,'apps/admin/.env')))
const url=new URL(config.ADMIN_DATABASE_URL??config.DATABASE_URL)
if(config.APP_ENV && config.APP_ENV!=='development')throw new Error('Only local development recovery is allowed')
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/rwa_lat_dev')throw new Error('Only local rwa_lat_dev may be changed')
const encoded=process.env.ADMIN_MFA_KEYS_JSON
const version=encoded?Number(process.env.ADMIN_MFA_ACTIVE_KEY_VERSION):1
const keyText=encoded?JSON.parse(encoded)[String(version)]:process.env.ADMIN_MFA_ENCRYPTION_KEY
if(!Number.isSafeInteger(version)||version<1||typeof keyText!=='string'||Buffer.from(keyText,'base64').length!==32)throw new Error('Protected MFA configuration is required')

function qrMarkup(secret){
  const uiRequire=createRequire(resolve(root,'package.json'))
  const {createElement}=uiRequire('react'),{renderToStaticMarkup}=uiRequire('react-dom/server'),{QRCodeSVG}=uiRequire('qrcode.react')
  const uri=`otpauth://totp/${encodeURIComponent('rwa.lat 本地后台:管理员')}?secret=${secret}&issuer=${encodeURIComponent('rwa.lat 本地后台')}&algorithm=SHA1&digits=6&period=30`
  return renderToStaticMarkup(createElement(QRCodeSVG,{value:uri,size:300,level:'M',marginSize:4,title:'本地管理员 MFA 绑定二维码'}))
}
async function startQrPage(){
  const state={markup:'',completed:false,failed:false}
  const server=createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store, max-age=0')
    response.setHeader('Referrer-Policy','no-referrer')
    response.setHeader('X-Content-Type-Options','nosniff')
    response.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    if(request.method!=='GET'||request.headers.host!=='127.0.0.1:3111'||request.headers['sec-fetch-site']==='cross-site'){
      response.writeHead(403);response.end('Forbidden');return
    }
    if(request.url==='/health'){
      response.setHeader('Content-Type','application/json');response.end(JSON.stringify({ready:!!state.markup,completed:state.completed,failed:state.failed}));return
    }
    if(request.url!=='/'){response.writeHead(404);response.end();return}
    const message=state.completed?'绑定完成，请关闭此页面。':state.failed?'绑定未完成，请查看本机窗口。':state.markup?'用手机验证器扫描二维码，再回到本机窗口输入新验证码。':'请先在本机绑定窗口输入当前密码，此页面将自动显示二维码。'
    response.setHeader('Content-Type','text/html; charset=utf-8')
    response.end(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${state.completed||state.failed?'':'<meta http-equiv="refresh" content="2">'}<title>本地后台 MFA 绑定</title><style>body{font-family:system-ui;margin:0;background:#11151b;color:#eef0f4;display:grid;place-items:center;min-height:100vh}main{text-align:center;max-width:560px;padding:32px}h1{font-size:24px}.qr{display:inline-block;background:#fff;padding:12px;border-radius:16px;margin:20px 0}.note{font-size:14px;color:#b8c0cb;line-height:1.7}</style></head><body><main><h1>rwa.lat 本地后台 · 动态验证</h1><p>${message}</p>${state.markup?`<div class="qr">${state.markup}</div>`:''}<p class="note">此二维码仅用于本地管理员绑定，请勿转发或截图到聊天。<br>密码和权限保留。新验证码通过后，原绑定失效。</p></main></body></html>`)
  })
  await new Promise((resolveReady,reject)=>{server.once('error',reject);server.listen(3111,'127.0.0.1',resolveReady)})
  return {state,server}
}

function generateSecret(){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let value=0,bits=0,result=''
  for(const byte of randomBytes(20)){
    value=(value<<8)|byte;bits+=8
    while(bits>=5){bits-=5;result+=alphabet[(value>>>bits)&31]}
  }
  return result
}
function validCode(secret,code,at=Date.now()){
  if(!/^\d{6}$/.test(code))return false
  return [-1,0,1].some(offset=>timingSafeEqual(Buffer.from(code),Buffer.from(createAdminTotp(secret,at+offset*30000))))
}
function validPassword(password,hash){
  if(!/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(hash??''))return false
  const [,salt,digest]=hash.split('$')
  return timingSafeEqual(scryptSync(password,Buffer.from(salt,'hex'),64),Buffer.from(digest,'hex'))
}
function privatePrompt(label,timeoutMs=300000){
  process.stdout.write(label)
  return new Promise((resolveInput,reject)=>{
    let input=''
    const timer=setTimeout(()=>finish(new Error('Input timed out')),timeoutMs)
    const finish=(error)=>{
      clearTimeout(timer);process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')
      if(error)reject(error);else resolveInput(input)
      input=''
    }
    const onData=(chunk)=>{
      for(const char of chunk.toString('utf8')){
        if(char==='\u0003'){finish(new Error('Canceled'));return}
        if(char==='\r'||char==='\n'){finish();return}
        if(char==='\b'||char==='\u007f')input=input.slice(0,-1)
        else if(char>=' '&&input.length<256)input+=char
      }
    }
    process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('data',onData)
  })
}

async function main(){
  const mode=process.argv[2]
  if(mode==='--self-test'){
    const secret=generateSecret(),ciphertext=encryptAdminMfaSecret(secret,keyText,version)
    const [,cipherVersion,iv,tag,data]=ciphertext.split('.')
    const decipher=createDecipheriv('aes-256-gcm',Buffer.from(keyText,'base64'),Buffer.from(iv,'base64url'))
    decipher.setAuthTag(Buffer.from(tag,'base64url'))
    const plain=Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()])
    const matches=plain.toString()===secret;plain.fill(0)
    const at=1700000000000
    if(!matches||Number(cipherVersion)!==version||!/^[A-Z2-7]{32}$/.test(secret)||!validCode(secret,createAdminTotp(secret,at),at)||validCode(secret,'not-a-code',at)||validCode(secret,createAdminTotp(secret,at-90000),at)||!qrMarkup(secret).startsWith('<svg'))throw new Error('Recovery self-test failed')
    console.log('Recovery cryptography and code validation self-test passed. No database changes; no secrets printed.')
    return
  }
  if(mode && mode!=='--check')throw new Error('Usage: rebind-local-admin-mfa.mjs [--check|--self-test]')
  if(!mode&&(!process.stdin.isTTY||!process.stdout.isTTY||!process.stdin.setRawMode))throw new Error('Rebinding requires an interactive local console; captured output is not permitted')
  const db=new Client({connectionString:url.toString()});await db.connect()
  let inTransaction=false
  let qrPage
  try{
    const {rows}=await db.query('SELECT id,password_hash,mfa_secret_ciphertext FROM app.admin_users WHERE disabled_at IS NULL')
    if(rows.length!==1)throw new Error('Exactly one enabled local administrator is required')
    if(mode==='--check'){
      await db.query(`EXPLAIN UPDATE app.admin_users SET mfa_state='enabled',mfa_secret_ciphertext=$2,failed_login_count=0,locked_until=NULL WHERE id=$1`,[rows[0].id,'syntax-check-only'])
      await db.query('EXPLAIN UPDATE app.admin_sessions SET revoked_at=now() WHERE admin_user_id=$1 AND revoked_at IS NULL',[rows[0].id])
      await db.query(`EXPLAIN INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata) VALUES($1,'admin',$2::uuid,'admin.local_mfa_rebound','admin_user',$2::text,$3,$4::jsonb)`,[randomUUID(),rows[0].id,randomUUID(),'{}'])
      console.log('Local MFA recovery preflight passed: local rwa_lat_dev, one enabled administrator, protected key available. EXPLAIN only; no rows changed.')
      return
    }
    const before=rows[0]
    qrPage=await startQrPage()
    console.log('RWA.LAT 本地后台：重新绑定动态验证码（只修改本地账户）')
    let password=await privatePrompt('请输入当前管理员密码（输入不回显）：')
    const passwordOk=validPassword(password,before.password_hash);password=''
    if(!passwordOk)throw new Error('Current password could not be verified')
    let secret=generateSecret()
    const ciphertext=encryptAdminMfaSecret(secret,keyText,version)
    qrPage.state.markup=qrMarkup(secret)
    console.log('\n请用手机验证器扫描本机页面二维码：http://127.0.0.1:3111/\n账号：rwa.lat 本地后台；基于时间；6 位；30 秒；SHA1。')
    console.log('二维码仅保存在进程内存中；请勿发送到聊天。验证通过后，旧绑定失效。')
    let verified=false
    for(let attempt=0;attempt<3;attempt++){
      let code=await privatePrompt('请输入新账号当前显示的 6 位验证码（输入不回显）：')
      verified=validCode(secret,code);code=''
      if(verified)break
      console.log('验证码未通过，请核对新密钥及验证器时间。尚未修改绑定。')
    }
    secret=''
    if(!verified)throw new Error('New factor verification failed')
    await db.query('BEGIN');inTransaction=true
    const {rows:current}=await db.query('SELECT password_hash,mfa_secret_ciphertext FROM app.admin_users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE',[before.id])
    if(current.length!==1||current[0].password_hash!==before.password_hash||current[0].mfa_secret_ciphertext!==before.mfa_secret_ciphertext)throw new Error('Account changed during recovery')
    await db.query(`UPDATE app.admin_users SET mfa_state='enabled',mfa_secret_ciphertext=$2,failed_login_count=0,locked_until=NULL WHERE id=$1`,[before.id,ciphertext])
    await db.query('UPDATE app.admin_sessions SET revoked_at=now() WHERE admin_user_id=$1 AND revoked_at IS NULL',[before.id])
    await db.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata) VALUES($1,'admin',$2::uuid,'admin.local_mfa_rebound','admin_user',$2::text,$3,$4::jsonb)`,[randomUUID(),before.id,randomUUID(),JSON.stringify({localOnly:true,passwordPreserved:true,permissionsPreserved:true,mfaVerified:true,sessionsRevoked:true,keyVersion:version})])
    await db.query('COMMIT');inTransaction=false
    qrPage.state.markup='';qrPage.state.completed=true
    console.clear()
    console.log('本地 MFA 已重新绑定并验证，旧会话已撤销。密码和权限保留。\n请告知 Codex“绑定完成”，随后由 Codex 恢复带密钥的本地后台服务。')
  }catch{
    if(inTransaction)await db.query('ROLLBACK')
    if(qrPage){qrPage.state.markup='';qrPage.state.failed=true}
    console.clear()
    console.error('重新绑定未完成；绑定未被修改。请检查当前密码、新验证码或输入超时情况后重试。密钥和验证码不会记录到文件。')
    process.exitCode=1
  }finally{
    await db.end()
    if(qrPage)setTimeout(()=>qrPage.server.close(),60000).unref()
  }
}
main().catch(()=>{console.error('Local MFA recovery could not start. No secrets printed.');process.exitCode=1})
