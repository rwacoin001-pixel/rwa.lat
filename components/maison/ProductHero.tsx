'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import ph from './product-hero.module.css'

export { ph as productHero }

/** Topbar props for a page that opens with a ProductHero: the bar floats clear over the picture until content scrolls under it. */
export const heroTopbar = { surface: 'transparent-over-media' as const }

type Props = {
  /** Full-bleed picture; null renders the same frame with a monogram so every detail page keeps one layout. */
  image: string | null
  /** `data-shared` key of the picture: the list card's thumbnail with the same key flies into this frame. */
  imageKey?: string
  focus?: string
  alt?: string
  kicker?: ReactNode
  title: ReactNode
  /** Plain-text title for the monogram fallback and accessible names. */
  titleText: string
  titleKey?: string
  titleLang?: string
  sub?: ReactNode
  badges?: ReactNode
  lede?: ReactNode
  /** Small leading mark beside the kicker (issuer logo for directory assets). */
  logo?: ReactNode
  caption?: ReactNode
  children?: ReactNode
}

/**
 * One header for every product detail (basket, strategy, catalog asset, directory asset):
 * a full-bleed picture under the clear topbar, a soft fade into the page, and the title block rising over its lower edge.
 * Motion: the picture settles from a slight zoom, follows the scroll with parallax and stretches on pull-down;
 * the title block rises in steps. All of it is skipped under reduced motion, and the shared-element flight
 * (lib/market-shared-transition) finishes these entrances before it measures.
 */
export function ProductHero({ image, imageKey, focus, alt = '', kicker, title, titleText, titleKey, titleLang, sub, badges, lede, logo, caption, children }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  useParallax(wrap)
  const initial = (titleText.trim()[0] ?? '·').toUpperCase()
  return <div ref={wrap} className={ph.wrap}>
    <figure className={ph.media} data-shared={imageKey} data-empty={image ? undefined : 'true'}>
      {image
        ? <img className={ph.img} src={image} alt={alt} decoding="async" fetchPriority="high" style={focus ? { objectPosition: focus } as CSSProperties : undefined} />
        : <span className={ph.monogram} aria-hidden="true">{initial}</span>}
      <span className={ph.shade} data-shared-shade="" aria-hidden="true" />
      {caption && <figcaption className={ph.caption}>{caption}</figcaption>}
    </figure>
    <header className={ph.head}>
      {(kicker || logo) && <p className={ph.kicker}>{logo}{kicker}</p>}
      <h1 className={ph.title} lang={titleLang}><span data-shared={titleKey}>{title}</span></h1>
      {sub && <p className={ph.sub} dir="auto">{sub}</p>}
      {badges && <div className={ph.badges}>{badges}</div>}
      {lede && <p className={ph.lede}>{lede}</p>}
      {children}
    </header>
  </div>
}

/** Writes the scroll offset into --ph-y on the hero (rAF-batched); CSS turns it into parallax and pull-down stretch. */
function useParallax(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      // Only while the picture can still be seen; beyond that the value stops changing and nothing repaints.
      if (y > window.innerHeight) return
      node.style.setProperty('--ph-y', String(Math.round(y)))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [ref])
}

/** Wrap the sections that follow the hero: each one rises into place as it scrolls into view (where supported). */
export function DetailFlow({ children }: { children: ReactNode }) {
  return <div className={ph.flow}>{children}</div>
}
