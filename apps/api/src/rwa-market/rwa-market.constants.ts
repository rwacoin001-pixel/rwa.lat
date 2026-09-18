/** RWA 数据源注入令牌（模块内 provider 抽象；测试可注入 fake） */
export const RWA_DATA_PROVIDER = 'RWA_DATA_PROVIDER'

/** RWA 同步任务队列名 */
export const RWA_MARKET_SYNC_QUEUE = 'rwa-market-sync'

/** 同步防重入 advisory lock key（session 级，绑定专用连接） */
export const RWA_SYNC_LOCK_KEY = 972_100_001

/** 同步种类（与 rwa_sync_runs.kind 约束一致） */
export const RWA_SYNC_KINDS = ['issuers', 'assets', 'metrics', 'snapshot'] as const
export type RwaSyncKind = (typeof RWA_SYNC_KINDS)[number]

export function isRwaSyncKind(value: unknown): value is RwaSyncKind {
  return typeof value === 'string' && (RWA_SYNC_KINDS as readonly string[]).includes(value)
}
