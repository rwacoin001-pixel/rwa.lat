import type { MigrationInterface, QueryRunner } from 'typeorm'
import { shouldApplyDemoSeed } from '../demo-seed-policy'

/**
 * Removes deployment-key-independent wallet address placeholders from the
 * first Demo seed and aligns untouched Demo ledger accounts with WalletService.
 */
export class RepairDemoWalletSeed1783783000000 implements MigrationInterface {
  name = 'RepairDemoWalletSeed1783783000000'

  private readonly demoUserId = '22222222-2222-2222-2222-222222222222'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!shouldApplyDemoSeed(process.env)) return
    await queryRunner.query(
      `DELETE FROM app.wallet_addresses address
       WHERE address.user_id = $1
         AND address.asset_code = 'USD'
         AND NOT EXISTS (
           SELECT 1 FROM app.deposits deposit WHERE deposit.wallet_address_id = address.id
         )`,
      [this.demoUserId],
    )

    await queryRunner.query(
      `UPDATE app.ledger_accounts account
       SET asset_code = 'USDT',
           normal_side = CASE
             WHEN account.purpose = 'invested_cost' THEN 'debit'
             ELSE 'credit'
           END
       WHERE account.user_id = $1
         AND account.asset_code = 'USD'
         AND NOT EXISTS (
           SELECT 1 FROM app.ledger_entries entry WHERE entry.account_id = account.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM app.ledger_accounts existing
           WHERE existing.user_id = account.user_id
             AND existing.purpose = account.purpose
             AND existing.asset_code = 'USDT'
             AND existing.network IS NOT DISTINCT FROM account.network
         )`,
      [this.demoUserId],
    )
  }

  async down(): Promise<void> {
    // Do not rewrite Demo balances that may have been created after this migration.
  }
}
