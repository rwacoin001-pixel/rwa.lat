import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { IdentityCrypto } from '../identity/identity-crypto.service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YOUNG_ACCOUNT_DAYS = 7
/** amount × 100 ≥ deposits × LARGE_PERCENT raises large_vs_deposits. */
const LARGE_PERCENT = 80n
// Withdrawals that never left (or will never leave) the platform do not make an address "known".
const DEAD_STATES = ['rejected', 'failed', 'cancelled']
const TWO_FACTOR_ACTIONS = ['security.totp.enrolled', 'security.totp.revoked', 'security.passkey.registered', 'security.passkey.revoked']

export type SignalLevel = 'info' | 'warn' | 'high'
export interface WithdrawalSignal { code: string; level: SignalLevel; message: string }

export interface WithdrawalContext {
  withdrawalId: string
  user: {
    id: string
    email: string | null
    createdAt: string
    accountAgeDays: number
    kycState: string
    availableAtomic: string
    lockedAtomic: string
    totalDepositedAtomic: string
    totalWithdrawnAtomic: string
    /** Completed withdrawals only. */
    withdrawalCount: number
    lastLoginAt: string | null
    /** Country of the latest recorded visit (app.visit_log); null when none is recorded. */
    lastLoginCountry: string | null
  }
  address: {
    firstUsedByThisUser: boolean
    /** Earlier withdrawals by this user to the same address and network (rejected/failed/cancelled excluded). */
    previousWithdrawalsToAddress: number
    /** Distinct other users who withdrew to this address or saved it in their address book. */
    otherAccountsUsingAddress: number
    /** The address is an active entry in this user's withdrawal address book. */
    whitelisted: boolean
    /** The user is on the per-network auto-approval whitelist (app.withdrawal_whitelist_entries). */
    autoApproveWhitelisted: boolean
  }
  recentSecurity: {
    passwordChanged24h: boolean
    newDevice24h: boolean
    newSessions24h: number
    twoFactorChanged24h: boolean
    emailChanged24h: boolean
  }
  signals: WithdrawalSignal[]
}

/**
 * Read-only risk background for one withdrawal, shown beside the admin approve/reject buttons.
 * Every query reads existing tables; nothing is written.
 */
@Injectable()
export class WithdrawalContextService {
  private readonly log = new Logger(WithdrawalContextService.name)

  constructor(private readonly db: DataSource, private readonly crypto: IdentityCrypto) {}

