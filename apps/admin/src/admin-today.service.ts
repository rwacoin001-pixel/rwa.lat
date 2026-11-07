import { HttpException, Injectable, Logger, Optional } from '@nestjs/common'
import { AdminPredictionService } from './admin-prediction.service'
import type { AdminSessionActor } from './admin-auth.service'
import { AdminCommunityOpsService } from './admin-community-ops.service'
import { AdminCoreOpsService } from './admin-core-ops.service'
import { AdminQuantService } from './admin-quant.service'
import { AdminWalletOpsService } from './admin-wallet-ops.service'

export const TODAY_CACHE_MS = 15_000
/** A home page must not hang on one slow upstream; the item is shown as `error` instead. */
const ITEM_TIMEOUT_MS = 10_000
const LIST_LIMIT = 200
/** Queues whose dead jobs the operator still acts on (retired catalog queues are left out on purpose). */
export const DEAD_JOB_QUEUES = ['portfolio-market-value-snapshot']
/** The quant day must be entered and approved before this local time (product cutoff overrides it). */
const DEFAULT_QUANT_CUTOFF = '15:00'
const DEFAULT_QUANT_TIMEZONE = 'Asia/Singapore'
/** Below this the hot wallet cannot pay TRON energy/bandwidth for many more broadcasts. */
export const HOT_WALLET_MIN_TRX_SUN = 100_000_000n

export type ItemStatus = 'ok' | 'forbidden' | 'error'

export interface QueueItem {
  count: number
  oldestAt: string | null
  amountAtomic?: string | null
  assetCode?: string | null
  status: ItemStatus
}

export type QuantSettlementState = 'none' | 'draft' | 'approved' | 'posted'

export interface QuantSettlementItem extends QueueItem {
  productSlug: string | null
  tradeDate: string | null
  state: QuantSettlementState
  timezone: string
  cutoffAt: string | null
  overdue: boolean
}

export interface TodayQueues {
  withdrawalReview: QueueItem
  withdrawalExecute: QueueItem
  kyc: QueueItem
  quantSettlement: QuantSettlementItem
  communityQueue: QueueItem
  communityReports: QueueItem
  supportTickets: QueueItem
  mail: QueueItem
  accountClosures: QueueItem
  ledgerAdjustments: QueueItem
  approvals: QueueItem
  teamBatches: QueueItem
  predictionSettlements: QueueItem & { workerHealthy?: boolean; auditHealthy?: boolean; reconciliationMismatches?: number; failed?: number; review?: number }
  deadJobs: QueueItem
}

export interface TodaySeriesDay { day: string; depositsAtomic: string; withdrawalsAtomic: string; netAtomic: string }

export interface TodaySummary {
  assetCode: string
  timezone: string | null
  deposits: { count: number; amountAtomic: string } | null
  withdrawals: { count: number; amountAtomic: string } | null
  netAtomic: string | null
  activeUsers: number | null
  registrations: number | null
  quantPrincipalAtomic: string | null
  series: TodaySeriesDay[]
  sources: { funds: ItemStatus; activity: ItemStatus; quant: ItemStatus }
}

export type TodayAlertKind = 'withdrawalExecutionPaused' | 'hotWalletError' | 'hotWalletLow' | 'reconciliationMismatch' | 'deadJobs'

export interface TodayAlert {
  kind: TodayAlertKind
  severity: 'critical' | 'warning'
  at: string | null
  detail: Record<string, unknown>
}

export interface ConsoleToday {
  generatedAt: string
  queues: TodayQueues
  today: TodaySummary
  alerts: TodayAlert[]
  /** Whether each alert source could be checked; a forbidden or failed check raises no alert. */
  alertChecks: { withdrawalExecution: ItemStatus; hotWallet: ItemStatus; reconciliation: ItemStatus; deadJobs: ItemStatus }
}

type Outcome<T> = { status: 'ok'; value: T } | { status: 'forbidden' } | { status: 'error' }
type Row = Record<string, unknown>

/** Permission strings of the endpoints each item reads (the same ones their console routes require). */
export const TODAY_PERMISSIONS = {
  withdrawals: ['wallet.withdrawals.manage'],
  kyc: ['core.console.view'],
  quant: ['quant.operations.manage'],
  community: ['community.content.review'],
  support: ['support.tickets.manage'],
  mail: ['mail.read'],
  accountClosures: ['users.account_closure.manage'],
  ledgerAdjustments: ['ledger.adjustments.manage'],
  approvals: ['approvals.manage'],
  teamBatches: ['platform.manage'],
  predictions: ['polymarket.manage'],
  jobs: ['operations.jobs.manage'],
  funds: ['ledger.reconciliation.manage'],
  reconciliation: ['ledger.reconciliation.manage'],
  activity: ['users.read'],
  fundsSwitch: ['operations.funds.switch.manage'],
} as const

