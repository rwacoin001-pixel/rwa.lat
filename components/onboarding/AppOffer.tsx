'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Download, ExternalLink, MoreHorizontal, PlusSquare } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { ANDROID_APP, ANDROID_APP_UA, chromeIntentUrl } from '@/lib/android-app'
import { detectEnv, isStandalone, needsAndroidApp } from '@/components/home/install-env'
import { canPromptInstall, onInstallPromptChange, promptInstall } from '@/components/home/HomeInstall'
import type { InviteCodeState } from '../screens/InviteCodeField'
import styles from './AppOffer.module.css'

/**
 * The guide's app offer (palette A). Which one depends on where the page is open:
 *   apk      Android browsers that cannot install the web app (Xiaomi, Huawei, others) → download the Android app
 *   pwa      Android Chrome with an install prompt → add A-REIT to the home screen
 *   browser  WeChat / in-app browsers on Android → open in a real browser first (APK downloads are blocked there)
 *   null     iPhone (its own gate), installed web app, inside the Android app, desktop → nothing
 * Downloading the app copies the invitation code, because the app cannot read what this browser remembered.
 */
export type OfferKind = 'apk' | 'pwa' | 'browser'

export function useAppOffer(): OfferKind | null {
  const [kind, setKind] = useState<OfferKind | null>(null)
  useEffect(() => {
    // Preview on any device with ?offer=apk|pwa|browser.
    const forced = new URLSearchParams(location.search).get('offer')
    if (forced === 'apk' || forced === 'pwa' || forced === 'browser') { setKind(forced); return }
    if (isStandalone() || navigator.userAgent.includes(ANDROID_APP_UA)) return
    const env = detectEnv()
    if (env.ios || !/Android/.test(navigator.userAgent)) return
    if (env.kind === 'wechat-android' || env.kind === 'inapp') setKind('browser')
    else if (needsAndroidApp(env.kind) && ANDROID_APP.url) setKind('apk')
    else if (env.kind === 'android-chrome' && canPromptInstall()) setKind('pwa')
  }, [])
  return kind
}

const COPY: Partial<Record<AppLocale, Record<OfferKind, { title: string; line: string; action: string }> & { copied: string; chrome: string }>> = {
  'zh-CN': {
    apk: { title: 'A-REIT 安卓 App', line: '比浏览器更流畅，消息不错过', action: '下载' },
    pwa: { title: '添加到主屏幕', line: '像 App 一样一键打开，全屏使用', action: '添加' },
    browser: { title: '请在浏览器中打开', line: '点右上角 ··· 选择「在浏览器打开」，再下载 App', action: '知道了' },
    copied: '邀请码 {code} 已复制，在 App 里粘贴即可', chrome: '用 Chrome 打开',
  },
  en: {
    apk: { title: 'A-REIT for Android', line: 'Smoother than the browser, never miss a message', action: 'Get' },
    pwa: { title: 'Add to home screen', line: 'Opens like an app, full screen', action: 'Add' },
    browser: { title: 'Open in your browser', line: 'Tap ··· at the top right, then “Open in browser”', action: 'OK' },
    copied: 'Invitation code {code} copied, paste it in the app', chrome: 'Open in Chrome',
  },
}

const inviteCode = (invite?: InviteCodeState) =>
  invite?.locked?.attribution.code?.toUpperCase() || (invite && /^[A-Z0-9]{4,}$/.test(invite.value) ? invite.value : '')

/** A compact strip (page 1) or a fuller row (last page). */
export function AppOffer({ kind, locale, invite, size = 'strip' }: { kind: OfferKind; locale: AppLocale; invite?: InviteCodeState; size?: 'strip' | 'row' }) {
  const copy = COPY[locale] ?? COPY.en!
  const text = copy[kind]
  const [toast, setToast] = useState('')
  const [done, setDone] = useState(false)
  const flash = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3200) }

  const onDownload = async () => {
    const code = inviteCode(invite)
    if (!code) return
    try { await navigator.clipboard.writeText(code); flash(copy.copied.replace('{code}', code)) } catch { flash(copy.copied.replace('{code}', code)) }
  }
  const onAdd = async () => { if (await promptInstall()) setDone(true) }
  const Icon = kind === 'apk' ? Download : kind === 'pwa' ? PlusSquare : MoreHorizontal

  return <div className={styles.offer} data-size={size} data-kind={kind}>
    <img className={styles.icon} src="/icons/a-reit-v1-192.png" alt="" width={40} height={40} />
    <div className={styles.text}><b>{text.title}</b><small>{text.line}</small>
      {kind === 'apk' && size === 'row' && <a className={styles.alt} href={chromeIntentUrl(location.href, new URL(ANDROID_APP.url!, location.href).href)}><ExternalLink size={12} strokeWidth={1.6} aria-hidden="true" />{copy.chrome}</a>}
    </div>
    {kind === 'apk' && <a className={styles.get} href={ANDROID_APP.url!} download onClick={() => { void onDownload() }}><Icon size={15} strokeWidth={1.6} aria-hidden="true" />{text.action}</a>}
    {kind === 'pwa' && <button type="button" className={styles.get} onClick={() => { void onAdd() }} disabled={done}>{done ? <Check size={15} strokeWidth={1.8} aria-hidden="true" /> : <Icon size={15} strokeWidth={1.6} aria-hidden="true" />}{text.action}</button>}
    {kind === 'browser' && <span className={styles.hint} aria-hidden="true"><Icon size={18} strokeWidth={1.6} /></span>}
    <AnimatePresence>{toast && <motion.p className={styles.toast} role="status" initial={{ opacity: 0, y: 8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}>{toast}</motion.p>}</AnimatePresence>
  </div>
}

