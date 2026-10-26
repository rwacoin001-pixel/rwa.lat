import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Notification } from './notification.entity'
import { Ticket } from './ticket.entity'
import { TicketMessage } from './ticket-message.entity'
import { TicketEvent } from './ticket-event.entity'
import { Invitation } from './invitation.entity'
import { Subscription } from './subscription.entity'
import { Fee } from './fee.entity'
import { Reward } from './reward.entity'
import { Preference } from './preference.entity'
import { NotificationService } from './notification.service'
import { AdminNotificationController, NotificationController } from './notification.controller'
import { UserOpsService } from './user-ops.service'
import { AdminSupportController, UserOpsController } from './user-ops.controller'
import { SecurityModule } from '../security/security.module'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { ObjectStorageModule } from '../object-storage/object-storage.module'
import { IdentityModule } from '../identity/identity.module'
import { JobQueueModule } from '../job-queue/job-queue.module'
import { NotificationDeliveryService } from './notification-delivery.service'
import { NotificationFeedWorker } from './notification-feed.worker'
import { AccountClosureService } from './account-closure.service'
import { AccountClosureController, AdminAccountClosureController } from './account-closure.controller'

const models = [Notification, Ticket, TicketMessage, TicketEvent, Invitation, Subscription, Fee, Reward, Preference]

@Module({
  imports: [TypeOrmModule.forFeature(models), SecurityModule, AdminRbacModule, ObjectStorageModule, IdentityModule, JobQueueModule],
  controllers: [NotificationController, AdminNotificationController, UserOpsController, AdminSupportController, AccountClosureController, AdminAccountClosureController],
  providers: [NotificationService, UserOpsService, NotificationDeliveryService, AccountClosureService, NotificationFeedWorker],
  exports: [NotificationService, UserOpsService, NotificationDeliveryService],
})
export class NotificationModule {}