/**
 * Admin console home ("today"): one call that fans out to the existing queue and summary channels in parallel.
 * Every item checks the administrator's own permissions and fails on its own — a missing permission marks the item
 * `forbidden`, a failing upstream marks it `error`, and the rest of the page still loads. Cached per admin for 15s.
 */
@Injectable()
export class AdminTodayService {
  private readonly log = new Logger(AdminTodayService.name)
  private readonly cache = new Map<string, { expiresAt: number; value: Promise<ConsoleToday> }>()
  /** Overridable clock (tests). */
  now: () => number = () => Date.now()

  constructor(
    private readonly core: AdminCoreOpsService,
    private readonly wallet: AdminWalletOpsService,
    private readonly quant: AdminQuantService,
    private readonly community: AdminCommunityOpsService,
    @Optional() private readonly prediction?: AdminPredictionService,
  ) {}

  today(admin: Pick<AdminSessionActor, 'id' | 'permissions'>): Promise<ConsoleToday> {
    const at = this.now()
    // Permissions are part of the key so a role change never serves data built for the old role.
    const key = `${admin.id}:${[...(admin.permissions ?? [])].sort().join(',')}`
    const hit = this.cache.get(key)
    if (hit && hit.expiresAt > at) return hit.value
    for (const [entryKey, entry] of this.cache) if (entry.expiresAt <= at) this.cache.delete(entryKey)
    const value = this.build(admin)
    this.cache.set(key, { expiresAt: at + TODAY_CACHE_MS, value })
    value.catch(() => this.cache.delete(key))
    return value
  }

