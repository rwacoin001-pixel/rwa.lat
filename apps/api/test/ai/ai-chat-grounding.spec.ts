import { AiService } from '../../src/ai/ai.service'
import type { KnowledgeSource } from '../../src/ai/ai-knowledge.policy'

const source: KnowledgeSource = { id: '9d7f53b0-48a6-4251-a3bc-171a545b3dad', sourceId: 'kb:9d7f53b0-48a6-4251-a3bc-171a545b3dad:v2', revision: 2, title: '赎回', summary: '', body: '实际到账后才能再投资。', locale: 'zh-CN', category: 'redemption', productIds: [], publishedAt: '2026-09-30T00:00:00Z' }

function fixture() {
  const session = { id: 'session', userId: 'owner', title: 'New conversation', updatedAt: new Date() }
  const sessions = { create: (value: any) => value, save: jest.fn(async (value: any) => ({ ...session, ...value })), findOne: jest.fn(async () => session) }
  const messages = { create: (value: any) => value, save: jest.fn(async (value: any) => ({ ...value, createdAt: new Date() })), find: jest.fn(async () => []), delete: jest.fn(async () => ({})) }
  const model = { configured: true, providerName: 'DeepSeek', modelName: 'test', complete: jest.fn(async () => ({ text: JSON.stringify({ reply: '实际到账后才能再投资。', sourceIds: [source.sourceId] }), model: 'test' })) }
  const knowledge = { enabled: true, retrieve: jest.fn(async () => [source]), stillCurrent: jest.fn(async () => true) }
  const service = new AiService(sessions as any, messages as any, model as any, knowledge as any)
  return { service, sessions, messages, model, knowledge }
}

describe('Published knowledge in customer chat', () => {
  it('passes actual published sources and stores verified citations', async () => {
    const f = fixture()
    const reply = await f.service.chat('owner', { message: '赎回到账', locale: 'zh-CN' })
    expect(reply.reply).toBe('实际到账后才能再投资。')
    expect(reply.citations).toEqual([expect.objectContaining({ sourceId: source.sourceId, revision: 2 })])
    expect(f.model.complete.mock.calls[0][0]).toContain(source.body)
    expect(f.messages.save.mock.calls[1][0].citationsJson).toEqual(reply.citations)
  })
  it('rejects invented citations and removes the unanswered user message', async () => {
    const f = fixture()
    f.model.complete.mockResolvedValue({ text: '{"reply":"秘密条款","sourceIds":["private"]}', model: 'test' })
    await expect(f.service.chat('owner', { message: '查询', locale: 'zh-CN' })).rejects.toThrow()
    expect(f.messages.delete).toHaveBeenCalledTimes(1)
    expect(f.messages.save).toHaveBeenCalledTimes(1)
  })
  it('does not deliver sources withdrawn while the provider was generating', async () => {
    const f = fixture()
    f.knowledge.stillCurrent.mockResolvedValue(false)
    await expect(f.service.chat('owner', { message: '赎回', locale: 'zh-CN' })).rejects.toThrow()
    expect(f.messages.save).toHaveBeenCalledTimes(1)
  })
  it('rejects another user session before retrieval or provider access', async () => {
    const f = fixture()
    await expect(f.service.chat('other', { message: '查询余额', sessionId: 'session' })).rejects.toThrow()
    expect(f.knowledge.retrieve).not.toHaveBeenCalled()
    expect(f.model.complete).not.toHaveBeenCalled()
  })
  it('requires a signed-in owner before sharing account information', async () => {
    const f = fixture()
    await expect(f.service.chat(null, { message: '余额', accountScopes: ['balances'] })).rejects.toThrow()
    expect(f.model.complete).not.toHaveBeenCalled()
  })
})
