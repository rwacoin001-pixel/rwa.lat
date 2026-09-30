'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Instrument_Serif } from 'next/font/google'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { QRCodeSVG } from 'qrcode.react'
import { localeOptions, type AppLocale } from '@/lib/app-locales'
import { desktopCopy } from '@/lib/desktop-copy'
import { useI18n } from '@/lib/i18n'
import d from './desktop.module.css'

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--desk-latin', display: 'swap' })
// CJK display serif is supplied as a CSS font stack (see desktop.module.css) so builds never
// depend on fetching a multi-megabyte CJK face from Google Fonts.

type Scene = {
  key: string
  // Subject placement inside the 2400x1371 frame, printed by scripts/desktop-layers.py. null = plate only.
  subject: { left: number; top: number; width: number } | null
  fore: number
  // Headline box in frame %: set beside the subject where it would otherwise hide the words. w caps the line width.
  head: { x: number; y: number; w: number }
  // Top of the glass card stack, in vh; lowered when the headline takes the upper right.
  cardsTop: number
  tone: 'light' | 'dark'
  // App screen the phone shows while this chapter is on stage.
  route: string
  // Paint behind the plate while it decodes, sampled from the art.
  bg: string
}

const SCENES: Scene[] = [
  { key: 'open', subject: { left: 12.83, top: 20.35, width: 42.42 }, fore: 84, head: { x: 7.5, y: 9, w: 55 }, cardsTop: 22, tone: 'light', route: '/home', bg: '#55506a' },
  { key: 'assets', subject: { left: 22.67, top: 5.11, width: 14.5 }, fore: 86, head: { x: 40, y: 8, w: 34 }, cardsTop: 38, tone: 'light', route: '/markets?tab=assets', bg: '#3f7fae' },
  { key: 'hengxu', subject: { left: 15.25, top: 6.27, width: 19.5 }, fore: 86, head: { x: 37, y: 7, w: 37 }, cardsTop: 38, tone: 'light', route: '/markets?tab=baskets', bg: '#6f8fa8' },
  { key: 'trust', subject: { left: 18.96, top: 15.1, width: 27.04 }, fore: 88, head: { x: 7.5, y: 9, w: 55 }, cardsTop: 22, tone: 'dark', route: '/trust', bg: '#a49c8e' },
  { key: 'anywhere', subject: { left: 12.54, top: 7, width: 32.75 }, fore: 86, head: { x: 45, y: 7, w: 30 }, cardsTop: 38, tone: 'light', route: '/home', bg: '#4b7a96' },
  { key: 'close', subject: null, fore: 86, head: { x: 7.5, y: 9, w: 55 }, cardsTop: 22, tone: 'light', route: '/home', bg: '#2e3566' },
]

// Timeline units. Each chapter holds for HOLD, then pushes out over PUSH while the next rises in after LAG.
const HOLD = 1
const PUSH = 0.6
const LAG = 0.1
const STEP = HOLD + LAG + PUSH
const TOTAL = STEP * (SCENES.length - 1) + HOLD
const holdAt = (i: number) => i * STEP

// Promo path across the water, in frame units (100 x 57.125). Storytelling only, not a signup flow.
const PATH = 'M3 46.5 C 16 39, 32 39.5, 44 42 S 60 45, 68 40.5'

// Only same-origin paths may be handed to the QR code or the phone preview.
function safePath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/desktop')) return null
  return raw
}

// Fit each headline line into the box width (CJK glyphs ~1em, the display serif ~0.48em); below 3.6cqw it wraps instead.
function lineSize(text: string, width: number) {
  let em = 0
  for (const ch of text) em += ch.codePointAt(0)! >= 0x2e80 && !/[؀-ۿऀ-ॿ]/.test(ch) ? 1 : 0.48
  return `clamp(3.6cqw, ${(width / Math.max(em, 1)).toFixed(2)}cqw, 5.2cqw)`
}

const pad = (i: number) => String(i + 1).padStart(2, '0')

