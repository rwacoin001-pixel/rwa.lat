'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRightLeft, ArrowUp, ArrowUpFromLine, ChevronRight, Eye, EyeOff, QrCode } from 'lucide-react'
import type { HomeState } from '@/lib/home-lifecycle'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { fromAtomic } from '@/lib/money'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { HomeEmailBinding } from './HomeEmailBinding'
import type { HomePortfolioSnapshot } from './HomePortfolioCard'
import styles from './home-v2.module.css'

type Copy = { total: string; detail: string; available: string; today: string; pending: string; pendingEta: string; startTitle: string; startBody: string; deposit: string; show: string; hide: string }
const COPY: Partial<Record<AppLocale, Copy>> & { en: Copy } = {
  en: { total: 'Total assets', detail: 'Details', available: 'Available {v}', today: 'Today {v}', pending: 'Deposit confirming · {v} USDT', pendingEta: 'A few minutes', startTitle: 'Deposit USDT to make your first investment', startBody: 'TRC20 network · invest in real estate, gold and Koala Quant once it arrives', deposit: 'Deposit', show: 'Show balance', hide: 'Hide balance' },
  'zh-CN': { total: '总资产', detail: '明细', available: '可用 {v}', today: '今日 {v}', pending: '充值确认中 · {v} USDT', pendingEta: '约几分钟', startTitle: '充值 USDT，开始第一笔投资', startBody: '支持 TRC20 网络 · 到账后即可申购房地产、黄金和考拉量化', deposit: '去充值', show: '显示余额', hide: '隐藏余额' },
}
export const homeV2Copy = (locale: AppLocale) => COPY[locale] ?? COPY.en

export type TodayChange = { changeAtomic: string; changePct: string } | null

const money = (atomic: string | null, decimals: number, locale: AppLocale) => {
  if (atomic === null || !/^-?\d+$/.test(atomic)) return null
  try { return Number(fromAtomic(atomic.replace('-', ''), decimals)) * (atomic.startsWith('-') ? -1 : 1) } catch { return null }
}
const fmt = (value: number, locale: AppLocale) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
const signed = (value: number, locale: AppLocale) => (value > 0 ? '+' : value < 0 ? '−' : '') + fmt(Math.abs(value), locale)