/**
 * The one install action next to Sign in on the guide's last page:
 * - Android Chrome with an install prompt ready: install to the home screen (the prompt opens on tap);
 * - other Android browsers (or Chrome without a prompt): download the app;
 * - WeChat / in-app browsers on Android: open in the browser first;
 * - iPhone, the installed app, desktop: none.
 * Preview with ?offer=pwa | apk | browser.
 */
export function useInstallAction(): OfferKind | null {
  const [kind, setKind] = useState<OfferKind | null>(null)
  useEffect(() => {
    const forced = new URLSearchParams(location.search).get('offer')
    if (forced === 'apk' || forced === 'pwa' || forced === 'browser') { setKind(forced); return }
    if (isStandalone() || navigator.userAgent.includes(ANDROID_APP_UA)) return
    const env = detectEnv()
    if (env.ios || !/Android/.test(navigator.userAgent)) return
    if (env.kind === 'wechat-android' || env.kind === 'inapp') { setKind('browser'); return }
    const pick = () => setKind(env.kind === 'android-chrome' && canPromptInstall() ? 'pwa' : ANDROID_APP.url ? 'apk' : null)
    pick()
    return onInstallPromptChange(pick)
  }, [])
  return kind
}

const ACTION: Partial<Record<AppLocale, { apk: string; pwa: string; browser: string; added: string; tip: string }>> = {
  'zh-CN': { apk: '下载 App', pwa: '安装到桌面', browser: '浏览器打开', added: '已安装', tip: '点右上角 ··· 选择「在浏览器打开」' },
  en: { apk: 'Get app', pwa: 'Install', browser: 'Open in browser', added: 'Installed', tip: 'Tap ··· at the top right, then “Open in browser”' },
}

/** The install button in the bottom row: a glass pill beside the main action. A Download pill gets a light sweep. */
export function InstallButton({ kind, locale, invite }: { kind: OfferKind; locale: AppLocale; invite?: InviteCodeState }) {
  const copy = COPY[locale] ?? COPY.en!
  const a = ACTION[locale] ?? ACTION.en!
  const [toast, setToast] = useState('')
  const [added, setAdded] = useState(false)
  const flash = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3600) }
  const onDownload = async () => {
    const code = inviteCode(invite)
    if (!code) return
    try { await navigator.clipboard.writeText(code) } catch { /* the toast still shows the code */ }
    flash(copy.copied.replace('{code}', code))
  }
  const toastNode = <AnimatePresence>{toast && <motion.p className={styles.toast} role="status" initial={{ opacity: 0, y: 8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}>{toast}</motion.p>}</AnimatePresence>
  if (kind === 'apk') return <a className={styles.pill} data-glow="" href={ANDROID_APP.url!} download onClick={() => { void onDownload() }}>
    <Download size={17} strokeWidth={1.6} aria-hidden="true" /><span>{a.apk}</span>{toastNode}
  </a>
  if (kind === 'pwa') return <button type="button" className={styles.pill} disabled={added} onClick={() => { void promptInstall().then(ok => { if (ok) setAdded(true) }) }}>
    {added ? <Check size={17} strokeWidth={1.8} aria-hidden="true" /> : <PlusSquare size={17} strokeWidth={1.6} aria-hidden="true" />}<span>{added ? a.added : a.pwa}</span>{toastNode}
  </button>
  return <button type="button" className={styles.pill} onClick={() => flash(a.tip)}>
    <ExternalLink size={17} strokeWidth={1.6} aria-hidden="true" /><span>{a.browser}</span>{toastNode}
  </button>
}
