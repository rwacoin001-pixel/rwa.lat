import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// Keep ts-jest memory bounded by starting a fresh, serial process for each
// small batch. Database-backed suites intentionally remain in test:integration.
const batches = [
  [
    'test/catalog/catalog.service.spec.ts',
    'test/catalog/demo-quote-seed.spec.ts',
    'test/ai/ai-model.client.spec.ts',
    'test/compliance/compliance-core.spec.ts',
    'test/compliance/compliance-didit.spec.ts',
    'test/compliance/compliance-partner.spec.ts',
    'test/compliance/kyc/real-didit-kyc.provider.spec.ts',
    'test/config/production-environment.spec.ts',
    'test/config/production-runtime-capabilities.spec.ts',
  ],
  [
    'test/database-options.spec.ts',
    'test/data-governance/data-masking.spec.ts',
    'test/health-readiness.spec.ts',
    'test/http-exception-filter.spec.ts',
    'test/cors-options.spec.ts',
    'test/investment-eligibility.spec.ts',
    'test/platform/platform.service.spec.ts',
    'test/portfolio/rebalance.service.spec.ts',
    'test/yield/yield-schedule.spec.ts',
    'test/generated-documents/document-generation.worker.spec.ts',
  ],
  [
    'test/identity/identity.service.spec.ts',
    'test/identity/identity-crypto.spec.ts',
    'test/identity/identity-delivery.spec.ts',
    'test/identity/oauth-provider.spec.ts',
    'test/ledger/ledger-core.spec.ts',
    'test/ledger/ledger-callback.spec.ts',
    'test/notification/notification.service.spec.ts',
  ],
  [
    'test/orders/orders.precision-guards.spec.ts',
    'test/notification/user-ops.service.spec.ts',
    'test/notification/user-ops-invitation-acceptance.spec.ts',
    'test/polymarket/polymarket-public.adapter.spec.ts',
    'test/polymarket/polymarket.service.spec.ts',
    'test/portfolio/portfolio.service.spec.ts',
    'test/portfolio/portfolio-snapshot.worker.spec.ts',
  ],
  [
    'test/route-contract.spec.ts',
    'test/security/security-core.spec.ts',
    'test/security/api-edge-security.spec.ts',
    'test/wallet/wallet-core.spec.ts',
    'test/wallet/wallet-ledger-bridge.spec.ts',
    'test/wallet/wallet-webhook.spec.ts',
    'test/wallet/funds-operational-switch.spec.ts',
    'test/job-queue/partner-callback.verifier.spec.ts',
    'test/job-queue/job-queue-core.spec.ts',
    'test/object-storage/object-storage-security.spec.ts',
    'test/production-route-guards.spec.ts',
    'test/wallet/withdrawal-execution.worker.spec.ts',
  ],
  [
    'test/frontend-http-contract.spec.ts',
    'test/ai/ai-status.spec.ts',
    'test/basket/basket-decimals.spec.ts',
    'test/community/community.util.spec.ts',
    'test/compliance/didit-webhook-verify.spec.ts',
    'test/compliance/risk-profile.service.spec.ts',
    'test/orders/order-amounts.spec.ts',
  ],
  [
    'test/rwa-analysis/scoring-rules.spec.ts',
    'test/rwa-market/cmc-provider.spec.ts',
    'test/rwa-market/rwa-normalizer.spec.ts',
    'test/wallet/manual-custody.adapter.spec.ts',
    'test/wallet/tron-address.spec.ts',
    'test/wallet/tron-signer.spec.ts',
  ],
]

const jestBin = resolve('node_modules/jest/bin/jest.js')
const heapMb = Number(process.env.TEST_UNIT_HEAP_MB ?? '768')
if (!Number.isInteger(heapMb) || heapMb < 256 || heapMb > 4096) throw new Error('TEST_UNIT_HEAP_MB must be an integer from 256 to 4096.')
let passedSuites = 0

for (const batch of batches) {
  const result = spawnSync(
    process.execPath,
    [`--max-old-space-size=${heapMb}`, jestBin, '--runInBand', ...batch],
    { cwd: process.cwd(), env: process.env, stdio: 'inherit' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  passedSuites += batch.length
}

console.log(`Low-memory unit verification passed: ${passedSuites} suites.`)
