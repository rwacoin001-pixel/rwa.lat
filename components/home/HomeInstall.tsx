'use client'

/**
 * Home "install app" entry: environment detection, the deferred Chromium install prompt,
 * and the per-browser guide sheet. The strip itself lives in P04-HomeMaison (invite material).
 *
 * Hidden when running standalone, after `appinstalled`, or for 14 days after the strip is dismissed.
 * Benefits copy is limited to what a home-screen web app really gives (no push / offline claims).
 */

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Download, ExternalLink, Menu, MoreHorizontal, MoreVertical, PlusSquare, Settings, Share, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { AppLocale } from '@/lib/i18n'
import { localizedInstallCopy } from '@/lib/install-localized-copy'
import { detectEnv, isStandalone, type InstallEnv, type InstallKind } from './install-env'
import styles from './HomeInstall.module.css'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const DISMISS_KEY = 'rwa.home.install-dismissed-at'
const INSTALLED_KEY = 'rwa.home.app-installed'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000

// Chromium may fire beforeinstallprompt before Home mounts, so capture it at module load.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const subscribers = new Set<() => void>()
const notify = () => subscribers.forEach(fn => fn())
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    try { window.localStorage.setItem(INSTALLED_KEY, '1') } catch { /* standalone check still hides it there */ }
    notify()
  })
}

/** null until mounted or when the entry must stay hidden. */
export function useHomeInstall() {
  const [env, setEnv] = useState<InstallEnv | null>(null)
  const [canPrompt, setCanPrompt] = useState(false)
  useEffect(() => {
    const sync = () => {
      setCanPrompt(Boolean(deferredPrompt))
      let hidden = isStandalone()
      try {
        const at = Number(window.localStorage.getItem(DISMISS_KEY))
        hidden = hidden || window.localStorage.getItem(INSTALLED_KEY) === '1' || (Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS)
      } catch { /* storage blocked: still offer the entry */ }
      setEnv(hidden ? null : detectEnv())
    }
    sync()
    subscribers.add(sync)
    return () => { subscribers.delete(sync) }
  }, [])
  const dismiss = useCallback(() => {
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* returns next visit */ }
    setEnv(null)
  }, [])
  return { env, canPrompt, dismiss }
}

type Icon = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>
const STEP_ICONS: Record<InstallKind, Icon[]> = {
  'ios-safari': [Share, PlusSquare, Check],
  'ios-other': [Share, PlusSquare, ExternalLink],
  'android-chrome': [MoreVertical, Download, Check],
  'android-samsung': [Menu, PlusSquare, Check],
  'android-xiaomi': [Menu, PlusSquare, Settings],
  'android-huawei': [Menu, PlusSquare, Settings],
  'android-other': [Menu, PlusSquare, ExternalLink],
  'desktop-chrome': [Download, MoreVertical, Check],
  'desktop-edge': [Download, MoreHorizontal, Check],
  'desktop-safari': [Share, PlusSquare, Check],
  'desktop-other': [ExternalLink, Download, Check],
  'wechat-ios': [MoreHorizontal, ExternalLink, PlusSquare],
  'wechat-android': [MoreHorizontal, ExternalLink, PlusSquare],
  inapp: [MoreHorizontal, ExternalLink, PlusSquare],
}
const NEEDS_LINK = new Set<InstallKind>(['ios-other', 'android-other', 'desktop-other', 'wechat-ios', 'wechat-android', 'inapp'])
const OUTSIDE_BROWSER = new Set<InstallKind>(['wechat-ios', 'wechat-android', 'inapp'])

/** Step text marks UI labels with [brackets]; they render bold. */
export type InstallCopy = {
  strip: string; stripSub: string; stripInApp: string; dismiss: string
  title: string; lede: string; benefits: string[]; iosNote: string
  steps: string; manual: string; install: string; installHint: string
  copyLink: string; copied: string; close: string
  guide: Record<InstallKind, string[]>
}

