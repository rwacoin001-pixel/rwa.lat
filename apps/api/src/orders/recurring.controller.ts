import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common'
import { CurrentAuth } from '../security/current-auth.decorator'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { SecurityActor } from '../security/security.service'
import { RecurringService } from './recurring.service'
import { CreateRecurringDto, RecurringStateDto } from './recurring.dto'

@Controller('recurring-investments')
@UseGuards(SessionAuthGuard)
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}
  @Get() list(@CurrentAuth() actor: SecurityActor) { return this.recurring.list(actor.userId) }
  @Post() create(@CurrentAuth() actor: SecurityActor, @Body() input: CreateRecurringDto, @Headers('idempotency-key') key: string) { return this.recurring.create(actor.userId,input,key) }
  @Put(':id/state') state(@CurrentAuth() actor: SecurityActor, @Param('id', ParseUUIDPipe) id: string, @Body() input: RecurringStateDto) { return this.recurring.changeState(actor.userId,id,input.state) }
}
