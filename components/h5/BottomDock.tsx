'use client'
import type { RwaScreen } from '@/lib/rwa-routes'
import { markTabNavigation } from '@/lib/app-navigation'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, ChartCandlestick, ChartNoAxesColumnIncreasing, ChartPie, ChevronRight, House, Plus, QrCode, type LucideIcon } from 'lucide-react'
import { expandChrome, useScrollChrome } from '@/hooks/useScrollChrome'
import { openPath } from '@/lib/maison-nav'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { useI18n } from '@/lib/i18n'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
const AiPearl = dynamic(() => import('../maison/AiPearl'), { ssr: false })
import type { PrimaryScreen } from './shared'
import { useQuantListed } from '@/lib/api/quant'
import { usePaletteA } from '@/lib/palette-preview'
import { BuddyOrb } from '@/components/buddy/BuddyOrb'

type Screen = RwaScreen

export function BottomDock({ screen, setScreen, activeScreen, showQuickActions = false }: { screen: Screen; setScreen: (screen: Screen) => void; activeScreen?: PrimaryScreen; showQuickActions?: boolean }) {
  const { locale, t } = useI18n()
  const shellCopy = rwaH5Copy[locale].shell
  const isCompact = useScrollChrome()
  const paletteA = usePaletteA()
  const [quickOpen, setQuickOpen] = useState(false)
  const dockRef = useRef<HTMLElement>(null)
  const quickActions: Array<{ label: string; path: string; icon: LucideIcon }> = [
    { label: t('wallet.deposit'), path: '/assets/cash/deposit', icon: ArrowDownToLine },
    { label: t('wallet.withdraw'), path: '/assets/cash/withdraw', icon: ArrowUpFromLine },
    { label: t('wallet.transfer'), path: '/assets/cash/transfer', icon: ArrowRightLeft },
    { label: fundsCopy[locale].receive.action, path: '/assets/cash/receive', icon: QrCode },
  ]
  // Koala Quant is the featured product: its own tab, shown once an operator has opened it.
  const quantListed = useQuantListed()
  const items: Array<{ id: PrimaryScreen; label: string; icon: typeof House }> = [
    { id: 'home', label: t('nav.home'), icon: House },
    { id: 'invest', label: t('nav.markets'), icon: ChartNoAxesColumnIncreasing },
    ...(quantListed || screen === 'quant' ? [{ id: 'quant' as const, label: t('nav.quant'), icon: ChartCandlestick }] : []),
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
      <div className="liquid-dock__pill" aria-hidden={isCompact}>
        <span className="liquid-dock__shine" />
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-label={label} tabIndex={isCompact ? -1 : 0} className={`dock-link ${screen === id ? 'is-active' : ''}`} aria-current={screen === id ? 'page' : undefined} onClick={() => select(id)}>
            <span className="dock-link__icon"><Icon size={21} strokeWidth={screen === id ? 2 : 1.7} /></span>
            <span className="dock-link__label" aria-hidden="true"><span>{label}</span></span>
          </button>
        ))}
      </div>
      <button type="button" className="liquid-dock__compact-button" aria-hidden={!isCompact} tabIndex={isCompact ? 0 : -1} aria-label={active.label} aria-expanded={false} onClick={expandChrome}><ActiveIcon size={19} strokeWidth={1.8} /></button>
      {showQuickActions && <>
        <div id="dock-quick-menu" className="liquid-dock__quick-menu" data-open={quickOpen ? 'true' : 'false'} role="group" aria-label={quickActions.map((action) => action.label).join(', ')} aria-hidden={!quickOpen}>
          {quickActions.map(({ label, path, icon: Icon }) => <button key={path} type="button" tabIndex={quickOpen ? 0 : -1} onClick={() => { setQuickOpen(false); openPath(path) }}>
            <Icon size={17} strokeWidth={1.8} /><span>{label}</span><ChevronRight size={14} aria-hidden="true" />
          </button>)}
        </div>
        <button type="button" className="liquid-dock__quick-trigger" aria-label={quickActions.map((action) => action.label).join(', ')} aria-controls="dock-quick-menu" aria-expanded={quickOpen} onClick={() => setQuickOpen((value) => !value)}>
          <Plus size={17} strokeWidth={1.9} />
        </button>
      </>}
      {/* Palette A: the paper buddy (AI, notifications, how things stand); otherwise the lacquer pearl. */}
      {paletteA
        ? <BuddyOrb label={t('nav.ai')} active={screen === 'ai'} onOpenAi={() => { if (screen !== 'ai') { markTabNavigation(); setScreen('ai') } }} />
        : <button type="button" className={`ai-orb ${screen === 'ai' ? 'is-active' : ''}`} aria-label={t('nav.ai')} title={t('nav.ai')} onClick={() => { if (screen !== 'ai') markTabNavigation(); setScreen('ai') }}>
          <AiPearl size={46} inset={.48} state="idle" className="ai-orb__orb" />
        </button>}
    </nav>
  )
}
