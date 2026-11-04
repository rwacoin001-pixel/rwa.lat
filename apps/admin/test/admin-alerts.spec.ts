import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import { DataSource } from 'typeorm'
import { AlertIssue, alertIssues, pickToSend, remember, renderAlertEmail, REPEAT_MS } from '../src/admin-alerts'
import { AdminAlertsRunner } from '../src/admin-alerts.runner'
import { AdminTodayService, ConsoleToday, QuantSettlementItem, TodayAlert } from '../src/admin-today.service'

const MINUTE = 60_000
const NOW = Date.parse('2026-11-04T06:00:00Z')

function emptyToday(): ConsoleToday {
  const empty = () => ({ count: 0, oldestAt: null, status: 'ok' as const })
  return {
    generatedAt: new Date(NOW).toISOString(),
    queues: {
      withdrawalReview: empty(), withdrawalExecute: empty(), kyc: empty(), communityQueue: empty(),
      communityReports: empty(), supportTickets: empty(), mail: empty(), accountClosures: empty(),
      ledgerAdjustments: empty(), approvals: empty(), teamBatches: empty(), predictionSettlements: empty(), deadJobs: empty(),
      quantSettlement: { ...empty(), productSlug: null, tradeDate: null, state: 'none', timezone: 'Asia/Singapore', cutoffAt: null, overdue: false },
    },
    today: {
      assetCode: 'USDT', timezone: null, deposits: null, withdrawals: null, netAtomic: null, activeUsers: null,
      registrations: null, quantPrincipalAtomic: null, series: [], sources: { funds: 'ok', activity: 'ok', quant: 'ok' },
    },
    alerts: [],
    alertChecks: { withdrawalExecution: 'ok', hotWallet: 'ok', reconciliation: 'ok', deadJobs: 'ok' },
  }
}

const RULES = [
  { name: 'withdrawalReview', minutes: 30, severity: 'critical', title: '提现待审 2 笔，最早已等 30 分钟', href: '/funds/withdrawals?view=review' },
  { name: 'withdrawalExecute', minutes: 30, severity: 'critical', title: '已通过的提现 2 笔还没广播，最早已等 30 分钟', href: '/funds/withdrawals?view=approved' },
  { name: 'kyc', minutes: 720, severity: 'warning', title: 'KYC 待审 2 件，最早已等 12 小时', href: '/kyc' },
  { name: 'accountClosures', minutes: 1440, severity: 'warning', title: '账户注销申请 2 件，最早已等 24 小时', href: '/users/closures' },
  { name: 'communityReports', minutes: 240, severity: 'warning', title: '社区举报 2 件未处理，最早已等 4 小时', href: '/community?tab=reports' },
  { name: 'supportTickets', minutes: 240, severity: 'warning', title: '工单 2 件未回复，最早已等 4 小时', href: '/support' },
  { name: 'ledgerAdjustments', minutes: 1440, severity: 'warning', title: '调账 2 笔待处理，最早已等 24 小时', href: '/ledger' },
  { name: 'approvals', minutes: 1440, severity: 'warning', title: '审批 2 件待处理，最早已等 24 小时', href: '/approvals' },
  { name: 'teamBatches', minutes: 4320, severity: 'warning', title: '团队月结 2 批待处理，最早已等 3 天', href: '/referral?tab=team' },
] as const

