'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gift } from 'lucide-react'
import { Instrument_Serif } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { HomePortfolioCard, type HomePortfolioSnapshot } from '@/components/home/HomePortfolioCard'
import { homeStateCopy } from '@/components/home/home-state-copy'
import { MaskLines } from '@/components/home/maison-motion'
import { copyByLocale, ctaText, utilityCopy } from '@/components/screens/P04-Home'
import { BottomDock } from '@/components/rwa-h5'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { heroCta, resolveHomeState, type HomeInputs } from '@/lib/home-lifecycle'
import { routePath } from '@/lib/routes-v2'
import { PATH_EVENT, type PathNavigation } from '@/lib/maison-nav'
import styles from '@/components/screens/P04-HomeMaison.module.css'

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--home-display-latin', display: 'swap' })
const sampleLabels: Record<AppLocale, string> = { en: 'Sample data', 'zh-CN': '示例数据', hi: 'नमूना डेटा', es: 'Datos de ejemplo', ar: 'بيانات تجريبية', fr: 'Données fictives', pt: 'Dados de exemplo' }
const fixtures = ['invested', 'funded', 'guest', 'email', 'kyc', 'unfunded', 'restricted', 'missing', 'locked', 'large'] as const
type Fixture = typeof fixtures[number]

/** Development only. Uses the production card/resolver/dock; never fakes an authenticated session. */
export default function HomeCardPreview() {
  const { locale, setLocale } = useI18n()
  const { theme } = useRwaTheme()
  const router = useRouter()
  const [fixture, setFixture] = useState<Fixture>('invested')
  const copy = copyByLocale[locale]
  const utility = utilityCopy[locale]
  const inputs: HomeInputs = { sessionLoaded: true, session: { emailVerified: true }, wallet: { available: 2680, locked: 0, pending: 0, invested: 10000 }, kyc: { state: 'approved' }, positionsCount: 3 }
  if (fixture === 'guest') inputs.session = null
  if (fixture === 'email') inputs.session = { emailVerified: false }
  if (fixture === 'kyc' || fixture === 'restricted') inputs.kyc = { state: 'expired' }
  if (fixture === 'funded' || fixture === 'kyc' || fixture === 'unfunded' || fixture === 'locked') { inputs.positionsCount = 0; inputs.wallet = { available: fixture === 'funded' ? 12680 : 0, locked: fixture === 'locked' ? 12680 : 0, pending: 0, invested: 0 } }
  if (fixture === 'missing') { inputs.wallet = null; inputs.positionsCount = null }
  const state = resolveHomeState(inputs)
  const account: HomePortfolioSnapshot | null = state.lifecycle === 'invested' || state.lifecycle === 'funded' ? {
    totalAssetsAtomic: fixture === 'missing' ? null : fixture === 'large' ? '1234567890123456789000000' : '12680000000',
    totalAssetsDecimals: 6, availableAtomic: fixture === 'missing' ? null : fixture === 'funded' ? '12680000000' : fixture === 'locked' ? '0' : '2680000000', availableDecimals: 6, holdings: inputs.positionsCount, currency: 'USDT',
  } : null
  const cta = heroCta(state)
  const stateCopy = homeStateCopy[locale]
  const status = state.degraded ? stateCopy.degraded : state.variant ? stateCopy.variant[state.variant] : stateCopy.lifecycle[state.lifecycle]
  const open = (path: string) => router.push(path)
  useEffect(() => {
    const navigate = (event: Event) => open((event as CustomEvent<PathNavigation>).detail.path)
    window.addEventListener(PATH_EVENT, navigate)
    return () => window.removeEventListener(PATH_EVENT, navigate)
  }, [router])
  return <main className="rwa-shell"><div className="rwa-mobile" data-screen="home" data-theme={theme}>
    <section className={`screen s2-home ${styles.root} ${display.variable} ${GeistSans.variable}`} data-home-design="maison" data-home-s2="true" data-locale={locale}>
      <div className={styles.heroBg} aria-hidden="true" /><div className={styles.grain} aria-hidden="true" />
      <RwaTopbar screen="home" surface="transparent-over-media" action={{ label: '邀请与奖励', Icon: Gift, onClick: () => open('/profile/referral') }} />
      <details style={{ position: 'fixed', top: 58, insetInlineStart: 22, zIndex: 80, color: 'var(--home-ink)', fontSize: 11 }}>
        <summary style={{ cursor: 'pointer' }}>预览设置</summary>
        <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--home-bg)', borderRadius: 12 }}>
          <label>账户状态 <select aria-label="预览账户状态" value={fixture} onChange={event => setFixture(event.target.value as Fixture)}>{fixtures.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>语言 <select aria-label="预览语言" value={locale} onChange={event => setLocale(event.target.value as AppLocale)}>{(['zh-CN', 'en', 'hi', 'es', 'ar', 'fr', 'pt'] as const).map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
      </details>
      <div className={styles.firstScreen}>
        <header className={styles.hero} data-chrome="">
          <div className={styles.heroCopy}>
            <div className={styles.heroMeta}><span>RWA.LAT</span><span className={styles.heroRule} /><span>{new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span></div>
            <p className={styles.heroKicker}>{copy.kicker}</p>
            <h1 className={styles.heroTitle}><MaskLines lines={[copy.headline, copy.perspective]} lineClassName={index => index === 1 ? styles.heroItalic : undefined} /></h1>
            <p className={styles.heroSub}>{copy.sub}</p>
          </div>
          <div className={styles.ticker} aria-label={sampleLabels[locale]}><div className={styles.tickerTrack}><div className={styles.tickerRun}><span className={styles.tickerItem}><b>BTC</b>85,969.6 <em className={styles.up}>+1.46%</em></span><span className={styles.tickerItem}><b>ETH</b>2,706.52 <em className={styles.up}>+0.75%</em></span></div></div></div>
        </header>
        <HomePortfolioCard state={state} account={account} status={status} labels={{ portfolio: copy.portfolio, available: copy.available, holdings: copy.holdings, showBalance: utility.showBalance, hideBalance: utility.hideBalance }} ctaLabel={cta ? ctaText[locale][cta.kind] : null} onPrimary={() => { if (cta) open(`${routePath(cta.routeKey as never)}${cta.query ? `?${cta.query}` : ''}`) }} onPortfolio={() => open('/assets?tab=overview')} onCashAction={open} sampleLabel={sampleLabels[locale]} />
      </div>
      <div className={styles.content} style={{ minHeight: 360 }}><p>{sampleLabels[locale]}</p></div>
    </section>
    <BottomDock screen="home" setScreen={screen => open(({ home: '/home', invest: '/markets', portfolio: '/assets', ai: '/ai' } as Record<string, string>)[screen] ?? '/home')} />
  </div></main>
}
