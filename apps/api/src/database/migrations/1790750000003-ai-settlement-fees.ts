import { MigrationInterface, QueryRunner } from 'typeorm'
export class AiSettlementFees1790750000003 implements MigrationInterface {
  name='AiSettlementFees1790750000003'
  async up(q:QueryRunner):Promise<void>{await q.query(`ALTER TABLE app.manual_trade_settlements ADD COLUMN fee_atomic numeric(78,0),
    ADD CONSTRAINT manual_settlement_fee_valid CHECK(fee_atomic IS NULL OR (fee_atomic>=0 AND (kind='redemption' OR fee_atomic<=amount_atomic)));
    COMMENT ON COLUMN app.manual_trade_settlements.fee_atomic IS 'Recorded fee only: buy amount is all-in cost; redemption amount is settled net proceeds. Never debit the fee a second time. NULL means unverified, not zero.'`)}
  async down(q:QueryRunner):Promise<void>{
    const [row]=await q.query(`SELECT EXISTS(SELECT 1 FROM app.manual_trade_settlements WHERE fee_atomic IS NOT NULL) AS used`)
    if(row.used)throw new Error('Cannot remove recorded fees; use a forward repair migration')
    await q.query(`ALTER TABLE app.manual_trade_settlements DROP CONSTRAINT manual_settlement_fee_valid,DROP COLUMN fee_atomic`)
  }
}
