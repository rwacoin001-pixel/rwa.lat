import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 管理台 × 核心运营域权限（账本对账/调整、审计、审批、工单、作业队列、通知、预测市场同步）：
 * 键名与核心 admin 域的 assertPermission 完全对齐，便于后续按角色细分授权。
 * 授予 super_admin（与既有 admin_role_permissions 种子模式一致）。
 */
export class AdminConsoleCoreOpsPermissions1789724000000 implements MigrationInterface {
  name = 'AdminConsoleCoreOpsPermissions1789724000000'

  private readonly permissions = [
    'ledger.reconciliation.manage',
    'ledger.adjustments.manage',
    'ledger.adjustments.post',
    'audit.read',
    'approvals.manage',
    'support.tickets.manage',
    'operations.jobs.manage',
    'notifications.manage',
    'polymarket.manage',
    'core.console.view',
  ]

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO app.admin_role_permissions (role_id, permission)
       SELECT id, permission
         FROM app.admin_roles
         CROSS JOIN unnest($1::text[]) AS permissions(permission)
        WHERE name = 'super_admin'
       ON CONFLICT DO NOTHING;`,
      [this.permissions],
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM app.admin_role_permissions
        WHERE permission = ANY($1::text[])
          AND role_id IN (SELECT id FROM app.admin_roles WHERE name = 'super_admin');`,
      [this.permissions],
    )
  }
}
