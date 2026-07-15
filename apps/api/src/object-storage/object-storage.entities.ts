import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, OneToMany, ManyToOne, JoinColumn } from 'typeorm'

export type ObjectTag = Record<string, string>
export type ObjectScanStatus = 'pending' | 'clean' | 'quarantined' | 'failed'

@Entity({ name: 'object_storage_objects', schema: 'app' })
@Index(['bucket', 'key'], { unique: true })
export class ObjectStorageObject {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'bucket', type: 'varchar' })
  bucket!: string

  @Column({ name: 'key', type: 'text' })
  key!: string

  @Column({ name: 'content_type', type: 'varchar' })
  contentType!: string

  @Column({ name: 'size_bytes', type: 'bigint', default: '0' })
  sizeBytes!: string

  @Column({ name: 'expected_size_bytes', type: 'bigint', nullable: true })
  expectedSizeBytes?: string | null

  @Column({ name: 'checksum_md5', type: 'varchar', nullable: true })
  checksumMd5?: string | null

  @Column({ name: 'checksum_sha256', type: 'varchar', length: 64, nullable: true })
  checksumSha256?: string | null

  @Column({ name: 'scan_status', type: 'varchar', length: 16, default: 'pending' })
  scanStatus!: ObjectScanStatus

  @Column({ name: 'scan_provider', type: 'varchar', length: 64, nullable: true })
  scanProvider?: string | null

  @Column({ name: 'scan_reference', type: 'varchar', length: 256, nullable: true })
  scanReference?: string | null

  @Column({ name: 'scan_event_id', type: 'varchar', length: 256, nullable: true })
  scanEventId?: string | null

  @Column({ name: 'scanned_at', type: 'timestamptz', nullable: true })
  scannedAt?: Date | null

  @Column({ name: 'tags', type: 'jsonb', default: '{}' })
  tags!: ObjectTag

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string | null

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt!: Date

  @OneToMany(() => PresignedUrl, (p) => p.object)
  presignedUrls!: PresignedUrl[]
}

@Entity({ name: 'presigned_urls', schema: 'app' })
@Index(['expiresAt'], { where: 'used_at IS NULL' })
export class PresignedUrl {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'object_id', type: 'uuid', nullable: true })
  objectId?: string | null

  @ManyToOne(() => ObjectStorageObject, (o) => o.presignedUrls)
  @JoinColumn({ name: 'object_id' })
  object?: ObjectStorageObject | null

  @Column({ name: 'bucket', type: 'varchar' })
  bucket!: string

  @Column({ name: 'key', type: 'text' })
  key!: string

  @Column({ name: 'method', type: 'varchar' })
  method!: 'PUT' | 'GET'

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null
}
