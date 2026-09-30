import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, Equals, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard, AuthenticatedRequest } from '../security/session-auth.guard'
import { AI_ACCOUNT_SCOPES, AiAccountScope, AiCustomerToolsService } from './ai-customer-tools.service'

export class AiAccountQueryDto {
  @ApiProperty({ enum: AI_ACCOUNT_SCOPES, isArray: true }) @IsArray() @ArrayNotEmpty() @ArrayMaxSize(4) @ArrayUnique() @IsIn(AI_ACCOUNT_SCOPES, { each: true }) scopes!: AiAccountScope[]
}
export class AiTicketDraftDto {
  @ApiProperty() @IsString() @Length(1, 200) subject!: string
  @ApiProperty() @IsString() @Length(1, 5000) body!: string
  @ApiProperty({ enum: ['support', 'dispute', 'appeal', 'scam_report'] }) @IsIn(['support', 'dispute', 'appeal', 'scam_report']) category!: 'support' | 'dispute' | 'appeal' | 'scam_report'
  @IsOptional() @IsUUID() orderId?: string
}
export class AiConfirmTicketDto {
  @ApiProperty({ enum: [true] }) @IsBoolean() @Equals(true) confirmed!: boolean
}
@Controller('ai') @UseGuards(SessionAuthGuard)
export class AiCustomerToolsController {
  constructor(private readonly tools: AiCustomerToolsService) {}
  @Post('account-summary') account(@CurrentAuth() auth: AuthenticatedRequest['auth'], @Body() input: AiAccountQueryDto) { return this.tools.account(auth.userId, input.scopes) }
  @Post('ticket-drafts') draft(@CurrentAuth() auth: AuthenticatedRequest['auth'], @Body() input: AiTicketDraftDto) { return this.tools.draftTicket(auth.userId, input) }
  @Post('ticket-drafts/:id/confirm') confirm(@CurrentAuth() auth: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string, @Body() input: AiConfirmTicketDto) { return this.tools.confirmTicket(auth.userId, id, input.confirmed) }
}
