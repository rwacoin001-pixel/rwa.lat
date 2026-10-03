export type PredictionBook = { asks: Array<{ price: number; size: number }>; bids: Array<{ price: number; size: number }>; fetchedAt: string; asOf?: string }
/**
 * Conservative internal quote: require enough liquidity at the displayed best price.
 *
 * Freshness note (2026-10-02): only OUR fetch time (`fetchedAt`) decides staleness.
 * `asOf` is the provider's book timestamp — Polymarket advances it only when the book
 * actually changes, so an inactive market's book legitimately freezes for minutes and
 * its age grows without bound. Judging staleness by it made every thin market report
 * "quote expired" permanently, and the offered "refresh" could never clear it because
 * the upstream timestamp does not move. A frozen book is still the live book: the
 * price is accurate, nobody has traded. So `asOf` is returned for display only.
 */
export function predictionQuote(book: PredictionBook | null | undefined, probability: number | undefined, amount: number, now = Date.now()) {
  const asks = (book?.asks ?? []).filter(x => Number.isFinite(x.price) && x.price > 0 && x.price < 1 && Number.isFinite(x.size) && x.size > 0).sort((a,b) => a.price-b.price)
  const price = asks[0]?.price ?? null
  const providerAge = now - Date.parse(book?.asOf ?? '')
  const receivedAge = now - Date.parse(book?.fetchedAt ?? '')
  const depth = price === null ? 0 : asks.filter(x => x.price === price).reduce((total,x) => total+x.price*x.size,0)
  const reason: 'unavailable'|'no_liquidity'|'expired'|'invalid_price'|'price_deviation'|null = !book ? 'unavailable' : price === null ? 'no_liquidity'
    : !Number.isFinite(receivedAge) || receivedAge < -5000 || receivedAge > 120000 ? 'expired'
    : probability === undefined || !Number.isFinite(probability) ? 'invalid_price'
    : Math.abs(price-probability) > .1 + 1e-9 ? 'price_deviation'
    : depth + 1e-9 < amount ? 'no_liquidity' : null
  return { price, available: reason === null, depth, reason, providerAgeMs: Number.isFinite(providerAge) ? providerAge : null }
}
