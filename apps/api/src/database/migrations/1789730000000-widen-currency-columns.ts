import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 币种列扩展：varchar(3) → varchar(10)
 * 支持 USDT/USDC 等 >3 字符币种（USD 等 3 字符仍合法）。
 * 涉及四表：price_quotes / price_snapshots / fees / rewards（schema: app）。
 */
export class WidenCurrencyColumns1789730000000 implements MigrationInterface {
  name = 'WidenCurrencyColumns1789730000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE app.price_quotes ALTER COLUMN currency TYPE varchar(10)`)
    await queryRunner.query(`ALTER TABLE app.price_snapshots ALTER COLUMN currency TYPE varchar(10)`)
    await queryRunner.query(`ALTER TABLE app.fees ALTER COLUMN currency TYPE varchar(10)`)
    await queryRunner.query(`ALTER TABLE app.rewards ALTER COLUMN currency TYPE varchar(10)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 注意：若已存在 >3 字符币种数据，回退将失败（需先清理数据）
    await queryRunner.query(`ALTER TABLE app.rewards ALTER COLUMN currency TYPE varchar(3)`)
    await queryRunner.query(`ALTER TABLE app.fees ALTER COLUMN currency TYPE varchar(3)`)
    await queryRunner.query(`ALTER TABLE app.price_snapshots ALTER COLUMN currency TYPE varchar(3)`)
    await queryRunner.query(`ALTER TABLE app.price_quotes ALTER COLUMN currency TYPE varchar(3)`)
  }
}
