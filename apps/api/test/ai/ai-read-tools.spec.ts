import { Logger } from '@nestjs/common'
import { AI_READ_TOOLS, aiAmount, validateToolArguments } from '../../src/ai/ai-read-tools.service'
import { OWNER, OTHER, RECORD, SLUG, readFixture } from '../ai-evals/fixtures'

describe('Session-bound AI reads', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined))
  afterEach(() => jest.restoreAllMocks())
  const args = (definition: typeof AI_READ_TOOLS[number]) => Object.fromEntries(definition.parameters.required.map(key => [key, key === 'slug' ? SLUG : RECORD]))
  it.each(AI_READ_TOOLS.filter(t => !t.publicTool))('$name binds services to the session and rejects supplied user IDs', async definition => {
    const f = readFixture()
    await f.tools.execute(OWNER, definition.name, JSON.stringify(args(definition)))
    const calls = Object.entries(f.d).filter(([name]) => !['catalog','markets','platform'].includes(name)).flatMap(([, d]) => Object.values(d).flatMap(fn => fn.mock.calls))
    expect(calls.some(call => call.includes(OWNER))).toBe(true)
    expect(calls.some(call => call.includes(OTHER))).toBe(false)
    const before = calls.length
    await expect(f.tools.execute(OWNER, definition.name, JSON.stringify({ ...args(definition), userId: OTHER }))).rejects.toThrow()
    const after = Object.values(f.d).flatMap(d => Object.values(d).flatMap(fn => fn.mock.calls)).length
    expect(after).toBe(before)
    await expect(f.tools.execute(null, definition.name, JSON.stringify(args(definition)))).rejects.toThrow()
  })
  it('exposes only public definitions to guests', async () => {
    const f = readFixture()
    expect(f.tools.definitions(null).map(t => t.name)).toEqual(AI_READ_TOOLS.filter(t => t.publicTool).map(t => t.name))
    for (const tool of AI_READ_TOOLS.filter(t => t.publicTool)) await expect(f.tools.execute(null, tool.name, JSON.stringify(args(tool)))).resolves.toBeDefined()
  })
  it.each(['{"limit":51}', '{"limit":0}', '{"limit":1.5}', '{"limit":"5"}', '[]', 'null', '{"__proto__":{}}'])('rejects malformed arguments %s', raw => {
    expect(() => validateToolArguments('list_transactions', raw)).toThrow()
  })
  it('uses actual prediction statuses and exact decimal strings', async () => {
    const f = readFixture()
    expect(validateToolArguments('list_prediction_bets','{"status":"placed"}')).toEqual({ status: 'placed' })
    expect(() => validateToolArguments('list_prediction_bets','{"status":"pending"}')).toThrow()
    expect(await f.tools.execute(OWNER, 'get_balances', '{}')).toEqual([{ purpose: 'available', state: 'active', balance: '123.45 USDT', asOf: undefined }])
    expect(aiAmount('9007199254740993123456')).toBe('9007199254740993.123456 USDT')
    expect(aiAmount('-1')).toBe('-0.000001 USDT')
  })
  it('cross-checks losses and never treats missing evidence as fraud', async () => {
    const f = readFixture()
    expect(await f.tools.notice(OWNER, RECORD)).toMatchObject({ settlementVerified: true, settlement: { net: '-2.5 USDT' }, meaning: expect.stringContaining('loss deducted from principal') })
    expect(f.d.notifications.getForUser).toHaveBeenCalledWith(RECORD, OWNER)
    expect(f.d.quant.getMyPayout).toHaveBeenCalledWith(OWNER, SLUG, '2026-10-28')
    f.d.quant.getMyPayout.mockResolvedValue(null)
    expect(await f.tools.notice(OWNER, RECORD)).toMatchObject({ settlementVerified: false, meaning: expect.stringContaining('absence is not evidence of fraud') })
  })
  it.each(['settled', 'rejected'])('verifies a %s redemption against the owned order', async state => {
    const f = readFixture()
    f.d.notifications.getForUser.mockResolvedValue({ ...f.notice, kind: `quant.redemption.${state}`, payload: { product: SLUG, orderId: RECORD, payoutAtomic: '10000000', feeAtomic: '100000' } })
    f.d.quant.getMyOrder.mockResolvedValue({ slug: SLUG, kind: 'redemption', status: state, payoutAtomic: '10000000', feeAtomic: '100000' })
    expect((await f.tools.notice(OWNER, RECORD)).settlementVerified).toBe(true)
    expect(f.d.quant.getMyOrder).toHaveBeenCalledWith(OWNER, RECORD)
  })
  it('verifies ledger-feed quant notices and denies a foreign notice before quant access', async () => {
    const f = readFixture()
    f.d.notifications.getForUser.mockResolvedValue({ ...f.notice, kind: 'wallet.quant_daily_settlement', payload: { sourceKey: `ledger:${RECORD}`, amountAtomic: '500000' } })
    f.d.quant.getMyNoticeLedgerRecord.mockResolvedValue({ type: 'quant_daily_settlement', paidAtomic: '500000' })
    expect((await f.tools.notice(OWNER, RECORD)).settlementVerified).toBe(true)
    expect(f.d.quant.getMyNoticeLedgerRecord).toHaveBeenCalledWith(OWNER, RECORD)
    f.d.notifications.getForUser.mockRejectedValue(new Error('Not found'))
    await expect(f.tools.notice(OWNER, OTHER)).rejects.toThrow()
    expect(f.d.quant.getMyNoticeLedgerRecord).toHaveBeenCalledTimes(1)
  })
  it('logs only tool name, latency and row count, including failures', async () => {
    const f = readFixture()
    await f.tools.execute(OWNER, 'get_balances', '{}')
    await expect(f.tools.execute(OWNER, 'injected-secret', '{}')).rejects.toThrow()
    const lines = (Logger.prototype.log as jest.Mock).mock.calls.map(([line]) => JSON.parse(line))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toEqual({ tool: 'get_balances', latencyMs: expect.any(Number), rowCount: 1 })
    expect(lines[1].tool).toBe('unknown')
    expect(JSON.stringify(lines)).not.toContain(OWNER)
  })
})
