'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpFromLine,
  Bell,
  Bookmark,
  Bot,
  CalendarDays,
  ChartPie,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Cpu,
  CreditCard,
  FileText,
  House,
  Landmark,
  MessageCircle,
  Network,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  WalletCards,
} from 'lucide-react'
import AssetScene, { type AssetSceneKind } from './asset-scenes'

type Screen = 'home' | 'invest' | 'portfolio' | 'wallet' | 'ai' | 'profile' | 'rwa-detail'
type PrimaryScreen = 'home' | 'invest' | 'portfolio' | 'wallet'
type InvestCategory = 'All' | 'Compute' | 'RWA' | 'Stocks' | 'Prediction'

const categories: InvestCategory[] = ['All', 'Compute', 'RWA', 'Stocks', 'Prediction']

const products: Array<{
  title: string
  subtitle: string
  category: Exclude<InvestCategory, 'All'>
  risk: 'Low Risk' | 'Medium Risk' | 'High Risk'
  kind: AssetSceneKind
}> = [
  { title: 'AI Compute Infrastructure', subtitle: '18.2% projected APY · From 100 USDT', category: 'Compute', risk: 'Medium Risk', kind: 'compute' },
  { title: 'Solar Income', subtitle: '12.0% projected yield · 12 months', category: 'RWA', risk: 'Low Risk', kind: 'solar' },
  { title: 'Global Stocks', subtitle: 'AI-ranked global equity access', category: 'Stocks', risk: 'Medium Risk', kind: 'stocks' },
  { title: 'Prediction Markets', subtitle: 'Event contracts settled in USDT', category: 'Prediction', risk: 'High Risk', kind: 'prediction' },
]

const opportunityArtwork: Record<AssetSceneKind, string> = {
  compute: '/media/opportunity-source/compute.png',
  solar: '/media/opportunity-source/rwa.png',
  stocks: '/media/opportunity-source/stocks.png',
  prediction: '/media/opportunity-source/prediction.png',
  wallet: '/media/opportunity-source/compute.png',
  portfolio: '/media/opportunity-source/stocks.png',
  'solar-dome': '/media/opportunity-source/rwa.png',
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="RWA.LAT">
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle className="brand-outline" cx="28" cy="28" r="20.5" />
        <path className="brand-axis" d="M7.5 28H46.5" />
        <path className="brand-rune" d="M18 42V14H27.2C34.1 14 38.3 17.6 38.3 23.1C38.3 27.1 36.1 30.2 32 31.8L40.4 42" />
        <circle className="brand-node" cx="47" cy="28" r="3.6" />
      </svg>
      <span>RWA.LAT</span>
    </div>
  )
}

function TopBar({ onProfile, onNotifications }: { onProfile: () => void; onNotifications: () => void }) {
  return (
    <header className="topbar">
      <Brand />
      <div className="topbar-actions">
        <button className="round-control notification-control" type="button" aria-label="Notifications" onClick={onNotifications}>
          <Bell size={20} strokeWidth={1.65} /><i />
        </button>
        <button className="profile-orb" type="button" aria-label="Open profile" onClick={onProfile}>
          <Bot size={25} strokeWidth={1.45} />
        </button>
      </div>
    </header>
  )
}

