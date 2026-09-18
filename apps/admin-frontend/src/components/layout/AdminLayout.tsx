'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Activity,
  ArrowUpRight,
  Bell,
  BellRing,
  BookOpen,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Gavel,
  Globe,
  Home,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Menu,
  MessageCircle,
  Network,
  Percent,
  PieChart,
  Plug,
  Receipt,
  Scale,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> }
type NavSection = { id: string; title: string; icon: React.ComponentType<{ className?: string }>; items: NavItem[] }

/* 侧边栏二级结构：每个分组 = 一级（可折叠），组内项 = 二级 */
const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    title: '概览',
    icon: Home,
    items: [{ name: '工作台', href: '/dashboard', icon: Home }],
  },
  {
    id: 'operations',
    title: '运营',
    icon: SlidersHorizontal,
    items: [
      { name: '运营控制', href: '/control', icon: SlidersHorizontal },
      { name: 'Basket 运营', href: '/basket', icon: PieChart },
      { name: '资产分析', href: '/assets', icon: TrendingUp },
      { name: '资产目录', href: '/listings', icon: FileText },
      { name: '定价管理', href: '/pricing', icon: Tag },
      { name: '收益管理', href: '/yields', icon: Percent },
      { name: '结算管理', href: '/settlements', icon: Receipt },
      { name: '预测市场', href: '/polymarket', icon: Activity },
      { name: '文件管理', href: '/files', icon: FolderOpen },
    ],
  },
  {
    id: 'funds',
    title: '资金',
    icon: Wallet,
    items: [
      { name: '钱包财资', href: '/wallets', icon: Wallet },
      { name: '账本明细', href: '/ledger', icon: BookOpen },
      { name: '提现管理', href: '/withdrawals', icon: ArrowUpRight },
      { name: '对账中心', href: '/reconciliation', icon: Scale },
      { name: '归集管理', href: '/collections', icon: Boxes },
      { name: '网络配置', href: '/networks', icon: Network },
    ],
  },
  {
    id: 'compliance',
    title: '用户与合规',
    icon: ShieldCheck,
    items: [
      { name: '用户管理', href: '/users', icon: Users },
      { name: 'KYC 审核', href: '/kyc', icon: ShieldCheck },
      { name: '适当性评估', href: '/eligibility', icon: ClipboardCheck },
    ],
  },
  {
    id: 'community-risk',
    title: '社区与风控',
    icon: MessageCircle,
    items: [
      { name: '社区审核', href: '/community', icon: MessageCircle },
      { name: '风险控制', href: '/risk', icon: ShieldAlert },
      { name: '申诉处理', href: '/appeals', icon: Gavel },
      { name: '争议处理', href: '/disputes', icon: Gavel },
      { name: '客服工单', href: '/support', icon: LifeBuoy },
      { name: '审计日志', href: '/audit', icon: ScrollText },
    ],
  },
  {
    id: 'system',
    title: '系统',
    icon: Settings,
    items: [
      { name: 'AI 运维', href: '/ai-ops', icon: Bot },
      { name: '审批中心', href: '/approvals', icon: CheckCircle2 },
      { name: '作业队列', href: '/job-queue', icon: Workflow },
      { name: '通知管理', href: '/notifications', icon: BellRing },
      { name: '服务商', href: '/providers', icon: Plug },
      { name: '地区配置', href: '/regions', icon: Globe },
      { name: '系统设置', href: '/settings', icon: Settings },
    ],
  },
]

const ALL_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items)

