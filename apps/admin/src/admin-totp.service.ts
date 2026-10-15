import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { createAdminTotp, decryptAdminMfaSecret, encryptAdminMfaSecret, readAdminMfaKeyring } from './admin-auth.service'
import { renderAdminRecoveryEmail } from './admin-recovery-email'

const INVALID = 'Administrator verification failed'
type Context = { ipAddress?: string; userAgent?: string }
export function matchAdminTotp(ciphertext: string | null, code: string, config: ConfigService, now = Date.now()): number | null {
  if (!ciphertext || !/^\d{6}$/.test(code)) return null
  try {
    const ring = readAdminMfaKeyring(config)
    const secret = decryptAdminMfaSecret(ciphertext, ring.keys, ring.activeVersion)
    for (const shift of [1, 0, -1]) {
      if (timingSafeEqual(Buffer.from(createAdminTotp(secret, now + shift * 30_000)), Buffer.from(code))) return Math.floor(now / 30_000) + shift
    }
  } catch { /* Missing/invalid secrets never authenticate. */ }
  return null
}
function base32(bytes: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0; let value = 0; let out = ''
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits) out += alphabet[(value << (5 - bits)) & 31]
  return out
}
@Injectable()
export class AdminTotpService {
  constructor(private readonly ds: DataSource, private readonly config: ConfigService) {}
  private enabled() { if (this.config.get<string>('ADMIN_LOGIN_MODE') !== 'totp') throw new UnauthorizedException(INVALID) }
  private ring() { return readAdminMfaKeyring(this.config) }
  private hash(value: string) { return createHash('sha256').update(value).digest() }
  private codeHash(id: string, code: string) { return createHmac('sha256', this.ring().keys.get(this.ring().activeVersion)!).update(`admin-recovery:${id}:${code}`).digest() }
  private async audit(em: EntityManager, id: string, action: string, metadata: object = {}) {
    await em.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,request_id,metadata) VALUES($1,'admin',$2,$3,'admin_user',$4,$5::jsonb)`, [randomUUID(), id, action, randomUUID(), JSON.stringify(metadata)])
  }
  async login(email: string, code: string, context: Context) {
    this.enabled()
    const outcome = await this.ds.transaction(async em => {
      const [u] = await em.query('SELECT * FROM app.admin_users WHERE lower(email)=lower($1) FOR UPDATE', [email.trim()])
      if (!u || u.disabled_at || (u.locked_until && new Date(u.locked_until).getTime() > Date.now())) return null
      const counter = u.mfa_state === 'enabled' ? matchAdminTotp(u.mfa_secret_ciphertext, code, this.config) : null
      if (counter === null || (u.mfa_last_counter !== null && Number(u.mfa_last_counter) >= counter)) {
        const limit = Number(this.config.get('ADMIN_LOGIN_MAX_FAILURES') ?? 5)
        const lock = Number(this.config.get('ADMIN_LOGIN_LOCK_SECONDS') ?? 900)
        await em.query(`UPDATE app.admin_users SET failed_login_count=failed_login_count+1, locked_until=CASE WHEN failed_login_count+1 >= $2 THEN now()+($3::text||' seconds')::interval ELSE locked_until END WHERE id=$1`, [u.id, limit, lock])
        await this.audit(em, u.id, 'admin.session.login_failed', {method:'totp',ipAddress:context.ipAddress ?? null})
        return null
      }
      const [role] = await em.query(`SELECT r.name, COALESCE(array_agg(p.permission) FILTER(WHERE p.permission IS NOT NULL),'{}') AS permissions FROM app.admin_roles r LEFT JOIN app.admin_role_permissions p ON p.role_id=r.id WHERE r.id=$1 GROUP BY r.id,r.name`, [u.role_id])
      if (!role) return null
      const sessionToken = `ras_${randomBytes(32).toString('base64url')}`
      const ttl = Number(this.config.get('ADMIN_SESSION_TTL_SECONDS') ?? 28800)
      const expiresAt = new Date(Date.now() + Math.max(300,Math.min(86400,ttl))*1000)
      const [session] = await em.query(`INSERT INTO app.admin_sessions(admin_user_id,token_hash,expires_at,ip_address,user_agent) VALUES($1,$2,$3,NULLIF($4,'')::inet,NULLIF($5,'')) RETURNING id`, [u.id,this.hash(sessionToken),expiresAt,context.ipAddress ?? '',(context.userAgent ?? '').slice(0,1024)])
      await em.query('UPDATE app.admin_users SET mfa_last_counter=$2,failed_login_count=0,locked_until=NULL,last_login_at=now() WHERE id=$1',[u.id,counter])
      await this.audit(em,u.id,'admin.session.login_succeeded',{method:'totp',sessionId:session.id})
      return {sessionToken,expiresAt,admin:{id:u.id,email:u.email,roleId:u.role_id,roleName:role.name,permissions:role.permissions}}
    })
    if (!outcome) throw new UnauthorizedException(INVALID)
    return outcome
  }
  async requestRecovery(email: string, locale?: string) {
    this.enabled()
    if(this.config.get('EMAIL_PROVIDER') !== 'resend' || !this.config.get('RESEND_API_KEY') || !this.config.get('EMAIL_FROM')) throw new ServiceUnavailableException('Recovery email delivery unavailable')
    const code = String(randomInt(0,1000000)).padStart(6,'0'); const id=randomUUID()
    const send = await this.ds.transaction(async em=>{
      const [u]=await em.query('SELECT id,email,disabled_at,mfa_state FROM app.admin_users WHERE lower(email)=lower($1) FOR UPDATE',[email.trim()])
      if(!u || u.disabled_at || u.mfa_state !== 'enabled') return null
      const [limits]=await em.query(`SELECT count(*) FILTER(WHERE created_at>now()-interval '15 minutes')::int AS count, max(created_at) AS last FROM app.admin_mfa_recovery WHERE admin_user_id=$1`,[u.id])
      if(limits.count>=5 || (limits.last && Date.now()-new Date(limits.last).getTime()<60000)) return null
      await em.query('UPDATE app.admin_mfa_recovery SET consumed_at=now() WHERE admin_user_id=$1 AND consumed_at IS NULL',[u.id])
      await em.query(`INSERT INTO app.admin_mfa_recovery(id,admin_user_id,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')`,[id,u.id,this.codeHash(id,code)])
      await this.audit(em,u.id,'admin.mfa.recovery_requested')
      return {email:u.email,id}
    })
    if(send){
      try{
        const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${this.config.get('RESEND_API_KEY')}`,'content-type':'application/json','Idempotency-Key':`admin-recovery-${id}`},body:JSON.stringify({from:`A-REIT <${this.config.get('EMAIL_FROM')}>`,to:[send.email],...renderAdminRecoveryEmail(code,send.email,locale)}),signal:AbortSignal.timeout(10000)})
        if(!response.ok) throw new Error('Delivery failed')
      }catch{
        await this.ds.query('UPDATE app.admin_mfa_recovery SET consumed_at=now() WHERE id=$1',[id])
        throw new ServiceUnavailableException('Recovery email delivery unavailable')
      }
    }
    return {status:'sent_if_eligible',retryAfterSeconds:60}
  }
  async verifyRecovery(email:string,code:string){
    this.enabled()
    const result=await this.ds.transaction(async em=>{
      const [u]=await em.query('SELECT id,email,disabled_at FROM app.admin_users WHERE lower(email)=lower($1) FOR UPDATE',[email.trim()])
      if(!u || u.disabled_at) return null
      const [r]=await em.query(`SELECT * FROM app.admin_mfa_recovery WHERE admin_user_id=$1 AND consumed_at IS NULL AND code_used_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,[u.id])
      if(!r || r.attempts>=5) return null
      const match=/^\d{6}$/.test(code)&&timingSafeEqual(Buffer.from(r.code_hash),this.codeHash(r.id,code))
      if(!match){await em.query('UPDATE app.admin_mfa_recovery SET attempts=attempts+1 WHERE id=$1',[r.id]);return null}
      const secret=base32(randomBytes(20));const ring=this.ring();const token=randomBytes(32).toString('base64url')
      const cipher=encryptAdminMfaSecret(secret,ring.keys.get(ring.activeVersion)!.toString('base64'),ring.activeVersion)
      await em.query(`UPDATE app.admin_mfa_recovery SET code_used_at=now(),attempts=0,token_hash=$2,pending_secret_ciphertext=$3,expires_at=now()+interval '10 minutes' WHERE id=$1`,[r.id,this.hash(token),cipher])
      await this.audit(em,u.id,'admin.mfa.recovery_email_verified')
      return {recoveryToken:token,secret,otpauthUri:`otpauth://totp/${encodeURIComponent('A-REIT:'+u.email)}?secret=${secret}&issuer=A-REIT&algorithm=SHA1&digits=6&period=30`}
    })
    if(!result) throw new UnauthorizedException(INVALID)
    return result
  }
  async confirmRecovery(token:string,code:string){
    this.enabled()
    if(!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedException(INVALID)
    const success=await this.ds.transaction(async em=>{
      // Always lock administrator before recovery row, matching request/verify/login lock order.
      const [lookup]=await em.query('SELECT admin_user_id FROM app.admin_mfa_recovery WHERE token_hash=$1',[this.hash(token)])
      if(!lookup)return false
      const [u]=await em.query('SELECT id,disabled_at FROM app.admin_users WHERE id=$1 FOR UPDATE',[lookup.admin_user_id])
      if(!u || u.disabled_at)return false
      const [r]=await em.query(`SELECT * FROM app.admin_mfa_recovery WHERE token_hash=$1 AND consumed_at IS NULL AND code_used_at IS NOT NULL AND expires_at>now() FOR UPDATE`,[this.hash(token)])
      if(!r || r.attempts>=5)return false
      const counter=matchAdminTotp(r.pending_secret_ciphertext,code,this.config)
      if(counter===null){await em.query('UPDATE app.admin_mfa_recovery SET attempts=attempts+1 WHERE id=$1',[r.id]);return false}
      await em.query(`UPDATE app.admin_users SET mfa_secret_ciphertext=$2,mfa_state='enabled',mfa_last_counter=$3,failed_login_count=0,locked_until=NULL WHERE id=$1`,[u.id,r.pending_secret_ciphertext,counter])
      await em.query('UPDATE app.admin_sessions SET revoked_at=now() WHERE admin_user_id=$1 AND revoked_at IS NULL',[u.id])
      await em.query('UPDATE app.admin_mfa_recovery SET consumed_at=now(),pending_secret_ciphertext=NULL WHERE admin_user_id=$1 AND consumed_at IS NULL',[u.id])
      await this.audit(em,u.id,'admin.mfa.rebound',{sessionsRevoked:true})
      return true
    })
    if(!success)throw new UnauthorizedException(INVALID)
    return {status:'rebound',reauthenticationRequired:true}
  }
}
