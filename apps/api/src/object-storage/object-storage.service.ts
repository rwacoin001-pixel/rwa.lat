import { ConflictException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, LessThan, Repository } from 'typeorm'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ObjectStorageObject, PresignedUrl } from './object-storage.entities'
import { OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from './object-storage.errors'
import { createHash, randomUUID } from 'node:crypto'

const ALLOWED_BUCKETS = ['rwa-kyc', 'rwa-assets', 'rwa-attachments'] as const
const MAX_PRESIGNED_TTL_SEC = 900

const BUCKET_POLICIES: Record<string, { maxBytes: number; contentTypes: string[] }> = {
  'rwa-kyc': {
    maxBytes: 20 * 1024 * 1024,
    contentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'rwa-assets': {
    maxBytes: 100 * 1024 * 1024,
    contentTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  'rwa-attachments': {
    maxBytes: 25 * 1024 * 1024,
    contentTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
  },
}

const EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'text/plain': ['.txt'],
}

/** Community member images: raster formats only (no SVG), sniffed from bytes, never trusted from the client label. */
export const COMMUNITY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type CommunityImageType = (typeof COMMUNITY_IMAGE_TYPES)[number]
export type CommunityImagePurpose = 'post' | 'avatar'
export const COMMUNITY_IMAGE_MAX_BYTES: Record<CommunityImagePurpose, number> = { post: 10 * 1024 * 1024, avatar: 5 * 1024 * 1024 }
const COMMUNITY_IMAGE_EXT: Record<CommunityImageType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

/** Magic-byte sniff for the four accepted raster formats. */
export function sniffImageType(bytes: Buffer): CommunityImageType | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  const gif = bytes.subarray(0, 6).toString('latin1')
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif'
  return null
}

@Injectable()
export class ObjectStorageService {
  private readonly enabled: boolean
  private readonly s3: S3Client | null
  private readonly kmsKeyId: string | undefined
  private readonly scanProvider: string
  private readonly bucketMap: Record<string, string>

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(ObjectStorageObject)
    private readonly objects: Repository<ObjectStorageObject>,
    @InjectRepository(PresignedUrl)
    private readonly presigned: Repository<PresignedUrl>,
  ) {
    this.enabled = config.get<string>('OBJECT_STORAGE_ENABLED') === 'true'
    this.kmsKeyId = config.get<string>('S3_KMS_KEY_ID')?.trim() || undefined
    this.scanProvider = config.get<string>('OBJECT_STORAGE_SCAN_PROVIDER')?.trim() ?? ''
    this.bucketMap = parseBucketMap(config.get<string>('S3_BUCKET_MAP_JSON'))
    if (!this.enabled) {
      this.s3 = null
      return
    }

    const authMode = config.get<string>('S3_AUTH_MODE') ?? 'static'
    const accessKeyId = config.get<string>('S3_ACCESS_KEY')
    const secretAccessKey = config.get<string>('S3_SECRET_KEY')
    this.s3 = new S3Client({
      region: config.getOrThrow<string>('S3_REGION'),
      endpoint: config.get<string>('S3_ENDPOINT') || undefined,
      credentials: authMode === 'static'
        ? {
            accessKeyId: accessKeyId ?? '',
            secretAccessKey: secretAccessKey ?? '',
          }
        : undefined,
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
    })
  }

  /** Fixed-markup platform PDF; private user ownership and normal scan clearance still apply. */
  async storeGeneratedPdf(userId: string, documentId: string, bytes: Buffer) {
    const checksumSha256 = createHash('sha256').update(bytes).digest('hex')
    const key = `documents/${documentId}/${randomUUID()}.pdf`
    validateObjectUpload({ bucket: 'rwa-attachments', key, contentType: 'application/pdf', expectedSizeBytes: bytes.length, checksumSha256 })
    if (bytes.subarray(0,5).toString() !== '%PDF-') throw new ConflictException('Generated file is not a PDF')
    const client = this.requireClient()
    await client.send(new PutObjectCommand({ Bucket: this.physicalBucket('rwa-attachments'), Key: key,
      Body: bytes, ContentType: 'application/pdf', ContentLength: bytes.length,
      ChecksumSHA256: Buffer.from(checksumSha256, 'hex').toString('base64'),
      ...(this.kmsKeyId ? { ServerSideEncryption: 'aws:kms' as const, SSEKMSKeyId: this.kmsKeyId } : {}),
    }), { abortSignal: AbortSignal.timeout(30_000) })
    const object = await this.objects.save(this.objects.create({ bucket: 'rwa-attachments', key, contentType: 'application/pdf',
      sizeBytes: String(bytes.length), expectedSizeBytes: String(bytes.length), checksumSha256, scanStatus: 'pending',
      uploadedBy: userId, tags: { source: 'generated-document', documentId } }))
    return { objectId: object.id, checksumSha256 }
  }

  /**
   * Member image upload for the community (post media or avatar). The API receives the bytes,
   * sniffs the real format, and stores them in the private asset bucket as a pending object;
   * the scan worker clears it and only then will {@link createCommunityImageUrl} serve it.
   */
  async storeCommunityImage(userId: string, purpose: CommunityImagePurpose, bytes: Buffer, declaredType?: string) {
    const contentType = sniffImageType(bytes)
    if (!contentType || (declaredType && declaredType.toLowerCase() !== contentType && !(declaredType === 'image/jpg' && contentType === 'image/jpeg'))) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Only JPEG, PNG, WebP or GIF images are accepted', 400)
    }
    if (bytes.length < 1 || bytes.length > COMMUNITY_IMAGE_MAX_BYTES[purpose]) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Image size is outside the allowed range', 413)
    }
    const checksumSha256 = createHash('sha256').update(bytes).digest('hex')
    const key = `community/${userId}/${purpose}/${randomUUID()}.${COMMUNITY_IMAGE_EXT[contentType]}`
    validateObjectUpload({ bucket: 'rwa-assets', key, contentType, expectedSizeBytes: bytes.length, checksumSha256 })
    const client = this.requireClient()
    await client.send(new PutObjectCommand({ Bucket: this.physicalBucket('rwa-assets'), Key: key,
      Body: bytes, ContentType: contentType, ContentLength: bytes.length,
      ChecksumSHA256: Buffer.from(checksumSha256, 'hex').toString('base64'),
      ...(this.kmsKeyId ? { ServerSideEncryption: 'aws:kms' as const, SSEKMSKeyId: this.kmsKeyId } : {}),
    }), { abortSignal: AbortSignal.timeout(30_000) })
    const object = await this.objects.save(this.objects.create({ bucket: 'rwa-assets', key, contentType,
      sizeBytes: String(bytes.length), expectedSizeBytes: String(bytes.length), checksumSha256, scanStatus: 'pending',
      uploadedBy: userId, tags: { source: 'community-image', purpose } }))
    return { objectId: object.id, contentType, sizeBytes: bytes.length, scanStatus: object.scanStatus }
  }

  /** Owned, fully uploaded, not rejected community images of one purpose; pending ones may be attached and appear once cleared. */
  async attachableCommunityImages(userId: string, objectIds: string[], purpose: CommunityImagePurpose): Promise<string[]> {
    if (!objectIds.length) return []
    const unique = [...new Set(objectIds)]
    if (unique.length !== objectIds.length) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Image references are invalid', 400)
    this.requireClient()
    const rows = await this.objects.find({ where: { id: In(unique), bucket: 'rwa-assets', uploadedBy: userId } })
    const ok = rows.filter(row => row.tags?.source === 'community-image' && row.tags?.purpose === purpose
      && BigInt(row.sizeBytes) > 0n && (row.scanStatus === 'pending' || row.scanStatus === 'clean'))
    if (ok.length !== unique.length) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Every image must be your own completed upload', 400)
    return unique
  }

  /** Subset of community image ids that may be shown right now (clean, or pending under an explicit scan waiver). */
  async readableCommunityImageIds(objectIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(objectIds)]
    if (!unique.length || !this.enabled) return new Set()
    const rows = await this.objects.find({ select: { id: true, scanStatus: true, sizeBytes: true, tags: true }, where: { id: In(unique), bucket: 'rwa-assets' } })
    return new Set(rows.filter(row => row.tags?.source === 'community-image' && BigInt(row.sizeBytes) > 0n && this.readableScanStatus(row.scanStatus)).map(row => row.id))
  }

  /** Short-lived inline URL for a cleared community image; anything else is indistinguishable from missing. */
  async createCommunityImageUrl(objectId: string): Promise<string> {
    const object = await this.objects.findOne({ where: { id: objectId, bucket: 'rwa-assets' } })
    if (!object || object.tags?.source !== 'community-image') throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Image not found', 404)
    return this.createPublishedAssetUrl(`rwa-assets/${object.key}`, true)
  }

  async createUploadPresignedUrl(input: {
    bucket: string
    key: string
    contentType: string
    expectedSizeBytes: number
    checksumSha256: string
    expiresInSec?: number
    createdBy: string
  }): Promise<{ presignedUrl: string; presignedId: string; objectId: string; requiredHeaders: Record<string, string> }> {
    const s3 = this.requireClient()
    validateObjectUpload(input)
    const existing = await this.objects.findOne({ where: { bucket: input.bucket, key: input.key } })
    if (existing) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Object key already exists', 409)
    }

    const ttl = boundedTtl(input.expiresInSec)
    const checksumSha256 = input.checksumSha256.toLowerCase()
    const checksumBase64 = Buffer.from(checksumSha256, 'hex').toString('base64')
    const obj = this.objects.create({
      bucket: input.bucket,
      key: input.key,
      contentType: input.contentType.toLowerCase(),
      sizeBytes: '0',
      expectedSizeBytes: String(input.expectedSizeBytes),
      checksumSha256,
      scanStatus: 'pending',
      uploadedBy: input.createdBy,
    })
    await this.objects.save(obj)

    const cmd = new PutObjectCommand({
      Bucket: this.physicalBucket(input.bucket),
      Key: input.key,
      ContentType: obj.contentType,
      ContentLength: input.expectedSizeBytes,
      ChecksumSHA256: checksumBase64,
      ...(this.kmsKeyId ? { ServerSideEncryption: 'aws:kms' as const, SSEKMSKeyId: this.kmsKeyId } : {}),
    })
    // B2/S3 兼容性：要求校验和头参与签名（unhoistable），否则 B2 拒绝该头且校验和不存档。
    const presignedUrl = await getSignedUrl(s3, cmd, {
      expiresIn: ttl,
      unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
    })
    const p = this.presigned.create({
      objectId: obj.id,
      bucket: input.bucket,
      key: input.key,
      method: 'PUT',
      expiresAt: new Date(Date.now() + ttl * 1_000),
      createdBy: input.createdBy,
    })
    await this.presigned.save(p)
    return {
      presignedUrl,
      presignedId: p.id,
      objectId: obj.id,
      requiredHeaders: {
        'content-type': obj.contentType,
        'x-amz-checksum-sha256': checksumBase64,
      },
    }
  }

  /** Called only after a published product/profile reference has been authorized. */
  async createPublishedAssetUrl(ref: string, imageOnly = false): Promise<string> {
    if (!ref.startsWith('rwa-assets/')) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Public asset not found', 404)
    const key = ref.slice('rwa-assets/'.length)
    const object = await this.objects.findOne({ where: { bucket: 'rwa-assets', key } })
    if (!object || !this.readableScanStatus(object.scanStatus) || BigInt(object.sizeBytes) <= 0n) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Public asset not found', 404)
    if (imageOnly && !(COMMUNITY_IMAGE_TYPES as readonly string[]).includes(object.contentType)) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Image not found', 404)
    return getSignedUrl(this.requireClient(), new GetObjectCommand({
      Bucket: this.physicalBucket('rwa-assets'), Key: key,
      ResponseContentType: object.contentType,
      ResponseContentDisposition: imageOnly ? 'inline' : 'attachment',
    }), { expiresIn: 60 })
  }

  async createDownloadPresignedUrl(input: {
    bucket: string
    key: string
    expiresInSec?: number
    createdBy: string
    ownerId?: string
  }): Promise<{ presignedUrl: string; presignedId: string }> {
    const s3 = this.requireClient()
    this.assertBucket(input.bucket)
    const obj = await this.objects.findOne({
      where: input.ownerId
        ? { bucket: input.bucket, key: input.key, uploadedBy: input.ownerId }
        : { bucket: input.bucket, key: input.key },
    })
    if (!obj) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Object not found', 404)
    if (!this.readableScanStatus(obj.scanStatus) || obj.sizeBytes === '0') {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.SCAN_PENDING, 'Object is not cleared for download', 423)
    }

    const ttl = boundedTtl(input.expiresInSec)
    const cmd = new GetObjectCommand({
      Bucket: this.physicalBucket(input.bucket),
      Key: input.key,
      ResponseContentDisposition: 'attachment',
    })
    const presignedUrl = await getSignedUrl(s3, cmd, { expiresIn: ttl })
    const p = this.presigned.create({
      objectId: obj.id,
      bucket: input.bucket,
      key: input.key,
      method: 'GET',
      expiresAt: new Date(Date.now() + ttl * 1_000),
      createdBy: input.createdBy,
    })
    await this.presigned.save(p)
    return { presignedUrl, presignedId: p.id }
  }

  async completeUpload(presignedId: string, sizeBytes: number, md5?: string, expectedCreatedBy?: string): Promise<ObjectStorageObject> {
    const s3 = this.requireClient()
    const p = await this.presigned.findOne({ where: { id: presignedId }, relations: { object: true } })
    if (!p || p.method !== 'PUT') {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.PRESIGNED_EXPIRED, 'Upload authorization not found', 404)
    }
    if (expectedCreatedBy && p.createdBy !== expectedCreatedBy) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Upload authorization not found', 404)
    }
    if (p.usedAt) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.PRESIGNED_ALREADY_USED, 'Presigned URL already used', 409)
    if (p.expiresAt <= new Date()) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.PRESIGNED_EXPIRED, 'Presigned URL expired', 410)

    let head: HeadObjectCommandOutput
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: this.physicalBucket(p.bucket), Key: p.key, ChecksumMode: 'ENABLED' }))
    } catch {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.UPLOAD_FAILED, 'Uploaded object is not available', 404)
    }

    const obj = p.object ?? await this.objects.findOne({ where: { bucket: p.bucket, key: p.key } })
    if (!obj) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Object record missing', 404)
    const actualSize = head.ContentLength
    if (
      !Number.isSafeInteger(actualSize)
      || actualSize !== sizeBytes
      || actualSize !== Number(obj.expectedSizeBytes)
    ) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.UPLOAD_FAILED, 'Uploaded object size does not match the authorization', 400)
    }
    if (head.ContentType && head.ContentType.toLowerCase() !== obj.contentType.toLowerCase()) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.UPLOAD_FAILED, 'Uploaded object content type does not match the authorization', 400)
    }
    const headSha256 = head.ChecksumSHA256 ? Buffer.from(head.ChecksumSHA256, 'base64').toString('hex') : null
    if (headSha256 && headSha256 !== obj.checksumSha256) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.UPLOAD_FAILED, 'Uploaded object checksum does not match the authorization', 400)
    }
    const etag = head.ETag?.replace(/"/g, '')
    if (md5 && etag && /^[a-f0-9]{32}$/i.test(etag) && etag.toLowerCase() !== md5.toLowerCase()) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.UPLOAD_FAILED, 'Uploaded object MD5 does not match', 400)
    }

    obj.sizeBytes = String(actualSize)
    obj.checksumMd5 = md5?.toLowerCase() ?? obj.checksumMd5
    obj.scanStatus = 'pending'
    await this.objects.save(obj)
    p.usedAt = new Date()
    await this.presigned.save(p)
    return obj
  }

  async recordScanResult(input: {
    eventId: string
    objectId: string
    provider: string
    status: 'clean' | 'infected' | 'error'
    checksumSha256?: string
    providerReference?: string
    details?: Record<string, unknown>
  }): Promise<ObjectStorageObject> {
    this.requireClient()
    if (!this.scanProvider || input.provider !== this.scanProvider) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.SCAN_RESULT_CONFLICT, 'Unexpected malware scan provider', 403)
    }
    const obj = await this.objects.findOne({ where: { id: input.objectId } })
    if (!obj) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Object not found', 404)
    if (obj.scanEventId === input.eventId) return obj
    if (obj.scanEventId) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.SCAN_RESULT_CONFLICT, 'Object already has a final scan result', 409)
    }
    if (obj.sizeBytes === '0') {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.SCAN_RESULT_CONFLICT, 'Object upload is not complete', 409)
    }

    const checksum = input.checksumSha256?.toLowerCase()
    const checksumMatches = Boolean(checksum && obj.checksumSha256 && checksum === obj.checksumSha256)
    const scanStatus = input.status === 'clean' && checksumMatches
      ? 'clean'
      : input.status === 'error' ? 'failed' : 'quarantined'
    const scannedAt = new Date()
    const tags = {
      ...(obj.tags ?? {}),
      scanOutcome: input.status,
      checksumVerified: String(checksumMatches),
    }
    const updated = await this.objects.update(
      { id: obj.id, scanEventId: IsNull() },
      {
        scanStatus,
        scanProvider: input.provider,
        scanReference: input.providerReference ?? null,
        scanEventId: input.eventId,
        scannedAt,
        tags,
      },
    )
    if (updated.affected !== 1) {
      const current = await this.objects.findOne({ where: { id: input.objectId } })
      if (current?.scanEventId === input.eventId) return current
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.SCAN_RESULT_CONFLICT, 'Object already has a final scan result', 409)
    }
    Object.assign(obj, {
      scanStatus,
      scanProvider: input.provider,
      scanReference: input.providerReference ?? null,
      scanEventId: input.eventId,
      scannedAt,
      tags,
    })
    return obj
  }

  private readableScanStatus(status: string) {
    return status === 'clean' || (this.config.get<string>('OBJECT_STORAGE_REQUIRE_SCAN') === 'false' && status === 'pending')
  }

  async createUserAttachmentUpload(input: {
    userId: string
    fileName: string
    contentType: string
    expectedSizeBytes: number
    checksumSha256: string
    expiresInSec?: number
  }) {
    const fileName = input.fileName.trim()
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,119}\.(pdf|png|jpe?g|txt)$/i.test(fileName)) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Attachment filename is invalid', 400)
    }
    const key = `users/${input.userId}/tickets/${randomUUID()}-${fileName}`
    const result = await this.createUploadPresignedUrl({
      bucket: 'rwa-attachments',
      key,
      contentType: input.contentType,
      expectedSizeBytes: input.expectedSizeBytes,
      checksumSha256: input.checksumSha256,
      expiresInSec: input.expiresInSec,
      createdBy: input.userId,
    })
    return { ...result, objectKey: key }
  }

  async createUserAttachmentDownload(userId: string, objectId: string, expiresInSec?: number) {
    this.requireClient()
    const obj = await this.objects.findOne({ where: { id: objectId, bucket: 'rwa-attachments', uploadedBy: userId } })
    if (!obj) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Attachment not found', 404)
    return this.createDownloadPresignedUrl({
      bucket: obj.bucket,
      key: obj.key,
      expiresInSec,
      createdBy: userId,
      ownerId: userId,
    })
  }

  async getUserAttachmentStatus(userId: string, objectId: string) {
    this.requireClient()
    const obj = await this.objects.findOne({ where: { id: objectId, bucket: 'rwa-attachments', uploadedBy: userId } })
    if (!obj) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Attachment not found', 404)
    return {
      objectId: obj.id,
      status: obj.scanStatus,
      contentType: obj.contentType,
      sizeBytes: obj.sizeBytes,
      uploadedAt: obj.uploadedAt,
      scannedAt: obj.scannedAt ?? null,
    }
  }

  async assertCleanAttachmentIds(objectIds: string[] | undefined, ownerId?: string): Promise<Record<string, unknown>> {
    if (!objectIds?.length) return {}
    this.requireClient()
    const uniqueIds = [...new Set(objectIds)]
    if (uniqueIds.length !== objectIds.length || uniqueIds.length > 5) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Attachment references are invalid', 400)
    }
    const rows = await this.objects.find({
      where: {
        id: In(uniqueIds),
        bucket: 'rwa-attachments',
        scanStatus: 'clean',
        ...(ownerId ? { uploadedBy: ownerId } : {}),
      },
    })
    if (rows.length !== uniqueIds.length || rows.some((row) => row.sizeBytes === '0')) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.SCAN_PENDING, 'Every attachment must be owned and malware-cleared', 423)
    }
    return { objectIds: uniqueIds }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const s3 = this.requireClient()
    this.assertBucket(bucket)
    await this.objects.manager.transaction(async em => {
      const [obj] = await em.query(`SELECT id FROM app.object_storage_objects WHERE bucket=$1 AND key=$2 FOR UPDATE`, [bucket, key])
      if (!obj) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Object not found', 404)
      const [usage] = await em.query(`SELECT (
        EXISTS (SELECT 1 FROM app.manual_trade_settlements WHERE evidence_ref=$1)
        OR EXISTS (SELECT 1 FROM app.generated_documents d JOIN app.object_storage_objects o ON o.id=d.object_id WHERE o.bucket || '/' || o.key=$1)
        OR EXISTS (SELECT 1 FROM app.document_tax_records t WHERE t.content->>'evidenceRef'=$1)
        OR EXISTS (SELECT 1 FROM app.products WHERE cover_storage_ref=$1 OR media_refs_json ? $1)
        OR EXISTS (SELECT 1 FROM app.disclosure_files WHERE storage_ref=$1)
        OR EXISTS (SELECT 1 FROM app.platform_configuration c, jsonb_array_elements(COALESCE(c.draft->'documents','[]'::jsonb)) d WHERE d->>'storageRef'=$1)
        OR EXISTS (SELECT 1 FROM app.platform_configuration_versions v, jsonb_array_elements(COALESCE(v.content->'documents','[]'::jsonb)) d WHERE d->>'storageRef'=$1)
        OR EXISTS (SELECT 1 FROM app.community_profiles WHERE avatar_url=$2)
        OR EXISTS (SELECT 1 FROM app.community_posts WHERE images ? $2)
        OR EXISTS (SELECT 1 FROM app.community_comments WHERE images ? $2)
      ) AS used`, [`${bucket}/${key}`, communityMediaPath(obj.id)])
      if (usage.used) throw new ConflictException('文件仍被业务记录引用，不能删除')
      await s3.send(new DeleteObjectCommand({ Bucket: this.physicalBucket(bucket), Key: key }))
      await em.query(`UPDATE app.presigned_urls SET used_at=COALESCE(used_at,now()) WHERE object_id=$1`, [obj.id])
      await em.query(`DELETE FROM app.object_storage_objects WHERE id=$1`, [obj.id])
    })
  }

  async getObjectMeta(bucket: string, key: string): Promise<ObjectStorageObject | null> {
    this.requireClient()
    this.assertBucket(bucket)
    return this.objects.findOne({ where: { bucket, key } })
  }

  async getObjectMetaById(objectId: string): Promise<ObjectStorageObject> {
    this.requireClient()
    const obj = await this.objects.findOne({ where: { id: objectId } })
    if (!obj) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.OBJECT_NOT_FOUND, 'Object not found', 404)
    return obj
  }

  async cleanupExpiredPresigned(): Promise<number> {
    this.requireClient()
    const now = new Date()
    const expired = await this.presigned.find({
      where: { usedAt: IsNull(), expiresAt: LessThan(now) },
      take: 1_000,
    })
    for (const p of expired) p.usedAt = now
    await this.presigned.save(expired)
    return expired.length
  }

  private requireClient(): S3Client {
    if (!this.enabled || !this.s3) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.DISABLED, 'Object storage is disabled', 503)
    }
    return this.s3
  }

  private assertBucket(bucket: string): void {
    if (!ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number])) {
      throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_BUCKET, 'Object storage bucket is not allowed', 400)
    }
  }

  private physicalBucket(logicalBucket: string): string {
    this.assertBucket(logicalBucket)
    return this.bucketMap[logicalBucket] ?? logicalBucket
  }
}

