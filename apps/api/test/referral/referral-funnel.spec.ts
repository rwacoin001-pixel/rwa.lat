import type { DataSource } from 'typeorm'
import { ReferralReadService } from '../../src/referral/referral-read.service'

/** A DataSource stand-in that records each query and answers from a script. */
function fakeDb(answer: (sql: string) => unknown[]) {
  const calls: Array<{ sql: string; args: unknown[] }> = []
  const db = { query: async (sql: string, args: unknown[] = []) => { calls.push({ sql, args }); return answer(sql) } }
  return { db: db as unknown as DataSource, calls }
}

const answers = (sql: string) => {
  if (sql.includes('to_regclass')) return [{ installed: true, ready: true }]
  if (sql.includes('referral_attributions')) return [{ recent: 7, total: 12 }]
  if (sql.includes('referral_quant_first_subscriptions')) return [{ recent: 1, total: 1 }]
  if (sql.includes('referral_edges')) return [{ recent: 2, total: 3 }]
  return []
}

describe('referral funnel', () => {
  it('counts opens, sign-ups and first subscriptions for one inviter, last 30 days and all time', async () => {
    const { db, calls } = fakeDb(answers)
    const result = await new ReferralReadService(db).funnel('user-1')
    expect(result).toEqual({ opened: { last30d: 7, all: 12 }, registered: { last30d: 2, all: 3 }, subscribed: { last30d: 1, all: 1 } })
    const counts = calls.filter((call) => /count\(\*\)/.test(call.sql))
    expect(counts).toHaveLength(3)
    for (const call of counts) {
      expect(call.args).toEqual(['user-1'])
      expect(call.sql).toMatch(/inviter_user_id=\$1/)
      expect(call.sql).toMatch(/interval '30 days'/)
    }
    // Only numbers leave the service: no ids, codes or labels.
    expect(JSON.stringify(result)).not.toMatch(/user|code|label/i)
  })

  it('counts the whole platform for admins (no user filter, no parameters)', async () => {
    const { db, calls } = fakeDb(answers)
    await new ReferralReadService(db).funnel(null)
    for (const call of calls.filter((c) => /count\(\*\)/.test(c.sql))) {
      expect(call.args).toEqual([])
      expect(call.sql).not.toMatch(/\$1/)
      expect(call.sql).toMatch(/WHERE true/)
    }
  })

  it('reports zero first subscriptions before that table exists', async () => {
    const { db, calls } = fakeDb((sql) => sql.includes("referral_quant_first_subscriptions') IS NOT NULL") ? [{ ready: false }] : answers(sql))
    const result = await new ReferralReadService(db).funnel('user-1')
    expect(result.subscribed).toEqual({ last30d: 0, all: 0 })
    expect(calls.some((call) => /FROM app\.referral_quant_first_subscriptions/.test(call.sql))).toBe(false)
  })
})
