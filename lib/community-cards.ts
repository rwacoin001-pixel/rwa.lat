/**
 * Share-a-result cards (晒单卡, 2026-11-01, user + Codex review). Eight kinds, each its own layout; every figure comes from
 * a server snapshot frozen at posting time (the client never sends numbers). Fields can be hidden but one must stay
 * visible; identity, capture time, provenance and the risk line are always shown. Amounts are atomic-unit strings.
 */
import { request } from '@/lib/api/_http'

export const CARD_KINDS = ['quant_day', 'quant_product', 'quant_total', 'holdings', 'prediction_bet', 'prediction_record', 'deposit', 'withdrawal'] as const
export type CardKind = typeof CARD_KINDS[number]
export type CardGroup = 'quant' | 'prediction' | 'funds'
export const cardGroup = (kind: CardKind): CardGroup => kind.startsWith('prediction') ? 'prediction' : kind === 'deposit' || kind === 'withdrawal' ? 'funds' : 'quant'

/** The public view of a snapshot: hidden fields are absent. */
export type CardSnapshot = { asset?: string; decimals?: number; fundsRecord?: boolean; [field: string]: unknown }
export type PostCard = { kind: CardKind; snapshot: CardSnapshot; visibleFields: string[]; capturedAt: string }
export type CardKindInfo = { kind: CardKind; available: boolean; reason: string | null; needsSource: boolean; defaultHidden: string[] }
export type CardSource = { id: string; label: string; sublabel?: string | null; at?: string | null }
export type CardPreview = { kind: CardKind; snapshot: CardSnapshot; fields: Array<{ key: string; hideable: boolean; value: unknown }> }
export type CardDraft = { kind: CardKind; sourceId?: string; visibleFields: string[]; preview: CardPreview }

/** Hideable fields per kind, in the order the card shows them (the first is the hero). */
export const CARD_FIELDS: Record<CardKind, string[]> = {
  quant_day: ['pnl', 'returnPct', 'product', 'date'],
  quant_product: ['pnl', 'returnPct', 'product', 'settledDays', 'status'],
  quant_total: ['pnl', 'returnPct', 'settledDays', 'bestMonth'],
  holdings: ['products', 'totalPrincipal', 'pending'],
  prediction_bet: ['pnl', 'returnPct', 'question', 'side', 'stake', 'result', 'payout'],
  prediction_record: ['winRate', 'total', 'closedPnl', 'last10'],
  deposit: ['amount', 'status', 'asset', 'time'],
  withdrawal: ['amount', 'status', 'asset', 'time'],
}

const fail = (message: string) => { throw new Error(message) }

/** Whether the card API is live (asked once per app run). Until it is, no 晒单 tab and no card key are shown. An unknown route
 * answers 404/405; anything else (200, or 401 for a guest) means the API is there. */
let live: Promise<boolean> | null = null
export function cardsLive(): Promise<boolean> {
  live ??= request('/v1/community/me/cards/kinds', { loading: 'silent' }).then((result) => result.ok || (result.error.status !== 404 && result.error.status !== 405 && result.error.status !== 0)).catch(() => false)
  return live
}

export async function getCardKinds() {
  const result = await request<{ items: CardKindInfo[] }>('/v1/community/me/cards/kinds', { loading: 'silent' })
  if (!result.ok) { if (result.error.status === 404 || result.error.status === 405) return null; return fail(result.error.message) }
  return result.data.items
}
export async function getCardSources(kind: CardKind, cursor?: string | null) {
  const query = new URLSearchParams({ kind, ...(cursor ? { cursor } : {}) })
  const result = await request<{ items: CardSource[]; nextCursor: string | null }>(`/v1/community/me/cards/sources?${query}`, { loading: 'silent' })
  return result.ok ? result.data : fail(result.error.message)
}
export async function previewCard(kind: CardKind, sourceId?: string) {
  const result = await request<CardPreview>('/v1/community/me/cards/preview', { method: 'POST', body: JSON.stringify({ kind, ...(sourceId ? { sourceId } : {}) }) })
  return result.ok ? result.data : fail(result.error.message)
}

/** Amount helpers: atomic string → number of whole units, then a signed, grouped figure. */
export function units(atomic: unknown, decimals = 6): number | null {
  if (typeof atomic !== 'string' && typeof atomic !== 'number') return null
  const n = Number(atomic)
  return Number.isFinite(n) ? n / 10 ** decimals : null
}
export function money(value: number | null, locale: string, signed = false) {
  if (value === null) return '—'
  const text = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))
  return `${value < 0 ? '−' : signed && value > 0 ? '+' : ''}${text}`
}
/** Percentages and ratios may arrive as numbers or decimal strings. */
export const asNumber = (value: unknown): number | null => { const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN; return Number.isFinite(n) ? n : null }
export function pct(input: unknown, signed = true) {
  const value = asNumber(input)
  if (value === null) return '—'
  return `${value < 0 ? '−' : signed && value > 0 ? '+' : ''}${Math.abs(value).toFixed(value !== 0 && Math.abs(value) < 10 ? 2 : 1)}%`
}
export const tone = (value: number | null | undefined) => value === null || value === undefined || value === 0 ? 'flat' : value > 0 ? 'up' : 'down'
