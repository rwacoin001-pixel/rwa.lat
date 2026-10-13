import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import type { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { AuditLog } from '../../src/security/audit-log.entity'
import { DepositPoolService } from '../../src/wallet/manual/deposit-pool.service'
import { DepositPoolAddress } from '../../src/wallet/manual/manual-custody.entities'
import { generateTronKeypair } from '../../src/wallet/manual/tron-address.util'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

// Deterministic stand-in for the identity keyring: hmac = sha256, "encryption" = plaintext bytes.
const crypto = {
  hmac: (value: string) => createHash('sha256').update(value).digest(),
  encrypt: (value: string) => ({ ciphertext: Buffer.from(value, 'utf8'), keyVersion: 1 }),
  decrypt: (value: Buffer) => Buffer.from(value).toString('utf8'),
} as unknown as IdentityCrypto

const ADMIN = '00000000-0000-4000-8000-000000000001'
const policy = { watchScanSeconds: 30, idleScanSeconds: 6 * 3600 }

describeDatabase('deposit address rotation (PostgreSQL)', () => {
  let db: DataSource
  let pools: DepositPoolService

  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    await db.runMigrations({ transaction: 'all' })
    await db.query(`DELETE FROM app.deposit_pool_addresses`)
    pools = new DepositPoolService(db.getRepository(DepositPoolAddress), db.getRepository(AuditLog), db, crypto)
  })

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy()
  })

  const fresh = () => generateTronKeypair().address

  async function createUser() {
    const [user] = await db.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    return user.id as string
  }

  /** A deposit observed on `address` for `userId` (wallet address hash matches the pool row). */
  async function depositTo(userId: string, address: string, state = 'confirming') {
    let [wallet] = await db.query(`SELECT id FROM app.custody_wallets WHERE user_id = $1`, [userId])
    if (!wallet) {
      [wallet] = await db.query(
        `INSERT INTO app.custody_wallets (user_id, provider, provider_wallet_hash, provider_wallet_ciphertext, encryption_key_version, state, activated_at)
         VALUES ($1, 'manual-custody', $2, $2, 1, 'active', now()) RETURNING id`,
        [userId, randomBytes(32)],
      )
    }
    let [walletAddress] = await db.query(`SELECT id FROM app.wallet_addresses WHERE network = 'tron' AND address_hash = $1`, [crypto.hmac(address)])
    if (!walletAddress) {
      [walletAddress] = await db.query(
        `INSERT INTO app.wallet_addresses (wallet_id, user_id, network, asset_code, asset_decimals, address_hash, address_ciphertext, encryption_key_version)
         VALUES ($1, $2, 'tron', 'USDT', 6, $3, $4, 1) RETURNING id`,
        [wallet.id, userId, crypto.hmac(address), Buffer.from(address)],
      )
    }
    const [chain] = await db.query(
      `INSERT INTO app.chain_transactions (network, transaction_hash, state, confirmation_count, raw_reference)
       VALUES ('tron', $1, 'confirming', 1, $2) RETURNING id`,
      [randomBytes(32).toString('hex'), JSON.stringify({ eventId: `test:${randomUUID()}` })],
    )
    await db.query(
      `INSERT INTO app.deposits (user_id, wallet_address_id, chain_transaction_id, asset_code, asset_decimals, atomic_amount, required_confirmations, state, reason_code)
       VALUES ($1, $2, $3, 'USDT', 6, '5000000', 20, $4, $5)`,
      [userId, walletAddress.id, chain.id, state, state === 'rejected' || state === 'manual_review' ? 'test_fixture' : null],
    )
  }

  async function row(address: string) {
    const [found] = await db.query(
      `SELECT state, assigned_user_id AS "userId", retired_at AS "retiredAt", watch_until AS "watchUntil", next_scan_at AS "nextScanAt", source
         FROM app.deposit_pool_addresses WHERE address_hash = $1`,
      [crypto.hmac(address)],
    )
    return found
  }

  it('uploads address-only rows in order and reports invalid, duplicate and existing lines', async () => {
    const legacy = fresh()
    // A legacy system-generated address that is older than every upload.
    await db.getRepository(DepositPoolAddress).save(db.getRepository(DepositPoolAddress).create({
      id: randomUUID(), network: 'tron', assetCode: 'USDT', assetDecimals: 6,
      addressHash: crypto.hmac(legacy), addressCiphertext: Buffer.from(legacy), privateKeyCiphertext: Buffer.from('k'),
      encryptionKeyVersion: 1, keyHeld: true, state: 'available', source: 'generated',
      assignedUserId: null, assignedAt: null, label: null, note: null, lastScanAt: null, lastSeenTimestamp: null,
      createdBy: ADMIN, createdAt: new Date(Date.now() - 86_400_000), disabledAt: null, disabledReason: null,
      retiredAt: null, watchUntil: null, nextScanAt: null,
    }))
    const [a1, a2, a3] = [fresh(), fresh(), fresh()]
    const result = await pools.importAddresses(ADMIN, { network: 'tron', addresses: [a1, 'not-an-address', a2, a1, a3, legacy] }, 'req-upload')
    expect(result.imported).toBe(3)
    expect(result.rejected).toEqual([
      { line: 2, address: 'not-an-address', reason: 'invalid_address' },
      { line: 4, address: a1, reason: 'duplicate_in_upload' },
      { line: 6, address: legacy, reason: 'already_in_pool' },
    ])
    const [stored] = await db.query(`SELECT count(*)::int AS n FROM app.deposit_pool_addresses WHERE source = 'imported' AND private_key_ciphertext IS NULL AND NOT key_held`)
    expect(stored.n).toBe(3)
    Object.assign(globalThis, { __pool: { legacy, a1, a2, a3 } })
  })

  it('refuses to generate addresses', async () => {
    await expect(pools.generate()).rejects.toMatchObject({ response: { code: 'WALLET_ADDRESS_POOL_GENERATION_DISABLED' } })
  })

  it('assigns uploaded addresses before legacy ones and keeps the same address until it receives a deposit', async () => {
    const { a1 } = (globalThis as any).__pool
    const user = await createUser()
    Object.assign(globalThis, { __user: user })
    const first = await pools.assignForUser('tron', user)
    expect(first).toMatchObject({ address: a1, rotated: false })
    const again = await pools.assignForUser('tron', user)
    expect(again).toMatchObject({ address: a1, rotated: false })
  })

  it('rotates to the next uploaded address after a deposit and keeps the old one bound to the user', async () => {
    const { a1, a2 } = (globalThis as any).__pool
    const user = (globalThis as any).__user
    await depositTo(user, a1)
    const next = await pools.assignForUser('tron', user)
    expect(next).toMatchObject({ address: a2, rotated: true })
    expect(await row(a1)).toMatchObject({ state: 'retired', userId: user })
    expect((await row(a1)).retiredAt).not.toBeNull()
    expect(await row(a2)).toMatchObject({ state: 'assigned', userId: user })
    // One current address per user is still enforced by the partial unique index.
    const [{ current }] = await db.query(`SELECT count(*)::int AS current FROM app.deposit_pool_addresses WHERE assigned_user_id = $1 AND state = 'assigned'`, [user])
    expect(current).toBe(1)
  })

  it('does not rotate on a rejected deposit', async () => {
    const { a2 } = (globalThis as any).__pool
    const user = (globalThis as any).__user
    await depositTo(user, a2, 'rejected')
    expect(await pools.assignForUser('tron', user)).toMatchObject({ address: a2, rotated: false })
  })

  it('falls back to legacy addresses, then keeps the current address when the pool is empty', async () => {
    const { a3, legacy } = (globalThis as any).__pool
    const user = await createUser()
    expect(await pools.assignForUser('tron', user)).toMatchObject({ address: a3, rotated: false })
    await depositTo(user, a3)
    expect(await pools.assignForUser('tron', user)).toMatchObject({ address: legacy, rotated: true })
    await depositTo(user, legacy)
    expect(await pools.assignForUser('tron', user)).toMatchObject({ address: legacy, rotated: false })
    const nobody = await createUser()
    expect(await pools.assignForUser('tron', nobody)).toBeNull()
  })

  it('opens a watch window and schedules current and recently retired addresses first', async () => {
    const { a1, a2 } = (globalThis as any).__pool
    const user = (globalThis as any).__user
    const watch = await pools.startWatch('tron', user, 60)
    expect(watch).not.toBeNull()
    const minutesAhead = (new Date(watch!.watchUntil).getTime() - Date.now()) / 60_000
    expect(minutesAhead).toBeGreaterThan(58)
    expect(minutesAhead).toBeLessThan(61)
    expect((await row(a1)).watchUntil).not.toBeNull() // retired within 24h is watched too
    const due = await pools.listForScan(50)
    const addresses = due.map((candidate) => candidate.address)
    expect(addresses.slice(0, 2).sort()).toEqual([a1, a2].sort())
  })

  it('schedules the next scan from the watch state', async () => {
    const { a2, a3 } = (globalThis as any).__pool
    const [{ id: watchedId }] = await db.query(`SELECT id FROM app.deposit_pool_addresses WHERE address_hash = $1`, [crypto.hmac(a2)])
    const [{ id: idleId }] = await db.query(`SELECT id FROM app.deposit_pool_addresses WHERE address_hash = $1`, [crypto.hmac(a3)])
    await pools.markScanned(watchedId, null, policy)
    await pools.markScanned(idleId, 1_700_000_000_000, policy)
    const watchedIn = (new Date((await row(a2)).nextScanAt).getTime() - Date.now()) / 1000
    const idleIn = (new Date((await row(a3)).nextScanAt).getTime() - Date.now()) / 3600_000
    expect(watchedIn).toBeGreaterThan(25)
    expect(watchedIn).toBeLessThan(35)
    expect(idleIn).toBeGreaterThan(5.9)
    expect(idleIn).toBeLessThan(6.1)
    const due = (await pools.listForScan(50)).map((candidate) => candidate.address)
    expect(due).not.toContain(a2)
    expect(due).not.toContain(a3)
  })

  it('spaces "check now" re-scans by at least 20 seconds', async () => {
    const { a2 } = (globalThis as any).__pool
    const user = (globalThis as any).__user
    await db.query(`UPDATE app.deposit_pool_addresses SET last_scan_at = now(), next_scan_at = now() + interval '30 seconds' WHERE address_hash = $1`, [crypto.hmac(a2)])
    const watch = await pools.startWatch('tron', user, 60)
    const nextIn = (new Date(watch!.nextScanAt).getTime() - Date.now()) / 1000
    expect(nextIn).toBeGreaterThan(15)
    expect(nextIn).toBeLessThan(21)
  })
})