/** Public, API-relative reference stored on community rows; the API resolves it to a short-lived signed URL. */
export function communityMediaPath(objectId: string) { return `/v1/community/media/${objectId}` }

export function parseBucketMap(value: string | undefined): Record<string, string> {
  if (!value?.trim()) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('S3_BUCKET_MAP_JSON must be a JSON object')
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('S3_BUCKET_MAP_JSON must be a JSON object')
  }
  const result: Record<string, string> = {}
  for (const [logical, physical] of Object.entries(parsed)) {
    if (!ALLOWED_BUCKETS.includes(logical as (typeof ALLOWED_BUCKETS)[number])) {
      throw new Error(`S3_BUCKET_MAP_JSON contains unsupported logical bucket: ${logical}`)
    }
    if (typeof physical !== 'string' || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(physical)) {
      throw new Error(`S3_BUCKET_MAP_JSON contains an invalid physical bucket for ${logical}`)
    }
    result[logical] = physical
  }
  return result
}

export function validateObjectUpload(input: { bucket: string; key: string; contentType: string; expectedSizeBytes: number; checksumSha256: string }) {
  const policy = BUCKET_POLICIES[input.bucket]
  if (!policy) throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_BUCKET, 'Object storage bucket is not allowed', 400)
  const contentType = input.contentType.toLowerCase()
  if (!policy.contentTypes.includes(contentType)) {
    throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Object content type is not allowed for this bucket', 400)
  }
  if (!Number.isSafeInteger(input.expectedSizeBytes) || input.expectedSizeBytes < 1 || input.expectedSizeBytes > policy.maxBytes) {
    throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Object size is outside the bucket policy', 400)
  }
  if (!/^[a-f0-9]{64}$/i.test(input.checksumSha256)) {
    throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'A SHA-256 checksum is required', 400)
  }
  const key = input.key.toLowerCase()
  if (key.startsWith('/') || key.length > 512 || /(^|\/)\.\.?($|\/)|[\\\u0000-\u001f\u007f]/.test(key)) {
    throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Object key is invalid', 400)
  }
  const extensions = EXTENSIONS[contentType] ?? []
  if (!extensions.some((extension) => key.endsWith(extension))) {
    throw new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.INVALID_OBJECT, 'Object extension does not match its content type', 400)
  }
}

function boundedTtl(value?: number): number {
  if (!Number.isInteger(value ?? 900) || (value ?? 900) < 60) return 60
  return Math.min(value ?? 900, MAX_PRESIGNED_TTL_SEC)
}
