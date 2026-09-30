/**
 * lib/home-lifecycle.ts — Home 生命周期解析器（S1 批次 5·骨架核心）
 *
 * 依据：IA v2.2 定稿（6 Lifecycle + Variants + Mode）
 *   Lifecycle: guest → email_unverified → kyc_incomplete → unfunded → funded → invested
 *   Variants:  kyc_in_progress | kyc_submitted | kyc_needs_information | kyc_rejected |
 *              kyc_expired | funded_locked_only | invested_restricted
 *   Mode:      live | paper（paper 与 lifecycle 正交·S1 仅 live）
 *
 * 设计原则（S1 验收关注点）：
 *   1. 纯函数——不发起请求；输入是各数据源的快照（含"是否加载成功"标志）
 *   2. **失败 ≠ 0**：任一数据源失败时不得把用户误判为"未入金/无持仓"；
 *      数据缺失走保守判定并标 degraded 标志
 *   3. **资产优先守卫**：已有持仓的用户始终进入 invested（即使 KYC 失效 →
 *      invested_restricted 变体），绝不把老用户打回"请开户"页
 *   4. KYC 枚举使用后端真实 7 值（not_started/in_progress/submitted/
 *      needs_information/approved/rejected/expired）
 */

// ─── 类型 ───

export type Lifecycle =
  | 'guest'
  | 'email_unverified'
  | 'kyc_incomplete'
  | 'unfunded'
  | 'funded'
  | 'invested'

export type KycState =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'needs_information'
  | 'approved'
  | 'rejected'
  | 'expired'

export type HomeVariant =
  | 'kyc_in_progress'
  | 'kyc_submitted'
  | 'kyc_needs_information'
  | 'kyc_rejected'
  | 'kyc_expired'
  | 'funded_locked_only'
  | 'invested_restricted'
  | null

export type HomeMode = 'live' | 'paper'

/** 数据源快照（由页面层一次性获取后传入） */
export interface HomeInputs {
  /** 会话是否已完成加载（无 token 或请求完成） */
  sessionLoaded: boolean
  /** 会话请求已失败；与仍在加载区分，不把认证失败当作已退出。 */
  sessionFailed?: boolean
  /** null = 无会话（guest）。emailVerified 来自 GET /v1/auth/session */
  session: { emailVerified: boolean } | null
  /** null = 未加载或失败。单位 USDT */
  wallet: { available: number; locked: number; pending: number; invested: number } | null
  /** null = 未加载或失败。state 为后端真实 7 枚举 */
  kyc: { state: KycState } | null
  /** null = 未加载或失败 */
  positionsCount: number | null
  /** 可选：paper 模式（S1 恒 live·预留） */
  mode?: HomeMode
}

export interface HomeState {
  lifecycle: Lifecycle
  variant: HomeVariant
  mode: HomeMode
  /** 各数据源是否成功取得（false = 失败/缺失） */
  flags: { session: boolean; wallet: boolean; kyc: boolean; positions: boolean }
  /** true = 存在数据缺失、判定走保守分支（UI 可显示"数据加载中/受限"提示） */
  degraded: boolean
}

// ─── 解析器 ───

