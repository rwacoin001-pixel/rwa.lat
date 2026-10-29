import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AI_ACCOUNT_SCOPES, AiAccountScope } from '../ai-customer-tools.service'
import type { AiAttachment } from '../ai-attachments'

export class AiChatDto {
  @ApiPropertyOptional({ description: 'Owned in-app notification to explain. The server verifies ownership and settlement.' })
  @IsOptional() @IsUUID()
  notificationId?: string
  @ApiPropertyOptional({ description: 'Up to three local document excerpts or resized JPEG image data URLs. No remote URLs; image pixels are transient and not stored.' })
  @IsOptional() @IsArray() @ArrayMaxSize(3)
  attachments?: AiAttachment[]
  @ApiProperty({ description: 'User message', minLength: 1, maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  message!: string

  @ApiPropertyOptional({ description: 'Existing session to continue' })
  @IsOptional()
  @IsString()
  sessionId?: string

  @ApiPropertyOptional({ description: 'Optional registered page key and market tab. Never include form values, account identifiers or authentication data.' })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>

  @ApiPropertyOptional({ description: 'Locale for the reply language, e.g. en / zh' })
  @IsOptional()
  @IsString()
  @Length(2, 8)
  locale?: string

  @ApiPropertyOptional({ enum: AI_ACCOUNT_SCOPES, isArray: true, description: 'Explicitly selected own-account information to share with the model for this request.' })
  @IsOptional() @IsArray() @ArrayNotEmpty() @ArrayMaxSize(4) @ArrayUnique() @IsIn(AI_ACCOUNT_SCOPES, { each: true })
  accountScopes?: AiAccountScope[]
}

export class AiFeedbackDto {
  @ApiProperty()
  @IsString()
  messageId!: string

  @ApiProperty()
  @IsBoolean()
  helpful!: boolean
}
