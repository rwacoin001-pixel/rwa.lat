'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bell, LogOut, MoreHorizontal, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RbacGate, allows, routePermissions, useAdminProfile } from '@/components/rbac-gate'
import { NAV_GROUPS, locate, type NavGroup, type NavTab } from './nav'
import { openWork, useToday, type Today } from './data'
import { newArrivals } from './queues'
import { CircleButton, Face } from './ui'

function tabCount(tab: NavTab, today: Today | null): number {
  if (!today || !tab.queues) return 0
  return tab.queues.reduce((sum, key) => { const q = today.queues[key]; return sum + (q && q.status === 'ok' ? q.count : 0) }, 0)
}
const groupCount = (group: NavGroup, today: Today | null) => group.tabs.reduce((sum, t) => sum + tabCount(t, today), 0)

/**
 * The redesigned console's frame: a top bar with one round button per area, the current area opened into a white
 * capsule of its tabs (the current tab lime), search, alerts and the admin. Pages render below it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const access = useAdminProfile()
  const { data: today } = useToday()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const here = locate(pathname)
  const groups = useMemo(() => NAV_GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => allows(access, routePermissions(t.href.split('?')[0]))) }))
    .filter((g) => g.tabs.length > 0), [access])
  const main = groups.filter((g) => g.id !== 'legacy')
  const legacy = groups.find((g) => g.id === 'legacy')
  const work = openWork(today)

  // Session expired anywhere: back to sign-in once, with the page to return to.
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args)
      if (response.status === 401 && !window.location.pathname.startsWith('/login')) {
        window.location.assign(`/login?expired=1&next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      }
      return response
    }
    return () => { window.fetch = originalFetch }
  }, [])

  // The browser tab shows open work, so it is visible from any other tab.
  // Next writes the layout's title again on every navigation (search params included), so watch <head> and put ours back.
  const titleRef = useRef('A-REIT 后台')
  titleRef.current = work ? `(${work}) A-REIT 后台` : 'A-REIT 后台'
  useEffect(() => {
    const apply = () => { if (document.title !== titleRef.current) document.title = titleRef.current }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])
  useEffect(() => { document.title = titleRef.current }, [work])

  // New withdrawals, KYC and the like pop a browser notification while this tab is in the background.
  // Permission is asked once, on the first click anywhere (browsers only allow asking from a click).
  const lastToday = useRef<Today | null>(null)
  useEffect(() => {
    const prev = lastToday.current
    lastToday.current = today
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return
    for (const n of newArrivals(prev, today)) {
      const note = new Notification(`${n.label} +${n.added}`, { body: '点这里去处理', tag: `ops-${n.key}` })
      note.onclick = () => { window.focus(); window.location.assign(n.href); note.close() }
    }
  }, [today])
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
    const ask = () => { void Notification.requestPermission() }
    window.addEventListener('pointerdown', ask, { once: true })
    return () => window.removeEventListener('pointerdown', ask)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((v) => !v) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ops-root min-h-screen font-ops antialiased">
      <div className="mx-auto max-w-[1480px] px-4 pb-28 sm:px-6 lg:px-8 lg:pb-12">
        <header className="flex h-[76px] items-center gap-3">
          <Link href="/today" className="mr-2 shrink-0 text-[19px] font-medium tracking-[-0.02em] text-ops-text" aria-label="A-REIT 后台首页">
            A-REIT
          </Link>

          <nav aria-label="主导航" className="ops-scroll hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto lg:flex">
            {main.map((g) => g.id === here.group.id ? (
              <div key={g.id} className="flex shrink-0 items-center gap-1 rounded-full bg-ops-paper p-1 text-ops-ink">
                <span title={g.label} className="flex h-9 w-9 items-center justify-center rounded-full border border-ops-rule"><g.icon className="h-4 w-4" /></span>
                {g.tabs.map((t) => {
                  const active = here.tab?.href === t.href
                  const count = tabCount(t, today)
                  return (
                    <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={cn('flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] transition-colors', active ? 'bg-ops-lime font-medium' : 'text-[#3B414C] hover:bg-[#F0F1F4]')}>
                      {t.label}
                      {count > 0 && <span className={cn('flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px]', active ? 'bg-ops-ink text-ops-lime' : 'bg-ops-ink text-ops-text')}>{count}</span>}
                    </Link>
                  )
                })}
              </div>
            ) : (
              <CircleButton key={g.id} href={g.tabs[0].href} label={g.label} badge={groupCount(g, today) || undefined} badgeTone="count"><g.icon className="h-4 w-4" /></CircleButton>
            ))}
            {legacy && (here.group.id === 'legacy'
              ? <div className="flex shrink-0 items-center gap-1 rounded-full bg-ops-paper p-1 text-ops-ink">
                  <span title="旧产品" className="flex h-9 w-9 items-center justify-center rounded-full border border-ops-rule"><legacy.icon className="h-4 w-4" /></span>
                  {legacy.tabs.map((t) => <Link key={t.href} href={t.href} className={cn('flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-[13px]', here.tab?.href === t.href ? 'bg-ops-lime font-medium' : 'text-[#3B414C] hover:bg-[#F0F1F4]')}>{t.label}</Link>)}
                </div>
              : <CircleButton href={legacy.tabs[0].href} label="旧产品（RWA，已下架）"><MoreHorizontal className="h-4 w-4" /></CircleButton>)}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <CircleButton label="搜索（Ctrl K）" onClick={() => setPaletteOpen(true)}><Search className="h-4 w-4" /></CircleButton>
            <CircleButton href="/today" label={work ? `${work} 件待办` : '没有待办'} badge={work || undefined}><Bell className="h-4 w-4" /></CircleButton>
            <AccountChip email={access.profile?.email ?? ''} id={access.profile?.id ?? ''} />
          </div>
        </header>

        {/* Phones: the current area's tabs scroll sideways under the bar. */}
        <div className="ops-scroll -mx-4 mb-1 flex gap-1.5 overflow-x-auto px-4 lg:hidden">
          {(groups.find((g) => g.id === here.group.id)?.tabs ?? []).map((t) => (
            <Link key={t.href} href={t.href} className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px]', here.tab?.href === t.href ? 'bg-ops-lime text-ops-ink' : 'bg-ops-card text-ops-text')}>
              {t.label}{tabCount(t, today) > 0 && <span className="text-[11px] opacity-70">{tabCount(t, today)}</span>}
            </Link>
          ))}
        </div>

        <main>
          <RbacGate anyOf={routePermissions(pathname)}>{children}</RbacGate>
        </main>
      </div>

      <MobileDock groups={main} legacy={legacy} current={here.group.id} today={today} />
      {paletteOpen && <CommandPalette groups={groups} onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}

