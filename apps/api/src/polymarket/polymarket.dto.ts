import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class ListPolymarketMarketsQueryDto {
  @IsOptional()
  @IsIn(['discovered', 'active', 'closed', 'resolved', 'archived', 'suspended'])
  state?: 'discovered' | 'active' | 'closed' | 'resolved' | 'archived' | 'suspended'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class SyncPolymarketMarketsDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cursor?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