describe('Admin alert queue rules', () => {
  describe.each(RULES)('$name', (rule) => {
    it.each([-1, 0, 1])('checks the threshold with an offset of %i ms', (offset) => {
      const today = emptyToday()
      today.queues[rule.name] = { status: 'ok', count: 2, oldestAt: new Date(NOW - rule.minutes * MINUTE - offset).toISOString() }
      expect(alertIssues(today, NOW)).toEqual(offset > 0
        ? [{ key: `queue:${rule.name}`, severity: rule.severity, title: rule.title, href: rule.href }]
        : [])
    })

    it.each(['forbidden', 'error'] as const)('ignores %s queues even with an old timestamp', (status) => {
      const today = emptyToday()
      today.queues[rule.name] = { status, count: 2, oldestAt: '2020-01-01T00:00:00Z' }
      expect(alertIssues(today, NOW)).toEqual([])
    })

    it('requires a positive count and a valid age', () => {
      const today = emptyToday()
      for (const oldestAt of [null, '', 'invalid', new Date(NOW + MINUTE).toISOString()]) {
        today.queues[rule.name] = { status: 'ok', count: 2, oldestAt }
        expect(alertIssues(today, NOW)).toEqual([])
      }
      for (const count of [0, -1]) {
        today.queues[rule.name] = { status: 'ok', count, oldestAt: '2020-01-01T00:00:00Z' }
        expect(alertIssues(today, NOW)).toEqual([])
      }
    })
  })

  it.each([-1, 0, 1])('reports dead jobs regardless of age (offset %i ms)', (offset) => {
    const today = emptyToday()
    today.queues.deadJobs = { count: 2, status: 'ok', oldestAt: new Date(NOW - offset).toISOString() }
    expect(alertIssues(today, NOW)).toEqual([{ key: 'queue:deadJobs', severity: 'warning', title: '失败任务 2 个', href: '/job-queue' }])
  })

  it('reports dead jobs without any timestamp and ignores empty or unavailable queues', () => {
    const today = emptyToday()
    today.queues.deadJobs.count = 1
    expect(alertIssues(today, NOW)[0].key).toBe('queue:deadJobs')
    for (const status of ['forbidden', 'error'] as const) {
      today.queues.deadJobs.status = status
      expect(alertIssues(today, NOW)).toEqual([])
    }
    today.queues.deadJobs = { count: 0, status: 'ok', oldestAt: null }
    expect(alertIssues(today, NOW)).toEqual([])
  })

  it.each([
    [42, '42 分钟'], [59, '59 分钟'], [60, '1 小时'], [185, '3 小时 5 分'], [180, '3 小时'],
    [2879, '47 小时 59 分'], [2880, '2 天'], [3 * 1440 + 59, '3 天'],
  ])('formats %i minutes as %s', (minutes, waited) => {
    const today = emptyToday()
    today.queues.withdrawalReview = { status: 'ok', count: 1, oldestAt: new Date(NOW - Number(minutes) * MINUTE).toISOString() }
    expect(alertIssues(today, NOW)[0].title).toBe(`提现待审 1 笔，最早已等 ${waited}`)
  })

  it('does not alert on queues without a rule', () => {
    const today = emptyToday()
    for (const name of ['communityQueue', 'mail', 'predictionSettlements'] as const) {
      today.queues[name] = { status: 'ok', count: 99, oldestAt: '2020-01-01T00:00:00Z' }
    }
    expect(alertIssues(today, NOW)).toEqual([])
  })
})

function withQuant(changes: Partial<QuantSettlementItem> = {}): ConsoleToday {
  const today = emptyToday()
  today.queues.quantSettlement = {
    ...today.queues.quantSettlement, count: 1, tradeDate: '2026-11-03', state: 'draft', cutoffAt: '2026-11-04T07:00:00Z', ...changes,
  }
  return today
}

