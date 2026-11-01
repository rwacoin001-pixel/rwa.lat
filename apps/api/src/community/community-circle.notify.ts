import type { EntityManager } from 'typeorm'
import { CIRCLE_MAX_DEPTH } from './community-circle.access'

type Queryable = Pick<EntityManager, 'query'>
export type CircleNoticeKind = 'community.circle.joined' | 'community.circle.request' | 'community.circle.rejected'

/** Title in Chinese, body in English, both languages again in payload.i18n (the same shape the notification feed uses). */
const TEXT: Record<CircleNoticeKind, { zhTitle: string; zhBody: string; enTitle: string; enBody: string }> = {
  'community.circle.joined': { zhTitle: "'你已加入 ' || c.name || ' 的圈子'", zhBody: "'你已加入圈子「' || c.name || '」'", enTitle: "'You joined ' || c.name", enBody: "'You joined ' || c.name" },
  'community.circle.request': { zhTitle: "c.name || ' 有新的加入申请'", zhBody: "'有人申请加入圈子「' || c.name || '」'", enTitle: "'New request to join ' || c.name", enBody: "'Someone asked to join ' || c.name" },
  'community.circle.rejected': { zhTitle: "'你加入 ' || c.name || ' 的申请未通过'", zhBody: "'圈主没有通过你加入「' || c.name || '」的申请'", enTitle: "'Your request to join ' || c.name || ' was not approved'", enBody: "'Your request to join ' || c.name || ' was not approved'" },
}

/** SELECT list (title, body, payload) for a notification about circle `c`; $extra is merged into the payload. */
function columns(kind: CircleNoticeKind, extra: string) {
  const t = TEXT[kind]
  return `${t.zhTitle}, ${t.enBody}, jsonb_build_object('circleId', c.id, 'circleName', c.name,
      'i18n', jsonb_build_object('zh', jsonb_build_object('title', ${t.zhTitle}, 'body', ${t.zhBody}),
                                 'en', jsonb_build_object('title', ${t.enTitle}, 'body', ${t.enBody}))) ${extra}`
}

/** One notification to one user about one live circle. `profileId` (the applicant) is added to request notices. */
export async function noticeUser(q: Queryable, kind: CircleNoticeKind, userId: string, circleId: string, extra?: { profileId: string }) {
  // `kind` is a closed union of constants, never user input, so it is safe to inline.
  await q.query(`INSERT INTO app.notifications(recipient_user_id, channel, kind, title, body, payload)
    SELECT $1::uuid, 'in_app', '${kind}', ${columns(kind, extra ? "|| jsonb_build_object('profileId', $3::text)" : '')}
    FROM app.community_circles c WHERE c.id = $2::uuid`, extra ? [userId, circleId, extra.profileId] : [userId, circleId])
}

/** A new circle: tell the owner's whole existing downline (any depth) in one set-based statement. */
export async function noticeDownlineJoined(q: Queryable, circleId: string) {
  await q.query(`WITH RECURSIVE down(uid, depth, path) AS (
      SELECT e.invitee_user_id, 1, ARRAY[e.invitee_user_id] FROM app.referral_edges e JOIN app.community_circles c ON c.id = $1::uuid AND e.inviter_user_id = c.owner_user_id
      UNION ALL SELECT e.invitee_user_id, d.depth + 1, d.path || e.invitee_user_id FROM down d
        JOIN app.referral_edges e ON e.inviter_user_id = d.uid WHERE d.depth < ${CIRCLE_MAX_DEPTH} AND NOT e.invitee_user_id = ANY(d.path))
    INSERT INTO app.notifications(recipient_user_id, channel, kind, title, body, payload)
    SELECT d.uid, 'in_app', 'community.circle.joined', ${columns('community.circle.joined', '')}
    FROM (SELECT DISTINCT uid FROM down) d JOIN app.community_circles c ON c.id = $1::uuid`, [circleId])
}

/** A new account bound to an inviter: one notification per live circle owned by any ancestor (same transaction as the binding). */
export async function noticeAncestorCircles(q: Queryable, newUserId: string) {
  const [{ ready }] = await q.query("SELECT to_regclass('app.community_circles') IS NOT NULL AS ready")
  if (!ready) return
  await q.query(`WITH RECURSIVE up(uid, depth, path) AS (
      SELECT e.inviter_user_id, 1, ARRAY[e.inviter_user_id] FROM app.referral_edges e WHERE e.invitee_user_id = $1::uuid
      UNION ALL SELECT e.inviter_user_id, up.depth + 1, up.path || e.inviter_user_id FROM up
        JOIN app.referral_edges e ON e.invitee_user_id = up.uid WHERE up.depth < ${CIRCLE_MAX_DEPTH} AND NOT e.inviter_user_id = ANY(up.path))
    INSERT INTO app.notifications(recipient_user_id, channel, kind, title, body, payload)
    SELECT $1::uuid, 'in_app', 'community.circle.joined', ${columns('community.circle.joined', '')}
    FROM up JOIN app.community_circles c ON c.owner_user_id = up.uid AND c.deleted_at IS NULL`, [newUserId])
}
