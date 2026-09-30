import { AiCustomerToolsService } from '../../src/ai/ai-customer-tools.service'
const owner = 'edcff24b-9b44-4a80-82ed-8735fd207bf4'

describe('Customer AI tools', () => {
  it('does not query accounts without a real owner or explicit scopes', async () => {
    const ds = { query: jest.fn() }
    const tools = new AiCustomerToolsService(ds as any, {} as any)
    await expect(tools.account(null as any, ['balances'])).rejects.toThrow()
    await expect(tools.account(owner, [])).rejects.toThrow()
    await expect(tools.account(owner, ['credentials'] as any)).rejects.toThrow()
    expect(ds.query).not.toHaveBeenCalled()
  })
  it('queries only the session owner and returns a minimal projection', async () => {
    const query = jest.fn(async (sql: string) => sql.includes('app.users') ? [{ status: 'active' }] : [{ assetCode: 'USDT', atomicAmount: '12000000', decimals: 6, purpose: 'available' }])
    const tools = new AiCustomerToolsService({ query } as any, {} as any)
    const result = await tools.account(owner, ['balances'])
    expect(result).toMatchObject({ balances: [{ assetCode: 'USDT', atomicAmount: '12000000' }] })
    expect(query.mock.calls.every(call => call[1][0] === owner)).toBe(true)
    expect(query.mock.calls.some(call => /password|ciphertext|provider_case|wallet_address|SELECT\s+\*/i.test(call[0]))).toBe(false)
  })
  it('requires an owner-scoped draft and explicit confirmation before creating a ticket', async () => {
    const query = jest.fn(async () => [])
    const createTicket = jest.fn()
    const tools = new AiCustomerToolsService({ query } as any, { createTicket } as any)
    await expect(tools.confirmTicket(owner, '3e7b2260-6e14-49df-926c-ea6a0754d1c5', false)).rejects.toThrow()
    await expect(tools.confirmTicket(owner, '3e7b2260-6e14-49df-926c-ea6a0754d1c5', true)).rejects.toThrow()
    expect(createTicket).not.toHaveBeenCalled()
  })
})