  private async build(admin: Pick<AdminSessionActor, 'id' | 'permissions'>): Promise<ConsoleToday> {
    const granted = new Set(admin.permissions ?? [])
    const actor = admin.id
    const read = <T>(permissions: readonly string[], label: string, call: () => Promise<T>): Promise<Outcome<T>> =>
      hasAll(granted, permissions) ? this.attempt(label, call) : Promise.resolve({ status: 'forbidden' })

    const [
      reviews, approved, kyc, quantProducts, communityStats, reports, tickets, mail, closures,
      adjustmentsRequested, adjustmentsApproved, approvals, teamBatches, deadJobs, callbacks,
      funds, activity, fundsSwitch, reconciliations, predictionMonitor,
    ] = await Promise.all([
      read(TODAY_PERMISSIONS.withdrawals, 'withdrawal reviews', () => this.wallet.withdrawalReviews(actor, LIST_LIMIT)),
      read(TODAY_PERMISSIONS.withdrawals, 'approved withdrawals', () => this.wallet.withdrawals(actor, { state: 'approved', limit: LIST_LIMIT })),
      read(TODAY_PERMISSIONS.kyc, 'kyc', () => this.core.get(actor, '/kyc', { state: 'submitted', limit: LIST_LIMIT })),
      read(TODAY_PERMISSIONS.quant, 'quant products', () => this.quant.products(actor)),
      read(TODAY_PERMISSIONS.community, 'community stats', () => this.community.stats(actor)),
      read(TODAY_PERMISSIONS.community, 'community reports', () => this.community.reports(actor, { state: 'open', limit: 500 })),
      read(TODAY_PERMISSIONS.support, 'support tickets', () => this.core.get(actor, '/tickets', { status: 'open', limit: LIST_LIMIT })),
      read(TODAY_PERMISSIONS.mail, 'mail', () => this.core.get(actor, '/mail/unread-count')),
      read(TODAY_PERMISSIONS.accountClosures, 'account closures', () => this.core.get(actor, '/account-closures')),
      read(TODAY_PERMISSIONS.ledgerAdjustments, 'ledger adjustments', () => this.core.get(actor, '/ledger/adjustments', { state: 'requested', limit: LIST_LIMIT })),
      read(TODAY_PERMISSIONS.ledgerAdjustments, 'ledger adjustments', () => this.core.get(actor, '/ledger/adjustments', { state: 'approved', limit: LIST_LIMIT })),
      read(TODAY_PERMISSIONS.approvals, 'approvals', () => this.core.get(actor, '/approvals', { state: 'requested', limit: LIST_LIMIT })),
      read(TODAY_PERMISSIONS.teamBatches, 'team batches', () => this.core.get(actor, '/referral/team/batches')),
      read(TODAY_PERMISSIONS.jobs, 'dead jobs', () => Promise.all(DEAD_JOB_QUEUES.map((queueName) => this.core.get(actor, '/job-queue/jobs/dead', { queueName, limit: LIST_LIMIT })))),
      read(TODAY_PERMISSIONS.jobs, 'unprocessed callbacks', () => this.core.get(actor, '/job-queue/callbacks/unprocessed', { limit: LIST_LIMIT })),
      read(TODAY_PERMISSIONS.funds, 'funds summary', () => this.core.get(actor, '/funds/summary', { days: 7 })),
      read(TODAY_PERMISSIONS.activity, 'activity summary', () => this.core.get(actor, '/activity/summary', { days: 7 })),
      read(TODAY_PERMISSIONS.fundsSwitch, 'withdrawal execution switch', () => this.wallet.fundsStatus(actor)),
      read(TODAY_PERMISSIONS.reconciliation, 'reconciliations', () => this.core.get(actor, '/ledger/reconciliations', { limit: 20 })),
      read(TODAY_PERMISSIONS.predictions, 'prediction settlement monitor', () => this.prediction ? this.prediction.monitor(actor) : Promise.reject(new Error('Prediction monitor unavailable'))),
    ])

    const flagship = quantProducts.status === 'ok' ? asArray(quantProducts.value)[0] : undefined
    const quantSettlement = await this.quantSettlement(quantProducts, flagship, (slug) =>
      this.attempt('quant settlements', () => this.quant.settlements(actor, slug, '10')))

    const deadJobRows = deadJobs.status === 'ok' ? deadJobs.value.flatMap((list) => asArray(list)) : []
    const callbackRows = callbacks.status === 'ok' ? asArray(callbacks.value) : []
    const deadJobsItem = combine([deadJobs, callbacks], () => queue([
      ...deadJobRows.map((row) => row.createdAt),
      ...callbackRows.map((row) => row.receivedAt),
    ]))

    const queues: TodayQueues = {
      withdrawalReview: map(reviews, (value) => moneyQueue(asArray(value), 'requestedAt')),
      withdrawalExecute: map(approved, (value) => moneyQueue(asArray(value).filter((row) => row.state === 'approved'), 'approvedAt', 'requestedAt')),
      kyc: map(kyc, (value) => queue(asArray(value).filter((row) => row.state === 'submitted').map((row) => row.submittedAt ?? row.createdAt))),
      quantSettlement,
      communityQueue: map(communityStats, (value) => ({ count: toCount(field(value, 'queuePending')), oldestAt: null })),
      communityReports: map(reports, (value) => queue(asArray(field(value, 'items')).filter((row) => row.state === 'open').map((row) => row.createdAt))),
      supportTickets: map(tickets, (value) => queue(asArray(value).filter((row) => row.status === 'open').map((row) => row.updatedAt ?? row.createdAt))),
      mail: map(mail, (value) => ({ count: toCount(field(value, 'count')), oldestAt: null })),
      accountClosures: map(closures, (value) => queue(asArray(value).filter((row) => row.state === 'requested').map((row) => row.createdAt))),
      ledgerAdjustments: combine([adjustmentsRequested, adjustmentsApproved], () => {
        const rows = [adjustmentsRequested, adjustmentsApproved]
          .flatMap((outcome) => (outcome.status === 'ok' ? asArray(field(outcome.value, 'adjustments')) : []))
          .filter((row) => row.state === 'requested' || row.state === 'approved')
        return moneyQueue(rows, 'requestedAt', undefined, 'atomicAmount')
      }),
      approvals: map(approvals, (value) => queue(asArray(value).filter((row) => row.state === 'requested').map((row) => row.createdAt))),
      teamBatches: map(teamBatches, (value) => {
        const rows = asArray(field(value, 'items')).filter((row) => row.status === 'pending' || row.status === 'approved')
        return { ...moneyQueue(rows, 'createdAt', undefined, 'totalAtomic'), assetCode: 'USDT' }
      }),
      predictionSettlements: map(predictionMonitor, value => ({
        count: value.count, oldestAt: value.oldestAt, workerHealthy: value.workerHealthy,
        auditHealthy: value.auditHealthy, reconciliationMismatches: value.reconciliationMismatches,
        failed: value.failed, review: value.review,
      })),
      deadJobs: deadJobsItem,
    }

    return {
      generatedAt: new Date(this.now()).toISOString(),
      queues,
      today: summary(funds, activity, quantProducts),
      ...alerts(fundsSwitch, funds, reconciliations, deadJobsItem),
    }
  }

