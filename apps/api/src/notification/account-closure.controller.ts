import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common'
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard, AuthenticatedRequest } from '../security/session-auth.guard'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { AccountClosureService } from './account-closure.service'
class RequestDto { @IsString() @MinLength(1) @MaxLength(1000) reason!:string }
class ReviewDto { @IsIn(['close','reject']) decision!:'close'|'reject'; @IsString() @MinLength(1) @MaxLength(1000) note!:string }
@Controller('account-closure')
@UseGuards(SessionAuthGuard)
export class AccountClosureController {
  constructor(private readonly svc:AccountClosureService){}
  @Get() status(@CurrentAuth() a:AuthenticatedRequest['auth']){return this.svc.status(a.userId)}
  @Post() request(@CurrentAuth() a:AuthenticatedRequest['auth'],@Body() b:RequestDto){return this.svc.request(a.userId,b.reason)}
  @Post(':id/cancel') cancel(@CurrentAuth() a:AuthenticatedRequest['auth'],@Param('id',ParseUUIDPipe) id:string){return this.svc.cancel(a.userId,id)}
}
@Controller('admin/account-closures')
@UseGuards(AdminSessionGuard)
export class AdminAccountClosureController {
  constructor(private readonly svc:AccountClosureService,private readonly rbac:AdminRbacService){}
  private allow(a:AuthenticatedAdmin){return this.rbac.assertPermission(a.id,'users.account_closure.manage')}
  @Get() async list(@CurrentAdmin() a:AuthenticatedAdmin){await this.allow(a);return this.svc.list()}
  @Get(':id') async inspect(@CurrentAdmin() a:AuthenticatedAdmin,@Param('id',ParseUUIDPipe) id:string){await this.allow(a);return this.svc.inspect(id)}
  @Post(':id/review') async review(@CurrentAdmin() a:AuthenticatedAdmin,@Param('id',ParseUUIDPipe) id:string,@Body() b:ReviewDto){await this.allow(a);return this.svc.review(id,b.decision,b.note,a.id)}
}
