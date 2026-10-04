import { AiService } from '../../src/ai/ai.service'
import type { AiModelClient } from '../../src/ai/ai-model.client'
import type { KnowledgeSource } from '../../src/ai/ai-knowledge.policy'
import { imageFixture } from './ai-image-fixture'

const source: KnowledgeSource = { id: '9d7f53b0-48a6-4251-a3bc-171a545b3dad', sourceId: 'kb:9d7f53b0-48a6-4251-a3bc-171a545b3dad:v2', revision: 2, title: '赎回', summary: '', body: '实际到账后才能再投资。', locale: 'zh-CN', category: 'redemption', productIds: [], publishedAt: '2026-09-30T00:00:00Z' }

function fixture() {
  const session = { id: 'session', userId: 'owner', title: 'New conversation', updatedAt: new Date() }
  const sessions = { create: (value: any) => value, save: jest.fn(async (value: any) => ({ ...session, ...value })), findOne: jest.fn(async () => session) }
  const messages = { create: (value: any) => value, save: jest.fn(async (value: any) => ({ ...value, createdAt: new Date() })), find: jest.fn(async () => []), delete: jest.fn(async () => ({})) }
  const model = { configured: true, visionAvailable: true, providerName: 'DeepSeek', modelName: 'test', complete: jest.fn(async (..._args: Parameters<AiModelClient['complete']>) => ({ text: JSON.stringify({ reply: '实际到账后才能再投资。', sourceIds: [source.sourceId] }), model: 'test' })) }
  const knowledge = { enabled: true, retrieve: jest.fn(async () => [source]), stillCurrent: jest.fn(async () => true) }
  const service = new AiService(sessions as any, messages as any, model as any, knowledge as any)
  return { service, sessions, messages, model, knowledge }
}

