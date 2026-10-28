import { MigrationInterface, QueryRunner } from 'typeorm'

/** Change string values only: keys and the independent unpublished draft are preserved. */
export function supportBrand(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/RWA\.LAT/g, 'A-REIT').replace(/rwa\.lat/g, 'a-reit.com')
  if (Array.isArray(value)) return value.map(supportBrand)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, key === 'supportEmail' ? 'support@a-reit.com' : supportBrand(item)]))
  return value
}

export class SupportEmailBrand1793232000000 implements MigrationInterface {
  name = 'SupportEmailBrand1793232000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query('LOCK TABLE app.platform_configuration IN EXCLUSIVE MODE')
    // Publisher IDs are UUIDs, not free-text actors. NULL plus audit metadata identifies this system publication.
    await q.query(`ALTER TABLE app.platform_configuration_versions ALTER COLUMN published_by DROP NOT NULL;
      CREATE TABLE app.mail_platform_backup AS SELECT * FROM app.platform_configuration WHERE id=true;
      ALTER TABLE app.mail_platform_backup ADD COLUMN migration_revision integer;
      ALTER TABLE app.mail_platform_backup ADD COLUMN migration_audit_id uuid;`)
    const [row] = await q.query('SELECT * FROM app.platform_configuration WHERE id=true FOR UPDATE')
    if (!row) return
    const [{ revision }] = await q.query(`SELECT GREATEST($1::integer, COALESCE($2::integer,0), COALESCE(MAX(revision),0))+1 AS revision FROM app.platform_configuration_versions`, [row.revision, row.published_revision])
    const draft = { ...supportBrand(row.draft) as object, supportEmail: 'support@a-reit.com' }
    const published = row.published === null ? null : { ...supportBrand(row.published) as object, supportEmail: 'support@a-reit.com' }
    await q.query(`INSERT INTO app.platform_configuration_versions(revision,content,published_by) VALUES ($1,$2::jsonb,NULL)`, [revision, JSON.stringify(published ?? draft)])
    await q.query(`UPDATE app.platform_configuration SET draft=$1::jsonb,published=$2::jsonb,revision=$3,
      published_revision=CASE WHEN $2::jsonb IS NULL THEN NULL ELSE $4 END,
      published_at=CASE WHEN $2::jsonb IS NULL THEN NULL ELSE now() END,updated_at=now(),updated_by=NULL WHERE id=true`,
    [JSON.stringify(draft), published ? JSON.stringify(published) : null, published && JSON.stringify(draft) !== JSON.stringify(published) ? revision + 1 : revision, revision])
    const [audit] = await q.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
      VALUES (gen_random_uuid(),'service',NULL,'admin.platform.published','platform_configuration','platform',gen_random_uuid(),$1::jsonb) RETURNING id`,
    [JSON.stringify({ actor: 'system:migration', revision, published: published !== null, migration: this.name })])
    await q.query('UPDATE app.mail_platform_backup SET migration_revision=$1,migration_audit_id=$2', [revision, audit.id])
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE app.platform_configuration p SET revision=b.revision,draft=b.draft,published_revision=b.published_revision,
      published=b.published,published_at=b.published_at,updated_at=b.updated_at,updated_by=b.updated_by FROM app.mail_platform_backup b WHERE p.id=b.id;
      DELETE FROM app.platform_configuration_versions WHERE revision IN (SELECT migration_revision FROM app.mail_platform_backup);
      DELETE FROM app.audit_logs WHERE id IN (SELECT migration_audit_id FROM app.mail_platform_backup);
      DROP TABLE app.mail_platform_backup;
      ALTER TABLE app.platform_configuration_versions ALTER COLUMN published_by SET NOT NULL;`)
  }
}
