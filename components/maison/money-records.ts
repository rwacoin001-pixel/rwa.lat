'use client'

/**
 * One record of the user's money across products (2026-10-29). The income tab and `/profile/documents` used to read only
 * the RWA endpoints (`/v1/yield`, `/v1/orders`), so quant settlements and prediction bets never showed. This module reads
 * the quant and prediction endpoints the product screens already use and maps them onto one row shape. Amounts are the
 * server's own atomic USDT figures; nothing is estimated.
 */
import { useMemo } from 'react'
import type { ApiResult } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { listQuantOrders, listQuantPayouts, listQuantProducts, type QuantMyOrder, type QuantPayout } from '@/lib/api/quant'
import { betAmounts, betStatus } from '@/lib/api/my-predictions'
import type { AppLocale } from '@/lib/i18n'
import type { PredictionBet } from '@/lib/rwa-api'
import { useMyBets } from './MyPredictionsCard'

export type RecordSource = 'rwa' | 'quant' | 'prediction'
export type RecordBucket = 'open' | 'completed' | 'failed-or-cancelled'
export type RecordTone = 'live' | 'warn' | 'down' | 'accent' | undefined

export type IncomeRecord = { id: string; source: RecordSource; title: string; sub: string; atomic: bigint; date: string; path: string }
export type OrderRecord = { id: string; source: RecordSource; title: string; sub: string; atomic: string; date: string; bucket: RecordBucket; label: string; tone: RecordTone; path: string }

type Copy = { quant: string; quantDay: string; subscription: string; redemption: string; prediction: string; won: string; lost: string; quantStates: Record<string, string>; betStates: Record<'placed' | 'won' | 'lost' | 'void' | 'unknown', string> }
const copy: Record<AppLocale, Copy> = {
  'zh-CN': { quant: '考拉量化', quantDay: '每日结算', subscription: '申购', redemption: '赎回', prediction: '预测', won: '已中', lost: '未中',
    quantStates: { pending: '处理中', approved: '已确认', settled: '已完成', posted: '已入账', rejected: '未成功', voided: '已作废' },
    betStates: { placed: '等待结果', won: '已中', lost: '未中', void: '已退款', unknown: '未知' } },
  en: { quant: 'Koala Quant', quantDay: 'Daily settlement', subscription: 'Subscription', redemption: 'Redemption', prediction: 'Prediction', won: 'Won', lost: 'Lost',
    quantStates: { pending: 'Processing', approved: 'Confirmed', settled: 'Done', posted: 'Posted', rejected: 'Not completed', voided: 'Voided' },
    betStates: { placed: 'Awaiting result', won: 'Won', lost: 'Lost', void: 'Refunded', unknown: 'Unknown' } },
  hi: { quant: 'Koala Quant', quantDay: 'दैनिक निपटान', subscription: 'सदस्यता', redemption: 'रिडेम्पशन', prediction: 'प्रेडिक्शन', won: 'जीता', lost: 'हारा',
    quantStates: { pending: 'प्रक्रिया में', approved: 'पुष्ट', settled: 'पूर्ण', posted: 'जमा', rejected: 'पूरा नहीं हुआ', voided: 'रद्द' },
    betStates: { placed: 'परिणाम की प्रतीक्षा', won: 'जीता', lost: 'हारा', void: 'वापस', unknown: 'अज्ञात' } },
  es: { quant: 'Koala Quant', quantDay: 'Liquidación diaria', subscription: 'Suscripción', redemption: 'Reembolso', prediction: 'Predicción', won: 'Ganada', lost: 'Perdida',
    quantStates: { pending: 'En proceso', approved: 'Confirmada', settled: 'Completada', posted: 'Abonada', rejected: 'No completada', voided: 'Anulada' },
    betStates: { placed: 'Esperando resultado', won: 'Ganada', lost: 'Perdida', void: 'Reembolsada', unknown: 'Desconocido' } },
  ar: { quant: 'Koala Quant', quantDay: 'تسوية يومية', subscription: 'اكتتاب', redemption: 'استرداد', prediction: 'توقع', won: 'رابح', lost: 'خاسر',
    quantStates: { pending: 'قيد المعالجة', approved: 'مؤكد', settled: 'مكتمل', posted: 'مقيد', rejected: 'لم يكتمل', voided: 'ملغى' },
    betStates: { placed: 'بانتظار النتيجة', won: 'رابح', lost: 'خاسر', void: 'مسترد', unknown: 'غير معروف' } },
  fr: { quant: 'Koala Quant', quantDay: 'Règlement quotidien', subscription: 'Souscription', redemption: 'Rachat', prediction: 'Prédiction', won: 'Gagnée', lost: 'Perdue',
    quantStates: { pending: 'En cours', approved: 'Confirmée', settled: 'Terminée', posted: 'Créditée', rejected: 'Non aboutie', voided: 'Annulée' },
    betStates: { placed: 'En attente du résultat', won: 'Gagnée', lost: 'Perdue', void: 'Remboursée', unknown: 'Inconnu' } },
  pt: { quant: 'Koala Quant', quantDay: 'Liquidação diária', subscription: 'Subscrição', redemption: 'Resgate', prediction: 'Previsão', won: 'Ganha', lost: 'Perdida',
    quantStates: { pending: 'Em processamento', approved: 'Confirmada', settled: 'Concluída', posted: 'Creditada', rejected: 'Não concluída', voided: 'Anulada' },
    betStates: { placed: 'Aguardando resultado', won: 'Ganha', lost: 'Perdida', void: 'Reembolsada', unknown: 'Desconhecido' } },
}