/* 移动端底部常用入口 */
const DOCK_ITEMS: NavItem[] = [
  { name: '工作台', href: '/dashboard', icon: Home },
  { name: 'Basket', href: '/basket', icon: PieChart },
  { name: '社区审核', href: '/community', icon: MessageCircle },
  { name: '钱包', href: '/wallets', icon: Wallet },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

function sectionOf(pathname: string): { section: NavSection; item: NavItem } | null {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((entry) => isActive(pathname, entry.href))
    if (item) return { section, item }
  }
  return null
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="140 188 226 124" fill="none" aria-hidden="true">
      <path fill="#141830" d="M150 198h51l27.3 53.1-13.1 24.4c-2.8 5.2-7.2 8.1-12.5 8.1-6.1 0-11.4-3.6-14.3-9.2L150 198Z" />
      <path fill="#141830" d="M228.3 251.1l12.4-26.2c2.8-5.9 7.4-9.1 13.1-9.1 6.2 0 10.9 3.5 13.7 9.4L304 302h-51.2l-24.5-50.9Z" />
      <path fill="#5b6cf9" d="M305.4 198H356l-25.9 51.9h-28.2c-5.3 0-9.5-2.2-12.2-6.3-2.8-4.2-3.1-8.9-.8-13.6l16.5-32Z" />
    </svg>
  )
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl px-3 py-[7px] text-[13px] font-medium transition-all duration-200',
        active
          ? 'bg-white text-ink shadow-sm ring-1 ring-ink/[0.06]'
          : 'text-text-secondary hover:translate-x-0.5 hover:bg-white/60 hover:text-ink',
      )}
    >
      <span
        className={cn(
          'absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-mint transition-all duration-300',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Icon
        className={cn(
          'h-[17px] w-[17px] shrink-0 transition-all duration-200 group-hover:scale-110',
          active ? 'text-mint' : 'text-text-faint group-hover:text-mint',
        )}
      />
      <span className="truncate">{item.name}</span>
    </Link>
  )
}

