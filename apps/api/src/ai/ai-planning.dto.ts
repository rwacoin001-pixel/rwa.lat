import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class SaveAiGoalsDto {
  @IsInt() @Min(0) expectedRevision!: number
  @IsString() @MinLength(1) @MaxLength(160) title!: string
  @IsString() @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/) budgetUsdt!: string
  @IsInt() @Min(1) @Max(600) horizonMonths!: number
  @IsIn(['low','medium','high']) riskTolerance!: 'low' | 'medium' | 'high'
  @IsString() @MaxLength(1000) notes!: string
  @IsIn(['en','zh-CN','hi','es','ar','fr','pt']) locale!: string
}
export class GenerateAiPlanDto { @IsInt() @Min(1) expectedRevision!: number }
