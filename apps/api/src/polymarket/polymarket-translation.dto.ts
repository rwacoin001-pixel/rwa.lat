import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class TranslatePolymarketMarketsDto {
  @ApiProperty({ type: [String], maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^\d{1,20}$/, { each: true })
  ids!: string[]

  @ApiProperty({ enum: ['zh-CN', 'hi', 'es', 'ar', 'fr', 'pt'] })
  @IsIn(['zh-CN', 'hi', 'es', 'ar', 'fr', 'pt'])
  locale!: 'zh-CN' | 'hi' | 'es' | 'ar' | 'fr' | 'pt'

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeRules?: boolean
}

export class TranslateContentDto {
  @IsIn(['en','zh-CN','hi','es','ar','fr','pt'])
  locale!: 'en' | 'zh-CN' | 'hi' | 'es' | 'ar' | 'fr' | 'pt'
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @IsString({each:true}) @MinLength(1,{each:true}) @MaxLength(4000,{each:true})
  texts!: string[]
}
