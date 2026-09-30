'use client'

import { ChevronRight, FileSignature, FileText, ScrollText } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import type { ApiError } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { listOrders } from '@/lib/api/portfolio'
import type { Order } from '@/lib/api/markets'
import { documentsCopy, type DocumentsCopy } from '@/lib/maison-documents-copy'
import { fill } from '@/lib/maison-market-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer, StatStrip } from './motion'
import { fmtAtomic, fmtDate } from './format'
import styles from './documents.module.css'
import { FormalDocumentsPanel } from './FormalDocumentsPanel'

// Orders settle in the platform unit (USDT, 6 decimals).
const DECIMALS = 6

type Filter = 'all' | 'open' | 'completed' | 'failed-or-cancelled'
const FILTERS: Filter[] = ['all', 'open', 'completed', 'failed-or-cancelled']
type Tone = 'live' | 'warn' | 'down' | 'accent' | undefined

/**
 * States the platform emits (orders.service.ts OrderState + the cancelled terminal).
 * Anything outside this set is an unknown state and is shown raw — never relabelled.
 */
const KNOWN_STATES = new Set(['submitted', 'processing', 'partially_filled', 'filled', 'failed', 'cancelled'])

const bucketOf = (state: string): Exclude<Filter, 'all'> =>
  state === 'filled' ? 'completed' : state === 'failed' || state === 'cancelled' ? 'failed-or-cancelled' : 'open'

/** Known states read as localised labels; unknown states keep the raw value so nothing is invented. */
function stateBadge(c: DocumentsCopy, state: string): { label: string; tone: Tone; raw: boolean } {
  if (state === 'filled') return { label: c.orders.states.filled, tone: 'live', raw: false }
  if (state === 'failed') return { label: c.orders.states.failed, tone: 'down', raw: false }
  if (state === 'cancelled') return { label: c.orders.states.cancelled, tone: 'down', raw: false }
  if (KNOWN_STATES.has(state)) return { label: c.orders.states.inProgress, tone: 'accent', raw: false }
  return { label: state, tone: undefined, raw: true }
}

