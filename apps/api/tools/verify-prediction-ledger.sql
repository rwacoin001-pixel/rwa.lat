-- 预测市场收费(A+C) + 庄家盘账本的 DB 级集成验证。
-- 全程在事务里跑并最终 ROLLBACK，不污染测试库。
-- 用法：psql -v ON_ERROR_STOP=1 -f tools/verify-prediction-ledger.sql
-- 任何一条断言不符都会 RAISE EXCEPTION 并以非 0 退出。

\set ON_ERROR_STOP on

-- ═══════════════════════════════════════════════════════════════════
\echo '══ 场景 1：下注(A) → 派彩(C) 全链路账本 ══'
BEGIN;

DO $$
DECLARE
  v_user uuid; v_market uuid; v_funding uuid; v_available uuid; v_pool uuid; v_fee uuid;
  v_bet uuid := gen_random_uuid(); v_tx uuid; v_bal numeric(78,0);

  -- 与 prediction.service.ts 相同的算式，人工推导的期望值
  v_stake      numeric(78,0)  := 100000000;              -- 100 USDT
  v_fee_place  numeric(78,0)  := 3000000;                -- 3 USDT   = 3% × 100
  v_risk       numeric(78,0)  := 97000000;               -- 97 USDT  进池
  v_shares     numeric(38,18) := 970;  -- 970 股 = 97 / 0.10
  v_gross      numeric(78,0)  := 970000000;              -- 970 USDT 毛派彩
  v_fee_payout numeric(78,0)  := 29100000;               -- 29.1 USDT = 3% × 970
  v_net        numeric(78,0)  := 940900000;              -- 940.9 USDT 净派彩
  v_deposit    numeric(78,0)  := 200000000;              -- 充值 200 USDT
