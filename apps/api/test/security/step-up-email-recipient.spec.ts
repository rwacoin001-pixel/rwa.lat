import { ConfigService } from '@nestjs/config'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { SecurityService } from '../../src/security/security.service'

function fixture(kind: 'google' | 'email', contents: string, hashSubject = 'provider-subject') {
 const crypto=new IdentityCrypto(new ConfigService({IDENTITY_HMAC_KEY:'a'.repeat(64),IDENTITY_ENC_KEY:'b'.repeat(64)}))
 const enc=crypto.encrypt(contents)
 const row={kind,state:'verified',revokedAt:null,identifierHash:crypto.hashIdentifier(`google:${hashSubject}`),identifierCiphertext:enc.ciphertext,encryptionKeyVersion:enc.keyVersion,
 identifier_ciphertext:enc.ciphertext,encryption_key_version:enc.keyVersion,identifier_hash:crypto.hashIdentifier(`google:${hashSubject}`),revoked_at:null,locale:'en'}
 const repo={create:(x:any)=>x,save:jest.fn(async(x:any)=>x)}
 const manager={query:jest.fn(async(sql:string)=>sql.includes('FROM app.login_identities')?[row]:[]),update:jest.fn(),getRepository:()=>repo}
 const delivery={sendEmailCode:jest.fn(async()=>{})}
 const service=new SecurityService({}as any,{}as any,{}as any,{}as any,{manager:{...manager,transaction:async(fn:any)=>fn(manager)}}as any,repo as any,crypto,new ConfigService(),delivery as any)
 return {service,delivery,manager}
}
const actor={userId:'00000000-0000-4000-8000-000000000001',sessionId:'00000000-0000-4000-8000-000000000002',deviceId:null}

describe('transaction password email recipient resolution',()=>{
 it.each(['zh-CN','en','hi','es','ar','fr','pt'])('uses the selected page language %s instead of the account language',async(locale)=>{
  const f=fixture('email','normal@example.com')
  await (f.service.requestEmailStepUp as any)(actor,'fixture',locale)
  expect(f.delivery.sendEmailCode).toHaveBeenCalledWith(expect.objectContaining({locale}))
 })
 it('extracts the verified Google email instead of sending the encrypted profile JSON as the recipient',async()=>{
  const f=fixture('google',JSON.stringify({version:1,provider:'google',subject:'provider-subject',email:'verified@example.com'}))
  await f.service.requestEmailStepUp(actor,'fixture')
  expect(f.delivery.sendEmailCode).toHaveBeenCalledWith(expect.objectContaining({email:'verified@example.com',purpose:'step_up'}))
 })
 it('preserves a verified ordinary email identity',async()=>{
  const f=fixture('email','normal@example.com')
  await f.service.requestEmailStepUp(actor,'fixture')
  expect(f.delivery.sendEmailCode).toHaveBeenCalledWith(expect.objectContaining({email:'normal@example.com'}))
 })
 it('rejects an old Google subject with no verified email proof',async()=>{
  const f=fixture('google','google:provider-subject')
  await expect(f.service.requestEmailStepUp(actor,'fixture')).rejects.toMatchObject({response:{code:'STEP_UP_EMAIL_UNAVAILABLE'}})
  expect(f.delivery.sendEmailCode).not.toHaveBeenCalled()
 })
 it('rejects a Google profile whose provider subject does not match its identity hash',async()=>{
  const f=fixture('google',JSON.stringify({version:1,provider:'google',subject:'forged-subject',email:'attacker@example.com'}))
  await expect(f.service.requestEmailStepUp(actor,'fixture')).rejects.toMatchObject({response:{code:'STEP_UP_EMAIL_UNAVAILABLE'}})
  expect(f.delivery.sendEmailCode).not.toHaveBeenCalled()
 })
})
