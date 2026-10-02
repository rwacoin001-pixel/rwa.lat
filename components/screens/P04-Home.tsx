'use client'

import { useEffect, useState, type ReactNode, useRef } from 'react'
import { ArrowRight, ArrowUpRight, ChartNoAxesColumnIncreasing, CircleGauge, Coins, Eye, EyeOff, Landmark, Layers3, Search, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import type { RwaScreen } from '@/lib/rwa-routes'
import { useQuery } from '@/lib/api/_query'
import { getRankings, getRwaOverview } from '@/lib/api/rwa'
import { POLL, request } from '@/lib/api/_http'
import { fmtPct, fmtUsd } from '@/lib/money'
import { getWallet, toUnits as walletUnits, type WalletView } from '@/lib/wallet-data'
import { resolveHomeState, heroCta, homeBlocks } from '@/lib/home-lifecycle'
import { getSessionView, getKycStatus, type SessionView, type KycStatusView } from '@/lib/session-data'
import { routePath } from '@/lib/routes-v2'
import { getPositions } from '@/lib/portfolio-data'
import { isAuthenticated } from '@/lib/h5-data'
import { useUnread } from '@/hooks/useUnread'
import { useSignedIn } from '@/hooks/useAccount'
import { useScrollChrome } from '@/hooks/useScrollChrome'
import RwaTopbar from '@/components/rwa-topbar'
import { ErrorBlock } from '@/components/ui/ErrorBlock'
import {communityExperienceCopy} from '@/lib/community-experience-copy'
import { HomeSocialFeed } from '@/components/home/HomeSocialFeed'
import { HomeMarketLens } from '@/components/home/HomeMarketLens'
import { HomeTradingView } from '@/components/home/HomeTradingView'
import { HomePolymarket } from '@/components/home/HomePolymarket'
import { homeStateCopy } from '@/components/home/home-state-copy'
import AnimatedContent from '@/components/AnimatedContent'
import SpotlightCard from '@/components/SpotlightCard'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { homeDataCopy } from '@/lib/route-copy'
import styles from './P04-Home.module.css'

type Copy = {
  headline: string; perspective: string; kicker: string; sub: string; search: string
  pulse: string; tracked: string; volume: string; assets: string; issuers: string; updated: string
  forYou: string; portfolio: string; signIn: string; unavailable: string; holdings: string; available: string
  baskets: string; basketEmpty: string; featured: string; marketCap: string; change24h: string
  prediction: string; predictionEmpty: string; yield: string; yieldBody: string
  community: string; communityEmpty: string; communityBody: string; trust: string; trustBody: string
  all: string; dataUnavailable: string
}

export const copyByLocale: Record<AppLocale, Copy> = {
  en: { headline: 'Real Assets', perspective: 'Real Freedom.', kicker: 'INVEST IN WHAT MATTERS', sub: 'A MORE OPEN FINANCIAL WORLD', search: 'Search assets, markets…', pulse: 'Market Pulse', tracked: 'Total tracked value', volume: '24h volume', assets: 'Assets tracked', issuers: 'Issuers', updated: 'Data as of', forYou: 'For You', portfolio: 'Your portfolio', signIn: 'Sign in to see your assets', unavailable: 'Account data unavailable', holdings: 'Holdings', available: 'Available', baskets: 'Explore portfolios', basketEmpty: 'Explore real asset strategies', featured: 'Featured Assets', marketCap: 'Market cap', change24h: '24h change', prediction: 'Prediction', predictionEmpty: 'No active markets right now', yield: 'Yield', yieldBody: 'Distribution data will appear here when available.', community: 'Community', communityEmpty: 'No community posts yet', communityBody: 'New community updates will appear here.', trust: 'Trust', trustBody: 'Custody · Disclosures · Security', all: 'View all', dataUnavailable: 'Live data unavailable' },
  'zh-CN': { headline: '真实资产', perspective: '自由未来。', kicker: '投资真正重要的事物', sub: '一个更开放的金融世界', search: '搜索资产和市场…', pulse: '市场脉搏', tracked: '追踪资产总值', volume: '24 小时成交额', assets: '追踪资产', issuers: '发行方', updated: '数据截至', forYou: '为你精选', portfolio: '我的资产组合', signIn: '登录后查看个人资产', unavailable: '账户数据暂不可用', holdings: '持仓', available: '可用资金', baskets: '探索组合', basketEmpty: '探索真实资产策略', featured: '精选资产', marketCap: '市值', change24h: '24 小时涨跌', prediction: '预测市场', predictionEmpty: '暂无活跃市场', yield: '收益', yieldBody: '可用时将在这里展示分配数据。', community: '社区', communityEmpty: '暂无社区动态', communityBody: '新的社区动态会显示在这里。', trust: '信任', trustBody: '托管 · 披露 · 安全', all: '查看全部', dataUnavailable: '实时数据暂不可用' },
  hi: { headline: 'वास्तविक संपत्ति', perspective: 'वास्तविक स्वतंत्रता।', kicker: 'जो मायने रखता है उसमें निवेश', sub: 'एक अधिक खुली वित्तीय दुनिया', search: 'संपत्ति और बाज़ार खोजें…', pulse: 'बाज़ार की धड़कन', tracked: 'कुल ट्रैक किया गया मूल्य', volume: '24 घंटे का वॉल्यूम', assets: 'संपत्तियाँ', issuers: 'जारीकर्ता', updated: 'डेटा समय', forYou: 'आपके लिए', portfolio: 'आपका पोर्टफोलियो', signIn: 'अपनी संपत्ति देखने के लिए साइन इन करें', unavailable: 'खाता डेटा उपलब्ध नहीं', holdings: 'होल्डिंग्स', available: 'उपलब्ध', baskets: 'पोर्टफोलियो देखें', basketEmpty: 'वास्तविक संपत्ति रणनीतियाँ देखें', featured: 'चुनिंदा संपत्तियाँ', marketCap: 'बाज़ार पूंजीकरण', change24h: '24 घंटे का बदलाव', prediction: 'पूर्वानुमान', predictionEmpty: 'अभी कोई सक्रिय बाज़ार नहीं', yield: 'प्रतिफल', yieldBody: 'उपलब्ध होने पर वितरण डेटा यहाँ दिखेगा।', community: 'समुदाय', communityEmpty: 'अभी कोई पोस्ट नहीं', communityBody: 'नए अपडेट यहाँ दिखाई देंगे।', trust: 'विश्वास', trustBody: 'कस्टडी · खुलासे · सुरक्षा', all: 'सभी देखें', dataUnavailable: 'लाइव डेटा उपलब्ध नहीं' },
  es: { headline: 'Activos reales', perspective: 'Libertad real.', kicker: 'INVIERTE EN LO QUE IMPORTA', sub: 'UN MUNDO FINANCIERO MÁS ABIERTO', search: 'Buscar activos y mercados…', pulse: 'Pulso del mercado', tracked: 'Valor total seguido', volume: 'Volumen 24 h', assets: 'Activos seguidos', issuers: 'Emisores', updated: 'Datos a', forYou: 'Para ti', portfolio: 'Tu cartera', signIn: 'Inicia sesión para ver tus activos', unavailable: 'Datos de cuenta no disponibles', holdings: 'Posiciones', available: 'Disponible', baskets: 'Explorar carteras', basketEmpty: 'Explora estrategias de activos reales', featured: 'Activos destacados', marketCap: 'Capitalización', change24h: 'Cambio 24 h', prediction: 'Predicción', predictionEmpty: 'No hay mercados activos', yield: 'Rendimiento', yieldBody: 'Las distribuciones aparecerán aquí cuando estén disponibles.', community: 'Comunidad', communityEmpty: 'Sin publicaciones', communityBody: 'Las novedades aparecerán aquí.', trust: 'Confianza', trustBody: 'Custodia · Información · Seguridad', all: 'Ver todo', dataUnavailable: 'Datos en vivo no disponibles' },
  ar: { headline: 'أصول حقيقية', perspective: 'حرية حقيقية.', kicker: 'استثمر فيما يهم', sub: 'عالم مالي أكثر انفتاحاً', search: 'ابحث عن الأصول والأسواق…', pulse: 'نبض السوق', tracked: 'إجمالي القيمة المتتبعة', volume: 'حجم 24 ساعة', assets: 'الأصول المتتبعة', issuers: 'المُصدرون', updated: 'البيانات حتى', forYou: 'من أجلك', portfolio: 'محفظتك', signIn: 'سجّل الدخول لعرض أصولك', unavailable: 'بيانات الحساب غير متاحة', holdings: 'الحيازات', available: 'المتاح', baskets: 'استكشف المحافظ', basketEmpty: 'استكشف استراتيجيات الأصول الحقيقية', featured: 'أصول مميزة', marketCap: 'القيمة السوقية', change24h: 'تغير 24 ساعة', prediction: 'التوقعات', predictionEmpty: 'لا توجد أسواق نشطة الآن', yield: 'العوائد', yieldBody: 'ستظهر بيانات التوزيع هنا عند توفرها.', community: 'المجتمع', communityEmpty: 'لا توجد منشورات بعد', communityBody: 'ستظهر التحديثات الجديدة هنا.', trust: 'الثقة', trustBody: 'الحفظ · الإفصاح · الأمان', all: 'عرض الكل', dataUnavailable: 'البيانات المباشرة غير متاحة' },
  fr: { headline: 'Actifs réels', perspective: 'Vraie liberté.', kicker: 'INVESTIR DANS CE QUI COMPTE', sub: 'UN MONDE FINANCIER PLUS OUVERT', search: 'Rechercher actifs et marchés…', pulse: 'Pouls du marché', tracked: 'Valeur totale suivie', volume: 'Volume sur 24 h', assets: 'Actifs suivis', issuers: 'Émetteurs', updated: 'Données au', forYou: 'Pour vous', portfolio: 'Votre portefeuille', signIn: 'Connectez-vous pour voir vos actifs', unavailable: 'Données du compte indisponibles', holdings: 'Positions', available: 'Disponible', baskets: 'Explorer les portefeuilles', basketEmpty: 'Découvrez des stratégies d’actifs réels', featured: 'Actifs sélectionnés', marketCap: 'Capitalisation', change24h: 'Variation 24 h', prediction: 'Prédiction', predictionEmpty: 'Aucun marché actif', yield: 'Rendement', yieldBody: 'Les distributions apparaîtront ici lorsqu’elles seront disponibles.', community: 'Communauté', communityEmpty: 'Aucune publication', communityBody: 'Les nouveautés apparaîtront ici.', trust: 'Confiance', trustBody: 'Conservation · Transparence · Sécurité', all: 'Tout voir', dataUnavailable: 'Données en direct indisponibles' },
  pt: { headline: 'Ativos reais', perspective: 'Liberdade real.', kicker: 'INVISTA NO QUE IMPORTA', sub: 'UM MUNDO FINANCEIRO MAIS ABERTO', search: 'Buscar ativos e mercados…', pulse: 'Pulso do mercado', tracked: 'Valor total acompanhado', volume: 'Volume em 24 h', assets: 'Ativos acompanhados', issuers: 'Emissores', updated: 'Dados em', forYou: 'Para você', portfolio: 'Seu portfólio', signIn: 'Entre para ver seus ativos', unavailable: 'Dados da conta indisponíveis', holdings: 'Posições', available: 'Disponível', baskets: 'Explorar portfólios', basketEmpty: 'Explore estratégias de ativos reais', featured: 'Ativos em destaque', marketCap: 'Valor de mercado', change24h: 'Variação 24 h', prediction: 'Previsão', predictionEmpty: 'Nenhum mercado ativo', yield: 'Rendimento', yieldBody: 'As distribuições aparecerão aqui quando disponíveis.', community: 'Comunidade', communityEmpty: 'Ainda não há publicações', communityBody: 'Novas atualizações aparecerão aqui.', trust: 'Confiança', trustBody: 'Custódia · Divulgação · Segurança', all: 'Ver tudo', dataUnavailable: 'Dados ao vivo indisponíveis' },
}

export const ctaText: Record<AppLocale, Record<string, string>> = {
  en: { register: 'Create account', verifyEmail: 'Verify email', continueKyc: 'Continue verification', deposit: 'Add funds', browseBaskets: 'Browse baskets', viewOrders: 'View orders' },
  'zh-CN': { register: '创建账户', verifyEmail: '验证邮箱', continueKyc: '继续认证', deposit: '充值', browseBaskets: '浏览篮子', viewOrders: '查看订单' },
  hi: { register: 'खाता बनाएँ', verifyEmail: 'ईमेल सत्यापित करें', continueKyc: 'सत्यापन जारी रखें', deposit: 'धन जोड़ें', browseBaskets: 'बास्केट देखें', viewOrders: 'ऑर्डर देखें' },
  es: { register: 'Crear cuenta', verifyEmail: 'Verificar correo', continueKyc: 'Continuar verificación', deposit: 'Añadir fondos', browseBaskets: 'Ver cestas', viewOrders: 'Ver órdenes' },
  ar: { register: 'إنشاء حساب', verifyEmail: 'تأكيد البريد', continueKyc: 'متابعة التحقق', deposit: 'إضافة أموال', browseBaskets: 'تصفح السلال', viewOrders: 'عرض الطلبات' },
  fr: { register: 'Créer un compte', verifyEmail: "Vérifier l'email", continueKyc: 'Continuer la vérification', deposit: 'Ajouter des fonds', browseBaskets: 'Parcourir les paniers', viewOrders: 'Voir les ordres' },
  pt: { register: 'Criar conta', verifyEmail: 'Verificar email', continueKyc: 'Continuar verificação', deposit: 'Adicionar fundos', browseBaskets: 'Ver cestas', viewOrders: 'Ver ordens' },
}

export const utilityCopy: Record<AppLocale, { showBalance: string; hideBalance: string; loading: string; retry: string; end: string; marketSignal: string }> = {
  en: { showBalance: 'Show balance', hideBalance: 'Hide balance', loading: 'Loading…', retry: 'Failed to load, tap to retry', end: 'End of feed', marketSignal: 'MARKET SIGNAL' },
  'zh-CN': { showBalance: '显示余额', hideBalance: '隐藏余额', loading: '加载中…', retry: '加载失败，点击重试', end: '已到底部', marketSignal: '市场信号' },
  hi: { showBalance: 'शेष राशि दिखाएँ', hideBalance: 'शेष राशि छिपाएँ', loading: 'लोड हो रहा है…', retry: 'लोड नहीं हुआ, फिर प्रयास करें', end: 'फ़ीड समाप्त', marketSignal: 'बाज़ार संकेत' },
  es: { showBalance: 'Mostrar saldo', hideBalance: 'Ocultar saldo', loading: 'Cargando…', retry: 'Error al cargar, toca para reintentar', end: 'Fin del feed', marketSignal: 'SEÑAL DE MERCADO' },
  ar: { showBalance: 'إظهار الرصيد', hideBalance: 'إخفاء الرصيد', loading: 'جارٍ التحميل…', retry: 'تعذر التحميل، اضغط لإعادة المحاولة', end: 'نهاية المنشورات', marketSignal: 'إشارة السوق' },
  fr: { showBalance: 'Afficher le solde', hideBalance: 'Masquer le solde', loading: 'Chargement…', retry: 'Échec du chargement, réessayer', end: 'Fin du fil', marketSignal: 'SIGNAL DU MARCHÉ' },
  pt: { showBalance: 'Mostrar saldo', hideBalance: 'Ocultar saldo', loading: 'Carregando…', retry: 'Falha ao carregar, toque para tentar novamente', end: 'Fim do feed', marketSignal: 'SINAL DE MERCADO' },
}

export const feedAll: Record<AppLocale, string> = { en: 'All', 'zh-CN': '全部', hi: 'सभी', es: 'Todo', ar: 'الكل', fr: 'Tout', pt: 'Tudo' }

type HomeAccountSnapshot = { totalAssets: number; available: number | null; holdings: number }
type FeaturedAsset = { slug: string; name: string; symbol?: string; logoUrl?: string; assetClass?: string; priceUsd?: string | null; marketCapUsd?: string | null; change24hPct?: string | null }
type PredictionItem = { id: string; question: string }

function walletTotal(wallet: WalletView) {
  const decimals = wallet.asset.decimals
  return [wallet.balances.availableAtomic, wallet.balances.lockedAtomic, wallet.balances.pendingAtomic, wallet.balances.investedAtomic, wallet.balances.rewardPayableAtomic]
    .reduce((total, atomic) => total + walletUnits(atomic, decimals), 0)
}

function assetKind(asset: { slug?: string; name?: string }, index = 0): 'treasury' | 'gold' | 'credit' | 'generic' {
  const label = `${asset.slug ?? ''} ${asset.name ?? ''}`.toLowerCase()
  if (label.includes('gold') || label.includes('metal')) return 'gold'
  if (label.includes('credit') || label.includes('bond')) return 'credit'
  if (label.includes('treasury') || label.includes('tbill') || label.includes('t-bill')) return 'treasury'
  return index % 2 ? 'gold' : 'generic'
}

function assetImage(asset: FeaturedAsset, index: number) {
  const kind = (asset.assetClass ?? '').toLowerCase()
  if (kind === 'treasury' || kind === 'bond') return index % 2 ? '/media/home/asset-treasury-paper.webp' : '/media/generated/design-v2/treasury-architecture-v1.png'
  if (kind === 'real_estate') return '/media/home/asset-real-estate.webp'
  if (kind === 'infrastructure') return '/media/home/asset-infrastructure.webp'
  return null
}

function AssetGlyph({ kind }: { kind: ReturnType<typeof assetKind> }) {
  const Icon: LucideIcon = kind === 'treasury' ? Landmark : kind === 'gold' ? Coins : kind === 'credit' ? CircleGauge : Layers3
  return <span className={styles.assetGlyph} aria-hidden="true"><Icon size={20} strokeWidth={1.6} /></span>
}

function Reveal({ children, reduced, className }: { children: ReactNode; reduced: boolean | null; className?: string }) {
  if (reduced) return <div className={className}>{children}</div>
  return <AnimatedContent className={className} distance={22} duration={1.05} ease="power3.out" threshold={0.08} animateOpacity>{children}</AnimatedContent>
}

function SectionHeading({ title, onMore, more }: { title: string; onMore?: () => void; more?: string }) {
  return <div className={styles.sectionHeading}><h2>{title}</h2>{onMore && <button type="button" onClick={onMore}>{more}<ArrowUpRight size={17} /></button>}</div>
}

export function HomeScreen({ go }: { go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const copy = copyByLocale[locale]
  const utility = utilityCopy[locale]
  const dataCopy = homeDataCopy[locale]
  const router = useRouter()
  const reduced = useReducedMotion()
  const signedIn = useSignedIn()
  const { unread } = useUnread(signedIn)
  const overview = useQuery('rwa:overview', getRwaOverview, { pollInterval: POLL.quote })
  const featured = useQuery('rwa:featured:8', () => request<{ items: FeaturedAsset[] }>('/v1/rwa/assets?featured=true&limit=8'), { staleTime: 60_000, pollInterval: POLL.list })
  const baskets = useQuery('basket:portfolios:home', () => request<unknown>('/v1/basket/portfolios'), { staleTime: 60_000, pollInterval: POLL.list })
  const predictions = useQuery('predict:active:3', () => request<PredictionItem[] | { items?: PredictionItem[] }>('/v1/polymarket/markets?state=active&limit=3'), { staleTime: 60_000, pollInterval: POLL.quote })
  const rankings = useQuery('rwa:rankings:market_cap:3', () => getRankings('market_cap', 3), { pollInterval: POLL.list })
  const [account, setAccount] = useState<HomeAccountSnapshot | null>(null)
  const [hideBalance, setHideBalance] = useState(false)
  const [sessionProbe, setSessionProbe] = useState<{ status: 'loading' | 'guest' | 'ok' | 'error'; view: SessionView | null }>({ status: 'loading', view: null })
  const [kycView, setKycView] = useState<KycStatusView | null>(null)
  const [walletSnapshot, setWalletSnapshot] = useState<{ available: number; locked: number; pending: number; invested: number } | null>(null)
  const [positionsCount, setPositionsCount] = useState<number | null>(null)
  const topbarHidden = useScrollChrome()

  useEffect(() => {
    let cancelled = false
    if (!isAuthenticated()) {
      setSessionProbe({ status: 'guest', view: null })
      return
    }
    Promise.allSettled([getWallet(), getPositions(), getSessionView(), getKycStatus()]).then(([walletResult, positionsResult, sessionResult, kycResult]) => {
      if (cancelled) return
      const wallet = walletResult.status === 'fulfilled' ? walletResult.value : null
      const positions = positionsResult.status === 'fulfilled' ? positionsResult.value : []
      if (wallet || positionsResult.status === 'fulfilled') {
        setAccount({
          totalAssets: wallet ? walletTotal(wallet) : positions.reduce((sum, position) => sum + position.marketValue, 0),
          available: wallet ? walletUnits(wallet.balances.availableAtomic, wallet.asset.decimals) : null,
          holdings: positions.length,
        })
      }
      if (wallet) setWalletSnapshot({
        available: walletUnits(wallet.balances.availableAtomic, wallet.asset.decimals),
        locked: walletUnits(wallet.balances.lockedAtomic, wallet.asset.decimals),
        pending: walletUnits(wallet.balances.pendingAtomic, wallet.asset.decimals),
        invested: walletUnits(wallet.balances.investedAtomic, wallet.asset.decimals),
      })
      if (positionsResult.status === 'fulfilled') setPositionsCount(positions.length)
      setSessionProbe(sessionResult.status === 'fulfilled' ? { status: 'ok', view: sessionResult.value } : { status: 'error', view: null })
      setKycView(kycResult.status === 'fulfilled' ? (kycResult.value ?? null) : null)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (sessionProbe.status !== 'error') return
    let cancelled = false
    let inFlight = false
    const retry = () => {
      if (inFlight) return
      inFlight = true
      void getSessionView().then((view) => {
        if (!cancelled) setSessionProbe({ status: 'ok', view })
      }).catch(() => undefined).finally(() => { inFlight = false })
    }
    const timer = window.setInterval(retry, 5000)
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('online', retry); window.removeEventListener('focus', retry) }
  }, [sessionProbe.status])

  const state = resolveHomeState({
    sessionLoaded: sessionProbe.status !== 'loading',
    sessionFailed: sessionProbe.status === 'error',
    session: sessionProbe.status === 'ok' && sessionProbe.view ? { emailVerified: sessionProbe.view.emailVerified } : null,
    wallet: walletSnapshot,
    kyc: kycView ? { state: kycView.state } : null,
    positionsCount,
  })
  // Keep the scene anchored while the opaque content gradually covers it.
  const heroBgRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = heroBgRef.current
        if (el) el.style.transform = `translate3d(0,${(-Math.min(window.scrollY, 900) * .08).toFixed(1)}px,0)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])
  const mainCta = heroCta(state)
  const ctaLabel = mainCta ? ctaText[locale][mainCta.kind] : null
  const openMainCta = () => {
    if (!mainCta) return
    const path = routePath(mainCta.routeKey as never)
    router.push(mainCta.query ? `${path}?${mainCta.query}` : path)
  }

  const overviewData = overview.data ?? {}
  const marketCap = overviewData.totalMarketCapUsd == null ? '—' : fmtUsd(String(overviewData.totalMarketCapUsd), { compact: true, locale })
  const volume24h = overviewData.totalVolume24hUsd == null ? '—' : fmtUsd(String(overviewData.totalVolume24hUsd), { compact: true, locale })
  const asOf = typeof overviewData.latestDataTimestamp === 'string' && !Number.isNaN(Date.parse(overviewData.latestDataTimestamp))
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(overviewData.latestDataTimestamp))
    : '—'
  const basketData = baskets.data
  const basketItems = Array.isArray(basketData) ? basketData : basketData && typeof basketData === 'object' ? ((basketData as Record<string, unknown>).items ?? (basketData as Record<string, unknown>).portfolios) : null
  const firstBasket = Array.isArray(basketItems) && basketItems.length ? basketItems[0] as Record<string, unknown> : null
  const basketName = firstBasket && typeof firstBasket.name === 'string' ? firstBasket.name : firstBasket && typeof firstBasket.displayName === 'string' ? firstBasket.displayName : copy.baskets
  const featuredItems = featured.data?.items?.slice(0, 5) ?? []
  const predictionData = predictions.data
  const predictionItems = Array.isArray(predictionData) ? predictionData : predictionData?.items ?? []
  const blocks = homeBlocks(state)
  const stateLabels = homeStateCopy[locale]
  const statusLabel = state.variant ? stateLabels.variant[state.variant] : state.degraded ? stateLabels.degraded : stateLabels.lifecycle[state.lifecycle]
  const portfolioAccount = state.lifecycle === 'funded' || state.lifecycle === 'invested' ? account : null

  return <section className={`screen s2-home ${styles.root}`} data-home-s2="true" data-home-design="s3-premium" data-home-lifecycle={state.lifecycle} data-home-variant={state.variant ?? 'none'} data-topbar-hidden={topbarHidden}>
    <div className={styles.heroBg} ref={heroBgRef} aria-hidden="true" />
    <RwaTopbar screen="home" surface="transparent-over-media" badge={{ slot: 'R1', count: unread }} />
    <div className={styles.hero}>
      <div className={styles.heroMeta}><span>RWA.LAT / 01</span></div>
      <div className={styles.heroCopy}>
        <span className={styles.heroKicker}>{copy.kicker}</span>
        <h1 className={styles.heroTitle}>{copy.headline}<br />{copy.perspective}</h1>
        <span className={styles.heroSub}>{copy.sub}</span>
      </div>
    </div>

    <div className={styles.content}>
      {blocks.includes('portfolioSummary') && <SpotlightCard className={styles.portfolioFloat} spotlightColor="rgba(255, 255, 255, 0.17)" data-lifecycle={state.lifecycle}>
        <div className={styles.accountTop}><span>{copy.portfolio}</span>{portfolioAccount && <button type="button" onClick={() => setHideBalance(value => !value)} aria-label={hideBalance ? utility.showBalance : utility.hideBalance}>{hideBalance ? <EyeOff size={17} /> : <Eye size={17} />}</button>}</div>
        <strong className={`${styles.portfolioStatus} ${portfolioAccount ? styles.portfolioStatusWithValue : ''}`} aria-live="polite">{statusLabel}</strong>
        {portfolioAccount && <>
          <strong className={styles.portfolioValue} dir="ltr">{hideBalance ? '••••••' : fmtUsd(String(portfolioAccount.totalAssets), { locale })}</strong>
          <div className={`${styles.portfolioFoot} ${state.lifecycle === 'funded' ? styles.portfolioFootTwo : ''}`}><span><b>{portfolioAccount.holdings}</b><small>{copy.holdings}</small></span><span><b>{portfolioAccount.available == null ? '—' : hideBalance ? '••' : fmtUsd(String(portfolioAccount.available), { compact: true, locale })}</b><small>{copy.available}</small></span>{state.lifecycle === 'invested' && <button type="button" onClick={() => go('portfolio')} aria-label={copy.portfolio}><ArrowUpRight size={19} /></button>}</div>
        </>}
        {mainCta && ctaLabel && <motion.button type="button" className={styles.portfolioCta} onClick={openMainCta} whileTap={reduced ? undefined : { scale: .96 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}>{ctaLabel}<ArrowUpRight size={17} /></motion.button>}
      </SpotlightCard>}
      <section className={styles.pulseSection} aria-label={copy.pulse}>
        <SpotlightCard className={styles.pulseCard} spotlightColor="rgba(255, 255, 255, 0.14)">
          <div className={styles.pulseTop}><span className={styles.eyebrow}>{copy.pulse}</span><span className={styles.liveDot} aria-hidden="true" /></div>
          <p className={styles.metricLabel}>{copy.tracked}</p>
          <strong className={styles.pulseValue} data-testid="home-total" dir="ltr">{marketCap}</strong>
          {overview.error && <ErrorBlock message={overview.error.message} retry={overview.refetch} />}
          <div className={styles.pulseStats}>
            <span><b dir="ltr">{volume24h}</b><small>{copy.volume}</small></span>
            <span><b dir="ltr">{overviewData.assetCount ?? '—'}</b><small>{copy.assets}</small></span>
            <span><b dir="ltr">{overviewData.issuerCount ?? '—'}</b><small>{copy.issuers}</small></span>
          </div>
          <div className={styles.asOf}>{copy.updated} <time>{asOf}</time></div>
        </SpotlightCard>
        <div className={styles.rankingWrap}>
          {rankings.loading ? <div className={styles.skeleton} /> : rankings.error ? <ErrorBlock message={rankings.error.message} retry={rankings.refetch} /> : rankings.data?.items?.map((asset, index) => (
            <button type="button" key={asset.slug} className={styles.rankingRow} onClick={() => router.push(`/asset/${encodeURIComponent(asset.slug)}`)}>
              <span className={styles.rankIndex}>0{index + 1}</span><span className={styles.rankName}><b>{asset.name}</b><small>{asset.symbol || 'RWA'}</small></span>
              <span className={styles.rankValue}><b dir="ltr">{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</b><small dir="ltr" className={asset.change24hPct?.startsWith('-') ? styles.down : styles.up}>{fmtPct(asset.change24hPct, { signed: true })}</small></span>
            </button>
          ))}
        </div>
      </section>

      <Reveal reduced={reduced} className={styles.section}><SectionHeading title={copy.forYou} />
        <motion.button type="button" className={styles.basketCard} onClick={() => go('basket-list')} whileTap={reduced ? undefined : { scale: .975, rotate: -.3 }} whileHover={reduced ? undefined : { y: -4 }} transition={{ type: 'spring', stiffness: 360, damping: 24 }}>
          <span className={styles.eyebrow}>AI / RWA</span><strong>{basketName}</strong><small>{firstBasket && typeof firstBasket.summary === 'string' ? firstBasket.summary : copy.basketEmpty}</small><span className={styles.basketArrow}><ArrowUpRight size={19} /></span>
        </motion.button>
      </Reveal>

      <Reveal reduced={reduced} className={styles.section}><SectionHeading title={copy.featured} onMore={() => go('invest')} more={copy.all} />
        {featured.loading ? <div className={styles.skeleton} /> : featured.error ? <ErrorBlock message={featured.error.message} retry={featured.refetch} /> : featuredItems.length ? <div className={styles.featuredGrid}>
          {featuredItems.map((asset, index) => <motion.button type="button" key={asset.slug} className={styles.assetCard} onClick={() => router.push(`/asset/${encodeURIComponent(asset.slug)}`)} whileTap={reduced ? undefined : { scale: .965, rotate: index % 2 ? .5 : -.5 }} whileHover={reduced ? undefined : { y: -5 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
            <span className={styles.assetPhoto} style={assetImage(asset, index) ? { backgroundImage: `url('${assetImage(asset, index)}')`, backgroundPosition: index % 2 ? '72% center' : '32% center' } : undefined} />
            <span className={styles.assetTop}><AssetGlyph kind={assetKind(asset, index)} /><ArrowUpRight size={16} /></span>
            <span className={styles.assetInfo}><small>{asset.assetClass?.replace(/_/g, ' ') || 'RWA'}</small><b>{asset.name}</b><span><em>{copy.marketCap}</em><strong>{fmtUsd(asset.marketCapUsd, { compact: true, locale })}</strong></span><span><em>{copy.change24h}</em><strong className={asset.change24hPct?.startsWith('-') ? styles.down : styles.up}>{fmtPct(asset.change24hPct, { signed: true })}</strong></span></span>
          </motion.button>)}
        </div> : <p className={styles.empty}>{dataCopy.priceUnavailable}</p>}
      </Reveal>

      <Reveal reduced={reduced} className={styles.section}><HomeMarketLens /></Reveal>

      <Reveal reduced={reduced} className={styles.section}><HomeTradingView /></Reveal>

      <Reveal reduced={reduced} className={styles.section}><HomePolymarket />
        {predictionItems.length > 0 && <motion.button type="button" className={styles.predictionCard} onClick={() => router.push(`/prediction/${encodeURIComponent(predictionItems[0].id)}`)} whileTap={reduced ? undefined : { scale: .975 }}><span className={styles.predictionIcon}><ChartNoAxesColumnIncreasing size={21} strokeWidth={1.5} /></span><span className={styles.predictionCopy}><small>{utility.marketSignal}</small><b>{predictionItems[0].question}</b></span><ArrowUpRight size={18} /></motion.button>}
      </Reveal>

      {blocks.includes('yield') && <Reveal reduced={reduced} className={styles.section}><SectionHeading title={copy.yield} />
        <div className={styles.placeholder}><span className={styles.placeholderIcon}><Sparkles size={20} strokeWidth={1.4} /></span><p>{copy.yieldBody}</p></div>
      </Reveal>}

      <section className={`${styles.section} ${styles.communitySection}`}><SectionHeading title={copy.community} onMore={() => go('community')} more={communityExperienceCopy[locale].enter} />
        <HomeSocialFeed onOpen={post => router.push(`/community/post/${encodeURIComponent(post.id)}`)} labels={{ all: feedAll[locale], loading: utility.loading, retry: utility.retry, end: utility.end, emptyTitle: copy.communityEmpty, emptyBody: copy.communityBody }} />
      </section>

      <section className={styles.section}><SectionHeading title={copy.trust} />
        <div className={styles.placeholder}><span className={styles.placeholderIcon}><ShieldCheck size={20} strokeWidth={1.4} /></span><p>{copy.trustBody}</p></div>
      </section>
    </div>
  </section>
}
