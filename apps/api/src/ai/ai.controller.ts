import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger'
import { AiService } from './ai.service'
import { AiChatDto, AiFeedbackDto } from './dto/ai.dto'
import { AiChatResponseDto } from './dto/ai-chat-response.dto'
import { OptionalSessionAuthGuard, type OptionallyAuthenticatedRequest } from '../security/optional-session-auth.guard'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { CurrentAuth } from '../security/current-auth.decorator'

interface OptionalAuth {
  userId: string | null
}

class AiStatusResponseDto {
  @ApiProperty({ description: 'Whether the AI provider is configured.' })
  enabled!: boolean

  @ApiProperty({ description: 'Compatibility alias for clients checking service availability.' })
  available!: boolean

  @ApiProperty({ description: 'Whether the AI provider credentials and endpoint are configured.' })
  configured!: boolean

  @ApiProperty()
  model!: string
  @ApiProperty() provider!: string
}

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'AI assistant availability (public)' })
  @ApiOkResponse({ type: AiStatusResponseDto })
  status() {
    return this.ai.status
  }

  @Post('chat')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Send a message to the AI assistant (works anonymous; history requires login)' })
  @ApiOkResponse({ type: AiChatResponseDto, description: 'Verified reply and optional clarification cards; cards do not authorize actions.' })
  async chat(
    @Body() dto: AiChatDto,
    @CurrentAuth() auth: OptionalAuth | undefined,
  ) {
    return this.ai.chat(auth?.userId ?? null, dto)
  }

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List my AI conversations' })
  listSessions(@CurrentAuth() auth: AuthenticatedRequest['auth']) {
    return this.ai.listSessions(auth.userId)
  }

  @Get('sessions/:id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Read one AI conversation with its messages' })
  getSession(@Param('id') id: string, @CurrentAuth() auth: AuthenticatedRequest['auth']) {
    return this.ai.getSession(auth.userId, id)
  }

  @Delete('sessions/:id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Delete one AI conversation' })
  deleteSession(@Param('id') id: string, @CurrentAuth() auth: AuthenticatedRequest['auth']) {
    return this.ai.deleteSession(auth.userId, id)
  }

  @Post('feedback')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Mark an assistant reply as helpful or not' })
  feedback(@Body() dto: AiFeedbackDto, @CurrentAuth() auth: AuthenticatedRequest['auth']) {
    return this.ai.feedback(auth.userId, dto.messageId, dto.helpful)
  }
}
