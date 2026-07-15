import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BackupDrill, DataDeletionRequest } from './data-governance.entities'
import { DataGovernanceService } from './data-governance.service'
import { DataGovernanceController } from './data-governance.controller'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'

@Module({
  imports: [TypeOrmModule.forFeature([BackupDrill, DataDeletionRequest]), AdminRbacModule],
  controllers: [DataGovernanceController],
  providers: [DataGovernanceService],
  exports: [DataGovernanceService],
})
export class DataGovernanceModule {}
