import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'

/**
 * Turns what happens to a user's money and account into in-app notifications (the AI buddy and the notification
 * page read these). Every 30 s it looks at the last few days of:
 *  - ledger transactions that moved the user's available USDT (deposit, transfer in/out, Koala Quant settlement,
 *    subscriptions, redemptions, prediction stakes and payouts, adjustments), with the exact amount;
 *  - devices first seen on an account that already had one (a new-device sign-in).
 * Each event becomes at most one notification (keyed by `payload.sourceKey`), dated when it happened, in the user's
 * language (Chinese for zh*, English otherwise). One instance works at a time (advisory lock). On by default; set
 * NOTIFICATION_FEED_DISABLED=true to stop it.
 */
@Injectable()
export class NotificationFeedWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(NotificationFeedWorker.name)
  private readonly enabled: boolean
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(private readonly db: DataSource, config: ConfigService) {
    this.enabled = config.get<string>('NOTIFICATION_FEED_DISABLED') !== 'true' && process.env.NODE_ENV !== 'test'
  }

  onApplicationBootstrap() {
    if (!this.enabled) return
    this.timer = setInterval(() => void this.tick(), 30_000)
    this.timer.unref?.()
    setTimeout(() => void this.tick(), 5_000).unref?.()
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick() {
    if (this.running) return
    this.running = true
    try {
      const inserted = await this.db.transaction(async (tx) => {
        const [lock] = await tx.query(`SELECT pg_try_advisory_xact_lock(hashtext('notification-feed')) AS ok`)
        if (!lock?.ok) return 0
        const money = await tx.query(MONEY_SQL)
        const devices = await tx.query(DEVICE_SQL)
        return (Array.isArray(money) ? money.length : 0) + (Array.isArray(devices) ? devices.length : 0)
      })
      if (inserted) this.log.log(`notification feed: ${inserted} new`)
    } catch (error) {
      this.log.warn(`notification feed failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.running = false
    }
  }
}

/** Ledger moves on users' available USDT → one notification per (transaction, user). */
export const MONEY_SQL = `
WITH moves AS (
  SELECT t.id AS tx_id, t.transaction_type AS type, t.effective_at AS at, t.reference_id, a.user_id,
         SUM(CASE WHEN e.side = a.normal_side THEN e.atomic_amount ELSE -e.atomic_amount END) AS delta,
         MAX(a.asset_decimals) AS decimals, MAX(a.asset_code) AS asset
    FROM app.ledger_transactions t
    JOIN app.ledger_entries e ON e.transaction_id = t.id
    JOIN app.ledger_accounts a ON a.id = e.account_id AND a.owner_type = 'user' AND a.user_id IS NOT NULL AND a.purpose = 'available'
   WHERE t.effective_at > now() - interval '3 days'
   GROUP BY t.id, t.transaction_type, t.effective_at, t.reference_id, a.user_id
), shaped AS (
  SELECT m.*, (COALESCE(u.locale, '') ILIKE 'zh%') AS zh, CASE WHEN COALESCE(u.locale, '') ILIKE 'zh%' THEN 'zh' ELSE 'en' END AS lang,
         to_char(abs(m.delta) / power(10::numeric, m.decimals), 'FM999,999,999,990.00') AS amt,
         to_char(qs.trade_date, 'MM-DD') AS day,
         CASE WHEN qs.net_return_pct IS NULL THEN NULL ELSE to_char(qs.net_return_pct, 'SGFM990.00') || '%' END AS pct
    FROM moves m
    JOIN app.users u ON u.id = m.user_id
    LEFT JOIN app.quant_daily_settlements qs ON m.type = 'quant_daily_settlement' AND qs.id = m.reference_id
   WHERE m.delta <> 0
), worded AS (
  SELECT s.*, w.title, w.body, w.route FROM shaped s CROSS JOIN LATERAL (
    SELECT
      CASE s.type
        WHEN 'deposit' THEN CASE WHEN s.zh THEN '充值到账 ' || s.amt || ' ' || s.asset ELSE 'Deposit received: ' || s.amt || ' ' || s.asset END
        WHEN 'withdrawal' THEN CASE WHEN s.zh THEN '提现 ' || s.amt || ' ' || s.asset ELSE 'Withdrawal: ' || s.amt || ' ' || s.asset END
        WHEN 'internal_transfer' THEN CASE WHEN s.delta > 0
          THEN CASE WHEN s.zh THEN '收到转账 ' || s.amt || ' ' || s.asset ELSE 'Transfer received: ' || s.amt || ' ' || s.asset END
          ELSE CASE WHEN s.zh THEN '转账已发出 ' || s.amt || ' ' || s.asset ELSE 'Transfer sent: ' || s.amt || ' ' || s.asset END END
        WHEN 'quant_daily_settlement' THEN CASE WHEN s.zh THEN '考拉量化' || COALESCE(' ' || s.day, '') || ' 已结算' ELSE 'Koala Quant settled' || COALESCE(' ' || s.day, '') END
        WHEN 'quant_subscription' THEN CASE WHEN s.zh THEN '考拉量化申购成功 ' || s.amt || ' ' || s.asset ELSE 'Koala Quant subscription: ' || s.amt || ' ' || s.asset END
        WHEN 'quant_redemption' THEN CASE WHEN s.zh THEN '考拉量化赎回到账 ' || s.amt || ' ' || s.asset ELSE 'Koala Quant redemption: ' || s.amt || ' ' || s.asset END
        WHEN 'basket_subscription' THEN CASE WHEN s.zh THEN '篮子申购成功 ' || s.amt || ' ' || s.asset ELSE 'Basket subscription: ' || s.amt || ' ' || s.asset END
        WHEN 'basket_redemption' THEN CASE WHEN s.zh THEN '篮子赎回到账 ' || s.amt || ' ' || s.asset ELSE 'Basket redemption: ' || s.amt || ' ' || s.asset END
        WHEN 'prediction_stake' THEN CASE WHEN s.zh THEN '预测下注 ' || s.amt || ' ' || s.asset ELSE 'Prediction placed: ' || s.amt || ' ' || s.asset END
        WHEN 'prediction_payout' THEN CASE WHEN s.zh THEN '预测结算到账 ' || s.amt || ' ' || s.asset ELSE 'Prediction paid out: ' || s.amt || ' ' || s.asset END
        WHEN 'referral_reward' THEN CASE WHEN s.zh THEN '邀请奖励到账 ' || s.amt || ' ' || s.asset ELSE 'Referral reward: ' || s.amt || ' ' || s.asset END
        WHEN 'adjustment' THEN CASE WHEN s.zh THEN '余额调整 ' || CASE WHEN s.delta > 0 THEN '+' ELSE '−' END || s.amt || ' ' || s.asset ELSE 'Balance adjusted: ' || CASE WHEN s.delta > 0 THEN '+' ELSE '−' END || s.amt || ' ' || s.asset END
      END AS title,
      CASE
        WHEN s.type = 'quant_daily_settlement' THEN CASE WHEN s.zh
          THEN COALESCE('当日 ' || s.pct || '，', '') || CASE WHEN s.delta > 0 THEN '收益 ' ELSE '变动 ' END || s.amt || ' ' || s.asset || ' 已计入可用余额'
          ELSE COALESCE('Day ' || s.pct || ', ', '') || s.amt || ' ' || s.asset || ' credited to your available balance' END
        WHEN s.delta > 0 THEN CASE WHEN s.zh THEN '已计入可用余额' ELSE 'Added to your available balance' END
        ELSE CASE WHEN s.zh THEN '已从可用余额扣除' ELSE 'Taken from your available balance' END
      END AS body,
      CASE
        WHEN s.type LIKE 'quant%' THEN '/quant'
        WHEN s.type LIKE 'basket%' THEN '/assets?tab=positions'
        WHEN s.type LIKE 'prediction%' THEN '/assets/predictions'
        WHEN s.type = 'referral_reward' THEN '/profile/referral'
        ELSE '/assets/activity?type=funding'
      END AS route
  ) w
)
INSERT INTO app.notifications (recipient_user_id, channel, kind, title, body, payload, locale, created_at)
SELECT d.user_id, 'in_app', 'wallet.' || d.type, d.title, d.body,
       jsonb_build_object('sourceKey', 'ledger:' || d.tx_id, 'route', d.route, 'amountAtomic', d.delta::text, 'asset', d.asset),
       d.lang, d.at
  FROM worded d
 WHERE d.title IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM app.notifications n WHERE n.recipient_user_id = d.user_id AND n.payload->>'sourceKey' = 'ledger:' || d.tx_id)
RETURNING id`

/** A device first seen on an account that already had another device → "new device sign-in". */
export const DEVICE_SQL = `
INSERT INTO app.notifications (recipient_user_id, channel, kind, title, body, payload, locale, created_at)
SELECT d.user_id, 'in_app', 'security.new_device',
       CASE WHEN COALESCE(u.locale, '') ILIKE 'zh%' THEN '新设备登录' ELSE 'New device signed in' END,
       COALESCE(NULLIF(d.display_name, '') || ' · ', '') || CASE WHEN COALESCE(u.locale, '') ILIKE 'zh%' THEN '如果不是你本人，请立即检查账户安全' ELSE 'If this wasn''t you, check your account security now' END,
       jsonb_build_object('sourceKey', 'device:' || d.id, 'route', '/profile/security'),
       CASE WHEN COALESCE(u.locale, '') ILIKE 'zh%' THEN 'zh' ELSE 'en' END, d.first_seen_at
  FROM app.devices d
  JOIN app.users u ON u.id = d.user_id
 WHERE d.first_seen_at > now() - interval '3 days'
   AND EXISTS (SELECT 1 FROM app.devices o WHERE o.user_id = d.user_id AND o.id <> d.id AND o.first_seen_at < d.first_seen_at)
   AND NOT EXISTS (SELECT 1 FROM app.notifications n WHERE n.recipient_user_id = d.user_id AND n.payload->>'sourceKey' = 'device:' || d.id)
RETURNING id`
