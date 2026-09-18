import { Injectable, Logger } from '@nestjs/common'
import type { CmcStatus } from './coinmarketcap.types'

export type CmcErrorKind = 'auth' | 'plan' | 'validation' | 'rate_limit' | 'http' | 'network'

export class CmcProviderError extends Error {
  constructor(
    readonly kind: CmcErrorKind,
    readonly status: number | null,
    readonly code: string | null,
    message: string,
  ) {
    super(message)
    this.name = 'CmcProviderError'
  }
}

function classify(status: number, code: string | null): CmcErrorKind {
  if (code === '1006') return 'plan'
  if (status === 401) return 'auth'
  if (status === 403) return 'plan'
  if (status === 429) return 'rate_limit'
  if (status >= 400 && status < 500) return 'validation'
  return 'http'
}

function bounded(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * CoinMarketCap Pro API 薄客户端（RWA 家族）：
 * - Key 只从环境变量读取（不落日志）
 * - 统一超时（AbortController）+ 结构化错误（auth/plan/validation/rate_limit/...）
 * - **请求节流**：Basic 档有每分钟 HTTP 请求上限（实测全量分页会触发 429）——
 *   串行请求最小间隔 CMC_MIN_REQUEST_INTERVAL_MS（默认 2200ms ≈ 27 req/min）
 * - **429 自动退避**：命中速率限制等待 25s 重试（≤3 次），再失败才抛错
 * - 串行调用由上层控制（规格 §85：并发 ≤3-5）
 */
@Injectable()
export class CoinMarketCapClient {
  private readonly log = new Logger(CoinMarketCapClient.name)
  private readonly apiKey = (process.env.CMC_API_KEY ?? '').trim()
  private readonly baseUrl = (process.env.CMC_API_BASE_URL ?? 'https://pro-api.coinmarketcap.com').replace(/\/+$/, '')
  private readonly timeoutMs = bounded(process.env.CMC_TIMEOUT_MS, 20_000, 2_000, 60_000)
  private readonly minIntervalMs = bounded(process.env.CMC_MIN_REQUEST_INTERVAL_MS, 2_200, 0, 60_000)
  private lastRequestAt = 0

  isConfigured(): boolean {
    return this.apiKey.length > 0
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - Date.now()
    if (wait > 0) await sleep(wait)
    this.lastRequestAt = Date.now()
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new CmcProviderError('auth', null, null, 'CMC_API_KEY is not configured')
    }
    const qs = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&')
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await this.throttle()
      try {
        return await this.fetchOnce<T>(path, url)
      } catch (error) {
        if (error instanceof CmcProviderError && error.kind === 'rate_limit' && attempt < 3) {
          this.log.warn(`CMC rate limit hit on ${path}; backing off 25s (attempt ${attempt + 1}/3)`)
          await sleep(25_000)
          continue
        }
        throw error
      }
    }
    throw new CmcProviderError('rate_limit', null, null, `CMC ${path} exceeded the request rate limit`)
  }

  private async fetchOnce<T>(path: string, url: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(url, {
        headers: { 'X-CMC_PRO_API_KEY': this.apiKey, accept: 'application/json' },
        signal: controller.signal,
      })
      const body = (await response.json().catch(() => null)) as { data?: T; status?: CmcStatus } | null
      if (!response.ok) {
        const code = body?.status?.error_code ?? null
        const message = body?.status?.error_message ?? `http ${response.status}`
        throw new CmcProviderError(classify(response.status, code), response.status, code, `CMC ${path} failed: ${message}`)
      }
      if (!body || body.data === undefined || body.data === null) {
        throw new CmcProviderError('http', response.status, null, `CMC ${path} returned empty data`)
      }
      return body.data
    } catch (error) {
      if (error instanceof CmcProviderError) throw error
      if ((error as Error).name === 'AbortError') {
        throw new CmcProviderError('network', null, null, `CMC ${path} timed out after ${this.timeoutMs}ms`)
      }
      throw new CmcProviderError('network', null, null, `CMC ${path} network error: ${(error as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  }
}
