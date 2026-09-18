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

/**
 * CoinMarketCap Pro API 薄客户端（RWA 家族）：
 * - Key 只从环境变量读取（不落日志）
 * - 统一超时（AbortController）+ 结构化错误（auth/plan/validation/rate_limit/...）
 * - 串行调用由上层控制（规格 §85：并发 ≤3-5）
 */
@Injectable()
export class CoinMarketCapClient {
  private readonly log = new Logger(CoinMarketCapClient.name)
  private readonly apiKey = (process.env.CMC_API_KEY ?? '').trim()
  private readonly baseUrl = (process.env.CMC_API_BASE_URL ?? 'https://pro-api.coinmarketcap.com').replace(/\/+$/, '')
  private readonly timeoutMs = bounded(process.env.CMC_TIMEOUT_MS, 20_000, 2_000, 60_000)

  isConfigured(): boolean {
    return this.apiKey.length > 0
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
