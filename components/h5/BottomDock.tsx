'use client'
import { openAi } from '@/lib/ai-overlay'
import type { RwaScreen } from '@/lib/rwa-routes'
import { markTabNavigation } from '@/lib/app-navigation'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, ChartNoAxesColumnIncreasing, ChartPie, ChevronRight, House, MessagesSquare, Plus, QrCode, type LucideIcon } from 'lucide-react'
import { expandChrome, useScrollChrome } from '@/hooks/useScrollChrome'
import { openPath } from '@/lib/maison-nav'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { useI18n } from '@/lib/i18n'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
import type { PrimaryScreen } from './shared'
import { BuddyOrb } from '@/components/buddy/BuddyOrb'
import d from './dock-v2.module.css'

type Screen = RwaScreen

export function BottomDock({ screen, setScreen, activeScreen, showQuickActions = false }: { screen: Screen; setScreen: (screen: Screen) => void; activeScreen?: PrimaryScreen; showQuickActions?: boolean }) {
  const { locale, t } = useI18n()
  const shellCopy = rwaH5Copy[locale].shell
  const isCompact = useScrollChrome()
  const [quickOpen, setQuickOpen] = useState(false)
  const dockRef = useRef<HTMLElement>(null)
  const quickActions: Array<{ label: string; path: string; icon: LucideIcon }> = [
    { label: t('wallet.deposit'), path: '/assets/cash/deposit', icon: ArrowDownToLine },
    { label: t('wallet.withdraw'), path: '/assets/cash/withdraw', icon: ArrowUpFromLine },
    { label: t('wallet.transfer'), path: '/assets/cash/transfer', icon: ArrowRightLeft },
    { label: fundsCopy[locale].receive.action, path: '/assets/cash/receive', icon: QrCode },
  ]
  // Four tabs (2026-10-28): Koala Quant lives on Markets (its first tab); Community holds the feed and the invite centre.
  const items: Array<{ id: PrimaryScreen; label: string; icon: typeof House }> = [
    { id: 'home', label: t('nav.home'), icon: House },
    { id: 'invest', label: t('nav.markets'), icon: ChartNoAxesColumnIncreasing },
    { id: 'community', label: t('nav.community'), icon: MessagesSquare },
    { id: 'portfolio', label: t('nav.assets'), icon: ChartPie },
  ]
  useEffect(() => { expandChrome() }, [screen])
  useEffect(() => { setQuickOpen(false) }, [screen])
  useEffect(() => {
    if (!quickOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !dockRef.current?.contains(event.target)) setQuickOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setQuickOpen(false) }
    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutside); window.removeEventListener('keydown', closeOnEscape) }
  }, [quickOpen])
  useEffect(() => { if (isCompact) setQuickOpen(false) }, [isCompact])
  const active = items.find((item) => item.id === (activeScreen ?? screen)) ?? items[0]
  const ActiveIcon = active.icon
  // Same rule on every tab (iOS tab bar): minimise on scroll down, restore on scroll up; tapping the current tab returns to top.
  const select = (id: PrimaryScreen) => {
    if (id === screen) { window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return }
    navigator.vibrate?.(6)
    markTabNavigation()
    setScreen(id)
  }
  return (
    <nav ref={dockRef} className={`liquid-dock ios-dock ${isCompact ? 'is-compact' : ''}`} aria-label={shellCopy.primaryNavigation}>
      <div className={d.plate} data-compact={isCompact || undefined}>
        <div className={d.groove} style={{ '--n': items.length, '--i': Math.max(0, items.findIndex(item => item.id === screen)) } as CSSProperties} aria-hidden={isCompact}>
          <span className={d.cap} aria-hidden="true" />
          {items.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-label={label} tabIndex={isCompact ? -1 : 0} className={d.tab} aria-current={screen === id ? 'page' : undefined} onClick={() => select(id)}>
              <Icon size={20} strokeWidth={screen === id ? 2 : 1.8} aria-hidden="true" />
              <span className={d.label} aria-hidden="true">{label}</span>
            </button>
          ))}
        </div>
        <button type="button" className={d.cur} aria-hidden={!isCompact} tabIndex={isCompact ? 0 : -1} aria-label={active.label} onClick={expandChrome}><ActiveIcon size={20} strokeWidth={2} /></button>
      </div>
      {/* Palette A: the asset page carries its own money actions under the total, so no extra "+" there. */}
      {showQuickActions && screen !== 'portfolio' && <>
        <div id="dock-quick-menu" className="liquid-dock__quick-menu" data-open={quickOpen ? 'true' : 'false'} role="group" aria-label={quickActions.map((action) => action.label).join(', ')} aria-hidden={!quickOpen}>
          {quickActions.map(({ label, path, icon: Icon }) => <button key={path} type="button" tabIndex={quickOpen ? 0 : -1} onClick={() => { setQuickOpen(false); openPath(path) }}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span><ChevronRight size={14} aria-hidden="true" />
          </button>)}
        </div>
        <button type="button" className="liquid-dock__quick-trigger" aria-label={quickActions.map((action) => action.label).join(', ')} aria-controls="dock-quick-menu" aria-expanded={quickOpen} onClick={() => setQuickOpen((value) => !value)}>
          <Plus size={17} strokeWidth={1.9} />
        </button>
      </>}
      {/* The paper buddy: AI, notifications, how things stand. */}
      <BuddyOrb label={t('nav.ai')} active={screen === 'ai'} onOpenAi={() => openAi()} />
    </nav>
  )
}
