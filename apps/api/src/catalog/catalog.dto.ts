import { IsOptional, IsString, Matches } from 'class-validator'

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,31}$/)
  assetClass?: string

  @IsOptional()
  @IsString()
  @Matches(/^(published|suspended)$/)
  state?: 'published' | 'suspended'
}
