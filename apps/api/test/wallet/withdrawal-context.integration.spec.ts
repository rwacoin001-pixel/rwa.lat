import { NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes, randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { WithdrawalContextService } from '../../src/wallet/withdrawal-context.service'
import { realDeposit } from './funds-security-fixture'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip
const USDT = 1_000_000n

describeDatabase('withdrawal risk context (PostgreSQL)', () => {
  let db: DataSource
  let crypto: IdentityCrypto
  let service: WithdrawalContextService

  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    await db.runMigrations({ transaction: 'all' })
    crypto = new IdentityCrypto(new ConfigService({ IDENTITY_HMAC_KEY: 'a'.repeat(64), IDENTITY_ENC_KEY: 'b'.repeat(64) }))
    service = new WithdrawalContextService(db, crypto)
  })

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy()
  })

  async function user(options: { email?: string; ageDays?: number } = {}) {
    const [row] = await db.query(`INSERT INTO app.users (created_at) VALUES (now() - make_interval(days => $1)) RETURNING id`, [options.ageDays ?? 0])
    if (options.email) {
      const encrypted = crypto.encrypt(options.email)
      await db.query(`INSERT INTO app.login_identities (user_id,kind,state,identifier_hash,identifier_ciphertext,encryption_key_version,verified_at)
        VALUES ($1,'email','verified',$2,$3,$4,now())`, [row.id, crypto.hashIdentifier(options.email), encrypted.ciphertext, encrypted.keyVersion])
    }
    return row.id as string
  }

  async function walletOf(userId: string) {
    let [wallet] = await db.query(`SELECT id FROM app.custody_wallets WHERE user_id=$1`, [userId])
    if (!wallet) [wallet] = await db.query(`INSERT INTO app.custody_wallets (user_id,provider,provider_wallet_hash,provider_wallet_ciphertext,encryption_key_version,state,activated_at)
      VALUES ($1,'manual-custody',$2,$2,1,'active',now()) RETURNING id`, [userId, randomBytes(32)])
    return wallet.id as string
  }

  async function withdraw(userId: string, address: string, atomic: bigint, state: 'risk_review' | 'completed' = 'risk_review') {
    const chainId = state === 'completed'
      ? (await db.query(`INSERT INTO app.chain_transactions (network,transaction_hash,state,confirmation_count,confirmed_at,raw_reference)
          VALUES ('tron',$1,'confirmed',30,now(),'{}') RETURNING id`, [randomBytes(32).toString('hex')]))[0].id
      : null
    const encrypted = crypto.encrypt(address)
    const [row] = await db.query(`INSERT INTO app.withdrawals (user_id,wallet_id,network,asset_code,asset_decimals,atomic_amount,destination_hash,destination_ciphertext,
        encryption_key_version,state,idempotency_key,chain_transaction_id,requested_at,completed_at)
      VALUES ($1,$2,'tron','USDT',6,$3,$4,$5,$6,$7,$8,$9,now() - CASE WHEN $7 = 'completed' THEN interval '1 day' ELSE interval '0' END,
        CASE WHEN $7 = 'completed' THEN now() - interval '1 day' END) RETURNING id`,
    [userId, await walletOf(userId), atomic.toString(), crypto.hmac(address), encrypted.ciphertext, encrypted.keyVersion, state, randomUUID(), chainId])
    return row.id as string
  }

  async function saveAddress(userId: string, address: string) {
    const encrypted = crypto.encrypt(address)
    await db.query(`INSERT INTO app.withdrawal_address_book (id,user_id,network,label,address_hash,address_ciphertext,encryption_key_version,state,risk_state,cooldown_until,activated_at)
      VALUES ($1,$2,'tron','saved',$3,$4,$5,'active','clear',now(),now())`, [randomUUID(), userId, crypto.hmac(address), encrypted.ciphertext, encrypted.keyVersion])
  }

  const tronAddress = () => `T${randomBytes(16).toString('hex')}`
  const codes = (signals: Array<{ code: string }>) => signals.map((signal) => signal.code).sort()

  it('flags a first withdrawal to a new address on a young account', async () => {
    const userId = await user({ email: 'first@example.test' })
    await realDeposit(db, userId, (10n * USDT).toString())
    const id = await withdraw(userId, tronAddress(), 3n * USDT)

    const context = await service.context(id)

    expect(context.user).toMatchObject({
      id: userId, email: 'first@example.test', accountAgeDays: 0, kycState: 'not_started',
      availableAtomic: (10n * USDT).toString(), lockedAtomic: '0',
      totalDepositedAtomic: (10n * USDT).toString(), totalWithdrawnAtomic: '0', withdrawalCount: 0,
      lastLoginAt: null, lastLoginCountry: null,
    })
    expect(context.address).toEqual({
      firstUsedByThisUser: true, previousWithdrawalsToAddress: 0, otherAccountsUsingAddress: 0,
      whitelisted: false, autoApproveWhitelisted: false,
    })
    expect(codes(context.signals)).toEqual(['first_withdrawal', 'kyc_not_approved', 'new_address', 'young_account'])
    for (const signal of context.signals) expect(signal.message).toMatch(/[一-鿿]/)
  })

  it('treats a repeat withdrawal to a saved, known address as routine and reports recent security changes', async () => {
    const userId = await user({ ageDays: 30 })
    const address = tronAddress()
    await realDeposit(db, userId, (100n * USDT).toString())
    await withdraw(userId, address, 10n * USDT, 'completed')
    await saveAddress(userId, address)
    await db.query(`INSERT INTO app.kyc_cases (user_id,state,provider,provider_case_hash,provider_case_ciphertext,encryption_key_version,submitted_at,decided_at)
      VALUES ($1,'approved','test',$2,$2,1,now(),now())`, [userId, randomBytes(32)])
    await db.query(`INSERT INTO app.devices (user_id,fingerprint_hash,first_seen_at) VALUES ($1,$2,now() - interval '20 days'), ($1,$3,now() - interval '1 hour')`,
      [userId, randomBytes(32), randomBytes(32)])
    await db.query(`INSERT INTO app.audit_logs (actor_type,actor_id,user_id,action,object_type,object_id,request_id)
      VALUES ('user',$1::uuid,$1::uuid,'security.password.changed','user',$2,'test')`, [userId, userId])
    const id = await withdraw(userId, address, 5n * USDT)

    const context = await service.context(id)

    expect(context.user).toMatchObject({ accountAgeDays: 30, kycState: 'approved', withdrawalCount: 1, totalWithdrawnAtomic: (10n * USDT).toString() })
    expect(context.address).toMatchObject({ firstUsedByThisUser: false, previousWithdrawalsToAddress: 1, otherAccountsUsingAddress: 0, whitelisted: true })
    expect(context.recentSecurity).toMatchObject({ passwordChanged24h: true, newDevice24h: true, twoFactorChanged24h: false })
    expect(codes(context.signals)).toEqual(['recent_new_device', 'recent_password_change'])
  })

  it('counts other accounts that withdrew to or saved the same address', async () => {
    const address = tronAddress()
    const earlier = await user({ ageDays: 40 })
    await withdraw(earlier, address, 1n * USDT, 'completed')
    await withdraw(earlier, address, 1n * USDT)
    await saveAddress(await user({ ageDays: 40 }), address)
    const userId = await user({ ageDays: 40 })
    await realDeposit(db, userId, (50n * USDT).toString())
    const id = await withdraw(userId, address, 2n * USDT)

    const context = await service.context(id)

    expect(context.address).toMatchObject({ firstUsedByThisUser: true, otherAccountsUsingAddress: 2 })
    expect(context.signals[0]).toMatchObject({ code: 'address_shared', level: 'high' })
  })

  it('flags a withdrawal of at least 80% of total deposits', async () => {
    const userId = await user({ ageDays: 40 })
    const address = tronAddress()
    await saveAddress(userId, address)
    await withdraw(userId, address, 1n * USDT, 'completed')
    await realDeposit(db, userId, (10n * USDT).toString())

    const small = await service.context(await withdraw(userId, address, 7n * USDT))
    expect(codes(small.signals)).not.toContain('large_vs_deposits')
    const atThreshold = await service.context(await withdraw(userId, address, 8n * USDT))
    expect(atThreshold.signals).toContainEqual(expect.objectContaining({ code: 'large_vs_deposits', level: 'warn' }))
  })

  it('returns 404 for an unknown withdrawal', async () => {
    await expect(service.context(randomUUID())).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.context('not-a-uuid')).rejects.toBeInstanceOf(NotFoundException)
  })
})
