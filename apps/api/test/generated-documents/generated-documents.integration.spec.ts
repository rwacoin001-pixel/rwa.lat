import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { GeneratedDocumentsService } from '../../src/generated-documents/generated-documents.service'
import { atomic, DEFAULT_TEMPLATES, documentHtml } from '../../src/generated-documents/document-model'
import { ObjectStorageService } from '../../src/object-storage/object-storage.service'
import { GeneratedDocuments1790000000019 } from '../../src/database/migrations/1790000000019-generated-documents'

describe('Formal document renderer input boundaries',()=>{
  it('escapes editable text and keeps atomic values exact',()=>{
    expect(atomic('9007199254740993000001')).toBe('9007199254740993.000001')
    expect(atomic('-1')).toBe('-0.000001')
    const html=documentHtml({kind:'agreement',company:{companyName:'<script>bad()</script>',registration:'',contact:'',website:''},companyRevision:1,template:{title:'T',introduction:'',terms:['<img src="http://secret/">'],enabled:true},templateRevision:1,documentNo:'AGR-test',userId:'test',generatedAt:'2026-09-27',fields:[],notes:[]})
    expect(html).not.toContain('<script>');expect(html).not.toContain('<img');expect(html).toContain('&lt;script&gt;')
  })
})
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip
suite('Formal documents with isolated PostgreSQL',()=>{
  let db:DataSource,runner:QueryRunner,docs:GeneratedDocumentsService,user:string,other:string,admin:string,proof:string
  const download=jest.fn()
  beforeAll(async()=>{
    const url=new URL(process.env.TEST_DATABASE_URL!)
    if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw new Error('Dedicated local test database required')
    db=new DataSource(buildDatabaseOptions({...process.env,NODE_ENV:'test'}));await db.initialize()
    if(!(await db.query('SELECT current_database() AS name'))[0].name.endsWith('_test'))throw new Error('Database is not isolated')
  })
  beforeEach(async()=>{
    runner=db.createQueryRunner();await runner.connect();await runner.startTransaction();user=randomUUID();other=randomUUID();admin=randomUUID();proof=`tax-${randomUUID()}.pdf`
    const [existing] = await runner.query("SELECT to_regclass('app.generated_documents') AS name")
    if (!existing.name) await new GeneratedDocuments1790000000019().up(runner)
    await runner.query('INSERT INTO app.users(id) VALUES($1),($2)',[user,other])
    await runner.query("INSERT INTO app.object_storage_objects(bucket,key,content_type,size_bytes,expected_size_bytes,checksum_sha256,scan_status,uploaded_by) VALUES('rwa-attachments',$1,'application/pdf',100,100,$2,'clean',$3)",[proof,'a'.repeat(64),admin])
    const proxy={query:(sql:string,args:unknown[])=>runner.query(sql,args),transaction:async (...args:any[])=>args.at(-1)(runner.manager)} as unknown as DataSource
    download.mockReset();download.mockResolvedValue({presignedUrl:'https://private.invalid/download'})
    docs=new GeneratedDocumentsService(proxy,{createDownloadPresignedUrl:download} as unknown as ObjectStorageService)
  })
  afterEach(async()=>{await runner.rollbackTransaction();await runner.release()})
  afterAll(async()=>{if(db?.isInitialized)await db.destroy()})
  async function enableAgreement(){await docs.saveCompany({expectedRevision:1,companyName:'rwa.lat',registration:'Verified company record',contact:'',website:'https://rwa.lat'},admin);return docs.saveTemplate('agreement',{expectedRevision:1,title:'Real agreement',introduction:'Actual scope',terms:['Provided business terms'],enabled:true},admin)}
  it('retains versions, rejects stale saves, and prevents a blank agreement becoming active',async()=>{
    await expect(docs.saveTemplate('agreement',{...DEFAULT_TEMPLATES.agreement,enabled:true,expectedRevision:1},admin)).rejects.toThrow('正式条款')
    await enableAgreement()
    expect((await docs.versions('agreement')).map((r:{revision:number})=>r.revision)).toEqual([2,1])
    await expect(docs.saveCompany({expectedRevision:1,companyName:'stale',registration:'',contact:'',website:''},admin)).rejects.toThrow('变化')
    expect((await docs.restore('agreement',1,2,admin)).revision).toBe(3)
    expect((await docs.configuration()).templates.find((r:{kind:string})=>r.kind==='agreement').content.enabled).toBe(false)
  })
  it('archives exactly the version the user confirmed and never changes the archive after edits',async()=>{
    await enableAgreement()
    await expect(docs.consent(user,{accepted:true,templateRevision:1,companyRevision:2})).rejects.toThrow('重新阅读')
    const input={accepted:true as const,templateRevision:2,companyRevision:2}
    const accepted=await docs.consent(user,input)
    expect((await docs.consent(user,input)).id).toBe(accepted.id)
    await docs.saveTemplate('agreement',{...DEFAULT_TEMPLATES.agreement,title:'Changed',introduction:'New scope',terms:['New terms'],enabled:true,expectedRevision:2},admin)
    const [archived]=await runner.query('SELECT snapshot FROM app.generated_documents WHERE id=$1',[accepted.id])
    expect(archived.snapshot.template.title).toBe('Real agreement');expect(archived.snapshot.templateRevision).toBe(2)
    expect((await runner.query('SELECT count(*)::int AS n FROM app.document_agreement_consents WHERE user_id=$1',[user]))[0].n).toBe(1)
  })
  it('requires verified tax data, preserves exact net amounts, and replays one issuance intent',async()=>{
    const input={idempotencyKey:randomUUID(),userId:user,taxYear:2025,accountHolder:'Verified name',taxpayerId:'Verified tax id',taxResidency:'Verified region',jurisdiction:'Verified jurisdiction',taxpayerAddress:'',currency:'USDT',decimals:6,grossAtomic:'9007199254740993000001',withheldAtomic:'1',incomeDescription:'Verified income',evidenceRef:`rwa-attachments/${proof}`,verified:true as const}
    await expect(docs.tax({...input,withheldAtomic:'99999999999999999999999999999'},admin)).rejects.toThrow('不能超过')
    const document=await docs.tax(input,admin)
    expect((await docs.tax(input,admin)).id).toBe(document.id)
    await expect(docs.tax({...input,taxpayerId:'Changed tax id'},admin)).rejects.toThrow('不同税务资料')
    const [row]=await runner.query('SELECT snapshot FROM app.generated_documents WHERE id=$1',[document.id])
    expect(row.snapshot.fields).toContainEqual(['实际净收入','9007199254740993.000000 USDT'])
    await runner.query("UPDATE app.object_storage_objects SET scan_status='pending' WHERE key=$1",[proof])
    await expect(docs.tax({...input,idempotencyKey:randomUUID()},admin)).rejects.toThrow('扫描')
  })
  it('preserves original report currency and precision without an exchange-rate calculation',async()=>{
    const input={idempotencyKey:randomUUID(),userId:user,taxYear:2025,accountHolder:'Verified name',taxpayerId:'Verified id',taxResidency:'Verified region',jurisdiction:'Verified jurisdiction',taxpayerAddress:'',currency:'USD',decimals:2,grossAtomic:'100001',withheldAtomic:'501',incomeDescription:'Verified USD income',evidenceRef:`rwa-attachments/${proof}`,verified:true as const}
    const doc=await docs.tax(input,admin)
    const [row]=await runner.query('SELECT snapshot FROM app.generated_documents WHERE id=$1',[doc.id])
    expect(row.snapshot.fields).toContainEqual(['收入总额','1000.01 USD'])
    expect(row.snapshot.fields).toContainEqual(['实际净收入','995.00 USD'])
    await expect(docs.tax({...input,currency:'USDT'},admin)).rejects.toThrow('不同税务资料')
    await expect(docs.tax({...input,decimals:6},admin)).rejects.toThrow('不同税务资料')
  })
  it('scopes list and downloads to the owner, leaving scan enforcement in the storage service',async()=>{
    await enableAgreement();const doc=await docs.consent(user,{accepted:true,templateRevision:2,companyRevision:2})
    const [object]=await runner.query("SELECT id FROM app.object_storage_objects WHERE key=$1",[proof])
    await runner.query("UPDATE app.object_storage_objects SET uploaded_by=$2,scan_status='pending' WHERE id=$1",[object.id,user])
    await runner.query("UPDATE app.generated_documents SET state='ready',object_id=$2 WHERE id=$1",[doc.id,object.id])
    expect(await docs.list(other)).toEqual([])
    await expect(docs.download(other,doc.id)).rejects.toThrow('不存在')
    expect(download).not.toHaveBeenCalled()
    await docs.download(user,doc.id)
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ownerId:user,createdBy:user,bucket:'rwa-attachments'}))
  })
  it('creates a stable empty past-month statement but rejects an incomplete or invalid month',async()=>{
    const first=await docs.statement(user,'2025-01')
    expect((await docs.statement(user,'2025-01')).id).toBe(first.id)
    const [row]=await runner.query('SELECT snapshot FROM app.generated_documents WHERE id=$1',[first.id])
    expect(row.snapshot.fields).toContainEqual(['期末现金余额','0.000000 USDT'])
    await expect(docs.statement(user,'2099-01')).rejects.toThrow('已结束')
    await expect(docs.statement(user,'2025-13')).rejects.toThrow('格式')
    await runner.query("UPDATE app.users SET status='closed',closed_at=now() WHERE id=$1",[user])
    await expect(docs.statement(user,'2025-02')).rejects.toThrow('当前账户')
    expect(await docs.list(other)).toEqual([])
  })
  it('sums the full cash ledger exactly without counting internal locks as an outflow',async()=>{
    const [cash]=await runner.query("INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES('user',$1,'available','USDT',6,'credit') RETURNING id",[user])
    const [locked]=await runner.query("INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES('user',$1,'locked','USDT',6,'credit') RETURNING id",[user])
    const [platform]=await runner.query("INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side,allow_negative) VALUES('platform',$1,'settlement','USDT',6,'credit',true) RETURNING id",[randomUUID()])
    async function transfer(from:string,to:string,amount:string,at:string){
      const [tx]=await runner.query("INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,effective_at) VALUES('deposit',$1,$1,'document-test',$2,'service',$3) RETURNING id",[randomUUID(),randomUUID(),at])
      await runner.query("INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'debit',$4),($1,$3,'credit',$4)",[tx.id,from,to,amount])
    }
    await transfer(platform.id,cash.id,'9007199254740993000001','2024-12-01T00:00:00Z')
    await transfer(platform.id,cash.id,'1','2025-01-15T00:00:00Z')
    await transfer(cash.id,locked.id,'2000000','2025-01-16T00:00:00Z')
    const doc=await docs.statement(user,'2025-01')
    const [row]=await runner.query('SELECT snapshot FROM app.generated_documents WHERE id=$1',[doc.id])
    expect(row.snapshot.fields).toContainEqual(['期初现金余额','9007199254740993.000001 USDT'])
    expect(row.snapshot.fields).toContainEqual(['期末现金余额','9007199254740993.000002 USDT'])
    expect(row.snapshot.fields).toContainEqual(['本期现金净变化','0.000001 USDT'])
    expect(row.snapshot.rows[1][2]).toBe('0.000000')
  })
})
