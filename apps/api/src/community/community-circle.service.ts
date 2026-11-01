import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource, EntityManager } from 'typeorm'
import { CIRCLE_MAX_DEPTH, circleRole, type CircleRole } from './community-circle.access'
import { CommunityService } from './community.service'
import { CirclePageQueryDto } from './community-circle.dto'
import { CommunityFeedQueryDto } from './dto/community.dto'

type CircleRow = { id: string; name: string; owner_user_id: string; owner_profile_id: string; created_at: Date }
type Profiles = Awaited<ReturnType<CommunityService['profileViews']>>

/** Upward walk: every ancestor of $1 in the referral tree (inviter chain), nearest first. Cycle-safe and depth-capped. */
const UP = `WITH RECURSIVE up(uid,depth,path) AS (
    SELECT e.inviter_user_id,1,ARRAY[e.inviter_user_id] FROM app.referral_edges e WHERE e.invitee_user_id=$1
    UNION ALL SELECT e.inviter_user_id,up.depth+1,up.path||e.inviter_user_id FROM up
      JOIN app.referral_edges e ON e.invitee_user_id=up.uid WHERE up.depth<${CIRCLE_MAX_DEPTH} AND NOT e.inviter_user_id=ANY(up.path))`
/** Downward walk: the whole downline of $1 at any depth. */
const DOWN = `WITH RECURSIVE down(uid,depth,path,bound_at) AS (
    SELECT e.invitee_user_id,1,ARRAY[e.invitee_user_id],e.bound_at FROM app.referral_edges e WHERE e.inviter_user_id=$1
    UNION ALL SELECT e.invitee_user_id,d.depth+1,d.path||e.invitee_user_id,e.bound_at FROM down d
      JOIN app.referral_edges e ON e.inviter_user_id=d.uid WHERE d.depth<${CIRCLE_MAX_DEPTH} AND NOT e.invitee_user_id=ANY(d.path))`
const VISIBLE_PROFILE = `p.kind='member' AND p.identity_configured AND p.is_active`

@Injectable()
export class CommunityCircleService {
  constructor(private readonly db: DataSource, private readonly community: CommunityService) {}

