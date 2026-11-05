'use client'

import { useEffect, useState } from 'react'
import { BRAND } from '@/lib/brand/build-brand'
import { Download } from 'lucide-react'
import { ANDROID_APP, ANDROID_APP_UA } from '@/lib/android-app'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { showToast } from '@/lib/toast-store'
import { detectEnv, isStandalone, needsAndroidApp, type InstallEnv } from './install-env'
import { InstallSheet, installCopy, canPromptInstall } from './HomeInstall'
import styles from './HomeGetApp.module.css'

type Copy = { get: string; started: string; inApp: string }
const COPY: Partial<Record<AppLocale, Copy>> & { en: Copy } = {
  en: { get: 'Get app', started: 'Downloading — open the file when it finishes to install', inApp: 'Tap ··· at the top right, choose “Open in browser”, then download the app' },
  'zh-CN': { get: '下载 App', started: '开始下载，下载完成后点开文件安装', inApp: '点右上角 ··· 选择「在浏览器打开」，再下载 App' },
}

/**
 * The only install entry on the signed-in home: a small porcelain pill in the top bar.
 * Android browsers download the app; WeChat and other in-app browsers are told to open a real browser first.
 * Hidden inside the app, in an installed web app, on iPhone (the install gate already requires the home-screen app)
 * and on desktop.
 */
export function HomeGetApp() {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en
  const [kind, setKind] = useState<'apk' | 'browser' | 'ios' | null>(null)
  const [installEnv, setInstallEnv] = useState<InstallEnv | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (isStandalone() || navigator.userAgent.includes(ANDROID_APP_UA)) return
    const env = detectEnv()
    if (BRAND.id === 'kimeng' && env.ios) { setInstallEnv(env); setKind('ios'); return }
    if (!/Android/.test(navigator.userAgent)) return
    if (env.kind === 'wechat-android' || env.kind === 'inapp') setKind('browser')
    else if (needsAndroidApp(env.kind) && ANDROID_APP.url) setKind('apk')
  }, [])
  if (!kind) return null
  const face = <><Download size={14} strokeWidth={2} aria-hidden="true" />{c.get}</>
  if (kind === 'ios' && installEnv) return <>
    <button type="button" className={styles.pill} onClick={() => setOpen(true)} aria-haspopup="dialog">{face}</button>
    <InstallSheet open={open} env={installEnv} canPrompt={canPromptInstall()} copy={installCopy[locale]} onClose={() => setOpen(false)} />
  </>
  return kind === 'apk'
    ? <a className={styles.pill} href={ANDROID_APP.url!} download onClick={() => { navigator.vibrate?.(6); showToast(c.started, 'ok') }}>{face}</a>
    : <button type="button" className={styles.pill} onClick={() => showToast(c.inApp, 'info')}>{face}</button>
}
