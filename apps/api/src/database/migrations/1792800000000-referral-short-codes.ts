import type { MigrationInterface, QueryRunner } from 'typeorm'
import { generateShortCode } from '../../referral/referral-code'

/**
 * Gives every system-generated 16-hex code a 6-character short code.
 * The old code stays in referral_code_aliases (immutable), so every issued link, poster and QR keeps resolving;
 * referral_edges and attributions are not touched. User-chosen codes (updated_at != created_at) are left alone,
 * and updated_at is kept equal to created_at so the user's own 30-day code change stays available.
 */
export class ReferralShortCodes1792800000000 implements MigrationInterface {
  name = 'ReferralShortCodes1792800000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query('SELECT pg_advisory_xact_lock(1790760000)')
    const rows: Array<{ user_id: string; code: string }> = await q.query(`SELECT user_id,code FROM app.referral_codes
      WHERE code ~ '^[a-f0-9]{16}$' AND updated_at=created_at ORDER BY created_at,user_id`)
    for (const row of rows) {
      let short: string
      do { short = generateShortCode() } while ((await q.query('SELECT 1 FROM app.referral_code_aliases WHERE code=$1', [short])).length)
      await q.query('INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)', [short, row.user_id])
      await q.query('UPDATE app.referral_codes SET code=$2 WHERE user_id=$1 AND code=$3', [row.user_id, short, row.code])
      await q.query(`INSERT INTO app.referral_audit(request_key,action,object_id,metadata) VALUES($1,'code.shortened',$2,$3)`,
        [`short-code:${row.user_id}:${short}`, row.user_id, JSON.stringify({ from: row.code, to: short })])
    }
  }

  /** Points each shortened user back at the old code. Short aliases stay (immutable, and links may already use them). */
  async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE app.referral_codes c SET code=a.metadata->>'from' FROM app.referral_audit a
      WHERE a.action='code.shortened' AND a.object_id=c.user_id AND c.code=a.metadata->>'to'`)
  }
}
