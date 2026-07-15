import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { DataSource } from 'typeorm'

const PASSWORD_HASH_PREFIX = 'scrypt'
const LEGACY_MFA_CIPHER_PREFIX = 'v1'
const VERSIONED_MFA_CIPHER_PREFIX = 'v2'

export interface AdminSessionProfile {
  id: string
  email: string
  roleId: string
  roleName: string
  permissions: string[]
}

export interface AdminSessionActor extends AdminSessionProfile {
  sessionId: string
}

export function hashAdminPassword(password: string, salt = randomBytes(16)): string {
  if (password.length < 12) throw new Error('Admin passwords must be at least 12 characters long')
  const derived = scryptSync(password, salt, 64)
  return `${PASSWORD_HASH_PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`
}

function base32Bytes(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/g, '')
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error('Invalid TOTP secret')
  let bits = ''
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  for (const char of normalized) bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  const bytes: number[] = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2))
  return Buffer.from(bytes)
}

function mfaKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32) throw new Error('ADMIN_MFA_ENCRYPTION_KEY must be a 32-byte base64 value')
  return key
}

export function encryptAdminMfaSecret(secret: string, encryptionKey: string, keyVersion?: number): string {
  base32Bytes(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', mfaKey(encryptionKey), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const payload = [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')]
  if (keyVersion === undefined) return [LEGACY_MFA_CIPHER_PREFIX, ...payload].join('.')
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) throw new Error('Admin MFA key version must be a positive integer')
  return [VERSIONED_MFA_CIPHER_PREFIX, String(keyVersion), ...payload].join('.')
}

