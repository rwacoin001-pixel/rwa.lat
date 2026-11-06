'use client'

import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { GeistSans } from 'geist/font/sans'
import { ArrowRight, ArrowUpRight, ChevronDown, Globe2, Moon, Sun } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { localeOptions } from '@/lib/app-locales'
import { isAppLocale } from '@/lib/locale-detection'
import { useRwaTheme } from '@/lib/rwa-theme'
import { BRAND } from '@/lib/brand/build-brand'
import { currentInvite, displayInviteCode, type InviteAttribution } from '@/lib/referral-invite'
import { kimengInviteCopy } from '@/lib/kimeng-invite-copy'
import styles from './kimeng-invite-landing.module.css'

export default function KimengInviteLanding() {
  const { locale, direction, setLocale } = useI18n()
  const { theme, toggleTheme } = useRwaTheme()
  const c = kimengInviteCopy[locale]
  const [invite, setInvite] = useState<InviteAttribution | null>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.dataset.kimengInvite
    const shell = document.querySelector<HTMLElement>('.rwa-shell')
    const previousInert = shell?.inert ?? false
    const skipLink = document.querySelector<HTMLAnchorElement>('.skip-link')
    const previousHref = skipLink?.getAttribute('href')
    root.dataset.kimengInvite = 'true'
    if (shell) shell.inert = true
    if (skipLink) skipLink.setAttribute('href', '#kimeng-invite-main')
    return () => {
      if (shell) shell.inert = previousInert
      if (skipLink && previousHref !== null && previousHref !== undefined) skipLink.setAttribute('href', previousHref)
      if (previous === undefined) delete root.dataset.kimengInvite
      else root.dataset.kimengInvite = previous
    }
  }, [])
  useEffect(() => {
    let active = true
    void currentInvite().then(value => { if (active) setInvite(value) })
    return () => { active = false }
  }, [])

  const changeLanguage = (value: string) => {
    if (!isAppLocale(value)) return
    setLocale(value)
  }
  const language = localeOptions.find(item => item.code === locale)?.label
  const logoStyle = { '--invite-logo': `url("${BRAND.assets}/mark-dark.svg")` } as CSSProperties
  const content = <main id="kimeng-invite-main" tabIndex={-1} className={`${styles.root} ${GeistSans.variable}`} data-kimeng-invitation data-theme={theme} lang={locale} dir={direction} aria-labelledby="invitation-title">
    <div className={styles.texture} aria-hidden="true" />
    <header className={styles.header}>
      <span className={styles.wordmark} dir="ltr">KIMENG</span>
      <div className={styles.controls}>
        <button className={styles.theme} type="button" aria-label={c.theme} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
        </button>
        <label className={styles.language}>
          <Globe2 size={16} strokeWidth={1.5} aria-hidden="true" />
          <span aria-hidden="true">{language}</span><ChevronDown size={12} aria-hidden="true" />
          <select aria-label={c.language} value={locale} onChange={event => changeLanguage(event.target.value)}>
            {localeOptions.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
      </div>
    </header>

    <div className={styles.invitation}>
      <div className={styles.art} aria-hidden="true" style={logoStyle}>
        <div className={styles.halo} />
        <div className={styles.emblem}>
          {[0, 1, 2, 3, 4].map(layer => <span key={layer} className={styles.edge} style={{ transform: `translateZ(${layer * 1.2}px)` }} />)}
          <span className={styles.face} />
          <span className={styles.sheen}><i /></span>
        </div>
        <span className={styles.shadow} />
        <span className={styles.signature} dir="ltr">KIMENG</span>
      </div>

      <div className={styles.message}>
        <p className={styles.eyebrow}>{c.invitation}</p>
        <h1 id="invitation-title" className={styles.headline}>{c.headline.map(line => <span key={line}>{line}</span>)}</h1>
        <p className={styles.intro}>{c.welcome}</p>
        <div className={styles.attribution} aria-live="polite">
          {invite && <><div className={styles.code}><span>{c.code}</span><bdi>{displayInviteCode(invite.code)}</bdi></div><p>{c.saved}</p></>}
        </div>
        <div className={styles.actions}>
          <a className={styles.primary} href={`/register?lang=${locale}`}><span>{c.accept}</span><span className={styles.arrow}><ArrowRight size={19} strokeWidth={1.6} aria-hidden="true" /></span></a>
          <a className={styles.secondary} href={`/login?lang=${locale}`}>{c.login}<ArrowUpRight size={15} strokeWidth={1.5} aria-hidden="true" /></a>
        </div>
      </div>
    </div>

    <footer className={styles.footer}>
      <p className={styles.risk}>{c.risk}</p>
      <nav aria-label={c.terms + ' / ' + c.privacy}><a href={`/terms?lang=${locale}`}>{c.terms}</a><span aria-hidden="true">·</span><a href={`/privacy?lang=${locale}`}>{c.privacy}</a></nav>
    </footer>
  </main>

  return typeof document === 'undefined' ? null : createPortal(content, document.body)
}
