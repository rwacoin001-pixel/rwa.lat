import { Body, Controller, Post, Req } from '@nestjs/common'
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator'
import type { Request } from 'express'
import { AdminPublic } from './admin.guard.decorator'
import { AdminTotpService } from './admin-totp.service'
class EmailDto { @IsEmail() @MaxLength(254) email!:string }
class EmailCodeDto extends EmailDto { @IsString() @Matches(/^\d{6}$/) code!:string }
class ConfirmDto { @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) recoveryToken!:string; @IsString() @Matches(/^\d{6}$/) code!:string }
@Controller('admin/auth')
export class AdminTotpController {
  constructor(private readonly service:AdminTotpService){}
  @AdminPublic() @Post('totp-login')
  login(@Body() dto:EmailCodeDto,@Req() request:Request){return this.service.login(dto.email,dto.code,{ipAddress:request.ip,userAgent:request.headers['user-agent']})}
  @AdminPublic() @Post('recovery/request')
  request(@Body() dto:EmailDto){return this.service.requestRecovery(dto.email)}
  @AdminPublic() @Post('recovery/verify')
  verify(@Body() dto:EmailCodeDto){return this.service.verifyRecovery(dto.email,dto.code)}
  @AdminPublic() @Post('recovery/confirm')
  confirm(@Body() dto:ConfirmDto){return this.service.confirmRecovery(dto.recoveryToken,dto.code)}
}
