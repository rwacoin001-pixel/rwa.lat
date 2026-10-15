'use client'

/**
 * What the iPhone install gate shows (loaded only once a gate is due; ios-install-gate.tsx decides).
 *
 * Three paths share one layout: Safari (the four install steps), another iOS browser (the same steps,
 * Safari as the fallback) and an in-app browser (open in Safari first). Every step pairs its text with
 * a small drawing of the Safari / iOS screen it refers to; the drawings are decorative, the text is complete.
 */

import { useState } from 'react'
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Compass, Copy, Globe, KeyRound, MessageCircle, MoreHorizontal, PlusSquare, RotateCw, Share, X } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { safariMajor, type InstallEnv } from './home/install-env'
import styles from './ios-install-gate-view.module.css'

const APP_ICON = '/icons/a-reit-v1-apple-180.png'

type Path = 'safari' | 'browser' | 'inapp'
type Scene = 'toolbar' | 'compact' | 'share' | 'add' | 'home' | 'address' | 'more' | 'open'
type Step = { title: string; body: string; alt?: string; scene?: Scene }
type Faq = { q: string; a: string; copy?: boolean }

/** Labels as Safari / iOS print them, used inside the drawings and in [brackets] in the copy. */
type Ui = { share: string; addToHome: string; add: string; cancel: string; webApp: string; openInSafari: string; openInBrowser: string }

/** Text marks UI labels with [brackets]; they render bold. {app} / {open} are filled per environment. */
type GateCopy = {
  dir: 'ltr' | 'rtl'
  ui: Ui
  kicker: string; title: string; lede: string; ledeInApp: string
  meta: Record<Path, string>
  from: { safari: string; browser: string; app: string }; to: string
  apps?: Record<string, string>
  notice: { browser: string; inapp: string }
  share: { toolbar: Step; compact: Step }
  choose: Step; add: Step; addLegacy: Step; open: Step
  browserShare: Step; browserChoose: Step
  inappMore: Step; inappOpen: Step; inappFinish: Step
  webAppTag: string
  login: { title: string; body: string }
  help: { title: string; hint: string; items: Faq[] }
  copyLink: string; copied: string; exit: string
}

