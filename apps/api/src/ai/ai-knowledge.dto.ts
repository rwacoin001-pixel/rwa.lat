import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export const AI_LOCALES = ['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'pt'] as const

export class SaveKnowledgeDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) expectedRevision!: number
  @ApiProperty({ maxLength: 200 }) @IsString() @MinLength(1) @MaxLength(200) title!: string
  @ApiProperty({ maxLength: 600 }) @IsString() @MaxLength(600) summary!: string
  @ApiProperty({ maxLength: 6000 }) @IsString() @MinLength(1) @MaxLength(6000) body!: string
  @ApiProperty({ maxLength: 80 }) @IsString() @MinLength(1) @MaxLength(80) category!: string
  @ApiProperty({ enum: AI_LOCALES }) @IsIn(AI_LOCALES) locale!: string
  @ApiProperty({ enum: ['public', 'authenticated', 'internal'] }) @IsIn(['public', 'authenticated', 'internal']) visibility!: string
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsUUID('4', { each: true }) productIds!: string[]
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsISO8601({ strict: true }) effectiveAt!: string | null
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsISO8601({ strict: true }) expiresAt!: string | null
}

export class KnowledgeRevisionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedRevision!: number
}
export class RestoreKnowledgeDto extends KnowledgeRevisionDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) sourceRevision!: number
}
export class KnowledgeQueryDto {
  @ApiPropertyOptional({ enum: AI_LOCALES }) @IsOptional() @IsIn(AI_LOCALES) locale?: string
}
export class KnowledgePreviewDto {
  @IsString() @MinLength(1) @MaxLength(2000) question!: string
  @IsIn(AI_LOCALES) locale!: string
  @IsBoolean() authenticated!: boolean
}
