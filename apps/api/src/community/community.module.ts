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
} from './community.entities'
import { InternalCommunityController } from './community-internal.controller'
import { CommunityController } from './community.controller'
import { CommunityService } from './community.service'

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
    ]),
  ],
  controllers: [CommunityController, InternalCommunityController],
  providers: [CommunityService, InternalServiceGuard],
  exports: [CommunityService],
})
export class CommunityModule {}
