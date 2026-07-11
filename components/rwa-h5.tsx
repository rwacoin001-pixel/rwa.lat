'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  AlertTriangle,
  Bell,
  Bookmark,
  Bot,
  CalendarDays,
  ChartPie,
  Check,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Copy,
  Cpu,
  CreditCard,
  FileText,
  House,
  Headphones,
  KeyRound,
  Landmark,
  MessageCircle,
  Network,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserRound,
  WalletCards,
} from 'lucide-react'
import AssetScene, { type AssetSceneKind } from './asset-scenes'

type Screen =
  | 'home' | 'invest' | 'portfolio' | 'wallet' | 'ai' | 'profile'
  | 'rwa-detail' | 'compute-detail' | 'stock-detail' | 'prediction-detail'
  | 'order-review' | 'order-success' | 'deposit' | 'withdraw' | 'transfer'
  | 'activity' | 'asset-detail' | 'position-detail' | 'ai-plan'
  | 'notifications' | 'kyc' | 'security' | 'referral' | 'records' | 'support' | 'settings'
type OrderAsset = 'compute' | 'rwa' | 'stocks' | 'prediction'
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
  compute: '/media/opportunity-source/compute-curated.png',
  solar: '/media/opportunity-source/rwa-curated.png',
  stocks: '/media/opportunity-source/stocks.png',
  prediction: '/media/opportunity-source/prediction.png',
  wallet: '/media/opportunity-source/compute.png',
  portfolio: '/media/opportunity-source/stocks.png',
  'solar-dome': '/media/opportunity-source/rwa.png',
}

const productAsset: Record<Exclude<InvestCategory, 'All'>, OrderAsset> = {
  Compute: 'compute',
  RWA: 'rwa',
  Stocks: 'stocks',
  Prediction: 'prediction',
}

