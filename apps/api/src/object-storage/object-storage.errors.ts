import { HttpException, HttpStatus } from '@nestjs/common'

export const OBJECT_STORAGE_ERROR_CODES = {
  OBJECT_NOT_FOUND: 'object_storage.object.not_found',
  PRESIGNED_EXPIRED: 'object_storage.presigned.expired',
  PRESIGNED_ALREADY_USED: 'object_storage.presigned.already_used',
  INVALID_BUCKET: 'object_storage.bucket.invalid',
  UPLOAD_FAILED: 'object_storage.upload.failed',
  DISABLED: 'object_storage.disabled',
  INVALID_OBJECT: 'object_storage.object.invalid',
  SCAN_PENDING: 'object_storage.scan.pending',
  SCAN_RESULT_CONFLICT: 'object_storage.scan.result_conflict',
} as const

export class ObjectStorageError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: number = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status)
    this.name = 'ObjectStorageError'
  }
}
