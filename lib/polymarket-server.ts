import 'server-only'

const addressPattern = /^0x[a-fA-F0-9]{40}$/

export function polymarketServerConfig() {
  const signerAddress = process.env.POLYMARKET_RELAYER_API_KEY_ADDRESS
  const builderAddress = process.env.POLYMARKET_BUILDER_ADDRESS
  const apiKey = process.env.POLYMARKET_RELAYER_API_KEY

  return {
    marketDataReady: true,
    relayerConfigured: Boolean(apiKey && signerAddress && addressPattern.test(signerAddress)),
    signerAddress: signerAddress && addressPattern.test(signerAddress) ? signerAddress : null,
    builderAddress: builderAddress && addressPattern.test(builderAddress) ? builderAddress : null,
    tradingEnabled: false,
  }
}
