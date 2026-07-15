import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator'

export class ListQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0
}

export class RedemptionListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['requested', 'queued', 'executing', 'completed', 'canceled', 'failed'])
  state?: 'requested' | 'queued' | 'executing' | 'completed' | 'canceled' | 'failed'
}
