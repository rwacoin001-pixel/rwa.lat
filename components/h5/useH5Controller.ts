'use client'
import { aiPageContext, type AiPageContext } from '@/lib/ai-page-context'
import { captureWalletBackdrop } from '../wallet-page-backdrop'
import { nextNavigationState, useNavigationViewport } from '@/lib/app-navigation'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type ToastTone } from '@/lib/toast-tone'
import { showToast } from '@/lib/toast-store'
import { useRwaTheme } from '@/lib/rwa-theme'
import { localizeProduct } from '@/lib/catalog-localization'
import { pathForDynamicScreen, pathForScreen, screenForSegments, type RwaScreen } from '@/lib/rwa-routes'
import { resolveRoute } from '@/lib/routes-v2'
import { screenForV2Query, screenForV2Segments } from '@/lib/routes-v2-adapter'
import { PATH_EVENT, openPath, type PathNavigation } from '@/lib/maison-nav'
import { isOrderableId } from '@/lib/api/markets'
import { acceptPendingInvite } from '@/lib/invite-acceptance'
import { fetchRwaProducts } from '@/lib/rwa-data'
import { getProducts, isAuthenticated, type DemoProduct } from '@/lib/h5-data'
import { demoProducts as fallbackProducts } from '@/lib/demo-catalog'
import { useI18n } from '@/lib/i18n'
import { NAV_EVENT, pathForTarget, type NavTarget } from '@/lib/routes'
import { PROFILE_SECTION_SCREENS, protectedScreens, routeRequiresAuth, maisonSlug, type OrderAsset, type PrimaryScreen } from './shared'

type Screen = RwaScreen

export type H5Props = { initialScreen?: Screen; initialParams?: Record<string, string>; initialQuery?: string; initialPath?: string }

