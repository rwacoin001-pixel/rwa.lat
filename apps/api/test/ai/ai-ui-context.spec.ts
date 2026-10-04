import { parseAiPageContext } from '../../src/ai/ai-ui-context'

describe('Screen context without private state', () => {
  it('uses the registered app route and labels for operation help', () => {
    expect(parseAiPageContext({ pageKey: 'cashDeposit' })).toMatchObject({ pageKey: 'cashDeposit', path: '/assets/cash/deposit' })
    expect(parseAiPageContext({ pageKey: 'markets', tab: 'predictions' })).toMatchObject({ tab: 'predictions', title: '市场 Markets' })
  })
  it('rejects forged pages, private data, privileged hints and arbitrary query values', () => {
    for (const context of [{ pageKey: 'admin' }, { pageKey: 'ai' }, { pageKey: 'markets', tab: 'user-secret' }, { pageKey: 'markets', balance: 1000 }, { pageKey: 'markets', consent: true }, { pageKey: 'cashDeposit', tab: 'predictions' }]) expect(() => parseAiPageContext(context)).toThrow()
    expect(parseAiPageContext({ type: 'legacy', id: 'ignored-private-id' })).toBeUndefined()
  })
})
