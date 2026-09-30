import { IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginEmailDto {
  @ApiProperty()
  @IsEmail()
  email!: string
}
