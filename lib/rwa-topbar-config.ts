import type { RwaScreen } from './rwa-routes'

export type Slot = 'logo' | 'back' | 'close' | 'language' | 'theme' | 'filter' | 'search' | 'bell' | 'share' | 'star' | 'avatar' | 'gear' | 'more' | 'help' | 'edit' | 'calendar' | 'ledger' | 'export' | 'plus' | 'follow' | 'readall' | 'book' | 'info' | null
export type TopbarTemplate = 'T-Root' | 'T-Child' | 'T-Segment' | 'T-Flow'
export type SlotConfig = { template: TopbarTemplate; l1: Slot; l2: Slot; r2: Slot; r1: Slot; surface?: 'solid' | 'transparent-over-media'; steps?: number; hidden?: boolean }
export const topbarDestinations = { logo: 'home', bell: 'notifications', avatar: 'profile', gear: 'settings', ledger: 'wallet.transactions', book: 'wallet.addresses', help: 'support', search: 'search' } as const
const defaultActionSlots = new Set<Slot>(['back', 'close', 'theme', 'share', 'language', ...Object.keys(topbarDestinations) as Slot[]])
/** Contextual icons need a page callback; never show an enabled button with no behavior. */
export function hasDefaultTopbarAction(slot: Slot) { return defaultActionSlots.has(slot) }
const child: SlotConfig = { template: 'T-Child', l1: 'back', l2: null, r2: null, r1: 'language' }
const root: SlotConfig = { ...child, template: 'T-Root', l1: 'logo' }
const flow: SlotConfig = { ...child, template: 'T-Flow', l1: 'close', r1: 'language', steps: 2 }
export const pageSlots: Record<string, SlotConfig> = {
  P01: { ...child, hidden: true }, P02: { ...child, hidden: true }, P03: { ...child, r1: 'help' },
  P04: { ...root, r2: null, r1: 'language' }, P05: { ...root, r2: 'search', r1: 'language' }, P06: { ...child, r1: 'language' },
  P07: { ...child, surface: 'transparent-over-media', r2: 'share' }, P08: { ...child, r2: 'search' },
  'P08-detail': { ...child, surface: 'transparent-over-media', r2: 'share' }, P09: { ...child, template: 'T-Segment', r1: null },
  P10: { ...child, r2: 'share', r1: 'info' }, P11: flow, P12: child, P13: { ...child, template: 'T-Segment', r1: null },
  P14: { ...child, surface: 'transparent-over-media', r2: 'share', r1: 'info' }, P15: { ...flow, steps: 3 }, P16: flow,
  P17: child, P18: child, P19: { ...child, template: 'T-Segment', l1: null, r1: null }, P20: flow, P21: child,
  P22: { ...child, r2: 'ledger', r1: 'gear' }, P23: { ...child, l1: 'close', r1: 'info' }, P24: { ...flow, steps: 4, r1: 'book' },
  P25: { ...child, r1: 'plus' }, P26: { ...flow, steps: 3 }, P27: child, P28: { ...child, r1: 'readall' },
  P29: child, P30: { ...child, r1: 'more' }, P31: child, 'P31-compose': { ...flow, r1: null, steps: undefined },
  P32: { ...flow, steps: 3 }, P33: { ...child, r1: null }, P34: { ...child, r1: 'info' },
}
const screenPages: Partial<Record<RwaScreen, string>> = {
  welcome: 'P01', login: 'P02', register: 'P03', 'verify-email': 'P03', recovery: 'P03', home: 'P04', invest: 'P09', quant: 'P09',
  'rwa-detail': 'P10', 'compute-detail': 'P10', 'stock-detail': 'P10', 'prediction-detail': 'P34', portfolio: 'P19', wallet: 'P22',
  'issuer-profile': 'P08-detail', 'order-review': 'P11', 'order-processing': 'P11', 'order-success': 'P11', 'order-partial': 'P11', 'order-failed': 'P11', 'order-receipt': 'P11', 'order-detail': 'P12', records: 'P12',
  deposit: 'P23', withdraw: 'P24', transfer: 'P26', 'address-book': 'P25', activity: 'P27', notifications: 'P28',
  community: 'P29', 'community-post': 'P30', 'community-profile': 'P31', kyc: 'P32', settings: 'P33', 'risk-profile': 'P17', 'yield-calendar': 'P21',
}
export function slotsForScreen(screen?: RwaScreen, kind?: TopbarKind): SlotConfig {
  let resolved: SlotConfig
  if (screen === 'verify-email' || screen === 'recovery' || screen === 'login' || screen === 'register' || screen === 'welcome') return { ...child, hidden: true }
  if (screen === 'ai') resolved = { ...child, r2: null }
  else if (screen === 'profile') resolved = { ...child, l1: 'back', r2: null }
  else if (screen === 'search') resolved = { ...child, r2: null }
  else if (screen === 'invest') resolved = { ...root, l1: null, r2: null, r1: null }
  // Koala Quant (/quant) is a pushed page since 2026-10-28 (the card lives on Markets): a back arrow, its name.
  else if (screen === 'quant') resolved = { ...child, r2: null, r1: null }
  else if (screen && screenPages[screen]) resolved = { ...pageSlots[screenPages[screen]!] }
  else if (kind === 'immersive') resolved = { ...child, hidden: true }
  else if (kind === 'flow') resolved = { ...flow }
  else if (kind === 'home' || kind === 'tab-content' || kind === 'tab-asset') resolved = { ...root }
  else resolved = { ...child }
  if (resolved.hidden) return resolved
  // Language and theme live in Settings; R1 is freed for the account entry on tab roots.
  // Home keeps only the wordmark and the account: notifications live above the AI composer, search lives in Markets.
  if (screen === 'home') return { ...resolved, l1: 'logo', l2: null, r2: null, r1: 'theme' }
  return { ...resolved, r2: resolved.r2 ?? (resolved.r1 === 'language' ? null : resolved.r1), r1: null }
}

