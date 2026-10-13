import type { ConfigService } from '@nestjs/config'

/**
 * On-demand deposit watching. Opening the deposit page (or tapping "check now") opens a watch
 * window during which the user's address is scanned every watchScanSeconds; afterwards scans back
 * off (5 min, 15 min, 1 h within 24 h) to an idle sweep every idleScanMinutes. The watcher wakes
 * every tickMs but only calls TRON for addresses that are due or for in-flight confirmations.
 */
export interface DepositWatchPolicy {
  watchMinutes: number
  watchScanSeconds: number
  idleScanMinutes: number
  tickMs: number
}

export const DEPOSIT_WATCH_LIMITS = {
  watchMinutes: { fallback: 60, min: 5, max: 240 },
  watchScanSeconds: { fallback: 30, min: 15, max: 300 },
  idleScanMinutes: { fallback: 360, min: 30, max: 1_440 },
  tickMs: { fallback: 15_000, min: 5_000, max: 120_000 },
} as const

export function readDepositWatchPolicy(config: ConfigService): DepositWatchPolicy {
  const read = (key: string, limit: { fallback: number; min: number; max: number }) => {
    const raw = config.get<string>(key)?.trim()
    if (!raw || !/^\d+$/.test(raw)) return limit.fallback
    const value = Number(raw)
    return Number.isSafeInteger(value) && value >= limit.min && value <= limit.max ? value : limit.fallback
  }
  return {
    watchMinutes: read('WALLET_DEPOSIT_WATCH_MINUTES', DEPOSIT_WATCH_LIMITS.watchMinutes),
    watchScanSeconds: read('WALLET_DEPOSIT_WATCH_SCAN_SECONDS', DEPOSIT_WATCH_LIMITS.watchScanSeconds),
    idleScanMinutes: read('WALLET_DEPOSIT_IDLE_SCAN_MINUTES', DEPOSIT_WATCH_LIMITS.idleScanMinutes),
    tickMs: read('WALLET_CHAIN_WATCHER_TICK_MS', DEPOSIT_WATCH_LIMITS.tickMs),
  }
}
