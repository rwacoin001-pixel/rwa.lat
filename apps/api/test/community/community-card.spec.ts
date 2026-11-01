import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { DataSource } from 'typeorm'
import { cardKinds, cardPreview, cardRatio, cardSources, cardsFor, parseCardRequest, publicCardSnapshot, resolveCard } from '../../src/community/community-card'

const ID = '7c1f0b0e-1d2a-4c55-9a77-0a8b3c4d5e6f'
function fakeDb(answer: (sql: string, args: unknown[]) => unknown[]) {
  const query = jest.fn(async (sql: string, args: unknown[] = []) => answer(sql, args))
  return { db: { query } as unknown as DataSource, query }
}
describe('result card requests and privacy', () => {
  it('rejects client numbers, unknown fields, missing/extra sources and unknown kinds', () => {
    for (const value of [null, {}, { kind: 'other' }, { kind: 'quant_day' }, { kind: 'quant_total', sourceId: ID },
      { kind: 'deposit', sourceId: ID, amount: '123' },
      { kind: 'deposit', sourceId: Buffer.from(JSON.stringify({ id: ID })).toString('base64url') }]) expect(() => parseCardRequest(value)).toThrow(BadRequestException)
    expect(() => parseCardRequest({ kind: 'deposit', sourceId: ID, visibleFields: ['bad'] }, true)).toThrow('CARD_FIELD_INVALID')
    expect(() => parseCardRequest({ kind: 'deposit', sourceId: ID }, true)).toThrow('CARD_FIELD_INVALID')
  })
  it('allows a negative result and stores only selected values plus mandatory metadata', async () => {
    const { db } = fakeDb(() => [{ net: '-1250000', principal: '100000000', date: '2026-10-31', slug: 'koala', name: 'Koala' }])
    const full = await resolveCard(db, 'owner', { kind: 'quant_day', sourceId: ID })
    expect(full).toMatchObject({ pnl: '-1250000', returnPct: '-1.25', disclaimer: 'v1', asset: 'USDT', decimals: 6 })
    const snapshot = publicCardSnapshot('quant_day', full, ['returnPct'])
    expect(snapshot).toMatchObject({ returnPct: '-1.25', disclaimer: 'v1', provenance: 'ledger_verified' })
    for (const field of ['product', 'pnl', 'date', 'sourceId', 'source_refs']) expect(snapshot).not.toHaveProperty(field)
    expect(() => publicCardSnapshot('quant_day', full, [])).toThrow('CARD_NOTHING_VISIBLE')
    expect(() => publicCardSnapshot('quant_day', { ...full, returnPct: null }, ['returnPct'])).toThrow('CARD_NOTHING_VISIBLE')
    expect(() => publicCardSnapshot('quant_day', full, ['fake'])).toThrow('CARD_FIELD_INVALID')
  })
  it('keeps atomic integers beyond Number precision and uses null for zero denominators', () => {
    expect(cardRatio(-123456789012345678901234567890n, 1000000000000000000000000000000n)).toBe('-12.3456789')
    expect(cardRatio(1n, 3n)).toBe('33.33333333')
    expect(cardRatio(1n, 0n)).toBeNull()
    expect(cardRatio(124n, 1000n)).toBe('12.4')
    expect(cardRatio(1n, 4n, 1n)).toBe('0.25')
  })
  it.each(['quant_day', 'quant_product', 'prediction_bet', 'deposit', 'withdrawal'] as const)('requires authenticated ownership for %s', async kind => {
    const { db, query } = fakeDb(sql => sql.includes('WITH orders') ? [{ subscriptions: 0, product: null }] : [])
    await expect(resolveCard(db, 'stranger', { kind, sourceId: ID })).rejects.toThrow(NotFoundException)
    expect(query.mock.calls[0][1]).toEqual(['stranger', ID])
    expect(query.mock.calls[0][0]).toMatch(/user_id=\$1/)
  })
  it('does not issue a ledger query when reading a frozen card', async () => {
    const snapshot = { capturedAt: '2026-11-01T00:00:00.000Z', period: { from: null, to: null }, asset: 'USDT', decimals: 6,
      provenance: 'ledger_verified', pnl: '-100', disclaimer: 'v1' }
    const { db, query } = fakeDb(sql => sql.includes('to_regclass') ? [{ ready: true }] : [{ post_id: ID, kind: 'quant_total', snapshot, visible_fields: ['pnl'], source_refs: { secret: 'private' } }])
    expect((await cardsFor(db, [ID])).get(ID)).toEqual({ kind: 'quant_total', snapshot, visibleFields: ['pnl'], capturedAt: snapshot.capturedAt })
    expect(query.mock.calls.every(([sql]) => !sql.includes('quant_payouts'))).toBe(true)
    expect(query.mock.calls.at(-1)![0]).not.toContain('source_refs')
  })
  it('redacts unselected and private keys even when they exist in the stored snapshot', async () => {
    const snapshot = { capturedAt: '2026-11-01T00:00:00.000Z', period: { from: null, to: null }, asset: 'USDT', decimals: 6,
      provenance: 'ledger_verified', disclaimer: 'v1', returnPct: '-12.4', pnl: '-12400000', settledDays: 17,
      source_refs: { sourceId: ID }, sourceId: ID }
    const { db } = fakeDb(sql => sql.includes('to_regclass') ? [{ ready: true }] : [{ post_id: ID, kind: 'quant_total', snapshot, visible_fields: ['returnPct'] }])
    const card = (await cardsFor(db, [ID])).get(ID)!
    expect(card.snapshot).toEqual({ capturedAt: snapshot.capturedAt, period: snapshot.period, asset: 'USDT', decimals: 6,
      provenance: 'ledger_verified', disclaimer: 'v1', returnPct: '-12.4' })
    expect(snapshot).toHaveProperty('pnl') // reading never mutates the frozen data
  })
  it('keeps funds metadata fixed and requires an actual hideable value', async () => {
    const { db } = fakeDb(() => [{ amount: '9007199254740993123456789', asset: 'USDT', decimals: 6, status: 'credited', time: '2026-11-01T00:00:00Z' }])
    const full = await resolveCard(db, 'owner', { kind: 'deposit', sourceId: ID })
    expect(full.amount).toBe('9007199254740993123456789')
    expect(publicCardSnapshot('deposit', full, ['status'])).toMatchObject({ asset: 'USDT', decimals: 6, fundsRecord: true, status: 'credited' })
    expect(publicCardSnapshot('deposit', full, ['status'])).not.toHaveProperty('amount')
    expect(() => publicCardSnapshot('deposit', full, ['asset'])).toThrow('CARD_NOTHING_VISIBLE')
  })
  it('marks open prediction monetary results null in owner preview', async () => {
    const { db } = fakeDb(() => [{ question: 'Question?', side: 'YES', status: 'placed', stake: '1000000', payout: null, first: '2026-11-01', last: null }])
    const preview = await cardPreview(db, 'owner', { kind: 'prediction_bet', sourceId: ID })
    expect(preview.snapshot).toMatchObject({ result: 'open', payout: null, pnl: null, returnPct: null })
    expect(preview.fields.find(f => f.key === 'disclaimer')).toEqual({ key: 'disclaimer', hideable: false, value: 'v1' })
  })
  it('reports availability and funds defaults without returning money', async () => {
    const { db } = fakeDb(() => [{ quant: true, holdings: true, day: false, prediction: true, settled: false, deposit: true, withdrawal: false }])
    const { items } = await cardKinds(db, 'owner')
    expect(items).toHaveLength(8)
    expect(items.find(i => i.kind === 'quant_day')).toMatchObject({ available: false, reason: 'NO_SETTLED_DAY', needsSource: true })
    expect(items.find(i => i.kind === 'prediction_record')).toMatchObject({ reason: 'NO_SETTLED_PREDICTION' })
    expect(items.find(i => i.kind === 'deposit')).toMatchObject({ reason: null, defaultHidden: ['amount'] })
  })
  it('returns all eight unavailable kinds for an account with no source rows', async () => {
    const { db, query } = fakeDb(() => [{ quant: false, holdings: false, day: false, prediction: false, settled: false, deposit: false, withdrawal: false }])
    expect((await cardKinds(db, 'new-user')).items.map(({ kind, available, reason }) => ({ kind, available, reason }))).toEqual([
      { kind: 'quant_day', available: false, reason: 'NO_QUANT' },
      { kind: 'quant_product', available: false, reason: 'NO_QUANT' },
      { kind: 'quant_total', available: false, reason: 'NO_QUANT' },
      { kind: 'holdings', available: false, reason: 'NO_QUANT' },
      { kind: 'prediction_bet', available: false, reason: 'NO_PREDICTION' },
      { kind: 'prediction_record', available: false, reason: 'NO_PREDICTION' },
      { kind: 'deposit', available: false, reason: 'NO_DEPOSIT' },
      { kind: 'withdrawal', available: false, reason: 'NO_WITHDRAWAL' },
    ])
    expect(query).toHaveBeenCalledWith(expect.any(String), ['new-user'])
  })
  it('pages sources using timestamp precision and a stable id tie-breaker', async () => {
    const rows = Array.from({ length: 51 }, () => ({ id: ID, label: 'Koala', sublabel: 'settled', at: '2026-10-31 00:00:00.123456+00' }))
    const { db, query } = fakeDb(() => rows)
    const first = await cardSources(db, 'owner', 'quant_day')
    expect(first.items).toHaveLength(50)
    await cardSources(db, 'owner', 'quant_day', first.nextCursor!)
    expect(query.mock.calls[1][1]).toEqual(['owner', rows[0].at, ID])
    await expect(cardSources(db, 'owner', 'quant_day', 'bad')).rejects.toThrow('CARD_CURSOR_INVALID')
    const wrongIdType = Buffer.from(JSON.stringify({ id: 123, at: rows[0].at })).toString('base64url')
    await expect(cardSources(db, 'owner', 'quant_day', wrongIdType)).rejects.toThrow('CARD_CURSOR_INVALID')
    expect(await cardSources(db, 'owner', 'quant_total')).toEqual({ items: [], nextCursor: null })
  })
  it('returns no cards without ids or before the additive migration', async () => {
    const { db, query } = fakeDb(() => [{ ready: false }])
    expect(await cardsFor(db, [])).toEqual(new Map())
    expect(query).not.toHaveBeenCalled()
    expect(await cardsFor(db, [ID])).toEqual(new Map())
    expect(query).toHaveBeenCalledTimes(1)
  })
})

