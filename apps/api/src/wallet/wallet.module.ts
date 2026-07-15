import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdentityModule } from '../identity/identity.module'
import { SecurityModule } from '../security/security.module'
import { LedgerModule } from '../ledger/ledger.module'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { Session } from '../identity/session.entity'
import { Device } from '../identity/device.entity'
import { AuditLog } from '../security/audit-log.entity'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { StubCustodyAdapter } from './stub-custody.adapter'
import { CustodyWebhookVerifier } from './custody-webhook.verifier'
import { AdminFundsOperationsController, AdminWalletController, DemoWalletController, WalletCallbackController, WalletController, WalletPublicController } from './wallet.controller'
import { FundsOperationalSwitchService } from './funds-operational-switch.service'
import { WalletLedgerBridge } from './wallet-ledger.bridge'
import { WalletNetworkRegistry } from './wallet-network.registry'
import { WalletService } from './wallet.service'
import { WithdrawalExecutionWorker } from './withdrawal-execution.worker'
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
    ]),
  ],
  controllers: [WalletPublicController, WalletController, WalletCallbackController, AdminWalletController, AdminFundsOperationsController, DemoWalletController],
  providers: [
    WalletService,
    WalletNetworkRegistry,
    WalletLedgerBridge,
    CustodyWebhookVerifier,
    FundsOperationalSwitchService,
    WithdrawalExecutionWorker,
    { provide: 'CustodyAdapter', useClass: StubCustodyAdapter },
  ],
  exports: [WalletService],
})
export class WalletModule {}
