import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { WalletNetwork } from '../wallet.entities'

const networks: WalletNetwork[] = ['tron', 'ethereum', 'arbitrum']

export class WithdrawalQuoteDto {
  @ApiProperty()
  @IsIn(networks)
  network!: WalletNetwork

  @ApiProperty()
  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string
}

export class CreateWithdrawalDto extends WithdrawalQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  addressBookId?: string

  @ApiProperty()
  @ValidateIf((value: CreateWithdrawalDto) => !value.addressBookId)
  @IsString()
  @MinLength(20)
  @MaxLength(160)
  destination?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  reauthentication!: string
}

export class AddWithdrawalAddressDto {
  @ApiProperty()
  @IsIn(networks)
  network!: WalletNetwork

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(160)
  destination!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string

  @ApiProperty()
  @IsString()
  @MinLength(20)
  reauthentication!: string
}

export class RevokeWithdrawalAddressDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  reauthentication!: string
}

export class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  recipientUserId!: string

  @ApiProperty()
  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  reauthentication!: string
}

export class DepositCallbackDto {
  @ApiProperty()
  @IsIn(networks)
  network!: WalletNetwork

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(160)
  transactionHash!: string

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(160)
  destinationAddress!: string

  @ApiProperty()
  @Matches(/^[1-9]\d{0,77}$/)
  atomicAmount!: string

  @ApiProperty()
  @IsInt()
  @Min(0)
  confirmations!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  outputIndex?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d+$/)
  blockNumber?: string

  @ApiProperty()
  @IsIn(['clear', 'manual_review', 'blocked'])
  riskDecision!: 'clear' | 'manual_review' | 'blocked'
}

export class WithdrawalCallbackDto {
  @ApiProperty()
  @IsUUID()
  withdrawalId!: string

  @ApiProperty()
  @IsIn(networks)
  network!: WalletNetwork

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(160)
  transactionHash!: string

  @ApiProperty()
  @IsInt()
  @Min(0)
  confirmations!: number

  @ApiProperty()
  @IsIn(['broadcast', 'confirming', 'confirmed', 'failed'])
  state!: 'broadcast' | 'confirming' | 'confirmed' | 'failed'

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d+$/)
  blockNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode?: string
}

export class AdminWithdrawalDecisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode?: string
}

export class DemoWithdrawalDecisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reasonCode?: string
}

export class PauseFundsExecutionDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  reason!: string
}

export class RequestFundsResumeDto extends PauseFundsExecutionDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/)
  changeId!: string
}

export class GenerateDepositPoolDto {
  @ApiProperty()
  @IsIn(networks)
  network!: WalletNetwork

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100)
  count!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string
}

export class ImportDepositPoolAddressDto {
  @ApiProperty()
  @IsIn(networks)
  network!: WalletNetwork

  @ApiProperty()
  @IsString()
  @MinLength(26)
  @MaxLength(64)
  address!: string

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{64}$/)
  privateKey?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string
}

export class DisableDepositPoolAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string
}

export class AddWithdrawalWhitelistDto {
  @ApiProperty()
  @IsUUID()
  userId!: string

  @ApiProperty()
  @IsIn(networks)
  network!: WalletNetwork

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string
}

export class RevokeWithdrawalWhitelistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string
}
