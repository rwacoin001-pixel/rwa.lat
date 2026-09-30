import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ArticleQueryDto {
  @ApiPropertyOptional({ enum: ['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'pt'], default: 'en' })
  @IsOptional() @IsIn(['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'pt']) locale?: string
}
export class SaveArticleDto {
  @ApiProperty({ maxLength: 100, pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' })
  @IsString() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) @MaxLength(100) slug!: string
  @ApiProperty({ enum: ['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'pt'] })
  @IsIn(['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'pt']) locale!: string
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200) title!: string
  @ApiProperty({ maxLength: 600 })
  @IsString() @MaxLength(600) summary!: string
  @ApiProperty({ minLength: 1, maxLength: 50000 })
  @IsString() @MinLength(1) @MaxLength(50000) body!: string
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120) author!: string
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional() @IsInt() @Min(1) expectedRevision?: number
}
export class PublishArticleDto {
  @ApiProperty({ minimum: 1 })
  @IsInt() @Min(1) expectedRevision!: number
}

export class ArticleSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string
  @ApiProperty() slug!: string
  @ApiProperty() locale!: string
  @ApiProperty() title!: string
  @ApiProperty() summary!: string
  @ApiProperty() author!: string
  @ApiProperty({ format: 'date-time' }) publishedAt!: string
  @ApiProperty({ minimum: 1 }) revision!: number
}
export class ArticleDto extends ArticleSummaryDto {
  @ApiProperty() body!: string
}