describe('Admin quant alerts', () => {
  it('starts at exactly one hour before cutoff', () => {
    expect(alertIssues(withQuant(), NOW - 1)).toEqual([])
    expect(alertIssues(withQuant(), NOW)).toEqual([{
      key: 'quant:2026-11-03:soon', severity: 'critical', title: '考拉量化 2026-11-03 的结算还没过账，15:00 截止', href: '/quant/daily',
    }])
    expect(alertIssues(withQuant(), NOW + 1)[0].key).toBe('quant:2026-11-03:soon')
  })

  it('prioritizes overdue over soon and does not require a cutoff', () => {
    for (const cutoffAt of [null, '2026-11-04T07:00:00Z']) {
      expect(alertIssues(withQuant({ overdue: true, cutoffAt }), NOW)).toEqual([{
        key: 'quant:2026-11-03:overdue', severity: 'critical', title: '考拉量化 2026-11-03 的结算已过截止时间，还没过账', href: '/quant/daily',
      }])
    }
  })

  it.each<Partial<QuantSettlementItem>>([
    { state: 'posted', overdue: true }, { count: 0 }, { tradeDate: null }, { cutoffAt: null }, { cutoffAt: 'invalid' },
    { status: 'forbidden', overdue: true }, { status: 'error', overdue: true },
  ])('ignores posted, not-due or unavailable settlements: %j', (changes) => {
    expect(alertIssues(withQuant(changes), NOW)).toEqual([])
  })

  it.each(['none', 'draft', 'approved'] as const)('alerts while the state is %s', (state) => {
    expect(alertIssues(withQuant({ state }), NOW)).toHaveLength(1)
  })

  it('formats the cutoff in the configured timezone or Singapore by default', () => {
    expect(alertIssues(withQuant({ timezone: 'America/New_York' }), NOW)[0].title).toContain('02:00 截止')
    expect(alertIssues(withQuant({ timezone: '' }), NOW)[0].title).toContain('15:00 截止')
    expect(alertIssues(withQuant({ timezone: 'UTC', cutoffAt: '2026-11-05T00:00:00Z' }), Date.parse('2026-11-04T23:00:00Z'))[0].title).toContain('00:00 截止')
  })
})

function todayAlert(kind: TodayAlert['kind'], detail: Record<string, unknown> = {}): TodayAlert {
  return { kind, severity: 'warning', at: null, detail }
}

describe('Admin Today alert mapping and order', () => {
  it('maps known alerts, ignores dead-job alerts and unknown kinds, and imposes source order', () => {
    const today = emptyToday()
    today.alerts = [
      todayAlert('reconciliationMismatch'), todayAlert('hotWalletError'), todayAlert('hotWalletLow'),
      todayAlert('withdrawalExecutionPaused', { reason: '例行维护' }), todayAlert('deadJobs'),
      { ...todayAlert('deadJobs'), kind: 'futureKind' } as unknown as TodayAlert,
    ]
    expect(alertIssues(today, NOW)).toEqual([
      { key: 'alert:hotWalletLow', severity: 'critical', title: '热钱包余额不足，待执行提现可能广播失败', href: '/funds/withdrawals' },
      { key: 'alert:reconciliation', severity: 'critical', title: '对账出现差额', href: '/reconciliation' },
      { key: 'alert:paused', severity: 'warning', title: '提现执行已暂停：例行维护', href: '/funds/withdrawals' },
      { key: 'alert:hotWalletError', severity: 'warning', title: '热钱包余额查询失败', href: '/funds' },
    ])
  })

  it('omits the pause separator when no reason is set', () => {
    const today = emptyToday()
    today.alerts = [todayAlert('withdrawalExecutionPaused')]
    expect(alertIssues(today, NOW)[0].title).toBe('提现执行已暂停')
  })

  it('places all critical issues first, preserving queue, quant and alert order within severity', () => {
    const today = withQuant()
    for (const rule of RULES) today.queues[rule.name] = { count: 1, status: 'ok', oldestAt: '2020-01-01T00:00:00Z' }
    today.queues.deadJobs.count = 1
    today.alerts = [todayAlert('hotWalletError'), todayAlert('reconciliationMismatch'), todayAlert('withdrawalExecutionPaused'), todayAlert('hotWalletLow')]
    expect(alertIssues(today, NOW).map((issue) => issue.key)).toEqual([
      'queue:withdrawalReview', 'queue:withdrawalExecute', 'quant:2026-11-03:soon', 'alert:hotWalletLow', 'alert:reconciliation',
      ...RULES.slice(2).map((rule) => `queue:${rule.name}`), 'queue:deadJobs', 'alert:paused', 'alert:hotWalletError',
    ])
  })
})

const ISSUE: AlertIssue = { key: 'queue:deadJobs', severity: 'warning', title: '失败任务 2 个', href: '/job-queue' }
const SECOND: AlertIssue = { key: 'alert:paused', severity: 'warning', title: '提现执行已暂停', href: '/funds/withdrawals' }