  private async myProfile(m: EntityManager, userId: string) {
    await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`community-circle:${userId}`])
    const [p] = await m.query(`SELECT p.id,p.user_id FROM app.community_profiles p JOIN app.users u ON u.id=p.user_id
      WHERE p.user_id=$1 AND p.identity_configured AND p.is_active AND u.status='active'`, [userId])
    if (!p) throw new ConflictException({ code: 'COMMUNITY_IDENTITY_REQUIRED', message: 'Set up your community identity to use circles.' })
    return p as { id: string; user_id: string }
  }
  private async memberCount(q: Pick<EntityManager, 'query'>, circle: CircleRow): Promise<number> {
    const [{ n }] = await q.query(`${DOWN} SELECT count(*)::int AS n FROM down d JOIN app.community_profiles p ON p.user_id=d.uid AND ${VISIBLE_PROFILE}
      WHERE NOT EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=$2 AND o.user_id=d.uid)`, [circle.owner_user_id, circle.id])
    return n + 1
  }
  private async shape(q: Pick<EntityManager, 'query'>, rows: CircleRow[], viewerId: string) {
    const profiles: Profiles = await this.community.profileViews(rows.map(r => r.owner_profile_id))
    return Promise.all(rows.map(async r => ({
      id: r.id, name: r.name, owner: profiles.get(r.owner_profile_id) ?? null,
      memberCount: await this.memberCount(q, r), createdAt: r.created_at, isOwner: r.owner_user_id === viewerId,
    })))
  }
  /** Members and the owner see the circle; everyone else gets 404, as does a deleted circle. */
  private async require(q: Pick<EntityManager, 'query'>, circleId: string, userId: string): Promise<CircleRole> {
    const role = await circleRole(q, circleId, userId)
    if (!role) throw new NotFoundException('CIRCLE_NOT_FOUND')
    return role
  }
  private async load(q: Pick<EntityManager, 'query'>, circleId: string): Promise<CircleRow> {
    const [row] = await q.query('SELECT id,name,owner_user_id,owner_profile_id,created_at FROM app.community_circles WHERE id=$1 AND deleted_at IS NULL', [circleId])
    if (!row) throw new NotFoundException('CIRCLE_NOT_FOUND')
    return row
  }
  private async inDownline(q: Pick<EntityManager, 'query'>, ownerUserId: string, userId: string) {
    const rows = await q.query(`${UP} SELECT 1 FROM up WHERE uid=$2 LIMIT 1`, [userId, ownerUserId])
    return rows.length > 0
  }

  /** Owned circle, circles I belong to through an ancestor, and the ones I left (so I can rejoin). Removed circles are not listed. */
  async mine(userId: string) {
    const { owned, joined, left } = await this.db.transaction(async m => {
      const [owned]: CircleRow[] = await m.query('SELECT id,name,owner_user_id,owner_profile_id,created_at FROM app.community_circles WHERE owner_user_id=$1 AND deleted_at IS NULL', [userId])
      const ancestors = (reason: 'none' | 'left'): Promise<CircleRow[]> => m.query(`${UP}
        SELECT c.id,c.name,c.owner_user_id,c.owner_profile_id,c.created_at FROM up JOIN app.community_circles c ON c.owner_user_id=up.uid AND c.deleted_at IS NULL
        WHERE ${reason === 'none'
          ? 'NOT EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=c.id AND o.user_id=$1)'
          : "EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=c.id AND o.user_id=$1 AND o.reason='left')"}
        ORDER BY up.depth LIMIT 100`, [userId])
      const [joined, left] = await Promise.all([ancestors('none'), ancestors('left')])
      return { owned: owned ?? null, joined, left }
    })
    const shaped = await this.shape(this.db, [...(owned ? [owned] : []), ...joined, ...left], userId)
    const byId = new Map(shaped.map(c => [c.id, c]))
    return { owned: owned ? byId.get(owned.id)! : null, joined: joined.map(c => byId.get(c.id)!), left: left.map(c => byId.get(c.id)!) }
  }

  create(userId: string, name: string) {
    return this.db.transaction(async m => {
      const p = await this.myProfile(m, userId)
      const [existing] = await m.query('SELECT 1 FROM app.community_circles WHERE owner_user_id=$1 AND deleted_at IS NULL', [userId])
      if (existing) throw new ConflictException({ code: 'CIRCLE_ALREADY_OWNED', message: 'You already have a circle.' })
      const [row]: CircleRow[] = await m.query(`INSERT INTO app.community_circles(owner_user_id,owner_profile_id,name) VALUES($1,$2,$3)
        RETURNING id,name,owner_user_id,owner_profile_id,created_at`, [userId, p.id, name])
      return (await this.shape(m, [row], userId))[0]
    })
  }

  rename(userId: string, circleId: string, name: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      const role = await this.require(m, circleId, userId)
      if (role !== 'owner') throw new ForbiddenException({ code: 'CIRCLE_OWNER_ONLY', message: 'Only the owner can do this.' })
      const [row]: CircleRow[] = await m.query(`UPDATE app.community_circles SET name=$2,updated_at=now() WHERE id=$1 AND deleted_at IS NULL
        RETURNING id,name,owner_user_id,owner_profile_id,created_at`, [circleId, name])
      return (await this.shape(m, [row], userId))[0]
    })
  }

  /** Soft delete: the circle's posts stay in the table but nobody is a member of a deleted circle, so they are hidden. */
  remove(userId: string, circleId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      const role = await this.require(m, circleId, userId)
      if (role !== 'owner') throw new ForbiddenException({ code: 'CIRCLE_OWNER_ONLY', message: 'Only the owner can do this.' })
      await m.query('UPDATE app.community_circles SET deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL', [circleId])
      return { id: circleId, deleted: true }
    })
  }

  async feed(userId: string, circleId: string, query: CommunityFeedQueryDto) {
    await this.require(this.db, circleId, userId)
    return this.community.getFeed({ ...query, sort: 'latest', topic: undefined }, undefined, circleId)
  }

  async members(userId: string, circleId: string, query: CirclePageQueryDto) {
    await this.require(this.db, circleId, userId)
    const circle = await this.load(this.db, circleId)
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 50)
    const offset = query.cursor ? /^o:(\d{1,7})$/.exec(query.cursor)?.[1] : '0'
    if (offset === undefined) throw new BadRequestException('COMMUNITY_CURSOR_INVALID')
    const rows: Array<{ profile_id: string; depth: number }> = await this.db.query(`${DOWN}
      SELECT p.id AS profile_id,d.depth FROM down d JOIN app.community_profiles p ON p.user_id=d.uid AND ${VISIBLE_PROFILE}
      WHERE NOT EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=$2 AND o.user_id=d.uid)
      ORDER BY d.depth,d.bound_at,p.id OFFSET $3 LIMIT $4`, [circle.owner_user_id, circleId, Number(offset), limit + 1])
    const page = rows.slice(0, limit)
    const profiles = await this.community.profileViews(page.map(r => r.profile_id))
    return {
      items: page.filter(r => profiles.has(r.profile_id)).map(r => ({ profile: profiles.get(r.profile_id)!, depth: r.depth })),
      nextCursor: rows.length > limit ? `o:${Number(offset) + limit}` : null,
    }
  }

  leave(userId: string, circleId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      const [mine] = await m.query('SELECT reason FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2', [circleId, userId])
      const role = await circleRole(m, circleId, userId)
      if (role === 'owner') throw new BadRequestException({ code: 'CIRCLE_OWNER_CANNOT_LEAVE', message: 'Delete the circle instead of leaving it.' })
      if (role === 'member') await m.query("INSERT INTO app.community_circle_optouts(circle_id,user_id,reason) VALUES($1,$2,'left') ON CONFLICT DO NOTHING", [circleId, userId])
      else if (!mine) throw new NotFoundException('CIRCLE_NOT_FOUND')
      return { id: circleId, left: true }
    })
  }

  rejoin(userId: string, circleId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      const circle = await this.load(m, circleId)
      const [optout] = await m.query('SELECT reason FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2', [circleId, userId])
      if (circle.owner_user_id === userId || !await this.inDownline(m, circle.owner_user_id, userId)) throw new NotFoundException('CIRCLE_NOT_FOUND')
      if (optout?.reason === 'removed') throw new ForbiddenException({ code: 'CIRCLE_REMOVED', message: 'The owner removed you from this circle.' })
      if (optout) await m.query('DELETE FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2', [circleId, userId])
      return { id: circleId, joined: true }
    })
  }

  /** Owner removes someone from the downline view. They are never re-added automatically and cannot rejoin themselves. */
  removeMember(userId: string, circleId: string, profileId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      const role = await this.require(m, circleId, userId)
      if (role !== 'owner') throw new ForbiddenException({ code: 'CIRCLE_OWNER_ONLY', message: 'Only the owner can do this.' })
      const [target] = await m.query(`SELECT user_id FROM app.community_profiles p WHERE p.id=$1 AND p.user_id IS NOT NULL`, [profileId])
      if (!target || target.user_id === userId || !await this.inDownline(m, userId, target.user_id)) throw new NotFoundException('CIRCLE_MEMBER_NOT_FOUND')
      await m.query(`INSERT INTO app.community_circle_optouts(circle_id,user_id,reason) VALUES($1,$2,'removed')
        ON CONFLICT (circle_id,user_id) DO UPDATE SET reason='removed'`, [circleId, target.user_id])
      return { id: circleId, profileId, removed: true }
    })
  }
}
