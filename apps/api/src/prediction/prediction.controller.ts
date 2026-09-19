import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { RequestWithContext } from '../common/request-context.middleware'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { ListPredictionBetsQueryDto, PlacePredictionBetDto } from './prediction.dto'
import { PredictionService } from './prediction.service'

@ApiTags('predictions')
@Controller('predictions')
export class PredictionController {
  constructor(private readonly prediction: PredictionService) {}

  @Get('status')
  @ApiOperation({ summary: 'Prediction betting availability and per-bet limits' })
  status() {
    return this.prediction.status()
  }
}

@ApiTags('predictions')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('predictions')
export class PredictionUserController {
  constructor(private readonly prediction: PredictionService) {}

  @Post('bets')
  @ApiOperation({ summary: 'Place a prediction bet using the account balance (internal market)' })
  place(
    @CurrentAuth() actor: SecurityActor,
    @Req() req: RequestWithContext,
    @Body() dto: PlacePredictionBetDto,
  ) {
    return this.prediction.placeBet(actor.userId, req.requestId ?? 'prediction-bet', {
      tokenId: dto.tokenId,
      stakeAtomic: dto.stakeAtomic,
      expectedPrice: dto.expectedPrice,
      idempotencyKey: dto.idempotencyKey,
    })
  }

  @Get('bets')
  @ApiOperation({ summary: 'List my prediction bets (paginated)' })
  list(@CurrentAuth() actor: SecurityActor, @Query() query: ListPredictionBetsQueryDto) {
    return this.prediction.listBets(actor.userId, query.page ?? 1, query.limit ?? 20)
  }

  @Get('bets/:id')
  @ApiOperation({ summary: 'Read one of my prediction bets' })
  get(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.prediction.getBet(actor.userId, id)
  }
}
