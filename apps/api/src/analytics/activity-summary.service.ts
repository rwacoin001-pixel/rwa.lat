import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { ACTIVITY_TIMEZONE } from './activity-recorder.service'

export const ACTIVITY_RANGES = [7, 30, 90] as const
const TOP_COUNTRIES = 12

export interface ActivityDay {
  day: string
  /** Distinct signed-in users who used the app that day (daily_activity). */
  activeUsers: number
  /** Anonymous visitor-days (per-day IP hash, not linkable across days). */
  anonymousVisitors: number
  /** Sessions created that day (sign-ins) and the distinct users behind them. */
  logins: number
  loginUsers: number
  registrations: number
}

export interface ActivitySummary {
  asOf: string
  timezone: string
  /** First day with recorded activity; logins and registrations have full history regardless. */
  trackingSince: string | null
  today: Omit<ActivityDay, 'day'>
  totals: { users: number; active7: number; active30: number }
  series: ActivityDay[]
  countries: Array<{ country: string; visitors: number; users: number }>
  devices: Array<{ device: string; visitors: number }>
}

/** Read-only user activity overview for the admin console. */
@Injectable()
export class ActivitySummaryService {
  constructor(private readonly db: DataSource) {}

  async summary(days: number): Promise<ActivitySummary> {
    const range = (ACTIVITY_RANGES as readonly number[]).includes(days) ? days : 30
    const [series, totals, countries, devices, since] = await Promise.all([
      this.series(range),
      this.totals(),
      this.countries(range),
      this.devices(range),
      this.db.query(`SELECT to_char(MIN(day), 'YYYY-MM-DD') AS since FROM app.daily_activity`) as Promise<Array<{ since: string | null }>>,
    ])
    const last = series[series.length - 1]
    return {
      asOf: new Date().toISOString(),
      timezone: ACTIVITY_TIMEZONE,
      trackingSince: since[0]?.since ?? null,
      today: {
        activeUsers: last?.activeUsers ?? 0,
        anonymousVisitors: last?.anonymousVisitors ?? 0,
        logins: last?.logins ?? 0,
        loginUsers: last?.loginUsers ?? 0,
        registrations: last?.registrations ?? 0,
      },
      totals,
      series,
      countries,
      devices,
    }
  }

  async series(days: number): Promise<ActivityDay[]> {
    const rows = await this.db.query(
      `WITH days AS (
         SELECT generate_series((now() AT TIME ZONE $1)::date - ($2::int - 1), (now() AT TIME ZONE $1)::date, interval '1 day')::date AS day
       ),
       bounds AS (SELECT ((now() AT TIME ZONE $1)::date - ($2::int - 1)) AT TIME ZONE $1 AS since),
       activity AS (
         SELECT day, COUNT(DISTINCT user_id)::int AS active_users, COUNT(*) FILTER (WHERE user_id IS NULL)::int AS anonymous
           FROM app.daily_activity WHERE day >= (SELECT MIN(day) FROM days) GROUP BY day
       ),
       logins AS (
         SELECT (created_at AT TIME ZONE $1)::date AS day, COUNT(*)::int AS logins, COUNT(DISTINCT user_id)::int AS login_users
           FROM app.sessions, bounds WHERE created_at >= bounds.since GROUP BY 1
       ),
       registrations AS (
         SELECT (created_at AT TIME ZONE $1)::date AS day, COUNT(*)::int AS n
           FROM app.users, bounds WHERE created_at >= bounds.since GROUP BY 1
       )
       SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
              COALESCE(activity.active_users, 0) AS active_users, COALESCE(activity.anonymous, 0) AS anonymous,
              COALESCE(logins.logins, 0) AS logins, COALESCE(logins.login_users, 0) AS login_users,
              COALESCE(registrations.n, 0) AS registrations
         FROM days
         LEFT JOIN activity ON activity.day = days.day
         LEFT JOIN logins ON logins.day = days.day
         LEFT JOIN registrations ON registrations.day = days.day
        ORDER BY days.day`,
      [ACTIVITY_TIMEZONE, days],
    ) as Array<Record<string, string | number>>
    return rows.map((row) => ({
      day: String(row.day),
      activeUsers: Number(row.active_users),
      anonymousVisitors: Number(row.anonymous),
      logins: Number(row.logins),
      loginUsers: Number(row.login_users),
      registrations: Number(row.registrations),
    }))
  }

  private async totals(): Promise<ActivitySummary['totals']> {
    const [row] = await this.db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM app.users WHERE closed_at IS NULL) AS users,
         (SELECT COUNT(DISTINCT user_id)::int FROM app.daily_activity WHERE user_id IS NOT NULL AND day > (now() AT TIME ZONE $1)::date - 7) AS active7,
         (SELECT COUNT(DISTINCT user_id)::int FROM app.daily_activity WHERE user_id IS NOT NULL AND day > (now() AT TIME ZONE $1)::date - 30) AS active30`,
      [ACTIVITY_TIMEZONE],
    ) as Array<Record<string, number>>
    return { users: Number(row.users), active7: Number(row.active7), active30: Number(row.active30) }
  }

  private async countries(days: number): Promise<ActivitySummary['countries']> {
    const rows = await this.db.query(
      `SELECT COALESCE(country, '??') AS country, COUNT(*)::int AS visitors, COUNT(DISTINCT user_id)::int AS users
         FROM app.daily_activity
        WHERE day > (now() AT TIME ZONE $1)::date - $2::int
        GROUP BY 1 ORDER BY visitors DESC, country`,
      [ACTIVITY_TIMEZONE, days],
    ) as Array<{ country: string; visitors: number; users: number }>
    const top = rows.slice(0, TOP_COUNTRIES).map((row) => ({ country: row.country, visitors: Number(row.visitors), users: Number(row.users) }))
    const rest = rows.slice(TOP_COUNTRIES)
    if (rest.length) {
      top.push({ country: 'OTHER', visitors: rest.reduce((sum, row) => sum + Number(row.visitors), 0), users: rest.reduce((sum, row) => sum + Number(row.users), 0) })
    }
    return top
  }

  private async devices(days: number): Promise<ActivitySummary['devices']> {
    const rows = await this.db.query(
      `SELECT device, COUNT(*)::int AS visitors FROM app.daily_activity
        WHERE day > (now() AT TIME ZONE $1)::date - $2::int GROUP BY 1 ORDER BY visitors DESC`,
      [ACTIVITY_TIMEZONE, days],
    ) as Array<{ device: string; visitors: number }>
    return rows.map((row) => ({ device: row.device, visitors: Number(row.visitors) }))
  }
}
