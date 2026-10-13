import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Visit log (product decision 2026-10-13): the admin activity page lists every visit with its time and IP.
 *
 * One row per visit. A visit is one visitor's run of end-user API requests with no gap longer than 30 minutes;
 * signed-in visitors are identified by account, anonymous ones by IP + user agent. Unlike app.daily_activity
 * this stores the raw client IP and user agent, so it is personal data: readable only through the admin API
 * (users.read) and pruned after 180 days by the API.
 */
export class VisitLog1792200000000 implements MigrationInterface {
  name = 'VisitLog1792200000000'

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE app.visit_log (
      id uuid PRIMARY KEY,
      user_id uuid,
      ip inet NOT NULL,
      country text CHECK (country IS NULL OR country ~ '^[A-Z][A-Z0-9]$'),
      device text NOT NULL CHECK (device IN ('mobile', 'desktop', 'tablet', 'other')),
      user_agent text CHECK (user_agent IS NULL OR length(user_agent) <= 512),
      first_page text CHECK (first_page IS NULL OR length(first_page) <= 200),
      last_page text CHECK (last_page IS NULL OR length(last_page) <= 200),
      started_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL,
      requests integer NOT NULL CHECK (requests > 0),
      CHECK (last_seen_at >= started_at)
    )`)
    await runner.query(`COMMENT ON TABLE app.visit_log IS 'One row per visit (30-minute inactivity window); raw IP and user agent; admin-only; pruned after 180 days.'`)
    await runner.query(`CREATE INDEX visit_log_started ON app.visit_log (started_at DESC, id)`)
    await runner.query(`CREATE INDEX visit_log_user ON app.visit_log (user_id, started_at DESC) WHERE user_id IS NOT NULL`)
    await runner.query(`CREATE INDEX visit_log_ip ON app.visit_log (ip, started_at DESC)`)
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TABLE app.visit_log`)
  }
}
