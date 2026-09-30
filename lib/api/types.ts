/**
 * lib/api/types.ts — 类型化 API 入口（S1）
 *
 * 事实源：`lib/api/schema.d.ts`（由 openapi-typescript 从运行中的
 * `/v1/docs-json` 自动生成 —— Swagger 是唯一计数与 Schema 来源）。
 *
 * 再生成：`pnpm api:types`（需 API 在 localhost:4000 运行）
 */
import type { components, paths } from './schema'

export type { components, paths }

// ─── 常用别称 ───

export type ApiComponents = components
export type ApiSchemas = components['schemas']

/** S1 首页生命周期用：当前会话视图（GET /v1/auth/session） */
export type ApiSessionView = ApiSchemas['SessionViewDto']

/** 认证结果（登录/注册等返回体·含 emailVerified） */
export type ApiAuthResult = {
  userId: string
  sessionId: string
  token: string
  emailVerified: boolean
}

/** 从 paths 提取某操作的成功响应类型的小工具 */
export type OperationResponse<
  P extends keyof paths,
  M extends keyof paths[P],
> = paths[P][M] extends { responses: { 200: { content: { 'application/json': infer R } } } }
  ? R
  : paths[P][M] extends { responses: { 201: { content: { 'application/json': infer R } } } }
    ? R
    : never

// ─── 端点路径常量（与后端对齐·避免手写字符串漂移）───

export const API_PATHS = {
  auth: {
    session: '/v1/auth/session',
    login: '/v1/auth/login/email',
    loginConfirm: '/v1/auth/login/email/confirm',
    verifyEmail: '/v1/auth/verify-email',
    register: '/v1/auth/register/email',
    logout: '/v1/auth/logout',
  },
  wallet: '/v1/wallet',
  ledgerBalances: '/v1/ledger/balances',
  positions: '/v1/portfolio/positions',
  kycStatus: '/v1/compliance/kyc/status', // 真实路径（带 /compliance 前缀·非 /v1/kyc/status）
  eligibility: (scope: string) => `/v1/compliance/eligibility/${scope}`,
  marketContext: '/v1/market-context',
  rwaAssets: '/v1/rwa/assets',
  communityFeed: '/v1/community/feed',
  notifications: '/v1/notifications',
} as const
