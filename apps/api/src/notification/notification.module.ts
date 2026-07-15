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

const models = [Notification, Ticket, TicketMessage, TicketEvent, Invitation, Subscription, Fee, Reward, Preference]

@Module({
  imports: [TypeOrmModule.forFeature(models), SecurityModule, AdminRbacModule, ObjectStorageModule],
  controllers: [NotificationController, AdminNotificationController, UserOpsController, AdminSupportController],
  providers: [NotificationService, UserOpsService],
  exports: [NotificationService, UserOpsService],
})
export class NotificationModule {}
