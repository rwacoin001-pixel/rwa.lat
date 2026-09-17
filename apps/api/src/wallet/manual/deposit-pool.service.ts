import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'
import { IdentityCrypto } from '../../identity/identity-crypto.service'
import { AuditLog } from '../../security/audit-log.entity'
import { WALLET_ERROR_CODES } from '../wallet.errors'
import type { WalletNetwork } from '../wallet.entities'
import { DepositPoolAddress, type DepositPoolAddressState } from './manual-custody.entities'
import { generateTronKeypair, isValidTronAddress, parseTronPrivateKey, tronAddressFromPrivateKey } from './tron-address.util'

const MAX_GENERATE_COUNT = 100
const MANAGED_NETWORKS: ReadonlyArray<WalletNetwork> = ['tron']

export interface DepositPoolRow {
  id: string
  network: WalletNetwork
  address: string
  state: DepositPoolAddressState
  source: 'generated' | 'imported'
  keyHeld: boolean
  label: string | null
  note: string | null
  assignedUserId: string | null
  assignedAt: Date | null
  lastScanAt: Date | null
  lastSeenTimestamp: string | null
  createdAt: Date
  disabledAt: Date | null
  disabledReason: string | null
}

export interface DepositPoolStats {
  network: WalletNetwork
  available: number
  assigned: number
  disabled: number
  keyHeld: number
  keyMissing: number
}

export interface ScanCandidate {
  id: string
  network: WalletNetwork
  address: string
  cursorMs: number | null
  createdAtMs: number
}

/**
 * Operator-managed manual-custody deposit address pool. Addresses and private
 * keys are encrypted with the identity keyring; assignment is atomic and gives
 * each user exactly one address per network.
 */
@Injectable()
export class DepositPoolService {
  constructor(
    @InjectRepository(DepositPoolAddress) private readonly pool: Repository<DepositPoolAddress>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly crypto: IdentityCrypto,
  ) {}

  async stats(): Promise<{ networks: DepositPoolStats[]; totalAvailable: number }> {
    const rows = await this.dataSource.query(
      `SELECT network,
              COUNT(*) FILTER (WHERE state = 'available')::int AS available,
              COUNT(*) FILTER (WHERE state = 'assigned')::int AS assigned,
              COUNT(*) FILTER (WHERE state = 'disabled')::int AS disabled,
              COUNT(*) FILTER (WHERE key_held)::int AS "keyHeld",
              COUNT(*) FILTER (WHERE NOT key_held)::int AS "keyMissing"
         FROM app.deposit_pool_addresses
        GROUP BY network
        ORDER BY network`,
    ) as DepositPoolStats[]
    const networks = rows.map((row) => ({
      network: row.network,
      available: Number(row.available ?? 0),
      assigned: Number(row.assigned ?? 0),
      disabled: Number(row.disabled ?? 0),
      keyHeld: Number(row.keyHeld ?? 0),
      keyMissing: Number(row.keyMissing ?? 0),
    }))
    return { networks, totalAvailable: networks.reduce((sum, row) => sum + row.available, 0) }
  }

