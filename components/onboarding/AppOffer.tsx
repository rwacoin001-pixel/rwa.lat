'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Compass, Download, ExternalLink, MoreHorizontal, PlusSquare, Share } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { ANDROID_APP, ANDROID_APP_UA, chromeIntentUrl } from '@/lib/android-app'
import { detectEnv, isStandalone, needsAndroidApp } from '@/components/home/install-env'
import { canPromptInstall, promptInstall } from '@/components/home/HomeInstall'
import type { InviteCodeState } from '../screens/InviteCodeField'
import controls from '../ui/controls.module.css'
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
/** The guide's bottom bar also shares the link on iPhone. */
export type InstallKind = OfferKind | 'share'

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
 * - Android Chrome: install to the home screen (Chrome's prompt opens on tap; if Chrome has none ready, the tap
 *   shows the menu route);
 * - other Android browsers: download the app;
 * - WeChat / in-app browsers on Android: open in the browser first;
 * - iPhone (in Safari, not the installed app): share the link (with the invitation);
 * - the installed app, desktop: none.
 * Preview with ?offer=pwa | apk | browser | share.
 */
export function useInstallAction(): InstallKind | null {
  const [kind, setKind] = useState<InstallKind | null>(null)
  useEffect(() => {
    const forced = new URLSearchParams(location.search).get('offer')
    if (forced === 'apk' || forced === 'pwa' || forced === 'browser' || forced === 'share') { setKind(forced); return }
    if (isStandalone() || navigator.userAgent.includes(ANDROID_APP_UA)) return
    const env = detectEnv()
    if (env.ios) { setKind('share'); return }
    if (!/Android/.test(navigator.userAgent)) return
    if (env.kind === 'wechat-android' || env.kind === 'inapp') { setKind('browser'); return }
    if (ANDROID_APP.url) setKind('apk')
  }, [])
  return kind
}

const ACTION: Partial<Record<AppLocale, { apk: string; pwa: string; browser: string; share: string; shared: string; added: string; tip: string; menu: string }>> = {
  'zh-CN': { apk: '下载 App', pwa: '安装到桌面', browser: '浏览器打开', share: '分享', shared: '链接已复制', added: '已安装', tip: '点右上角 ··· 选择「在浏览器打开」', menu: '点右上角 ⋮，选择「添加到主屏幕」或「安装应用」' },
  en: { apk: 'Get app', pwa: 'Install', browser: 'Open in browser', share: 'Share', shared: 'Link copied', added: 'Installed', tip: 'Tap ··· at the top right, then “Open in browser”', menu: 'Tap ⋮ at the top right, then “Install app” or “Add to Home screen”' },
}

/**
 * The round glass button beside Sign in: one icon, no words (its name is read out). The tip it raises floats above
 * it. A Download disc gets a slow light sweep so it is not missed.
 */
export function InstallButton({ kind, locale, invite }: { kind: InstallKind; locale: AppLocale; invite?: InviteCodeState }) {
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
  const onShare = async () => {
    const code = inviteCode(invite)
    const url = code ? `${location.origin}/r/${code}` : location.origin
    if (navigator.share) { try { await navigator.share({ title: 'A-REIT', url }) } catch { /* closed */ } return }
    try { await navigator.clipboard.writeText(url) } catch { /* nothing to copy into */ }
    flash(a.shared)
  }
  const label = kind === 'pwa' ? (added ? a.added : a.pwa) : a[kind]
  const icon = kind === 'share' ? <Share size={21} strokeWidth={1.7} aria-hidden="true" />
    : kind === 'browser' ? <Compass size={21} strokeWidth={1.7} aria-hidden="true" />
    : added ? <Check size={21} strokeWidth={1.9} aria-hidden="true" /> : <Download size={21} strokeWidth={1.7} aria-hidden="true" />
  const onClick = () => {
    if (kind === 'share') { void onShare(); return }
    if (kind === 'browser') { flash(a.tip); return }
    if (kind === 'pwa') { if (!canPromptInstall()) { flash(a.menu); return } void promptInstall().then(ok => { if (ok) setAdded(true) }) }
  }
  return <span className={styles.discWrap}>
    {kind === 'apk'
      ? <a className={`${controls.icon} ${styles.glow}`} href={ANDROID_APP.url!} download aria-label={label} title={label} onClick={() => { void onDownload() }}>{icon}</a>
      : <button type="button" className={controls.icon} disabled={added} aria-label={label} title={label} onClick={onClick}>{icon}</button>}
    <AnimatePresence>{toast && <motion.p className={styles.toast} role="status" initial={{ opacity: 0, y: 8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}>{toast}</motion.p>}</AnimatePresence>
  </span>
}
