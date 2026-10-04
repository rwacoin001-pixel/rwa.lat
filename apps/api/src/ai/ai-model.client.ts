import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface AiModelMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

export interface AiModelReply {
  text: string
  model: string
  usage?: { inputTokens?: number; outputTokens?: number }
}

/**
 * OpenAI/Anthropic-compatible client for the configured AI provider.
 * Configured via AI_MODEL_* env vars; disabled (503 upstream) when absent.
 */
@Injectable()
export class AiModelClient {
  private readonly logger = new Logger(AiModelClient.name)
  private readonly endpoint: string
  private readonly apiKey: string
  private readonly model: string
  private readonly userAgent: string
  private readonly timeoutMs: number
  private readonly apiStyle: 'anthropic' | 'openai'

  constructor(private readonly config: ConfigService) {
    this.endpoint = (config.get<string>('AI_MODEL_ENDPOINT') ?? '').trim().replace(/\/+$/, '')
    this.apiKey = config.get<string>('AI_MODEL_API_KEY') ?? ''
    this.model = config.get<string>('AI_MODEL_NAME') ?? 'deepseek-chat'
    this.userAgent = config.get<string>('AI_MODEL_USER_AGENT') ?? 'rwa-lat-api/1.0'
    this.timeoutMs = Number(config.get<string>('AI_MODEL_TIMEOUT_MS') ?? '90000')
    // API style: explicit AI_MODEL_API_STYLE wins; otherwise infer from endpoint.
    const explicit = (config.get<string>('AI_MODEL_API_STYLE') ?? '').trim().toLowerCase()
    if (explicit === 'openai' || explicit === 'anthropic') {
      this.apiStyle = explicit
    } else {
      if (explicit) throw new Error('AI_MODEL_API_STYLE must be openai or anthropic')
      this.apiStyle = /deepseek|openai|siliconflow|moonshot|dashscope|integrate\.api\.nvidia\.com/i.test(this.endpoint) && !/\/anthropic(?:\/|$)/i.test(this.endpoint)
        ? 'openai'
        : 'anthropic'
    }
  }

  get configured(): boolean {
    return Boolean(this.endpoint && this.apiKey)
  }

  get modelName(): string {
    return this.model
  }

  get visionAvailable(): boolean {
    return this.configured && (this.config.get<string>('AI_MODEL_VISION_ENABLED') === 'true'
      || (/^https:\/\/api\.deepseek\.com(?:\/v1)?$/i.test(this.endpoint) && /^deepseek-(?:flash|v4-flash(?:-vision-exp)?)$/i.test(this.model)))
  }

  get providerName(): string {
    try {
      const host = new URL(this.endpoint).hostname.toLowerCase()
      if (host === 'api.deepseek.com') return 'DeepSeek'
      if (host === 'api.openai.com') return 'OpenAI'
      if (host === 'api.anthropic.com') return 'Anthropic'
      if (host === 'integrate.api.nvidia.com') return 'NVIDIA'
    } catch {
      // The configured endpoint is not a public identity claim.
    }
    return 'the configured AI provider'
  }