/** The hero number counts up once per app launch (600 ms, ease-out), only once real data is in; reduced motion skips it. */
function useCountOnce(target: number | null) {
  const [shown, setShown] = useState<number | null>(target)
  const done = useRef(false)
  useEffect(() => {
    if (target === null) { setShown(null); return }
    let seen = false
    try { seen = sessionStorage.getItem('rwa.home.counted') === '1' } catch { /* count anyway */ }
    if (done.current || seen || matchMedia('(prefers-reduced-motion: reduce)').matches || target === 0) { setShown(target); done.current = true; return }
    done.current = true
    try { sessionStorage.setItem('rwa.home.counted', '1') } catch { /* fine */ }
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 600)
      setShown(target * (1 - (1 - p) ** 3))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return shown
}

type Props = {
  state: HomeState
  account: HomePortfolioSnapshot | null
  loading: boolean
  pendingUnits: number
  today: TodayChange
  ctaLabel: string | null
  onPrimary: () => void
  onPortfolio: () => void
  onCashAction: (path: string) => void
  emailBinding?: { userId: string; onVerified: () => void }
}

/** Signed-in asset card: one hero number, today's change (or what is available), the four money actions as porcelain tiles. */
export function HomeAssetCard({ state, account, loading, pendingUnits, today, ctaLabel, onPrimary, onPortfolio, onCashAction, emailBinding }: Props) {
  const { locale, t } = useI18n()
  const c = homeV2Copy(locale)
  const [hidden, setHidden] = useState(false)
  useEffect(() => { try { setHidden(localStorage.getItem('rwa.home.hide-balance') === '1') } catch { /* shown */ } }, [])
  const toggle = () => setHidden(value => { try { localStorage.setItem('rwa.home.hide-balance', value ? '0' : '1') } catch { /* session only */ } return !value })
  const total = account ? money(account.totalAssetsAtomic, account.totalAssetsDecimals, locale) : null
  const available = account ? money(account.availableAtomic, account.availableDecimals, locale) : null
  const shown = useCountOnce(total)
  const actions = [
    { label: t('wallet.deposit'), path: '/assets/cash/deposit', Icon: ArrowDownToLine },
    { label: t('wallet.withdraw'), path: '/assets/cash/withdraw', Icon: ArrowUpFromLine },
    { label: t('wallet.transfer'), path: '/assets/cash/transfer', Icon: ArrowRightLeft },
    { label: fundsCopy[locale].receive.action, path: '/assets/cash/receive', Icon: QrCode },
  ]
  const tiles = <div className={styles.tiles} role="group" aria-label={actions.map(a => a.label).join(', ')}>
    {actions.map(({ label, path, Icon }) => <button key={path} type="button" className={styles.tile} onClick={() => { navigator.vibrate?.(6); onCashAction(path) }}>
      <span className={styles.tileFace}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>{label}
    </button>)}
  </div>

  if (loading && !account) return <section className={styles.card} aria-busy="true">
    <span className={styles.skel} style={{ width: 96, height: 16 }} />
    <span className={styles.skel} style={{ width: 200, height: 40, marginTop: 8 }} />
    <span className={styles.skel} style={{ width: 140, height: 16, marginTop: 8 }} />
    <div className={styles.tiles}>{[0, 1, 2, 3].map(i => <span key={i} className={styles.skel} style={{ width: 56, height: 56, borderRadius: '22%', justifySelf: 'center' }} />)}</div>
  </section>

  // A confirmed zero (nothing pending): an invitation, not a big 0.00.
  const empty = total === 0 && pendingUnits <= 0 && (state.lifecycle === 'unfunded' || state.lifecycle === 'kyc_incomplete' || state.lifecycle === 'email_unverified')
  if (empty) return <section className={`${styles.card} ${styles.start}`}>
    <h2>{c.startTitle}</h2>
    <p>{c.startBody}</p>
    {emailBinding ? <HomeEmailBinding key={emailBinding.userId} userId={emailBinding.userId} onVerified={emailBinding.onVerified} />
      : <button type="button" className={styles.cta} onClick={ctaLabel ? onPrimary : () => onCashAction('/assets/cash/deposit')}><span>{ctaLabel ?? c.deposit}</span><i aria-hidden="true">→</i></button>}
  </section>

  const change = today ? money(today.changeAtomic, 6, locale) : null
  const tone = change === null || change === 0 ? '' : change > 0 ? styles.up : styles.down
  const pct = today && Number.isFinite(Number(today.changePct)) ? Number(today.changePct) : null
  return <section className={styles.card}>
    <div className={styles.label}>
      <span>{c.total} · {account?.currency ?? 'USDT'}</span>
      <span className={styles.labelEnd}>
        <button type="button" onClick={toggle} aria-label={hidden ? c.show : c.hide} aria-pressed={hidden}>{hidden ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
        <button type="button" onClick={onPortfolio}>{c.detail}<ChevronRight size={14} aria-hidden="true" /></button>
      </span>
    </div>
    <div className={styles.hero} dir="ltr">
      {/* Screen readers get the final value; the count-up is visual only. */}
      <span aria-hidden="true">{hidden ? '••••••' : shown === null ? '—' : fmt(shown, locale)}</span>
      <span className="sr-only">{hidden ? '' : total === null ? '—' : fmt(total, locale)}</span>
    </div>
    <div className={`${styles.sub} ${hidden ? '' : tone}`} dir="ltr">
      {hidden ? '' : change !== null ? c.today.replace('{v}', `${signed(change, locale)}${pct === null ? '' : ` (${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}%)`}`) : available !== null ? c.available.replace('{v}', fmt(available, locale)) : ''}
    </div>
    {tiles}
    {pendingUnits > 0 && <div className={styles.pending} role="status"><span>{c.pending.replace('{v}', fmt(pendingUnits, locale))}</span><span>{c.pendingEta}</span></div>}
    {emailBinding && <HomeEmailBinding key={emailBinding.userId} userId={emailBinding.userId} onVerified={emailBinding.onVerified} />}
  </section>
}

/** Ask the AI: a well under the card; the prompt is left in the composer for the reader to send. */
export function HomeAskAi({ prompt, onOpen }: { prompt: string; onOpen: () => void }) {
  return <button type="button" className={styles.ask} onClick={() => { try { sessionStorage.setItem('rwa.ai.prefill', prompt) } catch { /* opens empty */ } onOpen() }}>
    <span>{prompt}</span><b aria-hidden="true"><ArrowUp size={16} strokeWidth={2} /></b>
  </button>
}
