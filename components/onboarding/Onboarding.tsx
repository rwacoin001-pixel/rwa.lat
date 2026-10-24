'use client'
import { useEffect, useRef } from 'react'
import type { AppLocale } from '@/lib/i18n'
import type { InviteCodeState } from '../screens/InviteCodeField'
import GuideCarousel from './GuideCarousel'
import styles from './Onboarding.module.css'

/**
 * First-run guide (palette A preview): one page of colour cards (GuideCarousel) and one bar into sign in / sign up.
 * The invitation code typed here is the one signup uses.
 */
export default function Onboarding({ locale, invite, onDone }: {
  locale: AppLocale
  invite: InviteCodeState
  onDone: () => void
}) {
  // A finger still moving from the page opening must not land on the button.
  const shownAt = useRef(0)
  useEffect(() => { shownAt.current = performance.now() }, [])
  const done = () => { if (performance.now() - shownAt.current > 500) onDone() }
  return <div className={styles.root} dir={locale === 'ar' ? 'rtl' : 'ltr'} role="region" aria-label="A-REIT">
    <div className={styles.page}><GuideCarousel locale={locale} invite={invite} onDone={done} /></div>
  </div>
}
