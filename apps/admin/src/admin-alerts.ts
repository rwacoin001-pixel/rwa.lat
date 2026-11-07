import type { ConsoleToday, TodayQueues } from './admin-today.service'

export type AlertIssue = { key: string; severity: 'critical' | 'warning'; title: string; href: string }

export const REPEAT_MS = 3 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

type QueueRule = {
  name: Exclude<keyof TodayQueues, 'quantSettlement'>
  minutes: number
  severity: AlertIssue['severity']
  title: (count: number, waited: string) => string
  href: string
}

const QUEUE_RULES: readonly QueueRule[] = [
  { name: 'withdrawalReview', minutes: 30, severity: 'critical', title: (n, w) => `提现待审 ${n} 笔，最早已等 ${w}`, href: '/funds/withdrawals?view=review' },
  { name: 'withdrawalExecute', minutes: 30, severity: 'critical', title: (n, w) => `已通过的提现 ${n} 笔还没广播，最早已等 ${w}`, href: '/funds/withdrawals?view=approved' },
  { name: 'kyc', minutes: 720, severity: 'warning', title: (n, w) => `KYC 待审 ${n} 件，最早已等 ${w}`, href: '/kyc' },
  { name: 'accountClosures', minutes: 1440, severity: 'warning', title: (n, w) => `账户注销申请 ${n} 件，最早已等 ${w}`, href: '/users/closures' },
  { name: 'communityReports', minutes: 240, severity: 'warning', title: (n, w) => `社区举报 ${n} 件未处理，最早已等 ${w}`, href: '/community?tab=reports' },
  { name: 'supportTickets', minutes: 240, severity: 'warning', title: (n, w) => `工单 ${n} 件未回复，最早已等 ${w}`, href: '/support' },
  { name: 'ledgerAdjustments', minutes: 1440, severity: 'warning', title: (n, w) => `调账 ${n} 笔待处理，最早已等 ${w}`, href: '/ledger' },
  { name: 'approvals', minutes: 1440, severity: 'warning', title: (n, w) => `审批 ${n} 件待处理，最早已等 ${w}`, href: '/approvals' },
  { name: 'teamBatches', minutes: 4320, severity: 'warning', title: (n, w) => `团队月结 ${n} 批待处理，最早已等 ${w}`, href: '/referral?tab=team' },
  { name: 'deadJobs', minutes: 0, severity: 'warning', title: (n) => `失败任务 ${n} 个`, href: '/job-queue' },
  { name: 'predictionSettlements', minutes: 5, severity: 'critical', title: (n, w) => `预测结果已确认，${n} 笔仍未结算，最早已等 ${w}`, href: '/polymarket' },
]

function waitedText(elapsedMs: number): string {
  const minutes = Math.floor(elapsedMs / MINUTE_MS)
  if (minutes < 60) return `${minutes} 分钟`
  if (minutes < 48 * 60) {
    const rest = minutes % 60
    return `${Math.floor(minutes / 60)} 小时${rest ? ` ${rest} 分` : ''}`
  }
  return `${Math.floor(minutes / (24 * 60))} 天`
}