const zh: InstallCopy = {
  strip: '把 A-REIT 添加到主屏幕', stripSub: '像 App 一样一键打开 · 全屏浏览', stripInApp: '当前在{app}内，需先用浏览器打开', dismiss: '14 天内不再提示',
  title: '安装 A-REIT', lede: '无需应用商店，添加后从主屏幕图标直接打开。',
  benefits: ['主屏幕图标一键进入，不用再输入网址', '全屏显示，没有浏览器地址栏和工具栏', '不经应用商店，长按图标即可删除'],
  iosNote: 'iPhone 上主屏幕版与 Safari 的登录状态互不共享，首次打开需登录一次。',
  steps: '按以下步骤操作', manual: '没有弹出安装窗口？也可以手动安装：', install: '立即安装', installHint: '将弹出浏览器的安装确认',
  copyLink: '复制本页链接', copied: '已复制', close: '知道了',
  guide: {
    'ios-safari': ['点 Safari 的 [分享] 按钮（底部工具栏中间；若看不到工具栏，先点地址栏旁的 [···]）', '在菜单中向下滑，选择 [添加到主屏幕]', '点右上角 [添加]，主屏幕就会出现 A-REIT 图标'],
    'ios-other': ['点地址栏或菜单中的 [分享] 按钮', '选择 [添加到主屏幕]，再点 [添加]', '找不到该选项时：复制链接，用 [Safari] 打开后按同样步骤添加'],
    'android-chrome': ['点右上角 [⋮] 菜单', '选择 [安装应用] 或 [添加到主屏幕]', '在弹窗中点 [安装]'],
    'android-samsung': ['点底部工具栏右侧的 [≡] 菜单', '选择 [添加页面至]，再选 [主屏幕]', '确认 [添加]'],
    'android-xiaomi': ['点底部工具栏的 [≡] 菜单', '选择 [添加到桌面]（部分版本在 [收藏] 或 [工具箱] 中）', '桌面没出现图标时：系统设置 › 应用 › 浏览器 › 权限，开启 [桌面快捷方式]'],
    'android-huawei': ['点底部工具栏的 [≡] 菜单', '选择 [添加至桌面]（部分版本为 [添加到] › [桌面]）', '桌面没出现图标时：系统设置 › 应用 › 浏览器 › 权限，开启 [创建桌面快捷方式]'],
    'android-other': ['打开浏览器菜单（通常在底部 [≡] 或右上角 [⋮]）', '选择 [添加到桌面] 或 [添加到主屏幕]', '菜单里没有该选项时：复制链接，用 [Chrome] 打开后安装'],
    'desktop-chrome': ['点地址栏右侧的 [安装] 图标', '或打开右上角 [⋮] 菜单，在 [投放、保存和分享] 中选择 [安装]', '在弹窗中点 [安装]'],
    'desktop-edge': ['点地址栏右侧的 [应用可用] 图标', '或打开右上角 [···] › [应用] › [将此站点作为应用安装]', '在弹窗中点 [安装]'],
    'desktop-safari': ['在菜单栏点 [文件]，或点工具栏的 [分享] 按钮', '选择 [添加到程序坞]（需 macOS Sonoma 14 及以上）', '点 [添加]，之后可从程序坞直接打开'],
    'desktop-other': ['当前浏览器不支持安装网页应用', '复制链接，用 [Chrome] 或 [Edge] 打开本页', '点地址栏右侧的 [安装] 图标'],
    'wechat-ios': ['点右上角 [···]', '选择 [在 Safari 中打开]', '在 Safari 中点 [分享] › [添加到主屏幕]'],
    'wechat-android': ['点右上角 [···]', '选择 [在浏览器打开]', '在浏览器菜单中选择 [添加到主屏幕] 或 [安装应用]'],
    inapp: ['点右上角菜单 [···]', '选择 [在浏览器打开]；没有该选项就复制链接，粘贴到浏览器', '在浏览器中按本页的安装引导添加到主屏幕'],
  },
}

const en: InstallCopy = {
  strip: 'Add A-REIT to your home screen', stripSub: 'Opens like an app · full screen', stripInApp: 'Inside {app} — open in your browser first', dismiss: 'Hide for 14 days',
  title: 'Install A-REIT', lede: 'No app store needed. Open it straight from your home screen icon.',
  benefits: ['One tap from your home screen, no typing the address', 'Full screen, without the browser address bar or toolbars', 'Not from an app store — long-press the icon to remove it'],
  iosNote: 'On iPhone, the home screen app does not share sign-in with Safari, so you sign in once on first launch.',
  steps: 'Follow these steps', manual: 'No install window? You can also do it manually:', install: 'Install now', installHint: 'Your browser will ask you to confirm',
  copyLink: 'Copy page link', copied: 'Copied', close: 'Got it',
  guide: {
    'ios-safari': ['Tap Safari’s [Share] button (middle of the bottom bar; if the bar is hidden, tap [···] next to the address bar first)', 'Scroll down and choose [Add to Home Screen]', 'Tap [Add] in the top corner — the A-REIT icon appears on your home screen'],
    'ios-other': ['Tap the [Share] button in the address bar or menu', 'Choose [Add to Home Screen], then [Add]', 'Not there? Copy the link, open it in [Safari] and repeat'],
    'android-chrome': ['Tap the [⋮] menu at the top right', 'Choose [Install app] or [Add to Home screen]', 'Tap [Install] in the dialog'],
    'android-samsung': ['Tap the [≡] menu at the bottom right', 'Choose [Add page to], then [Home screen]', 'Confirm with [Add]'],
    'android-xiaomi': ['Tap the [≡] menu in the bottom bar', 'Choose [Add to home screen] (on some versions under [Bookmarks] or [Tools])', 'No icon? Settings › Apps › Browser › Permissions, allow [Home screen shortcuts]'],
    'android-huawei': ['Tap the [≡] menu in the bottom bar', 'Choose [Add to home screen] (on some versions [Add to] › [Home screen])', 'No icon? Settings › Apps › Browser › Permissions, allow [Create home screen shortcuts]'],
    'android-other': ['Open the browser menu (usually [≡] at the bottom or [⋮] at the top right)', 'Choose [Add to home screen] or [Install app]', 'Not in the menu? Copy the link and install from [Chrome]'],
    'desktop-chrome': ['Click the [Install] icon at the right of the address bar', 'Or open the [⋮] menu › [Cast, save, and share] › [Install]', 'Click [Install] in the dialog'],
    'desktop-edge': ['Click the [App available] icon in the address bar', 'Or open [···] › [Apps] › [Install this site as an app]', 'Click [Install] in the dialog'],
    'desktop-safari': ['Open the [File] menu, or click the [Share] button in the toolbar', 'Choose [Add to Dock] (macOS Sonoma 14 or later)', 'Click [Add] — then open it from the Dock'],
    'desktop-other': ['This browser cannot install web apps', 'Copy the link and open this page in [Chrome] or [Edge]', 'Click the [Install] icon in the address bar'],
    'wechat-ios': ['Tap [···] at the top right', 'Choose [Open in Safari]', 'In Safari, tap [Share] › [Add to Home Screen]'],
    'wechat-android': ['Tap [···] at the top right', 'Choose [Open in browser]', 'In the browser menu, choose [Add to Home screen] or [Install app]'],
    inapp: ['Tap the [···] menu at the top right', 'Choose [Open in browser] — or copy the link and paste it into your browser', 'Then follow this guide again in the browser'],
  },
}

