'use client'

/**
 * `/rank` — rankings (2026-11-04). Top tabs 星能榜 · 投资榜 · 团队榜 · 邀请榜 (a swipe pages between them), a week /
 * month switch, then the list: place, avatar, nickname, level and an amount range — never an exact amount, id or
 * email. My place stays pinned at the bottom; under the list one switch hides me from every board.
 */
import { useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { CommunityAvatar } from '@/components/community-avatar'
import { MaisonPage } from '@/components/maison/primitives'
import { TopTabs } from '@/components/maison/TopTabs'
import { useQuery, invalidate } from '@/lib/api/_query'
import { rankQuery, setRankHidden, type RankBoard, type RankPeriod } from '@/lib/api/membership'
import { bandLabel, membershipCopy } from '@/lib/membership-copy'
import { usePageState } from '@/lib/app-navigation'
import { usePageTabs } from '@/lib/page-swipe'
import { useI18n } from '@/lib/i18n'
import { backOr } from '@/lib/maison-nav'
import { GalaxyBadge } from './GalaxyBadge'
import s from './membership.module.css'

const BOARDS: readonly RankBoard[] = ['score', 'invest', 'team', 'invite']

export function RankScreen() {
  const { locale } = useI18n()
  const k = membershipCopy(locale)
  const [board, setBoard] = usePageState<RankBoard>('rank:board', 'score')
  const [period, setPeriod] = usePageState<RankPeriod>('rank:period', 'month')
  const [busy, setBusy] = useState(false)
  usePageTabs(BOARDS, board, setBoard)
  const key = `rank:${board}:${period}`
  const result = useQuery(key, () => rankQuery(board, period), { staleTime: 60_000 })
  const page = result.data
  const band = (value: string) => board === 'invite' ? k.invites(value) : bandLabel(value, locale, k.bandUnit)
  const toggle = async () => {
    if (!page?.me || busy) return
    setBusy(true)
    try { await setRankHidden(!page.me.hidden); for (const b of BOARDS) for (const p of ['week', 'month'] as const) invalidate(`rank:${b}:${p}`); await result.refetch() } finally { setBusy(false) }
  }
  const topbar = <RwaTopbar screen="rank" title={k.rankTitle} onBack={() => backOr('/profile/galaxy')} />

  return <MaisonPage page="rank" topbar={topbar}>
    <TopTabs value={board} onChange={setBoard} label={k.rankTitle} options={BOARDS.map((value) => ({ value, label: k.boards[value] }))} />
    <div className={s.page}>
      <div className={s.periods} role="group" aria-label={k.rankTitle}>
        {(['week', 'month'] as const).map((value) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 'week' ? k.week : k.month}</button>)}
        <small>{k.rankKicker}</small>
      </div>

      {result.error && !page ? <p className={s.note} role="alert">{k.loadFailed} <button type="button" className={s.textKey} onClick={() => void result.refetch()}>{k.retry}</button></p>
        : !page ? <ul className={s.list} aria-busy="true">{[0, 1, 2, 3, 4].map((i) => <li key={i} className={s.row}><span className={s.ghostLine} /></li>)}</ul>
        : page.items.length === 0 ? <p className={s.note}>{k.empty}</p>
        : <ol className={`${s.list} ${s.ranks}`}>{page.items.map((row) => <li key={`${row.rank}-${row.handle}`} className={s.rankRow} data-top={row.rank <= 3 || undefined}>
          <b className={s.place} dir="ltr">{row.rank}</b>
          <CommunityAvatar avatarUrl={row.avatarUrl} seed={row.avatarSeed ?? row.handle} handle={row.handle} size={36} />
          <span className={s.who}><b dir="auto">{row.displayName}</b><GalaxyBadge level={row.level} /></span>
          <span className={s.band} dir="ltr">{band(row.band)}</span>
        </li>)}</ol>}

      {page?.me && <>
        <div className={s.mine}>
          <span>{k.mine}</span>
          <b dir="ltr">{page.me.hidden ? k.hidden : page.me.rank ? `#${page.me.rank}` : k.notRanked}</b>
          {!page.me.hidden && page.me.band && <small dir="ltr">{band(page.me.band)}</small>}
        </div>
        <div className={s.hideRow}>
          <button type="button" className={s.textKey} disabled={busy} onClick={() => void toggle()}>{page.me.hidden ? k.show : k.hide}</button>
          <small>{k.hideNote}</small>
        </div>
      </>}
    </div>
  </MaisonPage>
}
