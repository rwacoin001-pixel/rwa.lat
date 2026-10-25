'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Moon, Sun, Wifi } from 'lucide-react'
import { localeOptions, useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { authVisualCopy } from '@/lib/auth-visual-copy'
import { revealTheme } from '../maison/theme-reveal'
import styles from './P02-Login.module.css'
import { AndroidAppBanner } from '@/components/android-app-banner'
import RwaLogoMark from '../rwa-logo'
import { usePaletteA } from '@/lib/palette-preview'

/** Shared A-REIT mark for every authentication surface. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return <RwaLogoMark className={styles.brandMark} width={size * 1.82} height={size} label="" />
}

/** Shared frame for every sign-in surface: the scene film, the wordmark bar, and a centred plaque above the card. */
export function AuthShell({ children, hero, footer, attrs }: {
  children: ReactNode
  hero?: ReactNode
  footer?: ReactNode
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
  const paletteA = usePaletteA()
  const cabinet = poster && paletteA
  const brand = <><BrandMark size={poster ? 18 : 22} />{!poster && <span>A<i>-</i>REIT</span>}</>
  return <section className={`screen ${styles.root}`} data-auth-cabinet={cabinet || undefined} data-auth-theme={media} data-auth-script={/^(zh|hi|ar)/.test(locale) ? 'wide' : 'latin'} dir={locale === 'ar' ? 'rtl' : 'ltr'} {...attrs}>
    <div className={styles.scene} aria-hidden="true">
      {mediaReady && <video key={media} className={styles.sceneVideo} autoPlay muted loop playsInline preload="metadata" poster={`/auth/auth-${media}-still.png`}>
        <source src={`/auth/auth-${media}-loop-h264.mp4`} type="video/mp4" />
      </video>}
    </div>
    <div className={styles.sceneWash} aria-hidden="true" />
    {/* Palette A sign-in: a cabinet in the studio (day / night with the theme). Its side holds our products in
        miniature; its front face is the phone, with a live status bar, the mark, an avatar and the real form. */}
    {cabinet && <img className={styles.cabPhoto} src={`/media/palette-a/login/cabinet-${cool ? 'night' : 'day'}.webp`} alt="" aria-hidden="true" draggable={false} />}

    <header className={styles.topbar}>
      <a href="/login" className={styles.brand} aria-label="A-REIT">{brand}</a>
      <div className={styles.topActions}>
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

    <AndroidAppBanner />
    {cabinet ? <>
      {/* The cabinet's face is the phone, showing the Koala Quant page as the cover (printed, not live). */}
      <div className={styles.cabFace} aria-hidden="true">
        <div className={styles.cabStatus}><b><Clock /></b><span><i className={styles.cabSig}><i /><i /><i /><i /></i><Wifi size={11} strokeWidth={2.2} /><i className={styles.cabBatt}><i /></i></span></div>
        <div className={styles.cabHead}><RwaLogoMark width={26} height={15} label="" /><b>A-REIT</b><i className={styles.cabAvatar}><img src="/media/palette-a/avatars/a00.svg" alt="" draggable={false} /></i></div>
        <img className={styles.cabDial} src="/media/palette-a/login/quant-dial.webp" alt="" draggable={false} />
        <div className={styles.cabSeg}><b>{locale === 'zh-CN' ? '总览' : 'Overview'}</b><span>{locale === 'zh-CN' ? '我的' : 'Mine'}</span></div>
        <svg className={styles.cabChart} viewBox="0 0 200 60" preserveAspectRatio="none"><defs><linearGradient id="cabFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#0a8a73" stopOpacity=".28" /><stop offset="1" stopColor="#0a8a73" stopOpacity="0" /></linearGradient></defs>
          <path d="M0 52 C20 44 34 47 50 43 S78 30 96 33 S120 34 136 24 S172 12 200 4 V60 H0 Z" fill="url(#cabFill)" /><path d="M0 52 C20 44 34 47 50 43 S78 30 96 33 S120 34 136 24 S172 12 200 4" fill="none" stroke="#0a8a73" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
        <div className={styles.cabBuy}><b>{locale === 'zh-CN' ? '申购' : 'Subscribe'}</b><i>→</i></div>
      </div>
      <div className={styles.stage}>
        {hero && <div className={styles.heroCopy}>{hero}</div>}
        <div className={styles.cabBody}>{children}</div>
        {footer && <div className={styles.cabFoot}>{footer}</div>}
      </div>
    </> : <>
      {hero && <div className={styles.heroCopy}>{hero}</div>}
      <div className={styles.stage}>
        <div className={styles.authSheet}><span className={styles.grain} aria-hidden="true" /><div className={styles.sheetInner}>{children}</div></div>
        {footer && <div className={styles.outerFooter}>{footer}</div>}
      </div>
    </>}
  </section>
}

/** The time on the cabinet's phone face: the device's own clock. */
function Clock() {
  const format = () => new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: false })
  const [now, setNow] = useState('')
  useEffect(() => { setNow(format()); const timer = setInterval(() => setNow(format()), 15000); return () => clearInterval(timer) }, [])
  return <>{now || '\u00a0'}</>
}

/** The serif kicker + two-line plaque used above the card. */
export function AuthHero({ kicker, lines }: { kicker?: string; lines: [string, string] }) {
  return <>
    {kicker && <p className={styles.kicker}><span aria-hidden="true" />{kicker}<span aria-hidden="true" /></p>}
    <h1>{lines[0]} <em>{lines[1]}</em></h1>
  </>
}
