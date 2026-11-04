import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ObjectStorageObject, PresignedUrl } from './object-storage.entities'
import { ObjectStorageService } from './object-storage.service'

/** Storage providers without HTTP/auth imports (identity itself depends on referrals). */
@Module({
  imports: [TypeOrmModule.forFeature([ObjectStorageObject, PresignedUrl])],
  providers: [ObjectStorageService],
  exports: [ObjectStorageService],
})
export class ObjectStorageCoreModule {}
