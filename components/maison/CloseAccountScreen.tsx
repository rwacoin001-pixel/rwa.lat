'use client'

import { AlertTriangle, ArrowUpFromLine, Check, ChevronRight, CircleSlash, Coins, Headphones, Lock, RotateCw, ScrollText, ShieldX, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import type { ApiError } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { getWallet } from '@/lib/api/markets'
import { listPositions, type Position } from '@/lib/api/portfolio'
import { closeCopy } from '@/lib/maison-close-account-copy'
import { fill } from '@/lib/maison-market-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, maison as s } from './primitives'
import { Lacquer, StatStrip } from './motion'
import { fmtAtomic } from './format'
import styles from './close-account.module.css'

type ItemState = 'loading' | 'done' | 'todo' | 'failed'

/** Atomic string → BigInt, null when unusable. */
const atomic = (value: string | null | undefined): bigint | null => {
  if (value == null || !/^-?\d+$/.test(value)) return null
  try { return BigInt(value) } catch { return null }
}

/** A positions row counts as open unless its quantity is exactly zero. */
const isOpenPosition = (position: Position) => atomic(position.quantityAtomicAmount) !== BigInt(0)

function Hero({ kicker, a, b, lede }: { kicker: string; a: string; b: string; lede: string }) {
  return <header className={s.hero}>
    <p className={s.kicker}>{kicker}</p>
    <h1 className={s.display}>{a} <em>{b}</em></h1>
    <p className={s.lede}>{lede}</p>
  </header>
}

/**
 * `/profile/close-account` — account closure is NOT available in the app (there is no
 * user-facing closure endpoint), so this page never claims to send or record anything.
 * It shows the read-only facts to settle first (balance, open positions), explains what
 * closing would mean, and hands off to support. The final action stays disabled.
 */
export function CloseAccountScreen() {
  const { locale } = useI18n()
  const c = closeCopy[locale]
  const t = c.page
  const wallet = useQuery('wallet:summary:close', getWallet, { staleTime: 20_000 })
  const positions = useQuery('portfolio:positions', listPositions, { staleTime: 20_000 })

  const walletFailed = Boolean(wallet.error && wallet.data === undefined)
  const positionsFailed = Boolean(positions.error && positions.data === undefined)
  const available = wallet.data ? atomic(wallet.data.balances.availableAtomic) : null
  // Locked and pending funds (e.g. a withdrawal in flight) still have to settle, so "done" needs all three at zero.
  const held = wallet.data ? [wallet.data.balances.lockedAtomic, wallet.data.balances.pendingAtomic].map(atomic) : null
  const heldTotal = held && held.every((value) => value !== null) ? held.reduce<bigint>((sum, value) => sum + (value as bigint), BigInt(0)) : null
  const zeroBalance = available === BigInt(0) && heldTotal === BigInt(0)
  const openCount = positions.data ? positions.data.filter(isOpenPosition).length : 0

  const balanceState: ItemState = wallet.data === undefined ? (walletFailed ? 'failed' : 'loading') : zeroBalance ? 'done' : 'todo'
  const positionsState: ItemState = positions.data === undefined ? (positionsFailed ? 'failed' : 'loading') : openCount === 0 ? 'done' : 'todo'

  const amount = wallet.data ? fmtAtomic(wallet.data.balances.availableAtomic, wallet.data.asset.decimals, wallet.data.asset.code) : c.common.none
  const balanceFigure = balanceState === 'loading' ? t.state.loading : balanceState === 'failed' ? c.common.none : balanceState === 'done' ? t.balanceEmpty
    : available === BigInt(0) && wallet.data ? fill(t.balanceHeld, { amount: heldTotal === null ? c.common.none : fmtAtomic(heldTotal.toString(), wallet.data.asset.decimals, wallet.data.asset.code) })
    : fill(t.balanceMeta, { amount })
  const positionsFigure = positionsState === 'loading' ? t.state.loading : positionsState === 'failed' ? c.common.none : positionsState === 'done' ? t.positionsEmpty : fill(t.positionsMeta, { n: openCount })
  const stripTone = (state: ItemState) => state === 'done' ? 'up' as const : state === 'failed' ? 'down' as const : undefined

  const rows: {
    key: 'balance' | 'positions'; Icon: typeof Check; path: string; state: ItemState
    figure: string; error?: ApiError; retry: () => void
  }[] = [
    {
      key: 'balance', Icon: ArrowUpFromLine, path: '/assets/cash/withdraw', state: balanceState, figure: balanceFigure,
      error: walletFailed ? wallet.error : undefined, retry: wallet.refetch,
    },
    {
      key: 'positions', Icon: Coins, path: '/assets', state: positionsState, figure: positionsFigure,
      error: positionsFailed ? positions.error : undefined, retry: positions.refetch,
    },
  ]

  return <MaisonPage page="close-account" cta topbar={<RwaTopbar screen="close-account" template="T-Child" l1="back" title={t.kicker} onBack={() => backOr('/profile')} />}>
    <Hero kicker={t.kicker} a={t.titleA} b={t.titleB} lede={t.lede} />

    {/* The one honest status: nothing here closes an account. */}
    <Lacquer aria-live="polite">
      <i className={s.guilloche} aria-hidden="true" />
      <div className={s.sealHead}>
        <span className={s.statusMark} data-tone="warn"><CircleSlash size={24} strokeWidth={1.5} /></span>
        <div>
          <span className={s.kicker}>{t.kicker}</span>
          <b className={s.sealTitle}>{t.statusTitle}</b>
          <p className={s.plateLine}>{t.statusBody}</p>
        </div>
      </div>
      <StatStrip fit items={[
        { label: t.labelBalance, value: <bdi>{balanceState === 'loading' ? t.state.loading : amount}</bdi>, tone: stripTone(balanceState) },
        { label: t.labelPositions, value: <bdi>{positionsState === 'loading' ? t.state.loading : positionsState === 'failed' ? c.common.none : String(openCount)}</bdi>, tone: stripTone(positionsState) },
      ]} />
    </Lacquer>

    <SectionHead index="01" title={t.before} note={t.beforeNote} />
    <ol className={s.stepList}>
      {rows.map(({ key, Icon, path, state, figure, error, retry }, index) => <li key={key}>
        <button type="button" className={s.stepCard} data-done={state === 'done'} onClick={() => openPath(path)}>
          <span className={s.stepNum} aria-hidden="true">{state === 'done' ? <Check size={14} strokeWidth={2.4} /> : String(index + 1).padStart(2, '0')}</span>
          <span className={s.stepMain}>
            <b><Icon size={14} strokeWidth={1.8} aria-hidden="true" />{t.items[key].title}</b>
            <small>{t.items[key].body}</small>
            <span className={s.stepMeta}>{state === 'todo' || state === 'failed' ? <bdi>{figure}</bdi> : figure}</span>
          </span>
          <span className={s.stepEnd}>
            <span className={s.badge} data-tone={state === 'done' ? 'live' : state === 'todo' ? 'warn' : state === 'failed' ? 'down' : undefined}>{t.state[state]}</span>
            <ChevronRight size={16} className={`${s.chev} ${s.flipRtl}`} />
          </span>
        </button>
        {error && <div className={`${s.notice} ${styles.itemError}`} data-tone="error" role="alert">
          <AlertTriangle size={14} />
          <span>{t.state.failed} <span className={s.mono}>{error.status || '—'} · {error.code}</span></span>
          <button type="button" className={`${s.link} ${styles.itemRetry}`} onClick={retry} aria-label={c.common.retry}>
            <RotateCw size={12} />{c.common.retry}
          </button>
        </div>}
      </li>)}
    </ol>

    <SectionHead index="02" title={t.means} note={t.meansNote} />
    <ul className={s.list} style={{ borderTop: 0 }}>
      {t.meansItems.map((item, index) => { const Icon = [UserRound, ScrollText, ShieldX][index]; return <li key={item.title}>
        <div className={s.row} data-static="true">
          <span className={s.logo}><Icon size={16} strokeWidth={1.7} /></span>
          <span className={s.rowMain}><b className={s.clamp2}>{item.title}</b><small className={styles.full}>{item.body}</small></span>
        </div>
      </li> })}
    </ul>

    <SectionHead index="03" title={t.way} note={t.wayNote} />
    <div className={styles.wayCard}>
      <div className={styles.wayHead}>
        <span className={styles.wayIcon}><Headphones size={17} strokeWidth={1.8} aria-hidden="true" /></span>
        <p className={styles.wayText}>{t.supportHint}</p>
      </div>
      <button type="button" className={s.cta} onClick={() => openPath('/profile/support/new')}>
        <span>{t.supportCta}</span>
        <span className={s.ctaIcon}><ChevronRight size={17} /></span>
      </button>
    </div>

    {/* The final action is rendered disabled: closure cannot be started from the app. */}
    <div className={s.stickyCta}>
      <p><CircleSlash size={12} style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} aria-hidden="true" />{t.finalNote}</p>
      <div className={styles.finalRow}>
        <button type="button" className={`${s.cta} ${styles.finalBtn}`} disabled>
          <span>{t.finalCta}</span>
          <span className={s.ctaIcon}><Lock size={17} /></span>
        </button>
        <span className={styles.finalReason}>{t.disabledReason}</span>
      </div>
    </div>
  </MaisonPage>
}
