import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class StartDrillDto {
  @ApiProperty({ enum: ['full', 'incremental', 'point_in_time'] })
  kind!: 'full' | 'incremental' | 'point_in_time'

  @ApiPropertyOptional({ description: 'Drill target scope (optional)' })
  target?: string
}

export class FinishDrillDto {
  @ApiProperty({ enum: ['succeeded', 'failed'] })
  status!: 'succeeded' | 'failed'

  @ApiPropertyOptional()
  notes?: string
}

export class RequestDeletionDto {
  @ApiProperty({ enum: ['user', 'admin', 'partner', 'audit'] })
  subjectType!: 'user' | 'admin' | 'partner' | 'audit'

  @ApiProperty()
  subjectId!: string

  @ApiPropertyOptional()
  reasonCode?: string

  @ApiPropertyOptional({ minimum: 0 })
  retentionDays?: number
}

export class DecideDeletionDto {
  @ApiProperty()
  approved!: boolean

  @ApiProperty()
  decidedBy!: string
}
