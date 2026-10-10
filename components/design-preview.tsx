'use client'

import RwaLogoMark from '@/components/rwa-logo'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  ChartPie,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Compass,
  Globe2,
  House,
  Landmark,
  Layers3,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react'
import styles from './design-preview.module.css'
import ParticleLogoIcon from './particle-logo-icon'

type ViewMode = 'desktop' | 'mobile'
type PortfolioKey = 'core' | 'liquid' | 'real'

type Portfolio = {
  key: PortfolioKey
  name: string
  kicker: string
  summary: string
  source: string
  exit: string
  risk: string
  liquidity: string
  signal: string
  signalTone: 'mint' | 'amber' | 'blue'
  image: string
  allocation: [string, number][]
  note: string
}

const portfolios: Portfolio[] = [
  {
    key: 'core',
    name: 'Core Liquidity',
    kicker: 'BALANCED / LIQUID-FIRST',
    summary: 'A steadier base of short-duration, asset-backed opportunities.',
    source: 'Coupon income + cash buffer',
    exit: 'Weekly window · 2–5 days',
    risk: 'Moderate',
    liquidity: 'High',
    signal: 'Most aligned',
    signalTone: 'mint',
    image: '/media/generated/project-assets/rwa-collection-v1.png',
    allocation: [
      ['Asset-backed credit', 42],
      ['Treasury instruments', 33],
      ['Cash buffer', 25],
    ],
    note: 'Indicative mix. Final weights and availability are confirmed before purchase.',
  },
  {
    key: 'liquid',
    name: 'Growth & Access',
    kicker: 'GROWTH / MONTHLY ACCESS',
    summary: 'A wider mix for users who can hold through market cycles.',
    source: 'Project cash flow + price movement',
    exit: 'Monthly window · 5–10 days',
    risk: 'Balanced',
    liquidity: 'Medium',
    signal: 'Higher upside',
    signalTone: 'blue',
    image: '/media/generated/project-assets/markets-collection-v1.png',
    allocation: [
      ['Renewable infrastructure', 38],
      ['Private credit', 34],
      ['Digital assets', 28],
    ],
    note: 'Returns are variable. Project-level valuation and exit terms are shown per position.',
  },
  {
    key: 'real',
    name: 'Real Asset Yield',
    kicker: 'INCOME / QUARTERLY EXIT',
    summary: 'Longer-horizon exposure to property and infrastructure cash flows.',
    source: 'Lease income + refinance proceeds',
    exit: 'Quarterly window · 10–20 days',
    risk: 'Growth',
    liquidity: 'Planned',
    signal: 'Longer horizon',
    signalTone: 'amber',
    image: '/media/generated/project-assets/multifamily-refi-v1.png',
    allocation: [
      ['Residential property', 46],
      ['Solar infrastructure', 31],
      ['Private credit', 23],
    ],
    note: 'Limited liquidity is part of the design. The exit calendar is visible before commitment.',
  },
]

const particlePositions = [
  ['14%', '25%', '0.2s'],
  ['24%', '58%', '1.1s'],
  ['33%', '19%', '1.9s'],
  ['42%', '76%', '0.6s'],
  ['52%', '34%', '2.4s'],
  ['63%', '66%', '1.4s'],
  ['72%', '22%', '2.8s'],
  ['84%', '52%', '0.9s'],
  ['89%', '77%', '2.1s'],
  ['18%', '82%', '2.6s'],
  ['48%', '12%', '1.6s'],
  ['77%', '88%', '0.4s'],
] as const

const navItems = [
  { label: 'Overview', icon: House },
  { label: 'Portfolios', icon: BriefcaseBusiness },
  { label: 'Markets', icon: ChartPie },
  { label: 'Wallet', icon: WalletCards },
]