describe('Admin alert repeat memory', () => {
  it('selects new keys without mutating memory and treats time zero as a prior send', () => {
    const memory = new Map([[ISSUE.key, 0]])
    expect(pickToSend([ISSUE, SECOND], memory, 1)).toEqual({ send: true, fresh: new Set([SECOND.key]) })
    expect([...memory]).toEqual([[ISSUE.key, 0]])
    expect(pickToSend([], memory, NOW)).toEqual({ send: false, fresh: new Set() })
  })

  it('suppresses repeats until exactly three hours after a successful send', () => {
    expect(REPEAT_MS).toBe(3 * 60 * MINUTE)
    const memory = new Map<string, number>()
    expect(pickToSend([ISSUE], memory, NOW).send).toBe(true)
    remember([ISSUE], memory, NOW, true)
    expect(pickToSend([ISSUE], memory, NOW + REPEAT_MS - 1).send).toBe(false)
    expect(pickToSend([ISSUE], memory, NOW + REPEAT_MS)).toEqual({ send: true, fresh: new Set([ISSUE.key]) })
  })

  it('remembers every issue in a sent digest, including previously sent issues', () => {
    const memory = new Map([[ISSUE.key, NOW - MINUTE], ['cleared', NOW]])
    remember([ISSUE, SECOND], memory, NOW, true)
    expect([...memory]).toEqual([[ISSUE.key, NOW], [SECOND.key, NOW]])
  })

  it('only removes cleared keys after an unsuccessful or skipped send', () => {
    const memory = new Map([[ISSUE.key, NOW - MINUTE], ['cleared', NOW]])
    remember([ISSUE, SECOND], memory, NOW, false)
    expect([...memory]).toEqual([[ISSUE.key, NOW - MINUTE]])
    remember([], memory, NOW, false)
    expect(memory.size).toBe(0)
    expect(pickToSend([ISSUE], memory, NOW + 1).fresh).toEqual(new Set([ISSUE.key]))
  })
})

describe('Admin alert email', () => {
  it('renders the first title, total count, fresh markers, absolute links, Today link and footer', () => {
    const email = renderAlertEmail([ISSUE, SECOND], new Set([SECOND.key]), 'https://console.example/')
    expect(email.subject).toBe('[A-REIT 后台] 失败任务 2 个 等 2 件事')
    expect(renderAlertEmail([ISSUE], new Set(), 'https://console.example').subject).toBe('[A-REIT 后台] 失败任务 2 个')
    expect(email.text).toBe('失败任务 2 个\nhttps://console.example/job-queue\n\n新：提现执行已暂停\nhttps://console.example/funds/withdrawals\n\n查看今日待办\nhttps://console.example/today\n\n这是后台自动提醒，同一件事最多每 3 小时提醒一次。')
    expect(email.html).toContain('>新：提现执行已暂停</a>')
    expect(email.html).not.toContain('新：失败任务')
    for (const path of ['/job-queue', '/funds/withdrawals', '/today']) expect(email.html).toContain(`href="https://console.example${path}"`)
    expect(email.html.match(/<ul>/g)).toHaveLength(1)
    expect(email.html.match(/<li>/g)).toHaveLength(2)
    expect(email.html).toContain('color:#0E1116;text-decoration:underline;')
    expect(email.html).toContain('background:#fff')
    expect(email.html).not.toContain('<img')
  })

  it('escapes issue text and link attributes without altering the plain-text version', () => {
    const issue = { ...ISSUE, title: `<script>"x" & 'y'</script>`, href: '/funds?a=1&b="<bad>\'' }
    const email = renderAlertEmail([issue], new Set([issue.key]), 'https://console.example')
    expect(email.html).toContain('新：&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;')
    expect(email.html).toContain('href="https://console.example/funds?a=1&amp;b=&quot;&lt;bad&gt;&#39;"')
    expect(email.html).not.toContain('<script>')
    expect(email.text).toContain(issue.title)
    expect(email.subject).toBe(`[A-REIT 后台] ${issue.title}`)
  })
})

