import { IsOptional, IsString, Matches } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ListProductsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,31}$/)
  assetClass?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^(published|suspended)$/)
  state?: 'published' | 'suspended'
}
