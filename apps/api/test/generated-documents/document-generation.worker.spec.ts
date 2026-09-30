import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { ObjectStorageService } from '../../src/object-storage/object-storage.service'
import { DocumentGenerationWorker } from '../../src/generated-documents/document-generation.worker'
import { DocumentPdfRenderer } from '../../src/generated-documents/document-pdf.renderer'
import { GeneratedDocumentsService } from '../../src/generated-documents/generated-documents.service'

describe('Private PDF generation failure and scheduling boundaries', () => {
  const document = { id: 'document-id', user_id: 'owner-id', snapshot: { privateTerms: 'sensitive source content' } }
  let query: jest.Mock, render: jest.Mock, store: jest.Mock, monthly: jest.Mock
  let worker: DocumentGenerationWorker, warning: jest.SpyInstance
  beforeEach(() => {
    query = jest.fn().mockImplementation(async (sql: string) => sql.startsWith('WITH candidate') ? [document] : [])
    render = jest.fn().mockResolvedValue(Buffer.from('%PDF-example'))
    store = jest.fn().mockResolvedValue({ objectId: 'private-object', checksumSha256: 'a'.repeat(64) })
    monthly = jest.fn().mockResolvedValue(undefined)
    warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    worker = new DocumentGenerationWorker({ query } as unknown as DataSource,
      { render, executablePath: 'configured-renderer' } as unknown as DocumentPdfRenderer,
      { storeGeneratedPdf: store } as unknown as ObjectStorageService,
      new ConfigService({ APP_ENV: 'test', OBJECT_STORAGE_ENABLED: 'true' }),
      { queueMonthlyStatements: monthly } as unknown as GeneratedDocumentsService)
  })
  afterEach(() => { worker.onModuleDestroy(); warning.mockRestore() })

  it('fails a renderer job without storing partial content or logging private provider errors', async () => {
    render.mockRejectedValue(new Error('sensitive source content; provider credential'))
    await worker.tick()
    expect(store).not.toHaveBeenCalled()
    expect(query.mock.calls.some(([sql]) => sql.includes("error_code='PDF_GENERATION_FAILED'"))).toBe(true)
    expect(query.mock.calls.some(([sql]) => sql.includes("SET state='ready'"))).toBe(false)
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/sensitive source content|provider credential/)
  })

  it('retains a recoverable failed job when private storage rejects the generated PDF', async () => {
    store.mockRejectedValue(new Error('storage credential and account source'))
    await worker.tick()
    expect(store).toHaveBeenCalledWith(document.user_id, document.id, Buffer.from('%PDF-example'))
    expect(query.mock.calls.some(([sql]) => sql.includes("error_code='PDF_GENERATION_FAILED'"))).toBe(true)
    expect(query.mock.calls.some(([sql]) => sql.includes("SET state='ready'"))).toBe(false)
    expect(JSON.stringify(warning.mock.calls)).not.toContain('storage credential')
  })

  it('does not claim another job while one PDF is still rendering', async () => {
    let release!: (value: Buffer) => void
    render.mockImplementation(() => new Promise<Buffer>(resolve => { release = resolve }))
    const first = worker.tick()
    for (let i = 0; i < 8 && !release; i++) await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
    await worker.tick()
    expect(query.mock.calls.filter(([sql]) => sql.startsWith('WITH candidate'))).toHaveLength(1)
    release(Buffer.from('%PDF-example'))
    await first
    const ready = query.mock.calls.find(([sql]) => sql.includes("SET state='ready'"))
    expect(ready?.[1]).toEqual([document.id, expect.any(String), 'private-object', 'a'.repeat(64)])
  })

  it('releases its busy state after a queue outage so the next tick can recover', async () => {
    query.mockRejectedValueOnce(new Error('temporary database outage'))
    await worker.tick()
    expect(render).not.toHaveBeenCalled()
    await worker.tick()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('does not start background processing in a test environment', () => {
    jest.useFakeTimers()
    try {
      worker.onModuleInit()
      jest.advanceTimersByTime(30_000)
      expect(monthly).not.toHaveBeenCalled()
      expect(query).not.toHaveBeenCalled()
    } finally { jest.useRealTimers() }
  })

  it('continues past a full batch of invalid accounts when scheduling monthly statements', async () => {
    const users=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`)
    const scheduled=new Set<string>()
    const monthlyQuery=jest.fn(async (sql:string, params?:unknown[]) => {
      if(sql.includes('document_templates')) return [{enabled:'true'}]
      const cursor=params?.[1] as string|null
      const eligible=users.filter(id=>!scheduled.has(id))
      return [...eligible.filter(id=>!cursor || id>cursor),...eligible.filter(id=>cursor && id<=cursor)].slice(0,5).map(id=>({id}))
    })
    const service=new GeneratedDocumentsService({query:monthlyQuery} as unknown as DataSource,{} as ObjectStorageService)
    const statement=jest.spyOn(service,'statement').mockImplementation(async userId=>{
      if(userId!==users[5]) throw new Error('Account requires manual verification')
      scheduled.add(userId)
      return {id:'queued-statement'}
    })
    await service.queueMonthlyStatements()
    expect(scheduled.size).toBe(0)
    await service.queueMonthlyStatements()
    expect(scheduled.has(users[5])).toBe(true)
    expect(statement.mock.calls[5][0]).toBe(users[5])
  })
})
