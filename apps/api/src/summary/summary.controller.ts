import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { SummaryService } from './summary.service'

@ApiTags('summary')
@ApiBearerAuth()
@Controller('summary')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Home summary for the signed-in user: balance, basket positions, unread notifications' })
  forUser(@CurrentAuth() actor: SecurityActor) {
    return this.summary.forUser(actor.userId)
  }
}
