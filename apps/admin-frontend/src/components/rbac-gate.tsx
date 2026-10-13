'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { adminApi } from '@/lib/admin-api'

/* 前端 RBAC 仅做 UX 隐藏/提示；真正的权限校验始终在管理 API（AdminPermissionGuard，精确匹配权限名）。 */

export type AdminProfile = { id: string; email: string; roleName: string; permissions: string[] }
export type ProfileState = { profile: AdminProfile | null; status: 'loading' | 'ready' | 'error' }

/** 路由 → 访问所需权限（满足任一即可）。与 apps/admin/src/*.controller.ts 中该页面主要接口的 @RequireAdminPermissions 对应。 */
export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/control': ['catalog.manage'],
  '/basket': ['basket.operations.manage'],
  '/assets': ['core.console.view'],
  '/yields': ['core.console.view'],
  '/settlements': ['core.console.view'],
  '/orders': ['core.console.view'],
  '/kyc': ['core.console.view'],
  '/eligibility': ['core.console.view'],
  '/risk': ['core.console.view'],
  '/collections': ['core.console.view'],
  '/networks': ['core.console.view'],
  '/ai-ops': ['core.console.view'],
  '/polymarket': ['core.console.view', 'polymarket.manage'],
  '/files': ['storage.manage'],
  '/document-templates': ['platform.manage'],
  '/content': ['platform.manage'],
  '/referral': ['platform.manage'],
  '/ai-knowledge': ['platform.manage'],
  '/ai-investment': ['platform.manage'],
  '/organization': ['platform.manage'],
  '/regions': ['platform.manage'],
  '/legal': ['platform.manage'],
  '/funds': ['ledger.reconciliation.manage'],
  '/wallets': ['wallet.addresses.manage'],
  '/withdrawals': ['wallet.withdrawals.manage', 'operations.funds.switch.manage'],
  '/withdrawal-whitelist': ['wallet.withdrawals.manage'],
  '/ledger': ['ledger.adjustments.manage', 'ledger.reconciliation.manage'],
  '/reconciliation': ['ledger.reconciliation.manage'],
  '/users': ['users.read'],
  '/community': ['community.content.review'],
  '/support': ['support.tickets.manage'],
  '/audit': ['audit.read'],
  '/approvals': ['approvals.manage'],
  '/job-queue': ['operations.jobs.manage'],
  '/notifications': ['notifications.manage'],
}

export function routePermissions(pathname: string): string[] {
  const match = Object.keys(ROUTE_PERMISSIONS)
    .filter((href) => pathname === href || pathname.startsWith(href + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return match ? ROUTE_PERMISSIONS[match] : []
}

let cachedProfile: AdminProfile | null = null
let inflight: Promise<AdminProfile> | null = null

function loadProfile(): Promise<AdminProfile> {
  if (!inflight) {
    inflight = adminApi.getProfile()
      .then((body) => {
        if (!body || typeof body.email !== 'string' || !Array.isArray(body.permissions)) throw new Error('Invalid profile')
        cachedProfile = { id: String(body.id ?? ''), email: body.email, roleName: String(body.roleName ?? ''), permissions: body.permissions.filter((p: unknown) => typeof p === 'string') }
        return cachedProfile
      })
      .catch((error) => {
        inflight = null
        throw error
      })
  }
  return inflight
}

/** 当前管理员资料（/api/admin/auth/me），模块级缓存，跨页面复用。 */
export function useAdminProfile(): ProfileState {
  const [state, setState] = useState<ProfileState>(() => (cachedProfile ? { profile: cachedProfile, status: 'ready' } : { profile: null, status: 'loading' }))
  useEffect(() => {
    if (cachedProfile) {
      setState({ profile: cachedProfile, status: 'ready' })
      return
    }
    let alive = true
    loadProfile()
      .then((profile) => { if (alive) setState({ profile, status: 'ready' }) })
      .catch(() => { if (alive) setState({ profile: null, status: 'error' }) })
    return () => { alive = false }
  }, [])
  return state
}

/** 资料未就绪（加载中/失败）时不隐藏，交由后端裁决。 */
export function allows(state: ProfileState, anyOf: string[] | undefined): boolean {
  if (!anyOf?.length || state.status !== 'ready' || !state.profile) return true
  return anyOf.some((permission) => state.profile!.permissions.includes(permission))
}

/** 明确已知无权限时为 true（用于跳过请求、显示「无权限」）。 */
export function denies(state: ProfileState, anyOf: string[]): boolean {
  return !allows(state, anyOf)
}

export function useCan(anyOf: string[] | undefined): boolean {
  return allows(useAdminProfile(), anyOf)
}

export function NoAccess({ permissions }: { permissions: string[] }) {
  return (
    <div className="animate-rise glass-strong rounded-card p-8">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
          <Lock className="h-6 w-6 text-rose-600" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">无权访问此页面</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">当前管理员角色缺少所需权限，请联系超级管理员分配。</p>
        <p className="mt-3 flex flex-wrap justify-center gap-1.5">
          {permissions.map((permission) => (
            <span key={permission} className="pill bg-ink/[0.06] font-mono text-text-secondary">{permission}</span>
          ))}
        </p>
        <Link href="/dashboard" className="mt-5 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110">
          返回工作台
        </Link>
      </div>
    </div>
  )
}

/** 页面/区块级门禁：已确认无权限时显示提示，否则渲染内容。 */
export function RbacGate({ anyOf, children, fallback }: { anyOf: string[]; children: ReactNode; fallback?: ReactNode }) {
  const state = useAdminProfile()
  if (allows(state, anyOf)) return <>{children}</>
  return <>{fallback ?? <NoAccess permissions={anyOf} />}</>
}
