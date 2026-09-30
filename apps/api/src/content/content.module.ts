import { Module } from '@nestjs/common'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { ContentService } from './content.service'
import { AdminContentController, ContentController } from './content.controller'

@Module({ imports: [AdminRbacModule], controllers: [ContentController, AdminContentController], providers: [ContentService] })
export class ContentModule {}