function SidebarSection({
  section,
  pathname,
  closed,
  onToggle,
}: {
  section: NavSection
  pathname: string
  closed: boolean
  onToggle: () => void
}) {
  const SectionIcon = section.icon
  const hasActive = section.items.some((item) => isActive(pathname, item.href))
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] transition-colors',
          hasActive ? 'text-mint' : 'text-text-faint hover:text-text-secondary',
        )}
      >
        <SectionIcon className="h-3.5 w-3.5" />
        <span>{section.title}</span>
        {hasActive && !closed && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-mint" />}
        <ChevronDown className={cn('ml-auto h-3.5 w-3.5 transition-transform duration-300', closed ? '-rotate-90' : 'rotate-0')} />
      </button>
      <div className="nav-collapse" data-open={!closed}>
        <div className="min-h-0 overflow-hidden">
          <nav className="flex flex-col gap-0.5 pb-1">
            {section.items.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

function AccountMenu({ align }: { align: 'start' | 'end' }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-ink/[0.10] bg-white/70 py-1 pl-1 pr-3 text-sm font-medium text-ink shadow-sm transition-all duration-200 hover:bg-white hover:shadow-md"
          aria-label="账号菜单"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-mint to-accent-2 text-xs font-semibold text-white">R</span>
          管理员
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <div className="border-b border-ink/[0.08] px-4 py-3">
          <p className="text-sm font-medium">管理员账号</p>
          <p className="text-xs text-muted-foreground">RWA.LAT Admin</p>
        </div>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex w-full items-center gap-2">
            <Settings className="h-4 w-4" /> 系统设置
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/audit" className="flex w-full items-center gap-2">
            <ScrollText className="h-4 w-4" /> 审计日志
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-negative" asChild>
          <form action="/api/auth/logout" method="POST" className="w-full">
            <button type="submit" className="flex w-full items-center gap-2 text-left text-negative">
              <LogOut className="h-4 w-4" /> 退出登录
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({})
  const [allOpen, setAllOpen] = useState(false)

  // 全局 401 拦截：管理会话过期/失效时统一回到登录页并提示重新登录，
  // 而不是让每个页面的数据请求各自显示 "Admin session is invalid or expired"。
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args)
      if (response.status === 401 && !window.location.pathname.startsWith('/login')) {
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.assign(`/login?expired=1&next=${next}`)
      }
      return response
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  const current = useMemo(() => sectionOf(pathname), [pathname])

  const toggleSection = (id: string) => {
    setClosedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-4">
      <div className="mx-auto flex max-w-[1720px] gap-3 lg:gap-4">
        {/* ── Desktop sidebar（分组 + 二级菜单）───────────────── */}
        <aside className="glass-strong sticky top-4 hidden h-[calc(100vh-32px)] w-[252px] shrink-0 flex-col overflow-hidden rounded-[24px] lg:flex">
          {/* 品牌 */}
          <Link href="/dashboard" className="flex items-center gap-3 px-4 pb-3 pt-4" aria-label="RWA.LAT Admin">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-ink/[0.06]">
              <BrandMark className="h-5 w-7" />
            </span>
            <span>
              <span className="block text-[13px] font-bold tracking-tight">RWA.LAT Admin</span>
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-faint">Operations Console</span>
            </span>
          </Link>

          {/* 导航（可滚动，隐藏滚动条） */}
          <nav className="scrollbar-hide flex-1 overflow-y-auto px-2.5 pb-3">
            {NAV_SECTIONS.map((section) => (
              <SidebarSection
                key={section.id}
                section={section}
                pathname={pathname}
                closed={!!closedSections[section.id]}
                onToggle={() => toggleSection(section.id)}
              />
            ))}
          </nav>

          {/* 底部：账号 */}
          <div className="border-t border-ink/[0.06] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint to-accent-2 text-xs font-semibold text-white shadow-pill">
                  R
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">管理员</p>
                  <p className="truncate text-[11px] text-text-faint">rwacoin001@gmail.com</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-ink/[0.05] hover:text-ink" aria-label="账号操作">
                    <ChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex w-full items-center gap-2">
                      <Settings className="h-4 w-4" /> 系统设置
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/audit" className="flex w-full items-center gap-2">
                      <ScrollText className="h-4 w-4" /> 审计日志
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-negative" asChild>
                    <form action="/api/auth/logout" method="POST" className="w-full">
                      <button type="submit" className="flex w-full items-center gap-2 text-left text-negative">
                        <LogOut className="h-4 w-4" /> 退出登录
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>

        {/* ── Main column ───────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <header className="glass-strong mb-3 flex items-center justify-between gap-3 rounded-[20px] px-3 py-2.5 lg:mb-4 lg:px-4 lg:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={allOpen} onOpenChange={setAllOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="打开菜单">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
              </Sheet>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                  {current ? `${current.section.title} · RWA.LAT ADMIN` : 'RWA.LAT ADMIN'}
                </p>
                <p className="truncate text-sm font-semibold">{current?.item.name ?? '运营后台'}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href="/audit"
                title="审计日志"
                aria-label="审计日志"
                className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-all duration-200 hover:bg-ink/[0.05] hover:text-ink"
              >
                <Bell className="h-[18px] w-[18px]" />
              </Link>
              <div className="hidden sm:block">
                <AccountMenu align="end" />
              </div>
            </div>
          </header>

          <div className="pb-24 lg:pb-6">{children}</div>
        </div>
      </div>

      {/* ── Mobile sheet（全部页面）────────────────────────── */}
      <Sheet open={allOpen} onOpenChange={setAllOpen}>
        <SheetContent side="left" className="w-[308px] overflow-y-auto p-3">
          <div className="mb-3 flex items-center gap-3 px-2 pt-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-ink/[0.06]">
              <BrandMark className="h-5 w-8" />
            </span>
            <div>
              <p className="text-sm font-semibold">RWA.LAT Admin</p>
              <p className="text-xs text-muted-foreground">全部页面</p>
            </div>
          </div>
          {NAV_SECTIONS.map((section) => (
            <div key={section.id} className="mb-1">
              <p className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-faint">{section.title}</p>
              <nav className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAllOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                        active ? 'bg-mint/10 font-medium text-mint' : 'text-text-secondary hover:bg-ink/[0.04] hover:text-ink',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
          ))}
        </SheetContent>
      </Sheet>

      {/* ── Mobile bottom dock ──────────────────────────────── */}
      <nav className="glass-strong fixed bottom-3 left-3 right-3 z-40 rounded-[22px] px-1.5 py-1.5 lg:hidden">
        <div className="flex items-center justify-around">
          {DOCK_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.name}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition-all duration-200',
                  active ? 'text-mint' : 'text-text-secondary hover:text-ink',
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setAllOpen(true)}
            aria-label="全部页面"
            className="flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium text-text-secondary transition-all duration-200 hover:text-ink"
          >
            <LayoutGrid className="h-5 w-5" />
            全部
          </button>
        </div>
      </nav>
    </div>
  )
}
