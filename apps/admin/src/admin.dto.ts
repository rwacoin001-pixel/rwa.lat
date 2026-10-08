import { IsOptional, IsIn, IsInt, Min, Max, IsString, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'


export class ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0
}

export class RedemptionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['requested', 'queued', 'executing', 'completed', 'canceled', 'failed'])
  state?: 'requested' | 'queued' | 'executing' | 'completed' | 'canceled' | 'failed'
}

export class UserListQueryDto extends ListQueryDto {
  @Max(100) limit?: number = 50
  @IsOptional() @IsString() @MaxLength(200) q?: string
  @IsOptional() @IsIn(['active', 'restricted', 'suspended', 'closed']) status?: string
}
