'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/ops/AppShell'
import { locate } from '@/components/ops/nav'
import { PageTitle } from '@/components/ops/ui'

// Pages that are not a tab of their own still get a proper title.
const TITLES: Record<string, string> = {
  '/ai-ops': 'AI 分析记录',
  '/regions': '地区与语言',
  '/networks': '网络目录',
  '/withdrawals': '提现执行开关',
  '/reconciliation': '托管对账',
  '/dashboard': '概览（旧版）',
  '/pricing': '定价',
  '/quant/settlement': '每日结算（旧版）',
}

/**
 * Pages that have not moved to the redesigned console yet: they get the new frame (top bar, areas, search, alerts)
 * and their own title, and keep their light content on one light board until each is rebuilt.
 */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { group, tab } = locate(pathname)
  const title = TITLES[pathname] ?? tab?.label ?? group.label
  return (
    <AppShell>
      <PageTitle title={title} />
      <div className="min-w-0 rounded-[28px] bg-[#F4F6FA] p-3 font-inter text-ink sm:p-5 lg:p-6">
        <div className="space-y-5">{children}</div>
      </div>
    </AppShell>
  )
}
