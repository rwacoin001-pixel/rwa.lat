'use client'

/**
 * `/profile/galaxy` — my membership level. v3 (2026-11-05, user: "the badge still is not right; redesign the page and the
 * levels after this reference — the style and layout, not a copy — 3D, with motion, refined on every page"):
 * - the hero card: my gem on stage breaking out of the top-right corner (leans to the finger / phone tilt, floats, a light
 *   band crosses it, an orbit passes behind and in front), the level name large with its L-rank, star power counting
 *   up, a brand-green bar with where this level starts and what the next one needs;
 * - the next level's checklist, my perks with on / soon pills, all seven gems in a row — tap one to see its gate and
 *   perks — then where star power comes from, the rankings and how it is counted. 规则 in the top bar opens the rules.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ScrollText } from 'lucide-react'
import RwaTopbar from '@/components/rwa-topbar'
import { MaisonPage } from '@/components/maison/primitives'
import { Sheet } from '@/components/maison/Sheet'
import { useQuery } from '@/lib/api/_query'
import { membershipQuery, levelKey, type LevelDef, type Membership } from '@/lib/api/membership'
import { LEVEL_NAMES, membershipCopy, type MembershipCopy } from '@/lib/membership-copy'
import { useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { backOr, openPath } from '@/lib/maison-nav'
import { GemStage } from './GemStage'
import { Medallion } from './Medallion'
import s from './membership.module.css'

/** Counts from 0 to the value once (900ms, ease-out); reduced motion shows it at once. */
function useCountUp(value: number) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900)
      setShown(value * (1 - Math.pow(1 - t, 3)))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return shown
}

type Gift = { name: string; live: boolean }
function giftsOf(level: LevelDef, k: MembershipCopy): Gift[] {
  const honors = level.perks.honors
  return [
    ...(honors.includes('badge') ? [{ name: k.perk.badge, live: true }] : []),
    ...(level.perks.draws ? [{ name: k.perk.draws(level.perks.draws), live: false }] : []),
    ...(level.perks.predictionFeeDiscountPct ? [{ name: k.perk.prediction(level.perks.predictionFeeDiscountPct), live: false }] : []),
    ...(level.perks.quantFeeDiscountPct ? [{ name: k.perk.quant(level.perks.quantFeeDiscountPct), live: false }] : []),
    ...(honors.includes('frame') ? [{ name: k.perk.frame, live: false }] : []),
    ...(honors.includes('priority_support') ? [{ name: k.perk.priority_support, live: false }] : []),
  ]
}

export function GalaxyScreen() {
  const { locale } = useI18n()
  const k = membershipCopy(locale)
  const result = useQuery('membership:me', membershipQuery, { staleTime: 60_000 })
  const m = result.data
  const [rules, setRules] = useState(false)
  const topbar = <RwaTopbar screen="galaxy" title={k.title} onBack={() => backOr('/profile')} action={{ label: k.rules, Icon: ScrollText, onClick: () => setRules(true) }} />

  return <MaisonPage page="galaxy" topbar={topbar}>
    <div className={s.page}>
      {result.error && !m ? <p className={s.note} role="alert">{k.loadFailed} <button type="button" className={s.textKey} onClick={() => void result.refetch()}>{k.retry}</button></p>
        : !m ? <div className={s.hero} aria-busy="true"><div className={s.ghost} /></div>
        : <Body m={m} />}
    </div>
    <Sheet open={rules} onClose={() => setRules(false)} title={k.how}>
      <p className={s.rulesBody}>{k.howBody}</p>
      <p className={s.rulesBody}>{k.soonNote}</p>
    </Sheet>
  </MaisonPage>
}

