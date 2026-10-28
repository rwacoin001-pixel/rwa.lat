import { Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class AdminMailListDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string
  @IsOptional() @IsIn(['all','unread','archived']) filter?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset?: number
}
export class AdminMailStateDto {
  @IsOptional() @IsBoolean() unread?: boolean
  @IsOptional() @IsBoolean() archived?: boolean
  @IsOptional() @IsIn(['me','none']) assign?: 'me' | 'none'
}
export class AdminMailReplyDto {
  @IsString() @MinLength(1) @MaxLength(20000) @Matches(/\S/) text!: string
  @IsBoolean() replyAll!: boolean
  @IsUUID() requestKey!: string
}
