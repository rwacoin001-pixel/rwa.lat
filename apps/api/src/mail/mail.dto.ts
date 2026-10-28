import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsBase64, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator'

export class MailAttachmentDto {
  @IsString() @MaxLength(500) filename!: string
  @IsString() @Matches(/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/) @MaxLength(200) contentType!: string
  @IsInt() @Min(0) @Max(10 * 1024 * 1024) size!: number
  @IsBoolean() dropped!: boolean
  @IsOptional() @IsBase64() @MaxLength(6990508) content?: string
}
export class InboundMailDto {
  @IsString() @Matches(/^<[^<>\s]{1,990}>$/) messageId!: string
  @IsEmail() @MaxLength(254) from!: string
  @IsArray() @ArrayMaxSize(100) @IsEmail({}, { each: true }) to!: string[]
  @IsArray() @ArrayMaxSize(100) @IsEmail({}, { each: true }) cc!: string[]
  @IsString() @MaxLength(1000) @Matches(/^[^\r\n]*$/) subject!: string
  @IsString() @MaxLength(2 * 1024 * 1024) text!: string
  @IsString() @MaxLength(2 * 1024 * 1024) html!: string
  @IsOptional() @IsString() @Matches(/^<[^<>\s]{1,990}>$/) inReplyTo?: string
  @IsArray() @ArrayMaxSize(100) @Matches(/^<[^<>\s]{1,990}>$/, { each: true }) references!: string[]
  @IsOptional() @IsString() @MaxLength(100) spamVerdict?: string
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => MailAttachmentDto) attachments!: MailAttachmentDto[]
}
export class MailListDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string
  @IsOptional() @IsIn(['all','unread','archived']) filter?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset?: number
}
export class MailStateDto {
  @IsOptional() @IsBoolean() unread?: boolean
  @IsOptional() @IsBoolean() archived?: boolean
  // Assignment is always to the authenticated administrator; no client-supplied actor IDs.
  @IsOptional() @IsIn(['me','none']) assign?: 'me' | 'none'
}
export class MailReplyDto {
  @IsString() @MinLength(1) @MaxLength(20000) @Matches(/\S/) text!: string
  @IsBoolean() replyAll!: boolean
  @IsUUID() requestKey!: string
}
