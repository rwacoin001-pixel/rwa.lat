import type { EntityManager } from 'typeorm'

/** Longest referral chain walked for circle membership; the referral graph is a forest, the cap is a safety bound. */
export const CIRCLE_MAX_DEPTH = 64

export type CircleRole = 'owner' | 'member'
type Queryable = Pick<EntityManager, 'query'>

/**
 * SQL predicate: user `$2` is a member of circle `c` (not the owner): the owner is an ancestor in the referral tree at any
 * depth, or the user is an approved link guest, and in both cases the user has not left or been removed.
 */
const MEMBER_OF_C = `(c.owner_user_id<>$2
        AND (EXISTS (WITH RECURSIVE up(uid,depth,path) AS (
            SELECT e.inviter_user_id,1,ARRAY[e.inviter_user_id] FROM app.referral_edges e WHERE e.invitee_user_id=$2
            UNION ALL
            SELECT e.inviter_user_id,up.depth+1,up.path||e.inviter_user_id FROM up
              JOIN app.referral_edges e ON e.invitee_user_id=up.uid
              WHERE up.depth<${CIRCLE_MAX_DEPTH} AND NOT e.inviter_user_id=ANY(up.path))
          SELECT 1 FROM up WHERE up.uid=c.owner_user_id)
          OR EXISTS (SELECT 1 FROM app.community_circle_guests g WHERE g.circle_id=c.id AND g.user_id=$2 AND g.status='member'))
        AND NOT EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=c.id AND o.user_id=$2))`

/**
 * The viewer's standing in a live circle: 'owner', 'member' (the owner is an ancestor in the referral tree at any depth, or the
 * viewer is an approved link guest, and in both cases has not left or been removed), or null. A deleted or unknown circle is null for everyone.
 */
export async function circleRole(q: Queryable, circleId: string, userId: string | null | undefined): Promise<CircleRole | null> {
  if (!userId) return null
  const [row] = await q.query(`SELECT c.owner_user_id=$2 AS owner,
      ${MEMBER_OF_C} AS member
    FROM app.community_circles c WHERE c.id=$1 AND c.deleted_at IS NULL`, [circleId, userId])
  if (!row) return null
  return row.owner ? 'owner' : row.member ? 'member' : null
}

/** Of these circles, the ones the viewer may see (owner or member), as { id, name }. Anonymous viewers see none. */
export async function visibleCircles(q: Queryable, circleIds: string[], userId: string | null | undefined): Promise<Map<string, { id: string; name: string }>> {
  const ids = [...new Set(circleIds)]
  if (!userId || !ids.length) return new Map()
  const rows: Array<{ id: string; name: string }> = await q.query(`SELECT c.id,c.name FROM app.community_circles c
    WHERE c.id=ANY($1::uuid[]) AND c.deleted_at IS NULL AND (c.owner_user_id=$2 OR ${MEMBER_OF_C})`, [ids, userId])
  return new Map(rows.map(row => [row.id, row]))
}

/** Mute is stored only (there is no new-post push yet); future notices should skip muted members through this. */
export async function isMuted(q: Queryable, circleId: string, userId: string): Promise<boolean> {
  const [row] = await q.query('SELECT muted FROM app.community_circle_member_settings WHERE circle_id=$1 AND user_id=$2', [circleId, userId])
  return row?.muted === true
}

/** A silenced member can read the circle but not post or comment in it. */
export async function isSilenced(q: Queryable, circleId: string, userId: string): Promise<boolean> {
  const [row] = await q.query('SELECT silenced FROM app.community_circle_member_settings WHERE circle_id=$1 AND user_id=$2', [circleId, userId])
  return row?.silenced === true
}
