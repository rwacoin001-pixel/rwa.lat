import { IsObject } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SubmitRiskProfileDto {
  @ApiProperty({
    description: 'Answers keyed by question key (experience, horizon, drawdown, objective, stability, liquidity), each an integer 1–5',
    example: { experience: 3, horizon: 4, drawdown: 3, objective: 4, stability: 4, liquidity: 3 },
  })
  @IsObject()
  answers!: Record<string, number>
}