function HermesParticleMark({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.hermes} ${active ? styles.hermesActive : ''}`}
      aria-label="Open Hermes AI assistant"
      aria-expanded={active}
      onClick={onClick}
    >
      <span className={styles.hermesHalo} aria-hidden="true" />
      <span className={styles.hermesParticles} aria-hidden="true">
        {particlePositions.map(([left, top, delay], index) => (
          <i
            className={styles.particle}
            key={`${left}-${top}`}
            style={{ '--left': left, '--top': top, '--delay': delay, '--index': index } as CSSProperties}
          />
        ))}
      </span>
      <RwaLogoMark className={styles.hermesLogo} label="A-REIT" />
      <span className={styles.hermesLabel}>HERMES</span>
    </button>
  )
}

function PortfolioThumb({ portfolio }: { portfolio: Portfolio }) {
  return (
    <div className={styles.portfolioThumb}>
      <img src={portfolio.image} alt="" />
      <span className={`${styles.signalDot} ${styles[`signal${portfolio.signalTone}`]}`} />
      <span className={styles.thumbGrid} aria-hidden="true" />
    </div>
  )
}

export default function DesignPreview() {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop')
  const [activeNav, setActiveNav] = useState('Overview')
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioKey>('core')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [horizon, setHorizon] = useState('1–2 years')
  const [access, setAccess] = useState('Weekly')
  const [risk, setRisk] = useState('Steady')
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const syncViewMode = () => setViewMode(window.innerWidth <= 780 ? 'mobile' : 'desktop')
    syncViewMode()
    window.addEventListener('resize', syncViewMode)
    return () => window.removeEventListener('resize', syncViewMode)
  }, [])

  const selected = useMemo(
    () => portfolios.find((portfolio) => portfolio.key === selectedPortfolio) ?? portfolios[0],
    [selectedPortfolio],
  )

  const recommendation = useMemo(() => {
    if (access === 'Monthly') return portfolios[1]
    if (risk === 'Growth') return portfolios[2]
    return portfolios[0]
  }, [access, risk])

  const handleStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    if (!stage) return
    const bounds = stage.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    stage.style.setProperty('--tilt-x', `${(x * 3.2).toFixed(2)}deg`)
    stage.style.setProperty('--tilt-y', `${(y * -3.2).toFixed(2)}deg`)
    stage.style.setProperty('--glow-x', `${50 + x * 32}%`)
    stage.style.setProperty('--glow-y', `${50 + y * 32}%`)
  }

  const resetStage = () => {
    const stage = stageRef.current
    if (!stage) return
    stage.style.setProperty('--tilt-x', '0deg')
    stage.style.setProperty('--tilt-y', '0deg')
    stage.style.setProperty('--glow-x', '52%')
    stage.style.setProperty('--glow-y', '38%')
  }

  const openPortfolio = (key: PortfolioKey) => {
    setSelectedPortfolio(key)
    setDetailOpen(true)
  }

  return (
    <div className={styles.preview} data-view={viewMode}>
      <div className={styles.labBar}>
        <span className={styles.labCaption}>A-REIT / PRODUCT PREVIEW</span>
        <div className={styles.viewToggle} role="group" aria-label="Preview viewport">
          <button type="button" className={viewMode === 'desktop' ? styles.toggleActive : ''} onClick={() => setViewMode('desktop')}>
            Desktop
          </button>
          <button type="button" className={viewMode === 'mobile' ? styles.toggleActive : ''} onClick={() => setViewMode('mobile')}>
            Mobile
          </button>
        </div>
        <span className={styles.liveBadge}><span /> INTERACTIVE PREVIEW</span>
      </div>

      <div className={styles.deviceShell}>
        <aside className={styles.sideRail}>
          <div className={styles.brandLockup}>
            <img src="/brand/a-reit/mark-dark.svg" alt="A-REIT" />
            <span>WEALTH OS</span>
          </div>
          <div className={styles.railRule} />
          <p className={styles.railLabel}>Workspace</p>
          <nav className={styles.sideNav} aria-label="Desktop navigation">
            {navItems.map(({ label, icon: Icon }) => (
              <button
                type="button"
                key={label}
                className={activeNav === label ? styles.navActive : ''}
                onClick={() => setActiveNav(label)}
              >
                <Icon size={16} strokeWidth={1.7} />
                <span>{label}</span>
                {label === 'Portfolios' && <span className={styles.navCount}>03</span>}
              </button>
            ))}
          </nav>
          <div className={styles.railFooter}>
            <button type="button" onClick={() => setAssistantOpen(true)}><MessageCircle size={15} /> Ask Hermes</button>
            <button type="button"><Globe2 size={15} /> EN / USD</button>
          </div>
        </aside>

        <main className={styles.main}>
          <header className={styles.topBar}>
            <div className={styles.mobileHeaderMark}><Menu size={19} /></div>
            <div className={styles.breadcrumb}><span>Workspace</span><ChevronRight size={13} /><strong>{activeNav}</strong></div>
            <div className={styles.topActions}>
              <button type="button" aria-label="Search"><Search size={17} /></button>
              <button type="button" aria-label="Notifications"><Bell size={17} /><span className={styles.notificationDot} /></button>
              <button type="button" className={styles.balancePill}><CircleDollarSign size={15} /> <span>$12,840.20</span><ChevronRight size={14} /></button>
            </div>
          </header>

          <section className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.overline}><span className={styles.liveDot} /> PERSONAL ASSET INTELLIGENCE</p>
              <h1>Build a portfolio around <em>what matters.</em></h1>
              <p className={styles.heroBody}>RWA exposure with a visible source of return, a clear exit path, and an AI guide that explains every decision.</p>
              <div className={styles.heroCtas}>
                <button type="button" className={styles.primaryButton} onClick={() => setAssistantOpen(true)}>Build my fit <ArrowRight size={16} /></button>
                <button type="button" className={styles.textButton} onClick={() => openPortfolio('core')}>Explore portfolios <ArrowUpRight size={15} /></button>
              </div>
              <div className={styles.trustStrip}>
                <span><ShieldCheck size={14} /> Valuation visible</span>
                <span><Clock3 size={14} /> Exit terms upfront</span>
                <span><Landmark size={14} /> USDT balance</span>
              </div>
            </div>

            <div
              className={styles.heroStage}
              ref={stageRef}
              onPointerMove={handleStagePointerMove}
              onPointerLeave={resetStage}
              onClick={() => openPortfolio('core')}
              role="button"
              tabIndex={0}
              aria-label="Open Core Liquidity portfolio"
            >
              <div className={styles.stageGlow} />
              <div className={styles.stageHalo} />
              <div className={styles.assetObject}>
                <img src="/media/generated/project-assets/rwa-collection-v1.png" alt="A layered preview of diversified real-world assets" />
              </div>
              <div className={styles.floatingChipTop}><span className={styles.chipPulse} /> VERIFIED ASSET MIX <ArrowUpRight size={13} /></div>
              <div className={styles.floatCardMain}>
                <div className={styles.floatCardHead}><span>CORE LIQUIDITY</span><span className={styles.floatLive}>LIVE VIEW</span></div>
                <strong>Cash flow, <em>with context.</em></strong>
                <div className={styles.floatMetric}><span>Illustrative 12m range</span><b>+5.8—8.2%</b></div>
                <div className={styles.floatMeter}><span /></div>
                <div className={styles.floatFooter}><span>Coupon · credit · buffer</span><ChevronRight size={14} /></div>
              </div>
              <div className={styles.floatCardMini}><Sparkles size={14} /><span>AI fit signal</span><b>92</b></div>
              <span className={styles.stageIndex}>01 / 03</span>
            </div>
          </section>

          <section className={styles.insightRow} aria-label="Portfolio snapshot">
            <article className={styles.snapshotCard}>
              <div className={styles.cardEyebrow}><span>YOUR OPENING VIEW</span><ArrowUpRight size={14} /></div>
              <div className={styles.snapshotValue}>$0.00</div>
              <div className={styles.snapshotMeta}><span>Available to invest</span><span className={styles.mutedMeta}>USDT balance</span></div>
              <div className={styles.snapshotActions}><button type="button" onClick={() => setActiveNav('Wallet')}>Add funds <ArrowRight size={14} /></button><span>Wallet is separate from investments</span></div>
            </article>
            <article className={`${styles.snapshotCard} ${styles.pulseCard}`}>
              <div className={styles.cardEyebrow}><span>MARKET PULSE</span><span className={styles.pulseLive}><i /> 15m delayed</span></div>
              <div className={styles.pulseGraph} aria-label="Illustrative portfolio pulse chart">
                <svg viewBox="0 0 420 76" preserveAspectRatio="none" role="img"><path d="M0 58 C30 55 36 40 61 46 S91 65 112 47 S142 29 168 40 S204 55 226 36 S258 42 281 31 S310 15 334 29 S366 42 390 22 S407 16 420 20" /></svg>
              </div>
              <div className={styles.pulseLabels}><span>Portfolio value</span><b>Illustrative</b><span>Last 30 days</span></div>
            </article>
            <article className={`${styles.snapshotCard} ${styles.fitCard}`}>
              <div className={styles.cardEyebrow}><span>HERMES FIT</span><ParticleLogoIcon className={styles.hermesFitIcon} label="Hermes AI" /></div>
              <div className={styles.fitScore}><strong>—</strong><span>Answer 3 quick questions<br />to get a starting mix</span></div>
              <button type="button" className={styles.fitLink} onClick={() => setAssistantOpen(true)}>Start profile <ChevronRight size={14} /></button>
            </article>
          </section>

          <section className={styles.explorerSection}>
            <div className={styles.sectionHeading}>
              <div><p className={styles.overline}>CURATED FOR REAL LIFE</p><h2>Choose a starting point.</h2></div>
              <button type="button" className={styles.filterButton} onClick={() => setAssistantOpen(true)}><SlidersHorizontal size={15} /> Refine fit</button>
            </div>
            <div className={styles.portfolioGrid}>
              {portfolios.map((portfolio) => (
                <button type="button" className={`${styles.portfolioCard} ${selectedPortfolio === portfolio.key ? styles.portfolioSelected : ''}`} key={portfolio.key} onClick={() => openPortfolio(portfolio.key)}>
                  <PortfolioThumb portfolio={portfolio} />
                  <div className={styles.portfolioContent}>
                    <div className={styles.portfolioTitleRow}><span>{portfolio.kicker}</span><ChevronRight size={15} /></div>
                    <h3>{portfolio.name}</h3>
                    <p>{portfolio.summary}</p>
                    <div className={styles.detailLines}>
                      <span><small>RETURN SOURCE</small><b>{portfolio.source}</b></span>
                      <span><small>EXIT TERMS</small><b>{portfolio.exit}</b></span>
                    </div>
                    <div className={styles.portfolioFoot}><span className={`${styles.signalBadge} ${styles[`signal${portfolio.signalTone}`]}`}><i /> {portfolio.signal}</span><span>{portfolio.liquidity} liquidity</span></div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.bottomInsight}>
            <div className={styles.bottomInsightCopy}><p className={styles.overline}>BEFORE YOU BUY</p><h2>See where the return comes from.</h2><p>Every portfolio brings its valuation timestamp, underlying category, risk level, and exit window into the same view.</p></div>
            <div className={styles.auditList}>
              <div><span className={styles.auditIcon}><TrendingUp size={15} /></span><span><b>Valuation timestamp</b><small>Updated per asset class</small></span><Check size={15} /></div>
              <div><span className={styles.auditIcon}><Layers3 size={15} /></span><span><b>Underlying mix</b><small>Allocation before commitment</small></span><Check size={15} /></div>
              <div><span className={styles.auditIcon}><Clock3 size={15} /></span><span><b>Exit calendar</b><small>Window, notice, and fee</small></span><Check size={15} /></div>
            </div>
          </section>
        </main>

        <HermesParticleMark active={assistantOpen} onClick={() => setAssistantOpen((value) => !value)} />

        <nav className={styles.bottomNav} aria-label="Mobile navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button type="button" className={activeNav === label ? styles.bottomNavActive : ''} key={label} onClick={() => setActiveNav(label)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label === 'Overview' ? 'Home' : label}</span>
            </button>
          ))}
          <button type="button" className={activeNav === 'Profile' ? styles.bottomNavActive : ''} onClick={() => setActiveNav('Profile')}><Menu size={17} /><span>More</span></button>
        </nav>
      </div>

      {assistantOpen && (
        <div className={styles.overlay} role="presentation" onClick={() => setAssistantOpen(false)}>
          <section className={styles.assistantPanel} role="dialog" aria-modal="true" aria-labelledby="assistant-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.panelTop}><div><span className={styles.panelKicker}><Sparkles size={13} /> HERMES / FIT GUIDE</span><h2 id="assistant-title">A clearer first move.</h2></div><button type="button" className={styles.closeButton} onClick={() => setAssistantOpen(false)} aria-label="Close assistant"><X size={18} /></button></div>
            <p className={styles.panelIntro}>Answer three light questions. Hermes recommends an existing portfolio and an amount to consider. You stay in control before anything is purchased.</p>
            <div className={styles.stepRail}>{['Horizon', 'Access', 'Comfort'].map((label, index) => <span key={label} className={index <= step ? styles.stepDone : ''}><i>{index < step ? <Check size={12} /> : index + 1}</i>{label}</span>)}</div>
            {step === 0 && <div className={styles.questionBlock}><span className={styles.questionCount}>01 / 03</span><h3>When might you need this money?</h3><div className={styles.choiceGrid}>{['Under 12 months', '1–2 years', '3+ years'].map((choice) => <button type="button" className={horizon === choice ? styles.choiceActive : ''} key={choice} onClick={() => setHorizon(choice)}>{choice}{horizon === choice && <Check size={14} />}</button>)}</div></div>}
            {step === 1 && <div className={styles.questionBlock}><span className={styles.questionCount}>02 / 03</span><h3>How often do you want an exit window?</h3><div className={styles.choiceGrid}>{['Weekly', 'Monthly', 'Quarterly'].map((choice) => <button type="button" className={access === choice ? styles.choiceActive : ''} key={choice} onClick={() => setAccess(choice)}>{choice}{access === choice && <Check size={14} />}</button>)}</div></div>}
            {step === 2 && <div className={styles.questionBlock}><span className={styles.questionCount}>03 / 03</span><h3>What should the portfolio feel like?</h3><div className={styles.choiceGrid}>{['Steady', 'Balanced', 'Growth'].map((choice) => <button type="button" className={risk === choice ? styles.choiceActive : ''} key={choice} onClick={() => setRisk(choice)}>{choice}{risk === choice && <Check size={14} />}</button>)}</div></div>}
            <div className={styles.panelFooter}>{step < 2 ? <button type="button" className={styles.primaryButton} onClick={() => setStep((value) => value + 1)}>Continue <ArrowRight size={16} /></button> : <button type="button" className={styles.primaryButton} onClick={() => { setSelectedPortfolio(recommendation.key); setAssistantOpen(false); setDetailOpen(true); setStep(0) }}>See my starting mix <ArrowRight size={16} /></button>}<span>Illustrative preview · no purchase triggered</span></div>
          </section>
        </div>
      )}

      {detailOpen && (
        <div className={styles.overlay} role="presentation" onClick={() => setDetailOpen(false)}>
          <section className={`${styles.detailPanel} ${styles.detailPanelWide}`} role="dialog" aria-modal="true" aria-labelledby="portfolio-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.panelTop}><div><span className={styles.panelKicker}><BriefcaseBusiness size={13} /> PORTFOLIO DETAIL</span><h2 id="portfolio-detail-title">{selected.name}</h2></div><button type="button" className={styles.closeButton} onClick={() => setDetailOpen(false)} aria-label="Close details"><X size={18} /></button></div>
            <div className={styles.detailHero}><PortfolioThumb portfolio={selected} /><div><p>{selected.summary}</p><span className={`${styles.signalBadge} ${styles[`signal${selected.signalTone}`]}`}><i /> {selected.signal}</span></div></div>
            <div className={styles.detailStats}><div><small>RETURN SOURCE</small><b>{selected.source}</b></div><div><small>EXIT TERMS</small><b>{selected.exit}</b></div><div><small>RISK</small><b>{selected.risk}</b></div><div><small>LIQUIDITY</small><b>{selected.liquidity}</b></div></div>
            <div className={styles.allocationBlock}><div className={styles.allocationHeader}><span>Indicative allocation</span><span>Updated on confirmation</span></div>{selected.allocation.map(([label, value]) => <div className={styles.allocationRow} key={label}><span>{label}</span><div><span style={{ width: `${value}%` }} /></div><b>{value}%</b></div>)}</div>
            <p className={styles.detailNote}><ShieldCheck size={15} /> {selected.note}</p>
            <div className={styles.panelFooter}><button type="button" className={styles.primaryButton} onClick={() => { setDetailOpen(false); setAssistantOpen(true) }}>Use this as my starting point <ArrowRight size={16} /></button><span>Next step is review, then purchase with your USDT balance.</span></div>
          </section>
        </div>
      )}
    </div>
  )
}
