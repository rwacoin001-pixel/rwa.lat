import { IsIn, IsISO8601, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { WalletNetwork } from '../wallet/wallet.entities'

export class CreateLedgerAdjustmentDto {
  @ApiProperty()
  @IsUUID()
  ledgerAccountId!: string

  @ApiProperty()
  @IsIn(['debit', 'credit'])
  side!: 'debit' | 'credit'

  @ApiProperty()
  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>
}

export class DecideLedgerAdjustmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason?: string
}

export class ListLedgerAdjustmentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['requested', 'approved', 'rejected', 'posted'])
  state?: 'requested' | 'approved' | 'rejected' | 'posted'

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,3}$/)
  limit?: string
}

export class RunCustodyReconciliationDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  provider!: string

  @ApiProperty()
  @IsIn(['tron', 'ethereum', 'arbitrum'])
  network!: WalletNetwork

  @ApiProperty()
  @Matches(/^(0|[1-9]\d{0,77})$/)
  observedAtomicBalance!: string

  @ApiProperty()
  @IsISO8601({ strict: true })
  periodStart!: string

  @ApiProperty()
  @IsISO8601({ strict: true })
  periodEnd!: string

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  sourceReference!: string
}

export class CustodyReconciliationCallbackDto {
  @ApiProperty()
  @IsIn(['tron', 'ethereum', 'arbitrum'])
  network!: WalletNetwork

  @ApiProperty()
  @Matches(/^(0|[1-9]\d{0,77})$/)
  observedAtomicBalance!: string

  @ApiProperty()
  @IsISO8601({ strict: true })
  periodStart!: string

  @ApiProperty()
  @IsISO8601({ strict: true })
  periodEnd!: string

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  sourceReference!: string
}

export class ListReconciliationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['running', 'matched', 'differences_found', 'failed'])
  state?: 'running' | 'matched' | 'differences_found' | 'failed'

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{1,3}$/)
  limit?: string
}
