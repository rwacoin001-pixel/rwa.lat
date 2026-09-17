import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { Pool, type QueryResultRow } from 'pg'
import {
  AssetClassInputDto,
  CreateProductDto,
  DisclosureInputDto,
  PriceQuoteInputDto,
  ProductStateDto,
  SwitchInputDto,
  TreasuryAddressInputDto,
  UpdateProductDto,
} from './admin-control.dto'

const SWITCH_DEFINITIONS = [
  {
    key: 'orders.acceptance',
    label: '订单受理',
    description: '允许用户提交新的产品订单。',
    environmentKey: 'CORE_PRODUCTION_FINANCIAL_FEATURES_ENABLED',
  },
  {
    key: 'wallet.deposits.crediting',
    label: '充值入账',
    description: '允许已确认的链上充值进入用户余额。',
    environmentKey: 'CORE_PRODUCTION_FINANCIAL_FEATURES_ENABLED',
  },
  {
    key: 'wallet.withdrawals.request',
    label: '提现申请',
    description: '允许用户创建新的提现申请。',
    environmentKey: 'CORE_PRODUCTION_FINANCIAL_FEATURES_ENABLED',
  },
  {
    key: 'wallet.withdrawals.execution',
    label: '提现执行',
    description: '允许已审批的提现进入托管执行队列。',
    environmentKey: 'CORE_WALLET_EXECUTION_ENABLED',
  },
  {
    key: 'yield.processing',
    label: '收益处理',
    description: '允许生产收益批次进行计算和入账。',
    environmentKey: 'CORE_PRODUCTION_FINANCIAL_FEATURES_ENABLED',
  },
  {
    key: 'polymarket.trading',
    label: '预测市场交易',
    description: '允许向外部交易执行器提交订单。',
    environmentKey: 'CORE_POLYMARKET_TRADING_ENABLED',
  },
] as const

type ProductPatch = Record<string, unknown>

@Injectable()
export class AdminControlService implements OnModuleDestroy {
  private readonly core: Pool | null
  private readonly coreConfigured: boolean

  constructor(
    private readonly adminDb: DataSource,
    private readonly config: ConfigService,
  ) {
    const coreUrl = config.get<string>('CORE_DATABASE_URL')?.trim()
    this.coreConfigured = Boolean(coreUrl)
    this.core = coreUrl
      ? new Pool({
          connectionString: coreUrl,
          max: 2,
          connectionTimeoutMillis: 5_000,
          idleTimeoutMillis: 30_000,
        })
      : null
  }

  async onModuleDestroy() {
    await this.core?.end()
  }

