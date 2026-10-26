import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { AiNotificationDigestService } from './ai-notification-digest.service'

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('ai/notifications')
export class AiNotificationDigestController {
  constructor(private readonly digests: AiNotificationDigestService) {}

  @Get('digest')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'One sentence summarising the signed-in user’s unread notifications (facts only)' })
  digest(@CurrentAuth() actor: SecurityActor, @Query('locale') locale?: string) {
    return this.digests.digest(actor.userId, typeof locale === 'string' ? locale.slice(0, 8) : 'en')
  }
}
