'use client'

/**
 * `/profile/galaxy` — my membership level (2026-11-04). From top: the deep-space card (the level's body, its name, star
 * power and the bar to the next level), what is still needed, where the star power comes from, this level's and the
 * next level's perks, the ladder of all seven bodies, how it is counted, and the way to the rankings.
 */
import { ChevronRight } from 'lucide-react'
import RwaTopbar from '@/components/rwa-topbar'
import { MaisonPage } from '@/components/maison/primitives'
import { useQuery } from '@/lib/api/_query'
import { membershipQuery, levelKey, type LevelDef, type Membership } from '@/lib/api/membership'
import { LEVEL_NAMES, membershipCopy } from '@/lib/membership-copy'
import { useI18n } from '@/lib/i18n'
import { backOr, openPath } from '@/lib/maison-nav'
import { CelestialBody } from './CelestialBody'
import { GalaxyBadge } from './GalaxyBadge'
import s from './membership.module.css'

export function GalaxyScreen() {
  const { locale } = useI18n()
  const k = membershipCopy(locale)
  const names = LEVEL_NAMES[locale] ?? LEVEL_NAMES.en
  const result = useQuery('membership:me', membershipQuery, { staleTime: 60_000 })
  const m = result.data
  const num = (v: string | number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(v) || 0)
  const topbar = <RwaTopbar screen="galaxy" title={k.title} onBack={() => backOr('/profile')} />

  return <MaisonPage page="galaxy" topbar={topbar}>
    <div className={s.page}>
      {result.error && !m ? <p className={s.note} role="alert">{k.loadFailed} <button type="button" className={s.textKey} onClick={() => void result.refetch()}>{k.retry}</button></p>
        : !m ? <div className={s.space} aria-busy="true"><div className={s.ghost} /></div>
        : <Body m={m} />}
    </div>
  </MaisonPage>

  function Body({ m }: { m: Membership }) {
    const current = m.levels.find((level) => level.index === m.level.index) ?? m.levels[0]
    const next = m.next ? m.levels.find((level) => level.index === m.next!.index) ?? null : null
    const score = Number(m.score) || 0
    const from = Number(current?.threshold ?? 0), to = Number(next?.threshold ?? from)
    const progress = next ? Math.max(0, Math.min(1, (score - from) / Math.max(1, to - from))) : 1
    const date = (iso: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso))
    const needs: string[] = []
    if (m.next) {
      if (Number(m.next.missing.score) > 0) needs.push(k.needScore(num(m.next.missing.score)))
      if (m.next.missing.directActive) needs.push(k.needDirect(m.next.missing.directActive))
      if (m.next.missing.teamActive) needs.push(k.needTeam(m.next.missing.teamActive))
      if (m.next.missing.firstDeposit) needs.push(k.needDeposit)
    }
    return <>
      <section className={s.space} aria-label={k.title}>
        <CelestialBody level={m.level.index} size={168} className={s.body} />
        <div className={s.spaceText}>
          <small>{k.kicker}</small>
          <b className={s.levelName}>{names[m.level.key] ?? names[levelKey(m.level.index)]}</b>
          <span className={s.scoreLine}><span>{k.score}</span><b dir="ltr">{num(m.score)}</b></span>
        </div>
        <div className={s.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ width: `${progress * 100}%` }} /></div>
        <p className={s.trackNote}>{next ? `${k.toNext(names[next.key])} · ${num(to)}` : k.top}<span>{k.scoreNote}</span></p>
      </section>

      {m.graceUntil && <p className={s.note}>{k.grace(date(m.graceUntil))}</p>}

      {needs.length > 0 && <section className={s.group}>
        <h2 className={s.groupHead}>{k.needs}</h2>
        <ul className={s.list}>{needs.map((text) => <li key={text} className={s.row}><span>{text}</span></li>)}</ul>
      </section>}

      <section className={s.group}>
        <h2 className={s.groupHead}>{k.from}</h2>
        <ul className={s.list}>
          <li className={s.row}><span>{k.parts.deposits}</span><b dir="ltr">{num(m.components.deposits)} U</b></li>
          <li className={s.row}><span>{k.parts.purchases}</span><b dir="ltr">{num(m.components.purchases)} U</b></li>
          <li className={s.row}><span><span>{k.parts.team}</span><small>{k.teamLevels(num(m.components.team.l1), num(m.components.team.l2), num(m.components.team.l3))}</small><small>{k.members(m.components.members.direct, m.components.members.team)}</small></span>
            <b dir="ltr">{num(Number(m.components.team.l1) + Number(m.components.team.l2) + Number(m.components.team.l3))} U</b></li>
          <li className={s.row}><span>{k.parts.tasks}</span><b dir="ltr">{num(m.components.tasks)}</b></li>
        </ul>
      </section>

      {current && <Perks title={k.perks} level={current} />}
      {next && <Perks title={k.perksNext(names[next.key])} level={next} />}

      <section className={s.group}>
        <h2 className={s.groupHead}>{k.ladder}</h2>
        <div className={s.ladder}>{m.levels.map((level) => <div key={level.key} className={s.rung} data-now={level.index === m.level.index || undefined} data-reached={level.index <= m.level.index || undefined}>
          <span className={s.rungBody}><CelestialBody level={level.index} size={64} still /></span>
          <b>{names[level.key]}</b>
          <small dir="ltr">{level.index === m.level.index ? k.now : num(level.threshold)}</small>
        </div>)}</div>
      </section>

      <section className={s.group}>
        <h2 className={s.groupHead}>{k.how}</h2>
        <p className={s.body2}>{k.howBody}</p>
      </section>

      <button type="button" className={s.linkRow} onClick={() => openPath('/rank')}><span>{k.rank}</span><GalaxyBadge level={m.level.index} /><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button>
      <p className={s.foot}>{k.updated(new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(m.updatedAt)))}</p>
    </>
  }

  function Perks({ title, level }: { title: string; level: LevelDef }) {
    const p = level.perks
    // Phase 1 (2026-11-04): only the badge is live; draws, discounts, the frame and priority support arrive later and
    // say so — a perk is never promised as live before it works.
    const rows: Array<[string, boolean]> = [
      ...(p.honors.includes('badge') ? [[k.perk.badge, true] as [string, boolean]] : []),
      ...(p.draws > 0 ? [[k.perk.draws(p.draws), false] as [string, boolean]] : []),
      ...(p.predictionFeeDiscountPct > 0 ? [[k.perk.prediction(p.predictionFeeDiscountPct), false] as [string, boolean]] : []),
      ...(p.quantFeeDiscountPct > 0 ? [[k.perk.quant(p.quantFeeDiscountPct), false] as [string, boolean]] : []),
      ...p.honors.filter((key) => key !== 'badge').map((key) => [(k.perk as Record<string, unknown>)[key] as string, false] as [string, boolean]).filter(([text]) => Boolean(text)),
    ]
    if (!rows.length) return null
    return <section className={s.group}>
      <h2 className={s.groupHead}>{title}</h2>
      <ul className={s.list}>{rows.map(([row, live]) => <li key={row} className={s.row}><span>{row}</span>{!live && <small>{k.soon}</small>}</li>)}</ul>
    </section>
  }
}
