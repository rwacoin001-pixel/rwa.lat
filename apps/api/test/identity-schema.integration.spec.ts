import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../src/database/database-options'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('identity and compliance schema', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    const applied = await dataSource.query(
      `SELECT name FROM schema_migrations WHERE name = 'CreateIdentityComplianceModel1783746000000'`,
    )
    if (applied.length > 0) await dataSource.undoLastMigration({ transaction: 'all' })
    await dataSource.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  it('prevents one login identity from belonging to multiple users', async () => {
    const [first] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [second] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const values = [Buffer.from('same-hmac'), Buffer.from('ciphertext'), 1]

    await dataSource.query(
      `INSERT INTO app.login_identities
        (user_id, kind, state, identifier_hash, identifier_ciphertext, encryption_key_version, verified_at)
       VALUES ($1, 'email', 'verified', $2, $3, $4, now())`,
      [first.id, ...values],
    )

    await expect(
      dataSource.query(
        `INSERT INTO app.login_identities
          (user_id, kind, state, identifier_hash, identifier_ciphertext, encryption_key_version, verified_at)
         VALUES ($1, 'email', 'verified', $2, $3, $4, now())`,
        [second.id, ...values],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('keeps KYC status separate from the versioned eligibility decision', async () => {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    await dataSource.query(
      `INSERT INTO app.kyc_cases
        (user_id, state, provider, provider_case_hash, provider_case_ciphertext, encryption_key_version, submitted_at)
       VALUES ($1, 'submitted', 'verity-pass', $2, $3, 1, now())`,
      [user.id, Buffer.from('case-hmac'), Buffer.from('case-ciphertext')],
    )
    await dataSource.query(
      `INSERT INTO app.eligibility_profiles (user_id, policy_version, product_scope, decision)
       VALUES ($1, 'initial-2026-01', 'prediction', 'manual_review')`,
      [user.id],
    )

    const [result] = await dataSource.query(
      `SELECT k.state AS kyc_state, e.decision
       FROM app.kyc_cases k JOIN app.eligibility_profiles e ON e.user_id = k.user_id
       WHERE k.user_id = $1`,
      [user.id],
    )
    expect(result).toEqual({ kyc_state: 'submitted', decision: 'manual_review' })
  })

  it('keeps verification history when a login identity is revoked', async () => {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [identity] = await dataSource.query(
      `INSERT INTO app.login_identities
        (user_id, kind, state, identifier_hash, identifier_ciphertext, encryption_key_version, verified_at)
       VALUES ($1, 'google', 'verified', $2, $3, 1, now()) RETURNING id`,
      [user.id, Buffer.from('google-hmac'), Buffer.from('google-ciphertext')],
    )

    await expect(
      dataSource.query(
        `UPDATE app.login_identities SET state = 'revoked', revoked_at = now() WHERE id = $1`,
        [identity.id],
      ),
    ).resolves.toBeDefined()
  })

  it('rejects invalid user states at the database boundary', async () => {
    await expect(dataSource.query(`INSERT INTO app.users (status) VALUES ('verified')`)).rejects.toMatchObject({
      code: '23514',
    })
  })

  it('rejects KYC states whose required timeline is incomplete', async () => {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    await expect(
      dataSource.query(
        `INSERT INTO app.kyc_cases
          (user_id, state, provider, provider_case_hash, provider_case_ciphertext, encryption_key_version)
         VALUES ($1, 'submitted', 'verity-pass', $2, $3, 1)`,
        [user.id, Buffer.from('missing-time-hmac'), Buffer.from('missing-time-ciphertext')],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })

  it('prevents a session from referencing another user device', async () => {
    const [first] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [second] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [device] = await dataSource.query(
      `INSERT INTO app.devices (user_id, fingerprint_hash) VALUES ($1, $2) RETURNING id`,
      [first.id, Buffer.from('device-hmac')],
    )

    await expect(
      dataSource.query(
        `INSERT INTO app.sessions (user_id, device_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + interval '1 hour')`,
        [second.id, device.id, Buffer.from('session-hmac')],
      ),
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('records consent changes as an immutable event chain', async () => {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [granted] = await dataSource.query(
      `INSERT INTO app.consents (user_id, document_type, document_version, granted, request_id)
       VALUES ($1, 'privacy', '2026-01', true, 'request-consent-1') RETURNING id`,
      [user.id],
    )
    await dataSource.query(
      `INSERT INTO app.consents
        (user_id, document_type, document_version, granted, request_id, supersedes_consent_id)
       VALUES ($1, 'privacy', '2026-01', false, 'request-consent-2', $2)`,
      [user.id, granted.id],
    )

    await expect(
      dataSource.query(`UPDATE app.consents SET granted = false WHERE id = $1`, [granted.id]),
    ).rejects.toMatchObject({ code: '55000' })
  })

  it('does not allow a versioned eligibility decision to be rewritten', async () => {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [profile] = await dataSource.query(
      `INSERT INTO app.eligibility_profiles (user_id, policy_version, product_scope, decision)
       VALUES ($1, 'initial-2026-01', 'rwa', 'browse_only') RETURNING id`,
      [user.id],
    )

    await expect(
      dataSource.query(`UPDATE app.eligibility_profiles SET decision = 'eligible' WHERE id = $1`, [profile.id]),
    ).rejects.toMatchObject({ code: '55000' })
  })

  it('does not allow audit records to be changed or deleted', async () => {
    const [record] = await dataSource.query(
      `INSERT INTO app.audit_logs (actor_type, action, object_type, request_id)
       VALUES ('service', 'kyc_submitted', 'kyc_case', 'request-1') RETURNING id`,
    )

    await expect(
      dataSource.query(`UPDATE app.audit_logs SET action = 'rewritten' WHERE id = $1`, [record.id]),
    ).rejects.toMatchObject({ code: '55000' })
    await expect(dataSource.query(`DELETE FROM app.audit_logs WHERE id = $1`, [record.id])).rejects.toMatchObject({
      code: '55000',
    })
    await expect(dataSource.query(`TRUNCATE app.audit_logs`)).rejects.toMatchObject({ code: '55000' })
  })
})
