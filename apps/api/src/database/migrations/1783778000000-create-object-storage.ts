import { MigrationInterface, QueryRunner } from 'typeorm'

// INFRA-003：对象存储落盘记录（KYC/产品文件/工单附件）
// 仅记录元数据与临时访问控制；实际文件存 S3 兼容存储。
export class CreateObjectStorage1783778000000 implements MigrationInterface {
  name = 'CreateObjectStorage1783778000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.object_storage_objects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket text NOT NULL,
        key text NOT NULL,
        content_type text NOT NULL,
        size_bytes bigint NOT NULL DEFAULT 0,
        checksum_md5 text,
        tags jsonb NOT NULL DEFAULT '{}',
        uploaded_by uuid,
        uploaded_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (bucket, key)
      );

      CREATE TABLE app.presigned_urls (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        object_id uuid NOT NULL REFERENCES app.object_storage_objects(id) ON DELETE CASCADE,
        method text NOT NULL CHECK (method IN ('PUT','GET')),
        expires_at timestamptz NOT NULL,
        created_by uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        used_at timestamptz
      );

      CREATE INDEX idx_objects_bucket ON app.object_storage_objects (bucket);
      CREATE INDEX idx_presigned_expires ON app.presigned_urls (expires_at) WHERE used_at IS NULL;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.presigned_urls;
      DROP TABLE IF EXISTS app.object_storage_objects;
    `)
  }
}