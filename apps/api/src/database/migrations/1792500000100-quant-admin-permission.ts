import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Console access for Koala Quant operations (/v1/admin/quant/*), granted to super_admin like the other console permissions. */
export class QuantAdminPermission1792500000100 implements MigrationInterface {
  name = 'QuantAdminPermission1792500000100'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO app.admin_role_permissions (role_id, permission)
      SELECT id, 'quant.operations.manage' FROM app.admin_roles WHERE name = 'super_admin'
      ON CONFLICT DO NOTHING
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM app.admin_role_permissions WHERE permission = 'quant.operations.manage'`)
  }
}
