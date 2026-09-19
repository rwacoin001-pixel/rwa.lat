import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class ListPolymarketMarketsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['discovered', 'active', 'closed', 'resolved', 'archived', 'suspended'])
  state?: 'discovered' | 'active' | 'closed' | 'resolved' | 'archived' | 'suspended'

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class SyncPolymarketMarketsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cursor?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