  private async quantSettlement(
    products: Outcome<unknown>,
    flagship: Row | undefined,
    loadSettlements: (slug: string) => Promise<Outcome<unknown>>,
  ): Promise<QuantSettlementItem> {
    const empty = (status: ItemStatus): QuantSettlementItem => ({
      count: 0, oldestAt: null, status, productSlug: null, tradeDate: null, state: 'none', timezone: DEFAULT_QUANT_TIMEZONE, cutoffAt: null, overdue: false,
    })
    if (products.status !== 'ok') return empty(products.status)
    if (!flagship || typeof flagship.slug !== 'string') return empty('ok')
    const day = quantDay(flagship, this.now())
    if (!day.due) {
      return { ...empty('ok'), productSlug: flagship.slug, timezone: day.timezone, cutoffAt: day.cutoffAt,
        tradeDate: day.lastSettled, state: day.lastSettled ? 'posted' : 'none' }
    }
    const base: QuantSettlementItem = {
      count: day.daysBehind, oldestAt: day.dueSince, status: 'ok', productSlug: flagship.slug, tradeDate: day.tradeDate,
      state: 'none', timezone: day.timezone, cutoffAt: day.cutoffAt, overdue: day.overdue,
    }
    const settlements = await loadSettlements(flagship.slug)
    if (settlements.status !== 'ok') return { ...base, status: settlements.status }
    const entry = asArray(settlements.value).find((row) => row.tradeDate === day.tradeDate && row.status !== 'voided')
    const state = entry && ['draft', 'approved', 'posted'].includes(String(entry.status)) ? (entry.status as QuantSettlementState) : 'none'
    return { ...base, state }
  }

