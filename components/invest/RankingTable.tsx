'use client'

// Source: shadcn/ui Table + TradingView Screener layout conventions.
// Sortable ranking table for the invest page. All numbers come from /v1/rwa/assets.
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useQuery } from '@/lib/api/_query'
import { getAssetList } from '@/lib/api/foundation'
import { fmtUsd, fmtPct } from '@/lib/money'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Sparkline7d } from './Sparkline7d'

type Key = 'name' | 'priceUsd' | 'change24hPct' | 'marketCapUsd' | 'apy' | 'volume24hUsd'
type Row = {
  slug: string; name: string; symbol?: string | null; logoUrl?: string | null
  priceUsd?: string | null; change24hPct?: string | null; marketCapUsd?: string | null
  apy?: string | null; volume24hUsd?: string | null; score?: number | null
}
const num = (v: string | number | null | undefined) => (v == null || v === '' ? null : Number(v))

const parsePct = (v: string | null | undefined) => {
  const n = parseFloat((v ?? '').replace('%', ''))
  return Number.isFinite(n) ? n : null
}

export function RankingTable({ onOpen }: { onOpen: (slug: string) => void }) {
  const list = useQuery('rwa:assets:100', getAssetList, { staleTime: 60_000 })
  const [key, setKey] = useState<Key>('marketCapUsd')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const rows = useMemo(() => {
    const items = [...(list.data?.items ?? [])] as Row[]
    return items.sort((a, b) => {
      if (key === 'name') return dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      const raw = (r: Row) => (key === 'change24hPct' ? parsePct(r.change24hPct) : num(r[key]))
      const x = raw(a)
      const y = raw(b)
      if (x === null && y === null) return 0
      if (x === null) return 1
      if (y === null) return -1
      return dir === 'asc' ? x - y : y - x
    })
  }, [list.data, key, dir])
  const toggle = (k: Key) => {
    if (k === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setKey(k); setDir(k === 'name' ? 'asc' : 'desc') }
  }
  const Th = ({ k, children, align = 'right' }: { k: Key; children: ReactNode; align?: 'left' | 'right' }) => (
    <TableHead className="tv-th" data-align={align} data-active={k === key} aria-sort={k === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => toggle(k)}>
        {children}
        {k === key ? (dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
      </button>
    </TableHead>
  )
  if (list.loading && !rows.length) return <div className="tv-table-wrap tv-table-wrap--loading" aria-busy="true" />
  if (list.error && !rows.length) return <div className="tv-table-wrap tv-table-wrap--error">{list.error.message}</div>
  return (
    <div className="tv-table-wrap">
      <Table className="tv-table">
        <TableHeader>
          <TableRow>
            <Th k="name" align="left">Asset</Th>
            <Th k="priceUsd">Price</Th>
            <Th k="change24hPct">24h</Th>
            <Th k="marketCapUsd">Market cap</Th>
            <Th k="apy">APY</Th>
            <TableHead className="tv-th tv-th--plain" data-align="right">7D</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a, i) => {
            const chg = parsePct(a.change24hPct)
            return (
              <TableRow key={a.slug} className="tv-row" onClick={() => onOpen(a.slug)}>
                <TableCell className="tv-td tv-td--asset">
                  <span className="tv-rank">{i + 1}</span>
                  {a.logoUrl ? (
                    <img src={a.logoUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="tv-logo-fallback">{(a.symbol ?? a.name)[0]}</span>
                  )}
                  <span><b>{a.symbol ?? a.name}</b><small>{a.name}</small></span>
                </TableCell>
                <TableCell className="tv-td tv-num">{fmtUsd(a.priceUsd)}</TableCell>
                <TableCell className="tv-td tv-num" data-dir={chg === null ? undefined : chg >= 0 ? 'up' : 'down'}>{fmtPct(a.change24hPct, { signed: true })}</TableCell>
                <TableCell className="tv-td tv-num">{fmtUsd(a.marketCapUsd, { compact: true })}</TableCell>
                <TableCell className="tv-td tv-num">{a.apy ? `${Number(a.apy).toFixed(2)}%` : '—'}</TableCell>
                <TableCell className="tv-td">
                  <Sparkline7d slug={a.slug} tone={chg === null ? 'flat' : chg >= 0 ? 'up' : 'down'} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