export const installCopy: Record<AppLocale, InstallCopy> = { en, 'zh-CN': zh, ...localizedInstallCopy }

export function StepText({ text }: { text: string }) {
  return <>{text.split(/\[(.+?)\]/).map((part, index) => index % 2 ? <b key={index}>{part}</b> : part)}</>
}

export function InstallSheet({ open, env, canPrompt, copy, onClose }: { open: boolean; env: InstallEnv; canPrompt: boolean; copy: InstallCopy; onClose: () => void }) {
  const reduced = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [host, setHost] = useState<Element | null>(null)
  const [copied, setCopied] = useState(false)
  const [promptFailed, setPromptFailed] = useState(false)

  // Portal into the Home root so the --home-* tokens (light A / dark A′) still apply.
  useEffect(() => { setHost(document.querySelector('[data-home-design="maison"]') ?? document.body) }, [])
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const install = async () => {
    const event = deferredPrompt
    if (!event) { setPromptFailed(true); return }
    deferredPrompt = null
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === 'accepted') onClose()
      else setPromptFailed(true)
    } catch { setPromptFailed(true) }
    notify()
  }
  const copyLink = async () => {
    try { await window.navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked in some webviews */ }
  }

  const native = canPrompt && !promptFailed
  const icons = STEP_ICONS[env.kind]
  if (!host) return null
  return createPortal(<AnimatePresence>
    {open && <motion.div key="install" className={styles.scrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .25 }}>
      <motion.div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="home-install-title" onClick={event => event.stopPropagation()} initial={reduced ? { opacity: 0 } : { y: '100%' }} animate={reduced ? { opacity: 1 } : { y: 0 }} exit={reduced ? { opacity: 0 } : { y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
        <span className={styles.grip} aria-hidden="true" />
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={copy.close}><X size={16} strokeWidth={1.8} /></button>
        <h2 id="home-install-title" className={styles.title}>{copy.title}</h2>
        <p className={styles.lede}>{copy.lede}</p>
        {!OUTSIDE_BROWSER.has(env.kind) && <ul className={styles.benefits}>
          {copy.benefits.map(item => <li key={item}><Check size={14} strokeWidth={2} aria-hidden={true} />{item}</li>)}
        </ul>}
        {native && <div className={styles.native}>
          <button type="button" className={styles.primary} onClick={() => void install()}><Download size={16} strokeWidth={1.8} aria-hidden={true} />{copy.install}</button>
          <small>{copy.installHint}</small>
        </div>}
        <p className={styles.stepsLabel}>{native ? copy.manual : copy.steps}</p>
        <ol className={styles.steps}>
          {copy.guide[env.kind].map((text, index) => {
            const StepIcon = icons[index] ?? Check
            return <li key={index}>
              <span className={styles.stepNo} aria-hidden="true">{index + 1}</span>
              <span className={styles.stepText}><StepText text={text} /></span>
              <span className={styles.stepIcon} aria-hidden="true"><StepIcon size={17} strokeWidth={1.6} /></span>
            </li>
          })}
        </ol>
        {NEEDS_LINK.has(env.kind) && <button type="button" className={styles.secondary} onClick={() => void copyLink()}>
          {copied ? <Check size={15} strokeWidth={1.8} aria-hidden={true} /> : <Copy size={15} strokeWidth={1.8} aria-hidden={true} />}{copied ? copy.copied : copy.copyLink}
        </button>}
        {env.ios && !OUTSIDE_BROWSER.has(env.kind) && <p className={styles.note}>{copy.iosNote}</p>}
      </motion.div>
    </motion.div>}
  </AnimatePresence>, host)
}
