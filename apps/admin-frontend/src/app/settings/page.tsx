'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { cn } from '@/lib/utils'
import {
  ArrowUpRight,
  BadgeCheck,
  Globe,
  KeyRound,
  LifeBuoy,
  Lock,
  LogOut,
  PieChart,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle2,
} from 'lucide-react'

type Profile = { id: string; email: string; roleName: string; permissions: string[] }

const PERMISSION_LABELS: Record<string, string> = {
  'basket.operations.manage': 'Basket 组合运营',
  'users.read': '用户查看',
  'redemptions.read': '赎回查看',
  'audit.read': '审计日志读取',
  'approvals.manage': '审批管理',
  'community.content.review': '社区内容审核',
  'community.reports.manage': '社区举报处理',
  'wallet.operations.manage': '钱包资金运营',
  'control.operations.manage': '运营控制管理',
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  operator: '运营员',
  reviewer: '审核员',
}

function permissionLabel(key: string) {
  return PERMISSION_LABELS[key] ?? key
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [health, setHealth] = useState<{ status: string; app: string; time: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const [meRes, healthRes] = await Promise.allSettled([
        fetch('/api/admin/auth/me', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
        fetch('/api/admin/health', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
      ])
      if (!mounted) return
      if (meRes.status === 'fulfilled' && meRes.value) setProfile(meRes.value as Profile)
      if (healthRes.status === 'fulfilled' && healthRes.value) setHealth(healthRes.value as { status: string; app: string; time: string })
      setLoading(false)
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="animate-rise">
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">系统设置</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理员资料 · 权限 · 安全与会话 · 系统状态</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* ── 左列（2/3）────────────────────────────── */}
          <div className="space-y-4 lg:col-span-2">
            {/* 管理员资料 */}
            <section className="glass-strong card-lift animate-rise rounded-card p-5" style={{ animationDelay: '60ms' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mint to-accent-2 text-lg font-bold text-white shadow-pill">
                    R
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{profile?.email?.split('@')[0] ?? '管理员'}</h2>
                      <span className="pill bg-mint/12 text-mint">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {ROLE_LABELS[profile?.roleName ?? ''] ?? profile?.roleName ?? '管理员'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{loading ? '加载中…' : profile?.email ?? '—'}</p>
                  </div>
                </div>
                <UserCircle2 className="h-6 w-6 text-text-faint" />
              </div>
              <div className="mt-4 grid gap-3 border-t border-ink/[0.06] pt-4 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="h-4 w-4 text-text-faint" />
                  <span className="text-text-secondary">账号 ID</span>
                  <span className="ml-auto font-mono text-xs text-text-faint">{profile ? `${profile.id.slice(0, 8)}…` : '—'}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-text-faint" />
                  <span className="text-text-secondary">角色</span>
                  <span className="ml-auto text-xs font-medium">{ROLE_LABELS[profile?.roleName ?? ''] ?? profile?.roleName ?? '—'}</span>
                </div>
              </div>
            </section>

            {/* 我的权限 */}
            <section className="glass-strong card-lift animate-rise rounded-card p-5" style={{ animationDelay: '120ms' }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Lock className="h-4 w-4 text-mint" /> 我的权限
                </h2>
                <span className="text-xs text-text-faint">{profile?.permissions?.length ?? 0} 项</span>
              </div>
              {loading ? (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className="h-7 w-28 animate-pulse rounded-full bg-ink/[0.06]" />
                  ))}
                </div>
              ) : profile?.permissions?.length ? (
                <div className="flex flex-wrap gap-2">
                  {profile.permissions.map((perm) => (
                    <span key={perm} className="pill bg-ink/[0.05] text-text-secondary ring-1 ring-ink/[0.05]" title={perm}>
                      {permissionLabel(perm)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">当前账号未分配独立权限键（或权限数据暂不可用）。</p>
              )}
              <p className="mt-3 border-t border-ink/[0.06] pt-3 text-xs text-text-faint">
                权限由角色统一授予，变更后即时生效（每次请求实时校验）。如需调整请联系系统维护人员修改角色权限表。
              </p>
            </section>

            {/* 安全与会话 */}
            <section className="glass-strong card-lift animate-rise rounded-card p-5" style={{ animationDelay: '180ms' }}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="h-4 w-4 text-mint" /> 安全与会话
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-ink/[0.03] px-4 py-3">
                  <div>
                    <p className="font-medium">两步验证（MFA）</p>
                    <p className="text-xs text-text-faint">登录时需输入动态验证码，已强制启用</p>
                  </div>
                  <span className="pill bg-emerald-500/12 text-emerald-600">已启用</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-ink/[0.03] px-4 py-3">
                  <div>
                    <p className="font-medium">会话有效期</p>
                    <p className="text-xs text-text-faint">到期后需重新登录（默认 8 小时）</p>
                  </div>
                  <span className="pill bg-ink/[0.06] text-text-secondary">8 小时</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-ink/[0.03] px-4 py-3">
                  <div>
                    <p className="font-medium">登录防护</p>
                    <p className="text-xs text-text-faint">连续失败 5 次锁定 15 分钟；高风险操作全部留审计</p>
                  </div>
                  <span className="pill bg-emerald-500/12 text-emerald-600">已开启</span>
                </div>
              </div>
              <form action="/api/auth/logout" method="POST" className="mt-4 border-t border-ink/[0.06] pt-4">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-negative/10 px-4 py-2 text-sm font-medium text-negative transition-colors hover:bg-negative/15"
                >
                  <LogOut className="h-4 w-4" /> 退出登录
                </button>
              </form>
            </section>
          </div>

          {/* ── 右列（1/3）────────────────────────────── */}
          <div className="space-y-4">
            {/* 系统状态 */}
            <section className="glass-strong card-lift animate-rise rounded-card p-5" style={{ animationDelay: '90ms' }}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Server className="h-4 w-4 text-mint" /> 系统状态
              </h2>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Admin API</span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', health?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500')} />
                    <span className="text-xs font-medium">{health?.status === 'ok' ? '正常' : loading ? '检测中…' : '不可达'}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">服务标识</span>
                  <span className="font-mono text-xs text-text-faint">{health?.app ?? 'rwa-lat-admin'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">运行环境</span>
                  <span className="pill bg-mint/12 text-mint">
                    <Globe className="h-3 w-3" /> 生产
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">资金执行</span>
                  <span className="pill bg-ink/[0.06] text-text-secondary">默认关闭</span>
                </div>
              </div>
            </section>

            {/* 快捷入口 */}
            <section className="glass-strong card-lift animate-rise rounded-card p-5" style={{ animationDelay: '150ms' }}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Settings className="h-4 w-4 text-mint" /> 快捷入口
              </h2>
              <div className="space-y-1.5">
                {[
                  { href: '/audit', label: '审计日志', icon: ScrollText },
                  { href: '/control', label: '运营控制（开关 / 产品）', icon: SlidersHorizontal },
                  { href: '/basket', label: 'Basket 运营', icon: PieChart },
                  { href: '/community', label: '社区审核', icon: ShieldCheck },
                  { href: '/support', label: '客服工单', icon: LifeBuoy },
                ].map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-all duration-200 hover:translate-x-0.5 hover:bg-white/70 hover:text-ink"
                  >
                    <entry.icon className="h-4 w-4 text-text-faint transition-colors group-hover:text-mint" />
                    {entry.label}
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            </section>

            {/* 关于 */}
            <section className="animate-rise rounded-card border border-mint/20 bg-gradient-to-br from-mint/10 via-white/50 to-accent-2/10 p-5" style={{ animationDelay: '210ms' }}>
              <p className="text-sm font-semibold">RWA.LAT Admin Console</p>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                运营管理台 v0.1.0 · 资金执行与真实交易默认关闭，所有高危动作需通过审批流与审计留痕。
              </p>
            </section>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
