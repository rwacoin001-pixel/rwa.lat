import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { ArrayMaxSize, IsArray, IsOptional, ValidateNested } from 'class-validator'
import { RegisterEmailDto } from './register-email.dto'
import { ConsentAcceptanceDto } from './consent-acceptance.dto'

export class RegisterEmailRequestDto extends RegisterEmailDto {
  @ApiProperty({ type: [ConsentAcceptanceDto], description: 'Required for account registration.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ConsentAcceptanceDto)
  consents?: ConsentAcceptanceDto[]
}
