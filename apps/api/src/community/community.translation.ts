import { Injectable, Logger } from '@nestjs/common'

/**
 * LLM-backed translation client for community content.
 * Provider is configured through environment variables so the deployment can
 * swap engines without a code change:
 *   TRANSLATION_BASE_URL (default: https://api.deepseek.com)
 *   TRANSLATION_API_KEY
 *   TRANSLATION_MODEL    (default: deepseek-chat)
 *   TRANSLATION_TIMEOUT_MS (default: 25000)
 */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  zh: 'Simplified Chinese',
  'zh-Hans': 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese',
  hi: 'Hindi',
  es: 'Spanish',
  ar: 'Arabic',
  fr: 'French',
  pt: 'Portuguese',
  ja: 'Japanese',
}

@Injectable()
export class CommunityTranslationProvider {
  private readonly logger = new Logger(CommunityTranslationProvider.name)
  private readonly apiKey = (process.env.TRANSLATION_API_KEY ?? '').trim()
  private readonly baseUrl = (process.env.TRANSLATION_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, '')
  private readonly model = process.env.TRANSLATION_MODEL ?? 'deepseek-chat'
  private readonly timeoutMs = Number(process.env.TRANSLATION_TIMEOUT_MS ?? '25000')

  isConfigured(): boolean {
    return this.apiKey.length > 0
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    const sourceName = LANGUAGE_NAMES[sourceLang] ?? sourceLang
    const targetName = LANGUAGE_NAMES[targetLang] ?? targetLang
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
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                `You translate social community posts. Translate from ${sourceName} to ${targetName}. ` +
                'Preserve tone, slang, emoji, line breaks and formatting. Keep tickers, handles and product names as-is. ' +
                'Return ONLY the translation, with no quotes and no commentary.',
            },
            { role: 'user', content: text },
          ],
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`translation provider http ${response.status}`)
      }
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const translated = payload.choices?.[0]?.message?.content?.trim()
      if (!translated) throw new Error('translation provider returned empty content')
      return translated
    } catch (error) {
      this.logger.warn(`translation request failed: ${(error as Error).message}`)
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}
