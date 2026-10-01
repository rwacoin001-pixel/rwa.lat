import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { ObjectStorageService } from '../object-storage/object-storage.service'
import { DocumentPdfRenderer } from './document-pdf.renderer'
import { GeneratedDocumentsService } from './generated-documents.service'

@Injectable()
export class DocumentGenerationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(DocumentGenerationWorker.name)
  private timer?: ReturnType<typeof setInterval>
  private busy = false
  private monthlyCheckedAt = 0
  constructor(private readonly db: DataSource, private readonly renderer: DocumentPdfRenderer,
    private readonly storage: ObjectStorageService, private readonly config: ConfigService,
    private readonly documents: GeneratedDocumentsService) {}
  onModuleInit() {
    if(this.config.get<string>('APP_ENV')==='test' || this.config.get<string>('DOCUMENT_GENERATION_WORKER_ENABLED')==='false' || !this.renderer.available || this.config.get<string>('OBJECT_STORAGE_ENABLED')!=='true') return
    this.timer=setInterval(()=>void this.tick(),5000);this.timer.unref()
  }
  onModuleDestroy() { if(this.timer) clearInterval(this.timer) }
  async tick() {
    if(this.busy) return
    this.busy=true
    try {
      if(Date.now()-this.monthlyCheckedAt>60_000){this.monthlyCheckedAt=Date.now();await this.documents.queueMonthlyStatements()}
      await this.db.query("UPDATE app.generated_documents SET state='failed',error_code='PDF_GENERATION_INTERRUPTED',lease_token=NULL,lease_until=NULL WHERE state='rendering' AND lease_until<now() AND attempts>=3")
      const lease=randomUUID()
      const [row]=await this.db.query(`WITH candidate AS (SELECT id FROM app.generated_documents WHERE attempts<3 AND (state='queued' OR (state IN ('rendering','failed') AND lease_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1), claimed AS (UPDATE app.generated_documents d SET state='rendering',attempts=attempts+1,lease_token=$1,lease_until=now()+interval '2 minutes',error_code=NULL FROM candidate c WHERE d.id=c.id RETURNING d.id,d.user_id,d.snapshot) SELECT * FROM claimed`,[lease])
      if(!row) return
      try {
        const bytes=await this.renderer.render(row.snapshot)
        const stored=await this.storage.storeGeneratedPdf(row.user_id,row.id,bytes)
        await this.db.query("UPDATE app.generated_documents SET state='ready',object_id=$3,sha256=$4,generated_at=now(),lease_token=NULL,lease_until=NULL WHERE id=$1 AND state='rendering' AND lease_token=$2",[row.id,lease,stored.objectId,stored.checksumSha256])
      } catch {
        await this.db.query("UPDATE app.generated_documents SET state='failed',error_code='PDF_GENERATION_FAILED',lease_token=NULL,lease_until=now()+interval '1 minute' WHERE id=$1 AND state='rendering' AND lease_token=$2",[row.id,lease])
        this.log.warn('PDF generation failed; private source content and renderer errors are omitted.')
      }
    } catch { this.log.warn('Document queue unavailable; no source records were logged.') }
    finally { this.busy=false }
  }
}