const zh: GateCopy = {
  dir: 'ltr',
  ui: { share: '分享', addToHome: '添加到主屏幕', add: '添加', cancel: '取消', webApp: '作为网页 App 打开', openInSafari: '在 Safari 中打开', openInBrowser: '在浏览器打开' },
  kicker: 'iPhone 使用指引', title: '添加到主屏幕',
  lede: '在 iPhone 上，A-REIT 以主屏幕 App 运行。添加一次，之后点图标直接进入，全屏使用。',
  ledeInApp: '在 iPhone 上，A-REIT 以主屏幕 App 运行。需要先在 Safari 中打开本页，再添加到主屏幕。',
  meta: { safari: '4 步 · 约 20 秒 · 无需 App Store', browser: '4 步 · 约 20 秒 · 无需 App Store', inapp: '3 步 · 先用 Safari 打开' },
  from: { safari: 'Safari', browser: '当前浏览器', app: 'App' }, to: '主屏幕',
  apps: { WeChat: '微信', Alipay: '支付宝', DingTalk: '钉钉', Feishu: '飞书', Weibo: '微博', TikTok: '抖音' },
  notice: {
    browser: '部分浏览器无法添加到主屏幕。可以先按下面的步骤试试；找不到选项时，复制链接到 Safari 打开最稳妥。',
    inapp: '当前在{app}内，无法直接添加到主屏幕。请先在 Safari 中打开本页。',
  },
  share: {
    toolbar: { title: '点 [分享]', body: '在 Safari 底部工具栏的中间。看不到工具栏时，轻点屏幕底部让它出现。', alt: '底部只有地址栏？先点它右侧的 [···]，再点 [分享]。', scene: 'toolbar' },
    compact: { title: '点 [···]，再点 [分享]', body: '[···] 在底部地址栏的右侧，点开后第一项就是 [分享]。', alt: '底部是完整工具栏？直接点中间的 [分享]。', scene: 'compact' },
  },
  choose: { title: '选择 [添加到主屏幕]', body: '在弹出的菜单中向下滑找到它，图标是带加号的方框。', scene: 'share' },
  add: { title: '点右上角 [添加]', body: '名称保持 A-REIT 即可。请保持 [作为网页 App 打开] 为开启（iOS 26 及以上）。', scene: 'add' },
  addLegacy: { title: '点右上角 [添加]', body: '名称保持 A-REIT 即可，点 [添加] 完成。', scene: 'add' },
  open: { title: '从主屏幕打开', body: '回到主屏幕，点 A-REIT 图标。以后都从这里进入。', scene: 'home' },
  browserShare: { title: '点 [分享]', body: '在地址栏右侧，或在浏览器的 [···] 菜单中。', scene: 'address' },
  browserChoose: { title: '选择 [添加到主屏幕]', body: '在菜单中向下滑找到它。没有这一项时，请改用 Safari。', scene: 'share' },
  inappMore: { title: '点右上角 [···]', body: '打开{app}的页面菜单。', scene: 'more' },
  inappOpen: { title: '选择 [{open}]', body: '没有这一项？点上方 [复制本页链接]，粘贴到 Safari 地址栏打开。', scene: 'open' },
  inappFinish: { title: '在 Safari 中添加', body: 'Safari 打开本页后，会一步步引导你添加到主屏幕。' },
  webAppTag: 'iOS 26+',
  login: { title: '首次打开需要登录一次', body: '主屏幕 App 与 Safari 分开保存登录状态，就像两个独立的浏览器。所以第一次从图标打开时，需要再登录一次。' },
  help: {
    title: '遇到问题？', hint: '常见情况与解决办法',
    items: [
      { q: '看不到工具栏或 [分享] 按钮', a: '轻点屏幕底部，工具栏会重新出现。若底部只有地址栏，点它右侧的 [···]，菜单里就有 [分享]。' },
      { q: '菜单里没有 [添加到主屏幕]', a: '无痕浏览时不会出现这一项。点 [标签页] 按钮切换回普通浏览，再打开本页。也请确认菜单已向下滑到底。' },
      { q: '已经添加过了', a: '直接回到主屏幕点 A-REIT 图标。若打开后仍有 Safari 地址栏，长按图标删除，按上面的步骤重新添加，并保持 [作为网页 App 打开] 开启。' },
      { q: '在用 Chrome、微信或其他 App', a: '这些环境可能无法添加。复制本页链接，在 Safari 中打开后按上面的步骤操作。', copy: true },
    ],
  },
  copyLink: '复制本页链接', copied: '已复制', exit: '试过仍无法添加？暂时在浏览器中继续',
}

