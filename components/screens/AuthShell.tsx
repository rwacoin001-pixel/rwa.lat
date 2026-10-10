'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { localeOptions, useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { authVisualCopy } from '@/lib/auth-visual-copy'
import { revealTheme } from '../maison/theme-reveal'
import styles from './P02-Login.module.css'
import RwaLogoMark from '../rwa-logo'

/** Shared A-REIT mark for every authentication surface. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return <RwaLogoMark className={styles.brandMark} width={size * 1.82} height={size} label="" />
}

/** Shared frame for every sign-in surface: the scene film, the wordmark bar, and a centred plaque above the card. */
export function AuthShell({ children, hero, onBrand, footer, topAction, attrs }: {
  children: ReactNode
  hero?: ReactNode
  footer?: ReactNode
  /** A quiet text action at the start of the top bar's end cluster (e.g. browse as a guest). */
  topAction?: ReactNode
  onBrand?: () => void
  attrs?: Record<`data-${string}`, string>
}) {
  const { locale, setLocale, t } = useI18n()
  const { theme, toggleTheme } = useRwaTheme()
  const visual = authVisualCopy[locale]
  const [mediaReady, setMediaReady] = useState(false)
  const [localeOpen, setLocaleOpen] = useState(false)
  const localeWrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMediaReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    if (!localeOpen) return
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !localeWrap.current?.contains(event.target as Node)) setLocaleOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [localeOpen])
  const cool = theme === 'dark'
  const media = cool ? 'cool' : 'warm'
  const poster = attrs?.['data-auth-poster'] === 'true'
  const brand = <><BrandMark size={poster ? 18 : 22} />{!poster && <span>A<i>-</i>REIT</span>}</>
  return <section className={`screen ${styles.root}`} data-auth-theme={media} data-auth-script={/^(zh|hi|ar)/.test(locale) ? 'wide' : 'latin'} dir={locale === 'ar' ? 'rtl' : 'ltr'} {...attrs}>
    <div className={styles.scene} aria-hidden="true">
      {mediaReady && <video key={media} className={styles.sceneVideo} autoPlay muted loop playsInline preload="metadata" poster={`/auth/auth-${media}-still.png`}>
        <source src={`/auth/auth-${media}-loop-h264.mp4`} type="video/mp4" />
      </video>}
    </div>
    <div className={styles.sceneWash} aria-hidden="true" />

    <header className={styles.topbar}>
      {onBrand ? <button type="button" className={styles.brand} aria-label="A-REIT" onClick={onBrand}>{brand}</button>
        : <a href="/login" className={styles.brand} aria-label="A-REIT">{brand}</a>}
      <div className={styles.topActions}>
        {topAction}
        <button type="button" className={styles.iconButton} onClick={(event) => revealTheme(toggleTheme, cool ? 'light' : 'dark', event)} aria-label={visual.switchTheme} title={visual.switchTheme}>{cool ? <Sun size={19} strokeWidth={1.7} /> : <Moon size={18} strokeWidth={1.7} />}</button>
        <div className={styles.localeWrap} ref={localeWrap}>
          <button type="button" className={styles.iconButton} aria-label={t('common.language')} aria-haspopup="menu" aria-expanded={localeOpen} onClick={() => setLocaleOpen(value => !value)}>
            <span className={styles.localeCode}>{locale === 'zh-CN' ? '中' : locale.toUpperCase()}</span>
          </button>
          {localeOpen && <div className={styles.localeMenu} role="menu">
            {localeOptions.map(option => <button key={option.code} type="button" role="menuitemradio" aria-checked={locale === option.code} onClick={() => { setLocale(option.code); setLocaleOpen(false) }}>{option.label}</button>)}
          </div>}
        </div>
      </div>
    </header>

    {hero && <div className={styles.heroCopy}>{hero}</div>}
    <div className={styles.stage}>
      <div className={styles.authSheet}><span className={styles.grain} aria-hidden="true" /><div className={styles.sheetInner}>{children}</div></div>
      {footer && <div className={styles.outerFooter}>{footer}</div>}
    </div>
  </section>
}

/** The serif kicker + two-line plaque used above the card. */
export function AuthHero({ kicker, lines }: { kicker?: string; lines: [string, string] }) {
  return <>
    {kicker && <p className={styles.kicker}><span aria-hidden="true" />{kicker}<span aria-hidden="true" /></p>}
    <h1>{lines[0]} <em>{lines[1]}</em></h1>
  </>
}
