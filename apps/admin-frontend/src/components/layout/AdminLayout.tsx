'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bot,
  Boxes,
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
  Network,
  Percent,
  Plug,
  Receipt,
  Scale,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  Users,
  Wallet,
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

const PRIMARY: NavItem[] = [
  { name: '工作台', href: '/dashboard', icon: Home },
  { name: '运营控制', href: '/control', icon: SlidersHorizontal },
  { name: '文件管理', href: '/files', icon: FolderOpen },
  { name: '订单', href: '/orders', icon: ShoppingCart },
  { name: '用户', href: '/users', icon: Users },
  { name: '钱包财资', href: '/wallets', icon: Wallet },
]

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: '概览',
    items: [{ name: '工作台', href: '/dashboard', icon: Home }],
  },
  {
    title: '运营',
    items: [
      { name: '运营控制', href: '/control', icon: SlidersHorizontal },
      { name: '资产总览', href: '/assets', icon: TrendingUp },
      { name: '资产目录', href: '/listings', icon: FileText },
      { name: '定价管理', href: '/pricing', icon: Tag },
      { name: '收益管理', href: '/yields', icon: Percent },
      { name: '文件管理', href: '/files', icon: FolderOpen },
      { name: '预测市场', href: '/polymarket', icon: Activity },
      { name: '结算管理', href: '/settlements', icon: Receipt },
    ],
  },
  {
    title: '用户与合规',
    items: [
      { name: '用户管理', href: '/users', icon: Users },
      { name: 'KYC 审核', href: '/kyc', icon: ShieldCheck },
      { name: '适当性评估', href: '/eligibility', icon: ClipboardCheck },
    ],
  },
  {
    title: '资金',
    items: [
      { name: '钱包账本', href: '/wallets', icon: Wallet },
      { name: '账本明细', href: '/ledger', icon: BookOpen },
      { name: '提现管理', href: '/withdrawals', icon: ArrowUpRight },
      { name: '对账中心', href: '/reconciliation', icon: Scale },
      { name: '归集管理', href: '/collections', icon: Boxes },
      { name: '网络配置', href: '/networks', icon: Network },
    ],
  },
  {
    title: '风控与支持',
    items: [
      { name: '风险控制', href: '/risk', icon: ShieldAlert },
      { name: '申诉处理', href: '/appeals', icon: Gavel },
      { name: '争议处理', href: '/disputes', icon: Gavel },
      { name: '客服工单', href: '/support', icon: LifeBuoy },
      { name: '审计日志', href: '/audit', icon: ScrollText },
    ],
  },
  {
    title: '系统',
    items: [
      { name: 'AI 运维', href: '/ai-ops', icon: Bot },
      { name: '服务商', href: '/providers', icon: Plug },
      { name: '地区配置', href: '/regions', icon: Globe },
    ],
  },
]

const ALL_ITEMS: NavItem[] = GROUPS.flatMap((g) => g.items)

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
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

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      title={item.name}
      aria-label={item.name}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200',
        active
          ? 'bg-white text-mint shadow-sm ring-1 ring-ink/[0.06]'
          : 'text-text-secondary hover:bg-white/70 hover:text-ink'
      )}
    >
      <Icon className="h-[21px] w-[21px]" />
    </Link>
  )
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [allOpen, setAllOpen] = useState(false)

  const current = ALL_ITEMS.find((item) => isActive(pathname, item.href))

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-4">
      <div className="mx-auto flex max-w-[1680px] gap-3 lg:gap-4">
        {/* ── Desktop icon rail ─────────────────────────────── */}
        <aside className="glass-strong sticky top-3 hidden h-[calc(100vh-24px)] w-[76px] shrink-0 flex-col items-center justify-between rounded-[24px] py-4 lg:top-4 lg:flex lg:h-[calc(100vh-32px)]">
          <div className="flex flex-col items-center gap-6">
            <Link
              href="/dashboard"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-ink/[0.06]"
              aria-label="RWA.LAT Admin"
              title="RWA.LAT Admin"
            >
              <BrandMark className="h-6 w-9" />
            </Link>
            <nav className="flex flex-col items-center gap-1.5">
              {PRIMARY.map((item) => (
                <RailLink key={item.href} item={item} pathname={pathname} />
              ))}
              <button
                type="button"
                onClick={() => setAllOpen(true)}
                title="全部页面"
                aria-label="全部页面"
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-text-secondary transition-all duration-200 hover:bg-white/70 hover:text-ink"
              >
                <LayoutGrid className="h-[21px] w-[21px]" />
              </button>
            </nav>
          </div>

          <div className="flex flex-col items-center gap-2">
            <Link
              href="/settings"
              title="设置"
              aria-label="设置"
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200',
                isActive(pathname, '/settings')
                  ? 'bg-white text-mint shadow-sm ring-1 ring-ink/[0.06]'
                  : 'text-text-secondary hover:bg-white/70 hover:text-ink'
              )}
            >
              <Settings className="h-[21px] w-[21px]" />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-mint to-accent-2 text-sm font-semibold text-white shadow-pill"
                  aria-label="账号菜单"
                >
                  R
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="border-b border-ink/[0.08] px-4 py-3">
                  <p className="text-sm font-medium">管理员账号</p>
                  <p className="text-xs text-muted-foreground">RWA.LAT Admin</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex w-full items-center gap-2">
                    <Settings className="h-4 w-4" /> 设置
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
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint">
                  RWA.LAT ADMIN
                </p>
                <p className="truncate text-sm font-semibold">{current?.name ?? '运营后台'}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href="/audit"
                title="审计日志"
                aria-label="审计日志"
                className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <Bell className="h-[18px] w-[18px]" />
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full border border-ink/[0.10] bg-white/70 py-1 pl-1 pr-3 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-white"
                    aria-label="账号菜单"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-mint to-accent-2 text-xs font-semibold text-white">
                      R
                    </span>
                    管理员
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex w-full items-center gap-2">
                      <Settings className="h-4 w-4" /> 设置
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
          </header>

          <div className="pb-24 lg:pb-6">{children}</div>
        </div>
      </div>

      {/* ── All pages sheet ─────────────────────────────────── */}
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
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-1">
              <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
                {group.title}
              </p>
              <nav className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href + item.name}
                      href={item.href}
                      onClick={() => setAllOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-mint/10 font-medium text-mint'
                          : 'text-text-secondary hover:bg-ink/[0.04] hover:text-ink'
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
          {PRIMARY.slice(0, 5).map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.name}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium transition-all',
                  active ? 'text-mint' : 'text-text-secondary hover:text-ink'
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
            className="flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10px] font-medium text-text-secondary transition-all hover:text-ink"
          >
            <LayoutGrid className="h-5 w-5" />
            全部
          </button>
        </div>
      </nav>
    </div>
  )
}