  async complete(system: string, messages: AiModelMessage[], maxTokens = 2048, json = false, budgetMs?: number): Promise<AiModelReply> {
    if (!this.configured) {
      throw new Error('AI model is not configured')
    }
    if (messages.some(message => message.images?.length) && !this.visionAvailable) throw new Error('AI image input is unavailable for this provider')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, budgetMs ?? this.timeoutMs))
    try {
      // JSON mode can occasionally deliver empty content. Retry only this
      // read-only generation once, within the original timeout budget.
      for (let attempt = 0; attempt < 2; attempt++) {
        const deliverySystem = attempt === 0 ? system : `${system}\nReturn a complete, non-empty JSON object matching the output contract. Keep the reply brief and include the required fields. Do not output whitespace or commentary outside JSON.`
        const response =
          this.apiStyle === 'openai'
            ? await fetch(`${this.endpoint}/chat/completions`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                  'content-type': 'application/json',
                  authorization: `Bearer ${this.apiKey}`,
                  'user-agent': this.userAgent,
                },
                body: JSON.stringify({
                  model: this.model,
                  max_tokens: maxTokens,
                  ...(/^https:\/\/api\.deepseek\.com(?:\/|$)/i.test(this.endpoint) && /flash/i.test(this.model)
                    ? { thinking: { type: 'disabled' } }
                    : {}),
                  // NVIDIA's DeepSeek Flash needs non-thinking output for
                  // structured translations and customer-service replies.
                  ...(/^https:\/\/integrate\.api\.nvidia\.com(?:\/|$)/i.test(this.endpoint) && /^deepseek-ai\/deepseek-v4.*flash/i.test(this.model)
                    ? { chat_template_kwargs: { thinking: false } }
                    : {}),
                  // On empty JSON-mode output, keep the strict JSON prompt but
                  // omit the provider's format constraint for the one fallback.
                  ...(json && attempt === 0 ? { response_format: { type: 'json_object' } } : {}),
                  messages: [
                    { role: 'system', content: deliverySystem },
                    ...messages.map((message) => ({ role: message.role, content: message.images?.length
                      ? [{ type: 'text', text: message.content }, ...message.images.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } }))]
                      : message.content })),
                  ],
                }),
              })
            : await fetch(`${this.endpoint}${/\/v1$/i.test(this.endpoint) ? '' : '/v1'}/messages`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                  'content-type': 'application/json',
                  'x-api-key': this.apiKey,
                  'anthropic-version': '2023-06-01',
                  'user-agent': this.userAgent,
                },
                body: JSON.stringify({
                  model: this.model,
                  max_tokens: maxTokens,
                  system,
                  messages: messages.map((message) => ({ role: message.role, content: message.images?.length
                    ? [{ type: 'text', text: message.content }, ...message.images.map(url => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: url.slice('data:image/jpeg;base64,'.length) } }))]
                    : message.content })),
                }),
              })
        if (!response.ok) {
          // Provider error bodies may contain credentials or request data.
          this.logger.warn(`AI model upstream HTTP ${response.status}`)
          throw new Error(`AI upstream error ${response.status}`)
        }
        const raw = (await response.json()) as Record<string, unknown>
        let text = ''
        let usedModel = this.model
        let inputTokens: number | undefined
        let outputTokens: number | undefined
        if (this.apiStyle === 'openai') {
          const payload = raw as {
            choices?: { message?: { content?: string } }[]
            model?: string
            usage?: { prompt_tokens?: number; completion_tokens?: number }
          }
          text = (payload.choices?.[0]?.message?.content ?? '').trim()
          usedModel = payload.model ?? this.model
          inputTokens = payload.usage?.prompt_tokens
          outputTokens = payload.usage?.completion_tokens
        } else {
          const payload = raw as {
            content?: { type?: string; text?: string }[]
            model?: string
            usage?: { input_tokens?: number; output_tokens?: number }
          }
          text = (payload.content ?? [])
            .filter((block) => block.type === 'text' && typeof block.text === 'string')
            .map((block) => block.text)
            .join('\n')
            .trim()
          usedModel = payload.model ?? this.model
          inputTokens = payload.usage?.input_tokens
          outputTokens = payload.usage?.output_tokens
        }
        if (!text && json && this.apiStyle === 'openai' && attempt === 0) {
          this.logger.warn('AI model returned empty JSON content; retrying once')
          continue
        }
        if (!text) {
          this.logger.warn('AI model returned an empty completion')
          throw new Error('AI upstream returned an empty completion')
        }
        return {
          text,
          model: usedModel,
          usage: { inputTokens, outputTokens },
        }
      }
      throw new Error('AI upstream returned an empty completion')
    } finally {
      clearTimeout(timer)
    }
  }
}