export function alertIssues(today: ConsoleToday, nowMs: number): AlertIssue[] {
  const issues: AlertIssue[] = []
  const prediction = today.queues.predictionSettlements
  if (prediction.status === 'error') issues.push({ key: 'prediction:unavailable', severity: 'critical', title: '预测结算监控无法读取，请检查核心服务', href: '/polymarket' })
  if (prediction.status === 'ok') {
    if (prediction.workerHealthy === false) issues.push({ key: 'prediction:heartbeat', severity: 'critical', title: '预测结算任务心跳中断或任务已关闭', href: '/polymarket' })
    if (prediction.auditHealthy === false) issues.push({ key: 'prediction:audit-stale', severity: 'critical', title: '预测资金对账失败或结果已过期', href: '/polymarket' })
    if ((prediction.reconciliationMismatches ?? 0) > 0) issues.push({ key: 'prediction:reconciliation', severity: 'critical', title: '预测订单与资金账本存在差异', href: '/polymarket' })
    if ((prediction.failed ?? 0) > 0) issues.push({ key: 'prediction:failed', severity: 'warning', title: `预测结算有 ${prediction.failed} 个任务需要处理`, href: '/polymarket' })
  }
  for (const rule of QUEUE_RULES) {
    const queue = today.queues[rule.name]
    if (queue.status !== 'ok' || queue.count <= 0) continue
    const elapsed = queue.oldestAt ? nowMs - Date.parse(queue.oldestAt) : NaN
    if (rule.name !== 'deadJobs' && !(elapsed > rule.minutes * MINUTE_MS)) continue
    issues.push({ key: `queue:${rule.name}`, severity: rule.severity, title: rule.title(queue.count, waitedText(elapsed)), href: rule.href })
  }

  const quant = today.queues.quantSettlement
  if (quant.status === 'ok' && quant.count > 0 && quant.tradeDate && quant.state !== 'posted') {
    if (quant.overdue === true) {
      issues.push({ key: `quant:${quant.tradeDate}:overdue`, severity: 'critical', title: `考拉量化 ${quant.tradeDate} 的结算已过截止时间，还没过账`, href: '/quant/daily' })
    } else if (quant.cutoffAt && nowMs >= Date.parse(quant.cutoffAt) - 60 * MINUTE_MS) {
      const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: quant.timezone || 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).format(new Date(quant.cutoffAt))
      issues.push({ key: `quant:${quant.tradeDate}:soon`, severity: 'critical', title: `考拉量化 ${quant.tradeDate} 的结算还没过账，${time} 截止`, href: '/quant/daily' })
    }
  }

  // Use the specified source order even when Today returns alerts in a different order.
  for (const kind of ['withdrawalExecutionPaused', 'hotWalletLow', 'hotWalletError', 'reconciliationMismatch'] as const) {
    const alert = today.alerts.find((item) => item.kind === kind)
    if (!alert) continue
    switch (kind) {
      case 'withdrawalExecutionPaused':
        issues.push({ key: 'alert:paused', severity: 'warning', title: `提现执行已暂停${alert.detail.reason ? `：${alert.detail.reason}` : ''}`, href: '/funds/withdrawals' })
        break
      case 'hotWalletLow':
        issues.push({ key: 'alert:hotWalletLow', severity: 'critical', title: '热钱包余额不足，待执行提现可能广播失败', href: '/funds/withdrawals' })
        break
      case 'hotWalletError':
        issues.push({ key: 'alert:hotWalletError', severity: 'warning', title: '热钱包余额查询失败', href: '/funds' })
        break
      case 'reconciliationMismatch':
        issues.push({ key: 'alert:reconciliation', severity: 'critical', title: '对账出现差额', href: '/reconciliation' })
        break
    }
  }
  return [...issues.filter((issue) => issue.severity === 'critical'), ...issues.filter((issue) => issue.severity === 'warning')]
}

export function pickToSend(issues: AlertIssue[], memory: Map<string, number>, nowMs: number): { send: boolean; fresh: Set<string> } {
  const fresh = new Set(issues.filter((issue) => {
    const last = memory.get(issue.key)
    return last === undefined || nowMs - last >= REPEAT_MS
  }).map((issue) => issue.key))
  return { send: fresh.size > 0, fresh }
}

export function remember(issues: AlertIssue[], memory: Map<string, number>, nowMs: number, sent: boolean): void {
  const current = new Set(issues.map((issue) => issue.key))
  for (const key of memory.keys()) if (!current.has(key)) memory.delete(key)
  if (sent) for (const key of current) memory.set(key, nowMs)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

export function renderAlertEmail(issues: AlertIssue[], fresh: Set<string>, consoleUrl: string): { subject: string; text: string; html: string } {
  const base = consoleUrl.replace(/\/+$/, '')
  const subject = `[A-REIT 后台] ${issues[0]?.title ?? '后台提醒'}${issues.length > 1 ? ` 等 ${issues.length} 件事` : ''}`
  const footer = '这是后台自动提醒，同一件事最多每 3 小时提醒一次。'
  const entries = issues.map((issue) => ({ title: `${fresh.has(issue.key) ? '新：' : ''}${issue.title}`, url: base + issue.href }))
  const todayUrl = base + '/today'
  const text = [...entries.map((entry) => `${entry.title}\n${entry.url}`), `查看今日待办\n${todayUrl}`, footer].join('\n\n')
  const linkStyle = 'color:#0E1116;text-decoration:underline;'
  const html = `<html lang="zh-CN"><body style="margin:0;padding:24px;background:#fff;color:#0E1116;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.6;"><ul>${entries.map((entry) => `<li><a style="${linkStyle}" href="${escapeHtml(entry.url)}">${escapeHtml(entry.title)}</a></li>`).join('')}</ul><p><a style="${linkStyle}" href="${escapeHtml(todayUrl)}">查看今日待办</a></p><p>${escapeHtml(footer)}</p></body></html>`
  return { subject, text, html }
}
