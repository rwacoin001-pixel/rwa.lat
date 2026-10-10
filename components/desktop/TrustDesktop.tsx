'use client'

import RwaLogoMark from '@/components/rwa-logo'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { QRCodeSVG } from 'qrcode.react'
import { localeOptions, type AppLocale } from '@/lib/app-locales'
import { useI18n } from '@/lib/i18n'
import { trustDesktopCopy } from '@/lib/desktop-trust-copy'
import { phonePath } from './TrustDesktopEntry'
import s from './trust-desktop.module.css'

const Artifact = dynamic(() => import('./TrustArtifact'), { ssr: false })
const MEDIA = '/media/desktop/trust-v2/'
const chapters = [
  { key: 'prologue', plate: 'earth', year: 'THE SHAPE OF TRUST', detail: '', object: null },
  { key: 'clay', plate: null, year: 'c. 3100–2900 BCE', detail: 'Uruk · The Met, 1988.433.1', object: 'tablet' },
  { key: 'gold', plate: null, year: 'c. 560–546 BCE', detail: 'Sardis · The Met, 26.59.4', object: 'stater' },
  { key: 'shares', plate: 'exchange', year: 'AMSTERDAM · 1611', detail: 'Hendrick de Keyser’s Beurs · RP-P-OB-2591', object: null },
  { key: 'paper', plate: null, year: 'NEW YORK · 1771', detail: 'Hugh Gaine · The Met, 24.90.1548', object: 'note' },
  { key: 'ink', plate: 'ink', year: '1835–56', detail: 'The Met, 2009.202', object: null },
  { key: 'fracture', plate: 'crisis', year: '2008-09-15', detail: 'Lehman Brothers', object: null },
  { key: 'record', plate: null, year: '2009-01-03', detail: 'BLOCK #0', object: null },
  { key: 'today', plate: 'today', year: 'TODAY', detail: '', object: null },
  { key: 'signature', plate: 'earth', year: 'A-REIT', detail: '', object: null },
] as const
const STEP = 2.2
const TOTAL = (chapters.length - 1) * STEP + 1.7

function Mark() {
  return <RwaLogoMark label="" />
}

