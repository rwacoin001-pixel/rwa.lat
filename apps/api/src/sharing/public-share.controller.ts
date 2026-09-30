import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { IsIn, IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard } from '../security/session-auth.guard'
import type { SecurityActor } from '../security/security.service'
import { PublicShareService, PublicShareKind } from './public-share.service'

export class CreatePublicShareDto {
  @ApiProperty({enum:['product','community_post']}) @IsIn(['product','community_post']) kind!: PublicShareKind
  @ApiProperty({format:'uuid'}) @IsUUID() resourceId!: string
}
@Controller('shares')
export class PublicShareController {
  constructor(private readonly sharing: PublicShareService) {}
  @Get(':token') @Header('Cache-Control','no-store')
  resolve(@Param('token') token: string) { return this.sharing.resolve(token) }
  @Post() @UseGuards(SessionAuthGuard)
  create(@CurrentAuth() actor: SecurityActor, @Body() input: CreatePublicShareDto) { return this.sharing.create(actor.userId,input) }
  @Post(':id/revoke') @UseGuards(SessionAuthGuard)
  revoke(@CurrentAuth() actor: SecurityActor, @Param('id',new ParseUUIDPipe()) id: string) { return this.sharing.revoke(actor.userId,id) }
  @Get('owned/links') @UseGuards(SessionAuthGuard) @Header('Cache-Control','no-store')
  list(@CurrentAuth() actor:SecurityActor,@Query() input:CreatePublicShareDto){return this.sharing.listOwn(actor.userId,input)}
}
