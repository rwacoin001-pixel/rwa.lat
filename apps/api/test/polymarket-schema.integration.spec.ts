import { createHash, randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../src/database/database-options'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('Polymarket integration schema', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    await dataSource.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  it('rejects invalid token tick sizes', async () => {
    const marketId = randomUUID()
    await dataSource.query(
      `INSERT INTO app.polymarket_market_mappings
        (id, gamma_market_id, condition_id, slug, question, state, enable_order_book, last_synced_at)
       VALUES ($1, $2, $3, $4, 'Schema test?', 'active', true, now())`,
      [marketId, `gamma-${marketId}`, `condition-${marketId}`, `schema-${marketId}`],
    )
    await expect(dataSource.query(
      `INSERT INTO app.polymarket_token_mappings
        (market_mapping_id, token_id, outcome, outcome_index, tick_size)
       VALUES ($1, $2, 'YES', 0, 2)`,
      [marketId, `token-${marketId}`],
    )).rejects.toMatchObject({ code: '23514' })
  })

  it('allows processing state changes but prevents event evidence mutation', async () => {
    const eventKey = randomUUID()
    const [event] = await dataSource.query(
      `INSERT INTO app.polymarket_external_events
        (channel, external_event_key, event_type, occurred_at, payload, payload_sha256)
       VALUES ('user', $1, 'order', now(), '{"status":"live"}', $2)
       RETURNING id`,
      [eventKey, createHash('sha256').update('evidence').digest()],
    )
    await dataSource.query(
      `UPDATE app.polymarket_external_events
          SET processing_state = 'processed', processed_at = now()
        WHERE id = $1`,
      [event.id],
    )
    await expect(dataSource.query(
      `UPDATE app.polymarket_external_events SET payload = '{"status":"filled"}' WHERE id = $1`,
      [event.id],
    )).rejects.toThrow('polymarket external event evidence is immutable')
  })
})
