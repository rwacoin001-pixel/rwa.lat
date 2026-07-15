import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength, ValidateIf } from 'class-validator'
import type { WalletNetwork } from '../wallet.entities'

const networks: WalletNetwork[] = ['tron', 'ethereum', 'arbitrum']

export class WithdrawalQuoteDto {
  @IsIn(networks)
  network!: WalletNetwork

  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string
}

export class CreateWithdrawalDto extends WithdrawalQuoteDto {
  @IsOptional()
  @IsUUID()
  addressBookId?: string

  @ValidateIf((value: CreateWithdrawalDto) => !value.addressBookId)
  @IsString()
  @MinLength(20)
  @MaxLength(160)
  destination?: string

  @IsOptional()
  @IsString()
  @MinLength(20)
  reauthentication!: string
}

export class AddWithdrawalAddressDto {
  @IsIn(networks)
  network!: WalletNetwork

  @IsString()
  @MinLength(20)
  @MaxLength(160)
  destination!: string

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string

  @IsString()
  @MinLength(20)
  reauthentication!: string
}

export class RevokeWithdrawalAddressDto {
  @IsString()
  @MinLength(20)
  reauthentication!: string
}

export class CreateTransferDto {
  @IsUUID()
  recipientUserId!: string

  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string

  @IsOptional()
  @IsString()
  @MinLength(20)
  reauthentication!: string
}

export class DepositCallbackDto {
  @IsIn(networks)
  network!: WalletNetwork

  @IsString()
  @MinLength(10)
  @MaxLength(160)
  transactionHash!: string

  @IsString()
  @MinLength(20)
  @MaxLength(160)
  destinationAddress!: string

  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string

  @IsInt()
  @Min(0)
  confirmations!: number

  @IsOptional()
  @IsInt()
  @Min(0)
  outputIndex?: number

  @IsOptional()
  @Matches(/^\d+$/)
  blockNumber?: string

  @IsIn(['clear', 'manual_review', 'blocked'])
  riskDecision!: 'clear' | 'manual_review' | 'blocked'
}

export class WithdrawalCallbackDto {
  @IsUUID()
  withdrawalId!: string

  @IsIn(networks)
  network!: WalletNetwork

  @IsString()
  @MinLength(10)
  @MaxLength(160)
  transactionHash!: string

  @IsInt()
  @Min(0)
  confirmations!: number

  @IsIn(['broadcast', 'confirming', 'confirmed', 'failed'])
  state!: 'broadcast' | 'confirming' | 'confirmed' | 'failed'

  @IsOptional()
  @Matches(/^\d+$/)
  blockNumber?: string

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode?: string
}

export class AdminWithdrawalDecisionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode?: string
}

export class DemoWithdrawalDecisionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode?: string
}

export class PauseFundsExecutionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason!: string
}

export class RequestFundsResumeDto extends PauseFundsExecutionDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/)
  changeId!: string
}
