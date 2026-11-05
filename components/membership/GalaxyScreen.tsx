'use client'

import { brandText } from '@/lib/brand/build-brand'

/**
 * `/profile/galaxy` — my membership level. v4 (2026-11-05, user: "the badge and this page still are not good — think as an
 * Apple or Google designer would"): one object and plain type. The hero is my badge (a vector medal with the level numeral)
 * inside a progress ring that fills to the next level, as Activity does; under it the level name, "level 3 of 7", star
 * power counting up and one line on what is left. Then the next level's checklist, my perks, every level as a card in a
 * sideways row (mine centred), where star power comes from, the rankings and how it is counted. 规则 opens the rules.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, ScrollText } from 'lucide-react'
import RwaTopbar from '@/components/rwa-topbar'
import { MaisonPage } from '@/components/maison/primitives'
import { Sheet } from '@/components/maison/Sheet'
import { useQuery } from '@/lib/api/_query'
import { membershipQuery, levelKey, type LevelDef, type Membership } from '@/lib/api/membership'
import { LEVEL_NAMES, giftsOf, membershipCopy } from '@/lib/membership-copy'
import { useI18n } from '@/lib/i18n'
import { backOr, openPath } from '@/lib/maison-nav'
import { Medallion } from './Medallion'
import { GrainGradient } from '@paper-design/shaders-react'
import { GEM_TINT } from './gem-spec'
import type { CSSProperties } from 'react'
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
  const row = useRef<HTMLDivElement>(null)
  const current = m.levels.find((level) => level.index === m.level.index) ?? m.levels[0]
  const next = m.next ? m.levels.find((level) => level.index === m.next!.index) ?? null : null
  const score = Number(m.score) || 0
  const counted = useCountUp(score)
  const from = Number(current?.threshold ?? 0), to = Number(next?.threshold ?? from)
  const progress = next ? Math.max(0, Math.min(1, (score - from) / Math.max(1, to - from))) : 1
  const [grown, setGrown] = useState(0)
  useEffect(() => { const id = window.setTimeout(() => setGrown(progress), 120); return () => window.clearTimeout(id) }, [progress])
  // Centre my own level card in the row once.
  useEffect(() => {
    const node = row.current?.querySelector<HTMLElement>('[data-now]')
    if (node && row.current) row.current.scrollLeft = node.offsetLeft - (row.current.clientWidth - node.clientWidth) / 2
  }, [])
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso))
  const nameOf = (level: { index: number; key?: string }) => names[(level.key ?? levelKey(level.index)) as keyof typeof names] ?? names[levelKey(level.index)]
  const label = (level: { index: number; key?: string }) => nameOf(level)
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
    {/* Editorial hero (2026-11-05, after the user's black "festival" reference): one ink card with fine grain; a serif
        title stacked top-left, a fine-line starburst top-right whose rays grow with the level and turn slowly; the level in
        very large serif; star power and what is left; an arrow list to the sections; a halftone orb bottom-right that
        brightens as the next level nears. No four-point sparkle. Same ink card in light and dark. */}
    <section className={s.ed} aria-label={k.title}>
      <GrainGradient className={s.edGrain} colorBack="#0b0b0d" colors={['#1a1a1e', '#3a3a40', '#0e0e10', '#26262b']} shape="sphere" softness={1} intensity={.18} noise={.38} speed={0} minPixelRatio={1} maxPixelCount={420 * 520} />
      <header className={s.edHead}>
        <p className={s.edTitle}>Membership<br />Level<span>.</span></p>
        <svg className={s.edBurst} viewBox="-50 -50 100 100" aria-hidden="true">{Array.from({ length: 8 + m.level.index * 4 }, (_, i) => {
          const a = (i / (8 + m.level.index * 4)) * Math.PI * 2, r = i % 2 ? 30 : 44
          return <line key={i} x1={Math.cos(a) * 6} y1={Math.sin(a) * 6} x2={Math.cos(a) * r} y2={Math.sin(a) * r} />
        })}</svg>
      </header>
      <small className={s.edKicker}>{brandText("A-REIT")} · {k.title} · {k.tierOf(m.level.index, m.levels.length || 7)}</small>
      <b className={s.edRank} dir="ltr">{nameOf(m.level)}</b>
      <p className={s.edScore}><span>{k.score}</span><b dir="ltr">{num(Math.round(counted))}</b></p>
      <p className={s.edNext}>{next ? <>{k.toGo(label(next), num(Math.max(0, to - score)))} · <b dir="ltr">{(progress * 100).toFixed(0)}%</b></> : k.top}</p>
      {m.graceUntil && <p className={s.edNext}>{k.grace(date(m.graceUntil))}</p>}
      <nav className={s.edNav} aria-label={k.title}>
        {next && <a href="#lv-next" onClick={(e) => { e.preventDefault(); document.getElementById('lv-next')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{k.reqTitle(label(next))}</a>}
        <a href="#lv-gifts" onClick={(e) => { e.preventDefault(); document.getElementById('lv-gifts')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{k.gifts}</a>
        <a href="#lv-all" onClick={(e) => { e.preventDefault(); document.getElementById('lv-all')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{k.ladder}</a>
        <a href="/rank" onClick={(e) => { e.preventDefault(); openPath('/rank') }}>{k.rank}</a>
      </nav>
      <footer className={s.edFoot}>
        <small>{k.scoreNote}<br />{brandText("A-REIT")} Membership®</small>
        <i className={s.edOrb} style={{ ['--p' as string]: String(.25 + grown * .75) } as CSSProperties} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={k.score} />
      </footer>
    </section>

    {next && <section className={s.group} id="lv-next">
      <h2 className={s.sectionHead}>{k.reqTitle(label(next))}</h2>
      <ul className={s.list}>{checks.map((row) => <li key={row.text} className={s.check} data-met={row.met || undefined}>
        <i aria-hidden="true">{row.met && <Check size={12} strokeWidth={3} />}</i>
        <span>{row.text}{!row.met && row.left && <small>{row.left}</small>}{row.need > 1 && <i className={s.checkBar} aria-hidden="true"><i style={{ width: `${Math.min(100, row.have / row.need * 100)}%` }} /></i>}</span>
        {row.need > 1 && <b dir="ltr"><em>{num(row.have)}</em> / {num(row.need)}</b>}
      </li>)}</ul>
    </section>}

    {current && <section className={s.group} id="lv-gifts">
      <h2 className={s.sectionHead}>{k.gifts}</h2>
      <ul className={s.list}>{giftsOf(current, k).map((gift) => <li key={gift.name} className={s.gift} data-live={gift.live || undefined}>
        <i aria-hidden="true">{gift.live && <Check size={12} strokeWidth={3} />}</i><span>{gift.name}</span><em>{gift.live ? k.live : k.soonPill}</em>
      </li>)}</ul>
    </section>}

    <section className={s.group} id="lv-all">
      <h2 className={s.sectionHead}>{k.ladder}</h2>
      <div ref={row} className={s.tiers}>{m.levels.map((level) => {
        const gifts = giftsOf(level, k), gate = gates(level)
        return <article key={level.key} className={s.tier} style={{ ['--tone' as string]: GEM_TINT[level.index] } as CSSProperties} data-now={level.index === m.level.index || undefined} data-reached={level.index <= m.level.index || undefined}>
          <header><Medallion level={level.index} size={48} /><span><b>{nameOf(level)}</b><small dir="ltr">{level.threshold > 0 ? `${k.score} ${num(level.threshold)}` : k.gateFree}</small></span>{level.index === m.level.index && <em>{k.now}</em>}</header>
          {gate.length > 1 && <p className={s.tierGate}>{gate.slice(1).join(' · ')}</p>}
          <ul>{(gifts.length ? gifts : [{ name: k.noGifts, live: true }]).map((gift) => <li key={gift.name}>{gift.name}</li>)}</ul>
        </article>
      })}</div>
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