export default function TrustDesktop() {
  const { locale, direction, setLocale } = useI18n()
  const c = trustDesktopCopy[locale]
  const root = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const scenes = useRef<(HTMLElement | null)[]>([])
  const trigger = useRef<ScrollTrigger | null>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const [reduced, setReduced] = useState(false)
  const [phoneLink, setPhoneLink] = useState('')
  const [ready, setReady] = useState<string | null>(null)
  const clayReady = useCallback(() => setReady('tablet'), [])
  const goldReady = useCallback(() => setReady('stater'), [])

  useEffect(() => { setReady(null) }, [active])

  useEffect(() => {
    const origin = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://a-reit.com' : location.origin
    setPhoneLink(origin + phonePath(new URLSearchParams(location.search).get('from')))
  }, [])

  useLayoutEffect(() => {
    if (!root.current || !track.current) return
    gsap.registerPlugin(ScrollTrigger)
    const mq = gsap.matchMedia()
    mq.add('(prefers-reduced-motion: no-preference)', () => {
      setReduced(false)
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
        trigger: track.current, start: 'top top', end: 'bottom bottom', scrub: .22,
        onUpdate(self) {
          const next = Math.min(chapters.length - 1, Math.max(0, Math.floor((self.progress * TOTAL + .28) / STEP)))
          if (activeRef.current !== next) { activeRef.current = next; setActive(next) }
          root.current?.style.setProperty('--progress', String(self.progress))
        },
      } })
      tl.to({}, { duration: TOTAL }, 0)
      scenes.current.forEach((section, i) => {
        if (!section) return
        const begin = i * STEP
        const query = gsap.utils.selector(section)
        gsap.set(section, { autoAlpha: i === 0 ? 1 : 0 })
        if (i > 0) tl.fromTo(section, { autoAlpha: 0 }, { autoAlpha: 1, duration: .5 }, begin - .35)
        if (i < chapters.length - 1) tl.to(section, { autoAlpha: 0, duration: .5 }, begin + STEP - .35)
        tl.fromTo(query('[data-camera]'), { scale: 1.015 }, { scale: chapters[i].key === 'shares' ? 1.17 : 1.085, duration: STEP + .35 }, Math.max(0, begin - .35))
        tl.fromTo(query('[data-object]'), { yPercent: 6, rotateY: -5 }, { yPercent: -5, rotateY: 5, duration: STEP + .35 }, Math.max(0, begin - .35))
        tl.fromTo(query('[data-copy]'), { y: 30 }, { y: -18, duration: STEP + .35 }, Math.max(0, begin - .35))
        if (chapters[i].key === 'fracture') tl.to(query('[data-blackout]'), { opacity: 1, duration: .38 }, begin + STEP - .75)
      })
      trigger.current = tl.scrollTrigger ?? null; timeline.current = tl
      return () => { trigger.current = null; timeline.current = null }
    })
    mq.add('(prefers-reduced-motion: reduce)', () => {
      setReduced(true)
      gsap.set(scenes.current.filter(Boolean), { clearProps: 'all' })
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) {
          const next = Number((entry.target as HTMLElement).dataset.chapter)
          activeRef.current = next; setActive(next)
        }
      }, { threshold: .55 })
      scenes.current.forEach(section => { if (section) observer.observe(section) })
      return () => observer.disconnect()
    })
    return () => mq.revert()
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el || reduced) return
    const x = gsap.quickTo(el, '--pointer-x', { duration: .55, ease: 'power2.out' })
    const y = gsap.quickTo(el, '--pointer-y', { duration: .55, ease: 'power2.out' })
    const move = (e: PointerEvent) => { x((e.clientX / innerWidth - .5) * 2); y((e.clientY / innerHeight - .5) * 2) }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); gsap.killTweensOf(el) }
  }, [reduced])

  const jump = (i: number) => {
    const st = trigger.current
    if (!st) { scenes.current[i]?.scrollIntoView({ behavior: 'instant' }); return }
    window.scrollTo({ top: st.start + (st.end - st.start) * (i * STEP + .65) / TOTAL, behavior: 'smooth' })
  }

  return <main ref={root} className={s.page} data-desktop-trust data-reduced={reduced} dir="ltr" lang={locale}>
    <header className={s.header}>
      <a href="/desktop" className={s.brand} aria-label="A-REIT"><Mark/><span>A-REIT</span></a>
      <div className={s.headerEnd} dir={direction}>
        <label className={s.language}><span className={s.srOnly}>{c.language}</span><select aria-label={c.language} value={locale} onChange={e => setLocale(e.target.value as AppLocale)}>{localeOptions.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select><span aria-hidden="true">⌄</span></label>
        <button className={s.phoneButton} onClick={() => jump(9)}>{c.phone}<span aria-hidden="true">↗</span></button>
      </div>
    </header>
    <div ref={track} className={s.track}>
      <div className={s.stage}>
        {chapters.map((chapter, i) => {
          const copy = c.chapters[i]
          const near = Math.abs(active - i) <= 1 || reduced
          const Heading = i === 0 ? 'h1' : 'h2'
          const artifact = chapter.object === 'tablet' || chapter.object === 'stater' ? chapter.object : null
          return <section key={chapter.key} ref={el => { scenes.current[i] = el }} className={s.scene} data-scene={chapter.key} data-chapter={i} aria-hidden={!reduced && active !== i} aria-labelledby={`trust-${chapter.key}`} style={{ zIndex: i + 1 }}>
            <div data-camera className={s.camera} aria-hidden="true">
              {chapter.plate && near && <div className={s.plate}><img src={`${MEDIA}${chapter.plate}.webp`} alt="" fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async"/></div>}
              {(i === 0 || i === 9) && <svg className={s.lightFlow} viewBox="0 0 1600 900" preserveAspectRatio="none"><defs><linearGradient id={`beam-${i}`}><stop stopColor="#c9a96a" stopOpacity="0"/><stop offset=".7" stopColor="#e1ba73"/><stop offset="1" stopColor="#e1ba73" stopOpacity="0"/></linearGradient></defs><path d="M490 930 C760 850 620 660 870 510 S1250 310 1500 -40" fill="none" stroke={`url(#beam-${i})`} strokeWidth="1.2"/></svg>}
              {i === 3 && near && <div className={s.columnForeground}><img src={`${MEDIA}exchange.webp`} alt="" decoding="async"/></div>}
              {i === 7 && <div className={s.chain}>{Array.from({length:5}, (_,n) => <div key={n} className={s.block} style={{'--block':n} as React.CSSProperties}><span>#{String(n).padStart(2,'0')}</span><i/><code>{n === 0 ? '000000000019d6689c' : 'SHA-256²'}<br/>{n === 0 ? '2009 · 01 · 03' : 'h(n−1) ‖ m(n)'}</code></div>)}</div>}
            </div>
            <div className={s.shade} aria-hidden="true"/>
            <div className={s.atmosphere} aria-hidden="true"/>
            {chapter.object && near && <div data-object className={`${s.object} ${chapter.object === 'note' ? s.paper : ''}`} aria-hidden="true">
              <img src={`${MEDIA}${chapter.object}.webp`} alt="" className={s.objectPhoto} style={{opacity: artifact && active === i && ready === artifact && !reduced ? 0 : 1}} decoding="async"/>
              {artifact && active === i && !reduced && <Artifact key={artifact} name={artifact} onReady={artifact === 'tablet' ? clayReady : goldReady}/>}
            </div>}
            <div data-copy className={s.copy} dir={direction}>
              <div className={s.eyebrow}><span>{String(i).padStart(2,'0')}</span><i/>{chapter.year}</div>
              <Heading id={`trust-${chapter.key}`}>{copy.title}</Heading>
              <p>{copy.body}</p>
              {chapter.detail && <small>{chapter.detail}</small>}
              {i === 9 && <p className={s.endBody}>{c.endBody}</p>}
            </div>
            {i === 9 && <div className={s.handoff} dir={direction}>{phoneLink && <QRCodeSVG value={phoneLink} size={174} level="M" bgColor="#ece9df" fgColor="#121a17" marginSize={3} title={c.scan}/>}<span>{c.scan}</span></div>}
            {i === 6 && <div data-blackout className={s.blackout} aria-hidden="true"/>}
            {i === 0 && <button className={s.scrollHint} onClick={() => jump(1)} dir={direction}><span>{c.scroll}</span><i aria-hidden="true"/></button>}
          </section>
        })}
      </div>
    </div>
    <footer className={s.footer}>
      <span className={s.footerName}>{c.title.replace('\n',' · ')}</span>
      <nav aria-label={c.chaptersLabel} dir={direction}>{c.chapters.map((chapter,i) => <button key={i} onClick={() => jump(i)} aria-current={active === i ? 'step' : undefined}><span>{chapter.name}</span><i aria-hidden="true"/></button>)}</nav>
      <span className={s.counter}>{String(active + 1).padStart(2,'0')}<i/>10</span>
    </footer>
    <div className={s.progress} aria-hidden="true"/>
    <details className={s.references} dir={direction}><summary>{c.reference}</summary><div><a href="https://www.metmuseum.org/art/collection/search/329081" target="_blank" rel="noreferrer">The Met · 1988.433.1</a><a href="https://www.metmuseum.org/art/collection/search/252456" target="_blank" rel="noreferrer">The Met · 26.59.4</a><a href="https://id.rijksmuseum.nl/200270197" target="_blank" rel="noreferrer">Rijksmuseum · RP-P-OB-2591</a><a href="https://www.metmuseum.org/art/collection/search/732864" target="_blank" rel="noreferrer">The Met · 24.90.1548</a></div></details>
  </main>
}
