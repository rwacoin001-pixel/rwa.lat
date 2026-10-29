import { ConfigService } from '@nestjs/config'
import { AiModelClient } from '../../src/ai/ai-model.client'
import { runAiToolTurn } from '../../src/ai/ai-tool-runner'
import { OWNER } from '../ai-evals/fixtures'

describe('Provider tool protocols', () => {
  afterEach(() => jest.restoreAllMocks())
  it.each(['openai', 'anthropic'])('%s round-trips multiple tool calls before the final answer', async style => {
    const model = new AiModelClient(new ConfigService({ AI_MODEL_ENDPOINT: 'https://model.example.invalid', AI_MODEL_API_STYLE: style }))
    // No credentials needed or invented: the network and configured getter are stubbed.
    jest.spyOn(model, 'configured', 'get').mockReturnValue(true)
    const calls = [{ id: 'one', name: 'get_balances', arguments: '{}' }, { id: 'two', name: 'get_official_channels', arguments: '{}' }]
    const final = '{"reply":"Ready","sourceIds":[],"questions":[]}'
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(style === 'openai'
      ? { choices: [{ message: { content: null, tool_calls: calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) } }] }
      : { content: calls.map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: {} })) })))
      .mockResolvedValueOnce(new Response(JSON.stringify(style === 'openai' ? { choices: [{ message: { content: final } }] } : { content: [{ type: 'text', text: final }] })))
    const definitions = calls.map(({name}) => ({ name, description: 'Read only', parameters: { type: 'object', properties: {}, additionalProperties: false } }))
    const tools = { definitions: () => definitions, execute: jest.fn(async (..._args: any[]) => ({ amount: '1 USDT' })) }
    expect((await runAiToolTurn(model, tools as any, OWNER, 'Return JSON', [{ role: 'user', content: 'My balance and help' }], Date.now()+10000)).text).toBe(final)
    const first = JSON.parse(String(fetch.mock.calls[0][1]?.body)), second = JSON.parse(String(fetch.mock.calls[1][1]?.body))
    if (style === 'openai') {
      expect(first.tools[0]).toMatchObject({ type: 'function', function: definitions[0] })
      expect(first.response_format).toBeUndefined()
      expect(second.messages[2].tool_calls).toHaveLength(2)
      expect(second.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'one' })
      expect(second.messages[4]).toMatchObject({ role: 'tool', tool_call_id: 'two' })
    } else {
      expect(first.tools[0]).toMatchObject({ name: 'get_balances', input_schema: definitions[0].parameters })
      expect(second.messages[1].content.map((b: any) => b.type)).toEqual(['tool_use','tool_use'])
      expect(second.messages[2]).toMatchObject({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'one' }, { type: 'tool_result', tool_use_id: 'two' }] })
      expect(second.messages).toHaveLength(3)
    }
    expect(tools.execute.mock.calls.map(args => args[0])).toEqual([OWNER, OWNER])
  })
})
