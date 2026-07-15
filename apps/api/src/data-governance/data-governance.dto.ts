export class StartDrillDto {
  kind!: 'full' | 'incremental' | 'point_in_time'
  target?: string
}

export class FinishDrillDto {
  status!: 'succeeded' | 'failed'
  notes?: string
}

export class RequestDeletionDto {
  subjectType!: 'user' | 'admin' | 'partner' | 'audit'
  subjectId!: string
  reasonCode?: string
  retentionDays?: number
}

export class DecideDeletionDto {
  approved!: boolean
  decidedBy!: string
}
