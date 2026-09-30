import { Injectable, Logger } from '@nestjs/common'

/**
 * 行情缓存层 — 分级 TTL + SWR + 随机抖动 + 熔断
 *
 * 按圆桌第 3 场裁定：
 * - Yahoo：开盘期 60s，闭市后 5–15 分钟
 * - CoinGecko：30–60s
 * - Frankfurter：6h（日频）
 * - DefiLlama：5–15 分钟
 * - SWR、刷新锁、随机抖动、指数退避、熔断，防止缓存击穿
 * - 供应商失败时保留最后成功值（标 stale），无旧值则返回 null —— 绝不用 Demo 数字冒充
 */

interface CacheEntry<T> {
  value: T
  storedAt: number
  ttlMs: number
  /** 宽限期：TTL 过后仍可作为 stale 值返回，并用 SWR 后台刷新 */
  staleTtlMs: number
  refreshing: boolean
  consecutiveFailures: number
  /** 熔断打开时间（毫秒时间戳），冷却期内不再发起请求 */
  circuitOpenUntil: number
}

export interface CacheReadResult<T> {
  value: T | null
  /** true 表示返回的是过期旧值 */
  stale: boolean
  /** 数据最后成功刷新的时间 */
  lastOkAt: number | null
  /** 本次是否走了熔断（未发请求） */
  circuitOpen: boolean
}

@Injectable()
export class MarketCacheService {
  private readonly log = new Logger(MarketCacheService.name)
  private readonly store = new Map<string, CacheEntry<unknown>>()
  private readonly circuitCooldownMs = 60_000
  private readonly circuitFailureThreshold = 3

  /** TTL 抖动 ±10%，避免多实例/多 key 同步过期造成缓存击穿风暴 */
  private jitter(ttlMs: number): number {
    const factor = 0.9 + Math.random() * 0.2
    return Math.round(ttlMs * factor)
  }

  /**
   * 读取缓存；miss 时用 fetcher 同步抓取。
   * - 命中新鲜值：直接返回
   * - 过期但仍在宽限期：先返回 stale 旧值，同时后台刷新（SWR）
   * - 无旧值或过了宽限期：同步抓取；抓取失败则（如有旧值）返回 stale
   */
  async getOrFetch<T>(
    key: string,
    ttlMs: number,
    staleTtlMs: number,
    fetcher: () => Promise<T | null>,
  ): Promise<CacheReadResult<T>> {
    const now = Date.now()
    const entry = this.store.get(key) as CacheEntry<T> | undefined

    if (entry) {
      const age = now - entry.storedAt
      if (age < entry.ttlMs) {
        return { value: entry.value, stale: false, lastOkAt: entry.storedAt, circuitOpen: false }
      }
      // 过期但在宽限期内：SWR 返回旧值 + 后台刷新
      if (age < entry.ttlMs + entry.staleTtlMs) {
        this.backgroundRefresh(key, entry, fetcher)
        return { value: entry.value, stale: true, lastOkAt: entry.storedAt, circuitOpen: false }
      }
    }

    // 熔断检查
    if (entry && now < entry.circuitOpenUntil) {
      this.log.warn(`熔断中，跳过抓取: ${key}`)
      return { value: entry.value, stale: true, lastOkAt: entry.storedAt, circuitOpen: true }
    }

    // 同步抓取（带刷新锁：已有同 key 在刷新时避免并发重复抓取）
    if (entry?.refreshing) {
      return { value: entry.value, stale: true, lastOkAt: entry.storedAt, circuitOpen: false }
    }

    const result = await this.doFetch(key, ttlMs, staleTtlMs, fetcher, entry)
    return result
  }

  private backgroundRefresh<T>(key: string, entry: CacheEntry<T>, fetcher: () => Promise<T | null>): void {
    if (entry.refreshing) return
    if (Date.now() < entry.circuitOpenUntil) return
    entry.refreshing = true
    void this.doFetch(key, entry.ttlMs, entry.staleTtlMs, fetcher, entry).finally(() => {
      const latest = this.store.get(key) as CacheEntry<T> | undefined
      if (latest) latest.refreshing = false
    })
  }

  private async doFetch<T>(
    key: string,
    ttlMs: number,
    staleTtlMs: number,
    fetcher: () => Promise<T | null>,
    previous: CacheEntry<T> | undefined,
  ): Promise<CacheReadResult<T>> {
    try {
      const value = await fetcher()
      if (value === null || value === undefined) {
        // fetcher 返回 null 视为本次失败（保留旧值）
        return this.onFailure(key, previous)
      }
      const entry: CacheEntry<T> = {
        value,
        storedAt: Date.now(),
        ttlMs: this.jitter(ttlMs),
        staleTtlMs,
        refreshing: false,
        consecutiveFailures: 0,
        circuitOpenUntil: 0,
      }
      this.store.set(key, entry as CacheEntry<unknown>)
      return { value, stale: false, lastOkAt: entry.storedAt, circuitOpen: false }
    } catch (err) {
      this.log.warn(`抓取失败 ${key}: ${(err as Error).message}`)
      return this.onFailure(key, previous)
    }
  }

  private onFailure<T>(key: string, previous: CacheEntry<T> | undefined): CacheReadResult<T> {
    if (!previous) {
      return { value: null, stale: true, lastOkAt: null, circuitOpen: false }
    }
    const failures = previous.consecutiveFailures + 1
    previous.consecutiveFailures = failures
    if (failures >= this.circuitFailureThreshold) {
      previous.circuitOpenUntil = Date.now() + this.circuitCooldownMs
      this.log.warn(`熔断打开（连续 ${failures} 次失败）: ${key}`)
    }
    return { value: previous.value, stale: true, lastOkAt: previous.storedAt, circuitOpen: failures >= this.circuitFailureThreshold }
  }

  /** 调试/测试用：清空缓存 */
  clear(): void {
    this.store.clear()
  }
}