function decryptAdminMfaSecret(ciphertext: string, keys: Map<number, Buffer>, activeVersion: number): string {
  const parts = ciphertext.split('.')
  const versioned = parts[0] === VERSIONED_MFA_CIPHER_PREFIX
  const legacy = parts[0] === LEGACY_MFA_CIPHER_PREFIX
  const keyVersion = versioned ? Number(parts[1]) : undefined
  const [ivText, tagText, encryptedText] = versioned ? parts.slice(2) : parts.slice(1)
  if ((!versioned && !legacy) || !ivText || !tagText || !encryptedText) throw new Error('Invalid encrypted MFA secret')
  const candidates = keyVersion === undefined
    ? [activeVersion, ...[...keys.keys()].filter((value) => value !== activeVersion)]
    : [keyVersion]
  let lastError: unknown
  for (const candidate of candidates) {
    const key = keys.get(candidate)
    if (!key) continue
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'))
      decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
      return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8')
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Admin MFA encryption key version is unavailable')
}

export function createAdminTotp(secret: string, at = Date.now()): string {
  const counter = Math.floor(at / 1000 / 30)
  const counterBytes = Buffer.alloc(8)
  counterBytes.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', base32Bytes(secret)).update(counterBytes).digest()
  const offset = digest[digest.length - 1] & 0x0f
  return String(((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)).padStart(6, '0')
}

function verifyAdminPassword(password: string, encoded: string | null): boolean {
  if (!encoded) return false
  const [algorithm, saltHex, digestHex] = encoded.split('$')
  if (algorithm !== PASSWORD_HASH_PREFIX || !saltHex || !digestHex) return false
  try {
    const expected = Buffer.from(digestHex, 'hex')
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

@Injectable()
export class AdminAuthService {
  private readonly sessionTtlSeconds: number
  private readonly maxFailures: number
  private readonly lockSeconds: number
  private readonly mfaRequired: boolean

  constructor(
    private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {
    this.sessionTtlSeconds = this.intConfig(config, 'ADMIN_SESSION_TTL_SECONDS', 60 * 60 * 8, 300, 60 * 60 * 24)
    this.maxFailures = this.intConfig(config, 'ADMIN_LOGIN_MAX_FAILURES', 5, 3, 20)
    this.lockSeconds = this.intConfig(config, 'ADMIN_LOGIN_LOCK_SECONDS', 15 * 60, 60, 24 * 60 * 60)
    this.mfaRequired = config.get<string>('APP_ENV') === 'production' || config.get<string>('ADMIN_MFA_REQUIRED') === 'true'
  }

  async login(input: { email: string; password: string; mfaCode?: string; ipAddress?: string; userAgent?: string }) {
    const profile = await this.loadProfileByEmail(input.email, true)
    if (!profile || profile.disabledAt || (profile.lockedUntil && profile.lockedUntil.getTime() > Date.now()) || !verifyAdminPassword(input.password, profile.passwordHash)) {
      if (profile) await this.recordFailedLogin(profile.id)
      await this.writeAudit({
        actorId: profile?.id ?? null,
        action: 'admin.session.login_failed',
        objectType: 'admin_session',
        metadata: {
          emailFingerprint: this.fingerprint(input.email),
          ipAddress: input.ipAddress ?? null,
          userAgent: this.safeUserAgent(input.userAgent),
        },
      })
      throw new UnauthorizedException('Invalid administrator credentials')
    }
    if (
      (this.mfaRequired && profile.mfaState !== 'enabled')
      || profile.mfaState === 'pending'
      || (profile.mfaState === 'enabled' && !this.verifyMfaCode(profile.mfaSecretCiphertext, input.mfaCode))
    ) {
      await this.writeAudit({
        actorId: profile.id,
        action: 'admin.session.mfa_required',
        objectType: 'admin_session',
        metadata: { mfaState: profile.mfaState, ipAddress: input.ipAddress ?? null, userAgent: this.safeUserAgent(input.userAgent) },
      })
      throw new UnauthorizedException('Additional administrator verification is required')
    }
    await this.ds.query(
      `UPDATE app.admin_users
       SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
       WHERE id = $1`,
      [profile.id],
    )
    const issued = await this.issueSession(profile, input)
    await this.writeAudit({
      actorId: profile.id,
      action: 'admin.session.login_succeeded',
      objectType: 'admin_session',
      objectId: issued.sessionId,
      metadata: { ipAddress: input.ipAddress ?? null, userAgent: this.safeUserAgent(input.userAgent) },
    })
    return issued
  }

  async authenticate(rawToken: string): Promise<AdminSessionActor> {
    const token = rawToken.trim()
    if (token.length < 32) throw new UnauthorizedException('Admin session is invalid')
    const hash = createHash('sha256').update(token).digest()
    const rows = await this.ds.query(
      `SELECT s.id AS session_id, s.token_hash, u.id, u.email, u.role_id, u.disabled_at,
              r.name AS role_name, COALESCE(array_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '{}') AS permissions
       FROM app.admin_sessions s
       JOIN app.admin_users u ON u.id = s.admin_user_id
       JOIN app.admin_roles r ON r.id = u.role_id
       LEFT JOIN app.admin_role_permissions rp ON rp.role_id = r.id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
       GROUP BY s.id, s.token_hash, u.id, u.email, u.role_id, u.disabled_at, r.name`,
      [hash],
    ) as Array<{ session_id: string; token_hash: Buffer; id: string; email: string; role_id: string; disabled_at: Date | null; role_name: string; permissions: string[] }>
    const row = rows[0]
    if (!row || row.disabled_at || !timingSafeEqual(row.token_hash, hash)) {
      throw new UnauthorizedException('Admin session is invalid or expired')
    }
    await this.ds.query(`UPDATE app.admin_sessions SET last_seen_at = now() WHERE id = $1`, [row.session_id])
    return {
      id: row.id,
      email: row.email,
      roleId: row.role_id,
      roleName: row.role_name,
      permissions: row.permissions,
      sessionId: row.session_id,
    }
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return
    const hash = createHash('sha256').update(rawToken.trim()).digest()
    const rows = await this.ds.query(
      `UPDATE app.admin_sessions
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE token_hash = $1
       RETURNING id, admin_user_id`,
      [hash],
    ) as Array<{ id: string; admin_user_id: string }>
    if (rows[0]) {
      await this.writeAudit({
        actorId: rows[0].admin_user_id,
        action: 'admin.session.logout',
        objectType: 'admin_session',
        objectId: rows[0].id,
      })
    }
  }

  async refresh(rawToken: string, context: { ipAddress?: string; userAgent?: string } = {}) {
    const actor = await this.authenticate(rawToken)
    await this.ds.query(
      `UPDATE app.admin_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
      [actor.sessionId],
    )
    const issued = await this.issueSession(actor, context)
    await this.writeAudit({
      actorId: actor.id,
      action: 'admin.session.refreshed',
      objectType: 'admin_session',
      objectId: issued.sessionId,
      metadata: { replacedSessionId: actor.sessionId, ipAddress: context.ipAddress ?? null, userAgent: this.safeUserAgent(context.userAgent) },
    })
    return issued
  }

  private async issueSession(profile: AdminSessionProfile, context: { ipAddress?: string; userAgent?: string }) {
    const token = `ras_${randomBytes(32).toString('base64url')}`
    const tokenHash = createHash('sha256').update(token).digest()
    const expiresAt = new Date(Date.now() + this.sessionTtlSeconds * 1000)
    const sessionRows = await this.ds.query(
      `INSERT INTO app.admin_sessions (admin_user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, NULLIF($4, '')::inet, NULLIF($5, ''))
       RETURNING id`,
      [profile.id, tokenHash, expiresAt, context.ipAddress ?? '', this.safeUserAgent(context.userAgent) ?? ''],
    ) as Array<{ id: string }>
    return {
      sessionToken: token,
      expiresAt,
      admin: this.toPublicProfile(profile),
      sessionId: sessionRows[0].id,
    }
  }

  private async loadProfileByEmail(email: string, includePassword: boolean) {
    const rows = await this.ds.query(
      `SELECT u.id, u.email, u.role_id, u.password_hash, u.disabled_at, u.locked_until, u.mfa_state, u.mfa_secret_ciphertext,
              r.name AS role_name, COALESCE(array_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '{}') AS permissions
       FROM app.admin_users u
       JOIN app.admin_roles r ON r.id = u.role_id
       LEFT JOIN app.admin_role_permissions rp ON rp.role_id = r.id
       WHERE lower(u.email) = lower($1)
       GROUP BY u.id, u.email, u.role_id, u.password_hash, u.disabled_at, u.locked_until, u.mfa_state, u.mfa_secret_ciphertext, r.name`,
      [email.trim()],
    ) as Array<{ id: string; email: string; role_id: string; password_hash: string | null; disabled_at: Date | null; locked_until: Date | null; mfa_state: 'disabled' | 'pending' | 'enabled'; mfa_secret_ciphertext: string | null; role_name: string; permissions: string[] }>
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      email: row.email,
      roleId: row.role_id,
      passwordHash: includePassword ? row.password_hash : null,
      disabledAt: row.disabled_at,
      lockedUntil: row.locked_until,
      mfaState: row.mfa_state,
      mfaSecretCiphertext: row.mfa_secret_ciphertext,
      roleName: row.role_name,
      permissions: row.permissions,
    }
  }

  private async recordFailedLogin(adminId: string): Promise<void> {
    await this.ds.query(
      `UPDATE app.admin_users
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE
             WHEN failed_login_count + 1 >= $2 THEN now() + ($3::text || ' seconds')::interval
             ELSE locked_until
           END
       WHERE id = $1`,
      [adminId, this.maxFailures, this.lockSeconds],
    )
  }

  private async writeAudit(input: {
    actorId: string | null
    action: string
    objectType: string
    objectId?: string
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await this.ds.query(
      `INSERT INTO app.audit_logs (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        randomUUID(),
        input.actorId,
        input.action,
        input.objectType,
        input.objectId ?? null,
        randomUUID(),
        JSON.stringify(input.metadata ?? {}),
      ],
    )
  }

  private fingerprint(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
  }

  private safeUserAgent(value?: string): string | null {
    return value ? value.slice(0, 1024) : null
  }

  private verifyMfaCode(ciphertext: string | null, code: string | undefined): boolean {
    if (!ciphertext || !code || !/^\d{6}$/.test(code)) return false
    try {
      const keyring = readAdminMfaKeyring(this.config)
      const secret = decryptAdminMfaSecret(ciphertext, keyring.keys, keyring.activeVersion)
      for (const shift of [-1, 0, 1]) {
        const expected = createAdminTotp(secret, Date.now() + shift * 30_000)
        if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true
      }
      return false
    } catch {
      return false
    }
  }

  private toPublicProfile(profile: { id: string; email: string; roleId: string; roleName: string; permissions: string[] }): AdminSessionProfile {
    return {
      id: profile.id,
      email: profile.email,
      roleId: profile.roleId,
      roleName: profile.roleName,
      permissions: profile.permissions,
    }
  }

  private intConfig(config: ConfigService, key: string, fallback: number, min: number, max: number): number {
    const value = Number(config.get<string>(key) ?? fallback)
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback
  }
}

function readAdminMfaKeyring(config: ConfigService): { keys: Map<number, Buffer>; activeVersion: number } {
  const encoded = config.get<string>('ADMIN_MFA_KEYS_JSON')?.trim()
  if (!encoded) {
    const legacy = config.get<string>('ADMIN_MFA_ENCRYPTION_KEY')
    if (!legacy) throw new Error('ADMIN_MFA_ENCRYPTION_KEY is not configured')
    return { keys: new Map([[1, mfaKey(legacy)]]), activeVersion: 1 }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(encoded)
  } catch {
    throw new Error('ADMIN_MFA_KEYS_JSON must be a JSON object keyed by positive integer versions')
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('ADMIN_MFA_KEYS_JSON must be a JSON object keyed by positive integer versions')
  }
  const keys = new Map<number, Buffer>()
  for (const [version, key] of Object.entries(parsed)) {
    if (!/^[1-9]\d*$/.test(version) || typeof key !== 'string') {
      throw new Error('ADMIN_MFA_KEYS_JSON contains an invalid version or key')
    }
    keys.set(Number(version), mfaKey(key))
  }
  const activeVersion = Number(config.get<string>('ADMIN_MFA_ACTIVE_KEY_VERSION'))
  if (!Number.isSafeInteger(activeVersion) || !keys.has(activeVersion)) {
    throw new Error('ADMIN_MFA_ACTIVE_KEY_VERSION must select a key present in ADMIN_MFA_KEYS_JSON')
  }
  return { keys, activeVersion }
}
