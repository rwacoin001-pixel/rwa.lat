import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { SummaryController } from './summary.controller'
import { SummaryService } from './summary.service'

@Module({
  imports: [SecurityModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
