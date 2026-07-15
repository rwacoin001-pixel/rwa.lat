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

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

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