function Body({ m }: { m: Membership }) {
  const { locale } = useI18n()
  const k = membershipCopy(locale)
  const names = LEVEL_NAMES[locale] ?? LEVEL_NAMES.en
  const num = (v: string | number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(v) || 0)
  const card = useRef<HTMLElement>(null)
  const { theme } = useRwaTheme()
  const current = m.levels.find((level) => level.index === m.level.index) ?? m.levels[0]
  const next = m.next ? m.levels.find((level) => level.index === m.next!.index) ?? null : null
  const [pick, setPick] = useState(next?.index ?? current?.index ?? 1)
  const picked = m.levels.find((level) => level.index === pick) ?? current
  const score = Number(m.score) || 0
  const counted = useCountUp(score)
  const from = Number(current?.threshold ?? 0), to = Number(next?.threshold ?? from)
  const progress = next ? Math.max(0, Math.min(1, (score - from) / Math.max(1, to - from))) : 1
  const [grown, setGrown] = useState(0)
  useEffect(() => { const id = window.setTimeout(() => setGrown(progress), 120); return () => window.clearTimeout(id) }, [progress])
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso))
  const nameOf = (level: { index: number; key?: string }) => names[(level.key ?? levelKey(level.index)) as keyof typeof names] ?? names[levelKey(level.index)]
  const label = (level: { index: number; key?: string }) => `L${level.index} ${nameOf(level)}`
  const c = m.components
  const team = Number(c.team.l1) + Number(c.team.l2) + Number(c.team.l3)
  const checks: Array<{ text: string; have: number; need: number; met: boolean; left?: string }> = next ? [
    { text: k.reqScore(num(next.threshold)), have: score, need: Number(next.threshold), met: score >= Number(next.threshold), left: k.needScore(num(Math.max(0, Number(next.threshold) - score))) },
    ...(next.requires.firstDeposit ? [{ text: k.reqDeposit, have: m.next!.missing.firstDeposit ? 0 : 1, need: 1, met: !m.next!.missing.firstDeposit }] : []),
    ...(next.requires.directActive ? [{ text: k.reqDirect(next.requires.directActive), have: c.members.directActive, need: next.requires.directActive, met: c.members.directActive >= next.requires.directActive, left: k.needDirect(Math.max(0, next.requires.directActive - c.members.directActive)) }] : []),
    ...(next.requires.teamActive ? [{ text: k.reqTeam(next.requires.teamActive), have: c.members.teamActive, need: next.requires.teamActive, met: c.members.teamActive >= next.requires.teamActive, left: k.needTeam(Math.max(0, next.requires.teamActive - c.members.teamActive)) }] : []),
  ] : []
  const gates = (level: LevelDef) => [
    ...(level.threshold > 0 ? [k.reqScore(num(level.threshold))] : []),
    ...(level.requires.firstDeposit ? [k.reqDeposit] : []),
    ...(level.requires.directActive ? [k.reqDirect(level.requires.directActive)] : []),
    ...(level.requires.teamActive ? [k.reqTeam(level.requires.teamActive)] : []),
  ]
  return <>
    <section ref={card} className={s.hero} aria-label={k.title}>
      <GemStage level={m.level.index} size={172} className={s.heroGem} track={card} />
      <div className={s.heroText}>
        <span className={s.heroKicker}><img src={`/brand/a-reit/mark-${theme === 'dark' ? 'dark' : 'light'}.svg`} alt="" width={12} height={13} className={s.heroMark} />{k.member}</span>
        <b className={s.levelName}>{nameOf(m.level)}</b>
        <span className={s.levelRank} dir="ltr">L{m.level.index} · {(LEVEL_NAMES.en[m.level.key] ?? '').toUpperCase()}</span>
        <small className={s.scoreLabel}>{k.score}</small>
        <b className={s.scoreBig} dir="ltr">{num(Math.round(counted))}</b>
      </div>
      <div className={s.heroFoot}>
        <div className={s.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ width: `${grown * 100}%` }} /></div>
        <p className={s.trackNote}>
          <span>{k.levelStart(num(from))}{next ? ` · ${k.levelNeed(`L${next.index}`, num(to))}` : ` · ${k.top}`}</span>
          <b dir="ltr">{(progress * 100).toFixed(1)}%</b>
        </p>
        <p className={s.heroNote}>{m.graceUntil ? k.grace(date(m.graceUntil)) : k.scoreNote}</p>
      </div>
    </section>

    {next && <section className={s.group}>
      <h2 className={s.sectionHead}>{k.reqTitle(label(next))}</h2>
      <ul className={s.list}>{checks.map((row) => <li key={row.text} className={s.check} data-met={row.met || undefined}>
        <i aria-hidden="true">{row.met && <Check size={12} strokeWidth={3} />}</i>
        <span>{row.text}{!row.met && row.left && <small>{row.left}</small>}</span>
        {row.need > 1 && <b dir="ltr"><em>{num(row.have)}</em> / {num(row.need)}</b>}
      </li>)}</ul>
    </section>}

    {current && <section className={s.group}>
      <h2 className={s.sectionHead}>{k.gifts}</h2>
      <ul className={s.list}>{giftsOf(current, k).map((gift) => <li key={gift.name} className={s.gift} data-live={gift.live || undefined}>
        <i aria-hidden="true">{gift.live && <Check size={12} strokeWidth={3} />}</i><span>{gift.name}</span><em>{gift.live ? k.live : k.soonPill}</em>
      </li>)}</ul>
    </section>}

    <section className={s.group}>
      <h2 className={s.sectionHead}>{k.ladder}</h2>
      <div className={s.ladderCard}>
        <div className={s.gems} role="tablist" aria-label={k.ladder}>{m.levels.map((level) => <button key={level.key} type="button" role="tab" aria-selected={pick === level.index}
          className={s.gemKey} data-reached={level.index <= m.level.index || undefined} data-now={level.index === m.level.index || undefined} onClick={() => setPick(level.index)}>
          <Medallion level={level.index} size={44} className={s.gemImg} />
          <small dir="ltr">L{level.index}</small>
          <b>{nameOf(level)}</b>
        </button>)}</div>
        {picked && <div className={s.gemDetail} key={picked.index}>
          <p className={s.gemDetailHead}><b>{label(picked)}</b><span>{picked.index <= m.level.index ? k.reached : picked.threshold > 0 ? `${k.score} ${num(picked.threshold)}` : k.gateFree}</span></p>
          <dl>
            <div><dt>{k.gate}</dt><dd>{gates(picked).length ? gates(picked).join(' · ') : k.gateFree}</dd></div>
            <div><dt>{k.gifts}</dt><dd>{giftsOf(picked, k).map((gift) => gift.name).join(' · ') || k.noGifts}</dd></div>
          </dl>
        </div>}
      </div>
    </section>

    <section className={s.group}>
      <h2 className={s.sectionHead}>{k.from}</h2>
      <div className={s.grid}>
        <div><small>{k.parts.deposits}</small><b dir="ltr">{num(c.deposits)}<em>USDT</em></b></div>
        <div><small>{k.parts.purchases}</small><b dir="ltr">{num(c.purchases)}<em>USDT</em></b></div>
        <div><small>{k.parts.team}</small><b dir="ltr">{num(team)}<em>USDT</em></b><span>{k.teamLevels(num(c.team.l1), num(c.team.l2), num(c.team.l3))}</span></div>
        <div><small>{k.parts.tasks}</small><b dir="ltr">{num(c.tasks)}</b></div>
      </div>
      <p className={s.foot}>{k.members2(c.members.direct, c.members.team, c.members.teamActive)}</p>
    </section>

    <button type="button" className={s.linkRow} onClick={() => openPath('/rank')}><span>{k.rank}</span><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button>
    <details className={s.how}><summary><span>{k.how}</span><ChevronDown size={16} aria-hidden="true" /></summary><p>{k.howBody}</p></details>
    <p className={s.foot}>{k.updated(new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(m.updatedAt)))}</p>
  </>
}
