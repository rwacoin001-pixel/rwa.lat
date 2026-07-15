'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, TrendingUp, Wallet, Settings, LogOut, User, Shield, Menu, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { SheetClose } from '@/components/ui/sheet'

const navigation = [
  { name: '工作台', href: '/dashboard', icon: Home },
  { name: '资产管理', href: '/assets', icon: TrendingUp },
  { name: '钱包财资', href: '/wallet', icon: Wallet },
  { name: '设置', href: '/settings', icon: Settings },
]

// Use a more permissive type to avoid ReactNode conflicts
type ChildrenProp = {
  children: React.ReactNode
}

export function AdminLayout({ children }: ChildrenProp) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 glass-strong border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Brand */}
            <Link href="/dashboard" className="flex items-center gap-2 text-xl font-semibold" aria-label="RWA.LAT Admin">
              <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                <line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="16" cy="16" r="3" fill="#2FE6BF" />
              </svg>
              <span className="font-semibold tracking-tight">RWA.LAT Admin</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 ml-8">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-muted-foreground hover:text-white hover:bg-white/5'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="w-4 h-4" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* User Menu */}
            <div className="hidden md:flex items-center gap-3 ml-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-full p-0 relative">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mint to-cyan-400 flex items-center justify-center">
                      <span className="text-black font-medium text-xs">A</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong w-56">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="font-medium text-sm">Admin User</p>
                    <p className="text-xs text-muted-foreground">admin@rwa.lat</p>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex w-full items-center gap-2">
                      <User className="w-4 h-4" />
                      个人中心
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex w-full items-center gap-2">
                      <Settings className="w-4 h-4" />
                      设置
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" asChild>
                    <form action="/api/auth/logout" method="POST">
                      <button type="submit" className="flex w-full items-center gap-2 text-left text-destructive">
                        <LogOut className="w-4 h-4" />
                        退出登录
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="md:hidden h-9 w-9" aria-label="打开菜单">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="glass-strong w-72 p-4">
            <nav className="flex flex-col gap-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-muted-foreground hover:text-white hover:bg-white/5'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
              <div className="pt-4 border-t border-white/10" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-3 px-3 py-3 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-mint to-cyan-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-black font-medium text-sm">A</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-medium text-sm">Admin User</p>
                      <p className="text-xs text-muted-foreground">admin@rwa.lat</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex w-full items-center gap-2">
                      <User className="w-4 h-4" />
                      个人中心
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex w-full items-center gap-2">
                      <Settings className="w-4 h-4" />
                      设置
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" asChild>
                    <form action="/api/auth/logout" method="POST">
                      <button type="submit" className="flex w-full items-center gap-2 text-left text-destructive">
                        <LogOut className="w-4 h-4" />
                        退出登录
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16 pb-20 md:pb-8">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Dock */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass-strong border-t border-white/10">
        <div className="flex h-16 items-center justify-around">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
                  isActive
                    ? 'text-mint'
                    : 'text-muted-foreground hover:text-white'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}