import { DEVICE_SQL, MONEY_SQL, NotificationFeedWorker } from '../../src/notification/notification-feed.worker'

function worker(lockOk: boolean, rows: { money: unknown[]; devices: unknown[] }) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('pg_try_advisory_xact_lock')) return [{ ok: lockOk }]
    return sql === MONEY_SQL ? rows.money : rows.devices
  })
  const db = { transaction: jest.fn(async (fn: (tx: { query: typeof query }) => unknown) => fn({ query })) }
  const config = { get: jest.fn().mockReturnValue(undefined) }
  return { w: new NotificationFeedWorker(db as never, config as never), query }
}

describe('NotificationFeedWorker', () => {
  it('runs both feeds under the lock', async () => {
    const { w, query } = worker(true, { money: [{ id: 'a' }, { id: 'b' }], devices: [{ id: 'c' }] })
    await w.tick()
    expect(query).toHaveBeenCalledWith(MONEY_SQL)
    expect(query).toHaveBeenCalledWith(DEVICE_SQL)
  })

  it('does nothing when another instance holds the lock', async () => {
    const { w, query } = worker(false, { money: [], devices: [] })
    await w.tick()
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('dedupes by source key, keeps locale values the table accepts and makes no return promises', () => {
    for (const sql of [MONEY_SQL, DEVICE_SQL]) {
      expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM app\.notifications n WHERE n\.recipient_user_id = d\.user_id AND n\.payload->>'sourceKey'/)
      expect(sql).not.toMatch(/'zh-CN'/)
      expect(sql).not.toMatch(/保证|稳赚|guarantee/i)
    }
  })
})
