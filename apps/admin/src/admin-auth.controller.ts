import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common'
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import type { Request } from 'express'
import { AdminPublic } from './admin.guard.decorator'
import { AdminAuthService } from './admin-auth.service'
import { AdminSessionGuard, type AdminRequest } from './admin-session.guard'

class AdminLoginDto {
  @IsEmail()
  @IsString()
  @MaxLength(254)
  email!: string

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  mfaCode?: string
}
class AdminChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(256) currentPassword!:string
  @IsString() @MinLength(12) @MaxLength(256) newPassword!:string
  @IsOptional() @IsString() @Matches(/^\d{6}$/) mfaCode?:string
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}
  @UseGuards(AdminSessionGuard)
  @Get('security')
  security(@Req() request: AdminRequest) {
    if (!request.admin?.id) throw new Error('Authenticated administrator missing')
    return this.auth.securityStatus(request.admin.id)
  }
  @UseGuards(AdminSessionGuard)
  @Post('password')
  changePassword(@Req() request:AdminRequest,@Body() dto:AdminChangePasswordDto){
    if(!request.admin?.id)throw new Error('Authenticated administrator missing')
    return this.auth.changePassword(request.admin.id,dto)
  }

  @AdminPublic()
  @Post('login')
  async login(@Body() dto: AdminLoginDto, @Req() request: Request) {
    const result = await this.auth.login({
      email: dto.email,
      password: dto.password,
      mfaCode: dto.mfaCode,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })
    return result
  }

  @UseGuards(AdminSessionGuard)
  @Post('logout')
  async logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
    await this.auth.logout(token)
    return { status: 'ok' }
  }

  @UseGuards(AdminSessionGuard)
  @Post('refresh')
  async refresh(@Headers('authorization') authorization: string | undefined, @Req() request: Request) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
    return this.auth.refresh(token, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    })
  }

  @UseGuards(AdminSessionGuard)
  @Get('me')
  me(@Req() request: AdminRequest) {
    return request.admin
  }
}
