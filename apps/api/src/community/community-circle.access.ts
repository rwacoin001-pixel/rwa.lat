import type { EntityManager } from 'typeorm'

/** Longest referral chain walked for circle membership; the referral graph is a forest, the cap is a safety bound. */
export const CIRCLE_MAX_DEPTH = 64

export type CircleRole = 'owner' | 'member'
type Queryable = Pick<EntityManager, 'query'>

/**
 * The viewer's standing in a live circle: 'owner', 'member' (the owner is an ancestor in the referral tree at any depth, or the
 * viewer is an approved link guest, and in both cases has not left or been removed), or null. A deleted or unknown circle is null for everyone.
 */
export async function circleRole(q: Queryable, circleId: string, userId: string | null | undefined): Promise<CircleRole | null> {
  if (!userId) return null
  const [row] = await q.query(`SELECT c.owner_user_id=$2 AS owner,
      (c.owner_user_id<>$2
        AND (EXISTS (WITH RECURSIVE up(uid,depth,path) AS (
            SELECT e.inviter_user_id,1,ARRAY[e.inviter_user_id] FROM app.referral_edges e WHERE e.invitee_user_id=$2
            UNION ALL
            SELECT e.inviter_user_id,up.depth+1,up.path||e.inviter_user_id FROM up
              JOIN app.referral_edges e ON e.invitee_user_id=up.uid
              WHERE up.depth<${CIRCLE_MAX_DEPTH} AND NOT e.inviter_user_id=ANY(up.path))
          SELECT 1 FROM up WHERE up.uid=c.owner_user_id)
          OR EXISTS (SELECT 1 FROM app.community_circle_guests g WHERE g.circle_id=c.id AND g.user_id=$2 AND g.status='member'))
        AND NOT EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=c.id AND o.user_id=$2)) AS member
    FROM app.community_circles c WHERE c.id=$1 AND c.deleted_at IS NULL`, [circleId, userId])
  if (!row) return null
  return row.owner ? 'owner' : row.member ? 'member' : null
}