function detailRoute(asset: OrderAsset): Screen {
  if (asset === 'compute') return 'compute-detail'
  if (asset === 'stocks') return 'stock-detail'
  if (asset === 'prediction') return 'prediction-detail'
  return 'rwa-detail'
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="RWA.LAT">
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle className="brand-outline" cx="28" cy="28" r="20.5" />
        <path className="brand-axis" d="M7.5 28H46.5" />
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

function OpportunityMedia({ kind }: { kind: AssetSceneKind }) {
  return <span className="opportunity-media"><img src={opportunityArtwork[kind]} alt="" /></span>
}

function DetailProductVisual({ asset, scene }: { asset: OrderAsset; scene: AssetSceneKind }) {
  const video = asset === 'rwa' ? '/media/opportunities/rwa.mp4' : asset === 'compute' ? '/media/opportunities/compute.mp4' : null
  if (video) {
    return <video className="detail-product-video" src={video} autoPlay muted loop playsInline preload="metadata" aria-label={`${asset} product visual`} />
  }
  return <AssetScene kind={scene} />
}

function HomeScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  return (
    <section className="screen home-screen">
      <TopBar onProfile={() => go('profile')} onNotifications={() => go('notifications')} />

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
          <button key={product.category} type="button" className="opportunity-card glass" onClick={() => go(detailRoute(productAsset[product.category]))}>
            <OpportunityMedia kind={product.kind} />
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
      <TopBar onProfile={() => go('profile')} onNotifications={() => go('notifications')} />
      <h1 className="page-title">Invest</h1>

      <div className="segmented" role="tablist" aria-label="Investment categories">
        {categories.map((item) => <button key={item} role="tab" type="button" className={category === item ? 'is-active' : ''} aria-selected={category === item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>

      {(category === 'All' || category === 'Compute') && (
        <button className="compute-feature glass" type="button" onClick={() => go('compute-detail')}>
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
          <button key={product.category} type="button" className="product-card glass" onClick={() => go(detailRoute(productAsset[product.category]))}>
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

function RwaDetailScreen({ go, notify, openOrder }: { go: (screen: Screen) => void; notify: (message: string) => void; openOrder: (asset: OrderAsset) => void }) {
  return (
    <section className="screen detail-screen has-fixed-cta">
      <div className="detail-topbar">
        <button className="round-control" type="button" aria-label="Back" onClick={() => go('invest')}><ArrowLeft size={23} /></button>
        <Brand compact />
        <button className="round-control" type="button" aria-label="Bookmark" onClick={() => notify('Project saved')}><Bookmark size={21} strokeWidth={1.5} /></button>
      </div>
      <div className="detail-hero"><DetailProductVisual asset="rwa" scene="solar-dome" /></div>
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
      <button className="invest-cta" type="button" onClick={() => openOrder('rwa')}><CircleDollarSign size={25} />Invest with USDT</button>
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
      <TopBar onProfile={() => go('profile')} onNotifications={() => go('notifications')} />
      <h1 className="page-title">Portfolio</h1>
      <div className="portfolio-hero glass">
        <div><p>Total invested</p><h2>12,720.20 <span>USDT</span></h2><strong>+$284.60 this month</strong></div>
        <AssetScene kind="portfolio" />
      </div>
      <div className="portfolio-score"><span><small>AI Portfolio Score</small><b>87</b></span><div><i style={{ width: '87%' }} /></div><p>Balanced exposure with moderate liquidity risk.</p></div>
      <div className="section-title"><h2>Allocation</h2><button type="button" onClick={() => go('ai')}>Ask AI</button></div>
      <div className="allocation-list glass">
        {allocations.map(([name, percent, value], index) => <button type="button" key={name} onClick={() => go('position-detail')}><i className={`allocation-dot allocation-dot--${index}`} /><span><b>{name}</b><small>{value}</small></span><strong>{percent}</strong><ChevronRight size={18} /></button>)}
      </div>
      <button className="rebalance-row glass" type="button" onClick={() => go('ai-plan')}><Sparkles size={21} /><span><b>AI Rebalance</b><small>One opportunity needs your attention.</small></span><ChevronRight size={21} /></button>
    </section>
  )
}

function WalletAction({ icon: Icon, label, disabled, onClick }: { icon: typeof ArrowDownToLine; label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="wallet-action glass" disabled={disabled} onClick={onClick}><span><Icon size={24} strokeWidth={1.45} /></span><b>{label}</b></button>
}

function WalletScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  return (
    <section className="screen wallet-screen">
      <TopBar onProfile={() => go('profile')} onNotifications={() => go('notifications')} />
      <div className="wallet-hero">
        <div className="wallet-copy"><p>Wallet</p><h1>12,540.20 <span>USDT</span></h1><small>≈ $12,538.90 USD</small></div>
        <AssetScene kind="wallet" />
      </div>
      <div className="wallet-action-grid">
        <WalletAction icon={ArrowDownToLine} label="Deposit" onClick={() => go('deposit')} />
        <WalletAction icon={ArrowUpFromLine} label="Withdraw" onClick={() => go('withdraw')} />
        <WalletAction icon={ArrowRightLeft} label="Transfer" onClick={() => go('transfer')} />
        <WalletAction icon={CreditCard} label="Fiat soon" disabled onClick={() => undefined} />
      </div>
      <div className="wallet-network-row"><Network size={16} />USDT networks <span>TRON · Ethereum · Arbitrum</span></div>
      <div className="section-title"><h2>Assets</h2></div>
      <div className="wallet-assets glass">
        <button type="button" onClick={() => go('asset-detail')}><span className="token token--usdt">T</span><span><b>USDT</b><small>Available balance</small></span><strong>12,540.20<small>≈ $12,538.90</small></strong><ChevronRight size={19} /></button>
        <button type="button" onClick={() => go('portfolio')}><span className="token"><Cpu size={20} /></span><span><b>Compute Positions</b><small>2 active units</small></span><strong>4,850.00<small>USDT value</small></strong><ChevronRight size={19} /></button>
        <button type="button" onClick={() => go('rwa-detail')}><span className="token"><Landmark size={20} /></span><span><b>RWA Positions</b><small>Solar Income</small></span><strong>3,930.00<small>USDT value</small></strong><ChevronRight size={19} /></button>
      </div>
      <div className="section-title"><h2>Activity</h2><button type="button" onClick={() => go('activity')}>View all</button></div>
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
      <TopBar onProfile={() => go('profile')} onNotifications={() => go('notifications')} />
      <div className="ai-hero"><span><Bot size={34} /></span><p>AI Investment Advisor</p><h1>Ask before you allocate.</h1></div>
      <div className="chat-stack">
        <div className="chat chat--user">Help me allocate 10,000 USDT.</div>
        <div className="chat chat--ai"><b>Balanced allocation</b><p>40% AI Compute · 30% RWA · 20% Stocks · 10% USDT</p><button type="button" onClick={() => go('ai-plan')}>Review allocation plan <ChevronRight size={17} /></button></div>
      </div>
      <form className="chat-input glass" onSubmit={(event) => { event.preventDefault(); if (input.trim()) { notify('AI analysis generated'); setInput('') } }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about risk or allocation" /><button type="submit"><Sparkles size={20} /></button></form>
    </section>
  )
}

function ProfileScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  const rows = [
    ['Identity & KYC', 'Verified', ShieldCheck, 'kyc'],
    ['Security & devices', 'Passkey enabled', UserRound, 'security'],
    ['Referral rewards', 'Invite and earn', Sparkles, 'referral'],
    ['Transaction records', 'Orders and settlements', ReceiptText, 'records'],
    ['Support center', 'Help with a real issue', Headphones, 'support'],
    ['Settings', 'Language and notifications', Settings, 'settings'],
  ] as const
  return (
    <section className="screen profile-screen">
      <div className="detail-topbar"><button className="round-control" type="button" onClick={() => go('home')}><ArrowLeft size={23} /></button><Brand compact /><span className="topbar-spacer" /></div>
      <div className="profile-head"><div className="profile-orb profile-orb--large"><Bot size={38} /></div><h1>0x82...92A</h1><p><ShieldCheck size={15} /> Verified investor</p></div>
      <div className="profile-menu glass">{rows.map(([title, subtitle, Icon, screen]) => <button type="button" key={title} onClick={() => go(screen)}><span><Icon size={21} /></span><p><b>{title}</b><small>{subtitle}</small></p><ChevronRight size={19} /></button>)}</div>
    </section>
  )
}

function DetailHeader({ go, back, title }: { go: (screen: Screen) => void; back: Screen; title?: string }) {
  return (
    <div className="detail-topbar">
      <button className="round-control" type="button" aria-label="Back" onClick={() => go(back)}><ArrowLeft size={23} /></button>
      {title ? <span className="detail-topbar__title">{title}</span> : <Brand compact />}
      <span className="topbar-spacer" />
    </div>
  )
}

function AssetDetailScreen({ asset, go, openOrder, notify }: { asset: Exclude<OrderAsset, 'rwa'>; go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void; notify: (message: string) => void }) {
  const detail = asset === 'compute'
    ? { scene: 'compute' as AssetSceneKind, overline: 'AI COMPUTE MARKETPLACE', title: 'H100 Compute Unit', location: 'Tier III data centers · 98% availability', yield: '18.2%', yieldLabel: 'projected APY', term: 'Flexible', minimum: '100 USDT', risk: 'Medium', narrative: 'Acquire a revenue share in GPU capacity reserved for enterprise AI inference and training workloads.', bullets: ['Daily USDT revenue accrual', 'Live utilization telemetry', 'No hardware custody required'] }
    : asset === 'stocks'
      ? { scene: 'stocks' as AssetSceneKind, overline: 'GLOBAL EQUITIES', title: 'NVIDIA Exposure', location: 'US market hours · Tokenized settlement', yield: 'AI 92', yieldLabel: 'investment score', term: 'T+1', minimum: '50 USDT', risk: 'Medium', narrative: 'A USDT-settled route to a curated technology equity basket led by NVIDIA.', bullets: ['AI analyst thesis and risk factors', 'Transparent reference price', 'Exit during supported market windows'] }
      : { scene: 'prediction' as AssetSceneKind, overline: 'PREDICTION INTELLIGENCE', title: 'Fed Rate Cut', location: 'Resolution: FOMC decision', yield: '68¢', yieldLabel: 'YES probability', term: 'Aug 20', minimum: '10 USDT', risk: 'High', narrative: 'Express a view on the next US Federal Reserve rate decision with USDT-settled event contracts.', bullets: ['Real-time probability and volume', 'Clearly defined resolution criteria', 'Loss limited to your position size'] }

  return (
    <section className="screen asset-detail-screen has-fixed-cta">
      <DetailHeader go={go} back="invest" />
      <div className="asset-detail-hero"><DetailProductVisual asset={asset} scene={detail.scene} /></div>
      <div className="asset-detail-copy">
        <p>{detail.overline}</p><h1>{detail.title}</h1><span><Network size={15} />{detail.location}</span>
      </div>
      <div className="asset-highlight-grid">
        <div className="asset-highlight glass"><small>{detail.yieldLabel}</small><b>{detail.yield}</b></div>
        <div className="asset-highlight glass"><small>minimum</small><b>{detail.minimum}</b></div>
        <div className="asset-highlight glass"><small>liquidity / term</small><b>{detail.term}</b></div>
        <div className="asset-highlight glass"><small>risk level</small><b className={detail.risk === 'High' ? 'amber' : 'mint'}>{detail.risk}</b></div>
      </div>
      <div className="asset-narrative glass"><p>{detail.narrative}</p><ul>{detail.bullets.map((bullet) => <li key={bullet}><CircleCheck size={16} />{bullet}</li>)}</ul></div>
      <div className="asset-disclosure"><AlertTriangle size={16} />Returns are projected and not guaranteed. Review the offering documents before allocating.</div>
      <button className="invest-cta" type="button" onClick={() => openOrder(asset)}><CircleDollarSign size={24} />Continue with USDT</button>
    </section>
  )
}

function OrderReviewScreen({ asset, go, amount, setAmount }: { asset: OrderAsset; go: (screen: Screen) => void; amount: number; setAmount: (value: number) => void }) {
  const product = asset === 'compute' ? 'H100 Compute Unit' : asset === 'rwa' ? 'Solar Income Project' : asset === 'stocks' ? 'NVIDIA Exposure' : 'Fed Rate Cut · YES'
  const expected = asset === 'compute' ? '18.2% projected APY' : asset === 'rwa' ? '12.0% projected yield' : asset === 'stocks' ? 'AI Score 92' : '68¢ current YES price'
  const fee = Math.max(1.5, amount * .008)
  return (
    <section className="screen order-review-screen has-fixed-cta">
      <DetailHeader go={go} back={detailRoute(asset)} title="Review order" />
      <div className="order-asset glass"><span className="order-asset__icon">{asset === 'compute' ? <Cpu size={23} /> : asset === 'rwa' ? <Landmark size={23} /> : asset === 'stocks' ? <TrendingUp size={23} /> : <Sparkles size={23} />}</span><div><b>{product}</b><small>{expected}</small></div><ChevronRight size={20} /></div>
      <div className="amount-panel glass"><span>Investment amount</span><div><input aria-label="Investment amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))} /><b>USDT</b></div><small>Available balance: 12,540.20 USDT</small><div className="amount-presets">{[100, 500, 1000, 5000].map((value) => <button key={value} type="button" onClick={() => setAmount(value)}>{value.toLocaleString()}</button>)}</div></div>
      <div className="review-breakdown"><span><small>Allocation</small><b>{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT</b></span><span><small>Subscription fee</small><b>{fee.toFixed(2)} USDT</b></span><span><small>Total to lock</small><b>{(amount + fee).toFixed(2)} USDT</b></span></div>
      <div className="risk-ack glass"><ShieldCheck size={21} /><p><b>Investment confirmation</b><small>I understand this position may lose value and projected returns are not guaranteed.</small></p><Check size={18} /></div>
      <button className="flow-cta" type="button" onClick={() => go('order-success')}><LockKeyholeIcon />Confirm allocation</button>
    </section>
  )
}

function LockKeyholeIcon() { return <KeyRound size={21} /> }

function OrderSuccessScreen({ asset, go }: { asset: OrderAsset; go: (screen: Screen) => void }) {
  const product = asset === 'compute' ? 'H100 Compute Unit' : asset === 'rwa' ? 'Solar Income Project' : asset === 'stocks' ? 'NVIDIA Exposure' : 'Fed Rate Cut · YES'
  return (
    <section className="screen success-screen has-fixed-cta">
      <div className="success-orb"><CircleCheck size={38} /></div>
      <p>ALLOCATION CONFIRMED</p><h1>Your position is reserved.</h1><span>{product} will appear in Portfolio after settlement.</span>
      <div className="success-receipt glass"><span><small>Order reference</small><b>RWA-240713-9284</b></span><span><small>Settled with</small><b>USDT Wallet</b></span><span><small>Next update</small><b>In 2–5 minutes</b></span></div>
      <button className="flow-cta" type="button" onClick={() => go('portfolio')}>View Portfolio <ArrowRight size={20} /></button>
      <button className="quiet-action" type="button" onClick={() => go('home')}>Back to Home</button>
    </section>
  )
}

function WalletFlowScreen({ mode, go, notify }: { mode: 'deposit' | 'withdraw' | 'transfer'; go: (screen: Screen) => void; notify: (message: string) => void }) {
  const copy = mode === 'deposit'
    ? { title: 'Deposit USDT', subtitle: 'Send USDT only on a supported network.', action: 'I have sent USDT' }
    : mode === 'withdraw'
      ? { title: 'Withdraw USDT', subtitle: 'Confirm the destination and network before you submit.', action: 'Review withdrawal' }
      : { title: 'Transfer USDT', subtitle: 'Instantly send USDT to another verified RWA.LAT user.', action: 'Review transfer' }
  return (
    <section className="screen wallet-flow-screen has-fixed-cta">
      <DetailHeader go={go} back="wallet" title={copy.title} />
      {mode === 'deposit' ? <><div className="network-selector"><button className="is-selected" type="button"><b>TRON</b><small>Low network cost</small><Check size={18} /></button><button type="button"><b>Ethereum</b><small>ERC-20</small></button><button type="button"><b>Arbitrum</b><small>Fast settlement</small></button></div><div className="qr-card glass"><div className="qr-grid" /><p>TRON USDT deposit address</p><b>TQx7d6k4...r1vZp</b><button type="button" onClick={() => notify('Deposit address copied')}><Copy size={18} />Copy address</button></div></> : <div className="wallet-form glass"><label>{mode === 'withdraw' ? 'Destination wallet' : 'Recipient'}<input placeholder={mode === 'withdraw' ? 'Paste a USDT address' : 'Email, username or wallet address'} /></label><label>Amount<input inputMode="decimal" placeholder="0.00" /><span>USDT</span></label><div className="form-balance">Available <b>12,540.20 USDT</b></div></div>}
      <div className="flow-note"><ShieldCheck size={18} /><span>{copy.subtitle}</span></div>
      <button className="flow-cta" type="button" onClick={() => mode === 'deposit' ? notify('Deposit tracking is active') : go('order-success')}>{copy.action}<ArrowRight size={20} /></button>
    </section>
  )
}

function ActivityScreen({ go }: { go: (screen: Screen) => void }) {
  const entries = [
    ['Deposit', 'TRON USDT', '+2,000.00 USDT', 'Today, 09:34', ArrowDownToLine],
    ['Investment', 'Solar Income Project', '-500.00 USDT', 'May 12, 14:18', TrendingUp],
    ['Compute revenue', 'H100 #23892', '+124.20 USDT', 'May 10, 08:45', Sparkles],
    ['Transfer', 'To Niko Alvarez', '-220.00 USDT', 'May 08, 16:22', ArrowRightLeft],
    ['Settlement', 'RWA coupon distribution', '+82.40 USDT', 'May 01, 00:04', CircleCheck],
  ] as const
  return <section className="screen activity-screen"><DetailHeader go={go} back="wallet" title="Activity" /><div className="activity-filter"><button className="is-active" type="button">All</button><button type="button">Wallet</button><button type="button">Investments</button><button type="button">Rewards</button></div><div className="activity-timeline">{entries.map(([name, detail, value, time, Icon]) => <div key={`${name}-${time}`} className="activity-timeline__row glass"><span><Icon size={20} /></span><p><b>{name}</b><small>{detail}</small></p><strong className={value.startsWith('+') ? 'mint' : ''}>{value}<small>{time}</small></strong></div>)}</div></section>
}

function AssetAccountScreen({ go, notify }: { go: (screen: Screen) => void; notify: (message: string) => void }) {
  return <section className="screen asset-account-screen"><DetailHeader go={go} back="wallet" title="USDT" /><div className="asset-account-balance"><span className="token token--usdt">T</span><p><small>Total USDT</small><b>12,540.20</b><span>≈ $12,538.90 USD</span></p></div><div className="network-balance-list glass"><button type="button"><span>TRON</span><b>8,420.20 USDT</b><ChevronRight size={18} /></button><button type="button"><span>Ethereum</span><b>2,610.00 USDT</b><ChevronRight size={18} /></button><button type="button"><span>Arbitrum</span><b>1,510.00 USDT</b><ChevronRight size={18} /></button></div><button className="wide-glass-action glass" type="button" onClick={() => notify('Your wallet address was copied')}><Copy size={20} /><span><b>Copy USDT wallet address</b><small>Use the right network when depositing.</small></span><ChevronRight size={20} /></button></section>
}

function PositionDetailScreen({ go, openOrder }: { go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void }) {
  return <section className="screen position-screen"><DetailHeader go={go} back="portfolio" title="Compute position" /><div className="position-hero glass"><AssetScene kind="compute" /><div><p>H100 Compute Unit</p><h1>2,430.00 <span>USDT</span></h1><b>+12.40 USDT today</b></div></div><div className="position-stats"><span><small>Daily revenue</small><b>12.40 USDT</b></span><span><small>Utilization</small><b>98.1%</b></span><span><small>Revenue earned</small><b>430.20 USDT</b></span></div><div className="yield-chart glass"><div className="yield-chart__head"><span>Revenue history</span><b>Last 30 days</b></div><div className="yield-chart__bars">{[36,48,42,61,57,69,76,73,84,80,93,88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div><button className="wide-glass-action glass" type="button" onClick={() => openOrder('compute')}><Cpu size={20} /><span><b>Add compute capacity</b><small>More capacity, same settlement wallet.</small></span><ChevronRight size={20} /></button></section>
}

function AiPlanScreen({ go, openOrder }: { go: (screen: Screen) => void; openOrder: (asset: OrderAsset) => void }) {
  const rows = [['AI Compute', '40%', 'compute'], ['RWA income', '30%', 'rwa'], ['Global stocks', '20%', 'stocks'], ['USDT reserve', '10%', 'prediction']] as const
  return <section className="screen ai-plan-screen has-fixed-cta"><DetailHeader go={go} back="ai" title="AI allocation plan" /><div className="plan-intro"><span><Sparkles size={24} /></span><p>10,000 USDT plan</p><h1>Yield first. Liquid by design.</h1><small>Generated from your risk score, current exposure and live opportunity data.</small></div><div className="plan-allocation glass">{rows.map(([name, percent, asset], index) => <button key={name} type="button" onClick={() => openOrder(asset)}><i className={`allocation-dot allocation-dot--${index}`} /><span><b>{name}</b><small>{index === 0 ? 'GPU infrastructure' : index === 1 ? 'Cash-flow assets' : index === 2 ? 'Growth exposure' : 'Liquidity buffer'}</small></span><strong>{percent}</strong><ChevronRight size={18} /></button>)}</div><div className="ai-evidence glass"><p><b>Why this mix</b><small>Compute demand is improving, RWA income lowers volatility, and USDT reserve protects execution flexibility.</small></p><TrendingUp size={22} /></div><button className="flow-cta" type="button" onClick={() => openOrder('compute')}>Review first allocation <ArrowRight size={20} /></button></section>
}

function NotificationsScreen({ go }: { go: (screen: Screen) => void }) {
  const items = [['Compute utilization crossed 98%', 'Your H100 unit produced 12.40 USDT today.', 'Now', Cpu], ['Solar Income distribution scheduled', 'Coupon settlement is expected on May 28.', '2h', Landmark], ['AI risk signal', 'NVIDIA concentration is approaching your preferred limit.', 'Yesterday', AlertTriangle]] as const
  return <section className="screen notifications-screen"><DetailHeader go={go} back="home" title="Notifications" /><div className="notification-list">{items.map(([title, detail, time, Icon]) => <button className="notification-row glass" type="button" key={title}><span><Icon size={20} /></span><p><b>{title}</b><small>{detail}</small></p><time>{time}</time></button>)}</div></section>
}

function AccountFlowScreen({ kind, go, notify }: { kind: 'kyc' | 'security' | 'referral' | 'records' | 'support' | 'settings'; go: (screen: Screen) => void; notify: (message: string) => void }) {
  const config = {
    kyc: { title: 'Identity & KYC', icon: ShieldCheck, overline: 'VERIFIED INVESTOR', heading: 'Your investment access is active.', body: 'Identity verification lets you invest in eligible RWA, compute and global market products.', action: 'View KYC details' },
    security: { title: 'Security', icon: KeyRound, overline: 'PROTECTED', heading: 'Your account is secured.', body: 'Passkey, biometric confirmation and device alerts protect important actions.', action: 'Manage security' },
    referral: { title: 'Referral rewards', icon: Sparkles, overline: 'INVITE & EARN', heading: 'Share access. Earn rewards.', body: 'Earn fee credits when a verified friend funds their wallet and completes an allocation.', action: 'Copy invite link' },
    records: { title: 'Transaction records', icon: ReceiptText, overline: 'ACCOUNT HISTORY', heading: 'Everything is traceable.', body: 'Downloadable confirmations are available for wallet movements, allocations and settlements.', action: 'Download statement' },
    support: { title: 'Support center', icon: Headphones, overline: 'WE ARE HERE', heading: 'Get help with a real issue.', body: 'Start with AI support for quick answers or create a tracked case for deposits, withdrawals and orders.', action: 'Start support case' },
    settings: { title: 'Settings', icon: Settings, overline: 'PREFERENCES', heading: 'Make the app yours.', body: 'Control language, notifications and your preferred security prompts.', action: 'Save preferences' },
  }[kind]
  const Icon = config.icon
  return (
    <section className="screen account-flow-screen has-fixed-cta">
      <DetailHeader go={go} back="profile" title={config.title} />
      <div className="account-flow-hero">
        <span><Icon size={30} /></span>
        <p>{config.overline}</p>
        <h1>{config.heading}</h1>
        <small>{config.body}</small>
      </div>

      {kind === 'security' && (
        <div className="setting-stack glass">
          <button type="button"><KeyRound size={20} /><span><b>Passkey</b><small>Enabled on this device</small></span><CircleCheck size={19} /></button>
          <button type="button"><Bot size={20} /><span><b>Biometric approval</b><small>Required for investments and withdrawals</small></span><CircleCheck size={19} /></button>
          <button type="button"><Clock3 size={20} /><span><b>Device alerts</b><small>Three active sessions</small></span><ChevronRight size={19} /></button>
        </div>
      )}

      {kind === 'kyc' && (
        <div className="kyc-steps glass">
          <span className="is-complete"><Check size={17} />Identity verified</span>
          <span className="is-complete"><Check size={17} />Risk profile completed</span>
          <span className="is-complete"><Check size={17} />USDT wallet approved</span>
          <span><Clock3 size={17} />Address refresh due in 2027</span>
        </div>
      )}

      {kind === 'referral' && (
        <>
          <div className="referral-code glass"><small>Your invitation code</small><b>RWA-KEPLER-92</b><span>Reward credit earned: <strong>84.20 USDT</strong></span></div>
          <div className="reward-grid">
            <span><small>Invited</small><b>12</b></span>
            <span><small>Verified</small><b>7</b></span>
            <span><small>Pending</small><b>3</b></span>
          </div>
        </>
      )}

      {kind === 'records' && (
        <div className="record-stack glass">
          <button type="button"><ReceiptText size={20} /><span><b>RWA subscription</b><small>Solar Income Project · 500.00 USDT</small></span><strong>Settled</strong></button>
          <button type="button"><Cpu size={20} /><span><b>Compute revenue</b><small>H100 #23892 · Daily settlement</small></span><strong className="mint">+12.40</strong></button>
          <button type="button"><CircleDollarSign size={20} /><span><b>Wallet deposit</b><small>TRON USDT · TQx7...8vZp</small></span><strong className="mint">+2,000</strong></button>
        </div>
      )}

      {kind === 'support' && (
        <div className="support-stack">
          <button className="support-card glass" type="button"><MessageCircle size={22} /><span><b>AI support</b><small>Get an immediate answer for wallet, KYC and order questions.</small></span><ChevronRight size={19} /></button>
          <button className="support-card glass" type="button"><ScanLine size={22} /><span><b>Dispute an order</b><small>Attach an order reference and track the case in app.</small></span><ChevronRight size={19} /></button>
          <button className="support-card glass" type="button"><Headphones size={22} /><span><b>Human review</b><small>Priority support for withdrawal and settlement issues.</small></span><ChevronRight size={19} /></button>
        </div>
      )}

      {kind === 'settings' && (
        <div className="setting-stack glass">
          <button type="button"><Network size={20} /><span><b>Language</b><small>English · 中文 · Español · Français</small></span><ChevronRight size={19} /></button>
          <button type="button"><Bell size={20} /><span><b>Market notifications</b><small>Signals, order states and settlement alerts</small></span><Check size={19} /></button>
          <button type="button"><Upload size={20} /><span><b>Fiat entry</b><small>Reserved for card and bank transfer</small></span><ChevronRight size={19} /></button>
        </div>
      )}

      <button className="flow-cta" type="button" onClick={() => notify(`${config.title} opened`)}>{config.action}<ArrowRight size={20} /></button>
    </section>
  )
}

export default function RwaH5() {
  const [screen, setScreen] = useState<Screen>('home')
  const [toast, setToast] = useState<string | null>(null)
  const [orderAsset, setOrderAsset] = useState<OrderAsset>('compute')
  const [orderAmount, setOrderAmount] = useState(1000)
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
  const openOrder = (asset: OrderAsset) => {
    setOrderAsset(asset)
    setOrderAmount(asset === 'prediction' ? 250 : asset === 'stocks' ? 500 : asset === 'rwa' ? 500 : 1000)
    go('order-review')
  }
  const showDock = !['rwa-detail', 'compute-detail', 'stock-detail', 'prediction-detail', 'order-review', 'order-success', 'deposit', 'withdraw', 'transfer', 'activity', 'asset-detail', 'position-detail', 'ai-plan', 'notifications', 'kyc', 'security', 'referral', 'records', 'support', 'settings'].includes(screen)
  return (
    <main className="rwa-shell">
      <div className={`rwa-mobile ${showDock ? '' : 'rwa-mobile--detail'}`} data-screen={screen}>
        {screen === 'home' && <HomeScreen go={go} notify={notify} />}
        {screen === 'invest' && <InvestScreen go={go} notify={notify} />}
        {screen === 'portfolio' && <PortfolioScreen go={go} notify={notify} />}
        {screen === 'wallet' && <WalletScreen go={go} notify={notify} />}
        {screen === 'rwa-detail' && <RwaDetailScreen go={go} notify={notify} openOrder={openOrder} />}
        {screen === 'compute-detail' && <AssetDetailScreen asset="compute" go={go} openOrder={openOrder} notify={notify} />}
        {screen === 'stock-detail' && <AssetDetailScreen asset="stocks" go={go} openOrder={openOrder} notify={notify} />}
        {screen === 'prediction-detail' && <AssetDetailScreen asset="prediction" go={go} openOrder={openOrder} notify={notify} />}
        {screen === 'order-review' && <OrderReviewScreen asset={orderAsset} go={go} amount={orderAmount} setAmount={setOrderAmount} />}
        {screen === 'order-success' && <OrderSuccessScreen asset={orderAsset} go={go} />}
        {screen === 'deposit' && <WalletFlowScreen mode="deposit" go={go} notify={notify} />}
        {screen === 'withdraw' && <WalletFlowScreen mode="withdraw" go={go} notify={notify} />}
        {screen === 'transfer' && <WalletFlowScreen mode="transfer" go={go} notify={notify} />}
        {screen === 'activity' && <ActivityScreen go={go} />}
        {screen === 'asset-detail' && <AssetAccountScreen go={go} notify={notify} />}
        {screen === 'position-detail' && <PositionDetailScreen go={go} openOrder={openOrder} />}
        {screen === 'ai-plan' && <AiPlanScreen go={go} openOrder={openOrder} />}
        {screen === 'notifications' && <NotificationsScreen go={go} />}
        {screen === 'kyc' && <AccountFlowScreen kind="kyc" go={go} notify={notify} />}
        {screen === 'security' && <AccountFlowScreen kind="security" go={go} notify={notify} />}
        {screen === 'referral' && <AccountFlowScreen kind="referral" go={go} notify={notify} />}
        {screen === 'records' && <AccountFlowScreen kind="records" go={go} notify={notify} />}
        {screen === 'support' && <AccountFlowScreen kind="support" go={go} notify={notify} />}
        {screen === 'settings' && <AccountFlowScreen kind="settings" go={go} notify={notify} />}
        {screen === 'ai' && <AiScreen go={go} notify={notify} />}
        {screen === 'profile' && <ProfileScreen go={go} notify={notify} />}
        {showDock && <BottomDock screen={screen} setScreen={go} />}
      </div>
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </main>
  )
}