export default function DesktopShowcase() {
  const { locale, direction, setLocale } = useI18n()
  const c = desktopCopy(locale)
  const root = useRef<HTMLElement>(null)
  const phone = useRef<HTMLDivElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const track = useRef<SVGPathElement>(null)
  const scenes = useRef<(HTMLElement | null)[]>([])
  const trigger = useRef<ScrollTrigger | null>(null)
  const [link, setLink] = useState<{ origin: string; from: string | null } | null>(null)
  const [stations, setStations] = useState<{ x: number; y: number }[]>([])
  const [active, setActive] = useState(0)
  // Two stacked previews: the back one loads the next chapter's screen, then cross-fades to the front.
  const [frames, setFrames] = useState<[string | null, string | null]>([null, null])
  const [front, setFront] = useState(0)
  const wanted = useRef<string | null>(null)

  useEffect(() => {
    setLink({ origin: window.location.origin, from: safePath(new URLSearchParams(window.location.search).get('from')) })
  }, [])

  // A shared link always previews that exact page; otherwise the phone follows the chapter on stage.
  const route = link ? link.from ?? SCENES[active].route : null
  useEffect(() => {
    if (!route) return
    wanted.current = route
    setFrames((current) => {
      if (current[front] === route) return current
      if (!current[front]) return front === 0 ? [route, current[1]] : [current[0], route]
      return front === 0 ? [current[0], route] : [route, current[1]]
    })
  }, [route, front])

  // Six chapter stations spaced evenly along the promo path.
  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    const length = el.getTotalLength()
    setStations(Array.from({ length: 6 }, (_, i) => { const point = el.getPointAtLength((length * (i + 0.5)) / 6); return { x: point.x, y: point.y } }))
  }, [])

  // The iframe renders the app at its 390px design width; scale it to the phone screen.
  useEffect(() => {
    const el = screen.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => el.style.setProperty('--s', String(entry.contentRect.width / 390)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Scroll-driven stage. Each chapter drifts in parallax while it holds, then a depth push hands over to the next:
  // the current scene moves past the viewer (scale up, blur, fade) while the next rises from the distance.
  useLayoutEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: `.${d.track}`, start: 'top top', end: 'bottom bottom', scrub: 0.6,
          onUpdate: (self) => {
            // Switch the chapter at the middle of each push.
            const t = self.progress * TOTAL
            setActive(Math.min(SCENES.length - 1, Math.max(0, Math.floor((t - HOLD - PUSH / 2) / STEP) + 1)))
          },
        },
      })
      tl.set({}, {}, TOTAL)
      scenes.current.forEach((el, i) => {
        if (!el) return
        const q = gsap.utils.selector(el)
        const first = i === 0
        const last = i === SCENES.length - 1
        const from = first ? 0 : holdAt(i) - PUSH
        const span = (last ? TOTAL : holdAt(i) + HOLD + PUSH) - from
        tl.fromTo(q(`.${d.plate}`), { scale: 1.12 }, { scale: 1, duration: span }, from)
          .fromTo(q(`.${d.headline}`), { yPercent: first ? 0 : 14 }, { yPercent: -18, duration: span }, from)
          .fromTo(q(`.${d.subject}`), { yPercent: 6, scale: 0.97 }, { yPercent: -4, scale: 1.03, duration: span }, from)
          .fromTo(q(`.${d.card}`), { y: 70 }, { y: -40, duration: span, stagger: 0.06 }, from)
          .fromTo(q(`.${d.ledeBlock}, .${d.handoffPanel}`), { y: 30 }, { y: -20, duration: span }, from)
          .fromTo(q(`.${d.fore}`), { yPercent: 0 }, { yPercent: -22, duration: span }, from)
        if (!first) tl.fromTo(el, { scale: 0.78, filter: 'blur(10px)', autoAlpha: 0 }, { scale: 1, filter: 'blur(0px)', autoAlpha: 1, duration: PUSH, ease: 'power2.out' }, holdAt(i) - PUSH)
        if (!last) tl.to(el, { scale: 1.35, filter: 'blur(14px)', autoAlpha: 0, duration: PUSH, ease: 'power1.in' }, holdAt(i) + HOLD - LAG)
      })
      tl.fromTo(`.${d.pathLine}`, { strokeDashoffset: 1 }, { strokeDashoffset: 1 - 1 / 6, duration: HOLD }, 0)
        .to(`.${d.hint}`, { autoAlpha: 0, duration: 0.2 }, 0)
      trigger.current = tl.scrollTrigger ?? null
    }, root)
    return () => { trigger.current = null; ctx.revert() }
  }, [])

  // Phone faces front with a small resting tilt, and follows the pointer by a few degrees.
  useEffect(() => {
    const el = phone.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth - 0.5
        const y = event.clientY / window.innerHeight - 0.5
        el.style.setProperty('--ry', `${-6 + x * 5}deg`)
        el.style.setProperty('--rx', `${4 - y * 4}deg`)
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame) }
  }, [])

  // Chapter index and the CTA jump to a chapter's hold; with reduced motion the sections are plain blocks.
  const goTo = useCallback((i: number) => {
    const st = trigger.current
    if (!st) { scenes.current[i]?.scrollIntoView({ behavior: 'smooth' }); return }
    const at = i === 0 ? 0 : (holdAt(i) + (i === SCENES.length - 1 ? HOLD : 0.2)) / TOTAL
    window.scrollTo({ top: st.start + (st.end - st.start) * at, behavior: 'smooth' })
  }, [])

  const target = link ? `${link.origin}${link.from ?? '/'}` : ''
  const shared = Boolean(link?.from)
  const textProps = { dir: direction, lang: locale }
  const closing = SCENES.length - 1
  const qr = (size: number, label?: string) => target
    ? <QRCodeSVG value={target} size={size} level="M" bgColor="transparent" fgColor="#1b1712" title={label} aria-hidden={label ? undefined : true} />
    : <span className={d.qrPlaceholder} style={{ width: size, height: size }} />

  return (
    <main ref={root} className={`${d.page} ${display.variable}`} data-desktop-showcase dir="ltr">
      <header className={d.nav}>
        <a className={d.brand} href="/desktop" aria-label="RWA.LAT">
          <svg viewBox="140 188 226 124" aria-hidden="true"><path fill="currentColor" d="M150 198h51l27.3 53.1-13.1 24.4c-2.8 5.2-7.2 8.1-12.5 8.1-6.1 0-11.4-3.6-14.3-9.2L150 198Z" /><path fill="currentColor" d="M228.3 251.1l12.4-26.2c2.8-5.9 7.4-9.1 13.1-9.1 6.2 0 10.9 3.5 13.7 9.4L304 302h-51.2l-24.5-50.9Z" /><path fill="#2FE6BF" d="M305.4 198H356l-25.9 51.9h-28.2c-5.3 0-9.5-2.2-12.2-6.3-2.8-4.2-3.1-8.9-.8-13.6l16.5-32Z" /></svg>
          <span>RWA.LAT</span>
        </a>
        <div className={d.navEnd}>
          <label className={d.lang}>
            <span className="sr-only">{c.language}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as AppLocale)}>
              {localeOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
            </select>
          </label>
          <a className={d.cta} href="#handoff" onClick={(event) => { event.preventDefault(); goTo(closing) }} {...textProps}>{c.openOnPhone}</a>
        </div>
      </header>

      <nav className={d.index} aria-label={c.nav} {...textProps}>
        <ol>
          {c.chapters.map((name, i) => (
            <li key={i}>
              <button type="button" aria-current={i === active ? 'step' : undefined} onClick={() => goTo(i)}>
                <span>{pad(i)}</span>{name}
              </button>
            </li>
          ))}
        </ol>
        <span className={d.indexRail} aria-hidden="true"><i style={{ transform: `scaleY(${(active + 1) / SCENES.length})` }} /></span>
      </nav>

      <div className={d.track}>
        <div className={d.stage}>
          {SCENES.map((scene, i) => {
            const copy = i < closing ? c.scenes[i] : null
            const title = copy ? copy.title : shared ? [c.sharedTitle, ''] as const : c.handoffTitle
            const Heading = i === 0 ? 'h1' : 'h2'
            return (
              <section
                key={scene.key}
                ref={(el) => { scenes.current[i] = el }}
                id={i === closing ? 'handoff' : undefined}
                className={d.scene}
                data-scene={scene.key}
                data-tone={scene.tone}
                style={{ zIndex: SCENES.length - i, background: scene.bg }}
                aria-labelledby={`desk-${scene.key}-title`}
              >
                <div className={d.frame}>
                  <img className={d.plate} src={`/media/desktop/${scene.key}-plate.webp`} alt="" draggable={false} decoding="async" fetchPriority={i === 0 ? 'high' : 'low'} />
                  <Heading id={`desk-${scene.key}-title`} className={d.headline} style={{ left: `${scene.head.x}%`, top: `${scene.head.y}%`, maxWidth: `${scene.head.w}cqw` }} {...textProps}>
                    <span className={d.lineLight} style={{ fontSize: lineSize(title[0], scene.head.w) }}>{title[0]}</span>
                    {title[1] ? <span className={d.lineHeavy} style={{ fontSize: lineSize(title[1], scene.head.w - 4.5) }}>{title[1]}</span> : null}
                  </Heading>
                  {scene.subject ? (
                    <img
                      className={d.subject}
                      style={{ left: `${scene.subject.left}%`, top: `${scene.subject.top}%`, width: `${scene.subject.width}%` } as CSSProperties}
                      src={`/media/desktop/${scene.key}-subject.webp`} alt="" draggable={false} decoding="async"
                    />
                  ) : null}
                  {i === 0 ? (
                    <svg className={d.path} viewBox="0 0 100 57.125" aria-hidden="true">
                      <path ref={track} className={d.pathBase} d={PATH} />
                      <path className={d.pathLine} d={PATH} pathLength={1} strokeDasharray="1 1" />
                      {stations.map((point, n) => (
                        <g key={n} className={d.station} data-active={n === 0 ? '' : undefined}>
                          <circle cx={point.x} cy={point.y} r={0.42} />
                          <text x={point.x} y={point.y - 1.1} textAnchor="middle">{pad(n)} {c.chapters[n]}</text>
                        </g>
                      ))}
                    </svg>
                  ) : null}
                  <img className={d.fore} style={{ top: `${scene.fore}%` }} src={`/media/desktop/${scene.key}-fore.webp`} alt="" draggable={false} decoding="async" />
                </div>

                {copy ? (
                  <>
                    <ul className={d.cards} style={{ top: `${scene.cardsTop}vh` }} {...textProps}>
                      {copy.cards.map((card) => <li key={card.label} className={d.card}><span>{card.label}</span><strong dir="auto">{card.value}</strong></li>)}
                    </ul>
                    <div className={d.ledeBlock} {...textProps}>
                      <span className={d.eyebrow}>{pad(i)} · {c.chapters[i]}</span>
                      <p className={d.lede}>{copy.lede}</p>
                    </div>
                  </>
                ) : (
                  <div className={d.handoffPanel} {...textProps}>
                    <figure className={d.qrLarge}>
                      {qr(168, c.scanLabel)}
                    </figure>
                    <div className={d.handoffText}>
                      <span className={d.eyebrow}>{pad(i)} · {c.chapters[i]}</span>
                      <p>{shared ? c.sharedBody : c.handoffBody}</p>
                      <span className={d.scanNote}>{c.scanLabel}</span>
                      {shared ? <code className={d.url} dir="ltr">{target}</code> : null}
                    </div>
                  </div>
                )}
                {i === 0 ? <span className={d.hint} aria-hidden="true" {...textProps}>{c.scroll}</span> : null}
              </section>
            )
          })}
        </div>
      </div>

      <div ref={phone} className={d.phone} role="img" aria-label={c.phoneLabel}>
        <div className={d.phoneBody}>
          <div ref={screen} className={d.screen}>
            {frames.map((src, k) => src ? (
              <iframe
                key={k}
                src={src}
                title={c.phoneLabel}
                tabIndex={-1}
                aria-hidden="true"
                data-front={k === front ? '' : undefined}
                onLoad={() => { if (k !== front && src === wanted.current) setFront(k) }}
              />
            ) : null)}
          </div>
          <span className={d.island} aria-hidden="true" />
        </div>
        <div className={d.qrChip} data-shared={shared ? '' : undefined} data-hidden={active === closing ? '' : undefined} role={shared ? 'status' : undefined}>
          {qr(72)}
          <span {...textProps}>{shared ? <><strong>{c.sharedTitle}</strong>{c.sharedBody}</> : c.scanLabel}</span>
        </div>
      </div>
    </main>
  )
}
