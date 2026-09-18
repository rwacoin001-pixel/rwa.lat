import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Basket ↔ Ledger 支撑（Phase 10）：
 * - ledger_accounts.purpose 增加 'basket_settlement'（每组合一个结算账户，复用现有账本体系）
 * - ledger_transactions.transaction_type 增加 basket_subscription / basket_redemption / basket_rebalance
 * 注意：down() 回退时用 NOT VALID 重建原始约束——账本是 append-only（条目不可删），
 * 演示/测试库里可能已存在 basket 类型分录；NOT VALID 只豁免历史行，新写入仍受约束。
 */
export class BasketLedgerSupport1789722000000 implements MigrationInterface {
  name = 'BasketLedgerSupport1789722000000'

  private readonly originalPurposeCheck = `purpose IN (
    'available', 'locked', 'pending', 'settlement', 'fee_revenue',
    'reward_payable', 'invested_cost', 'custody_difference'
  )`

  private readonly basketPurposeCheck = `purpose IN (
    'available', 'locked', 'pending', 'settlement', 'fee_revenue',
    'reward_payable', 'invested_cost', 'custody_difference', 'basket_settlement'
  )`

  private readonly originalTypeCheck = `transaction_type IN (
    'deposit', 'withdrawal_lock', 'withdrawal_settlement', 'withdrawal_refund',
    'internal_transfer', 'order_lock', 'order_release', 'investment', 'fee',
    'yield_accrual', 'settlement', 'adjustment', 'reversal'
  )`

  private readonly basketTypeCheck = `transaction_type IN (
    'deposit', 'withdrawal_lock', 'withdrawal_settlement', 'withdrawal_refund',
    'internal_transfer', 'order_lock', 'order_release', 'investment', 'fee',
    'yield_accrual', 'settlement', 'adjustment', 'reversal',
    'basket_subscription', 'basket_redemption', 'basket_rebalance'
  )`

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.ledger_accounts DROP CONSTRAINT IF EXISTS ledger_accounts_purpose_check;
      ALTER TABLE app.ledger_accounts ADD CONSTRAINT ledger_accounts_purpose_check CHECK (${this.basketPurposeCheck});

      ALTER TABLE app.ledger_transactions DROP CONSTRAINT IF EXISTS ledger_transactions_transaction_type_check;
      ALTER TABLE app.ledger_transactions ADD CONSTRAINT ledger_transactions_transaction_type_check CHECK (${this.basketTypeCheck});
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.ledger_accounts DROP CONSTRAINT IF EXISTS ledger_accounts_purpose_check;
      ALTER TABLE app.ledger_accounts ADD CONSTRAINT ledger_accounts_purpose_check CHECK (${this.originalPurposeCheck}) NOT VALID;

      ALTER TABLE app.ledger_transactions DROP CONSTRAINT IF EXISTS ledger_transactions_transaction_type_check;
      ALTER TABLE app.ledger_transactions ADD CONSTRAINT ledger_transactions_transaction_type_check CHECK (${this.originalTypeCheck}) NOT VALID;
    `)
  }
}