const en: GateCopy = {
  dir: 'ltr',
  ui: { share: 'Share', addToHome: 'Add to Home Screen', add: 'Add', cancel: 'Cancel', webApp: 'Open as Web App', openInSafari: 'Open in Safari', openInBrowser: 'Open in Browser' },
  kicker: 'Using A-REIT on iPhone', title: 'Add to Home Screen',
  lede: 'On iPhone, A-REIT runs as a Home Screen app. Add it once, then open it from the icon — full screen, no address bar.',
  ledeInApp: 'On iPhone, A-REIT runs as a Home Screen app. Open this page in Safari first, then add it to your Home Screen.',
  meta: { safari: '4 steps · about 20 seconds · no App Store', browser: '4 steps · about 20 seconds · no App Store', inapp: '3 steps · start in Safari' },
  from: { safari: 'Safari', browser: 'This browser', app: 'this app' }, to: 'Home Screen',
  notice: {
    browser: 'Some browsers can’t add to the Home Screen. Try the steps below; if the option isn’t there, copy the link and open it in Safari.',
    inapp: 'You’re inside {app}, which can’t add to the Home Screen. Open this page in Safari first.',
  },
  share: {
    toolbar: { title: 'Tap [Share]', body: 'It’s in the middle of Safari’s bottom toolbar. No toolbar? Tap the bottom edge of the screen to bring it back.', alt: 'Only an address bar at the bottom? Tap [···] next to it, then [Share].', scene: 'toolbar' },
    compact: { title: 'Tap [···], then [Share]', body: '[···] sits at the right of the address bar at the bottom; [Share] is the first item in its menu.', alt: 'Full toolbar at the bottom? Tap [Share] in the middle.', scene: 'compact' },
  },
  choose: { title: 'Choose [Add to Home Screen]', body: 'Scroll down the menu to find it — its icon is a square with a plus.', scene: 'share' },
  add: { title: 'Tap [Add] at the top right', body: 'Keep the name A-REIT, and keep [Open as Web App] switched on (iOS 26 or later).', scene: 'add' },
  addLegacy: { title: 'Tap [Add] at the top right', body: 'Keep the name A-REIT and tap [Add] to finish.', scene: 'add' },
  open: { title: 'Open it from your Home Screen', body: 'Go to your Home Screen and tap the A-REIT icon. That’s where A-REIT opens from now on.', scene: 'home' },
  browserShare: { title: 'Tap [Share]', body: 'It’s at the right of the address bar, or in the browser’s [···] menu.', scene: 'address' },
  browserChoose: { title: 'Choose [Add to Home Screen]', body: 'Scroll down the menu to find it. Not there? Use Safari instead.', scene: 'share' },
  inappMore: { title: 'Tap [···] at the top right', body: 'It opens the page menu in {app}.', scene: 'more' },
  inappOpen: { title: 'Choose [{open}]', body: 'Not there? Tap [Copy page link] above and paste it into Safari’s address bar.', scene: 'open' },
  inappFinish: { title: 'Finish in Safari', body: 'Once this page opens in Safari, it walks you through adding it to the Home Screen.' },
  webAppTag: 'iOS 26+',
  login: { title: 'Sign in once on first launch', body: 'The Home Screen app and Safari keep separate sign-ins, like two different browsers — so you sign in once more the first time you open it from the icon.' },
  help: {
    title: 'Having trouble?', hint: 'Common cases and fixes',
    items: [
      { q: 'Can’t see the toolbar or [Share]', a: 'Tap the bottom edge of the screen and the toolbar comes back. If there’s only an address bar, tap [···] next to it — [Share] is in that menu.' },
      { q: 'No [Add to Home Screen] in the menu', a: 'It’s hidden in Private Browsing. Tap the [Tabs] button, switch back to regular browsing and open this page again. Also scroll the menu all the way down.' },
      { q: 'Already added it', a: 'Just tap the A-REIT icon on your Home Screen. If it still opens with Safari’s address bar, delete the icon, add it again with the steps above and keep [Open as Web App] on.' },
      { q: 'Using Chrome, WeChat or another app', a: 'These may not be able to add it. Copy this page’s link, open it in Safari and follow the steps above.', copy: true },
    ],
  },
  copyLink: 'Copy page link', copied: 'Copied', exit: 'Tried and still can’t add it? Continue in the browser for now',
}

// Same policy as the Home install guide: other locales use English until the Safari labels are reviewed.
const gateCopy: Record<AppLocale, GateCopy> = { en, 'zh-CN': zh, hi: en, es: en, ar: en, fr: en, pt: en }

function Rich({ text }: { text: string }) {
  return <>{text.split(/\[(.+?)\]/).map((part, index) => index % 2 ? <b key={index}>{part}</b> : part)}</>
}

