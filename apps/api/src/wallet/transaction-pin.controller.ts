import { Body, Controller, Get, Header, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger'
import { IsString, MaxLength } from 'class-validator'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { VerifiedEmailGuard } from '../security/verified-email.guard'
import type { SecurityActor } from '../security/security.service'
import { TransactionPinService } from './transaction-pin.service'

class TransactionPinDto {
  @ApiProperty() @IsString() @MaxLength(6) pin!: string
  @ApiProperty() @IsString() @MaxLength(6) confirmation!: string
  @ApiProperty() @IsString() @MaxLength(4096) reauthentication!: string
}
class ChangeTransactionPinDto extends TransactionPinDto {
  @ApiProperty() @IsString() @MaxLength(6) currentPin!: string
}
@ApiTags('security')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('security/transaction-password')
export class TransactionPinController {
  constructor(private readonly pin: TransactionPinService) {}
  @Get() @Header('Cache-Control', 'no-store')
  status(@CurrentAuth() actor: SecurityActor) { return this.pin.status(actor.userId) }
  @Post('setup') @Header('Cache-Control', 'no-store') @UseGuards(VerifiedEmailGuard)
  setup(@CurrentAuth() actor: SecurityActor, @Body() dto: TransactionPinDto, @Req() request: AuthenticatedRequest) {
    return this.pin.setup(actor, dto, request.requestId ?? 'unknown')
  }
  @Post('change') @Header('Cache-Control', 'no-store') @UseGuards(VerifiedEmailGuard)
  change(@CurrentAuth() actor: SecurityActor, @Body() dto: ChangeTransactionPinDto, @Req() request: AuthenticatedRequest) {
    return this.pin.change(actor, dto, request.requestId ?? 'unknown')
  }
  @Post('reset') @Header('Cache-Control', 'no-store') @UseGuards(VerifiedEmailGuard)
  reset(@CurrentAuth() actor: SecurityActor, @Body() dto: TransactionPinDto, @Req() request: AuthenticatedRequest) {
    return this.pin.reset(actor, dto, request.requestId ?? 'unknown')
  }
}