const shortId = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`

/** Requested total in USDT atomic units. BigInt only — display goes through fmtAtomic. */
const sumRequested = (rows: Order[]) =>
  rows.reduce((total, row) => (/^\d+$/.test(row.requestedAtomicAmount) ? total + BigInt(row.requestedAtomicAmount) : total), BigInt(0)).toString()

const RELATED = [
  { key: 'ledger', path: '/assets/statements', Icon: ScrollText },
  { key: 'disclosures', path: '/trust/product-disclosures', Icon: FileText },
  { key: 'legal', path: '/trust/legal', Icon: FileSignature },
] as const satisfies ReadonlyArray<{ key: keyof DocumentsCopy['related']['items']; path: string; Icon: typeof FileText }>

function ErrorBlock({ error, retry, c }: { error: ApiError; retry: () => void; c: DocumentsCopy }) {
  return <StateBlock tone="error" title={c.common.errorGeneric} body={<span className={s.mono}>{error.status || '—'} · {error.code}</span>} retry={retry} retryLabel={c.common.retry} />
}

function OrderRow({ order, c, locale }: { order: Order; c: DocumentsCopy; locale: string }) {
  const badge = stateBadge(c, order.state)
  return <button type="button" className={s.row} onClick={() => openPath(`/orders/${encodeURIComponent(order.id)}`)}>
    <span className={s.logo} aria-hidden="true"><ScrollText size={15} strokeWidth={1.7} /></span>
    <span className={s.rowMain}>
      <b className={s.clamp2} dir="auto">{order.productName}</b>
      <small className={s.clamp2}>{c.orders.rowLabel} · <bdi className={s.mono}>{shortId(order.id)}</bdi> · <bdi>{fmtDate(order.submittedAt, locale)}</bdi></small>
    </span>
    <span className={s.rowEnd}>
      <span className={s.rowFig}>
        <b className={s.num}>{fmtAtomic(order.requestedAtomicAmount, DECIMALS, 'USDT')}</b>
        <span className={styles.badgeSlot}>
          <span className={s.badge} data-tone={badge.tone}>{badge.raw ? <bdi className={s.mono}>{badge.label}</bdi> : badge.label}</span>
        </span>
      </span>
      <ChevronRight size={16} className={s.chev} />
    </span>
  </button>
}

/**
 * `/profile/documents` — the records vault: order records from the API on top,
 * issued formal PDFs retain their actual source records and template versions.
 */
export function DocumentsScreen() {
  const { locale } = useI18n()
  const c = documentsCopy[locale]
  const orders = useQuery('documents:orders', listOrders, { staleTime: 15_000 })
  const [filter, setFilter] = useState<Filter>('all')

  // The URL owns the filter: deep links and refresh restore it (read after mount so SSR stays stable).
  useEffect(() => {
    const value = queryParam(window.location.search, 'filter')
    if (value && (FILTERS as string[]).includes(value)) setFilter(value as Filter)
  }, [])

  const choose = (value: Filter) => {
    setFilter(value)
    const url = new URL(window.location.href)
    if (value === 'all') url.searchParams.delete('filter')
    else url.searchParams.set('filter', value)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }

  const all = useMemo(() => (orders.data ? [...orders.data].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) : []), [orders.data])
  const counts: Record<Filter, number> = {
    all: all.length,
    open: all.filter((row) => bucketOf(row.state) === 'open').length,
    completed: all.filter((row) => bucketOf(row.state) === 'completed').length,
    'failed-or-cancelled': all.filter((row) => bucketOf(row.state) === 'failed-or-cancelled').length,
  }
  // Failed and cancelled orders never moved money, so they stay out of the headline figure.
  const requested = sumRequested(all.filter((row) => bucketOf(row.state) !== 'failed-or-cancelled'))
  const shown = filter === 'all' ? all : all.filter((row) => bucketOf(row.state) === filter)
  const loaded = orders.data !== undefined
  const figure = (value: number | string) => (loaded ? value : orders.error ? '—' : '…')
  const topbar = <RwaTopbar screen="records" template="T-Child" l1="back" title={c.hero.kicker} onBack={() => backOr('/profile')} />

  return <MaisonPage page="documents" topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}>{c.hero.kicker}</p>
      <h1 className={s.display}>{c.hero.titleA} <em>{c.hero.titleB}</em></h1>
      <p className={s.lede}>{c.hero.lede}</p>
    </header>

    <Lacquer className={`${s.credential} ${styles.vault}`} aria-live="polite">
      <i className={s.guilloche} aria-hidden="true" />
      <div className={s.credTop}>
        <span className={s.kicker}>{c.vault.card}</span>
        <span className={s.credRing} style={{ ['--p' as string]: counts.all ? counts.completed / counts.all : 0 } as CSSProperties}
          role="img" aria-label={fill(c.vault.ring, { c: counts.completed, n: counts.all })}>
          <b className={s.num}>{loaded ? counts.completed : '·'}<small>/{counts.all}</small></b>
        </span>
      </div>
      <span className={s.credChip} aria-hidden="true"><i /><i /><i /></span>
      <div className={s.credMain}>
        <small>{c.vault.requested}</small>
        <b className={s.num}>{figure(fmtAtomic(requested, DECIMALS, 'USDT'))}</b>
      </div>
      <StatStrip fit items={[
        { label: c.vault.records, value: figure(counts.all) },
        { label: c.vault.open, value: figure(counts.open) },
        { label: c.vault.completed, value: figure(counts.completed), tone: counts.completed ? 'up' : undefined },
        { label: c.vault.closed, value: figure(counts['failed-or-cancelled']), tone: counts['failed-or-cancelled'] ? 'down' : undefined },
      ]} />
      <p className={s.credFoot}><span>{c.vault.note}</span></p>
    </Lacquer>

    <SectionHead index="01" title={c.orders.section} note={c.orders.sectionNote} />
    {orders.error && !orders.data ? <ErrorBlock error={orders.error} retry={orders.refetch} c={c} />
      : !orders.data ? <Skeleton rows={4} />
      : all.length === 0 ? <StateBlock tone="empty" title={c.orders.emptyTitle} body={c.orders.emptyBody}
          action={<button type="button" className={s.link} onClick={() => openPath('/markets')}>{c.orders.emptyCta}<ChevronRight size={13} /></button>} />
      : <>
        <div className={s.chips} role="group" aria-label={c.orders.status}>
          {FILTERS.map((value) => <button key={value} type="button" className={s.chip} aria-pressed={filter === value} onClick={() => choose(value)}>
            {c.orders.filters[value]}<small>{counts[value]}</small>
          </button>)}
        </div>
        {shown.length === 0 ? <StateBlock title={c.orders.emptyFilterTitle} body={c.orders.emptyFilterBody} />
          : <ul className={s.list}>{shown.map((order) => <li key={order.id}><OrderRow order={order} c={c} locale={locale} /></li>)}</ul>}
      </>}

    <SectionHead index="02" title={c.docs.section} note="PDF" />
    <FormalDocumentsPanel />

    <SectionHead index="03" title={c.related.section} note={c.related.sectionNote} />
    <ul className={s.list} style={{ borderTop: 0 }}>
      {RELATED.map(({ key, path, Icon }) => <li key={key}>
        <button type="button" className={s.row} onClick={() => openPath(path)}>
          <span className={s.logo} aria-hidden="true"><Icon size={15} strokeWidth={1.7} /></span>
          <span className={s.rowMain}>
            <b>{c.related.items[key].title}</b>
            <small className={s.clamp2}>{c.related.items[key].body}</small>
            <span className={styles.caption}>{c.related.items[key].caption}</span>
          </span>
          <span className={s.rowEnd}><ChevronRight size={16} className={s.chev} /></span>
        </button>
      </li>)}
    </ul>
  </MaisonPage>
}
