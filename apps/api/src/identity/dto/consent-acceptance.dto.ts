import { IsBoolean, IsIn, IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ConsentAcceptanceDto {
  @ApiProperty({ enum: ['terms', 'privacy'] })
  @IsIn(['terms', 'privacy'])
  documentType!: 'terms' | 'privacy'

  @ApiProperty({ example: '2026-09-18' })
  @IsString()
  @Length(1, 64)
  version!: string

  @ApiProperty()
  @IsBoolean()
  accepted!: boolean
}