BEGIN
  ---------------------------------------------------------------- 夹具
  INSERT INTO app.users DEFAULT VALUES RETURNING id INTO v_user;

  INSERT INTO app.polymarket_market_mappings
    (gamma_market_id, condition_id, slug, question, state, enable_order_book, restricted, last_synced_at)
  VALUES ('verify-gamma-1', 'verify-condition-1', 'verify-slug-1', 'Verify: does the fee ledger balance?', 'active', true, false, now())
  RETURNING id INTO v_market;

  INSERT INTO app.polymarket_token_mappings (market_mapping_id, token_id, outcome, outcome_index, state)
  VALUES (v_market, 'VERIFY-YES', 'Yes', 0, 'active'),
         (v_market, 'VERIFY-NO',  'No',  1, 'active');

  INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative)
  VALUES ('platform', 'verify_funding', 'custody_difference', 'USDT', 6, 'debit', true)
  RETURNING id INTO v_funding;

  INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
  VALUES ('user', v_user, 'available', 'USDT', 6, 'credit')
  RETURNING id INTO v_available;

  SELECT id INTO v_pool FROM app.ledger_accounts
   WHERE owner_type='platform' AND owner_reference='prediction_pool' AND purpose='settlement' AND asset_code='USDT';
  SELECT id INTO v_fee FROM app.ledger_accounts
   WHERE owner_type='platform' AND owner_reference='prediction_fee' AND purpose='fee_revenue' AND asset_code='USDT';
  IF v_pool IS NULL THEN RAISE EXCEPTION 'FAIL: prediction_pool 账户缺失'; END IF;
  IF v_fee  IS NULL THEN RAISE EXCEPTION 'FAIL: prediction_fee 账户缺失';  END IF;

  -------------------------------------------------- 充值（2 分录，借贷相抵）
  INSERT INTO app.ledger_transactions
    (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
  VALUES ('deposit', 'v1-deposit', 'verify', 'prediction_bet', v_bet, 'service', now())
  RETURNING id INTO v_tx;
  INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
  VALUES (v_tx, v_funding, 'debit', v_deposit), (v_tx, v_available, 'credit', v_deposit);

  SELECT current_atomic_balance INTO v_bal FROM app.ledger_account_balances WHERE account_id = v_available;
  IF v_bal <> v_deposit THEN RAISE EXCEPTION 'FAIL 充值后用户余额=% 期望=%', v_bal, v_deposit; END IF;

  -------------------------------------------------- 投注单（带下注费）
  INSERT INTO app.prediction_bets
    (id, user_id, market_mapping_id, token_id, side, stake_atomic, fee_atomic, payout_fee_atomic, shares, price, status, idempotency_key)
  VALUES (v_bet, v_user, v_market, 'VERIFY-YES', 'YES', v_stake, v_fee_place, 0, v_shares, 0.1, 'placed', 'v1-bet');

  -------------------------------------------- ★ 下注记账：1 借 2 贷的三分录
  INSERT INTO app.ledger_transactions
    (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
  VALUES ('prediction_stake', 'prediction_stake:'||v_bet, 'verify', 'prediction_bet', v_bet, 'user', now())
  RETURNING id INTO v_tx;
  INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
  VALUES (v_tx, v_available, 'debit',  v_stake),
         (v_tx, v_pool,      'credit', v_risk),
         (v_tx, v_fee,       'credit', v_fee_place);

  SELECT current_atomic_balance INTO v_bal FROM app.ledger_account_balances WHERE account_id = v_available;
  IF v_bal <> v_deposit - v_stake THEN RAISE EXCEPTION 'FAIL 下注后用户余额=% 期望=%', v_bal, v_deposit - v_stake; END IF;
  SELECT current_atomic_balance INTO v_bal FROM app.ledger_account_balances WHERE account_id = v_pool;
  IF v_bal <> v_risk THEN RAISE EXCEPTION 'FAIL 下注后池子=% 期望=%', v_bal, v_risk; END IF;
  SELECT current_atomic_balance INTO v_bal FROM app.ledger_account_balances WHERE account_id = v_fee;
  IF v_bal <> v_fee_place THEN RAISE EXCEPTION 'FAIL 下注后费收=% 期望=%', v_bal, v_fee_place; END IF;
  RAISE NOTICE 'PASS  下注三分录 → 用户 %, 池 %, 费收 %（单位 atomic USDT）',
    v_deposit - v_stake, v_risk, v_fee_place;

  --------------------------------- ★ 派彩记账：三分录 + 池子必须能记成负数
  UPDATE app.prediction_bets SET status='won', payout_fee_atomic=v_fee_payout, settled_at=now() WHERE id=v_bet;

  INSERT INTO app.ledger_transactions
    (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
  VALUES ('prediction_payout', 'prediction_payout:'||v_bet, 'verify', 'prediction_bet', v_bet, 'user', now())
  RETURNING id INTO v_tx;
  INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
  VALUES (v_tx, v_pool,      'debit',  v_gross),
         (v_tx, v_available, 'credit', v_net),
         (v_tx, v_fee,       'credit', v_fee_payout);

  SELECT current_atomic_balance INTO v_bal FROM app.ledger_account_balances WHERE account_id = v_pool;
  IF v_bal <> v_risk - v_gross THEN
    RAISE EXCEPTION 'FAIL 派彩后池子=% 期望=%（allow_negative 未生效）', v_bal, v_risk - v_gross;
  END IF;
  IF v_bal >= 0 THEN RAISE EXCEPTION 'FAIL 池子赔穿应记负数，实际=%', v_bal; END IF;
  SELECT current_atomic_balance INTO v_bal FROM app.ledger_account_balances WHERE account_id = v_available;
  IF v_bal <> v_deposit - v_stake + v_net THEN RAISE EXCEPTION 'FAIL 派彩后用户余额=% 期望=%', v_bal, v_deposit - v_stake + v_net; END IF;
  SELECT current_atomic_balance INTO v_bal FROM app.ledger_account_balances WHERE account_id = v_fee;
  IF v_bal <> v_fee_place + v_fee_payout THEN RAISE EXCEPTION 'FAIL 平台费收=% 期望=%', v_bal, v_fee_place + v_fee_payout; END IF;
  RAISE NOTICE 'PASS  派彩三分录 → 池 %（赔穿记负）, 用户 %, 费收 %',
    v_risk - v_gross, v_deposit - v_stake + v_net, v_fee_place + v_fee_payout;

  ------------------------------------------------ 守恒：用户实付 = 进池 + 费
  IF v_risk + v_fee_place <> v_stake THEN RAISE EXCEPTION 'FAIL 用户实付不守恒'; END IF;
  RAISE NOTICE 'PASS  守恒 → 进池 % + 下注费 % = 用户实付 %', v_risk, v_fee_place, v_stake;
END $$;

ROLLBACK;


-- ═══════════════════════════════════════════════════════════════════
\echo ''
\echo '══ 场景 2：作废退款只退净本金（下注费不退）══'
BEGIN;

DO $$
DECLARE
  v_user uuid; v_market uuid; v_funding uuid; v_available uuid; v_pool uuid; v_fee uuid;
  v_bet uuid := gen_random_uuid(); v_tx uuid; v_bal numeric(78,0);
  v_stake numeric(78,0) := 100000000;
  v_fee_place numeric(78,0) := 3000000;
  v_risk numeric(78,0) := 97000000;
  v_refund numeric(78,0);
  v_deposit numeric(78,0) := 200000000;
BEGIN
  INSERT INTO app.users DEFAULT VALUES RETURNING id INTO v_user;
  INSERT INTO app.polymarket_market_mappings
    (gamma_market_id, condition_id, slug, question, state, enable_order_book, last_synced_at)
  VALUES ('verify-gamma-2', 'verify-condition-2', 'verify-slug-2', 'Verify: void refund keeps the place fee', 'active', true, now())
  RETURNING id INTO v_market;
  INSERT INTO app.polymarket_token_mappings (market_mapping_id, token_id, outcome, outcome_index, state)
  VALUES (v_market, 'VERIFY2-YES', 'Yes', 0, 'active');

  INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative)
  VALUES ('platform', 'verify_funding', 'custody_difference', 'USDT', 6, 'debit', true) RETURNING id INTO v_funding;
  INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
  VALUES ('user', v_user, 'available', 'USDT', 6, 'credit') RETURNING id INTO v_available;
  SELECT id INTO v_pool FROM app.ledger_accounts
   WHERE owner_type='platform' AND owner_reference='prediction_pool' AND purpose='settlement' AND asset_code='USDT';
  SELECT id INTO v_fee FROM app.ledger_accounts
   WHERE owner_type='platform' AND owner_reference='prediction_fee' AND purpose='fee_revenue' AND asset_code='USDT';

  -- 充值
  INSERT INTO app.ledger_transactions (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
  VALUES ('deposit', 'v2-deposit', 'verify', 'prediction_bet', v_bet, 'service', now()) RETURNING id INTO v_tx;
  INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
  VALUES (v_tx, v_funding, 'debit', v_deposit), (v_tx, v_available, 'credit', v_deposit);

  -- 下注
  INSERT INTO app.prediction_bets
    (id, user_id, market_mapping_id, token_id, side, stake_atomic, fee_atomic, shares, price, status, idempotency_key)
  VALUES (v_bet, v_user, v_market, 'VERIFY2-YES', 'YES', v_stake, v_fee_place, 970, 0.1, 'placed', 'v2-bet');
  INSERT INTO app.ledger_transactions (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
  VALUES ('prediction_stake', 'prediction_stake:'||v_bet, 'verify', 'prediction_bet', v_bet, 'user', now()) RETURNING id INTO v_tx;
  INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
  VALUES (v_tx, v_available, 'debit', v_stake), (v_tx, v_pool, 'credit', v_risk), (v_tx, v_fee, 'credit', v_fee_place);

  -- 作废退款：只退 stake − 下注费；下注费作为已提供服务对价留存
  v_refund := v_stake - v_fee_place;
  UPDATE app.prediction_bets SET status='void', settled_at=now() WHERE id=v_bet;

  INSERT INTO app.ledger_transactions (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
  VALUES ('prediction_void_refund', 'prediction_void_refund:'||v_bet, 'verify', 'prediction_bet', v_bet, 'user', now()) RETURNING id INTO v_tx;
  INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
  VALUES (v_tx, v_pool, 'debit', v_refund), (v_tx, v_available, 'credit', v_refund);

  SELECT current_atomic_balance INTO v_bal FROM app.ledger_account_balances WHERE account_id = v_available;
  IF v_bal <> v_deposit - v_fee_place THEN
    RAISE EXCEPTION 'FAIL 作废后用户余额=% 期望=%（应只损失下注费）', v_bal, v_deposit - v_fee_place;
  END IF;
  IF v_refund <> 97000000 THEN RAISE EXCEPTION 'FAIL 退款额=% 期望=97000000', v_refund; END IF;
  RAISE NOTICE 'PASS  作废退款 → 用户余额 %（净损失下注费 %）, 退款 %', v_deposit - v_fee_place, v_fee_place, v_refund;
END $$;

ROLLBACK;


-- ═══════════════════════════════════════════════════════════════════
\echo ''
\echo '══ 场景 3：反向验证 —— 不平账的分录必须被账本触发器拒绝 ══'
BEGIN;

DO $$
DECLARE
  v_user uuid; v_funding uuid; v_available uuid; v_tx uuid; v_bal numeric(78,0);
  v_caught boolean := false;
BEGIN
  INSERT INTO app.users DEFAULT VALUES RETURNING id INTO v_user;
  INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative)
  VALUES ('platform', 'verify_funding', 'custody_difference', 'USDT', 6, 'debit', true) RETURNING id INTO v_funding;
  INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
  VALUES ('user', v_user, 'available', 'USDT', 6, 'credit') RETURNING id INTO v_available;

  INSERT INTO app.ledger_transactions (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
  VALUES ('deposit', 'v3-deposit', 'verify', 'prediction_bet', gen_random_uuid(), 'service', now()) RETURNING id INTO v_tx;

  -- 故意不平：借 100 vs 贷 90
  BEGIN
    INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
    VALUES (v_tx, v_funding, 'debit', 100000000), (v_tx, v_available, 'credit', 90000000);
    SET CONSTRAINTS ALL IMMEDIATE;   -- 平衡触发器是 DEFERRABLE INITIALLY DEFERRED，需在提交前触发
  EXCEPTION WHEN others THEN
    v_caught := true;
    RAISE NOTICE 'PASS  不平分录被拒绝：%', SQLERRM;
  END;

  IF NOT v_caught THEN RAISE EXCEPTION 'FAIL 不平的分录竟然被接受了 —— 账本触发器失效'; END IF;
END $$;

ROLLBACK;

\echo ''
\echo '══ 全部 DB 级验证通过 ══'
