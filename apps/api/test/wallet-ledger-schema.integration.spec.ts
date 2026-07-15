import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../src/database/database-options'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('wallet and ledger schema', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    await dataSource.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  async function createLedgerFixture(queryable: DataSource | QueryRunner) {
    const [user] = await queryable.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [available] = await queryable.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('user', $1, 'available', 'USDT', 6, 'credit') RETURNING id`,
      [user.id],
    )
    const [settlement] = await queryable.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('platform', $1, 'settlement', 'USDT', 6, 'debit') RETURNING id`,
      [`treasury:${randomUUID()}`],
    )
    return { user, available, settlement }
  }

  it('posts exact smallest-unit amounts and produces immutable balance snapshots', async () => {
    const queryRunner = dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const { available, settlement } = await createLedgerFixture(queryRunner)
      const [transaction] = await queryRunner.query(
        `INSERT INTO app.ledger_transactions
          (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
         VALUES ('deposit', $1, 'request-db003-deposit', 'deposit', $2, 'service', now()) RETURNING id`,
        [`deposit:${randomUUID()}`, randomUUID()],
      )
      await queryRunner.query(
        `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
         VALUES ($1, $2, 'debit', 12500001), ($1, $3, 'credit', 12500001)`,
        [transaction.id, settlement.id, available.id],
      )
      await queryRunner.commitTransaction()

      const [balance] = await dataSource.query(
        `SELECT current_atomic_balance::text AS amount
         FROM app.ledger_account_balances WHERE account_id = $1`,
        [available.id],
      )
      expect(balance.amount).toBe('12500001')

      const snapshots = await dataSource.query(
        `SELECT atomic_balance::text AS amount
         FROM app.balance_snapshots WHERE account_id = $1`,
        [available.id],
      )
      expect(snapshots).toEqual([{ amount: '12500001' }])
      await expect(
        dataSource.query(`UPDATE app.ledger_entries SET atomic_amount = 1 WHERE transaction_id = $1`, [transaction.id]),
      ).rejects.toMatchObject({ code: '55000' })
    } finally {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
      await queryRunner.release()
    }
  })

  it('rejects fractional smallest-unit amounts instead of rounding them', async () => {
    const queryRunner = dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const { available, settlement } = await createLedgerFixture(queryRunner)
      const [transaction] = await queryRunner.query(
        `INSERT INTO app.ledger_transactions
          (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
         VALUES ('deposit', $1, 'request-db003-fraction', 'deposit', $2, 'service', now()) RETURNING id`,
        [`deposit:${randomUUID()}`, randomUUID()],
      )
      await expect(
        queryRunner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', 1.5), ($1, $3, 'credit', 1.5)`,
          [transaction.id, settlement.id, available.id],
        ),
      ).rejects.toMatchObject({ code: '23514' })
    } finally {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
      await queryRunner.release()
    }
  })

  it('rejects an unbalanced voucher at the transaction boundary', async () => {
    const queryRunner = dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const { settlement } = await createLedgerFixture(queryRunner)
      const [transaction] = await queryRunner.query(
        `INSERT INTO app.ledger_transactions
          (transaction_type, idempotency_key, request_id, reference_type, reference_id, reason_code, actor_type, effective_at)
         VALUES ('adjustment', $1, 'request-db003-unbalanced', 'adjustment', $2, 'unbalanced-test', 'admin', now()) RETURNING id`,
        [`adjustment:${randomUUID()}`, randomUUID()],
      )
      await queryRunner.query(
        `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
         VALUES ($1, $2, 'debit', 1)`,
        [transaction.id, settlement.id],
      )
      await expect(queryRunner.commitTransaction()).rejects.toMatchObject({ code: '23514' })
    } finally {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
      await queryRunner.release()
    }
  })

  it('atomically prevents a user available balance from becoming negative', async () => {
    const queryRunner = dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const { available, settlement } = await createLedgerFixture(queryRunner)
      const [transaction] = await queryRunner.query(
        `INSERT INTO app.ledger_transactions
          (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
         VALUES ('withdrawal_lock', $1, 'request-db003-overdraft', 'withdrawal', $2, 'user', now()) RETURNING id`,
        [`withdrawal:${randomUUID()}`, randomUUID()],
      )
      await expect(
        queryRunner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', 1), ($1, $3, 'credit', 1)`,
          [transaction.id, available.id, settlement.id],
        ),
      ).rejects.toMatchObject({ code: '23514' })
    } finally {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()
      await queryRunner.release()
    }
  })

  it('deduplicates chain deposits and user withdrawal requests', async () => {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const providerReference = randomUUID()
    const [wallet] = await dataSource.query(
      `INSERT INTO app.custody_wallets
        (user_id, provider, provider_wallet_hash, provider_wallet_ciphertext, encryption_key_version, state, activated_at)
       VALUES ($1, 'custody-adapter', $2, $3, 1, 'active', now()) RETURNING id`,
      [user.id, Buffer.from(`hash:${providerReference}`), Buffer.from(`cipher:${providerReference}`)],
    )
    const addressReference = randomUUID()
    const [address] = await dataSource.query(
      `INSERT INTO app.wallet_addresses
        (wallet_id, user_id, network, asset_code, asset_decimals, address_hash, address_ciphertext, encryption_key_version)
       VALUES ($1, $2, 'arbitrum', 'USDT', 6, $3, $4, 1) RETURNING id`,
      [wallet.id, user.id, Buffer.from(`hash:${addressReference}`), Buffer.from(`cipher:${addressReference}`)],
    )
    const [chainTransaction] = await dataSource.query(
      `INSERT INTO app.chain_transactions (network, transaction_hash)
       VALUES ('arbitrum', $1) RETURNING id`,
      [`0x${randomUUID().replaceAll('-', '')}`],
    )

    await dataSource.query(
      `INSERT INTO app.deposits
        (user_id, wallet_address_id, chain_transaction_id, asset_code, asset_decimals, atomic_amount, required_confirmations)
       VALUES ($1, $2, $3, 'USDT', 6, 1000000, 12)`,
      [user.id, address.id, chainTransaction.id],
    )
    await expect(
      dataSource.query(
        `INSERT INTO app.deposits
          (user_id, wallet_address_id, chain_transaction_id, asset_code, asset_decimals, atomic_amount, required_confirmations)
         VALUES ($1, $2, $3, 'USDT', 6, 1000000, 12)`,
        [user.id, address.id, chainTransaction.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })

    const withdrawalKey = `withdrawal:${randomUUID()}`
    const withdrawalValues = [
      user.id,
      wallet.id,
      Buffer.from(`hash:${randomUUID()}`),
      Buffer.from(`cipher:${randomUUID()}`),
      withdrawalKey,
    ]
    await dataSource.query(
      `INSERT INTO app.withdrawals
        (user_id, wallet_id, network, asset_code, asset_decimals, atomic_amount,
         destination_hash, destination_ciphertext, encryption_key_version, idempotency_key)
       VALUES ($1, $2, 'arbitrum', 'USDT', 6, 500000, $3, $4, 1, $5)`,
      withdrawalValues,
    )
    await expect(
      dataSource.query(
        `INSERT INTO app.withdrawals
          (user_id, wallet_id, network, asset_code, asset_decimals, atomic_amount,
           destination_hash, destination_ciphertext, encryption_key_version, idempotency_key)
         VALUES ($1, $2, 'arbitrum', 'USDT', 6, 500000, $3, $4, 1, $5)`,
        withdrawalValues,
      ),
    ).rejects.toMatchObject({ code: '23505' })

    const [otherUser] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    await expect(
      dataSource.query(
        `INSERT INTO app.withdrawals
          (user_id, wallet_id, network, asset_code, asset_decimals, atomic_amount,
           destination_hash, destination_ciphertext, encryption_key_version, idempotency_key)
         VALUES ($1, $2, 'arbitrum', 'USDT', 6, 500000, $3, $4, 1, $5)`,
        [
          otherUser.id,
          wallet.id,
          Buffer.from(`hash:${randomUUID()}`),
          Buffer.from(`cipher:${randomUUID()}`),
          `withdrawal:${randomUUID()}`,
        ],
      ),
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('enforces withdrawal address-book state and one decision per administrator', async () => {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [device] = await dataSource.query(
      `INSERT INTO app.devices (user_id, fingerprint_hash, trust_state, trusted_at)
       VALUES ($1, $2, 'trusted', now()) RETURNING id`,
      [user.id, Buffer.from(`device:${randomUUID()}`)],
    )
    const addressHash = Buffer.from(`address:${randomUUID()}`)
    const [addressBook] = await dataSource.query(
      `INSERT INTO app.withdrawal_address_book
        (id, user_id, network, label, address_hash, address_ciphertext,
         encryption_key_version, state, risk_state, cooldown_until,
         created_from_device_id, activated_at)
       VALUES ($1, $2, 'arbitrum', 'Treasury', $3, $4, 1, 'active', 'clear', now(), $5, now())
       RETURNING id`,
      [randomUUID(), user.id, addressHash, Buffer.from('ciphertext'), device.id],
    )
    await expect(dataSource.query(
      `INSERT INTO app.withdrawal_address_book
        (id, user_id, network, label, address_hash, address_ciphertext,
         encryption_key_version, state, risk_state, cooldown_until)
       VALUES ($1, $2, 'arbitrum', 'Duplicate', $3, $4, 1, 'pending', 'clear', now())`,
      [randomUUID(), user.id, addressHash, Buffer.from('ciphertext-2')],
    )).rejects.toMatchObject({ code: '23505' })

    const [wallet] = await dataSource.query(
      `INSERT INTO app.custody_wallets
        (user_id, provider, provider_wallet_hash, provider_wallet_ciphertext,
         encryption_key_version, state, activated_at)
       VALUES ($1, 'live-custody', $2, $3, 1, 'active', now()) RETURNING id`,
      [user.id, Buffer.from(`hash:${randomUUID()}`), Buffer.from('wallet-ciphertext')],
    )
    const [withdrawal] = await dataSource.query(
      `INSERT INTO app.withdrawals
        (user_id, wallet_id, network, asset_code, asset_decimals, atomic_amount,
         destination_hash, destination_ciphertext, encryption_key_version,
         address_book_entry_id, state, idempotency_key)
       VALUES ($1, $2, 'arbitrum', 'USDT', 6, 1000000, $3, $4, 1, $5, 'risk_review', $6)
       RETURNING id`,
      [user.id, wallet.id, Buffer.from('destination-hash'), Buffer.from('destination-ciphertext'), addressBook.id, `withdrawal:${randomUUID()}`],
    )
    const roleName = `finance-${randomUUID()}`
    const [role] = await dataSource.query(
      `INSERT INTO app.admin_roles (name, description) VALUES ($1, 'test') RETURNING id`,
      [roleName],
    )
    const [admin] = await dataSource.query(
      `INSERT INTO app.admin_users (email, role_id) VALUES ($1, $2) RETURNING id`,
      [`${randomUUID()}@example.com`, role.id],
    )
    await dataSource.query(
      `INSERT INTO app.withdrawal_approval_decisions
        (id, withdrawal_id, admin_user_id, decision)
       VALUES ($1, $2, $3, 'approved')`,
      [randomUUID(), withdrawal.id, admin.id],
    )
    await expect(dataSource.query(
      `INSERT INTO app.withdrawal_approval_decisions
        (id, withdrawal_id, admin_user_id, decision)
       VALUES ($1, $2, $3, 'approved')`,
      [randomUUID(), withdrawal.id, admin.id],
    )).rejects.toMatchObject({ code: '23505' })
  })

  it('enforces four-eyes decisions for funds execution resume requests', async () => {
    const [role] = await dataSource.query(
      `INSERT INTO app.admin_roles (name, description) VALUES ($1, 'funds switch test') RETURNING id`,
      [`funds-switch-${randomUUID()}`],
    )
    const [requester] = await dataSource.query(
      `INSERT INTO app.admin_users (email, role_id) VALUES ($1, $2) RETURNING id`,
      [`${randomUUID()}@example.com`, role.id],
    )
    const [approver] = await dataSource.query(
      `INSERT INTO app.admin_users (email, role_id) VALUES ($1, $2) RETURNING id`,
      [`${randomUUID()}@example.com`, role.id],
    )
    const [request] = await dataSource.query(
      `INSERT INTO app.operational_switch_change_requests
        (switch_key, requested_state, requested_by, change_id, reason, request_id)
       VALUES ('wallet.withdrawals.execution', true, $1, $2, 'rehearsal complete', $3)
       RETURNING id`,
      [requester.id, `CHG-${randomUUID()}`, `request-${randomUUID()}`],
    )

    await expect(dataSource.query(
      `UPDATE app.operational_switch_change_requests
          SET state = 'approved', decided_by = $2, decided_at = now()
        WHERE id = $1`,
      [request.id, requester.id],
    )).rejects.toMatchObject({ code: '23514' })

    await expect(dataSource.query(
      `UPDATE app.operational_switch_change_requests
          SET state = 'approved', decided_by = $2, decided_at = now()
        WHERE id = $1`,
      [request.id, approver.id],
    )).resolves.toBeDefined()
  })
})
