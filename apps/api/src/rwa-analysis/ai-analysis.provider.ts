import { Injectable, Logger } from '@nestjs/common'

export type AiAnalysisPayload = {
  summary: string | null
  bull_case: string | null
  bear_case: string | null
  risk_summary: string | null
  liquidity_analysis: string | null
  issuer_analysis: string | null
  redemption_analysis: string | null
  contract_analysis: string | null
  structured_signals: Record<string, unknown> | null
}

export type AiAnalysisInput = {
  name: string
  symbol: string | null
  assetClass: string
  issuerName: string | null
  description: string | null
  metrics: Record<string, string | null>
  score: Record<string, unknown> | null
}

/**
 * LLM 研究分析师（规格 §29-37；AI 只产出研究文本与信号，不控制资产交易 §9）：
 * - 复用 DeepSeek：RWA_AI_* → TRANSLATION_* → 默认 api.deepseek.com
 * - 输出 STRICT JSON（容错解析）；禁收益承诺/投资建议措辞（§74 禁词纪律）
 */
@Injectable()
export class AiAnalysisProvider {
  private readonly log = new Logger(AiAnalysisProvider.name)
  readonly model: string
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor() {
    this.apiKey = (process.env.RWA_AI_API_KEY ?? process.env.TRANSLATION_API_KEY ?? '').trim()
    this.baseUrl = (process.env.RWA_AI_BASE_URL ?? process.env.TRANSLATION_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, '')
    this.model = process.env.RWA_AI_MODEL ?? process.env.TRANSLATION_MODEL ?? 'deepseek-chat'
    this.timeoutMs = Number(process.env.RWA_AI_TIMEOUT_MS ?? '45000')
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0
  }

  async analyze(input: AiAnalysisInput): Promise<AiAnalysisPayload> {
    if (!this.isConfigured()) {
      throw new Error('RWA AI provider is not configured (RWA_AI_API_KEY / TRANSLATION_API_KEY missing)')
    }
    const prompt = buildPrompt(input)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content:
                'You are an institutional RWA (real-world asset) research analyst producing due-diligence notes. ' +
                'You never promise returns, never give investment advice, and never invent facts not present in the input. ' +
                'Return ONLY a strict JSON object (no markdown fences, no commentary) with exactly these keys: ' +
                'summary, bull_case, bear_case, risk_summary, liquidity_analysis, issuer_analysis, redemption_analysis, contract_analysis, ' +
                'signals (object with keys: sentiment (one of "bullish"|"neutral"|"bearish"), key_risks (array of short strings), ' +
                'catalysts (array of short strings), confidence (number 0-1)). ' +
                'Every textual field must be 1-4 sentences of plain professional prose (no bullet symbols inside strings).',
            },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`RWA AI provider http ${response.status}`)
      }
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = payload.choices?.[0]?.message?.content?.trim()
      if (!content) throw new Error('RWA AI provider returned empty content')
      return parseAnalysisJson(content)
    } catch (error) {
      this.log.warn(`RWA AI request failed: ${(error as Error).message}`)
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}

function buildPrompt(input: AiAnalysisInput): string {
  const metrics = Object.entries(input.metrics)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  const description = input.description ? input.description.slice(0, 1500) : 'No description available.'
  return [
    `Analyze this tokenized real-world asset for a professional research note.`,
    `Name: ${input.name}${input.symbol ? ` (${input.symbol})` : ''}`,
    `Asset class: ${input.assetClass}`,
    `Issuer: ${input.issuerName ?? 'Unknown'}`,
    `Description: ${description}`,
    metrics ? `Market data:\n${metrics}` : 'Market data: unavailable',
    input.score ? `Quant scores: ${JSON.stringify(input.score)}` : 'Quant scores: not yet available',
    'Write the JSON now.',
  ].join('\n\n')
}

/** 容错解析：剥离 markdown 围栏/前后缀，取第一个完整 JSON 对象 */
export function parseAnalysisJson(content: string): AiAnalysisPayload {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        parsed = null
      }
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('RWA AI provider returned unparseable JSON')
  }
  const text = (key: string): string | null => {
    const value = parsed?.[key]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
  const signals = parsed.signals
  return {
    summary: text('summary'),
    bull_case: text('bull_case'),
    bear_case: text('bear_case'),
    risk_summary: text('risk_summary'),
    liquidity_analysis: text('liquidity_analysis'),
    issuer_analysis: text('issuer_analysis'),
    redemption_analysis: text('redemption_analysis'),
    contract_analysis: text('contract_analysis'),
    structured_signals: signals && typeof signals === 'object' ? (signals as Record<string, unknown>) : null,
  }
}