/** Session, theme, connectivity and navigation state for the H5 app; the shell and the route table only read it. */
export function useH5Controller({ initialScreen = 'home', initialParams = {}, initialQuery = '', initialPath = '' }: H5Props) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [aiContext, setAiContext] = useState<AiPageContext | undefined>()
  const [routeQuery, setRouteQuery] = useState(initialQuery)
  const [routeParams, setRouteParams] = useState<Record<string, string>>(initialParams)
  // Pathname of the last URL-driven navigation; '' after a legacy go(). Separates routes that share a screen (/compare → rwa-detail).
  const [routePath, setRoutePath] = useState(initialPath)
  const navigationMotion = useNavigationViewport(`${screen}:${routePath}:${routeQuery}`)
  const [profileBaseScreen, setProfileBaseScreen] = useState<Screen | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [sessionMode, setSessionMode] = useState<'guest' | 'authenticated'>('guest')
  const [sessionReady, setSessionReady] = useState(false)
  const [products, setProducts] = useState<DemoProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<DemoProduct>(() => {
    if (initialScreen === 'rwa-detail' && initialParams.slug) {
      return { ...fallbackProducts[0], id: `rwa-${initialParams.slug}`, title: initialParams.slug, category: 'RWA', isDemo: false }
    }
    if (initialScreen === 'prediction-detail' && initialParams.id) {
      return { ...fallbackProducts[0], id: `polymarket-${initialParams.id}`, title: 'Market', category: 'Prediction', returnMetric: '—', isDemo: false }
    }
    return fallbackProducts[0]
  })
  const [communityPostId, setCommunityPostId] = useState<string | null>(initialScreen === 'community-post' ? initialParams.id ?? null : null)
  const [supportTicketId, setSupportTicketId] = useState<string | null>(initialScreen === 'support-ticket' ? initialParams.id ?? null : null)
  const [orderDetailId, setOrderDetailId] = useState<string | null>(initialScreen === 'order-detail' ? initialParams.id ?? null : null)
  const [selectedBasketId, setSelectedBasketId] = useState<string | null>(initialScreen.startsWith('basket-') ? initialParams.id ?? null : null)
  const [routeSymbol, setRouteSymbol] = useState<string | undefined>(initialParams.symbol)
  const { theme, mode } = useRwaTheme()
  const [communityHandle, setCommunityHandle] = useState<string | null>(initialScreen === 'community-profile' ? initialParams.handle ?? null : null)
  useEffect(() => {
    setSessionMode(isAuthenticated() ? 'authenticated' : 'guest')
    try {
      const stored = window.sessionStorage.getItem('rwa-selected-product')
      if (stored && !initialParams.slug && !(initialScreen === 'prediction-detail' && initialParams.id)) setSelectedProduct(JSON.parse(stored) as DemoProduct)
    } catch {
      window.sessionStorage.removeItem('rwa-selected-product')
    }
    const storedCommunityPost = window.sessionStorage.getItem('rwa-community-post')
    if (storedCommunityPost && !initialParams.id) setCommunityPostId(storedCommunityPost)
    const storedCommunityHandle = window.sessionStorage.getItem('rwa-community-handle')
    if (storedCommunityHandle && !initialParams.handle) setCommunityHandle(storedCommunityHandle)
    const storedBasket = window.sessionStorage.getItem('rwa-selected-basket')
    if (storedBasket && !initialParams.id) setSelectedBasketId(storedBasket)
    const communityParams = new URLSearchParams(window.location.search)
    if (initialScreen === 'community-post' && !initialParams.id && communityParams.get('id')) setCommunityPostId(communityParams.get('id'))
    if (initialScreen === 'community-profile' && !initialParams.handle && communityParams.get('handle')) setCommunityHandle(communityParams.get('handle'))
    if (initialScreen === 'valuation' && initialParams.slug) window.sessionStorage.setItem('rwa-p0a-slug', initialParams.slug)
    setSessionReady(true)
  }, [])
  // ── API-first product loading (catalog + real RWA assets from DefiLlama sync) ──
  useEffect(() => {
    let cancelled = false
    Promise.all([getProducts(), fetchRwaProducts(40)])
      .then(([p, rwaProducts]) => {
        if (!cancelled) {
          setProducts([...rwaProducts, ...p])
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  // /asset/:slug wins; legacy /invest/<kind> falls back to the product chosen earlier in this tab.
  const detailSlug = routeParams.slug ?? maisonSlug(selectedProduct)
  const predictionId = routeParams.id ?? (selectedProduct.id.startsWith('polymarket-') && selectedProduct.id !== 'polymarket-live' ? selectedProduct.id.slice('polymarket-'.length) : null)
  const localizedSelectedProduct = useMemo(() => localizeProduct(selectedProduct, locale), [locale, selectedProduct])
  useEffect(() => {
    const profileReturn = new URLSearchParams(window.location.search).get('profileReturn') as Screen | null
    if (profileReturn && ['home', 'invest', 'quant', 'portfolio', 'wallet'].includes(profileReturn)) {
      setProfileBaseScreen(profileReturn)
      window.sessionStorage.setItem('rwa-profile-base', profileReturn)
    }
    setScreen(initialScreen)
    setRouteQuery(initialQuery)
    setRouteParams(initialParams)
    if (initialParams.id) {
      if (initialScreen.startsWith('basket-')) setSelectedBasketId(initialParams.id)
      if (initialScreen === 'order-detail') setOrderDetailId(initialParams.id)
      if (initialScreen === 'support-ticket') setSupportTicketId(initialParams.id)
      if (initialScreen === 'community-post') setCommunityPostId(initialParams.id)
      if (initialScreen === 'prediction-detail') setSelectedProduct((current) => ({ ...current, id: `polymarket-${initialParams.id}`, title: 'Market', category: 'Prediction', returnMetric: '—', isDemo: false }))
    }
    if (initialScreen === 'community-profile' && initialParams.handle) setCommunityHandle(initialParams.handle)
    if (initialScreen === 'rwa-detail' && initialParams.slug) setSelectedProduct((current) => ({ ...current, id: `rwa-${initialParams.slug}`, title: initialParams.slug, category: 'RWA', isDemo: false }))
    if (initialScreen === 'trade') setRouteSymbol(initialParams.symbol)
    if (initialScreen === 'valuation' && initialParams.slug) window.sessionStorage.setItem('rwa-p0a-slug', initialParams.slug)
  }, [initialScreen, initialQuery, initialParams.id, initialParams.handle, initialParams.slug, initialParams.symbol])
  useEffect(() => {
    // A signed-in visitor opening /login or /register goes to the app instead of a second sign-in.
    if (!sessionReady || !isAuthenticated() || (initialScreen !== 'login' && initialScreen !== 'register')) return
    setScreen('home')
    router.replace(pathForScreen('home'))
    // Only the first ready check decides; a sign-in on this screen navigates by itself.
  }, [sessionReady])
  useEffect(() => {
    // Signing out (or in) in another tab reloads this one so it never acts on a stale session.
    const sync = (event: StorageEvent) => {
      if (event.key !== null && event.key !== 'rwa.session' && event.key !== 'rwa-session-token') return
      if (isAuthenticated() !== (sessionMode === 'authenticated')) window.location.reload()
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [sessionMode])
  useEffect(() => {
    if (!sessionReady || sessionMode !== 'guest' || (!protectedScreens.includes(initialScreen) && !routeRequiresAuth(window.location.pathname))) return
    // Keep ids and query (e.g. /orders/review?product=…) so login returns to the exact deep link.
    window.sessionStorage.setItem('rwa.return-to', `${window.location.pathname}${window.location.search}`)
    setScreen('login')
    if (window.location.pathname !== pathForScreen('login')) router.replace(pathForScreen('login'))
  }, [initialScreen, router, sessionMode, sessionReady])
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const attribution = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'invite_code'].reduce<Record<string, string>>((result, key) => {
      const value = query.get(key)
      if (value) result[key] = value.slice(0, 160)
      return result
    }, {})
    if (!Object.keys(attribution).length) return
    if (!window.localStorage.getItem('rwa-first-attribution')) window.localStorage.setItem('rwa-first-attribution', JSON.stringify({ ...attribution, capturedAt: new Date().toISOString() }))
    window.localStorage.setItem('rwa-last-attribution', JSON.stringify({ ...attribution, capturedAt: new Date().toISOString() }))
  }, [])
  useEffect(() => {
    if (sessionReady && sessionMode === 'authenticated') void acceptPendingInvite()
  }, [sessionMode, sessionReady])
  useEffect(() => {
    const updateConnection = () => setIsOnline(window.navigator.onLine)
    updateConnection()
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection) }
  }, [])
  // 丝滑切换：URL 同步用 pushState（不触发 Next 路由重挂载）
  const syncUrl = (path: string) => {
    if (`${window.location.pathname}${window.location.search}` !== path) window.history.pushState(nextNavigationState(), '', path)
  }
  const applyLocation = () => {
      const segs = window.location.pathname.split('/').filter(Boolean)
      const pathname = window.location.pathname
      const baseScreen = screenForSegments(segs) ?? screenForV2Segments(segs)
      if (!baseScreen) return
      const query = new URLSearchParams(window.location.search)
      const s = screenForV2Query(pathname, query, baseScreen)
      if (sessionReady && sessionMode === 'guest' && (protectedScreens.includes(s) || routeRequiresAuth(pathname))) {
        window.sessionStorage.setItem('rwa.return-to', `${pathname}${window.location.search}`)
        setScreen('login')
        if (pathname !== pathForScreen('login')) router.replace(pathForScreen('login'))
        return
      }
      const params = resolveRoute(pathname)?.params
      if (params?.id) {
        if (s.startsWith('basket-')) setSelectedBasketId(params.id)
        if (s === 'order-detail') setOrderDetailId(params.id)
        if (s === 'support-ticket') setSupportTicketId(params.id)
        if (s === 'community-post') setCommunityPostId(params.id)
        if (s === 'prediction-detail') setSelectedProduct((current) => ({ ...current, id: `polymarket-${params.id}`, title: 'Market', category: 'Prediction', returnMetric: '—', isDemo: false }))
      }
      if (params?.handle && s === 'community-profile') setCommunityHandle(params.handle)
      if (params?.slug && s === 'rwa-detail') setSelectedProduct((current) => ({ ...current, id: `rwa-${params.slug}`, title: params.slug, category: 'RWA', isDemo: false }))
      if (s === 'trade') setRouteSymbol(params?.symbol)
      setRouteParams(params ?? {})
      setRoutePath(pathname)
      setRouteQuery(query.toString())
      setScreen(s)
  }
  useEffect(() => {
    const onPop = () => applyLocation()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [router, sessionMode, sessionReady])
  useEffect(() => {
    const receive = (event: Event) => {
      const target = (event as CustomEvent<NavTarget & { screen: Screen }>).detail
      go(target.screen)
      if (target.params) {
        const path = pathForTarget(target)
        if (path) history.replaceState({ ...history.state, rwaNavigation: true }, '', path)
      }
    }
    window.addEventListener(NAV_EVENT, receive)
    return () => window.removeEventListener(NAV_EVENT, receive)
  })
  // Maison screens navigate by URL so ids and query survive refresh, deep links and login return.
  useEffect(() => {
    const receive = (event: Event) => {
      const { path, replace } = (event as CustomEvent<PathNavigation>).detail
      const url = new URL(path, window.location.origin)
      if (url.origin !== window.location.origin) return
      const segs = url.pathname.split('/').filter(Boolean)
      const base = screenForSegments(segs) ?? screenForV2Segments(segs)
      if (!base) { window.location.assign(url.pathname + url.search); return }
      const next = screenForV2Query(url.pathname, url.searchParams, base)
      if (next === 'ai' && screen !== 'ai') setAiContext(aiPageContext(window.location.pathname, window.location.search))
      if (sessionMode === 'guest' && (protectedScreens.includes(next) || routeRequiresAuth(url.pathname))) {
        window.sessionStorage.setItem('rwa.return-to', url.pathname + url.search)
        go('login')
        return
      }
      ;(document.activeElement as HTMLElement | null)?.blur()
      // Fresh state object: Next only syncs its router for history writes that lack its own `__NA` marker.
      if (/^\/(?:wallet|assets\/cash)\/(deposit|withdraw|transfer|receive)(?:\/|$)/.test(url.pathname)) captureWalletBackdrop()
      const state = nextNavigationState(Boolean(replace))
      if (replace) window.history.replaceState(state, '', url.pathname + url.search)
      else window.history.pushState(state, '', url.pathname + url.search)
      setProfileBaseScreen(null)
      applyLocation()
    }
    window.addEventListener(PATH_EVENT, receive)
    return () => window.removeEventListener(PATH_EVENT, receive)
  })
  const go = (next: Screen) => {
    if (next === 'ai' && screen !== 'ai') setAiContext(aiPageContext(window.location.pathname, window.location.search))
    if (sessionMode === 'guest' && protectedScreens.includes(next)) {
      window.sessionStorage.setItem('rwa.return-to', pathForScreen(next))
      notify(t('guest.protected'), 'info')
      next = 'login'
    }
    ;(document.activeElement as HTMLElement | null)?.blur()
    const returningToProfile = next === 'profile' && (
      PROFILE_SECTION_SCREENS.has(screen) || resolveRoute(window.location.pathname)?.def.domain === 'profile'
    )
    if (next === 'ai' || (next === 'profile' && !returningToProfile)) {
      window.sessionStorage.setItem('rwa-overlay-base', screen)
    }
    setProfileBaseScreen(null)
    if (next === 'deposit' || next === 'withdraw' || next === 'transfer' || next === 'receive') captureWalletBackdrop()
    setScreen(next)
    setRouteQuery('')
    setRouteParams({})
    setRoutePath('')
    if (next !== 'trade') setRouteSymbol(undefined)
    const nextPath = pathForScreen(next)
    syncUrl(nextPath)
    // These are two modes of the same form; keep its viewport and video stable.
    if ((screen === 'login' || screen === 'register') && (next === 'login' || next === 'register')) return
    // The screen effect owns scroll reset; do not interrupt later user gestures.
  }
  const closeOverlay = () => {
    const storedBase = window.sessionStorage.getItem('rwa-overlay-base') as Screen | null
    const storedProfileBase = window.sessionStorage.getItem('rwa-profile-base') as Screen | null
    const canCloseTo = (candidate: Screen | null) => Boolean(candidate && candidate !== 'profile' && candidate !== 'ai' && (
      screen !== 'profile' || !PROFILE_SECTION_SCREENS.has(candidate)
    ))
    const base = canCloseTo(profileBaseScreen) ? profileBaseScreen!
      : canCloseTo(storedProfileBase) ? storedProfileBase!
      : canCloseTo(storedBase) ? storedBase!
      : 'home'
    setProfileBaseScreen(null)
    window.sessionStorage.removeItem('rwa-profile-base')
    window.sessionStorage.removeItem('rwa-overlay-base')
    if (window.history.state?.rwaNavigation) { window.history.back(); return }
    setScreen(base)
    const nextPath = pathForScreen(base)
    syncUrl(nextPath)
  }
  const notify = (message: string, tone?: ToastTone) => showToast(message, tone)
  const openOrder = (asset: OrderAsset) => {
    if (isOrderableId(selectedProduct.id)) { window.dispatchEvent(new CustomEvent<PathNavigation>(PATH_EVENT, { detail: { path: `/orders/review?product=${encodeURIComponent(selectedProduct.id)}` } })); return }
    go('order-review')
  }
  const openDynamicScreen = (next: 'valuation' | 'issuer-profile', slug: string) => {
    if (next === 'issuer-profile') { window.dispatchEvent(new CustomEvent<PathNavigation>(PATH_EVENT, { detail: { path: `/issuers/${encodeURIComponent(slug)}` } })); return }
    window.sessionStorage.setItem('rwa-p0a-slug', slug)
    go(next)
    window.setTimeout(() => syncUrl(pathForDynamicScreen(next, slug)), 0)
  }
  const openSupportTicket = (id: string) => {
    setSupportTicketId(id)
    window.sessionStorage.setItem('rwa-support-ticket', id)
    openPath(`/profile/support/ticket/${encodeURIComponent(id)}`)
  }
  const openCommunityPost = (id: string) => {
    setCommunityPostId(id)
    window.sessionStorage.setItem('rwa-community-post', id)
    openPath(`/community/post/${encodeURIComponent(id)}`)
  }
  const openCommunityProfile = (handle: string) => {
    setCommunityHandle(handle)
    window.sessionStorage.setItem('rwa-community-handle', handle)
    openPath(`/community/member/${encodeURIComponent(handle)}`)
  }
  const setAuthenticated = () => { setSessionMode('authenticated'); window.localStorage.setItem('rwa-session-mode', 'authenticated') }
  const setSignedOut = () => setSessionMode('guest')
  // The order sheet keeps the Dock behind it; funds routes occupy the full screen.
  const isFloatingSheet = screen === 'order-review'
  const showDock = ['home', 'invest', 'quant', 'portfolio'].includes(screen) || isFloatingSheet
  const dockActiveScreen: PrimaryScreen | undefined = screen === 'order-review' ? 'invest' : undefined
  const isProtectedWaiting = (protectedScreens.includes(screen) || routeRequiresAuth(routePath || initialPath)) && !sessionReady
  return { screen, go, notify, closeOverlay, setAuthenticated, setSignedOut, aiContext, sessionMode, sessionReady, routeQuery, routeParams, routePath, selectedProduct, products, localizedSelectedProduct, detailSlug, predictionId, selectedBasketId, communityPostId, communityHandle, supportTicketId, orderDetailId, routeSymbol, openOrder, openDynamicScreen, openCommunityPost, openCommunityProfile, openSupportTicket, navigationMotion, isOnline, showDock, isFloatingSheet, dockActiveScreen, isProtectedWaiting, theme, mode }
}

export type H5Controller = ReturnType<typeof useH5Controller>
