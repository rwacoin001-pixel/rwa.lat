import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class ManualSettlementDto {
  @IsString() @MinLength(1) @MaxLength(160) @Matches(/\S/)
  externalReference!: string

  @IsString() @MaxLength(520) @Matches(/^rwa-attachments\/[^\r\n]+$/)
  evidenceRef!: string

  @IsString() @Matches(/^[1-9][0-9]{0,59}$/)
  amountAtomic!: string

  @IsString() @Matches(/^[1-9][0-9]{0,59}$/)
  quantityAtomic!: string
  @IsOptional() @IsString() @Matches(/^(0|[1-9][0-9]{0,59})$/)
  feeAtomic?: string
}

export class ReviewSettlementDto {
  @IsIn(['verified', 'exception'])
  state!: 'verified' | 'exception'

  @IsString() @MinLength(1) @MaxLength(2000) @Matches(/\S/)
  note!: string
}