describe('Published knowledge in customer chat', () => {
  it('sees pixels on the current turn while keeping binary data out of the database and historical replay', async () => {
    const f = fixture(), image = imageFixture()
    f.messages.find.mockImplementation(async () => [f.messages.save.mock.calls[0][0]] as any)
    await f.service.chat('owner', { message: 'Which screen is this?', attachments: [image], context: { pageKey: 'cashDeposit' } })
    const modelHistory = f.model.complete.mock.calls[0][1]
    expect(modelHistory[0].images).toEqual([image.dataUrl])
    const saved = f.messages.save.mock.calls[0][0]
    expect(saved.content).not.toContain('base64')
    expect(f.model.complete.mock.calls[0][0]).toContain('充值 Deposit')
    expect(f.model.complete.mock.calls[0][0]).toContain('A screenshot is not verified account/identity evidence')
    f.messages.find.mockResolvedValue([saved] as any)
    await f.service.chat('owner', { message: 'Tell me the next step', sessionId: 'session' })
    expect(f.model.complete.mock.calls[1][1][0].images).toBeUndefined()
    expect((await f.service.getSession('owner', 'session')).messages[0].attachments?.[0]).not.toHaveProperty('dataUrl')
  })
  it('keeps images unsent and unstored when the configured provider cannot see them', async () => {
    const f = fixture(); f.model.visionAvailable = false
    await expect(f.service.chat('owner', { message: 'Read this', attachments: [imageFixture()] })).rejects.toMatchObject({ response: { code: 'AI_VISION_UNAVAILABLE' } })
    expect(f.sessions.save).not.toHaveBeenCalled(); expect(f.messages.save).not.toHaveBeenCalled(); expect(f.model.complete).not.toHaveBeenCalled()
  })
  it('stores file text under the session owner and replays actual extracted content to the text model', async () => {
    const f = fixture()
    const attachments = [{ name: 'statement.png', mime: 'image/png', size: 120, method: 'ocr' as const, text: 'Statement says 200 USDT' }]
    f.messages.find.mockImplementation(async () => [f.messages.save.mock.calls[0][0]] as any)
    await f.service.chat('owner', { message: 'Explain my file', sessionId: 'session', attachments })
    expect(f.model.complete.mock.calls[0][1][0].content).toContain(attachments[0].text)
    expect(f.model.complete.mock.calls[0][1][0].content).toContain('image pixels are provided separately only for the current turn')
    const stored = f.messages.save.mock.calls[0][0]
    expect(stored.sessionId).toBe('session')
    expect(JSON.parse(stored.content).attachments).toEqual(attachments)
    f.messages.find.mockResolvedValue([stored] as any)
    const history = await f.service.getSession('owner', 'session')
    expect(history.messages[0]).toMatchObject({ content: 'Explain my file', attachments })
  })
  it('rejects invalid attachments before creating a session or calling the provider', async () => {
    const f = fixture()
    await expect(f.service.chat('owner', { message: 'file', attachments: [{ name: 'file.exe', size: 10, text: 'fake', mime: 'application/x-executable', method: 'text' }] })).rejects.toThrow()
    expect(f.sessions.save).not.toHaveBeenCalled()
    expect(f.messages.save).not.toHaveBeenCalled()
    expect(f.model.complete).not.toHaveBeenCalled()
  })
  it('rejects serialized excerpts that expand beyond the provider budget before saving a message', async () => {
    const f = fixture()
    const file = { name: 'escaped.txt', size: 12000, text: 'a' + '\u0001'.repeat(11999), mime: 'text/plain', method: 'text' as const }
    await expect(f.service.chat('owner', { message: 'explain', attachments: [file, file] })).rejects.toThrow()
    expect(f.sessions.findOne).not.toHaveBeenCalled()
    expect(f.sessions.save).not.toHaveBeenCalled()
    expect(f.messages.save).not.toHaveBeenCalled()
    expect(f.model.complete).not.toHaveBeenCalled()
  })
  it('blocks wallet key material in the message before session or provider access', async () => {
    const f = fixture()
    for (const message of ['0x' + 'a'.repeat(64), Array(12).fill('abandon').join(' ')]) await expect(f.service.chat('owner', { message })).rejects.toThrow()
    expect(f.sessions.save).not.toHaveBeenCalled()
    expect(f.messages.save).not.toHaveBeenCalled()
    expect(f.model.complete).not.toHaveBeenCalled()
  })
  it('authenticated history requires the requested owner and never reads messages after rejection', async () => {
    const f = fixture()
    f.sessions.findOne.mockResolvedValue(null as any)
    await expect(f.service.getSession('other', 'session')).rejects.toThrow()
    expect(f.sessions.findOne).toHaveBeenCalledWith({ where: { id: 'session', userId: 'other', deletedAt: expect.anything() } })
    expect(f.messages.find).not.toHaveBeenCalled()
  })
  it('feedback cannot modify another owner\'s message', async () => {
    const f = fixture()
    ;(f.messages as any).findOne = jest.fn(async () => ({ id: 'message', role: 'assistant', sessionId: 'session' }))
    f.sessions.findOne.mockResolvedValue(null as any)
    await expect(f.service.feedback('other', 'message', true)).rejects.toThrow()
    expect(f.sessions.findOne).toHaveBeenCalledWith({ where: { id: 'session', userId: 'other', deletedAt: expect.anything() } })
    expect(f.messages.save).not.toHaveBeenCalled()
  })
  it('returns, persists and restores clarification cards as readable history', async () => {
    const f = fixture()
    const questions = [{ id: 'intent', title: '你的问题？', multiple: false, options: [{ id: 'account', label: '账户' }, { id: 'order', label: '订单' }] }]
    f.model.complete.mockResolvedValue({ text: JSON.stringify({ reply: '先确认一下。', sourceIds: [], questions }), model: 'test' })
    const reply = await f.service.chat('owner', { message: '帮我', locale: 'zh-CN' })
    expect(reply.questions).toEqual(questions)
    const saved = f.messages.save.mock.calls[1][0]
    expect(JSON.parse(saved.content)).toEqual({ cardVersion: 1, reply: reply.reply, questions })
    f.messages.find.mockResolvedValue([saved] as any)
    const history = await f.service.getSession('owner', 'session')
    expect(history.messages[0]).toMatchObject({ content: reply.reply, questions })
    expect(f.model.complete.mock.calls[0][0]).toContain('never consent to investment')
    await f.service.chat('owner', { message: '账户', sessionId: 'session', locale: 'zh-CN' })
    const modelHistory = f.model.complete.mock.calls[1][1] as Array<{ content: string }>
    expect(modelHistory[0].content).toContain('你的问题？')
    expect(modelHistory[0].content).not.toContain('cardVersion')
    expect(JSON.parse(modelHistory[0].content)).toEqual({ reply: reply.reply, sourceIds: [], questions })
  })
  it('still supports structured clarification when the knowledge feature is disabled', async () => {
    const f = fixture()
    f.knowledge.enabled = false
    f.model.complete.mockResolvedValue({ text: JSON.stringify({ reply: '具体哪里需要帮助？', sourceIds: [], questions: [] }), model: 'test' })
    expect((await f.service.chat('owner', { message: '帮我' })).questions).toEqual([])
    expect(f.knowledge.retrieve).not.toHaveBeenCalled()
  })
  it('regenerates excessive questions once and persists only the validated reply', async () => {
    const f = fixture()
    const options = [{ id: 'a', label: '稳健' }, { id: 'b', label: '增长' }]
    const invalid = JSON.stringify({ reply: 'Choose', sourceIds: [], questions: Array.from({ length: 4 }, (_, index) => ({ id: `q${index}`, title: '目标？', multiple: false, options })) })
    f.model.complete.mockResolvedValueOnce({ text: invalid, model: 'test' })
      .mockResolvedValueOnce({ text: JSON.stringify({ reply: '已根据选择继续。', sourceIds: [], questions: [] }), model: 'test' })
    const result = await f.service.chat('owner', { message: '我有1000U如何投资' })
    expect(result.reply).toBe('已根据选择继续。')
    expect(result.questions).toEqual([])
    expect(f.model.complete).toHaveBeenCalledTimes(2)
    expect(f.model.complete.mock.calls[1][0]).toContain('OUTPUT CORRECTION')
    expect(f.messages.save.mock.calls[1][0].content).toBe(result.reply)
  })
  it('keeps format regeneration inside the original response deadline', async () => {
    const f = fixture()
    let now = 1000
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      f.model.complete.mockImplementationOnce(async () => { now += 85_000; return { text: '{}', model: 'test' } })
      await f.service.chat('owner', { message: '选择完成' })
      expect(f.model.complete.mock.calls[0][4]).toBe(90_000)
      expect(f.model.complete.mock.calls[1][4]).toBe(5_000)
    } finally { clock.mockRestore() }
  })
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
