import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { AdminAiModelClient } from '../src/admin-ai-model.client'

describe('admin AI provider adapter', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })
  const client = (style = 'openai') => new AdminAiModelClient(new ConfigService({
    AI_MODEL_ENDPOINT: 'https://model.example.test/v1', AI_MODEL_API_KEY: randomBytes(16).toString('hex'),
    AI_MODEL_API_STYLE: style, AI_MODEL_NAME: 'test-model',
  }))

  it('sends OpenAI tools and maps tool calls', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'schema', function: { name: 'describe_schema', arguments: '{}' } }] } }] })))
    global.fetch = fetchMock
    expect(await client().complete('System', [{ role: 'user', content: 'Count' }], 5000)).toEqual({ text: '', calls: [{ id: 'schema', name: 'describe_schema', arguments: '{}' }] })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.tools.map((t: any) => t.function.name)).toEqual(['describe_schema', 'run_sql'])
    expect(body.messages[0]).toEqual({ role: 'system', content: 'System' })
  })

  it('groups Anthropic tool results and uses the same env configuration', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'Verified' }] })))
    global.fetch = fetchMock
    await client('anthropic').complete('System', [
      { role: 'user', content: 'Count' },
      { role: 'assistant', content: '', calls: [{ id: 'a', name: 'describe_schema', arguments: '{}' }, { id: 'b', name: 'describe_schema', arguments: '{}' }] },
      { role: 'tool', callId: 'a', content: '[]' }, { role: 'tool', callId: 'b', content: '[]' },
    ], 5000)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(fetchMock.mock.calls[0][0]).toBe('https://model.example.test/v1/messages')
    expect(body.messages).toHaveLength(3)
    expect(body.messages[2].content).toHaveLength(2)
    expect(body.tools[0]).toHaveProperty('input_schema')
  })

  it.each([{ choices: [] }, { choices: [{ message: { content: 123 } }] }, { content: 'invalid' }])('rejects malformed responses', async payload => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(payload)))
    await expect(client().complete('System', [], 5000)).rejects.toMatchObject({ response: { code: 'AI_MODEL_UNAVAILABLE' } })
  })

  it('never propagates upstream bodies or network diagnostics', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('private provider diagnostics', { status: 401 }))
    await expect(client().complete('System', [], 5000)).rejects.toMatchObject({ response: { code: 'AI_MODEL_UNAVAILABLE' } })
    await expect(new AdminAiModelClient(new ConfigService({})).complete('System', [], 1000)).rejects.toMatchObject({ status: 503 })
  })
})
