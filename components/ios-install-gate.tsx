'use client'

/**
 * iPhone runs A-REIT only as a Home Screen web app. In a Safari tab (or any in-app browser)
 * this full-screen gate teaches the install instead of showing the App.
 *
 * Never shown: off iPhone, when standalone (opened from the icon), on auth callbacks / email
 * token links / legal pages, or after the user takes the session-only "can't install" exit.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, Copy, ExternalLink, MoreHorizontal, PlusSquare, Share } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import type { InstallEnv } from './home/HomeInstall'
import styles from './ios-install-gate.module.css'

// HomeInstall pulls in framer-motion, so it loads only once a gate is actually due.
type InstallModule = typeof import('./home/HomeInstall')
// Same check as HomeInstall's isStandalone, kept here so the pre-paint decision needs no chunk.
const isStandalone = () => (navigator as Navigator & { standalone?: boolean }).standalone === true
  || ['standalone', 'fullscreen', 'minimal-ui'].some(mode => matchMedia(`(display-mode: ${mode})`).matches)

const BYPASS_KEY = 'rwa.ios-gate.bypass'
// Links that must open in whatever browser they land in: OAuth returns, email tokens, documents, tooling.
const EXEMPT = /^\/(auth|terms|privacy|dev|design-preview|desktop)(\/|$)/
// Safari can always add to the Home Screen; the exit only appears once someone has clearly tried.
const SAFARI_EXIT_DELAY_MS = 30_000

type GateCopy = { kicker: string; title: string; lede: string; safari: string; inApp: string; webApp: string; privateMode: string; done: string; exit: string }
const zh: GateCopy = {
  kicker: 'iPhone', title: '请从主屏幕打开', lede: '在 iPhone 上，A-REIT 以主屏幕 App 运行。添加一次，之后从图标直接进入。',
  safari: '当前浏览器无法完成添加。请复制链接，在 Safari 中打开本页。', inApp: '当前在 {app} 内，无法添加到主屏幕。请先在 Safari 中打开。',
  webApp: 'iOS 26 及以上：添加时请保持 [作为网页 App 打开] 为开启。', privateMode: '看不到 [添加到主屏幕]？请先关闭无痕浏览。',
  done: '添加完成后，请从主屏幕的 A-REIT 图标打开。', exit: '试过仍无法添加？暂时在浏览器中继续',
}
const en: GateCopy = {
  kicker: 'iPhone', title: 'Open from your Home Screen', lede: 'On iPhone, A-REIT runs as a Home Screen app. Add it once, then open it from the icon.',
  safari: 'This browser can’t finish the install. Copy the link and open this page in Safari.', inApp: 'You’re inside {app}, which can’t add to the Home Screen. Open this page in Safari first.',
  webApp: 'iOS 26 or later: keep [Open as Web App] switched on when adding.', privateMode: 'No [Add to Home Screen]? Turn off Private Browsing first.',
  done: 'Once added, open A-REIT from its Home Screen icon.', exit: 'Tried and still can’t add it? Continue in the browser for now',
}
// Same policy as the Home install guide: other locales use English until the Safari labels are reviewed.
const gateCopy: Record<AppLocale, GateCopy> = { en, 'zh-CN': zh, hi: en, es: en, ar: en, fr: en, pt: en }
const ICONS = {
  'ios-safari': [Share, PlusSquare, Check],
  'ios-other': [Share, PlusSquare, ExternalLink],
  'wechat-ios': [MoreHorizontal, ExternalLink, PlusSquare],
  inapp: [MoreHorizontal, ExternalLink, PlusSquare],
} as const

export default function IosInstallGate() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const { theme } = useRwaTheme()
  const [gated, setGated] = useState(false)
  const [install, setInstall] = useState<InstallModule | null>(null)
  const [env, setEnv] = useState<InstallEnv | null>(null)
  const [exempt, setExempt] = useState(true)
  const [exitReady, setExitReady] = useState(false)
  const [copied, setCopied] = useState(false)

  // Decided before paint so the App never flashes underneath; the guide fills the cover once loaded.
  useLayoutEffect(() => {
    if (!/iPhone|iPod/.test(navigator.userAgent) || isStandalone()) return
    try { if (sessionStorage.getItem(BYPASS_KEY) === '1') return } catch { /* storage blocked: still gate */ }
    setGated(true)
    // A chunk that never arrives must not strand the user behind a blank cover.
    void import('./home/HomeInstall').then(module => { setInstall(module); setEnv(module.detectEnv()) }, () => setGated(false))
  }, [])
  useLayoutEffect(() => { setExempt(EXEMPT.test(pathname) || new URLSearchParams(location.search).has('token')) }, [pathname])

  const open = gated && !exempt
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => { root.style.overflow = previous }
  }, [open])
  useEffect(() => {
    if (!open || !env) return
    const timer = window.setTimeout(() => setExitReady(true), env.kind === 'ios-safari' ? SAFARI_EXIT_DELAY_MS : 0)
    return () => window.clearTimeout(timer)
  }, [open, env])

  if (!open) return null
  if (!install || !env) return <div className={styles.gate} data-theme={theme === 'dark' ? 'dark' : 'light'} aria-busy="true" />
  const { installCopy, StepText } = install
  const copy = gateCopy[locale]
  const guide = installCopy[locale].guide
  const kind = env.kind in ICONS ? env.kind as keyof typeof ICONS : 'ios-other'
  const safari = kind === 'ios-safari'
  const notice = kind === 'ios-other' ? copy.safari : kind !== 'ios-safari' ? copy.inApp.replace('{app}', env.app ?? 'App') : null
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked in some webviews */ }
  }
  const leave = () => {
    try { sessionStorage.setItem(BYPASS_KEY, '1') } catch { /* this render still lets them through */ }
    setGated(false)
  }

  return <div className={styles.gate} data-theme={theme === 'dark' ? 'dark' : 'light'} role="dialog" aria-modal="true" aria-labelledby="ios-gate-title" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <div className={styles.inner}>
      <p className={styles.brand}>A<i>-</i>REIT</p>
      <header className={styles.head}>
        <p className={styles.kicker}><span aria-hidden="true" />{copy.kicker}<span aria-hidden="true" /></p>
        <h1 id="ios-gate-title" className={styles.title}>{copy.title}</h1>
        <span className={styles.rule} aria-hidden="true" />
        <p className={styles.lede}>{copy.lede}</p>
      </header>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <ol className={styles.steps}>
        {guide[kind].map((text, index) => {
          const Icon = ICONS[kind][index] ?? Check
          return <li key={index}>
            <span className={styles.stepNo} aria-hidden="true">{index + 1}</span>
            <span className={styles.stepText}><StepText text={text} /></span>
            <span className={styles.stepIcon} aria-hidden="true"><Icon size={18} strokeWidth={1.6} /></span>
          </li>
        })}
      </ol>
      {safari && <ul className={styles.notes}>
        <li><StepText text={copy.webApp} /></li>
        <li><StepText text={copy.privateMode} /></li>
      </ul>}
      <p className={styles.done}>{copy.done}</p>
      <div className={styles.actions}>
        {!safari && <button type="button" className={styles.primary} onClick={() => void copyLink()}>
          {copied ? <Check size={16} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.8} aria-hidden="true" />}{copied ? installCopy[locale].copied : installCopy[locale].copyLink}
        </button>}
        {safari && <button type="button" className={styles.secondary} onClick={() => void copyLink()}>
          {copied ? <Check size={15} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={15} strokeWidth={1.8} aria-hidden="true" />}{copied ? installCopy[locale].copied : installCopy[locale].copyLink}
        </button>}
        <p className={styles.note}>{installCopy[locale].iosNote}</p>
        {exitReady && <button type="button" className={styles.exit} onClick={leave}>{copy.exit}</button>}
      </div>
    </div>
  </div>
}