export default function IosInstallGateView({ env, locale, theme, exitReady, onLeave }: {
  env: InstallEnv; locale: AppLocale; theme: 'light' | 'dark'; exitReady: boolean; onLeave: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = gateCopy[locale]
  const path: Path = env.kind === 'ios-safari' ? 'safari' : env.kind === 'wechat-ios' || env.kind === 'inapp' ? 'inapp' : 'browser'
  // Safari 26 defaults to the compact bar (Share sits behind ···) and adds the Web App switch; 0 = unknown, show both hints.
  const version = safariMajor()
  const compact = path === 'safari' && version >= 26
  const webApp = version === 0 || version >= 26
  const app = env.app ? copy.apps?.[env.app] ?? env.app : copy.from.app
  const fill = (text: string) => text.replace('{app}', app).replace('{open}', env.kind === 'wechat-ios' ? copy.ui.openInSafari : copy.ui.openInBrowser)
  const steps: Step[] = path === 'inapp'
    ? [copy.inappMore, copy.inappOpen, copy.inappFinish]
    : [
      path === 'safari' ? copy.share[compact ? 'compact' : 'toolbar'] : copy.browserShare,
      path === 'safari' ? copy.choose : copy.browserChoose,
      webApp ? copy.add : copy.addLegacy,
      copy.open,
    ]
  const notice = path === 'safari' ? null : fill(copy.notice[path])
  const FromIcon = path === 'safari' ? Compass : path === 'browser' ? Globe : MessageCircle
  const fromLabel = path === 'safari' ? copy.from.safari : path === 'browser' ? copy.from.browser : app

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked in some webviews */ }
  }
  const copyButton = (primary = false) => <button type="button" className={primary ? styles.primary : styles.secondary} onClick={() => void copyLink()}>
    {copied ? <Check size={16} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.8} aria-hidden="true" />}
    <span aria-live="polite">{copied ? copy.copied : copy.copyLink}</span>
  </button>

  return <div className={styles.gate} data-theme={theme} role="dialog" aria-modal="true" aria-labelledby="ios-gate-title" dir={copy.dir}>
    <div className={styles.inner}>
      <p className={styles.brand}>A<i>-</i>REIT</p>

      <header className={styles.head}>
        <p className={styles.kicker}>{copy.kicker}</p>
        <h1 id="ios-gate-title" className={styles.title}>{copy.title}</h1>
        <p className={styles.lede}>{path === 'inapp' ? copy.ledeInApp : copy.lede}</p>
      </header>

      <div className={styles.journey} aria-hidden="true">
        <span className={styles.node}>
          <span className={styles.glyph}><FromIcon size={24} strokeWidth={1.5} /></span>
          <small>{fromLabel}</small>
        </span>
        <span className={styles.path}>
          <span className={styles.chip}><PlusSquare size={12} strokeWidth={1.9} />{copy.ui.addToHome}</span>
          <span className={styles.track}><i /></span>
        </span>
        <span className={styles.node}>
          <img className={styles.appIcon} src={APP_ICON} alt="" width={56} height={56} decoding="async" />
          <small>{copy.to}</small>
        </span>
      </div>
      <p className={styles.meta}>{copy.meta[path]}</p>

      {notice && <div className={styles.notice} role="status">
        <p>{notice}</p>
        {copyButton(true)}
      </div>}

      <ol className={styles.steps}>
        {steps.map((step, index) => <li key={index} className={styles.step}>
          <span className={styles.rail} aria-hidden="true">
            <span className={styles.no}>{index === steps.length - 1 && path !== 'inapp' ? <Check size={14} strokeWidth={2.2} /> : index + 1}</span>
          </span>
          <div className={styles.stepBody}>
            <h2 className={styles.stepTitle}><Rich text={fill(step.title)} /></h2>
            <p className={styles.stepText}><Rich text={fill(step.body)} /></p>
            {step.scene && <SceneArt scene={step.scene} ui={copy.ui} webApp={webApp} webAppTag={copy.webAppTag} openLabel={fill('{open}')} />}
            {step.alt && <p className={styles.alt}><Rich text={step.alt} /></p>}
          </div>
        </li>)}
      </ol>

      <section className={styles.login}>
        <span className={styles.loginIcon} aria-hidden="true"><KeyRound size={17} strokeWidth={1.6} /></span>
        <div>
          <h2>{copy.login.title}</h2>
          <p>{copy.login.body}</p>
        </div>
      </section>

      <details className={styles.help}>
        <summary>
          <span><b>{copy.help.title}</b><small>{copy.help.hint}</small></span>
          <ChevronDown className={styles.chevron} size={18} strokeWidth={1.6} aria-hidden="true" />
        </summary>
        <dl>
          {copy.help.items.map(item => <div key={item.q} className={styles.faq}>
            <dt><Rich text={item.q} /></dt>
            <dd><Rich text={item.a} />{item.copy && copyButton()}</dd>
          </div>)}
        </dl>
      </details>

      <div className={styles.foot}>
        {exitReady && <button type="button" className={styles.exit} onClick={onLeave}>{copy.exit}</button>}
      </div>
    </div>
  </div>
}

