import { Module } from '@nestjs/common'
import { ObjectStorageModule } from '../object-storage/object-storage.module'
import { PlatformService } from './platform.service'
import { PlatformController } from './platform.controller'

@Module({ imports: [ObjectStorageModule], controllers: [PlatformController], providers: [PlatformService], exports: [PlatformService] })
export class PlatformModule {}
