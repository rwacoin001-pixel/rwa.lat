import { BadRequestException, Body, CallHandler, Controller, ExecutionContext, Get, Injectable, Module, NestInterceptor, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { Observable } from 'rxjs'
import type { Request, Response } from 'express'
import { IsInt, IsObject, IsString, Matches, Min } from 'class-validator'
import { ReferralModule } from './referral.module'
import { ReferralContext } from './referral-context'
import { ReferralBindingService } from './referral-binding.service'
import { ReferralFoundationService } from './referral-foundation.service'
import { ReferralReadService } from './referral-read.service'
import { SecurityModule } from '../security/security.module'
import { SessionAuthGuard, AuthenticatedRequest } from '../security/session-auth.guard'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'

export function referralCookie(req: Request): string | undefined {
  const part = req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('rwa_referral='))
  if (!part) return undefined
  try { return decodeURIComponent(part.slice('rwa_referral='.length)) } catch { return undefined }
}
@Injectable()
export class ReferralContextInterceptor implements NestInterceptor {
  constructor(private readonly context: ReferralContext) {}
  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getType()!=='http') return next.handle()
    const req=ctx.switchToHttp().getRequest<Request>()
    // Cookie wins for first-click attribution. A signed header also supports native/cross-domain registration.
    const token=referralCookie(req) ?? req.header('x-referral-attribution')
    return new Observable(subscriber=>this.context.run(token,()=>next.handle().subscribe(subscriber)))
  }
}
class CodeDto { @IsString() @Matches(/^[a-zA-Z0-9]{6,16}$/) code!: string }
class SettingsDto { @IsObject() config!: Record<string,unknown> }
class RollbackDto { @IsInt() @Min(1) version!: number }

@Controller('r')
export class ReferralLandingController {
  constructor(private readonly binding: ReferralBindingService) {}
  @Get(':code')
  async land(@Param('code') code: string, @Req() req: Request, @Res({passthrough:true}) res: Response) {
    if (!/^[a-zA-Z0-9]{6,16}$/.test(code)) throw new BadRequestException('Invalid referral code')
    const result=await this.binding.land(code,referralCookie(req))
    res.setHeader('Cache-Control','no-store')
    res.cookie('rwa_referral',result.token,{httpOnly:true,secure:req.secure,sameSite:'lax',path:'/',expires:result.expiresAt})
    return { attributionToken:result.token,expiresAt:result.expiresAt,registrationOnly:true }
  }
}
@UseGuards(SessionAuthGuard)
@Controller('referral')
export class ReferralUserFoundationController {
  constructor(private readonly binding: ReferralBindingService,private readonly core: ReferralFoundationService,private readonly read:ReferralReadService) {}
  @Get('summary') summary(@Req() req:AuthenticatedRequest) { return this.read.summary(req.auth.userId) }
  @Get('invitees') invitees(@Req() req:AuthenticatedRequest,@Query('page') page?:string,@Query('pageSize') size?:string,@Query('level') level?:string) { return this.read.invitees(req.auth.userId,page,size,level) }
  @Get('rewards') rewards(@Req() req:AuthenticatedRequest,@Query('page') page?:string,@Query('pageSize') size?:string) { return this.read.rewards(req.auth.userId,page,size) }
  @Get('me') async me(@Req() req: AuthenticatedRequest) { return {code:await this.binding.getCode(req.auth.userId),stage:0,payoutsEnabled:false} }
  @Post('code') async code(@Req() req: AuthenticatedRequest,@Body() dto: CodeDto) { return {code:await this.binding.changeCode(req.auth.userId,dto.code)} }
  @Post('claim') claim() { return this.core.assertPayoutsDisabled() }
}
@UseGuards(AdminSessionGuard)
@Controller('admin/referral')
export class ReferralAdminFoundationController {
  constructor(private readonly core: ReferralFoundationService,private readonly rbac: AdminRbacService,private readonly read:ReferralReadService) {}
  @Get('overview') async overview(@CurrentAdmin() admin:AuthenticatedAdmin,@Query('page') page?:string,@Query('pageSize') size?:string) {
    await this.rbac.assertPermission(admin.id,'platform.manage'); return this.read.overview(page,size)
  }
  @Get('settings') async settings(@CurrentAdmin() admin: AuthenticatedAdmin) { await this.rbac.assertPermission(admin.id,'platform.manage'); return this.core.settings() }
  @Post('settings/save') async save(@CurrentAdmin() admin: AuthenticatedAdmin,@Body() dto: SettingsDto) {
    await this.rbac.assertPermission(admin.id,'platform.manage'); return this.core.saveSettings(dto.config,admin.id)
  }
  @Get('settings/versions') async versions(@CurrentAdmin() admin: AuthenticatedAdmin) { return this.settings(admin) }
  @Post('settings/rollback') async rollback(@CurrentAdmin() admin: AuthenticatedAdmin,@Body() dto: RollbackDto) {
    await this.rbac.assertPermission(admin.id,'platform.manage'); return this.core.rollbackSettings(dto.version,admin.id)
  }
  @Get('reconciliation') async reconcile(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await this.rbac.assertPermission(admin.id,'platform.manage'); return this.core.reconcile()
  }
  @Get('runtime') async runtime(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await this.rbac.assertPermission(admin.id,'platform.manage'); return {stage:0,payoutsEnabled:false,budgetEnforcementEnabled:false}
  }
}
@Module({imports:[ReferralModule,SecurityModule,AdminRbacModule],
  controllers:[ReferralLandingController,ReferralUserFoundationController,ReferralAdminFoundationController],
  providers:[{provide:APP_INTERCEPTOR,useClass:ReferralContextInterceptor}]})
export class ReferralHttpModule {}
