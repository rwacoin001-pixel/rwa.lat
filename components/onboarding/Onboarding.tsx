'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import type { InviteCodeState } from '../screens/InviteCodeField'
import HeroIntro from './HeroIntro'
import { ClearStep, InviteStep } from './GuideSteps'
import { useAppOffer } from './AppOffer'
import styles from './Onboarding.module.css'

/**
 * First-run guide (palette A preview): three pages in one card style, matching the app's product imagery.
 * No top bar and no logo: the card sits at the top; a small page indicator lives in the card's meta row.
 *   1 the four products (HeroIntro: a state card you swipe through)
 *   2 what every product states before you invest (source, fees, risk)
 *   3 invite friends — the invitation code typed here is the one signup uses; the app offer sits under it
 */
const PAGES = 3

export default function Onboarding({ locale, invite, onDone }: {
  locale: AppLocale
  invite: InviteCodeState
  onDone: () => void
}) {
  const copy = paletteAOnboarding(locale)
  const offer = useAppOffer()
  const rtl = locale === 'ar'
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)

  const go = useCallback((next: number) => {
    const target = Math.max(0, Math.min(PAGES - 1, next))
    setPage(current => {
      if (current !== target) { setDir(target > current ? 1 : -1); try { navigator.vibrate?.(8) } catch { /* optional */ } }
      return target
    })
  }, [])

  // A finger still moving from the last gesture must not land on the new page's buttons.
  const shownAt = useRef(0)
  useEffect(() => { shownAt.current = performance.now() }, [page])
  const done = () => { if (performance.now() - shownAt.current > 500) onDone() }

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, textarea')) return
      if (event.key === 'ArrowRight') go(page + (rtl ? -1 : 1))
      if (event.key === 'ArrowLeft') go(page + (rtl ? 1 : -1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [go, page, rtl])

  const pager = <span className={styles.pager} role="tablist">
    {Array.from({ length: PAGES }, (_, index) => <button key={index} type="button" role="tab" aria-selected={index === page} data-done={index < page || undefined}
      aria-label={copy.step.replace('{n}', String(index + 1))} onClick={() => go(index)}><i /></button>)}
  </span>

  return <div className={styles.root} dir={rtl ? 'rtl' : 'ltr'} role="region" aria-roledescription="carousel" aria-label="A-REIT">
    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
      <motion.div key={page} className={styles.page} custom={dir}
        variants={{ enter: (d: number) => ({ opacity: 0, x: d * 40 }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: d * -40 }) }}
        initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
        {page === 0 && <HeroIntro locale={locale} invite={invite} pager={pager} onNext={() => go(1)} />}
        {page === 1 && <ClearStep locale={locale} pager={pager} onNext={() => go(2)} />}
        {page === 2 && <InviteStep locale={locale} invite={invite} offer={offer} pager={pager} onDone={done} />}
      </motion.div>
    </AnimatePresence>
  </div>
}
