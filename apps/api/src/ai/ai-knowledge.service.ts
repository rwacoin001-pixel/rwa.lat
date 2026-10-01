import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { AI_LOCALES, SaveKnowledgeDto } from './ai-knowledge.dto'
import { KnowledgeRecord, KnowledgeSource, activeAt, knowledgeSearchPatterns, selectKnowledgeSources } from './ai-knowledge.policy'
import { AiPlatformKnowledgeService } from './ai-platform-knowledge.service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const liveFields = `id,published,published_revision AS "publishedRevision",published_at AS "publishedAt",archived_at AS "archivedAt"`
export const SUPPORT_POLICY_ID = '9e9e8a8a-dcfa-4b2f-8f68-6b308af9a101'

@Injectable()
export class AiKnowledgeService {
  constructor(private readonly ds: DataSource, private readonly config: ConfigService, @Optional() private readonly platform?: AiPlatformKnowledgeService) {}
  get enabled() { return this.config.get<string>('AI_KNOWLEDGE_ENABLED') !== 'false' }

  /** Reserved, administrator-published internal rule; never a public citation or user instruction. */
  async supportPolicy(): Promise<string> {
    const [row]: KnowledgeRecord[] = await this.ds.query(`SELECT ${liveFields} FROM app.ai_knowledge_items WHERE id=$1`, [SUPPORT_POLICY_ID])
    const policy = row?.published
    if (!policy || row.archivedAt !== null || !row.publishedRevision || policy.visibility !== 'internal'
      || policy.category !== 'support-policy' || !activeAt(policy.effectiveAt, policy.expiresAt, new Date())
      || typeof policy.body !== 'string' || policy.body.length > 6000) return ''
    return policy.body.trim()
  }

