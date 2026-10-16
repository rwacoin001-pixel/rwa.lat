/** Compatibility facade for the existing prediction detail screen. */
import { request as http, getSessionToken } from './api/_http'
import { fmtQty, toAtomic as atomic } from './money'
export class RwaApiError extends Error {
  constructor(public status: number, public code: string | null, message: string) { super(message); this.name = 'RwaApiError' }
}
export function hasSession(): boolean { return Boolean(getSessionToken()) }
async function request<T>(method: string, path: string, options: { body?: unknown; auth?: boolean } = {}): Promise<T> {
  const token = options.auth ? getSessionToken() : null
  if (options.auth && !token) throw new RwaApiError(401, 'NO_SESSION', 'Please sign in again.')
  const result = await http<T>(path, { method, token, body: options.body === undefined ? undefined : JSON.stringify(options.body) })
  if (!result.ok) throw new RwaApiError(result.error.status, result.error.code, result.error.message)
  return result.data
}

export type PredictionLimits = {
  maxStakeAtomic: string
  maxDailyStakeAtomic: string
  maxMarketExposureAtomic: string
  slippageBps: string | number
  assetDecimals: number
}

/** A+C 混合收费：下注费（place）+ 派彩费（payout）。以服务端 /v1/predictions/status 为权威。 */
export type PredictionFees = {
  placeFeeBps: number
  payoutFeeBps: number
  placeFeeRate: number
  payoutFeeRate: number
  assetDecimals: number
}

export type PredictionStatus = {
  enabled: boolean
  mode: string
  limits: PredictionLimits
  /** 旧后端可能不返回；缺失时必须退化为不收费显示，而不是崩掉。 */
  fees?: PredictionFees
}

export type PredictionBet = {
  id: string
  marketMappingId: string
  tokenId: string
  side: string
  stakeAtomic: string
  feeAtomic?: string
  payoutFeeAtomic?: string
  riskStakeAtomic?: string
  shares: string
  price: string
  status: 'placed' | 'won' | 'lost' | 'void' | string
  /** toBetView() 返回；市场映射查不到时为 null，旧后端则缺失。 */
  marketQuestion?: string | null
  marketSlug?: string | null
  /** Market id for /prediction/[id]; the slug is not accepted there. */
  marketId?: string | null
  /** Event id: the markets page opens /prediction/event-<id> for it. */
  marketEventId?: string | null
  tokenOutcome?: string | null
  settledAt: string | null
  createdAt: string
}

export const predictionApi = {
  status() {
    return request<PredictionStatus>('GET', '/v1/predictions/status')
  },

  myBets(page = 1, limit = 20) {
    return request<{ total: number; page: number; limit: number; items: PredictionBet[] }>(
      'GET',
      `/v1/predictions/bets?page=${page}&limit=${limit}`,
      { auth: true },
    )
  },

  placeBet(input: { tokenId: string; stakeAtomic: string; expectedPrice?: string; idempotencyKey: string }) {
    return request<PredictionBet & { duplicate?: boolean }>('POST', '/v1/predictions/bets', {
      auth: true,
      body: input,
    })
  },
}

// ---------------- 小工具 ----------------

/** atomic(1e6) → 展示用数值字符串 */
export function formatUsdtFromAtomic(atomic: string | number, digits = 2): string {
  return fmtQty(String(atomic), 6, digits)
}

/** 数值 → atomic 字符串（整数微单位） */
export function toAtomic(input: string, decimals = 6): string {
  return atomic(input.trim(), decimals) ?? '0'
}

/** 生成请求幂等键（浏览器环境） */
export function newIdempotencyKey(prefix = 'web'): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${rand}`
}
