import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { IdentityModule } from '../identity/identity.module'
import { Session } from '../identity/session.entity'
import { SecurityModule } from '../security/security.module'
import { ComplianceService } from './compliance.service'
import { NativeKycService } from './native-kyc.service'
import { AdminNativeKycController } from './admin-native-kyc.controller'
import { RiskProfileService } from './risk-profile.service'
import { RiskProfile } from './risk-profile.entity'
import { ComplianceController } from './compliance.controller'
import { KycCase } from './kyc-case.entity'
import { EligibilityProfile } from './eligibility-profile.entity'
import { RiskFlag } from './risk-flag.entity'
import { ScreeningCase } from './screening-case.entity'
import { StubKycProvider } from './stub-kyc.provider'
import { StubSanctionsProvider } from './stub-sanctions.provider'
import { DisabledSanctionsProvider } from './disabled-sanctions.provider'
import type { KycProvider } from './kyc-provider.interface'
import type { SanctionsProvider } from './sanctions-provider.interface'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { RealDiditKycProvider } from './kyc/providers/real-didit-kyc.provider'
import { PlatformModule } from '../platform/platform.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([KycCase, EligibilityProfile, RiskFlag, ScreeningCase, RiskProfile, Session]),
    IdentityModule,
    SecurityModule,
    AdminRbacModule,
    ConfigModule,
    PlatformModule,
  ],
  controllers: [ComplianceController, AdminNativeKycController],
  providers: [
    ComplianceService,
    NativeKycService,
    RiskProfileService,
    {
      provide: 'KycProvider',
      useFactory: (configService: ConfigService) => {
        const provider = (configService.get<string>('KYC_PROVIDER') ?? 'stub').trim().toLowerCase()
        if (provider === 'didit') {
          return new RealDiditKycProvider(configService)
        }
        const financialMode = configService.get<string>('PRODUCTION_FINANCIAL_FEATURES_ENABLED') === 'true'
        if (['', 'stub', 'demo'].includes(provider) && !financialMode) {
          return new StubKycProvider()
        }
        throw new Error(`Unsupported or unsafe KYC_PROVIDER: ${provider || '<empty>'}`)
      },
      inject: [ConfigService],
    },
    {
      provide: 'SanctionsProvider',
      useFactory: (configService: ConfigService) => {
        const provider = (configService.get<string>('SANCTIONS_PROVIDER') ?? 'stub').trim().toLowerCase()
        if (provider === 'disabled') {
          return new DisabledSanctionsProvider()
        }
        const financialMode = configService.get<string>('PRODUCTION_FINANCIAL_FEATURES_ENABLED') === 'true'
        if (['', 'stub', 'demo'].includes(provider) && !financialMode) {
          return new StubSanctionsProvider(configService)
        }
        throw new Error(`Unsupported or unsafe SANCTIONS_PROVIDER: ${provider || '<empty>'}`)
      },
      inject: [ConfigService],
    },
  ],
  exports: [ComplianceService, RiskProfileService],
})
export class ComplianceModule {}
