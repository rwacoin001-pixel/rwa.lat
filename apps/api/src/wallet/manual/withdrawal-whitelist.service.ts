import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'
import { AuditLog } from '../../security/audit-log.entity'
import { WALLET_ERROR_CODES } from '../wallet.errors'
import type { WalletNetwork } from '../wallet.entities'
import { WithdrawalWhitelistEntry } from './manual-custody.entities'

export interface WithdrawalWhitelistRow {
  id: string
  userId: string
  network: WalletNetwork
  state: 'active' | 'revoked'
  note: string | null
  createdBy: string | null
  createdAt: Date
  revokedAt: Date | null
  revokeReason: string | null
}

/**
 * Withdrawal auto-approval whitelist. In financial mode, an active entry for
 * the user + network routes a screened withdrawal straight into the execution
 * queue; every other withdrawal stays in manual two-admin review.
 */
@Injectable()
export class WithdrawalWhitelistService {
  constructor(
    @InjectRepository(WithdrawalWhitelistEntry) private readonly entries: Repository<WithdrawalWhitelistEntry>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  async isActive(userId: string, network: WalletNetwork): Promise<boolean> {
    const count = await this.entries.count({ where: { userId, network, state: 'active' } })
    return count > 0
  }

  async list(input: { network?: string; state?: string; limit?: number }): Promise<{ entries: WithdrawalWhitelistRow[] }> {
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 100), 1), 200)
    const where: Record<string, unknown> = {}
    if (input.network) where.network = input.network
    if (input.state) where.state = input.state
    const rows = await this.entries.find({ where, order: { createdAt: 'DESC' }, take: limit })
    return { entries: rows.map((row) => this.toRow(row)) }
  }

  async add(adminId: string, input: { userId: string; network: WalletNetwork; note?: string }, requestId: string) {
    const [user] = await this.dataSource.query(`SELECT id FROM app.users WHERE id = $1`, [input.userId]) as Array<{ id: string }>
    if (!user) {
      throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'User was not found.' })
    }
    const inserted = await this.dataSource.query(
      `INSERT INTO app.withdrawal_whitelist_entries (id, user_id, network, state, note, created_by)
       VALUES ($1, $2, $3, 'active', $4, $5)
       ON CONFLICT (user_id, network) WHERE state = 'active' DO NOTHING
       RETURNING id, user_id AS "userId", network, state, note, created_by AS "createdBy", created_at AS "createdAt", revoked_at AS "revokedAt", revoke_reason AS "revokeReason"`,
      [randomUUID(), input.userId, input.network, input.note?.trim() || null, adminId],
    ) as Array<Record<string, unknown>>
    if (!inserted.length) {
      const [existing] = await this.entries.find({ where: { userId: input.userId, network: input.network, state: 'active' }, take: 1 })
      await this.audit(adminId, requestId, 'wallet.withdrawal_whitelist.add_duplicate', existing?.id ?? null, { userId: input.userId, network: input.network })
      return existing ? { ...this.toRow(existing), duplicate: true } : { duplicate: true }
    }
    const row = inserted[0]
    await this.audit(adminId, requestId, 'wallet.withdrawal_whitelist.added', row.id as string, { userId: input.userId, network: input.network })
    return { ...this.toRow(mapRow(row)), duplicate: false }
  }

  async revoke(adminId: string, id: string, reason: string | undefined, requestId: string) {
    const entry = await this.entries.findOne({ where: { id } })
    if (!entry) {
      throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Whitelist entry was not found.' })
    }
    if (entry.state !== 'active') {
      throw new ConflictException({ code: WALLET_ERROR_CODES.WITHDRAWAL_STATE_INVALID, message: 'Only active whitelist entries can be revoked.' })
    }
    entry.state = 'revoked'
    entry.revokedBy = adminId
    entry.revokedAt = new Date()
    entry.revokeReason = reason?.trim() || 'revoked_by_operator'
    await this.entries.save(entry)
    await this.audit(adminId, requestId, 'wallet.withdrawal_whitelist.revoked', entry.id, { userId: entry.userId, network: entry.network, reason: entry.revokeReason })
    return this.toRow(entry)
  }

  private toRow(row: WithdrawalWhitelistEntry): WithdrawalWhitelistRow {
    return {
      id: row.id,
      userId: row.userId,
      network: row.network,
      state: row.state,
      note: row.note,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
      revokeReason: row.revokeReason,
    }
  }

  private async audit(adminId: string, requestId: string, action: string, objectId: string | null, metadata: Record<string, unknown>) {
    await this.auditLogs.insert({
      id: randomUUID(),
      actorType: 'admin',
      actorId: adminId,
      userId: null,
      action,
      objectType: 'withdrawal_whitelist_entry',
      objectId,
      requestId,
      reasonCode: null,
      metadata: metadata as never,
    })
  }
}

function mapRow(row: Record<string, unknown>): WithdrawalWhitelistEntry {
  return {
    id: row.id as string,
    userId: row.userId as string,
    network: row.network as WalletNetwork,
    state: row.state as 'active' | 'revoked',
    note: (row.note as string) ?? null,
    createdBy: (row.createdBy as string) ?? null,
    createdAt: row.createdAt as Date,
    revokedBy: null,
    revokedAt: (row.revokedAt as Date) ?? null,
    revokeReason: (row.revokeReason as string) ?? null,
  }
}