  private async attempt<T>(label: string, call: () => Promise<T>): Promise<Outcome<T>> {
    let timer: NodeJS.Timeout | undefined
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timed out')), ITEM_TIMEOUT_MS) })
      return { status: 'ok', value: await Promise.race([call(), timeout]) }
    } catch (error) {
      if (isForbidden(error)) return { status: 'forbidden' }
      this.log.warn(`Today item "${label}" failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      return { status: 'error' }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

// ---- counting helpers (exported for tests) ----

export function oldestIso(values: unknown[]): string | null {
  let oldest: number | null = null
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const time = value instanceof Date ? value.getTime() : Date.parse(String(value))
    if (Number.isFinite(time) && (oldest === null || time < oldest)) oldest = time
  }
  return oldest === null ? null : new Date(oldest).toISOString()
}

export function sumAtomic(values: unknown[]): string {
  let total = 0n
  for (const value of values) {
    const text = typeof value === 'number' ? String(Math.trunc(value)) : String(value ?? '')
    if (/^-?\d+$/.test(text)) total += BigInt(text)
  }
  return total.toString()
}

function queue(times: unknown[]): Omit<QueueItem, 'status'> {
  return { count: times.length, oldestAt: oldestIso(times) }
}

/** Count + oldest + summed amount; the asset is reported only when every row shares one. */
function moneyQueue(rows: Row[], timeField: string, fallbackTimeField?: string, amountField = 'atomicAmount'): Omit<QueueItem, 'status'> {
  const assets = new Set(rows.map((row) => row.assetCode).filter((code): code is string => typeof code === 'string'))
  return {
    count: rows.length,
    oldestAt: oldestIso(rows.map((row) => row[timeField] ?? (fallbackTimeField ? row[fallbackTimeField] : undefined))),
    amountAtomic: sumAtomic(rows.map((row) => row[amountField])),
    assetCode: assets.size === 1 ? [...assets][0] : assets.size === 0 ? 'USDT' : null,
  }
}

function map<T>(outcome: Outcome<T>, build: (value: T) => Omit<QueueItem, 'status'>): QueueItem {
  if (outcome.status !== 'ok') return { count: 0, oldestAt: null, status: outcome.status }
  try {
    return { ...build(outcome.value), status: 'ok' }
  } catch {
    return { count: 0, oldestAt: null, status: 'error' }
  }
}

/** An item fed by several calls: forbidden if any is forbidden, error if any failed. */
function combine(outcomes: Outcome<unknown>[], build: () => Omit<QueueItem, 'status'>): QueueItem {
  if (outcomes.some((outcome) => outcome.status === 'forbidden')) return { count: 0, oldestAt: null, status: 'forbidden' }
  if (outcomes.some((outcome) => outcome.status === 'error')) return { count: 0, oldestAt: null, status: 'error' }
  return map({ status: 'ok', value: null }, build)
}

function summary(funds: Outcome<unknown>, activity: Outcome<unknown>, products: Outcome<unknown>): TodaySummary {
  const fundsValue = funds.status === 'ok' && funds.value && typeof funds.value === 'object' ? (funds.value as Row) : null
  const activityValue = activity.status === 'ok' && activity.value && typeof activity.value === 'object' ? (activity.value as Row) : null
  const today = fundsValue ? (field(fundsValue, 'today') as Row | undefined) : undefined
  const flow = (key: string) => {
    const amount = today ? (field(today, key) as Row | undefined) : undefined
    return amount ? { count: toCount(amount.count), amountAtomic: sumAtomic([amount.atomic]) } : null
  }
  const deposits = flow('deposits')
  const withdrawals = flow('withdrawals')
  const activityToday = activityValue ? (field(activityValue, 'today') as Row | undefined) : undefined
  const asset = fundsValue ? (field(fundsValue, 'asset') as Row | undefined) : undefined
  return {
    assetCode: typeof asset?.code === 'string' ? asset.code : 'USDT',
    timezone: typeof fundsValue?.timezone === 'string' ? fundsValue.timezone : null,
    deposits,
    withdrawals,
    netAtomic: deposits && withdrawals ? (BigInt(deposits.amountAtomic) - BigInt(withdrawals.amountAtomic)).toString() : null,
    activeUsers: activityToday ? toCount(activityToday.activeUsers) : null,
    registrations: activityToday ? toCount(activityToday.registrations) : null,
    quantPrincipalAtomic: products.status === 'ok'
      ? sumAtomic(asArray(products.value).map((product) => (field(product, 'totals') as Row | undefined)?.principalAtomic))
      : null,
    series: asArray(fundsValue ? field(fundsValue, 'series') : null).slice(-7).map((day) => ({
      day: String(day.day),
      depositsAtomic: sumAtomic([day.depositsAtomic]),
      withdrawalsAtomic: sumAtomic([day.withdrawalsAtomic]),
      netAtomic: (BigInt(sumAtomic([day.depositsAtomic])) - BigInt(sumAtomic([day.withdrawalsAtomic]))).toString(),
    })),
    sources: { funds: funds.status, activity: activity.status, quant: products.status },
  }
}

function alerts(
  fundsSwitch: Outcome<unknown>,
  funds: Outcome<unknown>,
  reconciliations: Outcome<unknown>,
  deadJobs: QueueItem,
): Pick<ConsoleToday, 'alerts' | 'alertChecks'> {
  const list: TodayAlert[] = []
  if (fundsSwitch.status === 'ok') {
    const current = field(fundsSwitch.value, 'current') as Row | null | undefined
    if (current && current.enabled === false) {
      list.push({ kind: 'withdrawalExecutionPaused', severity: 'critical', at: oldestIso([current.updatedAt]),
        detail: { reason: current.reason ?? null, pendingResumeRequests: asArray(field(fundsSwitch.value, 'pending')).length } })
    }
  }
  if (funds.status === 'ok') {
    const hot = field(funds.value, 'hotWallet') as Row | undefined
    if (hot?.error) {
      list.push({ kind: 'hotWalletError', severity: 'warning', at: oldestIso([hot.checkedAt]), detail: { error: String(hot.error).slice(0, 160) } })
    }
    if (hot?.address && typeof hot.usdtAtomic === 'string') {
      const pending = field(funds.value, 'pending') as Row | undefined
      const queuedAtomic = BigInt(sumAtomic([(field(pending, 'review') as Row | undefined)?.atomic]))
      const usdt = BigInt(sumAtomic([hot.usdtAtomic]))
      const trx = typeof hot.trxSun === 'string' ? BigInt(sumAtomic([hot.trxSun])) : null
      const shortUsdt = usdt < queuedAtomic
      const shortTrx = trx !== null && trx < HOT_WALLET_MIN_TRX_SUN
      if (shortUsdt || shortTrx) {
        list.push({ kind: 'hotWalletLow', severity: shortUsdt ? 'critical' : 'warning', at: oldestIso([hot.checkedAt]), detail: {
          usdtAtomic: usdt.toString(), queuedWithdrawalsAtomic: queuedAtomic.toString(), trxSun: trx?.toString() ?? null,
          minTrxSun: HOT_WALLET_MIN_TRX_SUN.toString(), shortUsdt, shortTrx,
        } })
      }
    }
  }
  if (reconciliations.status === 'ok') {
    // The newest run per network/asset is what counts; an older mismatch already re-run clean is not an alert.
    const latest = new Map<string, Row>()
    for (const run of asArray(field(reconciliations.value, 'runs'))) {
      const key = `${run.network}:${run.assetCode}`
      const previous = latest.get(key)
      if (!previous || Date.parse(String(run.createdAt)) > Date.parse(String(previous.createdAt))) latest.set(key, run)
    }
    for (const run of latest.values()) {
      if (run.state === 'differences_found' || run.state === 'failed') {
        list.push({ kind: 'reconciliationMismatch', severity: 'critical', at: oldestIso([run.completedAt ?? run.createdAt]), detail: {
          runId: run.id ?? null, network: run.network ?? null, assetCode: run.assetCode ?? null, state: run.state,
          differenceAtomicAmount: run.differenceAtomicAmount ?? null,
        } })
      }
    }
  }
  if (deadJobs.status === 'ok' && deadJobs.count > 0) {
    list.push({ kind: 'deadJobs', severity: 'warning', at: deadJobs.oldestAt, detail: { count: deadJobs.count } })
  }
  return {
    alerts: list,
    alertChecks: {
      withdrawalExecution: fundsSwitch.status,
      hotWallet: funds.status,
      reconciliation: reconciliations.status,
      deadJobs: deadJobs.status,
    },
  }
}

// ---- quant calendar ----

export function quantDay(product: Row, nowMs: number) {
  const timezone = typeof product.timezone === 'string' && product.timezone ? product.timezone : DEFAULT_QUANT_TIMEZONE
  const cutoff = typeof product.cutoff_time === 'string' && /^\d{2}:\d{2}/.test(product.cutoff_time) ? product.cutoff_time.slice(0, 5) : DEFAULT_QUANT_CUTOFF
  const localToday = localDate(new Date(nowMs), timezone)
  const lastSettled = typeof product.last_settled_date === 'string' ? product.last_settled_date : null
  const next = typeof product.nextTradeDate === 'string' ? product.nextTradeDate : null
  const cutoffMs = zonedToUtc(localToday, cutoff, timezone)
  // A trade date can be settled once it has ended locally, so anything before today is due.
  const due = Boolean(next && next < localToday && ['pilot', 'active', 'paused'].includes(String(product.status ?? 'active')))
  return {
    timezone,
    lastSettled,
    tradeDate: due ? next : null,
    due,
    daysBehind: due && next ? Math.round((Date.parse(`${localToday}T00:00:00Z`) - Date.parse(`${next}T00:00:00Z`)) / 86_400_000) : 0,
    dueSince: due && next ? new Date(zonedToUtc(addDays(next, 1), '00:00', timezone)).toISOString() : null,
    cutoffAt: new Date(cutoffMs).toISOString(),
    overdue: due && nowMs >= cutoffMs,
  }
}

function localDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Local wall-clock time in `timeZone` → epoch ms. */
function zonedToUtc(date: string, time: string, timeZone: string): number {
  const guess = Date.parse(`${date}T${time}:00Z`)
  const offset = (at: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at))
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at
  }
  const first = guess - offset(guess)
  return guess - offset(first)
}

// ---- shape helpers ----

function hasAll(granted: Set<string>, permissions: readonly string[]): boolean {
  return permissions.every((permission) => granted.has(permission))
}

function asArray(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === 'object') : []
}

function field(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Row)[key] : undefined
}

function toCount(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
}

function isForbidden(error: unknown): boolean {
  if (!(error instanceof HttpException)) return false
  if (error.getStatus() === 403) return true
  // The wallet/quant/community channels wrap every upstream failure as 502 and keep the real status alongside.
  const response = error.getResponse()
  return Boolean(response && typeof response === 'object' && (response as Row).upstreamStatus === 403)
}
