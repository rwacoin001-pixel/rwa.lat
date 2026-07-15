export const JOB_QUEUE_ERROR_CODES = {
  JOB_NOT_FOUND: 'job_queue.job.not_found',
  JOB_LEASE_LOST: 'job_queue.job.lease_lost',
  CALLBACK_DUPLICATE: 'job_queue.callback.duplicate',
  CALLBACK_INVALID: 'job_queue.callback.invalid',
} as const

export class JobQueueError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message)
    this.name = 'JobQueueError'
  }
}
