import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import {
  CommunityComment,
  CommunityFollow,
  CommunityLike,
  CommunityPost,
  CommunityProfile,
  CommunityQueueItem,
  CommunityReport,
  CommunityTopic,
  CommunityTranslation,
} from './community.entities'
import { InternalCommunityController } from './community-internal.controller'
import { CommunityController } from './community.controller'
import { CommunityService } from './community.service'
import { CommunityTranslationProvider } from './community.translation'
import { SecurityModule } from '../security/security.module'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { CommunityMemberService } from './community-member.service'
import { CommunityMemberController, AdminCommunityMemberController, CommunityMediaController } from './community-member.controller'
import { ObjectStorageModule } from '../object-storage/object-storage.module'

@Module({
  imports: [
    SecurityModule, AdminRbacModule, ObjectStorageModule,
    TypeOrmModule.forFeature([
      CommunityProfile,
      CommunityPost,
      CommunityComment,
      CommunityLike,
      CommunityFollow,
      CommunityTopic,
      CommunityReport,
      CommunityQueueItem,
      CommunityTranslation,
    ]),
  ],
  controllers: [CommunityController, InternalCommunityController, CommunityMemberController, AdminCommunityMemberController, CommunityMediaController],
  providers: [CommunityService, InternalServiceGuard, CommunityTranslationProvider, CommunityMemberService],
  exports: [CommunityService],
})
export class CommunityModule {}
