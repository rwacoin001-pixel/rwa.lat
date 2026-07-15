import { IsIn, IsISO8601, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator'
import type { WalletNetwork } from '../wallet/wallet.entities'

export class CreateLedgerAdjustmentDto {
  @IsUUID()
  ledgerAccountId!: string

  @IsIn(['debit', 'credit'])
  side!: 'debit' | 'credit'

  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode!: string

  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>
}

export class DecideLedgerAdjustmentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason?: string
}

export class ListLedgerAdjustmentsQueryDto {
  @IsOptional()
  @IsIn(['requested', 'approved', 'rejected', 'posted'])
  state?: 'requested' | 'approved' | 'rejected' | 'posted'

  @IsOptional()
  @Matches(/^\d{1,3}$/)
  limit?: string
}

export class RunCustodyReconciliationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  provider!: string

  @IsIn(['tron', 'ethereum', 'arbitrum'])
  network!: WalletNetwork

  @Matches(/^(0|[1-9]\d{0,77})$/)
  observedAtomicBalance!: string

  @IsISO8601({ strict: true })
  periodStart!: string

  @IsISO8601({ strict: true })
  periodEnd!: string

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  sourceReference!: string
}

export class CustodyReconciliationCallbackDto {
  @IsIn(['tron', 'ethereum', 'arbitrum'])
  network!: WalletNetwork

  @Matches(/^(0|[1-9]\d{0,77})$/)
  observedAtomicBalance!: string

  @IsISO8601({ strict: true })
  periodStart!: string

  @IsISO8601({ strict: true })
  periodEnd!: string

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  sourceReference!: string
}

export class ListReconciliationQueryDto {
  @IsOptional()
  @IsIn(['running', 'matched', 'differences_found', 'failed'])
  state?: 'running' | 'matched' | 'differences_found' | 'failed'

  @IsOptional()
  @Matches(/^\d{1,3}$/)
  limit?: string
}