  async context(withdrawalId: string): Promise<WithdrawalContext> {
    if (!UUID.test(withdrawalId)) throw new NotFoundException({ code: 'WITHDRAWAL_NOT_FOUND', message: 'Withdrawal was not found.' })
    const [withdrawal] = await this.db.query(
      `SELECT w.id, w.user_id, w.network, w.destination_hash, w.atomic_amount::text AS atomic_amount, w.requested_at
         FROM app.withdrawals w WHERE w.id = $1`,
      [withdrawalId],
    ) as Array<{ id: string; user_id: string; network: string; destination_hash: Buffer; atomic_amount: string; requested_at: Date }>
    if (!withdrawal) throw new NotFoundException({ code: 'WITHDRAWAL_NOT_FOUND', message: 'Withdrawal was not found.' })
    const userId = withdrawal.user_id

    const [[user], [money], [address], [security]] = await Promise.all([
      this.db.query(
        `SELECT u.created_at,
                GREATEST(0, floor(extract(epoch FROM now() - u.created_at) / 86400))::int AS age_days,
                (SELECT k.state FROM app.kyc_cases k WHERE k.user_id = u.id ORDER BY k.created_at DESC LIMIT 1) AS kyc_state,
                (SELECT jsonb_build_object('cipher', encode(i.identifier_ciphertext, 'hex'), 'keyVersion', i.encryption_key_version)
                   FROM app.login_identities i
                  WHERE i.user_id = u.id AND i.kind = 'email' AND i.state <> 'revoked' AND i.revoked_at IS NULL
                  ORDER BY i.created_at DESC LIMIT 1) AS email,
                (SELECT max(s.created_at) FROM app.sessions s WHERE s.user_id = u.id) AS last_login_at,
                (SELECT v.country FROM app.visit_log v WHERE v.user_id = u.id AND v.country IS NOT NULL
                  ORDER BY v.started_at DESC LIMIT 1) AS last_country
           FROM app.users u WHERE u.id = $1`,
        [userId],
      ) as Promise<Array<{ created_at: Date; age_days: number; kyc_state: string | null; email: { cipher: string; keyVersion: number } | null; last_login_at: Date | null; last_country: string | null }>>,
      this.db.query(
        `SELECT
           (SELECT COALESCE(SUM(b.current_atomic_balance), 0)::text FROM app.ledger_accounts a
              JOIN app.ledger_account_balances b ON b.account_id = a.id
             WHERE a.owner_type = 'user' AND a.user_id = $1 AND a.asset_code = 'USDT' AND a.network IS NULL AND a.purpose = 'available') AS available,
           (SELECT COALESCE(SUM(b.current_atomic_balance), 0)::text FROM app.ledger_accounts a
              JOIN app.ledger_account_balances b ON b.account_id = a.id
             WHERE a.owner_type = 'user' AND a.user_id = $1 AND a.asset_code = 'USDT' AND a.network IS NULL AND a.purpose = 'locked') AS locked,
           (SELECT COALESCE(SUM(atomic_amount), 0)::text FROM app.deposits WHERE user_id = $1 AND state = 'credited') AS deposited,
           (SELECT COALESCE(SUM(atomic_amount), 0)::text FROM app.withdrawals WHERE user_id = $1 AND state = 'completed') AS withdrawn,
           (SELECT COUNT(*)::int FROM app.withdrawals WHERE user_id = $1 AND state = 'completed') AS withdrawal_count`,
        [userId],
      ) as Promise<Array<{ available: string; locked: string; deposited: string; withdrawn: string; withdrawal_count: number }>>,
      this.db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM app.withdrawals w
             WHERE w.user_id = $1 AND w.network = $2 AND w.destination_hash = $3 AND w.id <> $4
               AND w.requested_at <= $5 AND w.state <> ALL($6::text[])) AS previous,
           (SELECT COUNT(DISTINCT other.user_id)::int FROM (
              SELECT user_id FROM app.withdrawals WHERE network = $2 AND destination_hash = $3 AND user_id <> $1
              UNION
              SELECT user_id FROM app.withdrawal_address_book WHERE network = $2 AND address_hash = $3 AND user_id <> $1
            ) other) AS others,
           EXISTS (SELECT 1 FROM app.withdrawal_address_book
                    WHERE user_id = $1 AND network = $2 AND address_hash = $3 AND state = 'active') AS whitelisted,
           EXISTS (SELECT 1 FROM app.withdrawal_whitelist_entries
                    WHERE user_id = $1 AND network = $2 AND state = 'active') AS auto_whitelisted`,
        [userId, withdrawal.network, withdrawal.destination_hash, withdrawal.id, withdrawal.requested_at, DEAD_STATES],
      ) as Promise<Array<{ previous: number; others: number; whitelisted: boolean; auto_whitelisted: boolean }>>,
      // Sources: password and 2FA changes come from app.audit_logs (security.password.changed,
      // security.totp.*, security.passkey.*). The password action is also written when a password is
      // first set up, so on a brand-new account it can mean "set" rather than "changed".
      // New device = a device first seen in the last 24h while the user already had an older one
      // (same rule as the security.new_device notification). Sessions are counted from app.sessions.
      this.db.query(
        `SELECT
           EXISTS (SELECT 1 FROM app.audit_logs WHERE user_id = $1 AND action = 'security.password.changed'
                    AND occurred_at > now() - interval '24 hours') AS password_changed,
           EXISTS (SELECT 1 FROM app.audit_logs WHERE user_id = $1 AND action = ANY($2::text[])
                    AND occurred_at > now() - interval '24 hours') AS two_factor_changed,
           EXISTS (SELECT 1 FROM app.audit_logs WHERE user_id = $1 AND action = 'security.email.changed'
                    AND occurred_at > now() - interval '24 hours') AS email_changed,
           EXISTS (SELECT 1 FROM app.devices d WHERE d.user_id = $1 AND d.first_seen_at > now() - interval '24 hours'
                    AND EXISTS (SELECT 1 FROM app.devices o WHERE o.user_id = d.user_id AND o.id <> d.id AND o.first_seen_at < d.first_seen_at)) AS new_device,
           (SELECT COUNT(*)::int FROM app.sessions WHERE user_id = $1 AND created_at > now() - interval '24 hours') AS new_sessions`,
        [userId, TWO_FACTOR_ACTIONS],
      ) as Promise<Array<{ password_changed: boolean; two_factor_changed: boolean; email_changed: boolean; new_device: boolean; new_sessions: number }>>,
    ])

    const context: WithdrawalContext = {
      withdrawalId: withdrawal.id,
      user: {
        id: userId,
        email: this.email(user.email),
        createdAt: new Date(user.created_at).toISOString(),
        accountAgeDays: Number(user.age_days),
        kycState: user.kyc_state ?? 'not_started',
        availableAtomic: money.available,
        lockedAtomic: money.locked,
        totalDepositedAtomic: money.deposited,
        totalWithdrawnAtomic: money.withdrawn,
        withdrawalCount: Number(money.withdrawal_count),
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at).toISOString() : null,
        lastLoginCountry: user.last_country,
      },
      address: {
        firstUsedByThisUser: Number(address.previous) === 0,
        previousWithdrawalsToAddress: Number(address.previous),
        otherAccountsUsingAddress: Number(address.others),
        whitelisted: Boolean(address.whitelisted),
        autoApproveWhitelisted: Boolean(address.auto_whitelisted),
      },
      recentSecurity: {
        passwordChanged24h: Boolean(security.password_changed),
        newDevice24h: Boolean(security.new_device),
        newSessions24h: Number(security.new_sessions),
        twoFactorChanged24h: Boolean(security.two_factor_changed),
        emailChanged24h: Boolean(security.email_changed),
      },
      signals: [],
    }
    context.signals = withdrawalSignals(context, withdrawal.atomic_amount)
    return context
  }

  private email(value: { cipher: string; keyVersion: number } | null): string | null {
    if (!value) return null
    try {
      return this.crypto.decrypt(Buffer.from(value.cipher, 'hex'), value.keyVersion)
    } catch (error) {
      this.log.warn(`withdrawal context: email could not be decrypted (${(error as Error).message})`)
      return null
    }
  }
}

/** Signals, most severe first. */
export function withdrawalSignals(context: Omit<WithdrawalContext, 'signals'>, amountAtomic: string): WithdrawalSignal[] {
  const { user, address, recentSecurity } = context
  const signals: WithdrawalSignal[] = []
  const deposited = BigInt(user.totalDepositedAtomic)
  if (address.otherAccountsUsingAddress > 0) {
    signals.push({ code: 'address_shared', level: 'high', message: `该地址还被 ${address.otherAccountsUsingAddress} 个其他账户使用` })
  }
  if (recentSecurity.passwordChanged24h) signals.push({ code: 'recent_password_change', level: 'high', message: '24 小时内改过密码' })
  if (recentSecurity.twoFactorChanged24h) signals.push({ code: 'recent_2fa_change', level: 'high', message: '24 小时内改过两步验证' })
  if (BigInt(amountAtomic) * 100n >= deposited * LARGE_PERCENT) {
    signals.push({ code: 'large_vs_deposits', level: 'warn', message: deposited === 0n ? '没有充值记录' : '提现额接近或超过累计充值' })
  }
  if (address.firstUsedByThisUser) signals.push({ code: 'new_address', level: 'warn', message: '第一次提到这个地址' })
  if (recentSecurity.newDevice24h) signals.push({ code: 'recent_new_device', level: 'warn', message: '24 小时内有新设备登录' })
  if (user.accountAgeDays < YOUNG_ACCOUNT_DAYS) signals.push({ code: 'young_account', level: 'warn', message: `注册才 ${user.accountAgeDays} 天` })
  if (user.withdrawalCount === 0) signals.push({ code: 'first_withdrawal', level: 'info', message: '首次提现' })
  if (user.kycState !== 'approved') signals.push({ code: 'kyc_not_approved', level: 'info', message: '未完成实名认证' })
  return signals
}
