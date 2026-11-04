import { Module } from '@nestjs/common'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { ObjectStorageCoreModule } from './object-storage-core.module'
import { ObjectStorageCallbackController, ObjectStorageController, UserObjectStorageController } from './object-storage.controller'
import { ObjectScanCallbackVerifier } from './object-scan-callback.verifier'
import { SecurityModule } from '../security/security.module'

@Module({
  imports: [ObjectStorageCoreModule, AdminRbacModule, SecurityModule],
  controllers: [ObjectStorageController, ObjectStorageCallbackController, UserObjectStorageController],
  providers: [ObjectScanCallbackVerifier],
  exports: [ObjectStorageCoreModule],
})
export class ObjectStorageModule {}
