import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { ObjectStorageModule } from '../object-storage/object-storage.module'
import { GeneratedDocumentsService } from './generated-documents.service'
import { GeneratedDocumentsController, AdminDocumentTemplatesController } from './generated-documents.controller'
import { DocumentPdfRenderer } from './document-pdf.renderer'
import { DocumentGenerationWorker } from './document-generation.worker'
@Module({imports:[SecurityModule,AdminRbacModule,ObjectStorageModule],controllers:[GeneratedDocumentsController,AdminDocumentTemplatesController],providers:[GeneratedDocumentsService,DocumentPdfRenderer,DocumentGenerationWorker],exports:[GeneratedDocumentsService]})
export class GeneratedDocumentsModule {}
