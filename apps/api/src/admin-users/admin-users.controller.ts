import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AdminSessionGuard, type AdminAuthenticatedRequest } from '../admin-rbac/admin-session.guard'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { LedgerService } from '../ledger/ledger.service'
import { AdminUserAdjustmentDto, AdminUserListDto } from './admin-users.dto'
import { AdminUsersService } from './admin-users.service'

@Controller('admin/user-management')
@UseGuards(AdminSessionGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService, private readonly ledger: LedgerService, private readonly rbac: AdminRbacService) {}

  // The authenticated service channel delegates RBAC to the separately authenticated admin gateway.
  // A supplied actor header alone never reaches here: AdminSessionGuard first verifies the shared service token.
  private async authorize(request: AdminAuthenticatedRequest, permissions: string[]) {
    const actor = request.admin!
    const delegated = actor.roleId === 'service-channel' && actor.sessionId === `service:${actor.id}` && actor.permissions.includes('*')
    if (!delegated) for (const permission of permissions) await this.rbac.assertPermission(actor.id, permission)
    return actor.id
  }
  @Get()
  async list(@Req() request: AdminAuthenticatedRequest, @Query() query: AdminUserListDto) {
    await this.authorize(request, ['users.read'])
    return this.users.list(query)
  }
  @Get(':id')
  async detail(@Req() request: AdminAuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.authorize(request, ['users.read'])
    return this.users.detail(id)
  }
  @Post(':id/balance-adjustments')
  async adjust(@Req() request: AdminAuthenticatedRequest, @Param('id', new ParseUUIDPipe()) userId: string, @Body() body: AdminUserAdjustmentDto) {
    const adminId = await this.authorize(request, ['users.read', 'ledger.adjustments.manage', 'ledger.adjustments.post'])
    return this.ledger.adjustUserBalance({ ...body, userId, adminId, requestId: randomUUID() })
  }
}
