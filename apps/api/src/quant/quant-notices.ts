/**
 * Koala Quant notices (2026-10-28): the in-app messages a settlement sends — the day's result for each holder, and the
 * outcome of each redemption it handled. Written in the user's own language (users.locale; Chinese or English, other
 * locales fall back to English). Amounts come from the posted settlement, never estimated.
 */
export type QuantNotice = { userId: string; kind: string; title: string; body: string; payload: Record<string, unknown> }

/** Atomic USDT (6 decimals) → "1,234.56", sign kept. */
export function usdt(atomic: bigint): string {
  const negative = atomic < 0n
  const cents = ((negative ? -atomic : atomic) + 5_000n) / 10_000n
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '−' : ''}${whole}.${(cents % 100n).toString().padStart(2, '0')}`
}

const md = (date: string, zh: boolean) => {
  const [, m, d] = date.split('-').map(Number)
  return zh ? `${m}月${d}日` : new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function dailyNotice(input: { userId: string; locale: string | null; product: { slug: string; name: string }; tradeDate: string; net: bigint; paid: bigint }): QuantNotice {
  const zh = (input.locale ?? '').toLowerCase().startsWith('zh')
  const day = md(input.tradeDate, zh)
  const gain = input.net > 0n
  const title = zh
    ? `${input.product.name} ${day}结算：${gain ? '+' : ''}${usdt(input.net)} USDT`
    : `${input.product.name} settled ${day}: ${gain ? '+' : ''}${usdt(input.net)} USDT`
  const body = zh
    ? gain ? `收益 ${usdt(input.paid)} USDT 已到可用余额。` : input.net < 0n ? `当天亏损，已从本金中扣除。` : `当天持平，本金不变。`
    : gain ? `${usdt(input.paid)} USDT of profit is in your available balance.` : input.net < 0n ? `A loss for the day, taken from your principal.` : `Flat for the day; principal unchanged.`
  return { userId: input.userId, kind: 'quant.settled', title, body, payload: { product: input.product.slug, tradeDate: input.tradeDate, netAtomic: input.net.toString(), paidAtomic: input.paid.toString(), path: '/quant?tab=account' } }
}

export function redemptionNotice(input: { userId: string; locale: string | null; product: { slug: string; name: string }; tradeDate: string; orderId: string; payout: bigint; fee: bigint }): QuantNotice {
  const zh = (input.locale ?? '').toLowerCase().startsWith('zh')
  const title = zh ? `${input.product.name} 赎回已到账 ${usdt(input.payout)} USDT` : `${input.product.name} redemption paid: ${usdt(input.payout)} USDT`
  const body = zh
    ? `已到可用余额（${md(input.tradeDate, true)}结算，赎回费 ${usdt(input.fee)} USDT）。`
    : `Now in your available balance (settled ${md(input.tradeDate, false)}, redemption fee ${usdt(input.fee)} USDT).`
  return { userId: input.userId, kind: 'quant.redemption.settled', title, body, payload: { product: input.product.slug, orderId: input.orderId, tradeDate: input.tradeDate, payoutAtomic: input.payout.toString(), feeAtomic: input.fee.toString(), path: '/quant?tab=account' } }
}

export function redemptionRejectedNotice(input: { userId: string; locale: string | null; product: { slug: string; name: string }; orderId: string }): QuantNotice {
  const zh = (input.locale ?? '').toLowerCase().startsWith('zh')
  return {
    userId: input.userId, kind: 'quant.redemption.rejected',
    title: zh ? `${input.product.name} 赎回未成功` : `${input.product.name} redemption not completed`,
    body: zh ? '没有可赎回的本金，这笔赎回已关闭，没有扣款。' : 'There was no principal to redeem, so the request was closed. Nothing was charged.',
    payload: { product: input.product.slug, orderId: input.orderId, path: '/quant?tab=account' },
  }
}
