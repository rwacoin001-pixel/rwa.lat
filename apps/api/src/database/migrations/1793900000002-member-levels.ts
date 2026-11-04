import type { MigrationInterface, QueryRunner } from 'typeorm'

export class MemberLevels1793900000002 implements MigrationInterface {
  name='MemberLevels1793900000002'
  async up(q:QueryRunner):Promise<void> {
    await q.query(`CREATE TABLE app.member_level_settings (
      version int PRIMARY KEY,config jsonb NOT NULL,active boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now(),created_by uuid NULL);
      CREATE UNIQUE INDEX member_level_settings_one_active ON app.member_level_settings(active) WHERE active;
      CREATE TABLE app.member_levels (
        user_id uuid PRIMARY KEY REFERENCES app.users(id),level smallint NOT NULL,score numeric(36,6) NOT NULL,
        components jsonb NOT NULL,grace_until date NULL,computed_at timestamptz NOT NULL);
      CREATE TABLE app.member_level_history (
        id bigserial PRIMARY KEY,user_id uuid NOT NULL REFERENCES app.users(id),from_level smallint NOT NULL,to_level smallint NOT NULL,
        score numeric(36,6) NOT NULL,at timestamptz DEFAULT now());
      CREATE TABLE app.rank_snapshots (
        board text NOT NULL CHECK(board IN ('score','invest','team','invite')),period text NOT NULL CHECK(period IN ('week','month')),
        period_start date NOT NULL,user_id uuid NOT NULL REFERENCES app.users(id),rank int NOT NULL,value numeric(36,6) NOT NULL,
        generated_at timestamptz NOT NULL,PRIMARY KEY(board,period,period_start,user_id));
      CREATE INDEX rank_snapshots_board_rank ON app.rank_snapshots(board,period,period_start,rank);
      ALTER TABLE app.community_profiles ADD COLUMN IF NOT EXISTS hide_from_rank boolean NOT NULL DEFAULT false;`)
    // Freeze the historical seed here; future application defaults must not alter a fresh v1 migration.
    await q.query(`INSERT INTO app.member_level_settings(version,config,active) VALUES(1,'{
      "windows":{"purchaseDays":365,"activeDays":90,"maxDepth":3},
      "coefficients":{"ownDeposits":0.5,"ownPurchases":1,"teamL1Purchases":0.3,"teamL2Purchases":0.15,"teamL3Purchases":0.05,"activeTeamMembers":100,"taskPoints":1},
      "levels":[
        {"index":1,"key":"stardust","threshold":"0","requires":{},"perks":{"draws":0,"predictionFeeDiscountPct":0,"quantFeeDiscountPct":0,"honors":[]}},
        {"index":2,"key":"planet","threshold":"1000","requires":{"firstDeposit":true},"perks":{"draws":1,"predictionFeeDiscountPct":0,"quantFeeDiscountPct":0,"honors":["badge"]}},
        {"index":3,"key":"star","threshold":"10000","requires":{},"perks":{"draws":1,"predictionFeeDiscountPct":10,"quantFeeDiscountPct":0,"honors":["badge"]}},
        {"index":4,"key":"cluster","threshold":"50000","requires":{"directActive":3},"perks":{"draws":2,"predictionFeeDiscountPct":20,"quantFeeDiscountPct":10,"honors":["badge","frame"]}},
        {"index":5,"key":"nebula","threshold":"200000","requires":{"directActive":5},"perks":{"draws":2,"predictionFeeDiscountPct":30,"quantFeeDiscountPct":15,"honors":["badge","frame"]}},
        {"index":6,"key":"galaxy","threshold":"1000000","requires":{"teamActive":20},"perks":{"draws":3,"predictionFeeDiscountPct":40,"quantFeeDiscountPct":20,"honors":["badge","frame","priority_support"]}},
        {"index":7,"key":"milkyway","threshold":"5000000","requires":{"teamActive":50},"perks":{"draws":3,"predictionFeeDiscountPct":50,"quantFeeDiscountPct":30,"honors":["badge","frame","priority_support"]}}
      ]}'::jsonb,true)`)
  }
  async down():Promise<void> { throw new Error('Membership migration is additive only; preserve membership history and visibility preferences') }
}
