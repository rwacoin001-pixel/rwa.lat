'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { ANDROID_APP, ANDROID_APP_UA, APP_OFFER, chromeIntentUrl } from '@/lib/android-app'
import { detectEnv, isStandalone, needsAndroidApp } from '@/components/home/install-env'
import styles from './android-app-banner.module.css'

const CLOSED_KEY = 'rwa.android-app-banner.closed'

/**
 * Sign-in is the first screen a signed-out visitor sees (home requires an account), so the Android-app offer has to
 * live here too, not only in Home's install sheet. Shown only in Android browsers that cannot install the web app
 * (needsAndroidApp), never inside the Android client or an installed web app; closing it lasts for the session.
 */
export function AndroidAppBanner() {
  const { locale } = useI18n()
  const [show, setShow] = useState(false)
  const [chromeHref, setChromeHref] = useState('')
  useEffect(() => {
    if (!ANDROID_APP.url) return
    let closed = false
    try { closed = sessionStorage.getItem(CLOSED_KEY) === '1' } catch { /* storage blocked: show it */ }
    if (closed || isStandalone() || navigator.userAgent.includes(ANDROID_APP_UA) || !needsAndroidApp(detectEnv().kind)) return
    setChromeHref(chromeIntentUrl(location.href, new URL(ANDROID_APP.url, location.href).href))
    setShow(true)
  }, [])
  if (!show || !ANDROID_APP.url) return null
  const copy = APP_OFFER[locale] ?? APP_OFFER.en
  const close = () => {
    try { sessionStorage.setItem(CLOSED_KEY, '1') } catch { /* closes for this page only */ }
    setShow(false)
  }
  return <aside className={styles.banner} aria-label={copy.title}>
    <img className={styles.icon} src="/icons/a-reit-v1-192.png" alt="" width={40} height={40} />
    <div className={styles.text}>
      <b>{copy.title}</b>
      <small><a href={chromeHref}>{copy.chrome}</a></small>
    </div>
    <a className={styles.get} href={ANDROID_APP.url} download><Download size={15} strokeWidth={1.9} aria-hidden="true" />{copy.get}</a>
    <button type="button" className={styles.close} onClick={close} aria-label={copy.close}><X size={15} strokeWidth={1.8} /></button>
  </aside>
}
