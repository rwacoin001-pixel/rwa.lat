import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { SaveArticleDto } from './content.dto'

@Injectable()
export class ContentService {
  constructor(private readonly ds: DataSource) {}
  async listPublished(locale = 'en') {
    return this.ds.query(`SELECT id,slug,locale,published->>'title' AS title,published->>'summary' AS summary,published->>'author' AS author,published_at AS "publishedAt",published_revision AS revision
      FROM app.learning_articles WHERE published IS NOT NULL AND archived_at IS NULL AND locale=$1 ORDER BY published_at DESC,id DESC LIMIT 100`, [locale])
  }
  async article(slug: string, locale = 'en') {
    const [row] = await this.ds.query(`SELECT id,slug,locale,published,published_at AS "publishedAt",published_revision AS revision FROM app.learning_articles
      WHERE slug=$1 AND locale=$2 AND published IS NOT NULL AND archived_at IS NULL`, [slug, locale])
    if (!row) throw new NotFoundException({ code: 'ARTICLE_NOT_FOUND', message: 'This article has not been published in the selected language.' })
    const { published, ...meta } = row
    return { ...meta, ...published }
  }
  listAdmin() { return this.ds.query('SELECT id,slug,locale,revision,draft,published_revision AS "publishedRevision",published_at AS "publishedAt",archived_at AS "archivedAt" FROM app.learning_articles ORDER BY updated_at DESC LIMIT 200') }
  async save(id: string | null, input: SaveArticleDto, adminId: string) {
    const content = { title: input.title.trim(), summary: input.summary.trim(), body: input.body.trim(), author: input.author.trim() }
    if (!content.title || !content.body || !content.author) throw new ConflictException('Title, body and author must not be blank.')
    return this.ds.transaction(async tx => {
      let row
      if (id) {
        ;[row] = mutationRows(await tx.query(`UPDATE app.learning_articles SET draft=$1::jsonb,revision=revision+1,updated_by=$2,updated_at=now()
          WHERE id=$3 AND revision=$4 AND slug=$5 AND locale=$6 RETURNING id,revision`, [JSON.stringify(content), adminId, id, input.expectedRevision, input.slug, input.locale]))
        if (!row) throw new ConflictException('The article changed. Refresh before saving. Slug and language cannot change after creation.')
      } else {
        ;[row] = mutationRows(await tx.query(`INSERT INTO app.learning_articles (slug,locale,draft,updated_by) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (slug,locale) DO NOTHING RETURNING id,revision`, [input.slug, input.locale, JSON.stringify(content), adminId]))
        if (!row) throw new ConflictException('An article with this slug and language already exists.')
      }
      await this.audit(tx, adminId, 'content.article.saved', row.id, { revision: row.revision })
      return row
    })
  }
  async publish(id: string, revision: number, adminId: string, archive = false) {
    return this.ds.transaction(async tx => {
      const [row] = mutationRows(await tx.query(`UPDATE app.learning_articles SET published=CASE WHEN $4 THEN published ELSE draft END,
        published_revision=CASE WHEN $4 THEN published_revision ELSE revision END,published_at=CASE WHEN $4 THEN published_at ELSE now() END,
        archived_at=CASE WHEN $4 THEN now() ELSE NULL END,updated_at=now(),updated_by=$3 WHERE id=$1 AND revision=$2 RETURNING id,revision`, [id, revision, adminId, archive]))
      if (!row) throw new ConflictException('The article changed. Refresh before publishing.')
      await this.audit(tx, adminId, archive ? 'content.article.archived' : 'content.article.published', id, { revision })
      return row
    })
  }
  private audit(tx: EntityManager, admin: string, action: string, id: string, metadata: Record<string, unknown>) {
    return tx.query(`INSERT INTO app.audit_logs (id,actor_type,actor_id,action,object_type,object_id,request_id,metadata) VALUES ($1,'admin',$2,$3,'learning_article',$4,$5,$6::jsonb)`, [randomUUID(), admin, action, id, randomUUID(), JSON.stringify(metadata)])
  }
}

// PostgreSQL UPDATE/DELETE raw results in TypeORM include [rows, affectedCount].
function mutationRows(raw: unknown): Array<{ id: string; revision: number }> {
  if (!Array.isArray(raw)) return []
  return raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number' ? raw[0] : raw
}
