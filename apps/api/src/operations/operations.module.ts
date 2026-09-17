import { Module } from '@nestjs/common'
import { OperationalCapabilityService } from './operational-capability.service'

@Module({
  providers: [OperationalCapabilityService],
  exports: [OperationalCapabilityService],
})
export class OperationsModule {}
