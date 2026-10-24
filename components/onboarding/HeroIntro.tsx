'use client'
import { useEffect, useRef, type CSSProperties } from 'react'
import { ArrowRight, Bot, Building2, Layers3, Sigma } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import styles from './HeroIntro.module.css'

/**
 * Guide page 1, Radium-style sample: a frosted product card with one saturated brand-green field,
 * a rendered ceramic tower (Antigravity) breaking out of the card, blurred foreground objects for depth,
 * a big headline and small factual stats. The scene leans with the finger (and the phone's tilt where allowed);
 * the tower floats on a seamless loop.
 */
const ART = '/media/palette-a/onboard-v3'
const ICONS = [Building2, Layers3, Sigma, Bot]

export default function HeroIntro({ locale, onNext }: { locale: AppLocale; onNext: () => void }) {
  const copy = paletteAOnboarding(locale).s0
  const root = useRef<HTMLElement>(null)

  // Lean: pointer anywhere on the page, or the phone's tilt (Android; iOS needs a permission prompt, so it uses touch).
  useEffect(() => {
    const el = root.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let tx = 0, ty = 0, x = 0, y = 0, frame = 0
    const set = (nx: number, ny: number) => { tx = Math.max(-1, Math.min(1, nx)); ty = Math.max(-1, Math.min(1, ny)) }
    const pointer = (event: PointerEvent) => {
      const box = el.getBoundingClientRect()
      set(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1)
    }
    const tilt = (event: DeviceOrientationEvent) => { if (event.gamma != null && event.beta != null) set(event.gamma / 25, (event.beta - 45) / 25) }
    const loop = () => {
      x += (tx - x) * .08; y += (ty - y) * .08
      el.style.setProperty('--lx', x.toFixed(3)); el.style.setProperty('--ly', y.toFixed(3))
      frame = requestAnimationFrame(loop)
    }
    window.addEventListener('pointermove', pointer, { passive: true })
    window.addEventListener('deviceorientation', tilt, { passive: true })
    frame = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pointermove', pointer); window.removeEventListener('deviceorientation', tilt) }
  }, [])

  return <section ref={root} className={styles.intro}>
    <div className={styles.halo} aria-hidden="true" />
    <img className={`${styles.fx} ${styles.fxBack}`} src={`${ART}/fx-discs.webp`} alt="" aria-hidden="true" />

    <article className={styles.card}>
      <div className={styles.field} aria-hidden="true"><span /><span /></div>
      <div className={styles.meta}><b>A-REIT</b><span>01 <i>/ 04</i></span></div>

      <div className={styles.copy}>
        <h1 className={styles.title}>{copy.title[0]}<em>{copy.title[1]}</em></h1>
        <p className={styles.sub}>{copy.sub}</p>
      </div>

      <ul className={styles.chips}>
        {copy.chips.map((label, index) => { const Icon = ICONS[index]; return <li key={label} style={{ '--i': index } as CSSProperties}><Icon size={14} strokeWidth={2} aria-hidden="true" />{label}</li> })}
      </ul>

      <dl className={styles.stats}>
        {copy.stats.map(([value, label], index) => <div key={label} style={{ '--i': index } as CSSProperties}><dt>{value}</dt><dd>{label}</dd></div>)}
      </dl>
    </article>

    {/* The hero breaks out of the card's top edge; its shadow sits on the card. */}
    <div className={styles.hero} aria-hidden="true">
      <i className={styles.heroShadow} />
      <img src={`${ART}/hero-tower.webp`} alt="" />
    </div>
    <img className={`${styles.fx} ${styles.fxSphere}`} src={`${ART}/fx-sphere.webp`} alt="" aria-hidden="true" />
    <img className={`${styles.fx} ${styles.fxCapsule}`} src={`${ART}/fx-capsule.webp`} alt="" aria-hidden="true" />

    <button type="button" className={styles.cta} onClick={onNext}><span>{copy.cta}</span><span className={styles.ctaIcon}><ArrowRight size={18} strokeWidth={2} /></span></button>
  </section>
}
