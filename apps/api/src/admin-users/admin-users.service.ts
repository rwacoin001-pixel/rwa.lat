import { Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { LedgerService } from '../ledger/ledger.service'
import { AdminUserListDto } from './admin-users.dto'

const fromUsers = `FROM app.users u LEFT JOIN app.community_profiles p ON p.user_id = u.id`
const whereUsers = `WHERE ($1::text IS NULL OR u.status::text = $1)
  AND ($2::text IS NULL OR u.id::text = $2 OR p.display_name ILIKE $3 ESCAPE '\\' OR p.handle ILIKE $3 ESCAPE '\\'
    OR EXISTS (SELECT 1 FROM app.login_identities i WHERE i.user_id = u.id AND i.kind = 'email'
      AND i.revoked_at IS NULL AND i.state <> 'revoked' AND i.identifier_hash = $4::bytea))`
const selectUsers = `SELECT u.id, u.status, u.locale, u.created_at, u.updated_at,
  p.display_name AS "displayName", p.handle,
  (SELECT max(s.last_seen_at) FROM app.sessions s WHERE s.user_id = u.id) AS "lastSeenAt",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', i.kind, 'state', i.state, 'verifiedAt', i.verified_at,
    'cipher', CASE WHEN i.kind = 'email' THEN encode(i.identifier_ciphertext, 'hex') END,
    'keyVersion', i.encryption_key_version) ORDER BY i.created_at DESC)
    FROM app.login_identities i WHERE i.user_id = u.id AND i.revoked_at IS NULL AND i.state <> 'revoked'), '[]'::jsonb) AS identities,
  EXISTS (SELECT 1 FROM app.passkey_credentials c WHERE c.user_id = u.id AND c.state = 'active' AND c.revoked_at IS NULL) AS "hasPasskey",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('purpose', a.purpose, 'atomicBalance', b.current_atomic_balance::text,
    'state', a.state, 'decimals', a.asset_decimals)) FROM app.ledger_accounts a
    LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
    WHERE a.owner_type = 'user' AND a.user_id = u.id AND a.asset_code = 'USDT' AND a.network IS NULL
      AND a.purpose IN ('available', 'locked')), '[]'::jsonb) AS balances`

@Injectable()
export class AdminUsersService {
  constructor(private readonly db: DataSource, private readonly crypto: IdentityCrypto, private readonly ledger: LedgerService) {}

  async list(query: AdminUserListDto) {
    const q = query.q?.trim() || null
    const pattern = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null
    const params = [query.status ?? null, q, pattern, q ? this.crypto.hashIdentifier(q) : null]
    const runner = this.db.createQueryRunner()
    await runner.connect()
    try {
      await runner.startTransaction('REPEATABLE READ')
      await runner.query('SET TRANSACTION READ ONLY')
      const [count] = await runner.query(`SELECT count(*)::int AS total ${fromUsers} ${whereUsers}`, params)
      const rows = await runner.query(`${selectUsers} ${fromUsers} ${whereUsers}
        ORDER BY u.created_at DESC, u.id DESC LIMIT $5 OFFSET $6`, [...params, query.limit, query.offset])
      await runner.commitTransaction()
      return { count: rows.length, total: count.total, limit: query.limit, offset: query.offset, users: rows.map((row: Record<string, any>) => this.present(row)) }
    } catch (error) { await runner.rollbackTransaction(); throw error } finally { await runner.release() }
  }

  async detail(id: string) {
    const [row] = await this.db.query(`${selectUsers} ${fromUsers} WHERE u.id = $1`, [id])
    if (!row) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户不存在。' })
    const [history, adjustments] = await Promise.all([
      this.ledger.listUserTransactions(id, 20),
      this.db.query(`SELECT r.id, r.state, r.side, r.atomic_amount::text AS "atomicAmount", r.reason_code AS "reasonCode",
        r.requested_by AS "requestedBy", r.approved_by AS "approvedBy", r.requested_at AS "createdAt", r.posted_at AS "postedAt",
        r.posted_ledger_transaction_id AS "ledgerTransactionId", r.evidence->>'reason' AS reason,
        r.evidence->>'mode' AS mode, r.evidence->>'beforeAtomic' AS "beforeAtomic", r.evidence->>'afterAtomic' AS "afterAtomic"
        FROM app.ledger_adjustment_requests r JOIN app.ledger_accounts a ON a.id = r.ledger_account_id
        WHERE a.user_id = $1 ORDER BY r.requested_at DESC, r.id DESC LIMIT 20`, [id]),
    ])
    return { user: this.present(row), ...history, adjustments, singleOperatorEnabled: process.env.LEDGER_ALLOW_SELF_APPROVAL === 'true' }
  }

  private present(row: Record<string, any>) {
    const { identities, balances, hasPasskey, ...user } = row
    const emailIdentity = identities.find((i: any) => i.kind === 'email' && i.state === 'verified')
      ?? identities.find((i: any) => i.kind === 'email')
    let email: string | null = null
    let emailState = 'none'
    if (emailIdentity) {
      try {
        email = this.crypto.decrypt(Buffer.from(emailIdentity.cipher, 'hex'), emailIdentity.keyVersion)
        emailState = emailIdentity.state === 'verified' && emailIdentity.verifiedAt ? 'verified' : 'pending'
      } catch { emailState = 'unavailable' }
    }
    const balance = (purpose: string): string | null => {
      const accounts = balances.filter((a: any) => a.purpose === purpose)
      if (accounts.some((a: any) => a.atomicBalance === null || a.decimals !== 6)) return null
      return accounts.reduce((sum: bigint, a: any) => sum + BigInt(a.atomicBalance), 0n).toString()
    }
    return { ...user, email, emailState, loginMethods: [...new Set([...identities.map((i: any) => i.kind), ...(hasPasskey ? ['passkey'] : [])])],
      availableAtomic: balance('available'), lockedAtomic: balance('locked'),
      balanceAdjustable: user.status === 'active' && balances.filter((a: any) => a.purpose === 'available').every((a: any) => a.state === 'active' && a.decimals === 6 && a.atomicBalance !== null) }
  }
}
