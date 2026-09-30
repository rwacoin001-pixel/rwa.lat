import { Equals, IsDateString, IsIn, IsString, IsUUID, Matches } from 'class-validator'
export class CreateRecurringDto {
  @IsUUID() productId!: string
  @IsString() @Matches(/^[1-9][0-9]{0,59}$/) amountAtomic!: string
  @IsIn(['daily','weekly','monthly']) frequency!: 'daily' | 'weekly' | 'monthly'
  @IsDateString() firstRunAt!: string
  @Equals(true) consent!: boolean
}
export class RecurringStateDto {
  @IsIn(['active','paused','cancelled']) state!: 'active' | 'paused' | 'cancelled'
}
