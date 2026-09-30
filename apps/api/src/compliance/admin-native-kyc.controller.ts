import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { NativeKycService } from './native-kyc.service'
import { ComplianceService } from './compliance.service'
import { DecideKycDto } from './dto/compliance.dto'

@ApiTags('admin-compliance')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
@Controller('admin/kyc')
export class AdminNativeKycController {
  constructor(private readonly native: NativeKycService, private readonly compliance: ComplianceService, private readonly rbac: AdminRbacService) {}

  @Get(':id/checks')
  async checks(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string) {
    await this.rbac.assertPermission(admin.id, 'compliance.manage')
    return this.native.reviewEvidence(id)
  }

  @Post(':id/decision')
  async decide(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideKycDto) {
    await this.rbac.assertPermission(admin.id, 'compliance.manage')
    const result = await this.compliance.decideKyc(id, dto.decision, dto.reasonCode, admin.id)
    return this.compliance.toPublicKycCase(result)
  }
}
