import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RebalanceTargetDto {
  @ApiProperty()
  @IsUUID()
  productId!: string

  @ApiProperty({ minimum: 0, maximum: 10_000 })
  @IsInt()
  @Min(0)
  @Max(10_000)
  targetBps!: number
}

export class CreateRebalancePlanDto {
  @ApiProperty({ type: [RebalanceTargetDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RebalanceTargetDto)
  targets!: RebalanceTargetDto[]

  @ApiProperty({ description: 'Explicit confirmation that redemption requests may be submitted.' })
  @IsIn([true])
  sellConfirmed!: true
}

export class ConfirmRebalanceBuysDto {
  @ApiProperty({ description: 'Explicit second confirmation after actual redemption proceeds were posted.' })
  @IsIn([true])
  buyConfirmed!: true
}
