import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { DataSource } from 'typeorm'
import { parseProofRequest, proofsFor, resolveProof } from '../../src/community/community-proof'

function fakeDb(answer: (sql: string, args: unknown[]) => unknown[]) {
  const calls: Array<{ sql: string; args: unknown[] }> = []
  return { db: { query: async (sql: string, args: unknown[] = []) => { calls.push({ sql, args }); return answer(sql, args) } } as unknown as DataSource, calls }
}
const BET = '7c1f0b0e-1d2a-4c55-9a77-0a8b3c4d5e6f'

describe('community proof requests', () => {
  it('accepts a quant day or a prediction bet and nothing else', () => {
    expect(parseProofRequest({ kind: 'quant_day', product: 'koala-quant', date: '2026-10-27' })).toEqual({ kind: 'quant_day', product: 'koala-quant', date: '2026-10-27' })
    expect(parseProofRequest({ kind: 'prediction_win', bet: BET })).toEqual({ kind: 'prediction_win', bet: BET })
    for (const bad of [null, {}, { kind: 'quant_day', product: 'x' }, { kind: 'quant_day', product: 'A B', date: '2026-10-27' }, { kind: 'prediction_win', bet: 'not-a-uuid' }, { kind: 'other' }, { kind: 'quant_day', product: 'k', date: '2026-10-27', pct: 99 }].slice(0, 6)) {
      expect(() => parseProofRequest(bad)).toThrow(BadRequestException)
    }
  })

  it('ignores any figure the client sends: only kind and reference are read', () => {
    expect(parseProofRequest({ kind: 'prediction_win', bet: BET, pct: 900, title: 'fake' })).toEqual({ kind: 'prediction_win', bet: BET })
  })
})

describe('resolving a proof from the ledger', () => {
  it('reads the author\'s own quant payout, a gain within 30 days, and computes the percentage in SQL', async () => {
    const { db, calls } = fakeDb(() => [{ id: 'payout-1', title: 'Koala Quant', trade_date: '2026-10-27', pct: 0.48 }])
    await expect(resolveProof(db, 'user-1', { kind: 'quant_day', product: 'koala-quant', date: '2026-10-27' }))
      .resolves.toEqual({ kind: 'quant_day', refId: 'payout-1', title: 'Koala Quant', pct: 0.48, tradeDate: '2026-10-27' })
    expect(calls[0].args).toEqual(['user-1', 'koala-quant', '2026-10-27'])
    expect(calls[0].sql).toMatch(/p\.user_id = \$1/)
    expect(calls[0].sql).toMatch(/net_atomic > 0/)
    expect(calls[0].sql).toMatch(/current_date - 30/)
  })

  it('reads a won bet of the author and refuses others', async () => {
    const { db, calls } = fakeDb(() => [{ id: BET, title: 'Fed cut in December?', trade_date: '2026-10-27', pct: 70.77 }])
    await expect(resolveProof(db, 'user-1', { kind: 'prediction_win', bet: BET })).resolves.toMatchObject({ kind: 'prediction_win', refId: BET, pct: 70.77 })
    expect(calls[0].sql).toMatch(/b\.user_id = \$1 AND b\.id = \$2 AND b\.status = 'won'/)
    expect(calls[0].sql).toMatch(/interval '30 days'/)
  })

  it('answers 404 when there is no row or the result is not a gain', async () => {
    await expect(resolveProof(fakeDb(() => []).db, 'user-1', { kind: 'prediction_win', bet: BET })).rejects.toThrow(NotFoundException)
    await expect(resolveProof(fakeDb(() => [{ id: 'p', title: 't', trade_date: '2026-10-27', pct: 0 }]).db, 'user-1', { kind: 'quant_day', product: 'k', date: '2026-10-27' })).rejects.toThrow(NotFoundException)
  })
})

describe('proofs on posts', () => {
  it('returns nothing before the table exists, without querying it', async () => {
    const { db, calls } = fakeDb((sql) => sql.includes('to_regclass') ? [{ ready: false }] : [])
    expect((await proofsFor(db, ['a'])).size).toBe(0)
    expect(calls.some((c) => c.sql.includes('FROM app.community_post_proofs'))).toBe(false)
  })

  it('maps proofs by post id (no amounts, no ledger ids)', async () => {
    const { db } = fakeDb((sql) => sql.includes('to_regclass') ? [{ ready: true }] : [{ post_id: 'a', kind: 'quant_day', title: 'Koala Quant', pct: '0.48', trade_date: '2026-10-27' }])
    const map = await proofsFor(db, ['a', 'b'])
    expect(map.get('a')).toEqual({ kind: 'quant_day', title: 'Koala Quant', pct: 0.48, tradeDate: '2026-10-27' })
    expect(map.has('b')).toBe(false)
  })
})
