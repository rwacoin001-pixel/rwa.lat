import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator'
import { ConsentAcceptanceDto } from './consent-acceptance.dto'

export class OAuthStartDto {
  @ApiPropertyOptional({ enum: ['login', 'register'], default: 'login' })
  @IsOptional()
  @IsIn(['login', 'register'])
  intent?: 'login' | 'register'

  @ApiPropertyOptional({ type: [ConsentAcceptanceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ConsentAcceptanceDto)
  consents?: ConsentAcceptanceDto[]
}