function BottomDock({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const items: Array<{ id: PrimaryScreen; label: string; icon: typeof House }> = [
    { id: 'home', label: 'Home', icon: House },
    { id: 'invest', label: 'Invest', icon: TrendingUp },
    { id: 'portfolio', label: 'Portfolio', icon: ChartPie },
    { id: 'wallet', label: 'Wallet', icon: WalletCards },
  ]
  return (
    <nav className="liquid-dock" aria-label="Primary navigation">
      <div className="liquid-dock__pill">
        <span className="liquid-dock__shine" />
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={`dock-link ${screen === id ? 'is-active' : ''}`} aria-current={screen === id ? 'page' : undefined} onClick={() => setScreen(id)}>
            <span className="dock-link__icon"><Icon size={21} strokeWidth={1.65} /></span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button type="button" className={`ai-orb ${screen === 'ai' ? 'is-active' : ''}`} aria-label="Open AI Advisor" onClick={() => setScreen('ai')}>
        <span className="ai-orb__ring" />
        <MessageCircle size={27} strokeWidth={1.55} />
        <i />
      </button>
    </nav>
  )
}

function OrbitBadge({ className, icon: Icon, label, value }: { className: string; icon: typeof Landmark; label: string; value: string }) {
  return <div className={`orbit-label ${className}`}><span className="orbit-label__icon"><Icon size={13} strokeWidth={2.7} /></span><span className="orbit-label__copy">{label}<b>{value}</b></span></div>
}

function HomeScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  return (
    <section className="screen home-screen">
      <TopBar onProfile={() => go('profile')} onNotifications={() => notify('Notifications are up to date')} />

      <div className="portfolio-heading">
        <p>Total Portfolio</p>
        <h1>$128,540<span>.20</span></h1>
        <strong>+$328.40 <i>•</i> +1.2% today</strong>
        <div>AI Portfolio Score <b>87</b></div>
      </div>

      <div className="globe-hero">
        <video
          className="portfolio-orbit-video"
          src="/media/portfolio-orbit.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Animated global investment network"
        />
        <span className="portfolio-video-sheen" aria-hidden="true" />
        <OrbitBadge className="orbit-label--estate" icon={Landmark} label="Real Estate" value="24%" />
        <OrbitBadge className="orbit-label--credit" icon={ShieldCheck} label="Private Credit" value="21%" />
        <OrbitBadge className="orbit-label--compute" icon={Cpu} label="AI Compute" value="28%" />
        <OrbitBadge className="orbit-label--treasury" icon={Landmark} label="Tokenized Treasuries" value="27%" />
      </div>

      <button className="market-brief glass" type="button" onClick={() => go('ai')}>
        <span className="brief-orb"><Sparkles size={20} /></span>
        <span><b>AI Market Brief</b><small>Compute demand is accelerating.</small></span>
        <ChevronRight size={22} strokeWidth={1.5} />
      </button>

      <div className="section-title"><h2>Explore Opportunities</h2><span /></div>
      <div className="opportunity-grid">
        {products.map((product) => (
          <button key={product.category} type="button" className="opportunity-card glass" onClick={() => go(product.category === 'RWA' ? 'rwa-detail' : 'invest')}>
            <span className="opportunity-media"><img src={opportunityArtwork[product.kind]} alt="" /></span>
            <b>{product.category === 'Compute' ? 'AI Compute' : product.category === 'Prediction' ? 'Prediction' : product.category}</b>
          </button>
        ))}
      </div>
    </section>
  )
}

function InvestScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const [category, setCategory] = useState<InvestCategory>('All')
  const filtered = useMemo(() => category === 'All' ? products.slice(1) : products.filter((item) => item.category === category && item.category !== 'Compute'), [category])
  return (
    <section className="screen invest-screen">
      <TopBar onProfile={() => go('profile')} onNotifications={() => notify('Notifications are up to date')} />
      <h1 className="page-title">Invest</h1>

      <div className="segmented" role="tablist" aria-label="Investment categories">
        {categories.map((item) => <button key={item} role="tab" type="button" className={category === item ? 'is-active' : ''} aria-selected={category === item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>

      {(category === 'All' || category === 'Compute') && (
        <button className="compute-feature glass" type="button" onClick={() => notify('AI Compute details opened')}>
          <div className="compute-feature__copy">
            <h2>AI Compute<br />Infrastructure</h2>
            <p><b>18.2%</b> projected APY</p>
            <span>From <b>100 USDT</b></span>
          </div>
          <AssetScene kind="compute" />
        </button>
      )}

      <div className="product-stack">
        {filtered.map((product) => (
          <button key={product.category} type="button" className="product-card glass" onClick={() => product.category === 'RWA' ? go('rwa-detail') : notify(`${product.title} details opened`)}>
            <AssetScene kind={product.kind} />
            <span className="product-card__copy"><b>{product.title}</b><small className={`risk risk--${product.risk.split(' ')[0].toLowerCase()}`}>{product.risk}</small></span>
            <ChevronRight size={24} strokeWidth={1.35} />
          </button>
        ))}
      </div>
    </section>
  )
}

function MetricCard({ icon: Icon, main, label, accent = false }: { icon: typeof CircleDollarSign; main: string; label: string; accent?: boolean }) {
  return <div className="metric-card glass"><span><Icon size={25} strokeWidth={1.5} /></span><div><b className={accent ? 'mint' : ''}>{main}</b><small>{label}</small></div></div>
}

function RwaDetailScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  return (
    <section className="screen detail-screen">
      <div className="detail-topbar">
        <button className="round-control" type="button" aria-label="Back" onClick={() => go('invest')}><ArrowLeft size={23} /></button>
        <Brand compact />
        <button className="round-control" type="button" aria-label="Bookmark" onClick={() => notify('Project saved')}><Bookmark size={21} strokeWidth={1.5} /></button>
      </div>
      <div className="detail-hero"><AssetScene kind="solar-dome" /></div>
      <div className="detail-identity">
        <h1>Solar Income Project</h1>
        <p><span className="country-flag" role="img" aria-label="United States flag" /> United States</p>
      </div>
      <div className="metric-grid">
        <MetricCard icon={CircleDollarSign} main="12.0%" label="projected yield" />
        <MetricCard icon={CalendarDays} main="12" label="months" />
        <MetricCard icon={ShieldCheck} main="Medium" label="risk" accent />
        <MetricCard icon={CircleDollarSign} main="500 USDT" label="minimum" />
      </div>
      <div className="detail-links glass">
        <button type="button" onClick={() => notify('Asset overview opened')}><span><Landmark size={22} /></span><span><b>Asset overview</b><small>Operational solar assets with contracted cash flow.</small></span><ChevronRight size={22} /></button>
        <button type="button" onClick={() => notify('Offering memorandum opened')}><span><FileText size={22} /></span><span><b>Offering memorandum</b><small>Structure, fees, exit terms and risk factors.</small></span><ChevronRight size={22} /></button>
      </div>
      <button className="invest-cta" type="button" onClick={() => notify('Investment review opened')}><CircleDollarSign size={25} />Invest with USDT</button>
    </section>
  )
}

function PortfolioScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const allocations = [
    ['AI Compute', '38%', '4,850.00 USDT'],
    ['RWA', '31%', '3,930.00 USDT'],
    ['Global Stocks', '21%', '2,670.00 USDT'],
    ['Available USDT', '10%', '1,270.20 USDT'],
  ]
  return (
    <section className="screen portfolio-screen">
      <TopBar onProfile={() => go('profile')} onNotifications={() => notify('Notifications are up to date')} />
      <h1 className="page-title">Portfolio</h1>
      <div className="portfolio-hero glass">
        <div><p>Total invested</p><h2>12,720.20 <span>USDT</span></h2><strong>+$284.60 this month</strong></div>
        <AssetScene kind="portfolio" />
      </div>
      <div className="portfolio-score"><span><small>AI Portfolio Score</small><b>87</b></span><div><i style={{ width: '87%' }} /></div><p>Balanced exposure with moderate liquidity risk.</p></div>
      <div className="section-title"><h2>Allocation</h2><button type="button" onClick={() => go('ai')}>Ask AI</button></div>
      <div className="allocation-list glass">
        {allocations.map(([name, percent, value], index) => <button type="button" key={name} onClick={() => notify(`${name} position opened`)}><i className={`allocation-dot allocation-dot--${index}`} /><span><b>{name}</b><small>{value}</small></span><strong>{percent}</strong><ChevronRight size={18} /></button>)}
      </div>
      <button className="rebalance-row glass" type="button" onClick={() => go('ai')}><Sparkles size={21} /><span><b>AI Rebalance</b><small>One opportunity needs your attention.</small></span><ChevronRight size={21} /></button>
    </section>
  )
}

function WalletAction({ icon: Icon, label, disabled, onClick }: { icon: typeof ArrowDownToLine; label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="wallet-action glass" disabled={disabled} onClick={onClick}><span><Icon size={24} strokeWidth={1.45} /></span><b>{label}</b></button>
}

function WalletScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  return (
    <section className="screen wallet-screen">
      <TopBar onProfile={() => go('profile')} onNotifications={() => notify('Notifications are up to date')} />
      <div className="wallet-hero">
        <div className="wallet-copy"><p>Wallet</p><h1>12,540.20 <span>USDT</span></h1><small>≈ $12,538.90 USD</small></div>
        <AssetScene kind="wallet" />
      </div>
      <div className="wallet-action-grid">
        <WalletAction icon={ArrowDownToLine} label="Deposit" onClick={() => notify('Choose TRON, Ethereum or Arbitrum')} />
        <WalletAction icon={ArrowUpFromLine} label="Withdraw" onClick={() => notify('Withdrawal review opened')} />
        <WalletAction icon={ArrowRightLeft} label="Transfer" onClick={() => notify('Transfer opened')} />
        <WalletAction icon={CreditCard} label="Fiat soon" disabled onClick={() => undefined} />
      </div>
      <div className="wallet-network-row"><Network size={16} />USDT networks <span>TRON · Ethereum · Arbitrum</span></div>
      <div className="section-title"><h2>Assets</h2></div>
      <div className="wallet-assets glass">
        <button type="button" onClick={() => notify('USDT account opened')}><span className="token token--usdt">₮</span><span><b>USDT</b><small>Available balance</small></span><strong>12,540.20<small>≈ $12,538.90</small></strong><ChevronRight size={19} /></button>
        <button type="button" onClick={() => go('portfolio')}><span className="token"><Cpu size={20} /></span><span><b>Compute Positions</b><small>2 active units</small></span><strong>4,850.00<small>USDT value</small></strong><ChevronRight size={19} /></button>
        <button type="button" onClick={() => go('rwa-detail')}><span className="token"><Landmark size={20} /></span><span><b>RWA Positions</b><small>Solar Income</small></span><strong>3,930.00<small>USDT value</small></strong><ChevronRight size={19} /></button>
      </div>
      <div className="section-title"><h2>Activity</h2><button type="button" onClick={() => notify('All activity opened')}>View all</button></div>
      <div className="activity-list glass">
        <div><span><ArrowDownToLine size={19} /></span><p><b>Deposit</b><small>From TQx7...8vZp</small></p><strong className="mint">+2,000.00 USDT<small>Today, 09:34</small></strong></div>
        <div><span><TrendingUp size={19} /></span><p><b>Investment</b><small>Solar Income Project</small></p><strong>-500.00 USDT<small>May 12, 14:18</small></strong></div>
        <div><span><Sparkles size={19} /></span><p><b>Reward</b><small>Compute revenue</small></p><strong className="mint">+124.20 USDT<small>May 10, 08:45</small></strong></div>
      </div>
    </section>
  )
}

function AiScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const [input, setInput] = useState('')
  return (
    <section className="screen ai-screen">
      <TopBar onProfile={() => go('profile')} onNotifications={() => notify('Notifications are up to date')} />
      <div className="ai-hero"><span><Bot size={34} /></span><p>AI Investment Advisor</p><h1>Ask before you allocate.</h1></div>
      <div className="chat-stack">
        <div className="chat chat--user">Help me allocate 10,000 USDT.</div>
        <div className="chat chat--ai"><b>Balanced allocation</b><p>40% AI Compute · 30% RWA · 20% Stocks · 10% USDT</p><button type="button" onClick={() => go('portfolio')}>Review portfolio <ChevronRight size={17} /></button></div>
      </div>
      <form className="chat-input glass" onSubmit={(event) => { event.preventDefault(); if (input.trim()) { notify('AI analysis generated'); setInput('') } }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about risk or allocation" /><button type="submit"><Sparkles size={20} /></button></form>
    </section>
  )
}

function ProfileScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const rows = [
    ['Identity & KYC', 'Verified', ShieldCheck],
    ['Security & devices', 'Passkey enabled', UserRound],
    ['Referral rewards', 'Invite and earn', Sparkles],
    ['Transaction records', 'Orders and settlements', ReceiptText],
  ] as const
  return (
    <section className="screen profile-screen">
      <div className="detail-topbar"><button className="round-control" type="button" onClick={() => go('home')}><ArrowLeft size={23} /></button><Brand compact /><span className="topbar-spacer" /></div>
      <div className="profile-head"><div className="profile-orb profile-orb--large"><Bot size={38} /></div><h1>0x82...92A</h1><p><ShieldCheck size={15} /> Verified investor</p></div>
      <div className="profile-menu glass">{rows.map(([title, subtitle, Icon]) => <button type="button" key={title} onClick={() => notify(`${title} opened`)}><span><Icon size={21} /></span><p><b>{title}</b><small>{subtitle}</small></p><ChevronRight size={19} /></button>)}</div>
    </section>
  )
}

export default function RwaH5() {
  const [screen, setScreen] = useState<Screen>('home')
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    const reset = () => {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      window.scrollTo(0, 0)
    }
    reset()
    const frame = window.requestAnimationFrame(reset)
    const timer = window.setTimeout(reset, 140)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer) }
  }, [screen])
  const go = (next: Screen) => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    setScreen(next)
    const reset = () => window.scrollTo(0, 0)
    window.setTimeout(reset, 0)
    window.setTimeout(reset, 160)
    window.setTimeout(reset, 320)
  }
  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }
  const showDock = screen !== 'rwa-detail'
  return (
    <main className="rwa-shell">
      <div className={`rwa-mobile ${showDock ? '' : 'rwa-mobile--detail'}`} data-screen={screen}>
        {screen === 'home' && <HomeScreen go={go} notify={notify} />}
        {screen === 'invest' && <InvestScreen go={go} notify={notify} />}
        {screen === 'portfolio' && <PortfolioScreen go={go} notify={notify} />}
        {screen === 'wallet' && <WalletScreen go={go} notify={notify} />}
        {screen === 'rwa-detail' && <RwaDetailScreen go={go} notify={notify} />}
        {screen === 'ai' && <AiScreen go={go} notify={notify} />}
        {screen === 'profile' && <ProfileScreen go={go} notify={notify} />}
        {showDock && <BottomDock screen={screen} setScreen={go} />}
      </div>
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </main>
  )
}
