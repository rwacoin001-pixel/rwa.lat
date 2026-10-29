import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator'

export class AdminAiHistoryDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant'
  @IsString() @MaxLength(4000) content!: string
}

export class AdminAiQueryDto {
  @IsString() @Matches(/\S/) @MaxLength(2000) question!: string
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => AdminAiHistoryDto)
  history?: AdminAiHistoryDto[]
}

export class AdminAiExportDto {
  @IsUUID() auditId!: string
}
