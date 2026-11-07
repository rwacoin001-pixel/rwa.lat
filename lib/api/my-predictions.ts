import type { PredictionBet } from '@/lib/rwa-api'
import type { AppLocale } from '@/lib/i18n'

const SETTLEMENT_COPY: Record<AppLocale, [string, string, string]> = {
  'zh-CN': ['等待官方结果', '结算处理中', '结果核对中'], en: ['Awaiting official result', 'Settlement in progress', 'Result under review'],
  es: ['Esperando el resultado oficial', 'Liquidación en curso', 'Resultado en revisión'], fr: ['En attente du résultat officiel', 'Règlement en cours', 'Résultat en cours de vérification'],
  pt: ['Aguardando resultado oficial', 'Liquidação em andamento', 'Resultado em análise'], hi: ['आधिकारिक परिणाम की प्रतीक्षा', 'निपटान जारी है', 'परिणाम की समीक्षा जारी है'],
  ar: ['بانتظار النتيجة الرسمية', 'التسوية قيد التنفيذ', 'النتيجة قيد المراجعة'],
}
export function predictionSettlementLabel(bet: PredictionBet, locale: string): string | null {
  if (bet.status !== 'placed' || !bet.settlementStatus) return null
  const copy = Object.hasOwn(SETTLEMENT_COPY, locale) ? SETTLEMENT_COPY[locale as AppLocale] : SETTLEMENT_COPY.en
  return bet.settlementStatus === 'waiting_result' ? copy[0] : bet.settlementStatus === 'review' ? copy[2] : copy[1]
}

export type BetStatus = 'placed' | 'won' | 'lost' | 'void' | 'unknown'

const ZERO = BigInt(0)
const big = (value: string | null | undefined) => value != null && /^\d+$/.test(value) ? BigInt(value) : null

export const betStatus = (status: string): BetStatus => status === 'placed' || status === 'won' || status === 'lost' || status === 'void' ? status : 'unknown'

/** Shares are a decimal count of $1 contracts; the server pays floor(shares × 10^6) atomic USDT gross. */
export function sharesToAtomic(shares: string): bigint | null {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(shares.trim())
  return match ? BigInt(match[1] + (match[2] ?? '').padEnd(6, '0').slice(0, 6)) : null
}

export type BetAmounts = {
  stake: bigint | null
  fee: bigint
  grossPayout: bigint | null
  payoutFee: bigint
  netPayout: bigint | null
  refund: bigint | null
}

export function betAmounts(bet: PredictionBet): BetAmounts {
  const stake = big(bet.stakeAtomic)
  const fee = big(bet.feeAtomic) ?? ZERO
  const payoutFee = big(bet.payoutFeeAtomic) ?? ZERO
  const grossPayout = sharesToAtomic(bet.shares)
  return {
    stake,
    fee,
    grossPayout,
    payoutFee,
    netPayout: grossPayout === null ? null : grossPayout - payoutFee,
    refund: stake === null ? null : stake - fee,
  }
}

export function betTotals(bets: PredictionBet[]) {
  let inPlay = ZERO
  let won = ZERO
  for (const bet of bets) {
    const amounts = betAmounts(bet)
    const status = betStatus(bet.status)
    if (status === 'placed' && amounts.stake !== null) inPlay += amounts.stake
    if (status === 'won' && amounts.netPayout !== null) won += amounts.netPayout
  }
  return { inPlay, won }
}
