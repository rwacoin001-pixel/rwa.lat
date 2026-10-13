import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'
import { IdentityCrypto } from '../../identity/identity-crypto.service'
import { AuditLog } from '../../security/audit-log.entity'
import { WALLET_ERROR_CODES } from '../wallet.errors'
import type { WalletNetwork } from '../wallet.entities'
import { DepositPoolAddress, type DepositPoolAddressState } from './manual-custody.entities'
import { isValidTronAddress } from './tron-address.util'

const MAX_IMPORT_COUNT = 1000

type QueryManager = { query: (query: string, parameters?: unknown[]) => Promise<unknown> }
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
  retiredAt: Date | null
  watchUntil: Date | null
  nextScanAt: Date | null
}

export interface DepositPoolStats {
  network: WalletNetwork
  available: number
  assigned: number
  retired: number
  disabled: number
  keyHeld: number
  keyMissing: number
}

/** Scan cadence: hot while the user's watch window is open, backing off to an idle sweep afterwards. */
export interface DepositScanPolicy {
  watchScanSeconds: number
  idleScanSeconds: number
}

export interface DepositImportRejection {
  line: number
  address: string
  reason: 'invalid_address' | 'duplicate_in_upload' | 'already_in_pool'
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
              COUNT(*) FILTER (WHERE state = 'retired')::int AS retired,
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
      retired: Number(row.retired ?? 0),
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

  /** Generation is retired: the operator uploads addresses whose keys they hold offline. */
  async generate(): Promise<never> {
    throw new BadRequestException({
      code: WALLET_ERROR_CODES.ADDRESS_POOL_GENERATION_DISABLED,
      message: 'Generating deposit addresses is disabled. Upload operator-held addresses instead.',
    })
  }

