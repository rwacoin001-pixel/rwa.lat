import { Transform, Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class AdminUserListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 50
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset = 0
  @IsOptional() @IsString() @MaxLength(200) @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  q?: string
  @IsOptional() @IsIn(['active', 'restricted', 'suspended', 'closed'])
  status?: string
}

export class AdminUserAdjustmentDto {
  @IsUUID() operationId!: string
  @IsIn(['credit', 'debit', 'set']) mode!: 'credit' | 'debit' | 'set'
  @IsString() @Matches(/^(0|[1-9]\d{0,71})(?:\.\d{1,6})?$/) amount!: string
  @IsString() @Matches(/^(0|[1-9]\d{0,77})$/) expectedAtomicBalance!: string
  @IsString() @MinLength(3) @MaxLength(240)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  reason!: string
}
