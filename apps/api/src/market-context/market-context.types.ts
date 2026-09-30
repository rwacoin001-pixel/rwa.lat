/**
 * Market Context — 统一行情适配层类型定义
 *
 * 按圆桌第 3 场裁定：
 * - 前端禁止直连供应商，全部经本适配层输出
 * - 每条行情带 symbol/value/unit/change/changePeriod/source/asOf/receivedAt/marketStatus/stale/quoteId
 * - 失败保留最后成功值并标 stale，无值显示 null（前端渲染 "—"），绝不用 Demo 数字冒充
 */

export type MarketAssetClass = 'rates' | 'fx' | 'commodity' | 'index' | 'crypto' | 'onchain' | 'volatility'

export type MarketStatus = 'open' | 'closed' | 'delayed' | 'stale' | 'unknown'

export interface MarketQuote {
  /** 标准化符号，如 ^TNX / DX-Y.NYB / GC=F / BTC */
  symbol: string
  /** 展示名称（中文） */
  name: string
  /** 数值（null = 无可靠数据，前端显示 —） */
  value: number | null
  /** 单位/口径，如 'yield%' / 'index' / 'USD' */
  unit: string
  /** 变动值（绝对值） */
  change: number | null
  /** 变动百分比 */
  changePct: number | null
  /** 变动周期描述，如 '1d' */
  changePeriod: string
  /** 数据源标识，如 'Yahoo Finance' / 'Frankfurter (ECB)' */
  source: string
  /** 数据本身的时点（供应商口径）ISO 8601 */
  asOf: string | null
  /** 本服务抓取时间 ISO 8601 */
  receivedAt: string
  /** 市场状态 */
  marketStatus: MarketStatus
  /** 是否过期（超过该源 freshness 阈值） */
  stale: boolean
  /** 报价ID（审计用：symbol+asOf+source 哈希前缀） */
  quoteId: string
  /** 资产类别 */
  assetClass: MarketAssetClass
  /** 免责标注（前端必须展示） */
  disclaimer: string
}

export interface MarketContextResponse {
  /** 宏观锚 2×2 矩阵（裁定：^TNX / DX-Y.NYB / GC=F / ^GSPC） */
  anchors: MarketQuote[]
  /** 第二行：黄金 + BTC/ETH */
  secondary: MarketQuote[]
  /** 滚动区模块 */
  sections: {
    tradfi: MarketQuote[]
    fx: MarketQuote[]
    crypto: MarketQuote[]
    onchain: OnchainMetric[]
  }
  /** USDT 脱锚状态（裁定：直接影响入金安全） */
  usdtPeg: UsdtPegStatus | null
  /** 服务端时间 */
  serverTime: string
  /** 本次响应是否有任何降级 */
  degraded: boolean
  /** 降级说明（如某源不可达） */
  degradedReasons: string[]
}

export interface OnchainMetric {
  symbol: string
  name: string
  value: number | null
  unit: string
  change7d: number | null
  change30d: number | null
  source: string
  asOf: string | null
  stale: boolean
}

export interface UsdtPegStatus {
  price: number | null
  /** 偏离 1 美元的幅度（bps） */
  deviationBps: number | null
  status: 'ok' | 'warning' | 'depegged' | 'unknown'
  source: string
  asOf: string | null
  note: string
}

/** 供应商抓取原始结果 */
export interface ProviderFetchResult<T = MarketQuote[]> {
  ok: boolean
  data: T
  error?: string
}
