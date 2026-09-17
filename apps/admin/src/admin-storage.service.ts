import { ConflictException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { Pool, type QueryResultRow } from 'pg'
import { DataSource } from 'typeorm'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { CompleteStorageUploadDto, CreateStorageUploadDto, StorageObjectQueryDto } from './admin-storage.dto'

export const STORAGE_BUCKETS = ['rwa-kyc', 'rwa-assets', 'rwa-attachments'] as const
export type StorageBucket = (typeof STORAGE_BUCKETS)[number]

const MAX_PRESIGNED_TTL_SEC = 900
const UPLOAD_TTL_SEC = 900
const DOWNLOAD_TTL_SEC = 300

const BUCKET_POLICIES: Record<string, { maxBytes: number; contentTypes: string[]; label: string }> = {
  'rwa-kyc': { maxBytes: 20 * 1024 * 1024, contentTypes: ['application/pdf', 'image/jpeg', 'image/png'], label: 'KYC 资料' },
  'rwa-assets': { maxBytes: 100 * 1024 * 1024, contentTypes: ['application/pdf', 'image/jpeg', 'image/png'], label: '产品与披露资产' },
  'rwa-attachments': { maxBytes: 25 * 1024 * 1024, contentTypes: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'], label: '附件' },
}

const EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'text/plain': ['.txt'],
}

interface StorageObjectRow extends QueryResultRow {
  id: string
  bucket: string
  key: string
  content_type: string
  size_bytes: string
  expected_size_bytes: string | null
  checksum_sha256: string | null
  scan_status: string
  scan_provider: string | null
  scanned_at: Date | null
  tags: Record<string, unknown> | null
  uploaded_by: string | null
  uploaded_at: Date
}

@Injectable()
export class AdminStorageService implements OnModuleDestroy {
  private readonly core: Pool | null
  private readonly s3: S3Client | null
  private readonly enabled: boolean
  private readonly scanMode: string
  private readonly bucketMap: Record<string, string>

  constructor(
    private readonly adminDb: DataSource,
    private readonly config: ConfigService,
  ) {
    const coreUrl = config.get<string>('CORE_DATABASE_URL')?.trim()
    this.core = coreUrl
      ? new Pool({
          connectionString: coreUrl,
          max: 2,
          connectionTimeoutMillis: 5_000,
          idleTimeoutMillis: 30_000,
        })
      : null
    this.enabled = config.get<string>('OBJECT_STORAGE_ENABLED') === 'true'
    this.scanMode = (config.get<string>('OBJECT_STORAGE_SCAN_MODE') ?? 'external').trim() || 'external'
    this.bucketMap = parseBucketMap(config.get<string>('S3_BUCKET_MAP_JSON'))
    if (!this.enabled) {
      this.s3 = null
      return
    }
    this.s3 = new S3Client({
      region: config.getOrThrow<string>('S3_REGION'),
      endpoint: config.get<string>('S3_ENDPOINT') || undefined,
      credentials: {
        accessKeyId: config.get<string>('S3_ACCESS_KEY') ?? '',
        secretAccessKey: config.get<string>('S3_SECRET_KEY') ?? '',
      },
      forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
    })
  }

  async onModuleDestroy() {
    await this.core?.end()
  }

  status() {
    const buckets = Object.entries(BUCKET_POLICIES).map(([name, policy]) => ({
      name,
      label: policy.label,
      maxBytes: policy.maxBytes,
      contentTypes: policy.contentTypes,
    }))
    return {
      enabled: this.enabled,
      scanMode: this.scanMode,
      internalScanAvailable: this.scanMode === 'internal-basic',
      externalEndpoint: Boolean(this.config.get<string>('S3_ENDPOINT')?.trim()),
      buckets,
      uploadFlow: 'presigned_put_checksum_scan',
      message: this.enabled
        ? this.scanMode === 'internal-basic'
          ? '对象存储已启用：预签名直传 + 内置基础校验（魔数/大小/校验和）。接入外部杀毒服务后可切换为 external 模式。'
          : '对象存储已启用：预签名直传，等待外部扫描服务回调后可用于下载。'
        : '对象存储尚未启用：请在 Render 配置 S3/R2 并设置 OBJECT_STORAGE_ENABLED=true。',
    }
  }

  async createUpload(input: CreateStorageUploadDto, adminId: string) {
    const s3 = this.requireClient()
    this.assertBucket(input.bucket)
    const policy = BUCKET_POLICIES[input.bucket]
    const contentType = input.contentType.toLowerCase().trim()
    if (!policy.contentTypes.includes(contentType)) {
      throw new ConflictException(`该存储桶不允许的内容类型：${contentType}（允许：${policy.contentTypes.join(', ')}）`)
    }
    if (!Number.isSafeInteger(input.expectedSizeBytes) || input.expectedSizeBytes < 1 || input.expectedSizeBytes > policy.maxBytes) {
      throw new ConflictException(`文件大小超出限制（最大 ${(policy.maxBytes / 1024 / 1024).toFixed(0)} MB）`)
    }
    if (!/^[a-f0-9]{64}$/i.test(input.checksumSha256)) {
      throw new ConflictException('缺少有效的 SHA-256 校验和')
    }
    const fileName = sanitizeFileName(input.fileName)
    const allowedExtensions = EXTENSIONS[contentType] ?? []
    const lowerName = fileName.toLowerCase()
    if (!allowedExtensions.some((extension) => lowerName.endsWith(extension))) {
      throw new ConflictException(`文件扩展名与内容类型不匹配（${contentType} 需要 ${allowedExtensions.join('/')}）`)
    }

    const prefix = input.purpose === 'product-media' ? 'products' : input.purpose === 'disclosure' ? 'disclosures' : 'uploads'
    const scope = input.productId ?? 'general'
    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const objectKey = `${prefix}/${scope}/${yyyy}-${mm}/${randomUUID()}-${fileName}`

    const checksumSha256 = input.checksumSha256.toLowerCase()
    const checksumBase64 = Buffer.from(checksumSha256, 'hex').toString('base64')
    const existing = await this.query<{ id: string }>(
      `SELECT id FROM app.object_storage_objects WHERE bucket = $1 AND key = $2`,
      [input.bucket, objectKey],
    )
    if (existing.length) throw new ConflictException('对象键已存在，请重新生成上传')

    const objectId = randomUUID()
    const tags = {
      purpose: input.purpose ?? 'misc',
      source: 'admin-console',
      ...(input.productId ? { productId: input.productId } : {}),
    }
    await this.query(
      `INSERT INTO app.object_storage_objects
         (id, bucket, key, content_type, size_bytes, expected_size_bytes, checksum_sha256, scan_status, uploaded_by, tags)
       VALUES ($1, $2, $3, $4, '0', $5, $6, 'pending', $7, $8::jsonb)`,
      [objectId, input.bucket, objectKey, contentType, String(input.expectedSizeBytes), checksumSha256, adminId, JSON.stringify(tags)],
    )

    const cmd = new PutObjectCommand({
      Bucket: this.physicalBucket(input.bucket),
      Key: objectKey,
      ContentType: contentType,
      ContentLength: input.expectedSizeBytes,
      ChecksumSHA256: checksumBase64,
    })
    let presignedUrl: string
    try {
      presignedUrl = await getSignedUrl(s3, cmd, { expiresIn: UPLOAD_TTL_SEC })
    } catch (error) {
      await this.query(`DELETE FROM app.object_storage_objects WHERE id = $1`, [objectId])
      throw new ServiceUnavailableException(`无法生成预签名上传地址：${error instanceof Error ? error.message : 'unknown error'}`)
    }

    const presignedId = randomUUID()
    await this.query(
      `INSERT INTO app.presigned_urls (id, object_id, bucket, key, method, expires_at, created_by)
       VALUES ($1, $2, $3, $4, 'PUT', $5, $6)`,
      [presignedId, objectId, input.bucket, objectKey, new Date(Date.now() + UPLOAD_TTL_SEC * 1000), adminId],
    )
    await this.audit(adminId, 'admin.storage.upload_presigned', 'storage_object', objectId, {
      bucket: input.bucket,
      key: objectKey,
      contentType,
      expectedSizeBytes: input.expectedSizeBytes,
    })
    return {
      presignedUrl,
      presignedId,
      objectId,
      objectKey,
      expiresInSec: UPLOAD_TTL_SEC,
      requiredHeaders: {
        'content-type': contentType,
        'x-amz-checksum-sha256': checksumBase64,
      },
    }
  }

  async completeUpload(input: CompleteStorageUploadDto, adminId: string) {
    const s3 = this.requireClient()
    const presignedRows = await this.query<{ id: string; object_id: string; bucket: string; key: string; used_at: Date | null; expires_at: Date }>(
      `SELECT id, object_id, bucket, key, used_at, expires_at FROM app.presigned_urls WHERE id = $1 AND method = 'PUT'`,
      [input.presignedId],
    )
    const presigned = presignedRows[0]
    if (!presigned) throw new NotFoundException('上传授权不存在')
    if (presigned.used_at) throw new ConflictException('上传授权已被使用')
    if (presigned.expires_at.getTime() <= Date.now()) throw new ConflictException('上传授权已过期，请重新上传')

    const objects = await this.query<StorageObjectRow>(
      `SELECT id, bucket, key, content_type, size_bytes, expected_size_bytes, checksum_sha256, scan_status, scan_provider, scanned_at, tags, uploaded_by, uploaded_at
         FROM app.object_storage_objects WHERE id = $1`,
      [presigned.object_id],
    )
    const object = objects[0]
    if (!object) throw new NotFoundException('对象记录不存在')

    let head: HeadObjectCommandOutput
    try {
      head = await s3.send(
        new HeadObjectCommand({ Bucket: this.physicalBucket(object.bucket), Key: object.key, ChecksumMode: 'ENABLED' }),
      )
    } catch {
      throw new ConflictException('未在存储中找到已上传的文件，请确认上传是否成功')
    }

    const actualSize = head.ContentLength
    if (!Number.isSafeInteger(actualSize) || actualSize !== input.sizeBytes || actualSize !== Number(object.expected_size_bytes ?? 0)) {
      throw new ConflictException('上传文件大小与授权不一致')
    }
    if (head.ContentType && head.ContentType.toLowerCase() !== object.content_type.toLowerCase()) {
      throw new ConflictException('上传文件类型与授权不一致')
    }
    const headSha256 = head.ChecksumSHA256 ? Buffer.from(head.ChecksumSHA256, 'base64').toString('hex') : null
    if (headSha256 && object.checksum_sha256 && headSha256 !== object.checksum_sha256) {
      throw new ConflictException('上传文件校验和不一致')
    }

    await this.query(
      `UPDATE app.object_storage_objects
          SET size_bytes = $2, checksum_md5 = COALESCE($3, checksum_md5), scan_status = 'pending'
        WHERE id = $1`,
      [object.id, String(actualSize), input.md5?.toLowerCase() ?? null],
    )
    await this.query(`UPDATE app.presigned_urls SET used_at = now() WHERE id = $1`, [presigned.id])
    await this.audit(adminId, 'admin.storage.upload_completed', 'storage_object', object.id, {
      bucket: object.bucket,
      key: object.key,
      sizeBytes: actualSize,
    })

    if (this.scanMode === 'internal-basic') {
      return this.runBasicScan(object.id, adminId)
    }
    const refreshed = await this.getObjectRow(object.id)
    return this.summarize(refreshed)
  }

  async runBasicScan(objectId: string, adminId?: string) {
    if (this.scanMode !== 'internal-basic') {
      throw new ConflictException('当前为外部扫描模式：请等待扫描服务回调，或将 OBJECT_STORAGE_SCAN_MODE 切换为 internal-basic')
    }
    const s3 = this.requireClient()
    const object = await this.getObjectRow(objectId)
    if (object.scan_status === 'clean' || object.scan_status === 'quarantined' || object.scan_status === 'failed') {
      return this.summarize(object)
    }
    if (object.size_bytes === '0') throw new ConflictException('文件尚未完成上传')

    let verdict: 'clean' | 'quarantined' = 'quarantined'
    let detail = 'magic-bytes-mismatch'
    try {
      const response = await s3.send(
        new GetObjectCommand({ Bucket: this.physicalBucket(object.bucket), Key: object.key, Range: 'bytes=0-15' }),
      )
      const body = response.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined
      const bytes = body?.transformToByteArray ? await body.transformToByteArray() : new Uint8Array()
      const ok = magicMatches(object.content_type, bytes)
      verdict = ok ? 'clean' : 'quarantined'
      detail = ok ? 'magic-bytes-ok' : 'magic-bytes-mismatch'
    } catch {
      verdict = 'quarantined'
      detail = 'range-read-failed'
    }

    const scanEventId = `internal-${randomUUID()}`
    const tags = {
      ...(object.tags ?? {}),
      scanOutcome: verdict === 'clean' ? 'clean' : 'infected',
      scanQuality: 'basic-magic-bytes',
      scanDetail: detail,
    }
    await this.query(
      `UPDATE app.object_storage_objects
          SET scan_status = $2, scan_provider = 'internal-basic', scan_reference = $3,
              scan_event_id = $4, scanned_at = now(), tags = $5::jsonb
        WHERE id = $1`,
      [object.id, verdict, scanEventId, scanEventId, JSON.stringify(tags)],
    )
    if (adminId) {
      await this.audit(adminId, verdict === 'clean' ? 'admin.storage.scan_clean' : 'admin.storage.scan_quarantined', 'storage_object', object.id, {
        bucket: object.bucket,
        key: object.key,
        detail,
      })
    }
    const refreshed = await this.getObjectRow(object.id)
    return this.summarize(refreshed)
  }

  async listObjects(query: StorageObjectQueryDto) {
    this.requireClient()
    const page = clampInt(query.page, 1, 1, 10_000)
    const pageSize = clampInt(query.pageSize, 20, 1, 100)
    const where: string[] = []
    const values: unknown[] = []
    if (query.bucket) {
      this.assertBucket(query.bucket)
      values.push(query.bucket)
      where.push(`bucket = $${values.length}`)
    }
    if (query.scanStatus) {
      values.push(query.scanStatus)
      where.push(`scan_status = $${values.length}`)
    }
    if (query.q?.trim()) {
      values.push(`%${query.q.trim().toLowerCase()}%`)
      where.push(`(lower(key) LIKE $${values.length} OR lower(bucket) LIKE $${values.length})`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRows = await this.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM app.object_storage_objects ${whereSql}`,
      values,
    )
    const rows = await this.query<StorageObjectRow>(
      `SELECT id, bucket, key, content_type, size_bytes, expected_size_bytes, checksum_sha256, scan_status, scan_provider, scanned_at, tags, uploaded_by, uploaded_at
         FROM app.object_storage_objects ${whereSql}
        ORDER BY uploaded_at DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, (page - 1) * pageSize],
    )
    return {
      items: rows.map((row) => this.summarize(row)),
      total: Number(totalRows[0]?.total ?? 0),
      page,
      pageSize,
    }
  }

  async createDownload(objectId: string, adminId: string, disposition: 'inline' | 'attachment' = 'inline') {
    const s3 = this.requireClient()
    const object = await this.getObjectRow(objectId)
    if (object.scan_status !== 'clean' || object.size_bytes === '0') {
      throw new ConflictException('文件尚未通过安全校验，暂不能下载或预览')
    }
    const cmd = new GetObjectCommand({
      Bucket: this.physicalBucket(object.bucket),
      Key: object.key,
      ResponseContentDisposition: disposition === 'inline' ? 'inline' : 'attachment',
    })
    const presignedUrl = await getSignedUrl(s3, cmd, { expiresIn: DOWNLOAD_TTL_SEC })
    await this.query(
      `INSERT INTO app.presigned_urls (id, object_id, bucket, key, method, expires_at, created_by)
       VALUES ($1, $2, $3, $4, 'GET', $5, $6)`,
      [randomUUID(), object.id, object.bucket, object.key, new Date(Date.now() + DOWNLOAD_TTL_SEC * 1000), adminId],
    )
    return { url: presignedUrl, expiresInSec: DOWNLOAD_TTL_SEC, objectId: object.id }
  }

  async deleteObject(objectId: string, adminId: string) {
    const s3 = this.requireClient()
    const object = await this.getObjectRow(objectId)
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: this.physicalBucket(object.bucket), Key: object.key }))
    } catch {
      // 存储端对象可能已不存在；继续清理数据库记录
    }
    await this.query(`UPDATE app.presigned_urls SET used_at = COALESCE(used_at, now()) WHERE object_id = $1`, [object.id])
    await this.query(`DELETE FROM app.object_storage_objects WHERE id = $1`, [object.id])
    await this.audit(adminId, 'admin.storage.object_deleted', 'storage_object', object.id, {
      bucket: object.bucket,
      key: object.key,
    })
    return { deleted: true, objectId: object.id }
  }

  private async getObjectRow(objectId: string): Promise<StorageObjectRow> {
    const rows = await this.query<StorageObjectRow>(
      `SELECT id, bucket, key, content_type, size_bytes, expected_size_bytes, checksum_sha256, scan_status, scan_provider, scanned_at, tags, uploaded_by, uploaded_at
         FROM app.object_storage_objects WHERE id = $1`,
      [objectId],
    )
    if (!rows[0]) throw new NotFoundException('对象不存在')
    return rows[0]
  }

  private summarize(row: StorageObjectRow) {
    return {
      id: row.id,
      bucket: row.bucket,
      key: row.key,
      storageRef: `${row.bucket}/${row.key}`,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      expectedSizeBytes: row.expected_size_bytes,
      checksumSha256: row.checksum_sha256,
      scanStatus: row.scan_status,
      scanProvider: row.scan_provider,
      scannedAt: row.scanned_at,
      tags: row.tags ?? {},
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
    }
  }

  private requireClient(): S3Client {
    if (!this.enabled || !this.s3) {
      throw new ServiceUnavailableException('对象存储未启用：请先配置 S3/R2 并设置 OBJECT_STORAGE_ENABLED=true')
    }
    return this.s3
  }

  private assertBucket(bucket: string): asserts bucket is StorageBucket {
    if (!STORAGE_BUCKETS.includes(bucket as StorageBucket)) {
      throw new ConflictException(`不支持的存储桶：${bucket}`)
    }
  }

  private physicalBucket(logicalBucket: string): string {
    this.assertBucket(logicalBucket)
    return this.bucketMap[logicalBucket] ?? logicalBucket
  }

  private async query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
    if (!this.core) {
      throw new ServiceUnavailableException('Admin 存储模块需要 CORE_DATABASE_URL 才能管理对象记录')
    }
    const result = await this.core.query<T>(text, values)
    return result.rows
  }

  private async audit(adminId: string, action: string, objectType: string, objectId: string, metadata: Record<string, unknown>) {
    await this.adminDb.query(
      `INSERT INTO app.audit_logs (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7::jsonb)`,
      [randomUUID(), adminId, action, objectType, objectId, randomUUID(), JSON.stringify(metadata)],
    )
  }
}

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
    if (!STORAGE_BUCKETS.includes(logical as StorageBucket)) {
      throw new Error(`S3_BUCKET_MAP_JSON contains unsupported logical bucket: ${logical}`)
    }
    if (typeof physical !== 'string' || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(physical)) {
      throw new Error(`S3_BUCKET_MAP_JSON contains an invalid physical bucket for ${logical}`)
    }
    result[logical] = physical
  }
  return result
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100)
  return cleaned || 'file'
}

function magicMatches(contentType: string, bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false
  const hex = Buffer.from(bytes).toString('hex')
  switch (contentType) {
    case 'application/pdf':
      return hex.startsWith('25504446')
    case 'image/png':
      return hex.startsWith('89504e47')
    case 'image/jpeg':
      return hex.startsWith('ffd8ff')
    case 'text/plain':
      return true
    default:
      return false
  }
}

function clampInt(value: string | number | undefined, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}
