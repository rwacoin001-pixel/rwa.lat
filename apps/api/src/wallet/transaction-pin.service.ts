import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource, QueryRunner } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { SecurityService, type SecurityActor } from '../security/security.service'
import { assertTransactionPin, hashTransactionPin, verifyTransactionPin } from './transaction-pin-hash'
import { PIN_ATTEMPTS, PIN_RESET_COOLDOWN_MS, pinAttempt, pinWithdrawalGate } from './transaction-pin-policy'

type Credential = {
  pinHash: string; credentialVersion: number; failedAttempts: number; lockedUntil: Date | null;
  withdrawalBlockedUntil: Date | null; serverTime: Date;
}
const selectCredential = `SELECT pin_hash AS "pinHash", credential_version AS "credentialVersion",
  failed_attempts AS "failedAttempts", locked_until AS "lockedUntil", withdrawal_blocked_until AS "withdrawalBlockedUntil",
  clock_timestamp() AS "serverTime" FROM app.transaction_password_credentials WHERE user_id=$1`

@Injectable()
export class TransactionPinService {
  private readonly pepper: string
  constructor(private readonly db: DataSource, config: ConfigService, private readonly security: SecurityService) {
    this.pepper = config.get<string>('TRANSACTION_PIN_PEPPER') ?? ''
  }
  private get available() { return Buffer.byteLength(this.pepper) >= 32 }

  async status(userId: string) {
    const [row] = await this.db.query(selectCredential, [userId]) as Credential[]
    const now = row?.serverTime ?? (await this.db.query('SELECT clock_timestamp() AS "serverTime"'))[0].serverTime
    return this.view(row, now)
  }

  async setup(actor: SecurityActor, dto: { pin: string; confirmation: string; reauthentication: string }, requestId: string) {
    return this.mutate('setup', actor, dto, requestId)
  }
  async change(actor: SecurityActor, dto: { pin: string; confirmation: string; currentPin: string; reauthentication: string }, requestId: string) {
    return this.mutate('change', actor, dto, requestId)
  }
  async reset(actor: SecurityActor, dto: { pin: string; confirmation: string; reauthentication: string }, requestId: string) {
    return this.mutate('reset', actor, dto, requestId)
  }

  // This separate transaction commits failed attempts even if the funds transaction subsequently rolls back.
  async verifyWithdrawal(userId: string, pin?: string): Promise<number> {
    this.assertAvailable()
    if (pin === undefined || pin === '') throw this.error('TRANSACTION_PIN_REQUIRED')
    assertTransactionPin(pin)
    const result = await this.transact(async (runner) => {
      const row = await this.lock(runner, userId)
      if (!row) return { error: this.error('TRANSACTION_PIN_REQUIRED') }
      const gate = pinWithdrawalGate(row, row.credentialVersion, row.serverTime)
      if (gate) return { error: this.error(gate, row) }
      const attempt = pinAttempt(row, await verifyTransactionPin(pin, userId, this.pepper, row.pinHash), row.serverTime)
      await this.saveAttempt(runner, userId, attempt)
      if (!attempt.allowed) return { error: this.error(attempt.lockedUntil ? 'TRANSACTION_PIN_LOCKED' : 'TRANSACTION_PIN_INVALID', { ...row, ...attempt }) }
      return { version: row.credentialVersion }
    })
    if (result.error) throw result.error
    return result.version!
  }

