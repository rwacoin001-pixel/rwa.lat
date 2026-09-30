import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDefined, IsInt, IsString, Matches, MaxLength, Min, MinLength, ValidateNested } from 'class-validator'

export class LegalSectionDto {
  @IsString() @MaxLength(160) title!: string
  @IsString() @MinLength(1) @MaxLength(20000) body!: string
}
export class LegalContentDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) effectiveDate!: string
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => LegalSectionDto) sections!: LegalSectionDto[]
}
export class SaveLegalDto {
  @IsInt() @Min(0) expectedRevision!: number
  @IsDefined() @ValidateNested() @Type(() => LegalContentDto) content!: LegalContentDto
}
export class PublishLegalDto {
  @IsInt() @Min(1) expectedRevision!: number
}