  listAdmin() {
    return this.ds.query(`SELECT id,revision,locale,draft,published,published_revision AS "publishedRevision",published_at AS "publishedAt",archived_at AS "archivedAt",updated_at AS "updatedAt" FROM app.ai_knowledge_items ORDER BY updated_at DESC,id LIMIT 300`)
  }
  versions(id: string) {
    return this.ds.query(`SELECT item_id AS id,revision,content,published_at AS "publishedAt",published_by AS "publishedBy" FROM app.ai_knowledge_versions WHERE item_id=$1 ORDER BY revision DESC`, [id])
  }
  coverage() {
    return this.ds.query(`SELECT (created_at AT TIME ZONE 'UTC')::date AS day,COUNT(*)::int AS replies,
      COUNT(*) FILTER(WHERE citations_json IS NULL OR citations_json='[]'::jsonb)::int AS "withoutCitations",
      COUNT(*) FILTER(WHERE helpful=true)::int AS helpful,COUNT(*) FILTER(WHERE helpful=false)::int AS unhelpful
      FROM app.ai_chat_messages WHERE role='assistant' AND created_at>=now()-interval '30 days'
      GROUP BY (created_at AT TIME ZONE 'UTC')::date ORDER BY day DESC`)
  }
  async save(id: string | null, input: SaveKnowledgeDto, adminId: string) {
    const content = normalizeContent(input)
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) throw new BadRequestException('Expected revision is required')
    return this.ds.transaction(async tx => {
      let row: { id: string; revision: number }
      if (id) {
        const previous = await this.lock(tx, id, input.expectedRevision)
        if (previous.locale !== content.locale) throw new ConflictException('Language cannot change after creation')
        ;[row] = await tx.query(`WITH changed AS (UPDATE app.ai_knowledge_items SET draft=$1::jsonb,revision=revision+1,updated_by=$2,updated_at=now() WHERE id=$3 RETURNING id,revision) SELECT * FROM changed`, [JSON.stringify(content), adminId, id])
      } else {
        if (input.expectedRevision !== 0) throw new ConflictException('New knowledge requires revision zero')
        ;[row] = await tx.query(`INSERT INTO app.ai_knowledge_items(locale,draft,updated_by) VALUES ($1,$2::jsonb,$3) RETURNING id,revision`, [content.locale, JSON.stringify(content), adminId])
      }
      await this.audit(tx, adminId, 'ai.knowledge.saved', row.id, { revision: row.revision })
      return row
    })
  }
  async publish(id: string, expectedRevision: number, adminId: string) {
    return this.ds.transaction(async tx => {
      const item = await this.lock(tx, id, expectedRevision)
      normalizeContent(item.draft)
      // Republishing an unchanged revision never overwrites its immutable version.
      await tx.query(`INSERT INTO app.ai_knowledge_versions(item_id,revision,content,published_by) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (item_id,revision) DO NOTHING`, [id, expectedRevision, JSON.stringify(item.draft), adminId])
      const [row] = await tx.query(`WITH changed AS (UPDATE app.ai_knowledge_items SET published=draft,published_revision=revision,
        published_at=(SELECT published_at FROM app.ai_knowledge_versions WHERE item_id=$1 AND revision=$2),archived_at=NULL,updated_by=$3,updated_at=now() WHERE id=$1 RETURNING id,revision) SELECT * FROM changed`, [id, expectedRevision, adminId])
      await this.audit(tx, adminId, 'ai.knowledge.published', id, { revision: expectedRevision })
      return row
    })
  }
  async archive(id: string, expectedRevision: number, adminId: string) {
    return this.ds.transaction(async tx => {
      await this.lock(tx, id, expectedRevision)
      const [row] = await tx.query(`WITH changed AS (UPDATE app.ai_knowledge_items SET archived_at=now(),updated_at=now(),updated_by=$2 WHERE id=$1 RETURNING id,revision) SELECT * FROM changed`, [id, adminId])
      await this.audit(tx, adminId, 'ai.knowledge.archived', id, { revision: expectedRevision })
      return row
    })
  }
  async restore(id: string, sourceRevision: number, expectedRevision: number, adminId: string) {
    const [version] = await this.ds.query(`SELECT content FROM app.ai_knowledge_versions WHERE item_id=$1 AND revision=$2`, [id, sourceRevision])
    if (!version) throw new NotFoundException('Knowledge version not found')
    return this.save(id, { ...version.content, expectedRevision }, adminId)
  }
  async retrieve(question: string, locale: string, authenticated: boolean): Promise<KnowledgeSource[]> {
    if (!this.enabled) return []
    const patterns = knowledgeSearchPatterns(question)
    if (!AI_LOCALES.includes(locale as any)) return []
    const [live, rows]: [KnowledgeSource[], KnowledgeRecord[]] = await Promise.all([
      this.platform?.retrieve(question, locale) ?? Promise.resolve([]),
      this.ds.query(`SELECT ${liveFields} FROM app.ai_knowledge_items
      WHERE published IS NOT NULL AND archived_at IS NULL AND locale=ANY($4::text[])
      AND (published->>'visibility'='public' OR ($3 AND published->>'visibility'='authenticated'))
      AND (published->>'title' ILIKE ANY($2::text[]) OR published->>'summary' ILIKE ANY($2::text[])
        OR published->>'body' ILIKE ANY($2::text[]) OR published->>'category' ILIKE ANY($2::text[]))
      ORDER BY CASE WHEN locale=$1 THEN 0 ELSE 1 END,CASE WHEN published->>'title' ILIKE ANY($2::text[]) THEN 0 ELSE 1 END,published_at DESC,id LIMIT 40`, [locale, patterns, authenticated, [...new Set([locale,'en','zh-CN'])]])
    ])
    const manual = rows.flatMap(row => selectKnowledgeSources([row], { now: new Date(), locale: String(row.published?.locale ?? ''), authenticated })).slice(0, 5)
    return [...live, ...manual]
  }
  async publicVersion(id: string, revision: number, authenticated: boolean): Promise<KnowledgeSource> {
    const [current]: KnowledgeRecord[] = await this.ds.query(`SELECT ${liveFields} FROM app.ai_knowledge_items WHERE id=$1`, [id])
    const locale = String(current?.published?.locale ?? '')
    if (!this.enabled || !current || !selectKnowledgeSources([current], { now: new Date(), locale, authenticated }).length) throw new NotFoundException('Knowledge source is unavailable')
    const [version] = await this.ds.query(`SELECT content,published_at AS "publishedAt" FROM app.ai_knowledge_versions WHERE item_id=$1 AND revision=$2`, [id, revision])
    const record = version ? { id, published: version.content, publishedRevision: revision, publishedAt: version.publishedAt, archivedAt: null } : null
    const sources = record ? selectKnowledgeSources([record], { now: new Date(), locale, authenticated }) : []
    if (!sources.length) throw new NotFoundException('Knowledge source is unavailable')
    return sources[0]
  }
  async stillCurrent(sources: KnowledgeSource[], authenticated: boolean): Promise<boolean> {
    if (!sources.length) return true
    if (this.platform && !await this.platform.stillCurrent(sources)) return false
    sources = sources.filter(source => !source.sourceId.startsWith('live:'))
    if (!sources.length) return true
    const rows: KnowledgeRecord[] = await this.ds.query(`SELECT ${liveFields} FROM app.ai_knowledge_items WHERE id=ANY($1::uuid[])`, [sources.map(source => source.id)])
    return sources.every(source => selectKnowledgeSources(rows.filter(row => row.id === source.id), { now: new Date(), locale: source.locale, authenticated })[0]?.sourceId === source.sourceId)
  }
  private async lock(tx: EntityManager, id: string, expectedRevision: number) {
    const [item] = await tx.query(`SELECT id,revision,locale,draft FROM app.ai_knowledge_items WHERE id=$1 FOR UPDATE`, [id])
    if (!item || item.revision !== expectedRevision) throw new ConflictException('The knowledge item changed. Refresh before continuing.')
    return item
  }
  private audit(tx: EntityManager, actor: string, action: string, id: string, metadata: object) {
    return tx.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata) VALUES ($1,'admin',$2,$3,'ai_knowledge',$4,$5,$6::jsonb)`, [randomUUID(), actor, action, id, randomUUID(), JSON.stringify(metadata)])
  }
}

function normalizeContent(input: Record<string, any>) {
  const field = (name: string, max: number, required = true) => {
    if (typeof input[name] !== 'string' || input[name].length > max || (required && !input[name].trim())) throw new BadRequestException(`Invalid ${name}`)
    return input[name].trim()
  }
  if (!AI_LOCALES.includes(input.locale) || !['public', 'authenticated', 'internal'].includes(input.visibility)) throw new BadRequestException('Invalid language or visibility')
  if (!Array.isArray(input.productIds) || input.productIds.length > 50 || input.productIds.some((id: any) => typeof id !== 'string' || !UUID.test(id)) || new Set(input.productIds).size !== input.productIds.length) throw new BadRequestException('Invalid related products')
  const dates = ['effectiveAt', 'expiresAt'].map(key => {
    const value = input[key] ?? null
    if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw new BadRequestException(`Invalid ${key}`)
    return value === null ? null : new Date(value).toISOString()
  })
  if (dates[0] && dates[1] && Date.parse(dates[1]) <= Date.parse(dates[0])) throw new BadRequestException('Expiry must follow the effective date')
  return { title: field('title', 200), summary: field('summary', 600, false), body: field('body', 6000), category: field('category', 80), locale: input.locale as string, visibility: input.visibility as string, productIds: input.productIds as string[], effectiveAt: dates[0], expiresAt: dates[1] }
}