export type TopbarKind = 'home' | 'tab-content' | 'tab-asset' | 'list' | 'detail' | 'flow' | 'tool' | 'trust' | 'immersive'
export type TopbarLeft = 'logo' | 'back' | 'close' | 'none'
export type TopbarTitleAlign = 'start' | 'center' | 'none'
export type TopbarRight = 'theme' | 'avatar-theme' | 'context' | 'none'

export type RwaTopbarConfig = {
  kind: TopbarKind
  left: TopbarLeft
  titleAlign: TopbarTitleAlign
  right: TopbarRight
  showTheme: boolean
  showAvatar: boolean
}

export const rwaTopbarConfig: Record<TopbarKind, RwaTopbarConfig> = {
  home: { kind: 'home', left: 'logo', titleAlign: 'start', right: 'theme', showTheme: true, showAvatar: false },
  'tab-content': { kind: 'tab-content', left: 'logo', titleAlign: 'start', right: 'theme', showTheme: true, showAvatar: false },
  'tab-asset': { kind: 'tab-asset', left: 'logo', titleAlign: 'start', right: 'avatar-theme', showTheme: true, showAvatar: true },
  list: { kind: 'list', left: 'back', titleAlign: 'center', right: 'context', showTheme: false, showAvatar: false },
  detail: { kind: 'detail', left: 'back', titleAlign: 'center', right: 'context', showTheme: false, showAvatar: false },
  flow: { kind: 'flow', left: 'close', titleAlign: 'center', right: 'none', showTheme: false, showAvatar: false },
  tool: { kind: 'tool', left: 'back', titleAlign: 'center', right: 'none', showTheme: false, showAvatar: false },
  trust: { kind: 'trust', left: 'back', titleAlign: 'center', right: 'context', showTheme: false, showAvatar: false },
  immersive: { kind: 'immersive', left: 'none', titleAlign: 'none', right: 'none', showTheme: false, showAvatar: false },
}

export const rwaScreenTopbarKinds: Record<RwaScreen, TopbarKind> = {
  welcome: 'immersive', login: 'immersive', register: 'immersive', 'verify-email': 'immersive', recovery: 'immersive',
  home: 'home', invest: 'tab-content', quant: 'tab-content', portfolio: 'tab-asset', wallet: 'tab-asset', ai: 'immersive', profile: 'immersive',
  'basket-list': 'list', 'basket-detail': 'detail', 'basket-subscribe': 'flow', 'basket-redeem': 'flow', 'basket-disclosures': 'list', 'basket-recommend': 'tool', 'strategy-detail': 'detail',
  'rwa-detail': 'detail', 'compute-detail': 'detail', 'stock-detail': 'detail', 'prediction-detail': 'detail',
  'order-review': 'flow', 'order-processing': 'flow', 'order-success': 'flow', 'order-partial': 'flow', 'order-failed': 'flow', 'order-receipt': 'flow', 'order-detail': 'detail',
  deposit: 'flow', withdraw: 'flow', transfer: 'flow', receive: 'tool', 'wallet-success': 'flow', activity: 'list', 'asset-detail': 'detail', 'position-detail': 'detail', 'address-book': 'tool',
  'ai-plan': 'detail', notifications: 'tool', kyc: 'tool', eligibility: 'tool', 'risk-profile': 'tool', security: 'tool', referral: 'tool', records: 'list', support: 'tool', 'support-new': 'detail', 'support-ticket': 'detail', fees: 'tool', settings: 'tool', marketing: 'tool', 'official-channels': 'trust', 'scam-report': 'tool', 'close-account': 'flow',
  'trust-center': 'trust', 'access-regions': 'trust', 'product-disclosures': 'trust', 'legal-center': 'trust', status: 'tool', disclosures: 'trust', secondary: 'list', trade: 'tool',
  community: 'list', 'community-post': 'detail', 'community-profile': 'detail',
  learn: 'list', 'learn-article': 'detail',
  'share-landing': 'immersive',
  'invite-landing': 'immersive',
  'onboarding-overview': 'list', valuation: 'detail', 'issuer-profile': 'detail', issuers: 'list', search: 'tool', 'yield-calendar': 'list', rebalance: 'tool', statements: 'list', recurring: 'tool', 'my-predictions': 'list',
}

export function topbarConfigForScreen(screen: RwaScreen): RwaTopbarConfig {
  return rwaTopbarConfig[rwaScreenTopbarKinds[screen]]
}
