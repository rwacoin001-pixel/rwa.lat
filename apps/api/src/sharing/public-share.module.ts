import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { PublicShareController } from './public-share.controller'
import { PublicShareService } from './public-share.service'
import { ObjectStorageModule } from '../object-storage/object-storage.module'
@Module({imports:[SecurityModule,ObjectStorageModule],controllers:[PublicShareController],providers:[PublicShareService]})
export class PublicShareModule {}
