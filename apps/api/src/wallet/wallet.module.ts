import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdentityModule } from '../identity/identity.module'
import { SecurityModule } from '../security/security.module'
import { LedgerModule } from '../ledger/ledger.module'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { Session } from '../identity/session.entity'
import { Device } from '../identity/device.entity'
import { AuditLog } from '../security/audit-log.entity'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { OperationsModule } from '../operations/operations.module'
import { StubCustodyAdapter } from './stub-custody.adapter'
import { CustodyWebhookVerifier } from './custody-webhook.verifier'
import { AdminFundsOperationsController, AdminWalletController, DemoWalletController, WalletCallbackController, WalletController, WalletPublicController } from './wallet.controller'
import { InternalServiceGuard, InternalWalletController } from './internal-ops.controller'
import { FundsOperationalSwitchService } from './funds-operational-switch.service'
import { WalletLedgerBridge } from './wallet-ledger.bridge'
import { WalletNetworkRegistry } from './wallet-network.registry'
import { WalletService } from './wallet.service'
import { WithdrawalExecutionWorker } from './withdrawal-execution.worker'
import { ChainWatcherService } from './manual/chain-watcher.service'
import { DepositPoolService } from './manual/deposit-pool.service'
import { ManualCustodyAdapter } from './manual/manual-custody.adapter'
import { TronClientService } from './manual/tron-client.service'
import { WithdrawalWhitelistService } from './manual/withdrawal-whitelist.service'
import { DepositPoolAddress, WithdrawalWhitelistEntry } from './manual/manual-custody.entities'
import {
  ChainTransaction,
  CustodyWallet,
  Deposit,
  InternalTransfer,
  LedgerAccount,
  LedgerAccountBalance,
  WalletAddress,
  Withdrawal,
  WithdrawalAddressBookEntry,
  WithdrawalApprovalDecision,
} from './wallet.entities'

@Module({
  imports: [
    IdentityModule,
    SecurityModule,
    LedgerModule,
    JobQueueModule,
    AdminRbacModule,
    OperationsModule,
    TypeOrmModule.forFeature([
      CustodyWallet,
      WalletAddress,
      ChainTransaction,
      Deposit,
      Withdrawal,
      InternalTransfer,
      LedgerAccount,
      LedgerAccountBalance,
      Session,
      Device,
      AuditLog,
      WithdrawalAddressBookEntry,
      WithdrawalApprovalDecision,
      DepositPoolAddress,
      WithdrawalWhitelistEntry,
    ]),
  ],
  controllers: [
    WalletPublicController,
    WalletController,
    WalletCallbackController,
    AdminWalletController,
    AdminFundsOperationsController,
    DemoWalletController,
    InternalWalletController,
  ],
  providers: [
    WalletService,
    WalletNetworkRegistry,
    WalletLedgerBridge,
    CustodyWebhookVerifier,
    FundsOperationalSwitchService,
    WithdrawalExecutionWorker,
    TronClientService,
    DepositPoolService,
    WithdrawalWhitelistService,
    ManualCustodyAdapter,
    ChainWatcherService,
    InternalServiceGuard,
    StubCustodyAdapter,
    {
      // Adapter selection: 'stub' (demo, default) or 'manual' (operator-held keys).
      // Anything else denies startup so environment variables can never claim an
      // adapter implementation this release image does not contain.
      provide: 'CustodyAdapter',
      inject: [ConfigService, StubCustodyAdapter, ManualCustodyAdapter],
      useFactory: (config: ConfigService, stub: StubCustodyAdapter, manual: ManualCustodyAdapter) => {
        const mode = (config.get<string>('WALLET_CUSTODY_ADAPTER') ?? 'stub').trim().toLowerCase()
        if (mode === '' || mode === 'stub' || mode === 'demo') return stub
        if (mode === 'manual') return manual
        throw new Error(`WALLET_CUSTODY_ADAPTER=${mode} is not installed in this release image`)
      },
    },
  ],
  exports: [WalletService],
})
export class WalletModule {}
