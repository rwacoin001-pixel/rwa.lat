import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AiQuestionOptionResponseDto {
  @ApiProperty({ type: String, maxLength: 48 }) id!: string
  @ApiProperty({ type: String, maxLength: 100 }) label!: string
  @ApiPropertyOptional({ type: String, maxLength: 220 }) description?: string
}
export class AiQuestionResponseDto {
  @ApiProperty({ type: String, maxLength: 48 }) id!: string
  @ApiProperty({ type: String, maxLength: 180 }) title!: string
  @ApiProperty({ type: Boolean }) multiple!: boolean
  @ApiProperty({ type: [AiQuestionOptionResponseDto], minItems: 2, maxItems: 5 }) options!: AiQuestionOptionResponseDto[]
}
export class AiCitationResponseDto {
  @ApiProperty({ type: String }) id!: string
  @ApiProperty({ type: String }) sourceId!: string
  @ApiProperty({ type: Number }) revision!: number
  @ApiProperty({ type: String }) title!: string
  @ApiProperty({ type: String }) locale!: string
  @ApiProperty({ type: String }) publishedAt!: string
}
export class AiChatResponseDto {
  @ApiProperty({ type: String }) sessionId!: string
  @ApiProperty({ type: String }) messageId!: string
  @ApiProperty({ type: String }) reply!: string
  @ApiProperty({ type: String }) model!: string
  @ApiProperty({ type: String }) createdAt!: string
  @ApiProperty({ type: [AiCitationResponseDto] }) citations!: AiCitationResponseDto[]
  @ApiProperty({ type: [AiQuestionResponseDto], maxItems: 3 }) questions!: AiQuestionResponseDto[]
}