function runnerFixture(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    APP_ENV: 'production', NODE_ENV: 'production', EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'test-api-key', EMAIL_FROM: 'ops@example.test', ...overrides,
  }
  const config = { get: (key: string) => values[key] } as ConfigService
  const admins = [{ id: 'admin-1', email: 'operator@example.test', permissions: ['operations.jobs.manage'] }]
  const ds = { query: jest.fn().mockResolvedValue(admins) }
  const today = emptyToday()
  today.queues.deadJobs.count = 2
  const todayService = { today: jest.fn().mockResolvedValue(today) }
  const runner = new AdminAlertsRunner(ds as unknown as DataSource, config, todayService as unknown as AdminTodayService)
  return { runner, ds, todayService, today, admins }
}

describe('Admin alert runner', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>
  let warn: jest.SpyInstance
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response)
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('reads active admins with their permissions, sends once, suppresses repeats, then repeats at three hours', async () => {
    const { runner, ds, todayService } = runnerFixture()
    await runner.runOnce(NOW)
    expect(ds.query.mock.calls[0][0]).toMatch(/WHERE u.disabled_at IS NULL GROUP BY u.id, u.email/)
    expect(ds.query.mock.calls[0][0]).toContain('LEFT JOIN app.admin_role_permissions rp ON rp.role_id = r.id')
    expect(todayService.today).toHaveBeenCalledWith({ id: 'admin-1', permissions: ['operations.jobs.manage'] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const hash = createHash('sha256').update(ISSUE.key).digest('hex').slice(0, 16)
    expect(request).toMatchObject({ method: 'POST', headers: {
      authorization: 'Bearer test-api-key', 'content-type': 'application/json',
      'Idempotency-Key': `admin-alert-admin-1-${hash}-${Math.floor(NOW / REPEAT_MS)}`,
    } })
    expect(request?.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(request?.body as string)).toMatchObject({ from: 'A-REIT <ops@example.test>', to: ['operator@example.test'], subject: '[A-REIT 后台] 失败任务 2 个' })
    expect(JSON.parse(request?.body as string).text).toContain('https://admin.a-reit.com/today')
    await runner.runOnce(NOW + REPEAT_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await runner.runOnce(NOW + REPEAT_MS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries after HTTP 500 with the same idempotency key, only remembering success', async () => {
    const { runner } = runnerFixture()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    await runner.runOnce(NOW)
    await runner.runOnce(NOW + MINUTE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual(fetchMock.mock.calls[0][1]?.headers)
    await runner.runOnce(NOW + 2 * MINUTE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith('Admin alert email delivery failed (status 500)')
  })

  it('skips admins without an email and keeps repeat memory separate per admin', async () => {
    const { runner, ds, todayService, admins } = runnerFixture()
    ds.query.mockResolvedValue([...admins, { id: 'no-email', email: null, permissions: [] }, { id: 'blank', email: '  ', permissions: [] }, { ...admins[0], id: 'admin-2' }])
    await runner.runOnce(NOW)
    expect(todayService.today.mock.calls).toEqual([
      [{ id: 'admin-1', permissions: ['operations.jobs.manage'] }], [{ id: 'admin-2', permissions: ['operations.jobs.manage'] }],
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await runner.runOnce(NOW + MINUTE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries transport failures and continues to other administrators without logging secrets', async () => {
    const { runner, ds, admins } = runnerFixture()
    ds.query.mockResolvedValue([...admins, { ...admins[0], id: 'admin-2' }])
    fetchMock.mockRejectedValueOnce(new Error('operator@example.test test-api-key'))
    await expect(runner.runOnce(NOW)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await runner.runOnce(NOW + MINUTE)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/operator@example.test|test-api-key/)
  })

  it('isolates Today failures and recovers from recipient-query failures', async () => {
    const { runner, ds, todayService, admins } = runnerFixture()
    ds.query.mockResolvedValue([...admins, { ...admins[0], id: 'admin-2' }])
    todayService.today.mockRejectedValueOnce(new Error('secret'))
    await expect(runner.runOnce(NOW)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    ds.query.mockRejectedValueOnce(new Error('secret'))
    await expect(runner.runOnce(NOW + MINUTE)).resolves.toBeUndefined()
    await runner.runOnce(NOW + 2 * MINUTE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret')
  })

  it('sends cleared-and-returned issues immediately and strips trailing URL slashes', async () => {
    const { runner, today } = runnerFixture({ ADMIN_CONSOLE_URL: 'https://custom.example///' })
    await runner.runOnce(NOW)
    today.queues.deadJobs.count = 0
    await runner.runOnce(NOW + MINUTE)
    today.queues.deadJobs.count = 2
    await runner.runOnce(NOW + 2 * MINUTE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string).text).toContain('https://custom.example/job-queue')
  })

  it('includes old issues with fresh issues and hashes sorted fresh keys', async () => {
    const { runner, today } = runnerFixture()
    await runner.runOnce(NOW)
    today.alerts = [todayAlert('withdrawalExecutionPaused'), todayAlert('hotWalletLow')]
    await runner.runOnce(NOW + MINUTE)
    const request = fetchMock.mock.calls[1][1]!
    const body = JSON.parse(request.body as string)
    expect(body.text).toContain('失败任务 2 个')
    expect(body.text).not.toContain('新：失败任务')
    expect(body.text).toContain('新：提现执行已暂停')
    const hash = createHash('sha256').update('alert:hotWalletLow\nalert:paused').digest('hex').slice(0, 16)
    expect((request.headers as Record<string, string>)['Idempotency-Key']).toBe(`admin-alert-admin-1-${hash}-${Math.floor((NOW + MINUTE) / REPEAT_MS)}`)
  })

  it('prevents overlapping runs and allows the next run after completion', async () => {
    const { runner, ds } = runnerFixture()
    let release!: (value: unknown[]) => void
    ds.query.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    const pending = runner.runOnce(NOW)
    await runner.runOnce(NOW)
    expect(ds.query).toHaveBeenCalledTimes(1)
    release([])
    await pending
    await runner.runOnce(NOW + MINUTE)
    expect(ds.query).toHaveBeenCalledTimes(2)
  })

  it.each([
    { APP_ENV: 'test' }, { NODE_ENV: 'test' }, { ADMIN_ALERT_EMAILS: 'off' }, { ADMIN_ALERT_EMAILS: 'false' }, { ADMIN_ALERT_EMAILS: '0' },
    { EMAIL_PROVIDER: 'other' }, { RESEND_API_KEY: '' }, { EMAIL_FROM: '' },
  ])('logs once and starts no timer when disabled: %j', async (overrides) => {
    jest.useFakeTimers()
    const info = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    const { runner, ds } = runnerFixture(overrides)
    runner.onApplicationBootstrap()
    runner.onApplicationBootstrap()
    await runner.runOnce(NOW)
    expect(info).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
    expect(ds.query).not.toHaveBeenCalled()
    runner.onModuleDestroy()
  })

  it('runs first after 60 seconds, then every five minutes, and clears timers on destroy', async () => {
    jest.useFakeTimers()
    const { runner } = runnerFixture()
    const run = jest.spyOn(runner, 'runOnce').mockResolvedValue(undefined)
    runner.onApplicationBootstrap()
    await jest.advanceTimersByTimeAsync(59_999)
    expect(run).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(5 * MINUTE - 1)
    expect(run).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(2)
    runner.onModuleDestroy()
    expect(jest.getTimerCount()).toBe(0)
    await jest.advanceTimersByTimeAsync(10 * MINUTE)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('cancels the initial timer when destroyed before the first run', async () => {
    jest.useFakeTimers()
    const { runner, ds } = runnerFixture()
    runner.onApplicationBootstrap()
    runner.onModuleDestroy()
    expect(jest.getTimerCount()).toBe(0)
    await runner.runOnce(NOW)
    expect(ds.query).not.toHaveBeenCalled()
  })
})
