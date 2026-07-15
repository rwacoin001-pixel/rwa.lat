import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from '../security/audit-log.entity'
import { AdminRbacController } from './admin-rbac.controller'
import { AdminRbacService } from './admin-rbac.service'
import { AdminSessionAuthService } from './admin-session-auth.service'
import { AdminSessionGuard } from './admin-session.guard'
import {
  AdminApprovalRequest,
  AdminRole,
  AdminRolePermission,
  AdminSession,
  AdminUser,
} from './admin-rbac.entities'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminRole,
      AdminRolePermission,
      AdminUser,
      AdminSession,
      AdminApprovalRequest,
      AuditLog,
    ]),
  ],
  controllers: [AdminRbacController],
  providers: [AdminRbacService, AdminSessionAuthService, AdminSessionGuard],
  exports: [AdminRbacService, AdminSessionAuthService, AdminSessionGuard],
})
export class AdminRbacModule {}