  async listAssetClasses() {
    const rows = await this.query<{
      id: string
      display_name: string
      description: string | null
      state: string
      created_at: Date
      deprecated_at: Date | null
    }>(
      `SELECT id, display_name, description, state, created_at, deprecated_at
         FROM app.asset_classes ORDER BY id ASC`,
    )
    return rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      description: row.description,
      state: row.state,
      createdAt: row.created_at,
      deprecatedAt: row.deprecated_at,
    }))
  }

  async upsertAssetClass(input: AssetClassInputDto, adminId: string) {
    await this.query(`
      INSERT INTO app.asset_classes (id, display_name, description, state)
      VALUES ($1, $2, $3, 'active')
      ON CONFLICT (id) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            state = 'active',
            deprecated_at = NULL
    `, [input.id, input.displayName.trim(), input.description?.trim() || null])
    await this.audit(adminId, 'admin.catalog.asset_class_saved', 'asset_class', input.id, { id: input.id })
    return this.getAssetClass(input.id)
  }

  async deprecateAssetClass(id: string, adminId: string) {
    const result = await this.query(`
      UPDATE app.asset_classes
         SET state = 'deprecated', deprecated_at = now()
       WHERE id = $1
       RETURNING id
    `, [id])
    if (!result.length) throw new NotFoundException('Asset class was not found')
    await this.audit(adminId, 'admin.catalog.asset_class_deprecated', 'asset_class', id, {})
    return this.getAssetClass(id)
  }

  async listProducts() {
    const rows = await this.query<Record<string, unknown>>(`
      SELECT p.id, p.asset_class_id AS "assetClassId", p.version,
             p.external_ref AS "externalRef", p.display_name AS "displayName",
             p.summary, p.asset_code AS "assetCode", p.asset_decimals AS "assetDecimals",
             p.network, p.min_order_atomic_amount AS "minOrderAtomicAmount",
             p.max_order_atomic_amount AS "maxOrderAtomicAmount", p.state,
             p.published_at AS "publishedAt", p.retired_at AS "retiredAt",
             p.created_at AS "createdAt", p.updated_at AS "updatedAt",
             COALESCE(p.metadata_json, '{}'::jsonb) AS metadata,
             COALESCE(p.yield_terms_json, '{}'::jsonb) AS "yieldTerms",
             COALESCE(p.risk_disclosure_json, '{}'::jsonb) AS "riskDisclosure",
             COALESCE(p.media_refs_json, '[]'::jsonb) AS "mediaRefs",
             q.unit_price_atomic_amount AS "latestPriceAtomicAmount",
             q.currency AS "latestPriceCurrency", q.valid_until AS "priceValidUntil",
             q.source AS "priceSource"
        FROM app.products p
        LEFT JOIN LATERAL (
          SELECT unit_price_atomic_amount, currency, valid_until, source
            FROM app.price_quotes
           WHERE product_id = p.id
           ORDER BY captured_at DESC
           LIMIT 1
        ) q ON true
       ORDER BY p.updated_at DESC, p.created_at DESC
    `)
    return rows
  }

  async getProduct(id: string) {
    const rows = await this.query<Record<string, unknown>>(`
      SELECT p.id, p.asset_class_id AS "assetClassId", p.version,
             p.external_ref AS "externalRef", p.display_name AS "displayName",
             p.summary, p.asset_code AS "assetCode", p.asset_decimals AS "assetDecimals",
             p.network, p.min_order_atomic_amount AS "minOrderAtomicAmount",
             p.max_order_atomic_amount AS "maxOrderAtomicAmount", p.state,
             p.published_at AS "publishedAt", p.retired_at AS "retiredAt",
             p.created_at AS "createdAt", p.updated_at AS "updatedAt",
             COALESCE(p.metadata_json, '{}'::jsonb) AS metadata,
             COALESCE(p.yield_terms_json, '{}'::jsonb) AS "yieldTerms",
             COALESCE(p.risk_disclosure_json, '{}'::jsonb) AS "riskDisclosure",
             COALESCE(p.media_refs_json, '[]'::jsonb) AS "mediaRefs"
        FROM app.products p WHERE p.id = $1
    `, [id])
    if (!rows[0]) throw new NotFoundException('Product was not found')
    return rows[0]
  }

  async createProduct(input: CreateProductDto, adminId: string) {
    await this.assertAssetClass(input.assetClassId)
    this.assertAtomicRange(input.minOrderAtomicAmount, input.maxOrderAtomicAmount)
    this.validateProductContent(input)
    const id = randomUUID()
    await this.query(`
      INSERT INTO app.products (
        id, asset_class_id, external_ref, display_name, summary, asset_code,
        asset_decimals, network, min_order_atomic_amount, max_order_atomic_amount,
        state, metadata_json, yield_terms_json, risk_disclosure_json, media_refs_json,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15)
    `, [
      id,
      input.assetClassId,
      input.externalRef?.trim() || null,
      input.displayName.trim(),
      input.summary?.trim() || null,
      input.assetCode,
      input.assetDecimals,
      input.network ?? null,
      input.minOrderAtomicAmount ?? null,
      input.maxOrderAtomicAmount ?? null,
      this.json(input.metadata),
      this.json(input.yieldTerms),
      this.json(input.riskDisclosure),
      this.json(input.mediaRefs ?? []),
      adminId,
    ])
    await this.audit(adminId, 'admin.catalog.product_created', 'product', id, { displayName: input.displayName })
    return this.getProduct(id)
  }

  async updateProduct(id: string, input: UpdateProductDto, adminId: string) {
    const current = await this.getProduct(id) as Record<string, unknown>
    if (input.assetClassId) await this.assertAssetClass(input.assetClassId)
    this.assertAtomicRange(
      input.minOrderAtomicAmount ?? this.asString(current.minOrderAtomicAmount),
      input.maxOrderAtomicAmount ?? this.asString(current.maxOrderAtomicAmount),
    )
    this.validateProductContent(input)

    const patch: ProductPatch = {}
    const add = (key: keyof UpdateProductDto, column: string, value: unknown) => {
      if (value !== undefined) patch[column] = value
    }
    add('assetClassId', 'asset_class_id', input.assetClassId)
    add('externalRef', 'external_ref', input.externalRef?.trim() || null)
    add('displayName', 'display_name', input.displayName?.trim())
    add('summary', 'summary', input.summary?.trim() || null)
    add('assetCode', 'asset_code', input.assetCode)
    add('assetDecimals', 'asset_decimals', input.assetDecimals)
    add('network', 'network', input.network ?? null)
    add('minOrderAtomicAmount', 'min_order_atomic_amount', input.minOrderAtomicAmount ?? null)
    add('maxOrderAtomicAmount', 'max_order_atomic_amount', input.maxOrderAtomicAmount ?? null)
    if (input.metadata !== undefined) patch.metadata_json = this.json(input.metadata)
    if (input.yieldTerms !== undefined) patch.yield_terms_json = this.json(input.yieldTerms)
    if (input.riskDisclosure !== undefined) patch.risk_disclosure_json = this.json(input.riskDisclosure)
    if (input.mediaRefs !== undefined) patch.media_refs_json = this.json(input.mediaRefs)
    const entries = Object.entries(patch)
    if (entries.length) {
      const assignments = entries.map(([column], index) => `${column} = $${index + 1}`)
      const values = entries.map(([, value]) => value)
      values.push(adminId, id)
      await this.query(
        `UPDATE app.products SET ${assignments.join(', ')}, updated_at = now(), updated_by = $${values.length - 1} WHERE id = $${values.length}`,
        values,
      )
      await this.audit(adminId, 'admin.catalog.product_updated', 'product', id, { fields: entries.map(([column]) => column) })
    }
    return this.getProduct(id)
  }

  async setProductState(id: string, input: ProductStateDto, adminId: string) {
    await this.getProduct(id)
    if (input.state === 'published') {
      const quotes = await this.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app.price_quotes WHERE product_id = $1 AND valid_until > now()`,
        [id],
      )
      if (Number(quotes[0]?.count ?? 0) < 1) {
        throw new ConflictException('A product needs at least one fresh price quote before it can be published')
      }
    }
    await this.query(`
      UPDATE app.products
         SET state = $2,
             published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
             retired_at = CASE WHEN $2 = 'retired' THEN COALESCE(retired_at, now()) ELSE NULL END,
             updated_at = now(), updated_by = $3
       WHERE id = $1
    `, [id, input.state, adminId])
    await this.audit(adminId, `admin.catalog.product_${input.state}`, 'product', id, { state: input.state })
    return this.getProduct(id)
  }

  async listQuotes(productId: string) {
    await this.getProduct(productId)
    return this.query(`
      SELECT id, product_id AS "productId", asset_code AS "assetCode",
             unit_price_atomic_amount AS "unitPriceAtomicAmount", currency, source,
             valid_until AS "validUntil", captured_at AS "capturedAt"
        FROM app.price_quotes WHERE product_id = $1 ORDER BY captured_at DESC
    `, [productId])
  }

  async addQuote(productId: string, input: PriceQuoteInputDto, adminId: string) {
    const product = await this.getProduct(productId) as { assetCode: string }
    const validUntil = new Date(input.validUntil)
    if (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date()) {
      throw new ConflictException('Price quote validity must be in the future')
    }
    const id = randomUUID()
    await this.query(`
      INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, productId, product.assetCode, input.unitPriceAtomicAmount, input.currency, input.source.trim(), validUntil])
    await this.query(`UPDATE app.products SET updated_at = now(), updated_by = $2 WHERE id = $1`, [productId, adminId])
    await this.audit(adminId, 'admin.catalog.price_quote_created', 'price_quote', id, { productId, source: input.source })
    return this.listQuotes(productId)
  }

  async listDisclosures(productId: string) {
    await this.getProduct(productId)
    return this.query(`
      SELECT id, product_id AS "productId", kind, locale, title, storage_ref AS "storageRef",
             encode(content_hash, 'hex') AS "contentHash", state,
             published_at AS "publishedAt", superseded_at AS "supersededAt"
        FROM app.disclosure_files WHERE product_id = $1 ORDER BY published_at DESC
    `, [productId])
  }

  async addDisclosure(productId: string, input: DisclosureInputDto, adminId: string) {
    await this.getProduct(productId)
    const id = randomUUID()
    await this.query(`
      UPDATE app.disclosure_files SET state = 'superseded', superseded_at = now()
       WHERE product_id = $1 AND kind = $2 AND locale = $3 AND state = 'active'
    `, [productId, input.kind, input.locale])
    await this.query(`
      INSERT INTO app.disclosure_files
        (id, product_id, kind, locale, title, storage_ref, content_hash, state)
      VALUES ($1, $2, $3, $4, $5, $6, decode($7, 'hex'), 'active')
    `, [id, productId, input.kind, input.locale, input.title.trim(), input.storageRef.trim(), input.contentHash.toLowerCase()])
    await this.audit(adminId, 'admin.catalog.disclosure_saved', 'disclosure_file', id, { productId, kind: input.kind })
    return this.listDisclosures(productId)
  }

  async listSwitches() {
    const rows = await this.query<Record<string, unknown>>(`
      SELECT switch_key AS "switchKey", enabled, version, reason,
             changed_by AS "changedBy", updated_at AS "updatedAt"
        FROM app.operational_switches ORDER BY switch_key ASC
    `)
    const byKey = new Map(rows.map((row) => [String(row.switchKey), row]))
    return SWITCH_DEFINITIONS.map((definition) => ({
      ...definition,
      current: byKey.get(definition.key) ?? null,
      environmentReady: this.environmentReady(definition.environmentKey),
      canEnable: definition.key !== 'wallet.withdrawals.execution'
        && this.environmentReady(definition.environmentKey),
    }))
  }

  async updateSwitch(switchKey: string, input: SwitchInputDto, adminId: string) {
    const definition = SWITCH_DEFINITIONS.find((item) => item.key === switchKey)
    if (!definition) throw new NotFoundException('Operational switch was not found')
    if (input.enabled && (definition.key === 'wallet.withdrawals.execution' || !this.environmentReady(definition.environmentKey))) {
      throw new ConflictException({
        code: 'OPERATIONAL_SWITCH_ENVIRONMENT_BLOCKED',
        message: definition.key === 'wallet.withdrawals.execution'
          ? 'Withdrawal execution must be resumed through the existing two-person approval flow.'
          : `The Core API environment gate ${definition.environmentKey} is not ready.`,
      })
    }
    const result = await this.query(`
      UPDATE app.operational_switches
         SET enabled = $2, version = version + 1, reason = $3,
             changed_by = $4, updated_at = now()
       WHERE switch_key = $1
       RETURNING switch_key AS "switchKey", enabled, version, reason, updated_at AS "updatedAt"
    `, [switchKey, input.enabled, input.reason.trim(), adminId])
    if (!result.length) throw new NotFoundException('Operational switch was not initialized')
    await this.audit(adminId, input.enabled ? 'admin.operations.switch_enabled' : 'admin.operations.switch_disabled', 'operational_switch', switchKey, { reason: input.reason.trim() })
    return result[0]
  }

  storageStatus() {
    const enabled = this.config.get<string>('OBJECT_STORAGE_ENABLED') === 'true'
    return {
      enabled,
      bucket: 'rwa-assets',
      uploadFlow: 'presigned_checksum_malware_scan',
      message: enabled
        ? '对象存储已启用，可使用预签名上传并等待安全扫描。'
        : '对象存储尚未配置；先可保存资料引用，配置 S3/R2 和扫描回调后即可在此上传。',
    }
  }

  async listTreasuryAddresses() {
    return this.query(`
      SELECT id, network, asset_code AS "assetCode", purpose, label, address, memo,
             state, updated_by AS "updatedBy", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM app.wallet_treasury_addresses ORDER BY network, purpose, asset_code
    `)
  }

  async upsertTreasuryAddress(input: TreasuryAddressInputDto, adminId: string) {
    if (/private.?key|seed.?phrase|mnemonic|secret/i.test(input.address) || /private.?key|seed.?phrase|mnemonic|secret/i.test(input.memo ?? '')) {
      throw new ConflictException('Private keys, seed phrases and secrets are never accepted as wallet configuration')
    }
    const result = await this.query(`
      INSERT INTO app.wallet_treasury_addresses
        (network, asset_code, purpose, label, address, memo, state, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (network, asset_code, purpose) DO UPDATE SET
        label = EXCLUDED.label, address = EXCLUDED.address, memo = EXCLUDED.memo,
        state = EXCLUDED.state, updated_by = EXCLUDED.updated_by, updated_at = now()
      RETURNING id, network, asset_code AS "assetCode", purpose, label, address, memo,
                state, updated_by AS "updatedBy", created_at AS "createdAt", updated_at AS "updatedAt"
    `, [input.network, input.assetCode, input.purpose, input.label.trim(), input.address.trim(), input.memo?.trim() || null, input.state ?? 'active', adminId])
    await this.audit(adminId, 'admin.wallet.treasury_address_saved', 'wallet_treasury_address', String(result[0].id), {
      network: input.network,
      assetCode: input.assetCode,
      purpose: input.purpose,
    })
    return result[0]
  }

  async deactivateTreasuryAddress(id: string, adminId: string) {
    const result = await this.query(`
      UPDATE app.wallet_treasury_addresses SET state = 'inactive', updated_by = $2, updated_at = now()
       WHERE id = $1 RETURNING id
    `, [id, adminId])
    if (!result.length) throw new NotFoundException('Treasury address was not found')
    await this.audit(adminId, 'admin.wallet.treasury_address_deactivated', 'wallet_treasury_address', id, {})
    return this.listTreasuryAddresses()
  }

  private async getAssetClass(id: string) {
    const rows = await this.query(`SELECT id, display_name AS "displayName", description, state FROM app.asset_classes WHERE id = $1`, [id])
    if (!rows[0]) throw new NotFoundException('Asset class was not found')
    return rows[0]
  }

  private async assertAssetClass(id: string) {
    const rows = await this.query(`SELECT id FROM app.asset_classes WHERE id = $1 AND state = 'active'`, [id])
    if (!rows.length) throw new ConflictException('An active asset class is required')
  }

  private validateProductContent(input: {
    yieldTerms?: Record<string, unknown>
    riskDisclosure?: Record<string, unknown>
    mediaRefs?: string[]
  }) {
    if (input.yieldTerms !== undefined) this.validateYieldTerms(input.yieldTerms)
    if (input.mediaRefs !== undefined) this.validateMediaRefs(input.mediaRefs)
  }

  private validateYieldTerms(terms: Record<string, unknown>) {
    const fail = (message: string): never => {
      throw new ConflictException(message)
    }
    if (terms.rateType !== undefined && !['fixed', 'floating', 'tiered', 'profit_share'].includes(String(terms.rateType))) {
      fail('利率类型不合法（fixed / floating / tiered / profit_share）')
    }
    for (const key of ['annualRateBps', 'spreadBps', 'floorBps', 'capBps', 'investorShareBps']) {
      const value = terms[key]
      if (value === undefined || value === null) continue
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 20_000) {
        fail(`${key} 需为 0-20000 的整数基点（bps）`)
      }
    }
    if (terms.termDays !== undefined) {
      const days = terms.termDays
      if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 3650) fail('期限（天）需为 1-3650 的整数')
    }
    if (terms.payoutFrequency !== undefined && !['daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'at_maturity'].includes(String(terms.payoutFrequency))) {
      fail('付息频率不合法')
    }
    if (terms.payoutMode !== undefined && !['interest', 'principal_plus_interest', 'profit_share'].includes(String(terms.payoutMode))) {
      fail('付息方式不合法')
    }
    if (terms.tiers !== undefined) {
      const tiers = terms.tiers as unknown
      if (!Array.isArray(tiers) || tiers.length > 10) {
        throw new ConflictException('分档利率最多 10 档')
      }
      for (const tier of tiers) {
        if (!tier || typeof tier !== 'object') throw new ConflictException('分档数据不合法')
        const t = tier as Record<string, unknown>
        const min = Number(t.minAmount)
        if (!Number.isFinite(min) || min < 0) fail('分档起始金额不合法')
        if (t.maxAmount !== undefined && t.maxAmount !== null && String(t.maxAmount) !== '') {
          const max = Number(t.maxAmount)
          if (!Number.isFinite(max) || max <= min) fail('分档上限必须大于起始金额')
        }
        const rate = t.annualRateBps
        if (rate !== undefined && (typeof rate !== 'number' || rate < 0 || rate > 20_000)) fail('分档利率需为 0-20000 基点')
      }
    }
    if (terms.fees !== undefined) {
      const fees = terms.fees as Record<string, unknown>
      if (!fees || typeof fees !== 'object') fail('费用配置不合法')
      for (const key of ['subscriptionBps', 'managementAnnualBps', 'performanceBps', 'redemptionBps']) {
        const value = fees[key]
        if (value === undefined || value === null) continue
        if (typeof value !== 'number' || value < 0 || value > 5_000) fail(`费率 ${key} 需为 0-5000 基点`)
      }
    }
    if (terms.earlyRedemption !== undefined) {
      const er = terms.earlyRedemption as Record<string, unknown>
      if (!er || typeof er !== 'object') fail('提前退出配置不合法')
      if (er.penaltyBps !== undefined && er.penaltyBps !== null) {
        if (typeof er.penaltyBps !== 'number' || er.penaltyBps < 0 || er.penaltyBps > 5_000) fail('提前退出违约金需为 0-5000 基点')
      }
      if (er.lockDays !== undefined && er.lockDays !== null) {
        if (typeof er.lockDays !== 'number' || er.lockDays < 0 || er.lockDays > 3650) fail('锁定天数需为 0-3650')
      }
    }
  }

  private validateMediaRefs(refs: string[]) {
    if (refs.length > 30) throw new ConflictException('媒体引用最多 30 个')
    for (const ref of refs) {
      if (typeof ref !== 'string' || ref.length > 520 || !/^(rwa-kyc|rwa-assets|rwa-attachments)\//.test(ref)) {
        throw new ConflictException('媒体引用格式不合法（应为 存储桶/对象键 形式）')
      }
    }
  }

  private assertAtomicRange(minimum?: string, maximum?: string) {
    if (minimum !== undefined && maximum !== undefined && BigInt(minimum) > BigInt(maximum)) {
      throw new ConflictException('Minimum order amount cannot exceed maximum order amount')
    }
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
  }

  private json(value: unknown) {
    return JSON.stringify(value ?? {})
  }

  private environmentReady(environmentKey: string) {
    return this.coreConfigured
      && this.config.get<string>('ADMIN_LIVE_OPERATIONS_ENABLED') === 'true'
      && this.config.get<string>(environmentKey) === 'true'
  }

  private async query<T extends QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
    if (!this.core) {
      throw new ServiceUnavailableException({
        code: 'CORE_DATABASE_NOT_CONFIGURED',
        message: 'The admin control plane needs CORE_DATABASE_URL before it can manage business data.',
      })
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

