import { Injectable, ServiceUnavailableException, BadGatewayException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type AiToolCall = { id: string; name: string; arguments: string }
export type AiTurn = { role: 'user' | 'assistant' | 'tool'; content: string; calls?: AiToolCall[]; callId?: string }
const TOOLS = [
  { name: 'describe_schema', description: 'List available ai_ro views, columns, meanings and units. Always inspect before SQL.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'run_sql', description: 'Execute one read-only SELECT/WITH over ai_ro views. At most 500 rows; 5 second timeout.', parameters: { type: 'object', properties: { sql: { type: 'string', maxLength: 20000 } }, required: ['sql'], additionalProperties: false } },
]

/** Adapted from the core AiModelClient: same AI_MODEL_* configuration, bounded tool calls, no provider error bodies. */
@Injectable()
export class AdminAiModelClient {
  constructor(private readonly config: ConfigService) {}
  async complete(system: string, turns: AiTurn[], budgetMs: number): Promise<{ text: string; calls: AiToolCall[] }> {
    const endpoint = (this.config.get<string>('AI_MODEL_ENDPOINT') ?? '').trim().replace(/\/+$/, '')
    const key = this.config.get<string>('AI_MODEL_API_KEY') ?? ''
    if (!endpoint || !key) throw new ServiceUnavailableException({ code: 'AI_MODEL_NOT_CONFIGURED', message: '数据 AI 尚未配置大模型服务。' })
    const model = this.config.get<string>('AI_MODEL_NAME') || 'deepseek-chat'
    const explicit = this.config.get<string>('AI_MODEL_API_STYLE')?.trim().toLowerCase()
    if (explicit && !['openai', 'anthropic'].includes(explicit)) throw new ServiceUnavailableException({ code: 'AI_MODEL_CONFIG_INVALID', message: '大模型接口配置无效。' })
    const style = explicit || (/deepseek|openai|siliconflow|moonshot|dashscope|integrate\.api\.nvidia\.com/i.test(endpoint) && !/\/anthropic(?:\/|$)/i.test(endpoint) ? 'openai' : 'anthropic')
    const timeout = Number(this.config.get<string>('AI_MODEL_TIMEOUT_MS') || '20000')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(Number.isFinite(timeout) ? timeout : 20000, budgetMs, 20000)))
    try {
      const messages = style === 'openai' ? [
        { role: 'system', content: system },
        ...turns.map(t => ({ role: t.role, content: t.content, ...(t.callId ? { tool_call_id: t.callId } : {}),
          ...(t.calls?.length ? { tool_calls: t.calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) } : {}) })),
      ] : turns.map(t => t.role === 'tool'
        ? { role: 'user', content: [{ type: 'tool_result', tool_use_id: t.callId, content: t.content }] }
        : { role: t.role, content: [ ...(t.content ? [{ type: 'text', text: t.content }] : []), ...(t.calls ?? []).map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: JSON.parse(c.arguments) })) ] })
      // Anthropic requires consecutive tool results in one user message.
      if (style === 'anthropic') for (let i = messages.length - 1; i > 0; i--) {
        const current = messages[i] as any, previous = messages[i - 1] as any
        if (current.role === previous.role && Array.isArray(current.content) && Array.isArray(previous.content)) {
          previous.content.push(...current.content); messages.splice(i, 1)
        }
      }
      const response = await fetch(style === 'openai' ? `${endpoint}/chat/completions` : `${endpoint}${/\/v1$/i.test(endpoint) ? '' : '/v1'}/messages`, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', 'user-agent': this.config.get<string>('AI_MODEL_USER_AGENT') || 'a-reit-admin/1.0',
          ...(style === 'openai' ? { authorization: `Bearer ${key}` } : { 'x-api-key': key, 'anthropic-version': '2023-06-01' }) },
        body: JSON.stringify({ model, max_tokens: 2048, messages,
          ...(style === 'openai' ? { tools: TOOLS.map(tool => ({ type: 'function', function: tool })),
            ...(/^https:\/\/api\.deepseek\.com(?:\/|$)/i.test(endpoint) && /flash/i.test(model) ? { thinking: { type: 'disabled' } } : {}),
            ...(/^https:\/\/integrate\.api\.nvidia\.com(?:\/|$)/i.test(endpoint) && /flash/i.test(model) ? { chat_template_kwargs: { thinking: false } } : {}),
          } : { system, tools: TOOLS.map(({ parameters, ...tool }) => ({ ...tool, input_schema: parameters })) }),
        }),
      })
      if (!response.ok) throw new Error('Provider rejected request')
      const raw = await response.text()
      if (raw.length > 128_000) throw new Error('Provider response too large')
      const payload = JSON.parse(raw)
      const message = payload.choices?.[0]?.message
      const text = style === 'openai' ? message?.content ?? '' : (payload.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      const calls: AiToolCall[] = style === 'openai'
        ? (message?.tool_calls ?? []).map((c: any) => ({ id: c.id, name: c.function?.name, arguments: c.function?.arguments }))
        : (payload.content ?? []).filter((b: any) => b.type === 'tool_use').map((b: any) => ({ id: b.id, name: b.name, arguments: JSON.stringify(b.input) }))
      if (typeof text !== 'string' || calls.length > 8 || calls.some(c => typeof c.id !== 'string' || typeof c.name !== 'string' || typeof c.arguments !== 'string' || c.arguments.length > 24000) || (!text && !calls.length)) throw new Error('Invalid provider response')
      return { text: text.slice(0, 8000), calls }
    } catch {
      throw new BadGatewayException({ code: 'AI_MODEL_UNAVAILABLE', message: '大模型暂时无法完成查询，请稍后重试。' })
    } finally { clearTimeout(timer) }
  }
}
