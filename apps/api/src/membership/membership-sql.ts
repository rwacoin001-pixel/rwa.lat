/** Same money sources/units as ReferralReadService.invitee, plus settled baskets (already USDT).
 * `scope(user_id)` bounds scans to the batch and its three-level team. All windows are [start, now]. */
export const MONEY_CTES=`deposits AS (
  SELECT d.user_id,CASE WHEN d.asset_code='USDT' THEN trunc(d.atomic_amount*power(10::numeric,6-d.asset_decimals))/1000000 ELSE 0 END AS amount,
    d.credited_at AS at,true AS credited FROM app.deposits d JOIN scope s ON s.user_id=d.user_id WHERE d.state='credited'
  UNION ALL SELECT t.recipient_user_id,trunc(t.atomic_amount*power(10::numeric,6-t.asset_decimals))/1000000,t.posted_at,false
    FROM app.internal_transfers t JOIN scope s ON s.user_id=t.recipient_user_id WHERE t.state='posted' AND t.asset_code='USDT'
), purchases AS (
  SELECT q.user_id,q.amount_atomic/1000000::numeric AS amount,coalesce(q.settled_at,q.created_at) AS at
    FROM app.quant_orders q JOIN scope s ON s.user_id=q.user_id WHERE q.kind='subscription' AND q.status IN ('accepted','settled')
  UNION ALL SELECT o.user_id,o.filled_atomic_amount/1000000::numeric,coalesce(o.completed_at,o.processed_at,o.submitted_at)
    FROM app.orders o JOIN scope s ON s.user_id=o.user_id WHERE o.side='buy' AND o.state IN ('filled','partially_filled') AND o.filled_atomic_amount>0
      AND o.settlement_asset_code='USDT' AND o.settlement_asset_decimals=6
  UNION ALL SELECT b.user_id,b.stake_atomic/1000000::numeric,b.created_at FROM app.prediction_bets b JOIN scope s ON s.user_id=b.user_id
    WHERE b.status IN ('placed','won','lost')
  UNION ALL SELECT b.user_id,b.amount_usd,coalesce(b.settled_at,b.created_at) FROM app.basket_subscriptions b JOIN scope s ON s.user_id=b.user_id
    WHERE b.status='settled'
)`

// The hard limit remains three even if an operator configures a larger maxDepth. Paths also reject cycles.
export const TEAM_CTE=`team AS (
  SELECT r.user_id AS root,e.invitee_user_id AS user_id,1 AS depth,e.bound_at,ARRAY[r.user_id,e.invitee_user_id] AS path
    FROM roots r JOIN app.referral_edges e ON e.inviter_user_id=r.user_id WHERE e.invitee_user_id<>r.user_id
  UNION ALL SELECT t.root,e.invitee_user_id,t.depth+1,e.bound_at,t.path||e.invitee_user_id
    FROM team t JOIN app.referral_edges e ON e.inviter_user_id=t.user_id
    WHERE t.depth<LEAST($2::int,3) AND NOT e.invitee_user_id=ANY(t.path)
)`

