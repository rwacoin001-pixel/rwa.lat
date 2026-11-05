import { ConflictException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Pool, PoolClient } from 'pg'
import { randomUUID } from 'node:crypto'
import { InvestmentBlockDto, PublishPlatformDto, SavePlatformDto, VerifiedAccessDto } from './admin-platform.dto'

@Injectable()
export class AdminPlatformService implements OnModuleDestroy {
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
  async getPlatformConfiguration() {
    const { rows } = await this.database().query(`SELECT revision, draft, published_revision AS "publishedRevision", published, published_at AS "publishedAt", updated_at AS "updatedAt" FROM app.platform_configuration WHERE id = true`)
    if (!rows[0]) throw new ServiceUnavailableException('Platform configuration migration is required')
    const value = rows[0]
    // Imported published records can predate a maintained draft. Return the
    // current publication for editing without mutating either stored version.
    return value.published && value.revision < value.publishedRevision
      ? { ...value, draft: value.published }
      : value
  }
  async savePlatformConfiguration(input: SavePlatformDto, adminId: string) {
    await this.transaction(adminId, 'admin.platform.draft_saved', async (db) => {
      await this.validateDocuments(db, input.content.documents)
      const { rows } = await db.query(`UPDATE app.platform_configuration SET draft = $1::jsonb, revision = GREATEST(revision, COALESCE(published_revision, 0)) + 1, updated_at = now(), updated_by = $2 WHERE id = true AND revision = $3 RETURNING revision`, [JSON.stringify(input.content), adminId, input.expectedRevision])
      if (!rows[0]) throw new ConflictException('资料已被其他人更新，请刷新后再保存')
      return { revision: rows[0].revision }
    })
    return this.getPlatformConfiguration()
  }
  async publishPlatformConfiguration(input: PublishPlatformDto, adminId: string) {
    await this.transaction(adminId, 'admin.platform.published', async (db) => {
      const { rows } = await db.query(`SELECT revision, draft, published_revision FROM app.platform_configuration WHERE id = true FOR UPDATE`)
      const row = rows[0]
      if (!row || row.revision !== input.expectedRevision) throw new ConflictException('草稿版本已变化，请刷新后再发布')
      if (row.published_revision === row.revision) return { revision: row.revision, replay: true }
      if (!row.draft.legalName || !row.draft.allowedRegions?.length || !row.draft.investorTypes?.length) throw new ConflictException('请先保存完整的主体和地区资料')
      for (const profile of row.draft.brandProfiles ?? []) {
        if (profile.brandId !== 'kimeng' || !['draft', 'ready'].includes(profile.status)) throw new ConflictException('金英品牌配置无效，请重新保存')
        if (profile.status === 'ready' && ['legalName', 'registrationNumber', 'jurisdiction', 'address', 'supportEmail'].some(key => typeof profile[key] !== 'string' || !profile[key].trim())) {
          throw new ConflictException('请先补齐金英的主体名称、注册编号、注册地、地址和客服邮箱，或将其保留为草稿')
        }
      }
      await this.validateDocuments(db, row.draft.documents)
      await db.query(`INSERT INTO app.platform_configuration_versions (revision, content, published_by) VALUES ($1, $2::jsonb, $3)`, [row.revision, JSON.stringify(row.draft), adminId])
      await db.query(`UPDATE app.platform_configuration SET published = draft, published_revision = revision, published_at = now(), updated_at = now(), updated_by = $1 WHERE id = true`, [adminId])
      return { revision: row.revision }
    })
    return this.getPlatformConfiguration()
  }
  async listPlatformVersions() {
    return (await this.database().query(`SELECT revision, content, published_at AS "publishedAt" FROM app.platform_configuration_versions ORDER BY revision DESC LIMIT 50`)).rows
  }
  async getVerifiedAccess(userId: string) {
    return (await this.database().query(`SELECT region, investor_type AS "investorType", evidence_ref AS "evidenceRef", verified_at AS "verifiedAt" FROM app.user_verified_access WHERE user_id = $1`, [userId])).rows[0] ?? null
  }
  async saveVerifiedAccess(userId: string, input: VerifiedAccessDto, adminId: string) {
    await this.transaction(adminId, 'admin.platform.user_access_verified', async (db) => {
      if (!(await db.query(`SELECT id FROM app.users WHERE id = $1`, [userId])).rowCount) throw new NotFoundException('用户不存在')
      await db.query(`INSERT INTO app.user_verified_access (user_id, region, investor_type, evidence_ref, verified_by)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO UPDATE SET region = EXCLUDED.region, investor_type = EXCLUDED.investor_type, evidence_ref = EXCLUDED.evidence_ref, verified_by = EXCLUDED.verified_by, verified_at = now()`,
      [userId, input.region, input.investorType, input.evidenceRef, adminId])
      return { userId, region: input.region, investorType: input.investorType }
    })
    return this.getVerifiedAccess(userId)
  }
  async listInvestmentBlocks() {
    const { rows } = await this.database().query(`SELECT f.user_id AS "userId", p.display_name AS "displayName", p.handle,
        NULL::text AS reason, f.opened_at AS "blockedAt", a.actor_id AS "blockedBy"
      FROM app.risk_flags f LEFT JOIN app.community_profiles p ON p.user_id = f.user_id
      LEFT JOIN LATERAL (SELECT actor_id FROM app.audit_logs
        WHERE action = 'admin.platform.investment_blocked' AND metadata->>'flagId' = f.id::text
        ORDER BY occurred_at LIMIT 1) a ON true
      WHERE f.category = 'investment_block' AND f.state = 'open'
      ORDER BY f.opened_at DESC, f.id DESC LIMIT 200`)
    return { items: rows }
  }
  async blockInvestment(input: InvestmentBlockDto, adminId: string) {
    await this.transaction(adminId, 'admin.platform.investment_blocked', async (db) => {
      // Serialize block/unblock operations for this account, including concurrent first blocks.
      if (!(await db.query(`SELECT id FROM app.users WHERE id = $1 FOR UPDATE`, [input.userId])).rowCount) throw new NotFoundException('User not found')
      const { rows } = await db.query(`SELECT id FROM app.risk_flags WHERE user_id = $1 AND category = 'investment_block' AND state = 'open'`, [input.userId])
      if (rows.length) return { userId: input.userId, replay: true }
      const flagId = randomUUID()
      // risk_flags has no free-text reason; the list intentionally returns reason: null.
      await db.query(`INSERT INTO app.risk_flags (id, user_id, category, severity, state, source, reason_code)
        VALUES ($1,$2,'investment_block','high','open','admin','admin_block')`, [flagId, input.userId])
      return { userId: input.userId, flagId }
    })
    return { userId: input.userId, blocked: true }
  }
  async unblockInvestment(userId: string, adminId: string) {
    await this.transaction(adminId, 'admin.platform.investment_unblocked', async (db) => {
      await db.query(`SELECT id FROM app.users WHERE id = $1 FOR UPDATE`, [userId])
      await db.query(`UPDATE app.risk_flags SET state = 'resolved', resolved_at = now()
        WHERE user_id = $1 AND category = 'investment_block' AND state = 'open'`, [userId])
      return { userId }
    })
    return { userId, blocked: false }
  }
  private async validateDocuments(db: PoolClient, documents: { storageRef: string; public: boolean; kind?: string; reportDate?: string; asOfDate?: string; issuer?: string }[]) {
    for (const doc of documents) {
      if (doc.kind === 'reserve_audit' || doc.kind === 'reserve_custody') {
        const date = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v)
        if (!date(doc.reportDate) || !date(doc.asOfDate) || !doc.issuer?.trim() || doc.asOfDate! > doc.reportDate!) throw new ConflictException('储备证明须填写有效报告日期、统计截至日期和出具机构；截至日期不能晚于报告日期')
      }
      const slash = doc.storageRef.indexOf('/')
      const bucket = doc.storageRef.slice(0, slash)
      if (!['rwa-assets', 'rwa-attachments'].includes(bucket) || (doc.public && bucket !== 'rwa-assets')) throw new ConflictException('公开文件须存放在产品资料库，内部附件不能直接公开')
      const { rows } = await db.query(`SELECT id FROM app.object_storage_objects WHERE bucket = $1 AND key = $2 AND scan_status = 'clean' AND size_bytes > 0 FOR SHARE`, [bucket, doc.storageRef.slice(slash + 1)])
      if (!rows[0]) throw new ConflictException('关联文件不存在或尚未通过校验')
    }
  }
  private async transaction(adminId: string, action: string, work: (db: PoolClient) => Promise<Record<string, unknown>>) {
    const db = await this.database().connect()
    try {
      await db.query('BEGIN')
      const metadata = await work(db)
      await db.query(`INSERT INTO app.audit_logs (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata) VALUES ($1,'admin',$2,$3,'platform_configuration','platform',$4,$5::jsonb)`, [randomUUID(), adminId, action, randomUUID(), JSON.stringify(metadata)])
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    } finally { db.release() }
  }
}
