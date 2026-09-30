import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateManualTradeSettlements1790000000012 implements MigrationInterface {
  name = 'CreateManualTradeSettlements1790000000012'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE app.manual_trade_settlements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind text NOT NULL CHECK (kind IN ('order', 'redemption')),
        reference_id uuid NOT NULL,
        external_reference varchar(160) NOT NULL UNIQUE,
        evidence_ref text NOT NULL,
        evidence_hash text NOT NULL,
        amount_atomic app.atomic_unit_amount NOT NULL CHECK (amount_atomic > 0),
        quantity_atomic app.atomic_unit_amount NOT NULL CHECK (quantity_atomic > 0),
        posted_by uuid NOT NULL,
        posted_at timestamptz NOT NULL DEFAULT now(),
        review_state text NOT NULL DEFAULT 'pending' CHECK (review_state IN ('pending','verified','exception')),
        reviewed_by uuid,
        reviewed_at timestamptz,
        review_note text,
        UNIQUE (kind, reference_id)
      );
      INSERT INTO app.admin_role_permissions (role_id, permission)
        SELECT id, permission FROM app.admin_roles
        CROSS JOIN (VALUES ('orders.settlement.post'), ('orders.settlement.review')) p(permission)
        WHERE name = 'super_admin' ON CONFLICT DO NOTHING;
    `)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM app.admin_role_permissions WHERE permission IN ('orders.settlement.post', 'orders.settlement.review'); DROP TABLE app.manual_trade_settlements;`)
  }
}
