import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SecurityModule } from '../security/security.module'
import { TransactionPinService } from './transaction-pin.service'

@Module({
  imports: [ConfigModule, SecurityModule],
  providers: [TransactionPinService],
  exports: [TransactionPinService],
})
export class TransactionPinModule {}
