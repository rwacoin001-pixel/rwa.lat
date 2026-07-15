import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import type { Repository } from 'typeorm'
import { canonicalCallbackJson } from '../../src/job-queue/partner-callback.verifier'
import { ObjectScanCallbackVerifier } from '../../src/object-storage/object-scan-callback.verifier'
import type { ObjectStorageObject, PresignedUrl } from '../../src/object-storage/object-storage.entities'
import { ObjectStorageService, parseBucketMap, validateObjectUpload } from '../../src/object-storage/object-storage.service'

describe('object storage production security', () => {
  it('maps stable logical buckets to distinct deployment-specific physical buckets', () => {
    expect(parseBucketMap(JSON.stringify({
      'rwa-kyc': 'rwa-lat-prod-kyc-001',
      'rwa-assets': 'rwa-lat-prod-assets-001',
    }))).toEqual({
      'rwa-kyc': 'rwa-lat-prod-kyc-001',
      'rwa-assets': 'rwa-lat-prod-assets-001',
    })
    expect(() => parseBucketMap('{invalid')).toThrow(/JSON object/)
    expect(() => parseBucketMap(JSON.stringify({ unknown: 'bucket-name' }))).toThrow(/unsupported/)
  })

  it('accepts only a bucket-compatible type, extension, size and SHA-256 checksum', () => {
    expect(() => validateObjectUpload({
      bucket: 'rwa-kyc',
      key: 'users/123/document.pdf',
      contentType: 'application/pdf',
      expectedSizeBytes: 1_024,
      checksumSha256: 'a'.repeat(64),
    })).not.toThrow()
    expect(() => validateObjectUpload({
      bucket: 'rwa-kyc',
      key: '../document.exe',
      contentType: 'application/pdf',
      expectedSizeBytes: 1_024,
      checksumSha256: 'a'.repeat(64),
    })).toThrow(/key|extension/i)
    expect(() => validateObjectUpload({
      bucket: 'rwa-kyc',
      key: 'users/123/document.pdf',
      contentType: 'application/pdf',
      expectedSizeBytes: 21 * 1024 * 1024,
      checksumSha256: 'a'.repeat(64),
    })).toThrow(/size/i)
  })

  it('authenticates a fresh scanner callback over canonical JSON', () => {
    const secret = 'scanner-callback-secret-at-least-32-characters'
    const verifier = new ObjectScanCallbackVerifier(new ConfigService({ OBJECT_STORAGE_SCAN_CALLBACK_SECRET: secret }))
    const now = new Date('2026-07-15T06:00:00.000Z')
    const timestamp = String(now.getTime())
    const payload = { objectId: '11111111-1111-1111-1111-111111111111', provider: 'scanner', status: 'clean' }
    const canonical = canonicalCallbackJson({ eventId: 'scan-event-1', payload, timestamp })
    const signature = createHmac('sha256', secret).update(canonical).digest('hex')
    expect(() => verifier.verify({ eventId: 'scan-event-1', payload, timestamp, signature: `sha256=${signature}`, now })).not.toThrow()
  })

  it('rejects stale scanner callbacks and missing secrets', () => {
    const configured = new ObjectScanCallbackVerifier(new ConfigService({
      OBJECT_STORAGE_SCAN_CALLBACK_SECRET: 'scanner-callback-secret-at-least-32-characters',
    }))
    expect(() => configured.verify({
      eventId: 'scan-event-1',
      payload: {},
      timestamp: '1700000000000',
      signature: '0'.repeat(64),
      now: new Date('2026-07-15T06:00:00.000Z'),
    })).toThrow()
    const absent = new ObjectScanCallbackVerifier(new ConfigService({}))
    expect(() => absent.verify({
      eventId: 'scan-event-1',
      payload: {},
      timestamp: String(Date.now()),
      signature: '0'.repeat(64),
    })).toThrow()
  })

  it('does not issue a download URL before malware clearance', async () => {
    const object = storedObject({ scanStatus: 'pending' })
    const { service } = serviceWithObject(object)
    await expect(service.createDownloadPresignedUrl({
      bucket: object.bucket,
      key: object.key,
      createdBy: '22222222-2222-2222-2222-222222222222',
    })).rejects.toMatchObject({ status: 423 })
  })

  it('marks a matching clean scan as downloadable and deduplicates its event', async () => {
    const object = storedObject({ scanStatus: 'pending' })
    const { service, update } = serviceWithObject(object)
    const input = {
      eventId: 'scan-event-2',
      objectId: object.id,
      provider: 'approved-scanner',
      status: 'clean' as const,
      checksumSha256: object.checksumSha256 ?? undefined,
      providerReference: 'provider-scan-2',
    }
    const result = await service.recordScanResult(input)
    expect(result).toMatchObject({ scanStatus: 'clean', scanEventId: 'scan-event-2' })
    await expect(service.recordScanResult(input)).resolves.toBe(result)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('quarantines a clean claim whose computed checksum does not match', async () => {
    const object = storedObject({ scanStatus: 'pending' })
    const { service } = serviceWithObject(object)
    const result = await service.recordScanResult({
      eventId: 'scan-event-3',
      objectId: object.id,
      provider: 'approved-scanner',
      status: 'clean',
      checksumSha256: 'b'.repeat(64),
    })
    expect(result).toMatchObject({
      scanStatus: 'quarantined',
      tags: expect.objectContaining({ checksumVerified: 'false' }),
    })
  })

  it('resolves only clean attachment IDs owned by the ticket author', async () => {
    const object = storedObject({ scanStatus: 'clean', uploadedBy: '22222222-2222-2222-2222-222222222222' })
    const { service, objectFind } = serviceWithObject(object)
    await expect(service.assertCleanAttachmentIds([object.id], object.uploadedBy ?? undefined)).resolves.toEqual({ objectIds: [object.id] })
    expect(objectFind).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ uploadedBy: object.uploadedBy, scanStatus: 'clean' }),
    }))
  })

  it('selects only already-expired unused presigned records for cleanup', async () => {
    const object = storedObject()
    const { service, presignedFind } = serviceWithObject(object)
    await service.cleanupExpiredPresigned()
    const options = presignedFind.mock.calls[0][0] as { where: { expiresAt: { _type: string } } }
    const where = options.where
    expect(where.expiresAt._type).toBe('lessThan')
  })
})

