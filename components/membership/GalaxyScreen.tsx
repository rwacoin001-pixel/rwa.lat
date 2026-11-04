'use client'

/**
 * `/profile/galaxy` — my membership level. v2 (2026-11-05, user: low density, unprofessional; layout agreed with Codex):
 * one hero card (medallion, L-rank + name, star power, a 4px bar and what is left), the upgrade checklist with ticks,
 * where the star power comes from as a 2×2 grid, perks as a this-level / next-level table (only the badge is live — the
 * rest say so), the medallion ladder, the rankings, how it is counted.
 */
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import RwaTopbar from '@/components/rwa-topbar'
import { MaisonPage } from '@/components/maison/primitives'
import { useQuery } from '@/lib/api/_query'
import { membershipQuery, levelKey, type LevelDef, type Membership } from '@/lib/api/membership'
import { LEVEL_NAMES, membershipCopy } from '@/lib/membership-copy'
import { useI18n } from '@/lib/i18n'
import { backOr, openPath } from '@/lib/maison-nav'
import { Medallion } from './Medallion'
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
        : !m ? <div className={s.hero} aria-busy="true"><div className={s.ghost} /></div>
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
    const label = (level: { index: number; key?: string }) => `L${level.index} ${names[(level.key ?? levelKey(level.index)) as keyof typeof names] ?? names[levelKey(level.index)]}`
    const c = m.components
    const team = Number(c.team.l1) + Number(c.team.l2) + Number(c.team.l3)
    // The checklist for the next level: every rule it has, met or not, with where the member stands.
    const checks: Array<{ text: string; have: string; met: boolean }> = next ? [
      { text: k.reqScore(num(next.threshold)), have: `${num(score)} / ${num(next.threshold)}`, met: score >= Number(next.threshold) },
      ...(next.requires.firstDeposit ? [{ text: k.reqDeposit, have: '', met: !m.next!.missing.firstDeposit }] : []),
      ...(next.requires.directActive ? [{ text: k.reqDirect(next.requires.directActive), have: `${c.members.directActive} / ${next.requires.directActive}`, met: c.members.directActive >= next.requires.directActive }] : []),
      ...(next.requires.teamActive ? [{ text: k.reqTeam(next.requires.teamActive), have: `${c.members.teamActive} / ${next.requires.teamActive}`, met: c.members.teamActive >= next.requires.teamActive }] : []),
    ] : []
    return <>
      <section className={s.hero} aria-label={k.title}>
        <div className={s.heroTop}>
          <Medallion level={m.level.index} size={96} className={s.heroCoin} />
          <div className={s.heroText}>
            <small>L{m.level.index} · {k.kicker}</small>
            <b className={s.levelName}>{names[m.level.key] ?? names[levelKey(m.level.index)]}</b>
            <span className={s.scoreLine}><span>{k.score}</span><b dir="ltr">{num(m.score)}</b></span>
          </div>
        </div>
        <div className={s.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ width: `${progress * 100}%` }} /></div>
        <p className={s.trackNote}><span>{next ? k.toGo(label(next), num(Math.max(0, to - score))) : k.top}</span><small>{k.scoreNote}</small></p>
        {m.graceUntil && <p className={s.heroNote}>{k.grace(date(m.graceUntil))}</p>}
      </section>

      {next && <section className={s.group}>
        <h2 className={s.groupHead}>{k.reqTitle(label(next))}</h2>
        <ul className={s.list}>{checks.map((row) => <li key={row.text} className={s.check} data-met={row.met || undefined}>
          <i aria-hidden="true">{row.met && <Check size={12} strokeWidth={3} />}</i><span>{row.text}</span>{row.have && <b dir="ltr">{row.have}</b>}
        </li>)}</ul>
      </section>}

      <section className={s.group}>
        <h2 className={s.groupHead}>{k.from}</h2>
        <div className={s.grid}>
          <div><small>{k.parts.deposits}</small><b dir="ltr">{num(c.deposits)}<em>USDT</em></b></div>
          <div><small>{k.parts.purchases}</small><b dir="ltr">{num(c.purchases)}<em>USDT</em></b></div>
          <div><small>{k.parts.team}</small><b dir="ltr">{num(team)}<em>USDT</em></b><span>{k.teamLevels(num(c.team.l1), num(c.team.l2), num(c.team.l3))}</span></div>
          <div><small>{k.parts.tasks}</small><b dir="ltr">{num(c.tasks)}</b></div>
        </div>
        <p className={s.foot}>{k.members2(c.members.direct, c.members.team, c.members.teamActive)}</p>
      </section>

      {current && <PerkTable now={current} next={next} label={label} />}

      <section className={s.group}>
        <h2 className={s.groupHead}>{k.ladder}</h2>
        <div className={s.ladder}>{m.levels.map((level) => <div key={level.key} className={s.rung} data-now={level.index === m.level.index || undefined} data-reached={level.index <= m.level.index || undefined}>
          <Medallion level={level.index} size={52} className={s.rungCoin} />
          <small className={s.rungRank}>L{level.index}</small>
          <b>{names[level.key]}</b>
          <small dir="ltr">{level.index === m.level.index ? k.now : num(level.threshold)}</small>
        </div>)}</div>
      </section>

      <button type="button" className={s.linkRow} onClick={() => openPath('/rank')}><span>{k.rank}</span><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button>
      <details className={s.how}><summary><span>{k.how}</span><ChevronDown size={16} aria-hidden="true" /></summary><p>{k.howBody}</p></details>
      <p className={s.foot}>{k.updated(new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(m.updatedAt)))}</p>
    </>
  }

  /** This level against the next one, perk by perk. Phase 1 (2026-11-04): only the badge is live — said once below. */
  function PerkTable({ now, next, label }: { now: LevelDef; next: LevelDef | null; label: (level: LevelDef) => string }) {
    const has = (level: LevelDef | null, honor: string) => Boolean(level?.perks.honors.includes(honor))
    const rows: Array<{ name: string; a: string; b: string }> = [
      { name: k.perk.badge, a: has(now, 'badge') ? '✓' : '—', b: has(next, 'badge') ? '✓' : '—' },
      { name: k.perkNames.draws, a: now.perks.draws ? `+${now.perks.draws}` : '—', b: next?.perks.draws ? `+${next.perks.draws}` : '—' },
      { name: k.perkNames.prediction, a: now.perks.predictionFeeDiscountPct ? `−${now.perks.predictionFeeDiscountPct}%` : '—', b: next?.perks.predictionFeeDiscountPct ? `−${next.perks.predictionFeeDiscountPct}%` : '—' },
      { name: k.perkNames.quant, a: now.perks.quantFeeDiscountPct ? `−${now.perks.quantFeeDiscountPct}%` : '—', b: next?.perks.quantFeeDiscountPct ? `−${next.perks.quantFeeDiscountPct}%` : '—' },
      { name: k.perk.frame, a: has(now, 'frame') ? '✓' : '—', b: has(next, 'frame') ? '✓' : '—' },
      { name: k.perk.priority_support, a: has(now, 'priority_support') ? '✓' : '—', b: has(next, 'priority_support') ? '✓' : '—' },
    ]
    return <section className={s.group}>
      <h2 className={s.groupHead}>{k.perks}</h2>
      <table className={s.table}>
        <thead><tr><th scope="col">{k.perkCol}</th><th scope="col">{k.thisLevel}</th>{next && <th scope="col">{label(next)}</th>}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td data-on={row.a !== '—' || undefined}>{row.a}</td>{next && <td data-on={row.b !== '—' || undefined}>{row.b}</td>}</tr>)}</tbody>
      </table>
      <p className={s.foot}>{k.soonNote}</p>
    </section>
  }
}