export const COMPONENTS_SQL=`WITH RECURSIVE roots AS (SELECT unnest($1::uuid[]) AS user_id),${TEAM_CTE},
  scope AS (SELECT user_id FROM roots UNION SELECT user_id FROM team),${MONEY_CTES},
  dep AS (SELECT user_id,coalesce(sum(amount) FILTER(WHERE at >= $3::timestamptz-make_interval(days=>$4::int)),0) AS amount,
    bool_or(credited) AS first_deposit,bool_or(credited AND at >= $3::timestamptz-make_interval(days=>$5::int)) AS active
    FROM deposits WHERE at<=$3 GROUP BY user_id),
  buy AS (SELECT user_id,coalesce(sum(amount) FILTER(WHERE at >= $3::timestamptz-make_interval(days=>$4::int)),0) AS amount,
    bool_or(at >= $3::timestamptz-make_interval(days=>$5::int)) AS active FROM purchases WHERE at<=$3 GROUP BY user_id),
  points AS (SELECT p.user_id,sum(p.delta) AS amount FROM app.user_points_ledger p JOIN roots r ON r.user_id=p.user_id
    WHERE p.reason::text IN ('task','activity') AND p.created_at<=$3 GROUP BY p.user_id),
  teams AS (SELECT t.root,
    coalesce(sum(b.amount) FILTER(WHERE t.depth=1),0)::text AS l1,coalesce(sum(b.amount) FILTER(WHERE t.depth=2),0)::text AS l2,
    coalesce(sum(b.amount) FILTER(WHERE t.depth=3),0)::text AS l3,
    count(*) FILTER(WHERE t.depth=1)::int AS direct,count(*)::int AS team,
    count(*) FILTER(WHERE t.depth=1 AND (coalesce(d.active,false) OR coalesce(b.active,false)))::int AS direct_active,
    count(*) FILTER(WHERE coalesce(d.active,false) OR coalesce(b.active,false))::int AS team_active
    FROM team t LEFT JOIN buy b ON b.user_id=t.user_id LEFT JOIN dep d ON d.user_id=t.user_id GROUP BY t.root)
  SELECT r.user_id,coalesce(d.amount,0)::text AS deposits,coalesce(b.amount,0)::text AS purchases,coalesce(p.amount,0)::text AS tasks,
    coalesce(d.first_deposit,false) AS first_deposit,coalesce(t.l1,'0') AS l1,coalesce(t.l2,'0') AS l2,coalesce(t.l3,'0') AS l3,
    coalesce(t.direct,0)::int AS direct,coalesce(t.team,0)::int AS team,coalesce(t.direct_active,0)::int AS direct_active,
    coalesce(t.team_active,0)::int AS team_active
    FROM roots r LEFT JOIN dep d ON d.user_id=r.user_id LEFT JOIN buy b ON b.user_id=r.user_id
    LEFT JOIN teams t ON t.root=r.user_id LEFT JOIN points p ON p.user_id=r.user_id`

export function rankValuesSql(own=false):string { return `WITH RECURSIVE roots AS (${own?'SELECT id AS user_id FROM app.users WHERE id=$5::uuid':`SELECT user_id FROM app.community_profiles
    WHERE user_id IS NOT NULL AND identity_configured AND handle<>'' AND is_active AND NOT hide_from_rank`}),${TEAM_CTE},
  scope AS (SELECT user_id FROM roots UNION SELECT user_id FROM team),${MONEY_CTES},
  buy AS (SELECT user_id,sum(amount) AS amount FROM purchases WHERE at >= $1::date::timestamp AT TIME ZONE 'Asia/Shanghai' AND at <= $3 GROUP BY user_id),
  active AS (SELECT user_id,at FROM deposits WHERE credited AND at >= $3::timestamptz-make_interval(days=>$4::int) AND at <= $3
    UNION ALL SELECT user_id,at FROM purchases WHERE at >= $3::timestamptz-make_interval(days=>$4::int) AND at <= $3),
  teams AS (SELECT t.root,coalesce(sum(b.amount),0) AS amount,
    count(*) FILTER(WHERE t.depth=1 AND t.bound_at >= $1::date::timestamp AT TIME ZONE 'Asia/Shanghai' AND t.bound_at <= $3
      AND EXISTS(SELECT 1 FROM active a WHERE a.user_id=t.user_id AND a.at>=t.bound_at)) AS invites
    FROM team t LEFT JOIN buy b ON b.user_id=t.user_id GROUP BY t.root)
  SELECT r.user_id,coalesce(m.score,0)::text AS score,coalesce(b.amount,0)::text AS invest,
    coalesce(t.amount,0)::text AS team,coalesce(t.invites,0)::text AS invite
    FROM roots r LEFT JOIN app.member_levels m ON m.user_id=r.user_id LEFT JOIN buy b ON b.user_id=r.user_id LEFT JOIN teams t ON t.root=r.user_id` }