/** A small, decorative drawing of the iOS screen a step refers to; the target control is ringed. */
function SceneArt({ scene, ui, webApp, webAppTag, openLabel }: { scene: Scene; ui: Ui; webApp: boolean; webAppTag: string; openLabel: string }) {
  const s = styles
  const lines = <span className={s.pageLines}><i /><i /><i /></span>
  const address = <span className={s.address}><span className={s.aa}>aA</span><span className={s.host}>a-reit.com</span><RotateCw size={10} strokeWidth={2} /></span>
  const skelRow = (key: number) => <span key={key} className={s.row}><i className={s.skel} /><i className={s.skelIcon} /></span>
  const body = (() => {
    switch (scene) {
      case 'toolbar': return <>
        {lines}
        <span className={s.bottom}>
          {address}
          <span className={s.toolbar}>
            <ChevronLeft size={17} strokeWidth={1.8} /><ChevronRight size={17} strokeWidth={1.8} className={s.dim} />
            <span className={s.hot}><Share size={16} strokeWidth={1.9} /></span>
            <BookOpen size={16} strokeWidth={1.8} /><Copy size={15} strokeWidth={1.8} />
          </span>
        </span>
      </>
      case 'compact': return <>
        <span className={s.popover}>
          <span className={`${s.menuRow} ${s.hotRow}`}><span>{ui.share}</span><Share size={13} strokeWidth={1.9} /><em className={s.badge}>2</em></span>
          <span className={s.menuRow}><i className={s.skel} /><i className={s.skelIcon} /></span>
          <span className={s.menuRow}><i className={s.skel} /><i className={s.skelIcon} /></span>
        </span>
        <span className={s.compactBar}>
          <span className={s.round}><ChevronLeft size={16} strokeWidth={1.9} /></span>
          {address}
          <span className={`${s.round} ${s.hot}`}><MoreHorizontal size={16} strokeWidth={2} /><em className={s.badge}>1</em></span>
        </span>
      </>
      case 'share': return <span className={s.sheet}>
        <span className={s.grip} />
        <span className={s.sheetHead}>
          <img src={APP_ICON} alt="" width={26} height={26} decoding="async" />
          <span><b>A-REIT</b><small>a-reit.com</small></span>
        </span>
        <span className={s.list}>
          {skelRow(1)}
          <span className={`${s.row} ${s.hotRow}`}><span>{ui.addToHome}</span><PlusSquare size={14} strokeWidth={1.8} /></span>
          {skelRow(2)}
        </span>
      </span>
      case 'add': return <span className={s.sheet}>
        <span className={s.nav}><span>{ui.cancel}</span><b>{ui.addToHome}</b><span className={s.hotText}>{ui.add}</span></span>
        <span className={s.addCard}>
          <img src={APP_ICON} alt="" width={34} height={34} decoding="async" />
          <span><b>A-REIT</b><small>https://a-reit.com</small></span>
        </span>
        {webApp && <span className={s.toggleRow}><span>{ui.webApp}<em>{webAppTag}</em></span><span className={s.switch}><i /></span></span>}
      </span>
      case 'home': return <span className={s.homeScreen}>
        {Array.from({ length: 8 }, (_, index) => index === 5
          ? <span key={index} className={s.homeApp}>
            <img src={APP_ICON} alt="" width={40} height={40} decoding="async" />
            <small>A-REIT</small>
            <i className={s.tap} />
          </span>
          : <span key={index} className={s.homeSlot}><i /><small /></span>)}
      </span>
      case 'address': return <>
        <span className={s.topAddress}><span className={s.host}>a-reit.com</span><span className={s.hot}><Share size={14} strokeWidth={1.9} /></span></span>
        {lines}
        <span className={s.toolbar}><ChevronLeft size={16} strokeWidth={1.8} /><ChevronRight size={16} strokeWidth={1.8} className={s.dim} /><PlusSquare size={15} strokeWidth={1.8} /><Copy size={15} strokeWidth={1.8} /><MoreHorizontal size={16} strokeWidth={1.8} /></span>
      </>
      case 'more': return <>
        <span className={s.appBar}><X size={16} strokeWidth={1.8} /><i className={s.skel} /><span className={s.hot}><MoreHorizontal size={17} strokeWidth={2} /></span></span>
        {lines}
      </>
      case 'open': return <span className={s.sheet}>
        <span className={s.grip} />
        <span className={s.tiles}>
          <span className={s.tile}><i /><small /></span>
          <span className={s.tile}><i /><small /></span>
          <span className={`${s.tile} ${s.hotTile}`}><i><Compass size={18} strokeWidth={1.6} /></i><small>{openLabel}</small></span>
          <span className={s.tile}><i /><small /></span>
        </span>
      </span>
    }
  })()
  return <div className={`${s.scene} ${s[`scene_${scene}`] ?? ''}`} aria-hidden="true">{body}</div>
}
