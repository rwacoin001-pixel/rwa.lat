import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 扩展账本交易类型枚举：新增预测市场三类流水
 * （下注 / 派彩 / 无效退款）。
 */
const TRANSACTION_TYPES = [
  'deposit',
  'withdrawal_lock',
  'withdrawal_settlement',
  'withdrawal_refund',
  'internal_transfer',
  'order_lock',
  'order_release',
  'investment',
  'fee',
  'yield_accrual',
  'settlement',
  'adjustment',
  'reversal',
  'basket_subscription',
  'basket_redemption',
  'basket_rebalance',
  'prediction_stake',
  'prediction_payout',
  'prediction_void_refund',
]

export class ExtendLedgerTransactionTypesForPrediction1789732000000 implements MigrationInterface {
  name = 'ExtendLedgerTransactionTypesForPrediction1789732000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const list = TRANSACTION_TYPES.map((t) => `'${t}'`).join(', ')
    await queryRunner.query(`ALTER TABLE app.ledger_transactions DROP CONSTRAINT ledger_transactions_transaction_type_check`)
    await queryRunner.query(
      `ALTER TABLE app.ledger_transactions ADD CONSTRAINT ledger_transactions_transaction_type_check
       CHECK (transaction_type = ANY (ARRAY[${list}]::text[]))`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const list = TRANSACTION_TYPES.slice(0, 16).map((t) => `'${t}'`).join(', ')
    await queryRunner.query(`ALTER TABLE app.ledger_transactions DROP CONSTRAINT ledger_transactions_transaction_type_check`)
    await queryRunner.query(
      `ALTER TABLE app.ledger_transactions ADD CONSTRAINT ledger_transactions_transaction_type_check
       CHECK (transaction_type = ANY (ARRAY[${list}]::text[]))`,
    )
  }
}