export function resolveHomeState(inputs: HomeInputs): HomeState {
  const mode: HomeMode = inputs.mode ?? 'live'
  const flags = {
    session: inputs.sessionLoaded && !inputs.sessionFailed,
    wallet: inputs.wallet !== null,
    kyc: inputs.kyc !== null,
    positions: inputs.positionsCount !== null,
  }

  // 会话请求失败时身份未知，保留降级标记且不提供注册 CTA。
  if (inputs.sessionFailed) {
    return { lifecycle: 'guest', variant: null, mode, flags, degraded: true }
  }
  // ① 未登录（会话加载完成但无会话）
  if (inputs.sessionLoaded && inputs.session === null) {
    return { lifecycle: 'guest', variant: null, mode, flags, degraded: false }
  }
  // 会话尚未加载完成——按 guest 骨架渲染（避免闪烁错误态）
  if (!inputs.sessionLoaded) {
    return { lifecycle: 'guest', variant: null, mode, flags, degraded: false }
  }

  // ② 邮箱未验证
  if (inputs.session && !inputs.session.emailVerified) {
    return { lifecycle: 'email_unverified', variant: null, mode, flags, degraded: false }
  }

  const kycOk = inputs.kyc !== null
  const kycApproved = kycOk && inputs.kyc!.state === 'approved'

  // ③ 资产优先守卫：持仓接口或钱包 invested 余额证明已有资产时，始终进入 invested。
  //    仅当 KYC 明确非 approved 时给 invested_restricted 变体（未知时不上横幅·仅 degraded）
  const hasPositions = (inputs.positionsCount !== null && inputs.positionsCount > 0)
    || (inputs.wallet !== null && inputs.wallet.invested > 0)
  if (hasPositions) {
    return {
      lifecycle: 'invested',
      variant: kycOk && !kycApproved ? 'invested_restricted' : null,
      mode,
      flags,
      degraded: !kycOk || inputs.positionsCount === null || inputs.wallet === null
        || (inputs.positionsCount === 0 && (inputs.wallet?.invested ?? 0) > 0),
    }
  }

  // ④ KYC 明确通过 → 资金判定（失败 ≠ 0：wallet 缺失时保守按 funded·不回退 unfunded）
  if (kycApproved) {
    if (inputs.wallet === null || inputs.positionsCount === null) {
      return { lifecycle: 'funded', variant: null, mode, flags, degraded: true }
    }
    const { available, locked } = inputs.wallet
    if (available > 0) return { lifecycle: 'funded', variant: null, mode, flags, degraded: false }
    if (locked > 0) return { lifecycle: 'funded', variant: 'funded_locked_only', mode, flags, degraded: false }
    if (inputs.wallet.pending > 0) return { lifecycle: 'funded', variant: null, mode, flags, degraded: true }
    return { lifecycle: 'unfunded', variant: null, mode, flags, degraded: false }
  }

  // ⑤ KYC 明确未通过 → kyc_incomplete（按真实 state 给 variant）
  if (kycOk) {
    let variant: HomeVariant = null
    switch (inputs.kyc!.state) {
      case 'in_progress': variant = 'kyc_in_progress'; break
      case 'submitted': variant = 'kyc_submitted'; break
      case 'needs_information': variant = 'kyc_needs_information'; break
      case 'rejected': variant = 'kyc_rejected'; break
      case 'expired': variant = 'kyc_expired'; break
      default: variant = null // not_started
    }
    return { lifecycle: 'kyc_incomplete', variant, mode, flags, degraded: !flags.wallet || !flags.positions }
  }

  // ⑥ KYC 查询失败（未知）——保守判定：有余额视为 funded（不误判），否则 kyc_incomplete + degraded
  if (inputs.wallet !== null && (inputs.wallet.available > 0 || inputs.wallet.locked > 0 || inputs.wallet.pending > 0)) {
    return { lifecycle: 'funded', variant: null, mode, flags, degraded: true }
  }
  return { lifecycle: 'kyc_incomplete', variant: null, mode, flags, degraded: true }
}

// ─── 首页状态卡 CTA 映射（沿用 heroCta 函数名以兼容现有调用） ───

export type HomeCta = { kind: string; routeKey: string; query?: string }

export function heroCta(state: HomeState): HomeCta | null {
  switch (state.lifecycle) {
    case 'guest':
      if (state.degraded) return null
      return { kind: 'register', routeKey: 'register' }
    case 'email_unverified':
      return { kind: 'verifyEmail', routeKey: 'verifyEmail' }
    case 'kyc_incomplete':
      return { kind: 'continueKyc', routeKey: 'kyc' }
    case 'unfunded':
      return { kind: 'deposit', routeKey: 'cashDeposit' }
    case 'funded':
      if (state.degraded) return null
      return state.variant === 'funded_locked_only'
        ? { kind: 'viewOrders', routeKey: 'orderStatus' }
        : { kind: 'browseBaskets', routeKey: 'markets', query: 'tab=baskets' }
    case 'invested':
      return null // 无主 CTA（次级按钮在 Portfolio 卡内）
  }
}

// ─── 区块组合（block composition） ───

export type HomeBlockId =
  | 'hero'
  | 'portfolioSummary'
  | 'marketPulse'
  | 'forYou'
  | 'featuredAssets'
  | 'marketLens'
  | 'prediction'
  | 'yield'
  | 'communityPicks'
  | 'trust'

/** S2：首页为单一滚动流；资产组合卡承载所有生命周期状态，金额按真实资产显示。 */
export function homeBlocks(state: HomeState): HomeBlockId[] {
  const blocks: HomeBlockId[] = ['hero', 'portfolioSummary']
  blocks.push('marketPulse', 'forYou', 'featuredAssets', 'marketLens', 'prediction')
  if (state.lifecycle === 'invested') blocks.push('yield')
  blocks.push('communityPicks', 'trust')
  return blocks
}
