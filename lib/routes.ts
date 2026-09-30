'use client'

import { useCallback } from 'react'
import { pathForScreen, screenForSegments, type RwaScreen } from './rwa-routes'
export type ScreenId = RwaScreen | 'boot' | 'auth.login' | 'auth.register' | 'auth.verify' | 'auth.recover' | 'market' | 'market.assets' | 'market.asset' | 'market.issuers' | 'market.issuer' | 'invest.product' | 'invest.order' | 'orders' | 'orders.detail' | 'invest.basket' | 'invest.basket.subscribe' | 'invest.basket.redeem' | 'invest.recommend' | 'invest.basket.disclosures' | 'assets' | 'assets.redeem' | 'assets.redemptions' | 'assets.yield' | 'wallet.deposit' | 'wallet.withdraw' | 'wallet.addresses' | 'wallet.transactions' | 'community.post' | 'community.profile' | 'community.compose'
export type NavTarget = { id: ScreenId; params?: Record<string, string> }
export const NAV_EVENT = 'rwa:navigate'
const aliases: Partial<Record<ScreenId, RwaScreen>> = {
  boot: 'welcome', 'auth.login': 'login', 'auth.register': 'register', 'auth.verify': 'verify-email', 'auth.recover': 'recovery',
  'market.issuers': 'issuer-profile', 'market.issuer': 'issuer-profile', 'invest.product': 'rwa-detail', 'invest.order': 'order-review',
  orders: 'records', 'orders.detail': 'order-detail', 'invest.recommend': 'risk-profile', assets: 'portfolio', 'assets.yield': 'yield-calendar',
  'wallet.deposit': 'deposit', 'wallet.withdraw': 'withdraw', 'wallet.addresses': 'address-book', 'wallet.transactions': 'activity',
  'community.post': 'community-post', 'community.profile': 'community-profile',
}
export function legacyScreen(id: ScreenId): RwaScreen | null {
  if (aliases[id]) return aliases[id]!
  // New business screens are registered as they are extracted in S2-S6.
  return pathForScreen(id as RwaScreen) ? id as RwaScreen : null
}
export function pathForTarget(target: NavTarget): string | null {
  const screen = legacyScreen(target.id)
  if (!screen) return null
  const params = new URLSearchParams(target.params)
  return pathForScreen(screen) + (params.size ? `?${params}` : '')
}
export function navigate(target: NavTarget) {
  const screen = legacyScreen(target.id)
  if (!screen) throw new Error(`Screen not implemented yet: ${target.id}`)
  window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { ...target, screen } }))
}
export function useNav() {
  const push = useCallback((id: ScreenId, params?: Record<string, string>) => navigate({ id, params }), [])
  const back = useCallback(() => { if (window.history.state?.rwaNavigation) window.history.back(); else navigate({ id: 'home' }) }, [])
  return { push, back }
}
export { screenForSegments }