function AccountChip({ email, id }: { email: string; id: string }) {
  const [open, setOpen] = useState(false)
  const name = email ? email.split('@')[0] : '管理员'
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-10 items-center gap-2 rounded-full border border-ops-line py-1 pl-1 pr-1 transition-colors hover:bg-ops-raised sm:pr-3" aria-haspopup="menu" aria-expanded={open}>
        <Face id={id || email} size={32} />
        <span className="hidden max-w-[120px] truncate text-[13px] text-ops-text sm:inline">{name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-40 w-56 rounded-[18px] border border-ops-line bg-ops-raised p-2 shadow-2xl">
          <div className="px-3 py-2 text-[12px] text-ops-muted">{email || '—'}</div>
          <Link role="menuitem" href="/settings" className="block rounded-xl px-3 py-2 text-[13px] text-ops-text hover:bg-ops-card">我的账户与安全</Link>
          <form action="/api/auth/logout" method="post">
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-ops-down hover:bg-ops-card"><LogOut className="h-4 w-4" />退出登录</button>
          </form>
        </div>
      )}
    </div>
  )
}

function MobileDock({ groups, legacy, current, today }: { groups: NavGroup[]; legacy?: NavGroup; current: string; today: Today | null }) {
  const [more, setMore] = useState(false)
  const first = groups.filter((g) => ['today', 'funds', 'quant', 'care'].includes(g.id))
  const rest = [...groups.filter((g) => !first.includes(g)), ...(legacy ? [legacy] : [])]
  return (
    <>
      <nav aria-label="主导航" className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-full border border-ops-line bg-ops-card/95 p-1.5 backdrop-blur lg:hidden" style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}>
        {first.map((g) => (
          <Link key={g.id} href={g.tabs[0].href} className={cn('relative flex h-12 flex-1 flex-col items-center justify-center rounded-full text-[11px]', current === g.id ? 'bg-ops-lime text-ops-ink' : 'text-ops-muted')}>
            <g.icon className="h-[18px] w-[18px]" />{g.label.slice(0, 2)}
            {groupCount(g, today) > 0 && current !== g.id && <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-ops-down" />}
          </Link>
        ))}
        <button type="button" onClick={() => setMore(true)} className={cn('flex h-12 flex-1 flex-col items-center justify-center rounded-full text-[11px]', rest.some((g) => g.id === current) ? 'bg-ops-lime text-ops-ink' : 'text-ops-muted')}>
          <MoreHorizontal className="h-[18px] w-[18px]" />更多
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 lg:hidden" onClick={() => setMore(false)}>
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-[28px] bg-ops-card p-5 pb-10" onClick={(e) => e.stopPropagation()}>
            {rest.map((g) => (
              <div key={g.id} className="mb-5">
                <div className="mb-2 text-[12px] text-ops-muted">{g.label}</div>
                <div className="flex flex-wrap gap-2">{g.tabs.map((t) => <Link key={t.href} href={t.href} onClick={() => setMore(false)} className="rounded-full bg-ops-raised px-4 py-2 text-[13px] text-ops-text">{t.label}</Link>)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

type Entry = { label: string; hint: string; href: string }
const ID_HINT = /^[0-9a-f]{8}-[0-9a-f]{4}-/i

/** Ctrl/⌘ K: jump to any page, or open a user by email / id and a withdrawal by id or address. */
function CommandPalette({ groups, onClose }: { groups: NavGroup[]; onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  const pages: Entry[] = useMemo(() => groups.flatMap((g) => g.tabs.map((t) => ({ label: t.label, hint: g.label, href: t.href }))), [groups])
  const term = q.trim()
  const entries: Entry[] = useMemo(() => {
    const found = pages.filter((p) => !term || p.label.toLowerCase().includes(term.toLowerCase()) || p.hint.includes(term))
    const lookups: Entry[] = []
    if (term.includes('@') || ID_HINT.test(term)) lookups.push({ label: `打开用户 ${term}`, hint: '用户', href: `/users?q=${encodeURIComponent(term)}` })
    if (/^(wd-|T[1-9A-HJ-NP-Za-km-z]{20,}|0x[0-9a-fA-F]{10,})/.test(term)) lookups.push({ label: `查找提现 ${term}`, hint: '资金', href: `/funds/withdrawals?view=all&q=${encodeURIComponent(term)}` })
    return [...lookups, ...found].slice(0, 12)
  }, [pages, term])
  useEffect(() => setIndex(0), [term])
  const go = (e: Entry | undefined) => { if (!e) return; onClose(); router.push(e.href) }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-label="搜索" className="w-full max-w-[560px] overflow-hidden rounded-[24px] border border-ops-line bg-ops-raised font-ops shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-ops-line px-5">
          <Search className="h-4 w-4 text-ops-muted" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="页面、用户邮箱或 ID、提现编号、地址…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, entries.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
              if (e.key === 'Enter') go(entries[index])
            }}
            className="h-14 flex-1 bg-transparent text-[15px] text-ops-text outline-none placeholder:text-ops-muted" />
          <kbd className="rounded-md border border-ops-line px-1.5 text-[11px] text-ops-muted">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {entries.map((e, i) => (
            <li key={e.href + e.label}>
              <button type="button" onMouseEnter={() => setIndex(i)} onClick={() => go(e)} className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[14px]', i === index ? 'bg-ops-lime text-ops-ink' : 'text-ops-text')}>
                <span>{e.label}</span><span className={cn('text-[12px]', i === index ? 'text-ops-ink/70' : 'text-ops-muted')}>{e.hint}</span>
              </button>
            </li>
          ))}
          {!entries.length && <li className="px-3 py-6 text-center text-[13px] text-ops-muted">没有找到「{term}」</li>}
        </ul>
      </div>
    </div>
  )
}
