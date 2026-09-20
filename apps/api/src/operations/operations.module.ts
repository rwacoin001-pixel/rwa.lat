import { Module } from '@nestjs/common'
import { OperationalCapabilityService } from './operational-capability.service'
import { OperationsController } from './operations.controller'

@Module({
  controllers: [OperationsController],
  providers: [OperationalCapabilityService],
  exports: [OperationalCapabilityService],
})
export class OperationsModule {}

