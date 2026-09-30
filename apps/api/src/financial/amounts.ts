/** Local settlement uses USDT with six decimal places. USD quotes are valued
 * at 1:1 against USDT until a live FX source is introduced. */
export const SETTLEMENT_ASSET_CODE = 'USDT'
export const SETTLEMENT_ASSET_DECIMALS = 6
export const USD_USDT_EQUIVALENT_CURRENCIES = ['USD', 'USDT'] as const

export function isUsdUsdtEquivalent(currency: string): boolean {
  return USD_USDT_EQUIVALENT_CURRENCIES.includes(currency as typeof USD_USDT_EQUIVALENT_CURRENCIES[number])
}

/** Convert a settlement-currency atomic amount into product quantity atomics. */
export function calculateProductQuantityAtomic(
  settlementAtomicAmount: bigint,
  settlementDecimals: number,
  productAssetDecimals: number,
  quoteDecimals: number,
  unitPriceAtomicAmount: bigint,
): bigint {
  const scaledSettlementAmount = settlementAtomicAmount
    * (10n ** BigInt(productAssetDecimals + quoteDecimals))
  const scaledUnitPrice = (10n ** BigInt(settlementDecimals)) * unitPriceAtomicAmount
  return scaledSettlementAmount / scaledUnitPrice
}

/** Convert product quantity into settlement-currency atomics at the quoted price. */
export function calculateSettlementPayoutAtomic(
  productQuantityAtomicAmount: bigint,
  productAssetDecimals: number,
  quoteDecimals: number,
  settlementDecimals: number,
  unitPriceAtomicAmount: bigint,
): bigint {
  const quoteAtomicAmount = productQuantityAtomicAmount * unitPriceAtomicAmount
  const settlementScale = 10n ** BigInt(settlementDecimals)
  const productAndQuoteScale = 10n ** BigInt(productAssetDecimals + quoteDecimals)
  return (quoteAtomicAmount * settlementScale) / productAndQuoteScale
}