  async list(input: { network?: string; state?: string; limit?: number }): Promise<{ addresses: DepositPoolRow[] }> {
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 100), 1), 200)
    const where: Record<string, unknown> = {}
    if (input.network) where.network = input.network
    if (input.state) where.state = input.state
    const rows = await this.pool.find({ where, order: { createdAt: 'DESC' }, take: limit })
    return { addresses: rows.map((row) => this.toRow(row)) }
  }

  async generate(adminId: string, input: { network: WalletNetwork; count: number; label?: string }, requestId: string) {
    this.assertManagedNetwork(input.network)
    const count = Math.trunc(input.count)
    if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATE_COUNT) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.AMOUNT_INVALID, message: `Generation count must be between 1 and ${MAX_GENERATE_COUNT}.` })
    }
    const now = new Date()
    const rows: DepositPoolAddress[] = []
    for (let index = 0; index < count; index++) {
      const keypair = generateTronKeypair()
      rows.push(this.buildRow({ network: input.network, address: keypair.address, privateKeyHex: keypair.privateKeyHex, source: 'generated', label: input.label ?? null, adminId, now }))
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(DepositPoolAddress).save(rows)
    })
    await this.audit(adminId, requestId, 'wallet.deposit_pool.generated', null, { network: input.network, count })
    return { generated: count, network: input.network }
  }

  async importAddress(
    adminId: string,
    input: { network: WalletNetwork; address: string; privateKey?: string; label?: string },
    requestId: string,
  ) {
    this.assertManagedNetwork(input.network)
    const address = input.address.trim()
    if (!isValidTronAddress(address)) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.ADDRESS_INVALID, message: 'Imported address is not a valid TRON base58check address.' })
    }
    const privateKey = input.privateKey?.trim() || null
    if (privateKey) {
      let derived: string
      try {
        parseTronPrivateKey(privateKey)
        derived = tronAddressFromPrivateKey(privateKey)
      } catch {
        throw new BadRequestException({ code: WALLET_ERROR_CODES.ADDRESS_INVALID, message: 'Imported private key is not a valid TRON secp256k1 key.' })
      }
      if (derived !== address) {
        throw new BadRequestException({ code: WALLET_ERROR_CODES.ADDRESS_INVALID, message: 'Imported private key does not match the provided address.' })
      }
    }
    const addressHash = this.crypto.hmac(address)
    const existing = await this.pool.findOne({ where: { network: input.network, addressHash } })
    if (existing) {
      throw new ConflictException({ code: WALLET_ERROR_CODES.ADDRESS_POOL_CONFLICT, message: 'This address is already present in the deposit pool.' })
    }
    const row = this.buildRow({
      network: input.network,
      address,
      privateKeyHex: privateKey,
      source: 'imported',
      label: input.label ?? null,
      adminId,
      now: new Date(),
    })
    await this.pool.save(row)
    await this.audit(adminId, requestId, 'wallet.deposit_pool.imported', row.id, { network: input.network, keyHeld: row.keyHeld })
    return this.toRow(row)
  }

  async disable(adminId: string, id: string, reason: string | undefined, requestId: string) {
    const row = await this.pool.findOne({ where: { id } })
    if (!row) throw new NotFoundException({ code: WALLET_ERROR_CODES.ADDRESS_NOT_FOUND, message: 'Deposit pool address was not found.' })
    if (row.state !== 'available') {
      throw new ConflictException({ code: WALLET_ERROR_CODES.ADDRESS_POOL_CONFLICT, message: 'Only unassigned pool addresses can be disabled.' })
    }
    row.state = 'disabled'
    row.disabledAt = new Date()
    row.disabledReason = reason?.trim() || 'disabled_by_operator'
    await this.pool.save(row)
    await this.audit(adminId, requestId, 'wallet.deposit_pool.disabled', row.id, { network: row.network, reason: row.disabledReason })
    return this.toRow(row)
  }

  /**
   * Atomic assignment used by the custody adapter when a user requests a
   * deposit address. Returns null when the pool has no available address.
   */
  async assignForUser(network: WalletNetwork, userId: string): Promise<{ id: string; address: string } | null> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`deposit-pool-assign:${userId}`])
      const existing = await manager.query(
        `SELECT id, address_ciphertext, encryption_key_version
           FROM app.deposit_pool_addresses
          WHERE network = $1 AND state = 'assigned' AND assigned_user_id = $2`,
        [network, userId],
      )
      const assignedRow = existing[0] ?? await this.claimAvailableAddress(manager, network, userId)
      if (!assignedRow) return null
      const address = this.crypto.decrypt(
        Buffer.isBuffer(assignedRow.address_ciphertext) ? assignedRow.address_ciphertext : Buffer.from(assignedRow.address_ciphertext),
        Number(assignedRow.encryption_key_version),
      )
      if (!existing[0]) {
        await this.auditLogs.insert({
          id: randomUUID(),
          actorType: 'service',
          actorId: null,
          userId,
          action: 'wallet.deposit_pool.assigned',
          objectType: 'deposit_pool_address',
          objectId: assignedRow.id,
          requestId: 'deposit-pool-assignment',
          reasonCode: null,
          metadata: { network } as never,
        })
      }
      return { id: assignedRow.id as string, address }
    })
  }

  private async claimAvailableAddress(manager: { query: (query: string, parameters?: unknown[]) => Promise<unknown> }, network: WalletNetwork, userId: string) {
    const rows = await manager.query(
      `WITH candidate AS (
         SELECT id FROM app.deposit_pool_addresses
          WHERE network = $1 AND state = 'available'
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       UPDATE app.deposit_pool_addresses target
          SET state = 'assigned', assigned_user_id = $2, assigned_at = now()
         FROM candidate
        WHERE target.id = candidate.id
       RETURNING target.id, target.address_ciphertext, target.encryption_key_version`,
      [network, userId],
    ) as Array<Record<string, unknown>>
    return rows[0] ?? null
  }

  /** Rotating scan batch for the chain watcher. */
  async listForScan(limit: number): Promise<ScanCandidate[]> {
    const rows = await this.dataSource.query(
      `SELECT id, network, address_ciphertext, encryption_key_version, last_seen_timestamp,
              (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS created_at_ms
         FROM app.deposit_pool_addresses
        WHERE state = 'assigned' AND network = 'tron'
        ORDER BY last_scan_at ASC NULLS FIRST
        LIMIT $1`,
      [Math.min(Math.max(Math.trunc(limit), 1), 50)],
    ) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      id: row.id as string,
      network: row.network as WalletNetwork,
      address: this.crypto.decrypt(
        Buffer.isBuffer(row.address_ciphertext) ? row.address_ciphertext : Buffer.from(row.address_ciphertext as Uint8Array),
        Number(row.encryption_key_version),
      ),
      cursorMs: row.last_seen_timestamp === null || row.last_seen_timestamp === undefined ? null : Number(row.last_seen_timestamp),
      createdAtMs: Number(row.created_at_ms ?? Date.now()),
    }))
  }

  async markScanned(id: string, cursorMs: number | null): Promise<void> {
    await this.dataSource.query(
      `UPDATE app.deposit_pool_addresses
          SET last_scan_at = now(),
              last_seen_timestamp = CASE WHEN $2::bigint IS NULL THEN last_seen_timestamp
                                         WHEN last_seen_timestamp IS NULL THEN $2::bigint
                                         ELSE GREATEST(last_seen_timestamp, $2::bigint) END
        WHERE id = $1`,
      [id, cursorMs],
    )
  }

  /** Loads the decrypted private key for an assigned pool address (used for future sweeps). */
  async loadPrivateKey(id: string): Promise<{ address: string; privateKey: string | null }> {
    const row = await this.pool.findOne({ where: { id } })
    if (!row) throw new NotFoundException({ code: WALLET_ERROR_CODES.ADDRESS_NOT_FOUND, message: 'Deposit pool address was not found.' })
    return {
      address: this.crypto.decrypt(row.addressCiphertext, row.encryptionKeyVersion),
      privateKey: row.privateKeyCiphertext ? this.crypto.decrypt(row.privateKeyCiphertext, row.encryptionKeyVersion) : null,
    }
  }

  private assertManagedNetwork(network: WalletNetwork) {
    if (!MANAGED_NETWORKS.includes(network)) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.NETWORK_UNSUPPORTED, message: 'Manual custody only manages TRON deposit addresses in this release.' })
    }
  }

  private buildRow(input: {
    network: WalletNetwork
    address: string
    privateKeyHex: string | null
    source: 'generated' | 'imported'
    label: string | null
    adminId: string
    now: Date
  }): DepositPoolAddress {
    const encryptedAddress = this.crypto.encrypt(input.address)
    const encryptedKey = input.privateKeyHex ? this.crypto.encrypt(input.privateKeyHex) : null
    return this.pool.create({
      id: randomUUID(),
      network: input.network,
      assetCode: 'USDT',
      assetDecimals: 6,
      addressHash: this.crypto.hmac(input.address),
      addressCiphertext: encryptedAddress.ciphertext,
      privateKeyCiphertext: encryptedKey?.ciphertext ?? null,
      encryptionKeyVersion: encryptedAddress.keyVersion,
      keyHeld: Boolean(encryptedKey),
      state: 'available',
      source: input.source,
      assignedUserId: null,
      assignedAt: null,
      label: input.label,
      note: null,
      lastScanAt: null,
      lastSeenTimestamp: null,
      createdBy: input.adminId,
      createdAt: input.now,
      disabledAt: null,
      disabledReason: null,
    })
  }

  private toRow(row: DepositPoolAddress): DepositPoolRow {
    return {
      id: row.id,
      network: row.network,
      address: this.crypto.decrypt(row.addressCiphertext, row.encryptionKeyVersion),
      state: row.state,
      source: row.source,
      keyHeld: row.keyHeld,
      label: row.label,
      note: row.note,
      assignedUserId: row.assignedUserId,
      assignedAt: row.assignedAt,
      lastScanAt: row.lastScanAt,
      lastSeenTimestamp: row.lastSeenTimestamp,
      createdAt: row.createdAt,
      disabledAt: row.disabledAt,
      disabledReason: row.disabledReason,
    }
  }

  private async audit(adminId: string, requestId: string, action: string, objectId: string | null, metadata: Record<string, unknown>) {
    await this.auditLogs.insert({
      id: randomUUID(),
      actorType: 'admin',
      actorId: adminId,
      userId: null,
      action,
      objectType: 'deposit_pool_address',
      objectId,
      requestId,
      reasonCode: null,
      metadata: metadata as never,
    })
  }
}
