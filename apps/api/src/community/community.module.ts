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

@Module({
  imports: [
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
  controllers: [CommunityController, InternalCommunityController],
  providers: [CommunityService, InternalServiceGuard, CommunityTranslationProvider],
  exports: [CommunityService],
})
export class CommunityModule {}
