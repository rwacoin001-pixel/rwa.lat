/**
 * A-REIT — S1 路由注册表 v2（路由定义层）
 *
 * ⚠️ 与 `lib/routes.ts` 的关系（两者互补·不要混淆）：
 *   · lib/routes.ts      = 导航动作层（navigate/useNav/NAV_EVENT·桥接旧 72 屏）
 *   · lib/routes-v2.ts   = 路由定义层（路径/元数据/Dock 映射/解析·本文件）
 * S1 批次 6（壳搬家）完成后，导航动作层将切换读取本注册表，旧桥接退役。
 *
 * 权威来源：IA v2.2 + Spec Patch 定稿（design-concepts/ClaudeCode-v2.2复核.md）
 * 结构：5 Product Domains（home / markets / ai / assets / profile）
 *       + L0 公开区 + 系统路由（不计入「67 页面路由」）
 * Dock：3 Navigation Tabs（home / markets / assets）+ 右侧 AI 球（ai）
 *       「我的」= 顶栏头像入口（profile 域·dock:null·返回式顶栏）
 */

// ─── 类型 ───

export type Domain = 'public' | 'home' | 'markets' | 'ai' | 'assets' | 'profile' | 'system'

/** Dock 高亮归属：null = 不做任何高亮（无选中态） */
export type DockTab = 'home' | 'markets' | 'assets' | 'ai' | null

export type AuthLevel = 'public' | 'optional' | 'required'

export interface RouteMeta {
  /** 所属域 */
  domain: Domain
  /** Dock 高亮归属 */
  dock: DockTab
  /** 是否显示底部 Dock */
  showDock: boolean
  /** 鉴权级别 */
  auth: AuthLevel
  /** i18n 标题 key（可选·L3 流程页顶栏用） */
  titleKey?: string
}

export interface RouteDef extends RouteMeta {
  /** 路径模板（`:param` 为动态段） */
  path: string
}

// ─── 路由定义（67 页面路由 + 1 系统回调；页面数含 3 条 public 补充路由）───

const R = (path: string, meta: RouteMeta): RouteDef => ({ path, ...meta })

