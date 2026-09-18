import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 管理台新增页面权限（Basket 运营页 + C1.5 审核台）：
 * - basket.operations.manage   → /v1/admin/basket/*（策略/组合/NAV/调仓/对账代理）
 * - community.content.review   → /v1/admin/community/*（内容审核队列/举报/统计代理）
 * 授予 super_admin（与既有 admin_role_permissions 种子模式一致）。
 */
export class AdminConsolePermissions1789723000000 implements MigrationInterface {
  name = 'AdminConsolePermissions1789723000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO app.admin_role_permissions (role_id, permission)
      SELECT id, permission
        FROM app.admin_roles
        CROSS JOIN (VALUES ('basket.operations.manage'), ('community.content.review')) AS permissions(permission)
       WHERE name = 'super_admin'
      ON CONFLICT DO NOTHING;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM app.admin_role_permissions
       WHERE permission IN ('basket.operations.manage', 'community.content.review')
         AND role_id IN (SELECT id FROM app.admin_roles WHERE name = 'super_admin');
    `)
  }
}
