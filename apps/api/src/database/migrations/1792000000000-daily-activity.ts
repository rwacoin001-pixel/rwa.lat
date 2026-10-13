import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Daily activity: at most one row per visitor per Asia/Shanghai day, written by the API's
 * ActivityTrackingMiddleware for end-user requests (bots, health, admin and callbacks excluded).
 *
 * Privacy: no raw IP and no user agent are stored. visitor_key is an HMAC over the day plus either the
 * signed-in user id or the client IP, so anonymous visitors cannot be linked across days and the key
 * cannot be reversed without the server secret. Rows are pruned after 400 days by the recorder.
 */
export class DailyActivity1792000000000 implements MigrationInterface {
  name = 'DailyActivity1792000000000'

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE app.daily_activity (
      day date NOT NULL,
      visitor_key bytea NOT NULL CHECK (octet_length(visitor_key) = 32),
      user_id uuid,
      country text CHECK (country IS NULL OR country ~ '^[A-Z][A-Z0-9]$'),
      device text NOT NULL CHECK (device IN ('mobile', 'desktop', 'tablet', 'other')),
      first_seen_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL,
      requests integer NOT NULL DEFAULT 1 CHECK (requests > 0),
      PRIMARY KEY (day, visitor_key),
      CHECK (last_seen_at >= first_seen_at)
    )`)
    await runner.query(`COMMENT ON TABLE app.daily_activity IS 'One row per visitor per Asia/Shanghai day; HMAC visitor key, no raw IP or user agent; pruned after 400 days.'`)
    await runner.query(`CREATE INDEX daily_activity_day_user ON app.daily_activity (day, user_id) WHERE user_id IS NOT NULL`)
    await runner.query(`CREATE INDEX daily_activity_day_country ON app.daily_activity (day, country)`)
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE app.daily_activity`)
  }
}
