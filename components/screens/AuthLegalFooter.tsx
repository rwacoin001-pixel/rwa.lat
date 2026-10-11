'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { authLegalCopy, type AuthLegalKind } from '@/lib/auth-legal-copy'
import styles from './P02-Login.module.css'

type LicenceDetails = {
  entity: string
  regulator: string
  type: string
  number: string
  url: string
}

const readLicenceDetails = (): LicenceDetails | null => {
  const entity = process.env.NEXT_PUBLIC_AUTH_LICENSE_ENTITY?.trim()
  const regulator = process.env.NEXT_PUBLIC_AUTH_LICENSE_REGULATOR?.trim()
  const type = process.env.NEXT_PUBLIC_AUTH_LICENSE_TYPE?.trim()
  const number = process.env.NEXT_PUBLIC_AUTH_LICENSE_NUMBER?.trim()
  const rawUrl = process.env.NEXT_PUBLIC_AUTH_LICENSE_URL?.trim()
  if (!entity || !regulator || !type || !number || !rawUrl) return null

  try {
    const url = new URL(rawUrl)
    const officialMasHost = url.hostname === 'mas.gov.sg' || url.hostname.endsWith('.mas.gov.sg')
    if (url.protocol !== 'https:' || !officialMasHost || url.username || url.password) return null
    return { entity, regulator, type, number, url: url.toString() }
  } catch {
    return null
  }
}

function AuthLegalDialog({
  kind,
  close,
  termsHref,
  privacyHref,
  termsVersion,
  privacyVersion,
  licence,
}: {
  kind: AuthLegalKind
  close: () => void
  termsHref: string
  privacyHref: string
  termsVersion?: string
  privacyVersion?: string
  licence: LicenceDetails | null
}) {
  const { locale } = useI18n()
  const { theme } = useRwaTheme()
  const copy = authLegalCopy[locale]
  const id = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      restoreFocusRef.current?.focus()
    }
  }, [])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable?.length) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const title = kind === 'terms' ? copy.termsTitle : kind === 'privacy' ? copy.privacyTitle : copy.licence
  const version = kind === 'terms' ? termsVersion : kind === 'privacy' ? privacyVersion : undefined
  const docHref = kind === 'terms' ? termsHref : privacyHref
  const summary = kind === 'terms' ? copy.terms : kind === 'privacy' ? copy.privacy : undefined

  return createPortal(
    <div className={styles.legalOverlay} data-auth-theme={theme === 'dark' ? 'cool' : 'warm'}>
      <button type="button" className={styles.legalBackdrop} onClick={close} aria-label={copy.close} tabIndex={-1} />
      <div
        ref={dialogRef}
        className={styles.legalSheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-lede`}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <span className={styles.legalHandle} aria-hidden="true" />
        <header className={styles.legalHeader}>
          <div>
            <h2 id={`${id}-title`} className={styles.legalTitle}>{title}</h2>
            <p id={`${id}-lede`} className={styles.legalLede}>{summary?.lede ?? copy.licenceSheet.lede}</p>
          </div>
          <button ref={closeRef} type="button" className={styles.legalClose} onClick={close} aria-label={copy.close}>
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </header>

        {summary && <>
          <p className={styles.legalMeta}>{copy.updated} {copy.updatedDate}{version ? ` · v${version}` : ''}</p>
          <ul className={styles.legalList}>
            {summary.points.map(point => <li key={point}>{point}</li>)}
          </ul>
          <a className={styles.legalAction} href={docHref} target="_blank" rel="noopener noreferrer">
            <span>{copy.readFull}</span><span aria-hidden="true">↗</span>
          </a>
        </>}

        {kind === 'licence' && licence && <>
          <dl className={styles.legalDetails}>
            <div><dt>{copy.licenceSheet.entity}</dt><dd>{licence.entity}</dd></div>
            <div><dt>{copy.licenceSheet.regulator}</dt><dd>{licence.regulator}</dd></div>
            <div><dt>{copy.licenceSheet.type}</dt><dd>{licence.type}</dd></div>
            <div><dt>{copy.licenceSheet.number}</dt><dd dir="ltr">{licence.number}</dd></div>
          </dl>
          <a className={styles.legalAction} href={licence.url} target="_blank" rel="noopener noreferrer" aria-label={`${copy.verify}. ${copy.opensIn}`}>
            <span>{copy.verify}</span><span aria-hidden="true">↗</span>
          </a>
          <p className={styles.legalMeta}>{copy.opensIn} {new URL(licence.url).hostname}</p>
        </>}
      </div>
    </div>,
    document.body,
  )
}

export function AuthLegalFooter({
  termsHref,
  privacyHref,
  termsVersion,
  privacyVersion,
}: {
  termsHref: string
  privacyHref: string
  termsVersion?: string
  privacyVersion?: string
}) {
  const { locale } = useI18n()
  const copy = authLegalCopy[locale]
  const [openKind, setOpenKind] = useState<AuthLegalKind | null>(null)
  const licence = readLicenceDetails()
  const button = (kind: AuthLegalKind, label: string) => (
    <button key={kind} type="button" aria-haspopup="dialog" aria-expanded={openKind === kind} onClick={() => setOpenKind(kind)}>
      {label}
    </button>
  )

  return <>
    {button('terms', copy.termsTitle)}
    <span aria-hidden="true">·</span>
    {button('privacy', copy.privacyTitle)}
    {licence && <><span aria-hidden="true">·</span>{button('licence', copy.licence)}</>}
    {openKind && <AuthLegalDialog
      kind={openKind}
      close={() => setOpenKind(null)}
      termsHref={termsHref}
      privacyHref={privacyHref}
      termsVersion={termsVersion}
      privacyVersion={privacyVersion}
      licence={licence}
    />}
  </>
}
