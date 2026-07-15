import { MigrationInterface, QueryRunner } from 'typeorm'

export class HardenObjectStorage1783792000000 implements MigrationInterface {
  name = 'HardenObjectStorage1783792000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.presigned_urls
        ADD COLUMN bucket text,
        ADD COLUMN key text;

      UPDATE app.presigned_urls p
      SET bucket = o.bucket, key = o.key
      FROM app.object_storage_objects o
      WHERE o.id = p.object_id;

      ALTER TABLE app.presigned_urls
        ALTER COLUMN bucket SET NOT NULL,
        ALTER COLUMN key SET NOT NULL;

      ALTER TABLE app.object_storage_objects
        ADD COLUMN expected_size_bytes bigint,
        ADD COLUMN checksum_sha256 varchar(64),
        ADD COLUMN scan_status varchar(16) NOT NULL DEFAULT 'pending',
        ADD COLUMN scan_provider varchar(64),
        ADD COLUMN scan_reference varchar(256),
        ADD COLUMN scan_event_id varchar(256),
        ADD COLUMN scanned_at timestamptz,
        ADD CONSTRAINT chk_object_storage_expected_size
          CHECK (expected_size_bytes IS NULL OR expected_size_bytes > 0),
        ADD CONSTRAINT chk_object_storage_sha256
          CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
        ADD CONSTRAINT chk_object_storage_scan_status
          CHECK (scan_status IN ('pending', 'clean', 'quarantined', 'failed'));

      CREATE UNIQUE INDEX uq_object_storage_scan_event
        ON app.object_storage_objects (scan_event_id)
        WHERE scan_event_id IS NOT NULL;
      CREATE INDEX idx_object_storage_scan_pending
        ON app.object_storage_objects (uploaded_at)
        WHERE scan_status = 'pending';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS app.idx_object_storage_scan_pending;
      DROP INDEX IF EXISTS app.uq_object_storage_scan_event;
      ALTER TABLE app.object_storage_objects
        DROP CONSTRAINT IF EXISTS chk_object_storage_scan_status,
        DROP CONSTRAINT IF EXISTS chk_object_storage_sha256,
        DROP CONSTRAINT IF EXISTS chk_object_storage_expected_size,
        DROP COLUMN IF EXISTS scanned_at,
        DROP COLUMN IF EXISTS scan_event_id,
        DROP COLUMN IF EXISTS scan_reference,
        DROP COLUMN IF EXISTS scan_provider,
        DROP COLUMN IF EXISTS scan_status,
        DROP COLUMN IF EXISTS checksum_sha256,
        DROP COLUMN IF EXISTS expected_size_bytes;
      ALTER TABLE app.presigned_urls
        DROP COLUMN IF EXISTS key,
        DROP COLUMN IF EXISTS bucket;
    `)
  }
}
