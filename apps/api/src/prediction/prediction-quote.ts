import { parseDecimal18, SHARES_SCALE, ATOMIC_PER_UNIT } from './prediction-hedge-math'
/** Require executable sell liquidity at the price used by the internal ledger.
 *  新鲜度只看【我们自己这次抓取】的时间（fetchedAt）：上游盘口时间戳（asOf）只在盘口
 *  真正变化时前进，冷门市场会冻结数分钟甚至更久，拿它判陈旧会让这些市场永远无法下注。 */
export function validatedPredictionPrice(book: { tokenId: string; stale: boolean; fetchedAt: Date; asks: Array<{price: string; size: string}> }, tokenId: string, riskStake: bigint, probability: number | null, now = Date.now()): bigint | null {
  const age = now - new Date(book.fetchedAt).getTime()
  if (book.tokenId !== tokenId || book.stale || !Number.isFinite(age) || age < -5000 || age > 120000 || probability === null || !Number.isFinite(probability) || probability < 0 || probability > 1) return null
  const levels = book.asks.flatMap(level => {
    try { const price = parseDecimal18(level.price); const size = parseDecimal18(level.size); return price > 0n && price < SHARES_SCALE && size > 0n ? [{price,size}] : [] } catch { return [] }
  }).sort((a,b) => a.price < b.price ? -1 : a.price > b.price ? 1 : 0)
  const price = levels[0]?.price
  if (!price || Math.abs(Number(price)/Number(SHARES_SCALE)-probability) > .1 + 1e-9) return null
  const size = levels.filter(x => x.price === price).reduce((sum,x) => sum+x.size, 0n)
  return size * price * ATOMIC_PER_UNIT >= riskStake * SHARES_SCALE * SHARES_SCALE ? price : null
}
