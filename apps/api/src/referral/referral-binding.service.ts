import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { ReferralContext } from './referral-context'
import { generateShortCode, normalizeReferralCode, RESERVED_REFERRAL_CODES, CUSTOM_REFERRAL_CODE_PATTERN, CUSTOM_REFERRAL_CODE_MESSAGE } from './referral-code'

type Attribution = { id: string; inviter_user_id: string; code: string; clicked_at: Date; expires_at: Date }

@Injectable()
export class ReferralBindingService {
  constructor(private readonly db: DataSource, private readonly config: ConfigService, private readonly context: ReferralContext) {}

  private async installed(manager = this.db.manager) {
    return (await manager.query("SELECT to_regclass('app.referral_registration_decisions') IS NOT NULL AS installed"))[0].installed as boolean
  }
  private async requireInstalled() {
    if (!await this.installed()) throw new ServiceUnavailableException('Referral stage-zero migration is not installed')
  }

  private mac(id: string) {
    const key = this.config.getOrThrow<string>('IDENTITY_HMAC_KEY')
    if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('Referral signing key must be 32 bytes')
    return createHmac('sha256', Buffer.from(key, 'hex')).update(`referral-attribution:v1:${id}`).digest()
  }
  private sign(id: string) { return `${id}.${this.mac(id).toString('base64url')}` }
  private tokenId(token?: string) {
    if (!token || token.length > 256) return null
    const parts = token.split('.')
    if (parts.length !== 2 || !/^[a-f0-9-]{36}$/i.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null
    const signature = Buffer.from(parts[1], 'base64url'), expected = this.mac(parts[0])
    return signature.length === expected.length && timingSafeEqual(signature, expected) ? parts[0] : null
  }
  private async attribution(manager: EntityManager, token?: string): Promise<Attribution | null> {
    const id = this.tokenId(token)
    if (!id) return null
    const [row] = await manager.query(`SELECT a.* FROM app.referral_attributions a JOIN app.users u ON u.id=a.inviter_user_id
      WHERE a.id=$1 AND a.expires_at>now() AND u.status NOT IN ('closed','suspended')`, [id])
    return row ?? null
  }
  currentAttribution() { return this.context.token() }

  async getCode(userId: string) {
    await this.requireInstalled()
    return this.db.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(1790760000)')
      const [user] = await manager.query(`SELECT status FROM app.users WHERE id=$1`, [userId])
      if (!user || ['closed','suspended'].includes(user.status)) throw new BadRequestException('Account unavailable')
      const [existing] = await manager.query('SELECT code FROM app.referral_codes WHERE user_id=$1', [userId])
      if (existing) return existing.code as string
      let code: string
      do { code = generateShortCode() } while ((await manager.query('SELECT 1 FROM app.referral_code_aliases WHERE code=$1', [code])).length)
      await manager.query('INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)', [code,userId])
      await manager.query('INSERT INTO app.referral_codes(user_id,code) VALUES($1,$2)', [userId,code])
      return code
    })
  }

  async changeCode(userId: string, input: string) {
    await this.requireInstalled()
    const code = input.toLowerCase()
    if (!CUSTOM_REFERRAL_CODE_PATTERN.test(code) || RESERVED_REFERRAL_CODES.has(code)) throw new BadRequestException(CUSTOM_REFERRAL_CODE_MESSAGE)
    return this.db.transaction(async m => {
      await m.query('SELECT pg_advisory_xact_lock(1790760000)')
      const [user] = await m.query('SELECT status FROM app.users WHERE id=$1',[userId])
      if (!user || ['closed','suspended'].includes(user.status)) throw new BadRequestException('Account unavailable')
      const [old] = await m.query('SELECT * FROM app.referral_codes WHERE user_id=$1 FOR UPDATE', [userId])
      if (old?.code === code) return code
      if (old && new Date(old.updated_at).getTime() !== new Date(old.created_at).getTime()
        && Date.now()-new Date(old.updated_at).getTime() < 30*86400000) throw new ConflictException('Code can change once per 30 days')
      if ((await m.query('SELECT 1 FROM app.referral_code_aliases WHERE code=$1', [code])).length) throw new ConflictException('Code is reserved')
      await m.query('INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)', [code,userId])
      await m.query(`INSERT INTO app.referral_codes(user_id,code) VALUES($1,$2)
        ON CONFLICT(user_id) DO UPDATE SET code=excluded.code,updated_at=clock_timestamp()`, [userId,code])
      return code
    })
  }

  /** Public pre-signup check: whether a typed code belongs to an active account. Reveals nothing about the inviter. */
  async lookup(input: string) {
    await this.requireInstalled()
    const code = normalizeReferralCode(input)
    if (!code) return { valid: false as const }
    const [alias] = await this.db.query(`SELECT a.code FROM app.referral_code_aliases a JOIN app.users u ON u.id=a.user_id
      WHERE a.code=$1 AND u.status NOT IN ('closed','suspended')`, [code])
    return alias ? { valid: true as const, code: (alias.code as string).toUpperCase() } : { valid: false as const }
  }

  /** The code carried by the current signed attribution, so signup can show it instead of asking again. */
  async describeAttribution(token?: string) {
    if (!await this.installed()) return null
    const row = await this.attribution(this.db.manager, token)
    return row ? { code: row.code.toUpperCase(), expiresAt: row.expires_at } : null
  }

  /** The first valid attribution wins; changing a code preserves all previously issued links. */
  async land(code: string, previous?: string) {
    await this.requireInstalled()
    return this.db.transaction(async m => {
      const old = await this.attribution(m, previous)
      if (old) return { token: previous!, expiresAt: old.expires_at }
      const [alias] = await m.query(`SELECT a.user_id FROM app.referral_code_aliases a JOIN app.users u ON u.id=a.user_id
        WHERE a.code=$1 AND u.status NOT IN ('closed','suspended')`, [code.toLowerCase()])
      if (!alias) throw new BadRequestException('Referral code unavailable')
      const [settings] = await m.query('SELECT config FROM app.referral_settings WHERE fee_effective_at<=now() ORDER BY fee_effective_at DESC,version DESC LIMIT 1')
      const days = settings?.config.attributionDays ?? 30
      const [row] = await m.query(`INSERT INTO app.referral_attributions(inviter_user_id,code,expires_at)
        VALUES($1,$2,now()+$3*interval '1 day') RETURNING id,expires_at`, [alias.user_id,code.toLowerCase(),days])
      return { token: this.sign(row.id), expiresAt: row.expires_at as Date }
    })
  }

  /** Only new-user insertion paths call this, in that same registration transaction. */
  async bindNewUser(m: EntityManager, userId: string, token = this.context.token()) {
    if (!m.queryRunner?.isTransactionActive) throw new Error('Referral binding requires the registration transaction')
    // Additive rollout: old authentication remains usable before this migration is installed.
    if (!await this.installed(m)) return
    await m.query('SELECT pg_advisory_xact_lock(1790760000)')
    if ((await m.query('SELECT 1 FROM app.referral_registration_decisions WHERE user_id=$1', [userId])).length) return
    // Defense in depth: a later standalone call cannot bind an existing account.
    if (!(await m.query('SELECT 1 FROM app.users WHERE id=$1 AND xmin::text=pg_current_xact_id()::text', [userId])).length) {
      throw new ConflictException('Existing accounts cannot acquire a referral parent')
    }
    let source = await this.attribution(m, token)
    if (source?.inviter_user_id === userId) throw new BadRequestException('Self referral is forbidden')
    // A previously accepted legacy invitation is only a competing attribution, never a second edge.
    const [legacy] = await m.query(`SELECT inviter_user_id,accepted_at FROM app.invitations
      WHERE accepted_user_id=$1 AND state='accepted' ORDER BY accepted_at,id LIMIT 1`, [userId])
    if (legacy && (!source || new Date(legacy.accepted_at) < new Date(source.clicked_at))) {
      const [alias] = await m.query('SELECT code FROM app.referral_code_aliases WHERE user_id=$1 ORDER BY created_at,code LIMIT 1', [legacy.inviter_user_id])
      if (alias) source = { id: '', inviter_user_id: legacy.inviter_user_id, code: alias.code, clicked_at: legacy.accepted_at, expires_at: new Date() }
    }
    // Invitation-only registration: no attribution means no account (the whole registration transaction rolls back).
    if (!source && this.config.get<string>('REFERRAL_INVITE_REQUIRED') === 'true') {
      throw new BadRequestException({ code: 'REFERRAL_CODE_REQUIRED', message: 'A valid invitation code is required to create an account.' })
    }
    await m.query('INSERT INTO app.referral_registration_decisions(user_id,attribution_id) VALUES($1,$2)', [userId,source?.id || null])
    if (source) {
      await m.query(`INSERT INTO app.referral_edges(invitee_user_id,inviter_user_id,code) VALUES($1,$2,$3)`, [userId,source.inviter_user_id,source.code])
      await m.query(`INSERT INTO app.referral_audit(request_key,action,object_id,metadata) VALUES($1,'referral.bound',$2,$3)`,
        [`binding:${userId}`,userId,JSON.stringify({ inviterUserId: source.inviter_user_id, code: source.code })])
    }
  }

  async rememberOAuth(stateHash: Buffer) {
    if (!await this.installed()) return
    const token = this.context.token()
    if (await this.attribution(this.db.manager,token)) await this.db.query(
      'INSERT INTO app.referral_oauth_attributions(state_hash,signed_attribution) VALUES($1,$2) ON CONFLICT DO NOTHING', [stateHash,token])
  }
  async oauthAttribution(stateHash: Buffer) {
    if (!await this.installed()) return undefined
    const [row] = await this.db.query('SELECT signed_attribution FROM app.referral_oauth_attributions WHERE state_hash=$1', [stateHash])
    return row?.signed_attribution as string | undefined
  }
}