  /**
   * Uploads operator-held TRON addresses (address only; private keys are never stored).
   * Valid new addresses are inserted in upload order, which is the order users receive them.
   */
  async importAddresses(
    adminId: string,
    input: { network: WalletNetwork; address?: string; addresses?: string[]; label?: string },
    requestId: string,
  ): Promise<{ imported: number; rejected: DepositImportRejection[] }> {
    this.assertManagedNetwork(input.network)
    const submitted = [...(input.addresses ?? []), ...(input.address ? [input.address] : [])].map((value) => value.trim())
    if (!submitted.some(Boolean)) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.ADDRESS_INVALID, message: 'Provide at least one TRON address to upload.' })
    }
    if (submitted.length > MAX_IMPORT_COUNT) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.ADDRESS_INVALID, message: `Upload at most ${MAX_IMPORT_COUNT} addresses at a time.` })
    }
    const rejected: DepositImportRejection[] = []
    const accepted: Array<{ line: number; address: string; hash: Buffer }> = []
    const seen = new Set<string>()
    submitted.forEach((address, index) => {
      if (!address) return
      if (!isValidTronAddress(address)) rejected.push({ line: index + 1, address, reason: 'invalid_address' })
      else if (seen.has(address)) rejected.push({ line: index + 1, address, reason: 'duplicate_in_upload' })
      else {
        seen.add(address)
        accepted.push({ line: index + 1, address, hash: this.crypto.hmac(address) })
      }
    })
    const existing = accepted.length
      ? await this.dataSource.query(
        `SELECT address_hash FROM app.deposit_pool_addresses WHERE network = $1 AND address_hash = ANY($2::bytea[])`,
        [input.network, accepted.map((row) => row.hash)],
      ) as Array<{ address_hash: Buffer }>
      : []
    const present = new Set(existing.map((row) => Buffer.from(row.address_hash).toString('hex')))
    const fresh = accepted.filter((row) => {
      if (!present.has(row.hash.toString('hex'))) return true
      rejected.push({ line: row.line, address: row.address, reason: 'already_in_pool' })
      return false
    })
    // Millisecond-spaced created_at keeps the upload order as the assignment order.
    const base = Date.now()
    const rows = fresh.map((row, index) => this.buildRow({
      network: input.network,
      address: row.address,
      privateKeyHex: null,
      source: 'imported',
      label: input.label?.trim() || null,
      adminId,
      now: new Date(base + index),
    }))
    if (rows.length) {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(DepositPoolAddress).save(rows)
      })
    }
    rejected.sort((left, right) => left.line - right.line)
    await this.audit(adminId, requestId, 'wallet.deposit_pool.imported', null, { network: input.network, imported: rows.length, rejected: rejected.length })
    return { imported: rows.length, rejected }
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
   * Returns the user's current deposit address, assigning one atomically when needed.
   * Once the current address has received a deposit, the next available address (upload
   * order, uploaded addresses before legacy generated ones) becomes current and the old one
   * is retired: still bound to the same user and still watched, so late transfers credit them.
   * When the pool is empty the current address keeps being used. Returns null only when the
   * user has no address and none is available.
   */
  async assignForUser(network: WalletNetwork, userId: string): Promise<{ id: string; address: string; rotated: boolean } | null> {
    this.assertManagedNetwork(network)
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.query(
        `SELECT id, address_hash, address_ciphertext, encryption_key_version
           FROM app.deposit_pool_addresses
          WHERE network = $1 AND state = 'assigned' AND assigned_user_id = $2
          FOR UPDATE`,
        [network, userId],
      ) as Array<Record<string, unknown>>
      const current = existing[0] ?? null
      let assigned = current
      let rotated = false
      if (!current || await this.hasReceivedDeposit(manager, network, current.address_hash as Buffer)) {
        const candidate = await this.lockNextAvailable(manager, network)
        if (candidate) {
          // Retire before assigning: the partial unique index allows one 'assigned' row per user.
          if (current) {
            await manager.query(
              `UPDATE app.deposit_pool_addresses SET state = 'retired', retired_at = now() WHERE id = $1`,
              [current.id],
            )
          }
          assigned = await this.assignCandidate(manager, candidate, userId)
          rotated = Boolean(current)
          await this.auditLogs.insert({
            id: randomUUID(),
            actorType: 'service',
            actorId: null,
            userId,
            action: rotated ? 'wallet.deposit_pool.rotated' : 'wallet.deposit_pool.assigned',
            objectType: 'deposit_pool_address',
            objectId: candidate,
            requestId: 'deposit-pool-assignment',
            reasonCode: null,
            metadata: { network, ...(rotated ? { retiredId: current?.id } : {}) } as never,
          })
        }
      }
      if (!assigned) return null
      const address = this.crypto.decrypt(
        Buffer.isBuffer(assigned.address_ciphertext) ? assigned.address_ciphertext : Buffer.from(assigned.address_ciphertext as Uint8Array),
        Number(assigned.encryption_key_version),
      )
      return { id: assigned.id as string, address, rotated }
    })
  }

  /**
   * Opens (or extends) the user's watch window and asks the watcher to scan soon. Re-scans of
   * the same address are spaced by at least 20 seconds so "check now" cannot hammer the provider.
   */
  async startWatch(network: WalletNetwork, userId: string, minutes: number): Promise<{ watchUntil: Date; nextScanAt: Date } | null> {
    const raw = await this.dataSource.query(
      `UPDATE app.deposit_pool_addresses
          SET watch_until = GREATEST(COALESCE(watch_until, now()), now() + make_interval(mins => $3::int)),
              next_scan_at = CASE
                WHEN last_scan_at IS NOT NULL AND last_scan_at > now() - interval '20 seconds'
                  THEN LEAST(COALESCE(next_scan_at, now()), last_scan_at + interval '20 seconds')
                ELSE now() END
        WHERE network = $1 AND assigned_user_id = $2
          AND (state = 'assigned' OR (state = 'retired' AND retired_at > now() - interval '24 hours'))
        RETURNING state, watch_until AS "watchUntil", next_scan_at AS "nextScanAt"`,
      [network, userId, Math.trunc(minutes)],
    )
    const rows = (Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number' ? raw[0] : raw) as Array<{ state: string; watchUntil: Date; nextScanAt: Date }>
    const current = rows.find((row) => row.state === 'assigned')
    return current ? { watchUntil: current.watchUntil, nextScanAt: current.nextScanAt } : null
  }

  private async hasReceivedDeposit(manager: QueryManager, network: WalletNetwork, addressHash: Buffer): Promise<boolean> {
    const rows = await manager.query(
      `SELECT EXISTS (
         SELECT 1 FROM app.deposits d
           JOIN app.wallet_addresses a ON a.id = d.wallet_address_id
          WHERE a.network = $1 AND a.address_hash = $2 AND d.state <> 'rejected'
       ) AS "used"`,
      [network, addressHash],
    ) as Array<{ used: boolean }>
    return rows[0]?.used === true
  }

  private async lockNextAvailable(manager: QueryManager, network: WalletNetwork): Promise<string | null> {
    const rows = await manager.query(
      `SELECT id FROM app.deposit_pool_addresses
        WHERE network = $1 AND state = 'available'
        ORDER BY (source = 'imported') DESC, created_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
      [network],
    ) as Array<{ id: string }>
    return rows[0]?.id ?? null
  }

  private async assignCandidate(manager: QueryManager, id: string, userId: string) {
    const raw = await manager.query(
      `UPDATE app.deposit_pool_addresses
          SET state = 'assigned', assigned_user_id = $2, assigned_at = now(), next_scan_at = NULL
        WHERE id = $1 AND state = 'available'
        RETURNING id, address_ciphertext, encryption_key_version`,
      [id, userId],
    )
    // TypeORM's PostgreSQL UPDATE result is [rows, affectedCount], unlike SELECT.
    const rows = Array.isArray(raw) && raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number'
      ? raw[0] as Array<Record<string, unknown>>
      : raw as Array<Record<string, unknown>>
    if (!rows[0]) throw new ConflictException({ code: WALLET_ERROR_CODES.ADDRESS_POOL_CONFLICT, message: 'The deposit address was claimed concurrently; please retry.' })
    return rows[0]
  }

  /**
   * Addresses due for a scan: current and retired addresses whose next_scan_at has passed
   * (NULL = never scheduled), open watch windows first.
   */
  async listForScan(limit: number): Promise<ScanCandidate[]> {
    const rows = await this.dataSource.query(
      `SELECT id, network, address_ciphertext, encryption_key_version, last_seen_timestamp,
              (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS created_at_ms
         FROM app.deposit_pool_addresses
        WHERE state IN ('assigned', 'retired') AND network = 'tron'
          AND (next_scan_at IS NULL OR next_scan_at <= now())
        ORDER BY (watch_until IS NOT NULL AND watch_until > now()) DESC, next_scan_at ASC NULLS FIRST, last_scan_at ASC NULLS FIRST
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

  /**
   * Records a successful scan and schedules the next one: every watchScanSeconds while the
   * watch window is open, then 5 min (<1h after), 15 min (<6h), 1 h (<24h), else the idle sweep.
   */
  async markScanned(id: string, cursorMs: number | null, policy: DepositScanPolicy): Promise<void> {
    await this.dataSource.query(
      `UPDATE app.deposit_pool_addresses
          SET last_scan_at = now(),
              last_seen_timestamp = CASE WHEN $2::bigint IS NULL THEN last_seen_timestamp
                                         WHEN last_seen_timestamp IS NULL THEN $2::bigint
                                         ELSE GREATEST(last_seen_timestamp, $2::bigint) END,
              next_scan_at = now() + CASE
                WHEN watch_until > now() THEN make_interval(secs => $3::int)
                WHEN watch_until > now() - interval '1 hour' THEN interval '5 minutes'
                WHEN watch_until > now() - interval '6 hours' THEN interval '15 minutes'
                WHEN watch_until > now() - interval '24 hours' THEN interval '1 hour'
                ELSE make_interval(secs => $4::int) END
        WHERE id = $1`,
      [id, cursorMs, Math.trunc(policy.watchScanSeconds), Math.trunc(policy.idleScanSeconds)],
    )
  }

  /** A non-rate-limit scan failure: keep the cursor, retry in two minutes instead of every tick. */
  async markScanFailed(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE app.deposit_pool_addresses SET next_scan_at = now() + interval '2 minutes' WHERE id = $1`,
      [id],
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
      retiredAt: null,
      watchUntil: null,
      nextScanAt: null,
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
      retiredAt: row.retiredAt,
      watchUntil: row.watchUntil,
      nextScanAt: row.nextScanAt,
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
