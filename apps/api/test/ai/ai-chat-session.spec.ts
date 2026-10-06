import { clearAiChatSession, parseAiChatSession, serializeAiChatSession, AI_CHAT_SESSION_KEY } from '../../../../lib/ai-chat-session'

describe('AI chat session snapshot', () => {
  it('restores the current thread while excluding attachment payloads', () => {
    const source = [
      {
        id: 1,
        role: 'user',
        content: '请看这个页面',
        attachments: [{ name: 'account.png', mime: 'image/png', size: 512, method: 'image', text: 'private extracted text', dataUrl: 'data:image/png;base64,secret' }],
      },
      { id: 2, messageId: 'reply-1', role: 'assistant', content: '这是 RWA.LAT 的账户页面。', citations: [], questions: [] },
    ] as any

    const serialized = serializeAiChatSession('session-1', source)
    const restored = parseAiChatSession(serialized)

    expect(restored).toMatchObject({ sessionId: 'session-1', messages: [{ id: 1, role: 'user', content: '请看这个页面' }, { id: 2, messageId: 'reply-1', role: 'assistant', content: '这是 RWA.LAT 的账户页面。' }] })
    expect(serialized).not.toContain('data:image')
    expect(serialized).not.toContain('private extracted text')
    expect(restored?.messages[0].attachments?.[0]).toMatchObject({ name: 'account.png', method: 'image', text: '' })
  })

  it('does not restore an unanswered trailing user message', () => {
    const serialized = serializeAiChatSession('session-2', [
      { id: 1, role: 'user', content: '第一问' },
      { id: 2, role: 'assistant', content: '第一答' },
      { id: 3, role: 'user', content: '尚未得到回答的问题' },
    ] as any)

    expect(parseAiChatSession(serialized)?.messages.map(message => message.id)).toEqual([1, 2])
  })

  it('rejects malformed snapshots and clears only the AI thread key', () => {
    expect(parseAiChatSession('{bad json')).toBeNull()
    expect(parseAiChatSession(JSON.stringify({ version: 99, sessionId: 'old', messages: [] }))).toBeNull()
    const removeItem = jest.fn()
    clearAiChatSession({ removeItem })
    expect(removeItem).toHaveBeenCalledWith(AI_CHAT_SESSION_KEY)
    expect(removeItem).toHaveBeenCalledTimes(1)
  })
})
