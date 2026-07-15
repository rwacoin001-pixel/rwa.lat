import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { ObjectStorageObject, PresignedUrl } from './object-storage.entities'
import { ObjectStorageService } from './object-storage.service'
import { ObjectStorageCallbackController, ObjectStorageController, UserObjectStorageController } from './object-storage.controller'
import { ObjectScanCallbackVerifier } from './object-scan-callback.verifier'
import { SecurityModule } from '../security/security.module'

@Module({
  imports: [TypeOrmModule.forFeature([ObjectStorageObject, PresignedUrl]), AdminRbacModule, SecurityModule],
  controllers: [ObjectStorageController, ObjectStorageCallbackController, UserObjectStorageController],
  providers: [ObjectStorageService, ObjectScanCallbackVerifier],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule {}
