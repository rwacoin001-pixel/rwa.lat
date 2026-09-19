import { IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RecoverDto {
  @ApiProperty()
  @IsEmail()
  email!: string
}
