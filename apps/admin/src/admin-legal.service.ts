import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'node:crypto'
import { SaveLegalDto } from './admin-legal.dto'

@Injectable()
export class AdminLegalService implements OnModuleDestroy {
  private readonly pool: Pool | null
  constructor(config: ConfigService) {
    const url = config.get<string>('CORE_DATABASE_URL')
    this.pool = url ? new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 5000 }) : null
  }
  async onModuleDestroy() { await this.pool?.end() }
  private database() {
    if (!this.pool) throw new ServiceUnavailableException('Core database is not configured')
    return this.pool
  }
  private kind(kind: string) { if (!['terms','privacy'].includes(kind)) throw new NotFoundException() }
  async get(kind: string) {
    this.kind(kind)
    const { rows } = await this.database().query(`SELECT kind,revision,draft,published_revision AS "publishedRevision",updated_at AS "updatedAt"
      FROM app.legal_documents WHERE kind=$1`, [kind])
    if (!rows[0]) throw new ServiceUnavailableException('Legal publication migration is required')
    return rows[0]
  }
  async versions(kind: string) {
    this.kind(kind)
    return (await this.database().query(`SELECT revision,version,content,published_at AS "publishedAt"
      FROM app.legal_document_versions WHERE kind=$1 ORDER BY revision DESC LIMIT 50`, [kind])).rows
  }
  private validate(content: SaveLegalDto['content']) {
    const date = new Date(content.effectiveDate)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== content.effectiveDate ||
      content.effectiveDate > new Date().toISOString().slice(0,10)) throw new BadRequestException('请填写有效日期；发布版本立即生效，日期不能晚于今天')
    if (!content.title.trim() || !content.sections.length || content.sections.some(s => !s.body.trim())) throw new BadRequestException('标题和正文不能为空')
    if (JSON.stringify(content).length > 100000) throw new BadRequestException('正文过长')
  }
  async save(kind: string, input: SaveLegalDto, adminId: string) {
    this.kind(kind); this.validate(input.content)
    await this.transaction(kind, adminId, 'admin.legal.draft_saved', async db => {
      const { rows } = await db.query(`UPDATE app.legal_documents SET draft=$1::jsonb,revision=revision+1,updated_at=now(),updated_by=$2
        WHERE kind=$3 AND revision=$4 RETURNING revision`, [JSON.stringify(input.content),adminId,kind,input.expectedRevision])
      if (!rows[0]) throw new ConflictException('版本已变化，请刷新后再保存')
      return rows[0]
    })
    return this.get(kind)
  }
  async publish(kind: string, expectedRevision: number, adminId: string) {
    this.kind(kind)
    await this.transaction(kind, adminId, 'admin.legal.published', async db => {
      const { rows } = await db.query('SELECT revision,draft,published_revision FROM app.legal_documents WHERE kind=$1 FOR UPDATE', [kind])
      const row = rows[0]
      if (!row || row.revision !== expectedRevision) throw new ConflictException('草稿版本已变化，请刷新后再发布')
      if (row.published_revision === row.revision) return { revision: row.revision, replay: true }
      this.validate(row.draft)
      const version = `${kind}-${row.revision}`
      await db.query(`INSERT INTO app.legal_document_versions(kind,revision,version,content,published_by) VALUES ($1,$2,$3,$4::jsonb,$5)`,
        [kind,row.revision,version,JSON.stringify(row.draft),adminId])
      await db.query('UPDATE app.legal_documents SET published_revision=revision,updated_at=now(),updated_by=$2 WHERE kind=$1',[kind,adminId])
      return { revision: row.revision, version }
    })
    return this.get(kind)
  }
  private async transaction(kind: string, adminId: string, action: string, work: (db: PoolClient) => Promise<Record<string, unknown>>) {
    const db = await this.database().connect()
    try {
      await db.query('BEGIN')
      const metadata = await work(db)
      await db.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
        VALUES ($1,'admin',$2,$3,'legal_document',$4,$5,$6::jsonb)`,[randomUUID(),adminId,action,kind,randomUUID(),JSON.stringify(metadata)])
      await db.query('COMMIT')
    } catch (error) { await db.query('ROLLBACK'); throw error }
    finally { db.release() }
  }
}