describe('hidden dates stay hidden', () => {
  const snap = (extra: object) => ({ capturedAt: '2026-11-01T00:00:00.000Z', period: { from: '2026-10-31', to: '2026-10-31' }, asset: 'USDT', decimals: 6, provenance: 'ledger_verified' as const, disclaimer: 'v1' as const, ...extra })
  it('a single-day card without its date field does not leak the day through the period', () => {
    const full = snap({ pnl: '-1', returnPct: '-1', date: '2026-10-31', product: { slug: 'k', name: 'K' } })
    expect(publicCardSnapshot('quant_day', full, ['returnPct']).period).toEqual({ from: null, to: null })
    expect(publicCardSnapshot('quant_day', full, ['returnPct', 'date']).period).toEqual({ from: '2026-10-31', to: '2026-10-31' })
    const dep = snap({ amount: '5', time: '2026-10-31T01:00:00.000Z', status: 'credited', fundsRecord: true })
    expect(publicCardSnapshot('deposit', dep, ['status']).period).toEqual({ from: null, to: null })
    expect(publicCardSnapshot('deposit', dep, ['status', 'time']).period.from).toBe('2026-10-31')
    expect(publicCardSnapshot('withdrawal', dep, ['status']).fundsRecord).toBe(true)
  })
  it('multi-day cards keep their period (it is the stated window, not a hideable field)', () => {
    const total = snap({ period: { from: '2026-09-01', to: '2026-10-31' }, pnl: '1', settledDays: 3 })
    expect(publicCardSnapshot('quant_total', total, ['pnl']).period).toEqual({ from: '2026-09-01', to: '2026-10-31' })
  })
})
