import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard, type AuthenticatedRequest } from '../security/session-auth.guard'
import { CreateYieldBatchDto, SettlePredictionDto } from './yield.dto'
import { YieldService } from './yield.service'

@ApiTags('yield')
@ApiBearerAuth()
@UseGuards(SessionAuthGuard)
@Controller('yield')
export class YieldController {
  constructor(private readonly yields: YieldService) {}

  @Get()
  list(@CurrentAuth() actor: SecurityActor) {
    return this.yields.listForUser(actor.userId)
  }
}

@ApiTags('demo-admin')
@Controller('demo-admin')
export class DemoYieldController {
  constructor(private readonly yields: YieldService) {}

  @Get('yields')
  list() {
    return this.yields.listForAdmin()
  }

  @Post('yields')
  create(@Body() dto: CreateYieldBatchDto, @Req() request: AuthenticatedRequest) {
    return this.yields.create(dto, request.requestId ?? `demo-yield-${Date.now()}`)
  }

  @Post('yields/:id/preview')
  preview(@Param('id') id: string) {
    return this.yields.preview(id)
  }

  @Post('yields/:id/approve')
  approve(@Param('id') id: string) {
    return this.yields.approve(id)
  }

  @Post('yields/:id/execute')
  execute(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.yields.execute(id, request.requestId ?? `demo-yield-execute-${Date.now()}`)
  }

  @Post('predictions/settle')
  settlePrediction(@Body() dto: SettlePredictionDto, @Req() request: AuthenticatedRequest) {
    return this.yields.settlePrediction(dto.productId, dto.outcomeKey, request.requestId ?? `demo-prediction-${Date.now()}`)
  }

  @Post('predictions')
  createPrediction(@Req() request: AuthenticatedRequest) {
    return this.yields.createDemoPredictionMarket(request.requestId ?? `demo-prediction-create-${Date.now()}`)
  }
}
