// CMC Provider 实弹冒烟：provider → 线上 CMC API（需 CMC_API_KEY 于 apps/api/.env）
import 'dotenv/config'

const { CoinMarketCapClient } = await import('../../dist/rwa-market/providers/coinmarketcap/coinmarketcap.client.js')
const { CoinMarketCapRwaProvider } = await import('../../dist/rwa-market/providers/coinmarketcap/coinmarketcap.provider.js')

const provider = new CoinMarketCapRwaProvider(new CoinMarketCapClient())

const health = await provider.healthCheck()
console.log('health:', JSON.stringify(health))
if (!health.ok) process.exit(1)

const assets = await provider.syncAssets({ limit: 5, maxItems: 5 })
console.log('\nassets(5):')
for (const a of assets) {
  console.log(`  #${a.externalId} ${a.name} [${a.assetClass}] rank=${a.rank} tokenized=${a.isTokenized} slug=${a.externalSlug}`)
}

const metrics = await provider.syncMetrics({ limit: 5, maxItems: 3 })
console.log('\nmetrics(3):')
for (const m of metrics) {
  console.log(`  #${m.externalId} price=${m.priceUsd?.slice(0, 12)} mcap=${m.tokenizedMarketCapUsd?.slice(0, 14)} at=${m.dataTimestamp?.toISOString()}`)
}

const issuers = await provider.syncIssuers({ maxItems: 5 })
console.log('\nissuers(5):', issuers.map((i) => `${i.name}(${i.tokenCount})`).join(' | '))

const one = await provider.getAsset('1')
console.log('\ngetAsset(1):', one?.name, '|', one?.assetClass, '| desc:', (one?.description ?? '').slice(0, 80))
