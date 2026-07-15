export const DATA_GOVERNANCE_ERROR_CODES = {
  DRILL_NOT_FOUND: 'data_governance.drill.not_found',
  DELETION_NOT_FOUND: 'data_governance.deletion.not_found',
  DELETION_ALREADY_DECIDED: 'data_governance.deletion.already_decided',
  DELETION_STILL_IN_RETENTION: 'data_governance.deletion.still_in_retention',
  INVALID_RETENTION_PERIOD: 'data_governance.retention.invalid_period',
} as const

export class DataGovernanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'DataGovernanceError'
  }
}
