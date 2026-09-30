import { GUARDS_METADATA } from '@nestjs/common/constants'
import { AdminSessionGuard } from '../src/admin-rbac/admin-session.guard'
import { AdminRbacController } from '../src/admin-rbac/admin-rbac.controller'
import { ComplianceController } from '../src/compliance/compliance.controller'
import { JobQueueAdminController } from '../src/job-queue/job-queue.controller'
import { AdminNotificationController, NotificationController } from '../src/notification/notification.controller'
import { UserOpsController } from '../src/notification/user-ops.controller'
import { AdminSupportController } from '../src/notification/user-ops.controller'
import { AlertingController } from '../src/observability/alerting/alerting.controller'
import { MetricsAccessGuard } from '../src/observability/metrics-access.guard'
import { MetricsController } from '../src/observability/metrics.controller'
import { ObjectStorageController, UserObjectStorageController } from '../src/object-storage/object-storage.controller'
import { PortfolioController } from '../src/portfolio/portfolio.controller'
import { SessionAuthGuard } from '../src/security/session-auth.guard'
import { DataGovernanceController } from '../src/data-governance/data-governance.controller'
import { AdminWalletController } from '../src/wallet/wallet.controller'
import { AdminLedgerController } from '../src/ledger/ledger.controller'
import { AdminContentController } from '../src/content/content.controller'
import { CommunityMemberController, AdminCommunityMemberController } from '../src/community/community-member.controller'
import { AiPlanningController } from '../src/ai/ai-planning.controller'
import { AccountClosureController, AdminAccountClosureController } from '../src/notification/account-closure.controller'
import { GeneratedDocumentsController, AdminDocumentTemplatesController } from '../src/generated-documents/generated-documents.controller'
import { PublicShareController } from '../src/sharing/public-share.controller'

function classGuards(target: object): unknown[] {
  return Reflect.getMetadata(GUARDS_METADATA, target) ?? []
}

function methodGuards(target: object, method: string): unknown[] {
  const handler = (target as Record<string, object>)[method]
  return Reflect.getMetadata(GUARDS_METADATA, handler) ?? []
}

describe('production route guard contract', () => {
  it.each([PortfolioController, NotificationController, UserOpsController, UserObjectStorageController, CommunityMemberController, AiPlanningController, AccountClosureController, GeneratedDocumentsController])(
    'derives end-user identity from SessionAuthGuard on %p',
    (controller) => expect(classGuards(controller)).toContain(SessionAuthGuard),
  )

  it.each([
    JobQueueAdminController,
    AdminNotificationController,
    AlertingController,
    AdminRbacController,
    ObjectStorageController,
    DataGovernanceController,
    AdminSupportController,
    AdminWalletController,
    AdminLedgerController,
    AdminContentController,
    AdminCommunityMemberController,
    AdminAccountClosureController,
    AdminDocumentTemplatesController,
  ])(
    'protects operational controller %p with AdminSessionGuard',
    (controller) => expect(classGuards(controller)).toContain(AdminSessionGuard),
  )

  it.each(['decideKyc', 'openRiskFlag', 'resolveRiskFlag'])(
    'protects ComplianceController.%s with AdminSessionGuard',
    (method) => expect(methodGuards(ComplianceController.prototype, method)).toContain(AdminSessionGuard),
  )

  it('protects Prometheus metrics with the dedicated bearer guard', () => {
    expect(classGuards(MetricsController)).toContain(MetricsAccessGuard)
  })
  it.each(['create','revoke','list'])('requires a user session for PublicShareController.%s',method=>{
    expect(methodGuards(PublicShareController.prototype,method)).toContain(SessionAuthGuard)
  })
})
