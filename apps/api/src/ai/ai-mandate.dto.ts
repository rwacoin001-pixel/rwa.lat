import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, Equals, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AI_LOCALES } from './ai-knowledge.dto'
import { AI_MANDATE_TERMS_VERSION, AI_RISK_BANDS, AiRiskBand } from './ai-mandate.policy'

export class AiManagedPositionDto {
  @ApiProperty() @IsUUID() positionId!: string
  @ApiProperty() @IsString() @Matches(/^[1-9][0-9]{0,77}$/) quantityAtomic!: string
}
export class AiMandateDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision!: number
  @ApiProperty({ enum: [true] }) @IsBoolean() @Equals(true) confirmed!: boolean
  @ApiProperty({ enum: [AI_MANDATE_TERMS_VERSION] }) @IsString() @Equals(AI_MANDATE_TERMS_VERSION) termsVersion!: string
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ArrayUnique() @IsUUID(undefined, { each: true }) allowedProductIds!: string[]
  @ApiProperty({ type: [AiManagedPositionDto] }) @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => AiManagedPositionDto) positions!: AiManagedPositionDto[]
  @ApiProperty() @IsString() @Matches(/^(0|[1-9][0-9]{0,77})$/) cashBudgetAtomic!: string
  @ApiProperty() @IsString() @Matches(/^(0|[1-9][0-9]{0,77})$/) cashReserveAtomic!: string
  @ApiProperty() @IsString() @Matches(/^[1-9][0-9]{0,77}$/) maxManagedValueAtomic!: string
  @ApiProperty() @IsString() @Matches(/^[1-9][0-9]{0,77}$/) maxActionAtomic!: string
  @ApiProperty() @IsString() @Matches(/^[1-9][0-9]{0,77}$/) maxDailyTurnoverAtomic!: string
  @ApiProperty() @IsString() @Matches(/^[1-9][0-9]{0,77}$/) maxTotalTurnoverAtomic!: string
  @ApiProperty({ enum: AI_RISK_BANDS }) @IsIn(AI_RISK_BANDS) riskBand!: AiRiskBand
  @ApiProperty() @IsInt() @Min(1) @Max(10000) maxProductWeightBps!: number
  @ApiProperty() @IsInt() @Min(1) @Max(10000) maxUnrealizedLossBps!: number
  @ApiProperty() @IsInt() @Min(1) @Max(3650) horizonDays!: number
  @ApiProperty() @IsInt() @Min(0) @Max(3650) maxLockDays!: number
  @ApiProperty() @IsInt() @Min(0) @Max(10000) maxFeeBps!: number
  @ApiProperty() @IsString() @Matches(/^(0|[1-9][0-9]{0,77})$/) maxFeeAtomic!: string
  @ApiProperty() @IsBoolean() allowBuy!: boolean
  @ApiProperty() @IsBoolean() allowRedeem!: boolean
  @ApiProperty() @IsBoolean() reinvestProceeds!: boolean
  @ApiProperty() @IsInt() @Min(15) @Max(10080) scheduleIntervalMinutes!: number
  @ApiProperty() @IsInt() @Min(15) @Max(43200) minTradeIntervalMinutes!: number
  @ApiProperty() @IsInt() @Min(1) @Max(10000) rebalanceThresholdBps!: number
  @ApiProperty() @IsISO8601({ strict: true }) effectiveAt!: string
  @ApiProperty() @IsISO8601({ strict: true }) expiresAt!: string
  @ApiProperty() @IsString() @Length(1, 2000) goals!: string
  @ApiProperty({ enum: AI_LOCALES }) @IsIn(AI_LOCALES) locale!: string
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2) @ArrayUnique() @IsIn(['in_app', 'email'], { each: true }) notifications!: string[]
}
export class AiMandateStateDto {
  @ApiProperty() @IsInt() @Min(1) expectedRevision!: number
  @ApiProperty({ enum: [true] }) @IsBoolean() @Equals(true) confirmed!: boolean
}
export class AiEvaluateDto {
  @ApiProperty() @IsInt() @Min(1) expectedRevision!: number
  @ApiProperty() @IsUUID() idempotencyKey!: string
}
export class AiExecutionRuleDto {
  @ApiProperty() @IsInt() @Min(0) expectedRevision!: number
  @ApiProperty({ enum: ['enabled','disabled'] }) @IsIn(['enabled','disabled']) state!: string
  @ApiProperty() @IsUUID() termsKnowledgeId!: string
  @ApiProperty() @IsInt() @Min(1) termsRevision!: number
  @ApiProperty({ enum: AI_RISK_BANDS }) @IsIn(AI_RISK_BANDS) riskBand!: AiRiskBand
  @ApiProperty() @IsInt() @Min(0) @Max(3650) lockDays!: number
  @ApiProperty() @IsInt() @Min(0) @Max(10000) buyFeeBps!: number
  @ApiProperty() @IsString() @Matches(/^(0|[1-9][0-9]{0,77})$/) buyFeeFixedAtomic!: string
  @ApiProperty() @IsInt() @Min(0) @Max(10000) redeemFeeBps!: number
  @ApiProperty() @IsString() @Matches(/^(0|[1-9][0-9]{0,77})$/) redeemFeeFixedAtomic!: string
}
