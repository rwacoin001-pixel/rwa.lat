import { LedgerService } from '../../src/ledger/ledger.service'

const userId = 'd414efd2-e128-46b2-b25b-c61662b5ae83'
const adminId = 'a414efd2-e128-46b2-b25b-c61662b5ae83'
const operationId = 'b414efd2-e128-46b2-b25b-c61662b5ae83'
const input = { userId, adminId, operationId, mode: 'credit', amount: '10.25', expectedAtomicBalance: '20000000', reason: '测试充值核对', requestId: 'trace-1' }

function harness(balance = '20000000', existing?: Record<string, unknown>) {
  let adjustment: Record<string, unknown> = {}
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('request_id = $2')) return existing ? [existing] : []
    if (sql.includes('SELECT id, status FROM app.users')) return [{ id: userId, status: 'active' }]
    if (sql.includes('SELECT id, normal_side')) return [{ id: 'available-account', normal_side: 'credit', asset_decimals: 6, state: 'active' }]
    if (sql.includes('SELECT current_atomic_balance')) return [{ atomicBalance: balance }]
    if (sql.includes('INSERT INTO app.ledger_adjustment_requests')) {
      adjustment = { id: params?.[0], ledger_account_id: params?.[1], side: params?.[2], atomic_amount: params?.[3],
        reason_code: params?.[4], evidence: JSON.parse(String(params?.[5])), requested_by: params?.[6], approved_by: adminId, state: 'approved' }
      return [{ id: params?.[0], state: 'requested' }]
    }
    if (sql.includes('SELECT * FROM app.ledger_adjustment_requests')) return [adjustment]
    if (sql.includes('FROM app.ledger_accounts WHERE id')) return [{ id: 'available-account', owner_type: 'user', user_id: userId, purpose: 'available', asset_code: 'USDT', asset_decimals: 6, normal_side: 'credit', network: null, state: 'active' }]
    if (sql.includes("owner_reference = 'ledger-adjustments'")) return [{ id: 'contra-account' }]
    if (sql.includes('INSERT INTO app.ledger_transactions')) return [{ id: 'transaction-1' }]
    return []
  })
  const runner = { query, connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() }
  const service = new LedgerService({ createQueryRunner: () => runner } as never)
  return { service, runner, query }
}