const signedBig = (value: string | null | undefined) => value != null && /^-?\d+$/.test(value) ? BigInt(value) : null
const QUANT_PATH = '/quant?tab=account'
const betPath = (bet: PredictionBet) => bet.marketEventId ? `/prediction/event-${encodeURIComponent(String(bet.marketEventId))}`
  : bet.marketId ? `/prediction/${encodeURIComponent(String(bet.marketId))}` : '/assets/predictions'
const betTitle = (bet: PredictionBet, c: Copy) => {
  const question = String(bet.marketQuestion ?? '').trim()
  const outcome = String(bet.tokenOutcome ?? '').trim()
  return question ? (outcome ? `${question} · ${outcome}` : question) : c.prediction
}

type QuantPayoutRow = QuantPayout & { slug: string; name: string }

/** Every listed quant product's daily settlements for the signed-in user (holders only get rows). */
async function loadQuantPayouts(): Promise<ApiResult<QuantPayoutRow[]>> {
  const products = await listQuantProducts()
  if (!products.ok) return products
  const pages = await Promise.all((Array.isArray(products.data) ? products.data : []).map(async (product) => {
    const result = await listQuantPayouts(product.slug, 60)
    return result.ok && Array.isArray(result.data) ? result.data.map((row) => ({ ...row, slug: product.slug, name: product.name })) : []
  }))
  return { ok: true, data: pages.flat() }
}

function quantBucket(status: string): { bucket: RecordBucket; tone: RecordTone } {
  if (status === 'settled' || status === 'posted') return { bucket: 'completed', tone: 'live' }
  if (status === 'rejected' || status === 'voided') return { bucket: 'failed-or-cancelled', tone: 'down' }
  return { bucket: 'open', tone: 'accent' }
}

/** Quant daily settlements and settled prediction bets, as signed income rows. */
export function useOtherIncome(locale: AppLocale) {
  const c = copy[locale] ?? copy.en
  const quant = useQuery('records:quant-payouts', loadQuantPayouts, { staleTime: 60_000, loading: 'silent' })
  const bets = useMyBets({ loading: 'silent' })
  const rows = useMemo(() => {
    const out: IncomeRecord[] = []
    for (const row of quant.data ?? []) {
      const net = signedBig(row.netAtomic)
      if (net === null || net === BigInt(0)) continue
      out.push({ id: `quant-${row.slug}-${row.tradeDate}`, source: 'quant', title: row.name || c.quant, sub: c.quantDay, atomic: net, date: row.tradeDate, path: QUANT_PATH })
    }
    for (const bet of Array.isArray(bets.data?.items) ? bets.data.items : []) {
      const status = betStatus(bet.status)
      const { stake, netPayout } = betAmounts(bet)
      if (stake === null || (status !== 'won' && status !== 'lost')) continue
      const atomic = status === 'won' ? (netPayout ?? stake) - stake : -stake
      out.push({ id: `bet-${bet.id}`, source: 'prediction', title: betTitle(bet, c), sub: `${c.prediction} · ${status === 'won' ? c.won : c.lost}`, atomic, date: String(bet.settledAt ?? bet.createdAt), path: betPath(bet) })
    }
    return out
  }, [quant.data, bets.data, c])
  return { rows, ready: quant.data !== undefined || quant.error !== undefined, betsReady: bets.data !== undefined || bets.error !== undefined }
}

/** Quant subscriptions/redemptions and prediction bets, as order records. */
export function useOtherOrders(locale: AppLocale) {
  const c = copy[locale] ?? copy.en
  const quant = useQuery('quant:orders', () => listQuantOrders(30), { staleTime: 30_000, loading: 'silent' })
  const bets = useMyBets({ loading: 'silent' })
  const rows = useMemo(() => {
    const out: OrderRecord[] = []
    for (const row of (Array.isArray(quant.data) ? quant.data : []) as QuantMyOrder[]) {
      const { bucket, tone } = quantBucket(row.status)
      out.push({ id: `quant-${row.id}`, source: 'quant', title: c.quant, sub: row.kind === 'subscription' ? c.subscription : c.redemption,
        atomic: row.amountAtomic ?? row.payoutAtomic ?? '', date: row.createdAt, bucket, label: c.quantStates[row.status] ?? row.status, tone, path: QUANT_PATH })
    }
    for (const bet of Array.isArray(bets.data?.items) ? bets.data.items : []) {
      const status = betStatus(bet.status)
      const bucket: RecordBucket = status === 'placed' ? 'open' : status === 'void' ? 'failed-or-cancelled' : 'completed'
      const tone: RecordTone = status === 'won' ? 'live' : status === 'lost' ? 'down' : status === 'placed' ? 'accent' : undefined
      out.push({ id: `bet-${bet.id}`, source: 'prediction', title: betTitle(bet, c), sub: c.prediction, atomic: bet.stakeAtomic, date: bet.createdAt, bucket, label: c.betStates[status], tone, path: betPath(bet) })
    }
    return out
  }, [quant.data, bets.data, c])
  return { rows, ready: (quant.data !== undefined || quant.error !== undefined) && (bets.data !== undefined || bets.error !== undefined) }
}
