import type { MigrationInterface, QueryRunner } from 'typeorm'

const financialTables = ['orders','redemptions','withdrawals','positions','recurring_investments','rebalance_plans','trading_orders','basket_subscriptions','basket_redemptions','subscriptions','yield_allocations','internal_transfers','ledger_entries']
export class AccountClosure1790000000018 implements MigrationInterface {
  name='AccountClosure1790000000018'
  async up(q:QueryRunner) {
    await q.query(`INSERT INTO app.admin_role_permissions(role_id,permission) SELECT id,'users.account_closure.manage' FROM app.admin_roles WHERE name='super_admin' ON CONFLICT DO NOTHING;
    CREATE TABLE app.account_closure_requests(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES app.users(id),
      state text NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','rejected','closed','canceled')),
      reason text NOT NULL,review_note text,reviewed_by uuid,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz
    ); CREATE UNIQUE INDEX account_closure_open_user_idx ON app.account_closure_requests(user_id) WHERE state='requested';
    CREATE FUNCTION app.guard_closed_account_financial_write() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE target uuid; targets uuid[]; user_status text;
    BEGIN
      IF TG_TABLE_NAME='ledger_entries' THEN SELECT ARRAY[user_id] INTO targets FROM app.ledger_accounts WHERE id=NEW.account_id;
      ELSIF TG_TABLE_NAME='internal_transfers' THEN targets:=ARRAY[NEW.sender_user_id,NEW.recipient_user_id];
      ELSE targets:=ARRAY[(to_jsonb(NEW)->>'user_id')::uuid]; END IF;
      FOR target IN SELECT DISTINCT x FROM unnest(targets) x WHERE x IS NOT NULL ORDER BY x LOOP
        SELECT status INTO user_status FROM app.users WHERE id=target FOR SHARE;
        IF user_status='closed' THEN RAISE EXCEPTION 'Closed account cannot receive financial writes' USING ERRCODE='23514',CONSTRAINT='closed_account_financial_write'; END IF;
      END LOOP;
      RETURN NEW;
    END $$;`)
    for(const table of financialTables) await q.query(`CREATE TRIGGER closed_account_guard BEFORE INSERT OR UPDATE ON app.${table} FOR EACH ROW EXECUTE FUNCTION app.guard_closed_account_financial_write()`)
    await q.query(`CREATE TRIGGER closed_account_session_guard BEFORE INSERT OR UPDATE ON app.sessions FOR EACH ROW WHEN(NEW.state='active') EXECUTE FUNCTION app.guard_closed_account_financial_write()`)
  }
  async down(q:QueryRunner) {
    await q.query('DROP TRIGGER closed_account_session_guard ON app.sessions')
    for(const table of financialTables) await q.query(`DROP TRIGGER closed_account_guard ON app.${table}`)
    await q.query("DROP FUNCTION app.guard_closed_account_financial_write(); DROP TABLE app.account_closure_requests; DELETE FROM app.admin_role_permissions WHERE permission='users.account_closure.manage'")
  }
}
