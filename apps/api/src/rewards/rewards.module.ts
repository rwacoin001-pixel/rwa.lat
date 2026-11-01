import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { WalletNetworkRegistry } from '../wallet/wallet-network.registry'
import { RewardsController } from './rewards.controller'
import { RewardsService } from './rewards.service'
import { RewardsLiveGuard } from './rewards-live.guard'

@Module({ imports: [SecurityModule], controllers: [RewardsController], providers: [RewardsService, RewardsLiveGuard, WalletNetworkRegistry] })
export class RewardsModule {}
