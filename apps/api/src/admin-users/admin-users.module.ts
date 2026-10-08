import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { LedgerModule } from '../ledger/ledger.module'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { AdminUsersController } from './admin-users.controller'
import { AdminUsersService } from './admin-users.service'

@Module({ imports: [IdentityModule, LedgerModule, AdminRbacModule], controllers: [AdminUsersController], providers: [AdminUsersService] })
export class AdminUsersModule {}