function storedObject(overrides: Partial<ObjectStorageObject> = {}): ObjectStorageObject {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    bucket: 'rwa-attachments',
    key: 'tickets/123/evidence.pdf',
    contentType: 'application/pdf',
    sizeBytes: '1024',
    expectedSizeBytes: '1024',
    checksumSha256: 'a'.repeat(64),
    checksumMd5: null,
    scanStatus: 'pending',
    scanProvider: null,
    scanReference: null,
    scanEventId: null,
    scannedAt: null,
    tags: {},
    uploadedBy: null,
    uploadedAt: new Date(),
    presignedUrls: [],
    ...overrides,
  }
}

function serviceWithObject(object: ObjectStorageObject) {
  const save = jest.fn(async (value: ObjectStorageObject) => value)
  const update = jest.fn(async () => ({ affected: 1, raw: [], generatedMaps: [] }))
  const objectFind = jest.fn(async () => [object])
  const objects = {
    findOne: jest.fn(async () => object),
    find: objectFind,
    save,
    update,
    create: jest.fn((value) => value),
    remove: jest.fn(),
  }
  const presignedFind = jest.fn(async (_options: unknown) => [])
  const presigned = {
    findOne: jest.fn(),
    find: presignedFind,
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
    update: jest.fn(),
  }
  const service = new ObjectStorageService(
    new ConfigService({
      OBJECT_STORAGE_ENABLED: 'true',
      S3_REGION: 'ap-southeast-1',
      S3_AUTH_MODE: 'static',
      S3_ACCESS_KEY: 'test-access',
      S3_SECRET_KEY: 'test-secret-value-at-least-24-characters',
      OBJECT_STORAGE_SCAN_PROVIDER: 'approved-scanner',
    }),
    objects as unknown as Repository<ObjectStorageObject>,
    presigned as unknown as Repository<PresignedUrl>,
  )
  return { service, save, update, objectFind, presignedFind }
}
