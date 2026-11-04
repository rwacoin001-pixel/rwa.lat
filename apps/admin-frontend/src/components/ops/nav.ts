import { Archive, CalendarCheck, LineChart, MessagesSquare, Settings2, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react'

/** A key of `queues` in GET /admin/console/today; the tab shows that queue's count. */
export type QueueKey =
  | 'withdrawalReview' | 'withdrawalExecute' | 'kyc' | 'quantSettlement' | 'communityQueue' | 'communityReports'
  | 'supportTickets' | 'mail' | 'accountClosures' | 'ledgerAdjustments' | 'approvals' | 'teamBatches'
  | 'predictionSettlements' | 'deadJobs'

export type NavTab = { label: string; href: string; queues?: QueueKey[] }
export type NavGroup = { id: string; label: string; icon: LucideIcon; tabs: NavTab[]; /** extra paths that belong to this group */ paths?: string[] }

// The redesigned console's menu: grouped by daily work, one entry per kind of task. Tabs that have not moved to the
// new console yet still point at their old pages.
export const NAV_GROUPS: NavGroup[] = [
  { id: 'today', label: '今日', icon: CalendarCheck, tabs: [{ label: '待办', href: '/today' }], paths: ['/dashboard'] },
  {
    id: 'funds', label: '资金', icon: Wallet, tabs: [
      { label: '提现', href: '/funds/withdrawals', queues: ['withdrawalReview', 'withdrawalExecute'] },
      { label: '充值入账', href: '/collections' },
      { label: '地址池', href: '/wallets' },
      { label: '对账与调账', href: '/ledger', queues: ['ledgerAdjustments'] },
      { label: '资金概览', href: '/funds' },
      { label: '白名单', href: '/withdrawal-whitelist' },
    ], paths: ['/reconciliation', '/withdrawals'],
  },
  {
    id: 'quant', label: '量化', icon: LineChart, tabs: [
      { label: '每日结算', href: '/quant/daily', queues: ['quantSettlement'] },
      { label: '产品与披露', href: '/quant' },
    ],
  },
  {
    id: 'users', label: '用户', icon: Users, tabs: [
      { label: '用户', href: '/users' },
      { label: 'KYC 审核', href: '/kyc', queues: ['kyc'] },
      { label: '账户注销', href: '/users/closures', queues: ['accountClosures'] },
      { label: '活跃数据', href: '/activity' },
    ],
  },
  {
    id: 'care', label: '客服与社区', icon: MessagesSquare, tabs: [
      { label: '收件箱', href: '/inbox', queues: ['mail'] },
      { label: '工单', href: '/support', queues: ['supportTickets'] },
      { label: '社区', href: '/community', queues: ['communityQueue', 'communityReports'] },
      { label: '风险标记', href: '/risk' },
      { label: '发通知', href: '/notifications' },
    ],
  },
  {
    id: 'growth', label: '增长', icon: TrendingUp, tabs: [
      { label: '推荐与团队月结', href: '/referral', queues: ['teamBatches'] },
      { label: '预测市场', href: '/polymarket', queues: ['predictionSettlements'] },
      { label: '内容', href: '/content' },
      { label: 'AI 自动投资', href: '/ai-investment' },
    ],
  },
  {
    id: 'system', label: '系统', icon: Settings2, tabs: [
      { label: '失败任务', href: '/job-queue', queues: ['deadJobs'] },
      { label: 'AI 数据', href: '/ai' },
      { label: 'AI 知识库', href: '/ai-knowledge' },
      { label: '文件', href: '/files' },
      { label: '平台设置', href: '/organization' },
      { label: '法律文本', href: '/legal' },
      { label: '文档模板', href: '/document-templates' },
      { label: '集成', href: '/providers' },
      { label: '审计', href: '/audit' },
      { label: '我的账户', href: '/settings' },
    ], paths: ['/ai-ops', '/regions'],
  },
  {
    id: 'legacy', label: '旧产品', icon: Archive, tabs: [
      { label: '篮子', href: '/basket' },
      { label: '资产目录', href: '/assets' },
      { label: '产品与价格', href: '/control' },
      { label: '订单与人工结算', href: '/orders' },
      { label: '收益记录', href: '/yields' },
      { label: '结算记录', href: '/settlements' },
      { label: '适当性', href: '/eligibility' },
    ], paths: ['/networks'],
  },
]

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/')

/** The group and tab a path belongs to: the longest matching tab wins (/quant/daily over /quant). */
export function locate(pathname: string): { group: NavGroup; tab: NavTab | null } {
  let best: { group: NavGroup; tab: NavTab | null; length: number } | null = null
  for (const group of NAV_GROUPS) {
    for (const tab of group.tabs) {
      const href = tab.href.split('?')[0]
      if (matches(pathname, href) && (!best || href.length > best.length)) best = { group, tab, length: href.length }
    }
    for (const path of group.paths ?? []) if (matches(pathname, path) && (!best || path.length > best.length)) best = { group, tab: null, length: path.length }
  }
  return best ? { group: best.group, tab: best.tab } : { group: NAV_GROUPS[0], tab: null }
}
