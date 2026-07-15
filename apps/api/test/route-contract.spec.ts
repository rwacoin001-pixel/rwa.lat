import { PATH_METADATA } from '@nestjs/common/constants'
import { AdminRbacController } from '../src/admin-rbac/admin-rbac.controller'
import { ComplianceController } from '../src/compliance/compliance.controller'
import { HealthController } from '../src/health/health.controller'
import { IdentityController } from '../src/identity/identity.controller'
import { PortfolioController } from '../src/portfolio/portfolio.controller'
import { CORE_API_PREFIX } from '../src/route-contract'
import { AdminFundsOperationsController, AdminWalletController, DemoWalletController, WalletCallbackController, WalletController, WalletPublicController } from '../src/wallet/wallet.controller'
import { AdminLedgerController, LedgerCallbackController, LedgerController } from '../src/ledger/ledger.controller'

describe('Core API route contract', () => {
  it('owns the v1 prefix once in bootstrap and never in controller paths', () => {
    expect(CORE_API_PREFIX).toBe('v1')
    const controllers = [
      HealthController,
      IdentityController,
      WalletPublicController,
      WalletController,
      WalletCallbackController,
      DemoWalletController,
      ComplianceController,
      PortfolioController,
      AdminRbacController,
      AdminWalletController,
      AdminFundsOperationsController,
      LedgerController,
      LedgerCallbackController,
      AdminLedgerController,
    ]
    for (const controller of controllers) {
      const path = Reflect.getMetadata(PATH_METADATA, controller) as string
      expect(path).not.toMatch(/^v1(?:\/|$)/)
      expect(path).not.toMatch(/^admin\/admin(?:\/|$)/)
    }
  })
})
