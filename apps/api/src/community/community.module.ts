import { PredictionDiscussionController } from './prediction-discussion.controller'
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
import { NotificationModule } from '../notification/notification.module'
import { CommunityDmController } from './community-dm.controller'
import { CommunityDmService } from './community-dm.service'
import { CommunityReportAuthGuard } from './community-report-auth.guard'

@Module({
  imports: [
    SecurityModule, AdminRbacModule, ObjectStorageModule, NotificationModule,
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
  controllers: [PredictionDiscussionController, CommunityController, InternalCommunityController, CommunityMemberController, AdminCommunityMemberController, CommunityMediaController, CommunityDmController],
  providers: [CommunityService, InternalServiceGuard, CommunityTranslationProvider, CommunityMemberService, CommunityDmService, CommunityReportAuthGuard],
  exports: [CommunityService],
})
export class CommunityModule {}