  private async mutate(mode: 'setup' | 'change' | 'reset', actor: SecurityActor,
    dto: { pin: string; confirmation: string; currentPin?: string; reauthentication: string }, requestId: string) {
    this.assertAvailable()
    this.security.assertRecentStepUp(actor, dto.reauthentication, true)
    assertTransactionPin(dto.pin)
    if (dto.pin !== dto.confirmation) throw new BadRequestException({ code: 'TRANSACTION_PIN_POLICY', message: 'The two transaction passwords must match.' })
    if (mode === 'change') assertTransactionPin(dto.currentPin ?? '')
    const hash = await hashTransactionPin(dto.pin, actor.userId, this.pepper)
    const result = await this.transact(async (runner) => {
      const row = await this.lock(runner, actor.userId)
      this.security.assertRecentStepUp(actor, dto.reauthentication, true)
      if (mode === 'setup' && row) return { error: this.error('TRANSACTION_PIN_CONFLICT') }
      if (mode !== 'setup' && !row) return { error: this.error('TRANSACTION_PIN_REQUIRED') }
      if (mode === 'change' && row) {
        if (row.lockedUntil && row.lockedUntil > row.serverTime) return { error: this.error('TRANSACTION_PIN_LOCKED', row) }
        const attempt = pinAttempt(row, await verifyTransactionPin(dto.currentPin!, actor.userId, this.pepper, row.pinHash), row.serverTime)
        await this.saveAttempt(runner, actor.userId, attempt)
        if (!attempt.allowed) return { error: this.error(attempt.lockedUntil ? 'TRANSACTION_PIN_LOCKED' : 'TRANSACTION_PIN_INVALID', { ...row, ...attempt }) }
      }
      const [clock] = await runner.query('SELECT clock_timestamp() AS "serverTime"')
      const now: Date = clock.serverTime
      const blocked = mode === 'reset' ? new Date(now.getTime() + PIN_RESET_COOLDOWN_MS) : row?.withdrawalBlockedUntil ?? null
      await runner.query(`INSERT INTO app.transaction_password_credentials
        (user_id,pin_hash,withdrawal_blocked_until,reset_at) VALUES ($1,$2,$3,$4)
        ON CONFLICT (user_id) DO UPDATE SET pin_hash=EXCLUDED.pin_hash, credential_version=app.transaction_password_credentials.credential_version+1,
        failed_attempts=0,locked_until=NULL,withdrawal_blocked_until=EXCLUDED.withdrawal_blocked_until,
        reset_at=COALESCE(EXCLUDED.reset_at,app.transaction_password_credentials.reset_at),updated_at=clock_timestamp()`,
        [actor.userId, hash, blocked, mode === 'reset' ? now : null])
      await runner.query(`INSERT INTO app.audit_logs (id,actor_type,actor_id,user_id,action,object_type,object_id,request_id,metadata)
        VALUES ($1,'user',$2::uuid,$2::uuid,$3,'transaction_password',$2::uuid::text,$4,$5::jsonb)`,
        [randomUUID(), actor.userId, `security.transaction_password.${mode}`, requestId, JSON.stringify({ credentialVersion: (row?.credentialVersion ?? 0) + 1 })])
      return { state: this.view({ ...row, failedAttempts: 0, lockedUntil: null, withdrawalBlockedUntil: blocked } as Credential, now) }
    })
    if (result.error) throw result.error
    return result.state!
  }

  private async lock(runner: QueryRunner, userId: string): Promise<Credential | undefined> {
    await runner.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`transaction-pin:${userId}`])
    const [row] = await runner.query(`${selectCredential} FOR UPDATE`, [userId])
    return row
  }
  private async saveAttempt(runner: QueryRunner, userId: string, attempt: { failedAttempts: number; lockedUntil: Date | null }) {
    await runner.query(`UPDATE app.transaction_password_credentials SET failed_attempts=$2,locked_until=$3,updated_at=clock_timestamp() WHERE user_id=$1`,
      [userId, attempt.failedAttempts, attempt.lockedUntil])
  }
  private view(row: Credential | undefined, now: Date) {
    const locked = row?.lockedUntil && row.lockedUntil > now
    return { available: this.available, configured: Boolean(row), remainingAttempts: locked ? 0 : PIN_ATTEMPTS - (row?.lockedUntil ? 0 : row?.failedAttempts ?? 0),
      lockedUntil: locked ? row!.lockedUntil!.toISOString() : null,
      withdrawalBlockedUntil: row?.withdrawalBlockedUntil && row.withdrawalBlockedUntil > now ? row.withdrawalBlockedUntil.toISOString() : null,
      serverTime: now.toISOString() }
  }
  private error(code: string, row?: Credential) {
    const messages: Record<string, string> = { TRANSACTION_PIN_REQUIRED: 'Set and enter your transaction password.', TRANSACTION_PIN_INVALID: 'Incorrect transaction password.',
      TRANSACTION_PIN_LOCKED: 'Transaction password is temporarily locked.', TRANSACTION_PIN_COOLDOWN: 'Withdrawals are paused after transaction password recovery.',
      TRANSACTION_PIN_CONFLICT: 'Transaction password changed. Confirm the operation again.' }
    return new ConflictException({ code, message: messages[code] ?? 'Transaction password verification failed.',
      ...(row ? { remainingAttempts: Math.max(0, PIN_ATTEMPTS - row.failedAttempts), lockedUntil: row.lockedUntil?.toISOString() ?? null,
        withdrawalBlockedUntil: row.withdrawalBlockedUntil?.toISOString() ?? null, serverTime: row.serverTime.toISOString() } : {}) })
  }
  private assertAvailable() {
    if (!this.available) throw new ServiceUnavailableException({ code: 'TRANSACTION_PIN_UNAVAILABLE', message: 'Transaction password service is unavailable.' })
  }
  private async transact<T>(action: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.db.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try { const result = await action(runner); await runner.commitTransaction(); return result }
    catch (error) { await runner.rollbackTransaction(); throw error }
    finally { await runner.release() }
  }
}
