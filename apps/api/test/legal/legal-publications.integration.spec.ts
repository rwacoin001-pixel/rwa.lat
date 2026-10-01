import { randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Test as AdminTest } from '../../../../apps/admin/node_modules/@nestjs/testing'
import { ValidationPipe as AdminValidationPipe, type INestApplication as AdminApplication } from '../../../../apps/admin/node_modules/@nestjs/common'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { LegalController } from '../../src/legal/legal.controller'
import { loadRegistrationConsents, validateRegistrationConsents, REGISTRATION_CONSENT_REQUIREMENTS } from '../../src/identity/consent-policy'
import { AdminLegalController } from '../../../../apps/admin/src/admin-legal.controller'
import { AdminLegalService } from '../../../../apps/admin/src/admin-legal.service'
import { IdentityService } from '../../src/identity/identity.service'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'
import { EmailCodeService } from '../../src/identity/email-code.service'
import { IdentityController } from '../../src/identity/identity.controller'
import { User } from '../../src/identity/user.entity'
import { LoginIdentity } from '../../src/identity/login-identity.entity'
import { Device } from '../../src/identity/device.entity'
import { Session } from '../../src/identity/session.entity'
import { IdentityOneTimeToken } from '../../src/identity/identity-one-time-token.entity'
import { IdentityPasskeyChallenge } from '../../src/identity/identity-passkey-challenge.entity'
import { PasskeyCredential } from '../../src/security/passkey-credential.entity'
import type { OAuthProviderService } from '../../src/identity/oauth-provider.service'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
suite('Legal publication and registration boundaries in an owned disposable database', () => {
  let db: DataSource, admin: AdminLegalService, app: INestApplication, base: string
  let adminApp: AdminApplication, adminBase: string
  let codes: EmailCodeService, delivery: IdentityDeliveryService
  let identity: IdentityService
  const oauthExchange = jest.fn()
  const actor = randomUUID()
  const config = new ConfigService({ APP_ENV: 'production' })
  const content = (text = 'Verified business text') => ({ title:'Terms',effectiveDate:'2026-09-18',sections:[{title:'Scope',body:text}] })
  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || !target.pathname.startsWith('/rwa_lat_codex_') || !target.pathname.endsWith('_test')) throw new Error('Owned disposable database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, APP_ENV:'test' }))
    await db.initialize(); await db.runMigrations()
    admin = new AdminLegalService(new ConfigService({ CORE_DATABASE_URL:process.env.TEST_DATABASE_URL }))
    const identityConfig=new ConfigService({ APP_ENV:'production',AUTH_ADAPTER:'demo',IDENTITY_HMAC_KEY:'a'.repeat(64),IDENTITY_ENC_KEY:'b'.repeat(64) })
    const crypto=new IdentityCrypto(identityConfig);delivery=new IdentityDeliveryService(identityConfig)
    identity=new IdentityService(db.getRepository(User),db.getRepository(LoginIdentity),db.getRepository(Device),db.getRepository(Session),
      db.getRepository(IdentityOneTimeToken),db.getRepository(PasskeyCredential),db.getRepository(IdentityPasskeyChallenge),crypto,delivery,{exchange:oauthExchange} as unknown as OAuthProviderService,identityConfig,db)
    codes=new EmailCodeService(db,crypto,delivery,identity)
    const module = await Test.createTestingModule({ controllers:[LegalController,IdentityController], providers:[
      {provide:DataSource,useValue:db},
      {provide:IdentityService,useValue:identity},{provide:EmailCodeService,useValue:codes},
    ] }).compile()
    app = module.createNestApplication({ logger:false }); app.setGlobalPrefix('v1')
    app.useGlobalPipes(new ValidationPipe({ whitelist:true,forbidNonWhitelisted:true,transform:true }))
    await app.listen(0,'127.0.0.1'); base=await app.getUrl()
    const adminModule=await AdminTest.createTestingModule({controllers:[AdminLegalController],providers:[{provide:AdminLegalService,useValue:admin}]}).compile()
    adminApp=adminModule.createNestApplication({logger:false});adminApp.setGlobalPrefix('v1')
    adminApp.useGlobalPipes(new AdminValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}))
    // The production guard still decides permission; this fixture supplies an actor without credentials.
    adminApp.use((req: any, _res: any, next: () => void) => { req.admin={id:actor,permissions:req.headers['x-test-permission'] === 'granted' ? ['platform.manage'] : []}; next() })
    await adminApp.listen(0,'127.0.0.1');adminBase=await adminApp.getUrl()
  })
  beforeEach(async () => {
    await db.query('UPDATE app.legal_documents SET published_revision=NULL')
    await db.query('DELETE FROM app.legal_document_versions')
    await db.query("UPDATE app.legal_documents SET revision=0,draft='{}'")
  })
  afterAll(async () => {
    if(db?.isInitialized) {await db.query('UPDATE app.legal_documents SET published_revision=NULL');await db.query('DELETE FROM app.legal_document_versions');await db.query("UPDATE app.legal_documents SET revision=0,draft='{}'")}
    if(app)await app.close();if(adminApp)await adminApp.close();else await admin?.onModuleDestroy()
    delivery?.onModuleDestroy();if(db?.isInitialized)await db.destroy()
  })
  const publish = async (kind:'terms'|'privacy',body=content()) => { const draft=await admin.get(kind); await admin.save(kind,{expectedRevision:draft.revision,content:body},actor); return admin.publish(kind,draft.revision+1,actor) }
  it('never exposes a draft and blocks production registration until both documents are published',async () => {
    await admin.save('terms',{expectedRevision:0,content:content()},actor)
    expect((await fetch(`${base}/v1/legal/terms`)).status).toBe(404)
    await expect(loadRegistrationConsents(db,config)).rejects.toMatchObject({response:{code:'LEGAL_PUBLICATION_REQUIRED'}})
    await admin.publish('terms',1,actor)
    await expect(loadRegistrationConsents(db,config)).rejects.toThrow()
    expect(await loadRegistrationConsents(db,new ConfigService({APP_ENV:'development'}))).toEqual([
      {documentType:'terms',version:'terms-1',href:'/terms?version=terms-1'},
      {documentType:'privacy',version:'2026-09-18',href:'/privacy?version=2026-09-18'},
    ])
  })
  it('archives immutable text, publishes explicitly and audits without storing the body in audit logs',async () => {
    await publish('terms')
    await admin.save('terms',{expectedRevision:1,content:content('Revised text')},actor)
    expect((await (await fetch(`${base}/v1/legal/terms`)).json()).sections[0].body).toBe('Verified business text')
    await admin.publish('terms',2,actor)
    expect((await (await fetch(`${base}/v1/legal/terms`)).json()).version).toBe('terms-2')
    expect((await (await fetch(`${base}/v1/legal/terms?version=terms-1`)).json()).sections[0].body).toBe('Verified business text')
    expect((await fetch(`${base}/v1/legal/privacy?version=terms-1`)).status).toBe(404)
    const [audit]=await db.query("SELECT metadata FROM app.audit_logs WHERE actor_id=$1 AND action='admin.legal.published' AND metadata->>'version'='terms-2' LIMIT 1",[actor])
    expect(audit.metadata.version).toBe('terms-2');expect(audit.metadata).not.toHaveProperty('content')
  })
  it('rejects stale edits and stale publication, and replays a publication without adding a version',async () => {
    await publish('terms')
    await expect(admin.save('terms',{expectedRevision:0,content:content()},actor)).rejects.toThrow('版本')
    await expect(admin.publish('terms',2,actor)).rejects.toThrow('版本')
    await admin.publish('terms',1,actor)
    expect(await admin.versions('terms')).toHaveLength(1)
  })
  it('requires current versions for new registrations and leaves an existing consent unchanged',async () => {
    const user=randomUUID()
    await db.query('INSERT INTO app.users(id) VALUES($1)',[user])
    await db.query("INSERT INTO app.consents(id,user_id,document_type,document_version,granted,recorded_at,request_id) VALUES($1,$2,'terms','2026-09-18',true,now(),$3)",[randomUUID(),user,randomUUID()])
    await publish('terms'); await publish('privacy')
    const required=await loadRegistrationConsents(db,config)
    expect(() => validateRegistrationConsents(REGISTRATION_CONSENT_REQUIREMENTS.map(r=>({...r,accepted:true})),required)).toThrow('changed')
    expect(validateRegistrationConsents(required.map(r=>({...r,accepted:true})),required)).toHaveLength(2)
    await publish('terms',content('Version 2'))
    const [old]=await db.query('SELECT document_version FROM app.consents WHERE user_id=$1',[user])
    expect(old.document_version).toBe('2026-09-18')
    expect(() => validateRegistrationConsents(required.map(r=>({...r,accepted:true})),[...required.slice(0,1).map(r=>({...r,version:'terms-2'})),required[1]])).toThrow('changed')
  })
  it('persists published versions through mobile registration and permits existing users to log in after a new publication',async () => {
    await publish('terms');await publish('privacy')
    const required=(await (await fetch(`${base}/v1/auth/consent-requirements`)).json()).required
    const address=`legal-${randomUUID()}@example.test`
    const challenge=await codes.request({email:address,intent:'register',consents:required.map((r:any)=>({...r,accepted:true}))})
    const verification=await codes.confirm({email:address,intent:'register',challengeId:challenge.challengeId,code:delivery.lastDemoCode(address,'register')!}).catch(error=>error.response)
    expect(verification).toMatchObject({code:'AUTH_FLOW_REQUIRED',authFlow:{step:'password'}})
    const session=await identity.completeAuthFlow({continuationToken:verification.authFlow.continuationToken,password:'isolated legal test password 123!'}) as {userId:string}
    const stored=await db.query('SELECT document_version FROM app.consents WHERE user_id=$1 ORDER BY document_version',[session.userId])
    expect(stored.map((r:any)=>r.document_version)).toEqual(['privacy-1','terms-1'])
    await publish('terms',content('Updated'))
    await db.query("UPDATE app.email_code_challenges SET created_at=now()-interval '61 seconds' WHERE id=$1",[challenge.challengeId])
    const login=await codes.request({email:address,intent:'login'})
    expect((await codes.confirm({email:address,intent:'login',challengeId:login.challengeId,code:delivery.lastDemoCode(address,'login')!})).userId).toBe(session.userId)
    expect(await db.query('SELECT id FROM app.consents WHERE user_id=$1',[session.userId])).toHaveLength(2)
    await expect(codes.request({email:`new-${randomUUID()}@example.test`,intent:'register',consents:required.map((r:any)=>({...r,accepted:true}))})).rejects.toMatchObject({response:{code:'AUTH_CONSENT_VERSION_MISMATCH'}})
  })
  it.each(['google','x'] as const)('requires explicit consent once for a new %s user and keeps returning login direct',async provider => {
    await publish('terms');await publish('privacy')
    const subject=randomUUID()
    oauthExchange.mockResolvedValue({subject,intent:'login',locale:'zh-CN'})
    const flowError=await identity.exchangeOAuthCode(provider,'verified-fixture-code','fixture-state').catch(error=>error)
    expect(flowError.response).toMatchObject({code:'AUTH_FLOW_REQUIRED',authFlow:{step:'consent'}})
    const token=flowError.response.authFlow.continuationToken
    expect(await db.query('SELECT id FROM app.login_identities WHERE kind=$1 AND identifier_hash=$2',[provider,new IdentityCrypto(new ConfigService({IDENTITY_HMAC_KEY:'a'.repeat(64),IDENTITY_ENC_KEY:'b'.repeat(64)})).hashIdentifier(`${provider}:${subject}`)])).toHaveLength(0)
    await expect(identity.completeAuthFlow({continuationToken:token})).rejects.toThrow()
    const required=await loadRegistrationConsents(db,config)
    const session=await identity.completeAuthFlow({continuationToken:token,consents:required.map(r=>({...r,accepted:true}))}) as {userId:string;token:string}
    expect(await db.query('SELECT id FROM app.consents WHERE user_id=$1 AND granted=true',[session.userId])).toHaveLength(2)
    await expect(identity.completeAuthFlow({continuationToken:token,consents:required.map(r=>({...r,accepted:true}))})).rejects.toThrow()
    await publish('terms',content('Later version'))
    await expect(identity.exchangeOAuthCode(provider,'next-verified-code','next-state')).resolves.toMatchObject({userId:session.userId})
    expect(await db.query('SELECT id FROM app.consents WHERE user_id=$1',[session.userId])).toHaveLength(2)
  })
  it('serializes publication against a registration transaction that has already read the versions',async () => {
    await publish('terms'); await publish('privacy')
    await admin.save('terms',{expectedRevision:1,content:content('Second')},actor)
    const runner=db.createQueryRunner();await runner.connect();await runner.startTransaction()
    let settled=false
    try {
      expect((await loadRegistrationConsents(runner.manager,config,true))[0].version).toBe('terms-1')
      const publishing=admin.publish('terms',2,actor).then(v=>{settled=true;return v})
      await new Promise(resolve=>setTimeout(resolve,100))
      expect(settled).toBe(false)
      await runner.commitTransaction();await publishing
      expect((await loadRegistrationConsents(db,config))[0].version).toBe('terms-2')
    } finally {if(runner.isTransactionActive)await runner.rollbackTransaction();await runner.release()}
  })
  it('enforces the existing business permission and validates public HTTP inputs',async () => {
    expect((await fetch(`${adminBase}/v1/admin/legal/terms`)).status).toBe(403)
    expect((await fetch(`${adminBase}/v1/admin/legal/terms`,{headers:{'x-test-permission':'granted'}})).status).toBe(200)
    const headers={'content-type':'application/json','x-test-permission':'granted'}
    expect((await fetch(`${adminBase}/v1/admin/legal/terms`,{method:'PUT',headers,body:JSON.stringify({expectedRevision:0,content:{...content(),effectiveDate:'2026-02-30'}})})).status).toBe(400)
    expect((await fetch(`${adminBase}/v1/admin/legal/terms`,{method:'PUT',headers,body:JSON.stringify({expectedRevision:0,content:content(),extra:true})})).status).toBe(400)
    expect((await fetch(`${base}/v1/legal/unknown`)).status).toBe(404)
  })
  it('retains literal HTML as text for the React renderer instead of executing markup',async () => {
    await publish('terms',content('<script>alert(1)</script>\n\nActual paragraph'))
    const response=await fetch(`${base}/v1/legal/terms`)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toContain('application/json')
    expect((await response.json()).sections[0].body).toBe('<script>alert(1)</script>\n\nActual paragraph')
  })
})
