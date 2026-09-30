import { MigrationInterface, QueryRunner } from 'typeorm'

export class PolymarketTranslations1790000000024 implements MigrationInterface {
  name = 'PolymarketTranslations1790000000024'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.polymarket_translations (
        market_id varchar(120) NOT NULL,
        locale varchar(8) NOT NULL,
        field varchar(16) NOT NULL CHECK (field IN ('summary', 'rules')),
        source_hash char(64) NOT NULL,
        content jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (market_id, locale, field, source_hash)
      )
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS app.polymarket_translations')
  }
}
