import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdentityModule } from '../identity/identity.module'
import { Session } from '../identity/session.entity'
import { SecurityModule } from '../security/security.module'
import { ComplianceService } from './compliance.service'
import { ComplianceController } from './compliance.controller'
import { KycCase } from './kyc-case.entity'
import { EligibilityProfile } from './eligibility-profile.entity'
import { RiskFlag } from './risk-flag.entity'
import { ScreeningCase } from './screening-case.entity'
import { StubKycProvider } from './stub-kyc.provider'
import { StubSanctionsProvider } from './stub-sanctions.provider'
import { RegionPolicy } from './region-policy'
import type { KycProvider } from './kyc-provider.interface'
import type { SanctionsProvider } from './sanctions-provider.interface'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([KycCase, EligibilityProfile, RiskFlag, ScreeningCase, Session]),
    IdentityModule,
    SecurityModule,
    AdminRbacModule,
  ],
  controllers: [ComplianceController],
  providers: [
    ComplianceService,
    RegionPolicy,
    { provide: 'KycProvider', useClass: StubKycProvider },
    { provide: 'SanctionsProvider', useClass: StubSanctionsProvider },
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}
