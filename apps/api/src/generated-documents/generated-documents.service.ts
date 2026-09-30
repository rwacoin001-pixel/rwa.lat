import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { ObjectStorageService } from '../object-storage/object-storage.service'
import { AgreementConsentDto, CompanyDto, TaxRecordDto, TemplateDto } from './document.dto'
import { atomic, Company, DEFAULT_TEMPLATES, DocumentKind, DocumentSnapshot, Template } from './document-model'

@Injectable()
export class GeneratedDocumentsService {
  private monthlyCursor?: { month: string; userId: string }
  constructor(private readonly db: DataSource, private readonly storage: ObjectStorageService) {}
  async configuration() {
    const [company] = await this.db.query('SELECT revision,content FROM app.document_company_settings WHERE id=true')
    return { company, templates: await this.db.query('SELECT kind,revision,content FROM app.document_templates ORDER BY kind') }
  }
  async saveCompany(input: CompanyDto, actor: string) {
    const content: Company = { companyName: input.companyName.trim(), registration: input.registration.trim(), contact: input.contact.trim(), website: input.website.trim() }
    if (!content.companyName || (content.website && !/^https:\/\//.test(content.website))) throw new ConflictException('公司名称不能为空，官网必须使用 HTTPS')
    return this.db.transaction(async tx => {
      const [saved] = await tx.query(`WITH changed AS (UPDATE app.document_company_settings SET content=$1::jsonb,revision=revision+1,updated_at=now() WHERE id=true AND revision=$2 RETURNING revision,content) SELECT * FROM changed`, [JSON.stringify(content),input.expectedRevision])
      if (!saved) throw new ConflictException('主体配置已变化，请刷新后保存')
      await tx.query('INSERT INTO app.document_company_versions(revision,content,created_by) VALUES($1,$2::jsonb,$3)', [saved.revision,JSON.stringify(content),actor])
      await this.audit(tx,actor,'document.company.updated',null,{revision:saved.revision})
      return saved
    })
  }
  async saveTemplate(kind: DocumentKind, input: TemplateDto, actor: string) {
    const content: Template = { title: input.title.trim(), introduction: input.introduction.trim(), terms: input.terms.map(t=>t.trim()).filter(Boolean), enabled: input.enabled }
    if (!content.title) throw new ConflictException('标题不能为空')
    return this.db.transaction(async tx => {
      const [company] = await tx.query('SELECT content FROM app.document_company_settings WHERE id=true FOR SHARE')
      if (kind === 'agreement' && content.enabled && (!company.content.registration || !content.introduction || !content.terms.length)) throw new ConflictException('启用协议前须填写真实主体注册信息、协议说明和正式条款')
      const [saved] = await tx.query(`WITH changed AS (UPDATE app.document_templates SET content=$1::jsonb,revision=revision+1,updated_at=now() WHERE kind=$2 AND revision=$3 RETURNING kind,revision,content) SELECT * FROM changed`, [JSON.stringify(content),kind,input.expectedRevision])
      if (!saved) throw new ConflictException('模板已变化，请刷新后保存')
      await tx.query('INSERT INTO app.document_template_versions(kind,revision,content,created_by) VALUES($1,$2,$3::jsonb,$4)', [kind,saved.revision,JSON.stringify(content),actor])
      await this.audit(tx,actor,'document.template.updated',null,{kind,revision:saved.revision})
      return saved
    })
  }
  async versions(kind: DocumentKind) { return this.db.query('SELECT revision,content,created_at AS "createdAt" FROM app.document_template_versions WHERE kind=$1 ORDER BY revision DESC',[kind]) }
  async reset(kind: DocumentKind, revision: number, actor: string) { return this.saveTemplate(kind,{...DEFAULT_TEMPLATES[kind],expectedRevision:revision},actor) }
  async restore(kind: DocumentKind, sourceRevision: number, expectedRevision: number, actor: string) {
    const [version] = await this.db.query('SELECT content FROM app.document_template_versions WHERE kind=$1 AND revision=$2',[kind,sourceRevision])
    if (!version) throw new NotFoundException('模板版本不存在')
    return this.saveTemplate(kind,{...version.content,expectedRevision},actor)
  }
  async list(userId: string) {
    return this.db.query(`SELECT d.id,d.kind,d.state,d.snapshot->'template'->>'title' AS title,d.snapshot->>'documentNo' AS "documentNo",d.snapshot->>'templateRevision' AS "templateRevision",d.created_at AS "createdAt",d.error_code AS "errorCode",o.scan_status AS "scanStatus"
      FROM app.generated_documents d LEFT JOIN app.object_storage_objects o ON o.id=d.object_id WHERE d.user_id=$1 ORDER BY d.created_at DESC LIMIT 200`,[userId])
  }
  async listAdmin(userId?: string) {
    return this.db.query(`SELECT d.id,d.user_id AS "userId",d.kind,d.state,d.snapshot->'template'->>'title' AS title,d.created_at AS "createdAt",o.scan_status AS "scanStatus" FROM app.generated_documents d LEFT JOIN app.object_storage_objects o ON o.id=d.object_id WHERE ($1::uuid IS NULL OR d.user_id=$1) ORDER BY d.created_at DESC LIMIT 200`,[userId ?? null])
  }
  async download(userId: string, id: string) {
    const [row] = await this.db.query(`SELECT d.state,o.bucket,o.key FROM app.generated_documents d JOIN app.object_storage_objects o ON o.id=d.object_id WHERE d.id=$1 AND d.user_id=$2`,[id,userId])
    if (!row) throw new NotFoundException('文件不存在或尚未生成')
    if (row.state !== 'ready') throw new ConflictException('文件尚未生成')
    const result = await this.storage.createDownloadPresignedUrl({bucket:row.bucket,key:row.key,createdBy:userId,ownerId:userId,expiresInSec:60})
    return { url:result.presignedUrl }
  }
  async retry(userId: string, id: string) {
    const rows = await this.db.query(`WITH changed AS (UPDATE app.generated_documents SET state='queued',attempts=0,error_code=NULL,lease_until=NULL,lease_token=NULL WHERE id=$1 AND user_id=$2 AND state='failed' RETURNING id) SELECT * FROM changed`,[id,userId])
    if (!rows.length) throw new ConflictException('仅自己的生成失败文件可以重试')
    return { id }
  }
  private async context(tx: EntityManager, kind: DocumentKind) {
    const [company] = await tx.query('SELECT revision,content FROM app.document_company_settings WHERE id=true FOR SHARE')
    const [template] = await tx.query('SELECT revision,content FROM app.document_templates WHERE kind=$1 FOR SHARE',[kind])
    if (!template?.content.enabled) throw new ConflictException('该文件模板尚未启用')
    return { company: company.content as Company, companyRevision: company.revision as number, template: template.content as Template, templateRevision: template.revision as number }
  }
  private async active(tx: EntityManager, userId: string) {
    const [user] = await tx.query('SELECT status FROM app.users WHERE id=$1 FOR SHARE',[userId])
    if (user?.status !== 'active') throw new ConflictException('当前账户不能申请新文件')
  }
  private async enqueue(tx: EntityManager, userId: string, kind: DocumentKind, key: string, fields: Array<[string,string]>, notes: string[], detail?: {columns:string[];rows:string[][]}, context?: Awaited<ReturnType<GeneratedDocumentsService['context']>>) {
    const current = context ?? await this.context(tx,kind)
    const id = randomUUID()
    const [clock] = await tx.query('SELECT now() AS now')
    const snapshot: DocumentSnapshot = { ...current, kind, documentNo:`${{trade_confirmation:'TC',statement:'ST',agreement:'AGR',tax_document:'TAX'}[kind]}-${id}`,userId,generatedAt:new Date(clock.now).toISOString(),fields,notes,...detail }
    const [row] = await tx.query(`INSERT INTO app.generated_documents(id,user_id,kind,source_key,snapshot) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(user_id,kind,source_key) DO NOTHING RETURNING id`,[id,userId,kind,key,JSON.stringify(snapshot)])
    if (row) return row
    return (await tx.query('SELECT id FROM app.generated_documents WHERE user_id=$1 AND kind=$2 AND source_key=$3',[userId,kind,key]))[0]
  }
  /** Called within the receipt-posting transaction; no renderer or object-store call can block fund posting. */
  async queueTrade(tx: EntityManager, settlementId: string) {
    const [enabled] = await tx.query("SELECT content->>'enabled' AS enabled FROM app.document_templates WHERE kind='trade_confirmation' FOR SHARE")
    if (enabled?.enabled !== 'true') return null
    const [row] = await tx.query(`SELECT s.*,COALESCE(o.user_id,r.user_id) AS user_id,COALESCE(o.product_asset_decimals,r.asset_decimals) AS decimals,p.display_name,
      (SELECT string_agg(t.id::text,', ' ORDER BY t.id) FROM app.ledger_transactions t WHERE t.metadata->>'settlementId'=s.id::text) AS ledger_refs
      FROM app.manual_trade_settlements s LEFT JOIN app.orders o ON s.kind='order' AND o.id=s.reference_id LEFT JOIN app.redemptions r ON s.kind='redemption' AND r.id=s.reference_id JOIN app.products p ON p.id=COALESCE(o.product_id,r.product_id) WHERE s.id=$1`,[settlementId])
    if (!row) throw new NotFoundException('真实成交凭证不存在')
    return this.enqueue(tx,row.user_id,'trade_confirmation',settlementId,[['申请编号',row.reference_id],['产品',row.display_name],['方向',row.kind==='order'?'投资':'赎回'],['实际成交份额',atomic(String(row.quantity_atomic),Number(row.decimals))],['实际入账金额',`${atomic(String(row.amount_atomic))} USDT`],['入账时间',new Date(row.posted_at).toISOString()],['成交凭证号',row.external_reference],['账本流水',row.ledger_refs ?? '未记录'],['事后复核状态',row.review_state]],['金额和份额以已提交的真实凭证为准；未根据报价推算费用、单价或税额。',`凭证 SHA-256：${row.evidence_hash}`])
  }
  async backfillTrades(userId: string) {
    return this.db.transaction(async tx => {
      await this.active(tx,userId)
      const rows = await tx.query(`SELECT s.id FROM app.manual_trade_settlements s LEFT JOIN app.orders o ON s.kind='order' AND o.id=s.reference_id LEFT JOIN app.redemptions r ON s.kind='redemption' AND r.id=s.reference_id WHERE COALESCE(o.user_id,r.user_id)=$1 AND NOT EXISTS(SELECT 1 FROM app.generated_documents d WHERE d.user_id=$1 AND d.kind='trade_confirmation' AND d.source_key=s.id::text) ORDER BY s.posted_at LIMIT 20`,[userId])
      let queued=0
      for (const row of rows) if(await this.queueTrade(tx,row.id)) queued++
      return { queued }
    })
  }
  async statement(userId: string, month: string) {
    if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(month)) throw new ConflictException('月份格式错误')
    const start = new Date(`${month}-01T00:00:00.000Z`), end = new Date(start)
    end.setUTCMonth(end.getUTCMonth()+1)
    if (end.getTime()>Date.now()) throw new ConflictException('正式月结单仅支持已结束的 UTC 自然月')
    return this.db.transaction('REPEATABLE READ',async tx => {
      await this.active(tx,userId)
      const rows = await tx.query(`SELECT t.id,t.transaction_type,t.effective_at,
        sum(CASE WHEN e.side=a.normal_side THEN e.atomic_amount ELSE -e.atomic_amount END)::text AS delta
        FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id JOIN app.ledger_transactions t ON t.id=e.transaction_id
        WHERE a.user_id=$1 AND a.purpose IN ('available','locked') AND a.asset_code='USDT' AND a.asset_decimals=6 AND t.effective_at<$2
        GROUP BY t.id ORDER BY t.effective_at,t.id LIMIT 10001`,[userId,end.toISOString()])
      if (rows.length>10000) throw new ConflictException('账务记录过多，需后台分段核验后出具，不生成截断结单')
      let balance = 0n, opening = 0n
      const detail: string[][] = []
      for(const row of rows) {
        const delta = BigInt(row.delta); balance+=delta
        if(new Date(row.effective_at)<start) opening+=delta
        else detail.push([new Date(row.effective_at).toISOString(),row.transaction_type,atomic(row.delta),atomic(balance.toString()),row.id])
      }
      return this.enqueue(tx,userId,'statement',month,[['结单月份',month],['时区','UTC'],['期初现金余额',`${atomic(opening.toString())} USDT`],['期末现金余额',`${atomic(balance.toString())} USDT`],['本期现金净变化',`${atomic((balance-opening).toString())} USDT`]],['覆盖可用及锁定 USDT 现金账户。内部可用/锁定划转净变化为零。','不混入其他币种，不使用当前持仓冒充历史持仓，不推断历史市值。'],{columns:['时间（UTC）','流水类型','现金变化（USDT）','现金余额（USDT）','流水编号'],rows:detail})
    })
  }
  async agreement() { return this.db.transaction(tx=>this.context(tx,'agreement')) }
  async queueMonthlyStatements() {
    const date=new Date();date.setUTCMonth(date.getUTCMonth()-1,1)
    const month=date.toISOString().slice(0,7)
    const [template]=await this.db.query("SELECT content->>'enabled' AS enabled FROM app.document_templates WHERE kind='statement'")
    if(template?.enabled!=='true') return
    const cursor=this.monthlyCursor?.month===month ? this.monthlyCursor.userId : null
    const rows=await this.db.query(`SELECT eligible.id FROM (SELECT DISTINCT u.id FROM app.users u JOIN app.ledger_accounts a ON a.user_id=u.id JOIN app.ledger_entries e ON e.account_id=a.id WHERE u.status='active' AND a.asset_code='USDT' AND a.asset_decimals=6 AND a.purpose IN ('available','locked') AND NOT EXISTS(SELECT 1 FROM app.generated_documents d WHERE d.user_id=u.id AND d.kind='statement' AND d.source_key=$1)) eligible ORDER BY CASE WHEN $2::uuid IS NULL OR eligible.id>$2::uuid THEN 0 ELSE 1 END,eligible.id LIMIT 5`,[month,cursor])
    for(const row of rows) {
      // Advance past validation failures too, so a few invalid accounts cannot
      // prevent later accounts from ever receiving their monthly statements.
      this.monthlyCursor={month,userId:row.id}
      try { await this.statement(row.id,month) } catch { /* One account cannot stop the generation queue; manual request surfaces its validation error. */ }
    }
  }
  async consent(userId: string, input: AgreementConsentDto) {
    return this.db.transaction(async tx => {
      await this.active(tx,userId)
      const current = await this.context(tx,'agreement')
      if(input.accepted!==true || current.templateRevision!==input.templateRevision || current.companyRevision!==input.companyRevision) throw new ConflictException('协议或主体已变化，请重新阅读并确认当前版本')
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`agreement:${userId}:${input.templateRevision}:${input.companyRevision}`])
      const [existing] = await tx.query('SELECT document_id AS id FROM app.document_agreement_consents WHERE user_id=$1 AND template_revision=$2 AND company_revision=$3',[userId,input.templateRevision,input.companyRevision])
      if(existing) return existing
      const [clock] = await tx.query('SELECT now() AS now')
      const consentId = randomUUID()
      const document = await this.enqueue(tx,userId,'agreement',`${input.templateRevision}:${input.companyRevision}`,[['用户确认时间',new Date(clock.now).toISOString()],['确认方式','登录用户阅读并勾选同意后确认'],['同意记录编号',consentId]],['仅记录用户电子确认，不自动生成公司代表签名、用户手写签名或印章。'],undefined,current)
      await tx.query('INSERT INTO app.document_agreement_consents(id,user_id,template_revision,company_revision,document_id) VALUES($1,$2,$3,$4,$5)',[consentId,userId,input.templateRevision,input.companyRevision,document.id])
      return document
    })
  }
  async tax(input: TaxRecordDto, actor: string) {
    if(input.verified!==true || BigInt(input.withheldAtomic)>BigInt(input.grossAtomic)) throw new ConflictException('需确认资料已核实；实际预扣税额不能超过收入总额')
    const content = { accountHolder:input.accountHolder.trim(),taxpayerId:input.taxpayerId.trim(),taxResidency:input.taxResidency.trim(),jurisdiction:input.jurisdiction.trim(),taxpayerAddress:input.taxpayerAddress.trim(),currency:input.currency,decimals:input.decimals,grossAtomic:BigInt(input.grossAtomic).toString(),withheldAtomic:BigInt(input.withheldAtomic).toString(),incomeDescription:input.incomeDescription.trim(),evidenceRef:input.evidenceRef }
    if(!content.accountHolder||!content.taxpayerId||!content.taxResidency||!content.jurisdiction||!content.incomeDescription) throw new ConflictException('核实的税务资料不可为空')
    return this.db.transaction(async tx => {
      await this.active(tx,input.userId)
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`tax-document:${input.idempotencyKey}`])
      const [existing] = await tx.query('SELECT user_id,tax_year,content FROM app.document_tax_records WHERE id=$1',[input.idempotencyKey])
      if(existing) {
        if(existing.user_id!==input.userId || existing.tax_year!==input.taxYear || createHash('sha256').update(JSON.stringify(existing.content,Object.keys(content).sort())).digest('hex')!==createHash('sha256').update(JSON.stringify(content,Object.keys(content).sort())).digest('hex')) throw new ConflictException('该提交编号已用于不同税务资料')
        return (await tx.query("SELECT id FROM app.generated_documents WHERE user_id=$1 AND kind='tax_document' AND source_key=$2",[input.userId,input.idempotencyKey]))[0]
      }
      const [proof] = await tx.query("SELECT checksum_sha256 FROM app.object_storage_objects WHERE bucket='rwa-attachments' AND key=$1 AND scan_status='clean' AND size_bytes>0 FOR SHARE",[input.evidenceRef.slice('rwa-attachments/'.length)])
      if(!proof?.checksum_sha256) throw new ConflictException('请先上传并扫描核实税务资料所依据的凭证')
      await tx.query('INSERT INTO app.document_tax_records(id,user_id,tax_year,content,created_by) VALUES($1,$2,$3,$4::jsonb,$5)',[input.idempotencyKey,input.userId,input.taxYear,JSON.stringify(content),actor])
      const money=(value:string)=>`${atomic(value,content.decimals)} ${content.currency}`
      const document = await this.enqueue(tx,input.userId,'tax_document',input.idempotencyKey,[['税年',String(input.taxYear)],['账户持有人',content.accountHolder],['税号',content.taxpayerId],['税务居民地区',content.taxResidency],['税务辖区',content.jurisdiction],['地址',content.taxpayerAddress || '未提供'],['收入口径',content.incomeDescription],['报告币种',content.currency],['金额小数位',String(content.decimals)],['收入总额',money(content.grossAtomic)],['实际预扣税额',money(content.withheldAtomic)],['实际净收入',money((BigInt(content.grossAtomic)-BigInt(content.withheldAtomic)).toString())]],['数据由获授权商务核实录入，不从账本推断税号、税务辖区、税率或预扣税额。','保留原始报告币种与精度，不自动换汇。',`资料凭证 SHA-256：${proof.checksum_sha256}`])
      await this.audit(tx,actor,'document.tax.issued',document.id,{taxYear:input.taxYear})
      return document
    })
  }
  private audit(tx: EntityManager, actor: string, action: string, id: string|null, metadata: object) {
    return tx.query("INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata) VALUES($1,'admin',$2,$3,'generated_document',$4,$5,$6::jsonb)",[randomUUID(),actor,action,id,randomUUID(),JSON.stringify(metadata)])
  }
}
