import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator'
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