describe('Single-operator user USDT adjustments', () => {
  const previous = process.env.LEDGER_ALLOW_SELF_APPROVAL
  beforeEach(() => { process.env.LEDGER_ALLOW_SELF_APPROVAL = 'true' })
  afterAll(() => { if (previous === undefined) delete process.env.LEDGER_ALLOW_SELF_APPROVAL; else process.env.LEDGER_ALLOW_SELF_APPROVAL = previous })

  it('credits the exact decimal amount and posts equal opposite entries in one transaction', async () => {
    const { service, query, runner } = harness()
    const result = await (service as any).adjustUserBalance(input)
    expect(result).toMatchObject({ state: 'posted', beforeAtomic: '20000000', afterAtomic: '30250000', duplicate: false })
    const created = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.ledger_adjustment_requests'))
    expect(created?.[1]).toEqual(expect.arrayContaining(['credit', '10250000', 'manual_credit', adminId, operationId]))
    const posted = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.ledger_entries'))
    expect(posted?.[1]).toEqual([expect.any(String), 'available-account', 'credit', 'contra-account', '10250000', 'debit'])
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1)
    expect(query.mock.calls.some(([sql]) => /UPDATE app\.ledger_account_balances/.test(sql))).toBe(false)
  })

  it('sets a target by its exact difference instead of overwriting a balance', async () => {
    const { service, query } = harness()
    await (service as any).adjustUserBalance({ ...input, mode: 'set', amount: '20.000001' })
    const created = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.ledger_adjustment_requests'))
    expect(created?.[1]).toEqual(expect.arrayContaining(['credit', '1', 'manual_set_balance']))
    expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.ledger_entries'))?.[1]?.[4]).toBe('1')
  })

  it('refuses a changed snapshot before any adjustment or ledger entry is created', async () => {
    const { service, query, runner } = harness('21000000')
    await expect((service as any).adjustUserBalance(input)).rejects.toMatchObject({ response: { code: 'USER_BALANCE_CHANGED' } })
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.ledger_adjustment_requests'))).toBe(false)
    expect(runner.rollbackTransaction).toHaveBeenCalled()
  })

  it('cannot deduct more than the current available balance', async () => {
    const { service, query } = harness()
    await expect((service as any).adjustUserBalance({ ...input, mode: 'debit', amount: '20.000001' })).rejects.toMatchObject({ response: { code: 'USER_BALANCE_INSUFFICIENT' } })
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.ledger_adjustment_requests'))).toBe(false)
  })

  it('deducts from the correct ledger side', async () => {
    const { service, query } = harness()
    await (service as any).adjustUserBalance({ ...input, mode: 'debit', amount: '5' })
    const created = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.ledger_adjustment_requests'))
    expect(created?.[1]).toEqual(expect.arrayContaining(['debit', '5000000', 'manual_debit']))
    expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.ledger_entries'))?.[1]).toEqual([expect.any(String), 'available-account', 'debit', 'contra-account', '5000000', 'credit'])
  })

  it('allows an exact target of zero while rejecting a zero credit and a no-op target', async () => {
    const a = harness()
    await (a.service as any).adjustUserBalance({ ...input, mode: 'set', amount: '0' })
    expect(a.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.ledger_adjustment_requests'))?.[1]).toEqual(expect.arrayContaining(['debit', '20000000']))
    await expect((harness().service as any).adjustUserBalance({ ...input, amount: '0' })).rejects.toMatchObject({ response: { code: 'USER_ADJUSTMENT_INVALID' } })
    await expect((harness().service as any).adjustUserBalance({ ...input, mode: 'set', amount: '20' })).rejects.toMatchObject({ response: { code: 'USER_ADJUSTMENT_NO_CHANGE' } })
  })

  it.each(['1.0000001', '-1', '1e3', 'NaN'])('rejects invalid amount %s', async amount => {
    await expect((harness().service as any).adjustUserBalance({ ...input, amount })).rejects.toMatchObject({ response: { code: 'USER_ADJUSTMENT_INVALID' } })
  })

  it('does not silently enable single-operator control when the explicit gate is off', async () => {
    process.env.LEDGER_ALLOW_SELF_APPROVAL = 'false'
    await expect((harness().service as any).adjustUserBalance(input)).rejects.toMatchObject({ response: { code: 'USER_ADJUSTMENT_SINGLE_OPERATOR_DISABLED' } })
  })

  it('returns the original completed operation on a retry without writing more entries', async () => {
    const { service, query } = harness('999000000', { id: 'done-1', state: 'posted', posted_ledger_transaction_id: 'tx-1',
      evidence: { origin: 'admin-user-management', userId, mode: 'credit', amountAtomic: '10250000', reason: input.reason, beforeAtomic: '20000000', afterAtomic: '30250000' } })
    await expect((service as any).adjustUserBalance(input)).resolves.toMatchObject({ id: 'done-1', state: 'posted', duplicate: true, afterAtomic: '30250000' })
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.ledger_entries'))).toBe(false)
  })

  it('rejects reusing an operation ID for a different amount', async () => {
    const { service } = harness('20000000', { id: 'done-1', state: 'posted', evidence: { origin: 'admin-user-management', userId, mode: 'credit', amountAtomic: '10000000', reason: input.reason, beforeAtomic: '20000000' } })
    await expect((service as any).adjustUserBalance(input)).rejects.toMatchObject({ response: { code: 'USER_ADJUSTMENT_DUPLICATE_CONFLICT' } })
  })
})
