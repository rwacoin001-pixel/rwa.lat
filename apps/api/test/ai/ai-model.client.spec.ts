import { ConfigService } from '@nestjs/config'
import { Logger } from '@nestjs/common'
import { AiModelClient } from '../../src/ai/ai-model.client'

describe('AI provider delivery contract', () => {
  const client = () => new AiModelClient(new ConfigService({ AI_MODEL_ENDPOINT: 'https://ai.example.test', AI_MODEL_API_KEY: 'test-only', AI_MODEL_NAME: 'configured-model' }))
  afterEach(() => jest.restoreAllMocks())

  it.each(['https://api.deepseek.com', 'https://api.deepseek.com/v1'])('infers OpenAI delivery for %s', async endpoint => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: ' DeepSeek reply ' } }], usage: { prompt_tokens: 3, completion_tokens: 4 } }), { status: 200 }))
    const configured = new AiModelClient(new ConfigService({ AI_MODEL_ENDPOINT: endpoint, AI_MODEL_API_KEY: 'test-only', AI_MODEL_NAME: 'deepseek-chat' }))
    expect(await configured.complete('System', [{ role: 'user', content: 'Test' }])).toMatchObject({ text: 'DeepSeek reply', model: 'deepseek-chat', usage: { inputTokens: 3, outputTokens: 4 } })
    expect(fetch.mock.calls[0][0]).toBe(`${endpoint}/chat/completions`)
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ authorization: 'Bearer test-only' })
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).messages[0]).toEqual({ role: 'system', content: 'System' })
  })

  it.each(['https://compat.example.test', 'https://compat.example.test/v1/'])('preserves explicit Anthropic delivery without duplicate v1 for %s', async endpoint => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'Reply' }] }), { status: 200 }))
    const configured = new AiModelClient(new ConfigService({ AI_MODEL_ENDPOINT: endpoint, AI_MODEL_API_KEY: 'test-only', AI_MODEL_API_STYLE: 'anthropic' }))
    await configured.complete('System', [{ role: 'user', content: 'Test' }])
    expect(fetch.mock.calls[0][0]).toBe('https://compat.example.test/v1/messages')
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ 'x-api-key': 'test-only', 'anthropic-version': '2023-06-01' })
  })

  it('rejects a mistyped explicit format instead of silently choosing another protocol', () => {
    expect(() => new AiModelClient(new ConfigService({ AI_MODEL_API_STYLE: 'open-ai' }))).toThrow('AI_MODEL_API_STYLE')
  })

  it('returns provider text and model only after a successful completion', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: 'Connected.' }], model: 'actual-model', usage: { input_tokens: 1, output_tokens: 2 } }), { status: 200 }))
    expect(await client().complete('System', [{ role: 'user', content: 'Test' }])).toMatchObject({ text: 'Connected.', model: 'actual-model' })
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ model: 'configured-model', messages: [{ role: 'user', content: 'Test' }] })
  })

  it('rejects invalid credentials without logging the provider response body', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('secret-provider-detail', { status: 401 }))
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    await expect(client().complete('System', [{ role: 'user', content: 'Test' }])).rejects.toThrow('401')
    expect(warn).toHaveBeenCalledWith('AI model upstream HTTP 401')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-provider-detail')
  })

  it('rejects empty completions instead of returning a placeholder answer', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [] }), { status: 200 }))
    await expect(client().complete('System', [{ role: 'user', content: 'Test' }])).rejects.toThrow('empty completion')
  })
})