export const ROUTES = {
  // ═══ L0 公开区（6）· 无底栏 ═══
  welcome: R('/welcome', { domain: 'public', dock: null, showDock: false, auth: 'public' }),
  login: R('/login', { domain: 'public', dock: null, showDock: false, auth: 'public' }),
  register: R('/register', { domain: 'public', dock: null, showDock: false, auth: 'public' }),
  verifyEmail: R('/verify-email', { domain: 'public', dock: null, showDock: false, auth: 'public' }),
  recovery: R('/recovery', { domain: 'public', dock: null, showDock: false, auth: 'public' }),
  onboarding: R('/onboarding', { domain: 'public', dock: null, showDock: false, auth: 'optional' }),

  // ═══ 系统回调 + 3 条 public 补充路由 · 无底栏 ═══
  authCallbackEmail: R('/auth/callback/email', { domain: 'system', dock: null, showDock: false, auth: 'public' }),
  notificationLink: R('/n/:id', { domain: 'public', dock: null, showDock: false, auth: 'public' }),
  maintenance: R('/maintenance', { domain: 'public', dock: null, showDock: false, auth: 'public' }),
  shareLanding: R('/share/:token', { domain: 'public', dock: null, showDock: false, auth: 'public' }),

  // ═══ Tab 1 · 首页域（10）═══
  home: R('/home', { domain: 'home', dock: 'home', showDock: true, auth: 'optional' }),
  search: R('/search', { domain: 'home', dock: 'home', showDock: false, auth: 'optional' }),
  notifications: R('/notifications', { domain: 'home', dock: 'home', showDock: true, auth: 'required' }),
  community: R('/community', { domain: 'home', dock: 'home', showDock: true, auth: 'optional' }),
  communityPost: R('/community/post/:id', { domain: 'home', dock: 'home', showDock: true, auth: 'optional' }),
  communityMember: R('/community/member/:handle', { domain: 'home', dock: 'home', showDock: true, auth: 'optional' }),
  learn: R('/learn', { domain: 'home', dock: 'home', showDock: true, auth: 'public' }),
  learnArticle: R('/learn/:slug', { domain: 'home', dock: 'home', showDock: true, auth: 'public' }),

  // ═══ Tab 2 · 市场（11）═══
  markets: R('/markets', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),
  assetDetail: R('/asset/:slug', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),
  basketDetail: R('/basket/:id', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),
  strategyDetail: R('/strategy/:id', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),
  basketOrder: R('/basket/:id/order', { domain: 'markets', dock: 'markets', showDock: false, auth: 'required', titleKey: 'orders.newOrder' }),
  trade: R('/trade/:symbol', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),
  predictionDetail: R('/prediction/:id', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),
  issuers: R('/issuers', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),
  issuerProfile: R('/issuers/:slug', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),
  planNew: R('/plan/new', { domain: 'markets', dock: 'markets', showDock: false, auth: 'required', titleKey: 'plan.new' }),
  compare: R('/compare', { domain: 'markets', dock: 'markets', showDock: true, auth: 'public' }),

  // ═══ Tab 3 · AI（3）═══
  ai: R('/ai', { domain: 'ai', dock: 'ai', showDock: true, auth: 'optional' }),
  aiPlan: R('/ai/plan/:id', { domain: 'ai', dock: 'ai', showDock: true, auth: 'required' }),
  aiGoals: R('/ai/goals', { domain: 'ai', dock: 'ai', showDock: true, auth: 'required' }),

  // ═══ Tab 4 · 资产（15）═══
  assets: R('/assets', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  positionDetail: R('/assets/positions/:id', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  cashHub: R('/assets/cash', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  cashDeposit: R('/assets/cash/deposit', { domain: 'assets', dock: 'assets', showDock: false, auth: 'required', titleKey: 'wallet.deposit' }),
  cashWithdraw: R('/assets/cash/withdraw', { domain: 'assets', dock: 'assets', showDock: false, auth: 'required', titleKey: 'wallet.withdraw' }),
  cashTransfer: R('/assets/cash/transfer', { domain: 'assets', dock: 'assets', showDock: false, auth: 'required', titleKey: 'wallet.transfer' }),
  cashReceive: R('/assets/cash/receive', { domain: 'assets', dock: 'assets', showDock: false, auth: 'required' }),
  addressBook: R('/assets/cash/address-book', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  activity: R('/assets/activity', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  statements: R('/assets/statements', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  yieldCalendar: R('/assets/yield-calendar', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  rebalance: R('/assets/rebalance', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  recurring: R('/assets/recurring', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  myPredictions: R('/assets/predictions', { domain: 'assets', dock: 'assets', showDock: true, auth: 'required' }),
  orderReview: R('/orders/review', { domain: 'assets', dock: 'assets', showDock: false, auth: 'required', titleKey: 'orders.review' }),
  orderStatus: R('/orders/status', { domain: 'assets', dock: 'assets', showDock: false, auth: 'required', titleKey: 'orders.status' }),
  orderDetail: R('/orders/:id', { domain: 'assets', dock: 'assets', showDock: false, auth: 'required', titleKey: 'orders.detail' }),

  // ═══ Tab 5 · 我的（22）· 返回式顶栏 ═══
  profile: R('/profile', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  verification: R('/profile/verification', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  kyc: R('/profile/verification/kyc', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  eligibility: R('/profile/verification/eligibility', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  riskProfile: R('/profile/verification/risk-profile', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  security: R('/profile/security', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  referral: R('/profile/referral', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  documents: R('/profile/documents', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  support: R('/profile/support', { domain: 'profile', dock: null, showDock: true, auth: 'optional' }),
  supportNew: R('/profile/support/new', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  supportTicket: R('/profile/support/ticket/:id', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  settings: R('/profile/settings', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  closeAccount: R('/profile/close-account', { domain: 'profile', dock: null, showDock: true, auth: 'required' }),
  feesAndLimits: R('/fees-and-limits', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
  trust: R('/trust', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
  trustAccess: R('/trust/access-and-regions', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
  trustDisclosures: R('/trust/product-disclosures', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
  trustLegal: R('/trust/legal', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
  trustStatus: R('/trust/status', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
  trustChannels: R('/trust/official-channels', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
  trustScam: R('/trust/report-scam', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
  trustReserves: R('/trust/proof-of-reserves', { domain: 'profile', dock: null, showDock: true, auth: 'public' }),
} as const satisfies Record<string, RouteDef>

export type RouteKey = keyof typeof ROUTES

// ─── 路径构造 ───

export function routePath(key: RouteKey, params?: Record<string, string>): string {
  let path: string = ROUTES[key].path
  if (params) {
    for (const [k, v] of Object.entries(params)) path = path.replace(`:${k}`, encodeURIComponent(v))
  }
  return path
}

// ─── 匹配（最长字面量匹配优先）───

function matchScore(def: RouteDef, pathname: string): number {
  const tpl = def.path.split('/').filter(Boolean)
  const seg = pathname.split('/').filter(Boolean)
  if (tpl.length !== seg.length) return -1
  let literal = 0
  for (let i = 0; i < tpl.length; i++) {
    const t = tpl[i]
    if (t.startsWith(':')) continue
    if (t !== seg[i]) return -1
    literal++
  }
  return literal
}

/** 解析任意 pathname → 命中的路由（含动态段提取）；无命中返回 null */
export function resolveRoute(pathname: string): { key: RouteKey; def: RouteDef; params: Record<string, string> } | null {
  let best: { key: RouteKey; def: RouteDef; score: number } | null = null
  for (const key of Object.keys(ROUTES) as RouteKey[]) {
    const def = ROUTES[key]
    const score = matchScore(def, pathname)
    if (score >= 0 && (!best || score > best.score)) best = { key, def, score }
  }
  if (!best) return null
  const seg = pathname.split('/').filter(Boolean)
  const tpl = best.def.path.split('/').filter(Boolean)
  const params: Record<string, string> = {}
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i].startsWith(':')) params[tpl[i].slice(1)] = decodeURIComponent(seg[i])
  }
  return { key: best.key, def: best.def, params }
}

/** Dock 高亮：解析 pathname → DockTab */
export function dockTabFor(pathname: string): DockTab {
  const hit = resolveRoute(pathname)
  return hit ? hit.def.dock : null
}

/** 底栏可见性：解析 pathname → boolean */
export function showDockFor(pathname: string): boolean {
  const hit = resolveRoute(pathname)
  return hit ? hit.def.showDock : false
}

// ─── 计数（对账用·Swagger 为外部计数唯一来源）───

export const ROUTE_COUNTS = {
  /** 67 页面路由 = 6 L0 + 3 public补充 + 8 Home + 10 Markets + 3 AI + 15 Assets + 22 Profile */
  pageRoutes: (Object.values(ROUTES) as RouteDef[]).filter((r) => r.domain !== 'system').length,
  /** 系统路由（仅 /auth/callback/email·不计入 67） */
  systemRoutes: (Object.values(ROUTES) as RouteDef[]).filter((r) => r.domain === 'system').length,
  /** Dock 导航项（3：home/markets/assets）+ AI 球（ai） */
  dockTabs: 3,
  dockAiOrb: 1,
}
