import { randomBytes, randomInt } from 'node:crypto'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource, EntityManager } from 'typeorm'
import { CIRCLE_MAX_DEPTH, circleRole, type CircleRole } from './community-circle.access'
import { noticeDownlineJoined, noticeUser } from './community-circle.notify'
import { CommunityService } from './community.service'
import { CirclePageQueryDto, CircleUpdateDto } from './community-circle.dto'
import { CommunityFeedQueryDto } from './dto/community.dto'

type CircleRow = { id: string; name: string; owner_user_id: string; owner_profile_id: string; created_at: Date; invite_code: string; public_no: number; searchable: boolean; pinned_post_id: string | null }
type Profiles = Awaited<ReturnType<CommunityService['profileViews']>>
type Q = Pick<EntityManager, 'query'>
export type InviteStatus = 'none' | 'pending' | 'member' | 'owner' | 'removed' | 'rejected'

const COLUMNS = 'id,name,owner_user_id,owner_profile_id,created_at,invite_code,public_no,searchable,pinned_post_id'
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
/** Everyone who may be in a circle ($1 = owner user, $2 = circle): the owner's downline, plus approved link guests (not their invitees). */
const MEMBERS = `${DOWN}, members(uid,depth,via,at) AS (
    SELECT d.uid,d.depth,'tree'::text,d.bound_at FROM down d
    UNION ALL SELECT g.user_id,0,'link'::text,g.decided_at FROM app.community_circle_guests g
      WHERE g.circle_id=$2 AND g.status='member' AND g.user_id NOT IN (SELECT uid FROM down))`
/** Circle rosters include active invitees before they set up their community identity. */
const MEMBER_PROFILE = `p.kind='member' AND p.is_active`
const NOT_OPTED_OUT = (uid: string) => `NOT EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=$2 AND o.user_id=${uid})`
const newInviteCode = () => randomBytes(9).toString('base64url').slice(0, 10)
/** Pattern for ILIKE ... ESCAPE '\': the user's text with %, _ and \ made literal. */
const likeContains = (text: string) => `%${text.replace(/[\\%_]/g, m => '\\' + m)}%`
const likePrefix = (text: string) => `${text.replace(/[\\%_]/g, m => '\\' + m)}%`

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
  private async memberCount(q: Q, circle: CircleRow): Promise<number> {
    const [{ n }] = await q.query(`${MEMBERS} SELECT count(*)::int AS n FROM members m JOIN app.community_profiles p ON p.user_id=m.uid AND ${MEMBER_PROFILE}
      WHERE ${NOT_OPTED_OUT('m.uid')}`, [circle.owner_user_id, circle.id])
    return n + 1
  }
  /**
   * The circle object for its members (and owner): public number, the viewer's own mute / silence, the latest visible post
   * time, and, when asked, the pinned post. `searchable` is the owner's setting and is only shown to the owner.
   */
  private async shape(q: Q, rows: CircleRow[], viewerId: string, opts: { pinned?: boolean } = {}) {
    if (!rows.length) return []
    const ids = rows.map(r => r.id)
    const profiles: Profiles = await this.community.profileViews(rows.map(r => r.owner_profile_id))
    const [settings, latest, pinned] = await Promise.all([
      q.query('SELECT circle_id,muted,silenced FROM app.community_circle_member_settings WHERE user_id=$1 AND circle_id=ANY($2::uuid[])', [viewerId, ids]) as Promise<Array<{ circle_id: string; muted: boolean; silenced: boolean }>>,
      q.query("SELECT circle_id,max(published_at) AS at FROM app.community_posts WHERE circle_id=ANY($1::uuid[]) AND state='published' GROUP BY circle_id", [ids]) as Promise<Array<{ circle_id: string; at: Date | null }>>,
      opts.pinned ? this.community.postViews(rows.map(r => r.pinned_post_id).filter((id): id is string => !!id), viewerId) : Promise.resolve(new Map<string, Record<string, unknown>>()),
    ])
    const mine = new Map(settings.map(s => [s.circle_id, s]))
    const last = new Map(latest.map(l => [l.circle_id, l.at]))
    return Promise.all(rows.map(async r => ({
      id: r.id, name: r.name, owner: profiles.get(r.owner_profile_id) ?? null, publicNo: r.public_no,
      memberCount: await this.memberCount(q, r), createdAt: r.created_at, isOwner: r.owner_user_id === viewerId,
      ...(r.owner_user_id === viewerId ? { searchable: r.searchable } : {}),
      muted: mine.get(r.id)?.muted ?? false, silenced: mine.get(r.id)?.silenced ?? false, lastPostAt: last.get(r.id) ?? null,
      ...(opts.pinned ? { pinnedPost: r.pinned_post_id ? pinned.get(r.pinned_post_id) ?? null : null } : {}),
    })))
  }
  /** Members and the owner see the circle; everyone else gets 404, as does a deleted circle. */
  private async require(q: Q, circleId: string, userId: string): Promise<CircleRole> {
    const role = await circleRole(q, circleId, userId)
    if (!role) throw new NotFoundException('CIRCLE_NOT_FOUND')
    return role
  }
  private async requireOwner(q: Q, circleId: string, userId: string) {
    const role = await this.require(q, circleId, userId)
    if (role !== 'owner') throw new ForbiddenException({ code: 'CIRCLE_OWNER_ONLY', message: 'Only the owner can do this.' })
  }
  private async load(q: Q, circleId: string): Promise<CircleRow> {
    const [row] = await q.query(`SELECT ${COLUMNS} FROM app.community_circles WHERE id=$1 AND deleted_at IS NULL`, [circleId])
    if (!row) throw new NotFoundException('CIRCLE_NOT_FOUND')
    return row
  }
  private async inDownline(q: Q, ownerUserId: string, userId: string) {
    const rows = await q.query(`${UP} SELECT 1 FROM up WHERE uid=$2 LIMIT 1`, [userId, ownerUserId])
    return rows.length > 0
  }
  private async profileUser(q: Q, profileId: string): Promise<string> {
    const [target] = await q.query('SELECT user_id FROM app.community_profiles p WHERE p.id=$1 AND p.user_id IS NOT NULL', [profileId])
    if (!target) throw new NotFoundException('CIRCLE_MEMBER_NOT_FOUND')
    return target.user_id
  }

  /** Owned circle (with invite code and pending requests), circles I belong to (through an ancestor or the invite link), and the ones I left. */
  async mine(userId: string) {
    const { owned, joined, left, pending } = await this.db.transaction(async m => {
      const [owned]: CircleRow[] = await m.query(`SELECT ${COLUMNS} FROM app.community_circles WHERE owner_user_id=$1 AND deleted_at IS NULL`, [userId])
      const columns = COLUMNS.split(',').map(c => `c.${c}`).join(',')
      const ancestors = (reason: 'none' | 'left'): Promise<CircleRow[]> => m.query(`${UP}
        SELECT ${columns},up.depth AS depth FROM up JOIN app.community_circles c ON c.owner_user_id=up.uid AND c.deleted_at IS NULL
        WHERE ${reason === 'none'
          ? 'NOT EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=c.id AND o.user_id=$1)'
          : "EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=c.id AND o.user_id=$1 AND o.reason='left')"}
        ${reason === 'none' ? `UNION ALL SELECT ${columns},1000 AS depth FROM app.community_circle_guests g JOIN app.community_circles c ON c.id=g.circle_id AND c.deleted_at IS NULL
          WHERE g.user_id=$1 AND g.status='member' AND NOT EXISTS (SELECT 1 FROM app.community_circle_optouts o WHERE o.circle_id=c.id AND o.user_id=$1)` : ''}
        ORDER BY depth LIMIT 100`, [userId])
      const [joined, left] = await Promise.all([ancestors('none'), ancestors('left')])
      const pending = owned ? (await m.query("SELECT count(*)::int AS n FROM app.community_circle_guests WHERE circle_id=$1 AND status='pending'", [owned.id]))[0].n as number : 0
      return { owned: owned ?? null, joined, left, pending }
    })
    const shaped = await this.shape(this.db, [...(owned ? [owned] : []), ...joined, ...left], userId, { pinned: true })
    const byId = new Map(shaped.map(c => [c.id, c]))
    return {
      owned: owned ? { ...byId.get(owned.id)!, inviteCode: owned.invite_code, pendingCount: pending } : null,
      joined: joined.map(c => byId.get(c.id)!), left: left.map(c => byId.get(c.id)!),
    }
  }

  /** A free 6-digit public number; the lock keeps two simultaneous creations from picking the same one. */
  private async freePublicNo(m: EntityManager): Promise<number> {
    await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['community-circle-public-no'])
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = randomInt(100000, 1000000)
      if (!(await m.query('SELECT 1 FROM app.community_circles WHERE public_no=$1', [candidate])).length) return candidate
    }
    throw new ConflictException({ code: 'CIRCLE_NUMBER_UNAVAILABLE', message: 'Please try again.' })
  }

  create(userId: string, name: string) {
    return this.db.transaction(async m => {
      const p = await this.myProfile(m, userId)
      const [existing] = await m.query('SELECT 1 FROM app.community_circles WHERE owner_user_id=$1 AND deleted_at IS NULL', [userId])
      if (existing) throw new ConflictException({ code: 'CIRCLE_ALREADY_OWNED', message: 'You already have a circle.' })
      const publicNo = await this.freePublicNo(m)
      const [row]: CircleRow[] = await m.query(`INSERT INTO app.community_circles(owner_user_id,owner_profile_id,name,invite_code,public_no) VALUES($1,$2,$3,$4,$5)
        RETURNING ${COLUMNS}`, [userId, p.id, name, newInviteCode(), publicNo])
      await noticeDownlineJoined(m, row.id)
      return { ...(await this.shape(m, [row], userId, { pinned: true }))[0], inviteCode: row.invite_code, pendingCount: 0 }
    })
  }

  /** Owner edits: the name and/or whether the circle can be found by name search. */
  async update(userId: string, circleId: string, input: CircleUpdateDto) {
    if (input.name === undefined && input.searchable === undefined) throw new BadRequestException('Nothing to change')
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      const [row]: CircleRow[] = await m.query(`UPDATE app.community_circles SET name=COALESCE($2,name),searchable=COALESCE($3,searchable),updated_at=now()
        WHERE id=$1 AND deleted_at IS NULL RETURNING ${COLUMNS}`, [circleId, input.name ?? null, input.searchable ?? null])
      return (await this.shape(m, [row], userId, { pinned: true }))[0]
    })
  }

  /** Soft delete: the circle's posts stay in the table but nobody is a member of a deleted circle, so they are hidden. */
  remove(userId: string, circleId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      await m.query('UPDATE app.community_circles SET deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL', [circleId])
      return { id: circleId, deleted: true }
    })
  }

  /** The circle's posts (circle-only and synced), newest first; the first page also carries the pinned post (it stays in items too). */
  async feed(userId: string, circleId: string, query: CommunityFeedQueryDto) {
    await this.require(this.db, circleId, userId)
    const page = await this.community.getFeed({ ...query, sort: 'latest', topic: undefined }, undefined, circleId, { viewerId: userId })
    let pinnedPost: Record<string, unknown> | null = null
    if (!query.cursor) {
      const circle = await this.load(this.db, circleId)
      if (circle.pinned_post_id) pinnedPost = (await this.community.postViews([circle.pinned_post_id], userId)).get(circle.pinned_post_id) ?? null
    }
    return { ...page, pinnedPost }
  }

  async members(userId: string, circleId: string, query: CirclePageQueryDto, search?: string) {
    await this.require(this.db, circleId, userId)
    const circle = await this.load(this.db, circleId)
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 50)
    const offset = query.cursor ? /^o:(\d{1,7})$/.exec(query.cursor)?.[1] : '0'
    if (offset === undefined) throw new BadRequestException('COMMUNITY_CURSOR_INVALID')
    const params: unknown[] = [circle.owner_user_id, circleId, Number(offset), limit + 1]
    if (search) params.push(likeContains(search))
    const rows: Array<{ profile_id: string; identity_configured: boolean; depth: number; via: 'tree' | 'link'; silenced: boolean }> = await this.db.query(`${MEMBERS}
      SELECT p.id AS profile_id,p.identity_configured,m.depth,m.via,COALESCE(s.silenced,false) AS silenced FROM members m JOIN app.community_profiles p ON p.user_id=m.uid AND ${MEMBER_PROFILE}
      LEFT JOIN app.community_circle_member_settings s ON s.circle_id=$2 AND s.user_id=m.uid
      WHERE ${NOT_OPTED_OUT('m.uid')}${search ? " AND (p.display_name ILIKE $5 ESCAPE '\\' OR p.handle ILIKE $5 ESCAPE '\\')" : ''}
      ORDER BY (m.via='link'),m.depth,m.at,p.id OFFSET $3 LIMIT $4`, params)
    const page = rows.slice(0, limit)
    const profiles = await this.community.profileViews(page.map(r => r.profile_id))
    return {
      items: page.filter(r => profiles.has(r.profile_id)).map(r => ({ profile: profiles.get(r.profile_id)!, identityConfigured: r.identity_configured, depth: r.depth, via: r.via, silenced: r.silenced })),
      nextCursor: rows.length > limit ? `o:${Number(offset) + limit}` : null,
    }
  }

  /** Search inside one circle (members only): its own posts, or its members by name / handle. Never reaches other circles. */
  async innerSearch(userId: string, circleId: string, q: string, type: 'posts' | 'members', cursor?: string) {
    await this.require(this.db, circleId, userId)
    if (type === 'members') return this.members(userId, circleId, { cursor, limit: 20 }, q)
    return this.community.getFeed({ cursor, limit: 20, sort: 'latest' }, undefined, circleId, { viewerId: userId, search: q })
  }

  /** A tree member opts out (and may rejoin themself); a link guest is simply removed from the guest list and must apply again. */
  leave(userId: string, circleId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      const [mine] = await m.query('SELECT reason FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2', [circleId, userId])
      const role = await circleRole(m, circleId, userId)
      if (role === 'owner') throw new BadRequestException({ code: 'CIRCLE_OWNER_CANNOT_LEAVE', message: 'Delete the circle instead of leaving it.' })
      if (role === 'member') {
        const guest = await m.query("DELETE FROM app.community_circle_guests WHERE circle_id=$1 AND user_id=$2 AND status='member' RETURNING 1", [circleId, userId])
        if (!guest.length) await m.query("INSERT INTO app.community_circle_optouts(circle_id,user_id,reason) VALUES($1,$2,'left') ON CONFLICT DO NOTHING", [circleId, userId])
      } else if (!mine) throw new NotFoundException('CIRCLE_NOT_FOUND')
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

  /** Owner removes a member (tree or link guest). They are never re-added automatically and cannot rejoin themselves until restored. */
  removeMember(userId: string, circleId: string, profileId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      const target = await this.profileUser(m, profileId)
      const guest = target === userId ? [] : await m.query("SELECT 1 FROM app.community_circle_guests WHERE circle_id=$1 AND user_id=$2 AND status='member'", [circleId, target])
      if (target === userId || (!guest.length && !await this.inDownline(m, userId, target))) throw new NotFoundException('CIRCLE_MEMBER_NOT_FOUND')
      await m.query(`INSERT INTO app.community_circle_optouts(circle_id,user_id,reason) VALUES($1,$2,'removed')
        ON CONFLICT (circle_id,user_id) DO UPDATE SET reason='removed'`, [circleId, target])
      return { id: circleId, profileId, removed: true }
    })
  }

  /** People the owner removed (not those who left themselves), newest first. */
  async removed(userId: string, circleId: string) {
    await this.requireOwner(this.db, circleId, userId)
    const rows: Array<{ profile_id: string; identity_configured: boolean; at: Date }> = await this.db.query(`SELECT p.id AS profile_id,p.identity_configured,o.created_at AS at FROM app.community_circle_optouts o
      JOIN app.community_profiles p ON p.user_id=o.user_id AND ${MEMBER_PROFILE} WHERE o.circle_id=$1 AND o.reason='removed' ORDER BY o.created_at DESC LIMIT 200`, [circleId])
    const profiles = await this.community.profileViews(rows.map(r => r.profile_id))
    return { items: rows.filter(r => profiles.has(r.profile_id)).map(r => ({ profile: profiles.get(r.profile_id)!, identityConfigured: r.identity_configured, removedAt: r.at })) }
  }

  /** Undo a removal. A tree member is back in via the tree, a link guest via the guest row that was kept. */
  restore(userId: string, circleId: string, profileId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      const target = await this.profileUser(m, profileId)
      const done = await m.query("DELETE FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2 AND reason='removed' RETURNING 1", [circleId, target])
      if (!done.length) throw new NotFoundException('CIRCLE_MEMBER_NOT_FOUND')
      return { id: circleId, profileId, restored: true }
    })
  }

  // ---- member settings and moderation ----

  /** Stores the viewer's mute only (there is no new-post push yet). */
  mute(userId: string, circleId: string, muted: boolean) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.require(m, circleId, userId)
      await m.query(`INSERT INTO app.community_circle_member_settings(circle_id,user_id,muted) VALUES($1,$2,$3)
        ON CONFLICT (circle_id,user_id) DO UPDATE SET muted=EXCLUDED.muted`, [circleId, userId, muted])
      return { id: circleId, muted }
    })
  }

  /** Owner silences a member: they still read the circle but cannot post or comment in it. */
  silence(userId: string, circleId: string, profileId: string, silenced: boolean) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      const target = await this.profileUser(m, profileId)
      if (silenced) {
        if (await circleRole(m, circleId, target) !== 'member') throw new NotFoundException('CIRCLE_MEMBER_NOT_FOUND')
        await m.query(`INSERT INTO app.community_circle_member_settings(circle_id,user_id,silenced,silenced_at) VALUES($1,$2,true,now())
          ON CONFLICT (circle_id,user_id) DO UPDATE SET silenced=true,silenced_at=now()`, [circleId, target])
      } else {
        await m.query('UPDATE app.community_circle_member_settings SET silenced=false,silenced_at=NULL WHERE circle_id=$1 AND user_id=$2', [circleId, target])
      }
      return { id: circleId, profileId, silenced }
    })
  }

  // ---- pin ----

  pin(userId: string, circleId: string, postId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      const post = await m.query("SELECT 1 FROM app.community_posts WHERE id=$1 AND circle_id=$2 AND state='published'", [postId, circleId])
      if (!post.length) throw new NotFoundException({ code: 'CIRCLE_POST_NOT_FOUND', message: 'That post is not in this circle.' })
      await m.query('UPDATE app.community_circles SET pinned_post_id=$2,updated_at=now() WHERE id=$1', [circleId, postId])
      return { id: circleId, pinned: true, postId }
    })
  }
  unpin(userId: string, circleId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      await m.query('UPDATE app.community_circles SET pinned_post_id=NULL,updated_at=now() WHERE id=$1', [circleId])
      return { id: circleId, pinned: false }
    })
  }

  // ---- finding circles and invite link ----

  private async byCode(q: Q, code: string): Promise<CircleRow> {
    const [row] = /^[A-Za-z0-9_-]{10}$/.test(code)
      ? await q.query(`SELECT ${COLUMNS} FROM app.community_circles WHERE invite_code=$1 AND deleted_at IS NULL`, [code]) : []
    if (!row) throw new NotFoundException({ code: 'CIRCLE_INVITE_NOT_FOUND', message: 'This invite link is not valid any more.' })
    return row
  }
  private async standing(q: Q, circle: CircleRow, userId: string | undefined): Promise<InviteStatus> {
    if (!userId) return 'none'
    if (circle.owner_user_id === userId) return 'owner'
    const [optout] = await q.query('SELECT reason FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2', [circle.id, userId])
    if (optout?.reason === 'removed') return 'removed'
    if (await circleRole(q, circle.id, userId) === 'member') return 'member'
    const [guest] = await q.query('SELECT status FROM app.community_circle_guests WHERE circle_id=$1 AND user_id=$2', [circle.id, userId])
    return guest?.status === 'pending' ? 'pending' : guest?.status === 'rejected' ? 'rejected' : 'none'
  }
  /** The public face of a circle (what search results and the invite page show). */
  private async face(q: Q, circle: CircleRow, profiles: Profiles) {
    return { id: circle.id, name: circle.name, owner: profiles.get(circle.owner_profile_id) ?? null, memberCount: await this.memberCount(q, circle), publicNo: circle.public_no }
  }

  /** What the invite page shows: the circle's public face and where the viewer stands. Anonymous viewers are 'none'. */
  async inviteInfo(userId: string | undefined, code: string) {
    const circle = await this.byCode(this.db, code)
    const profiles = await this.community.profileViews([circle.owner_profile_id])
    return { circle: await this.face(this.db, circle, profiles), status: await this.standing(this.db, circle, userId) }
  }

  /**
   * Find circles to ask to join. Exactly six digits is a public number: it finds that circle even when it is not listed.
   * Anything else is a name search over circles whose owner allows it. Deleted circles never match.
   */
  async search(userId: string, text: string) {
    const q = text.trim()
    if (!q) return { items: [] }
    const rows: CircleRow[] = /^\d{6}$/.test(q)
      ? await this.db.query(`SELECT ${COLUMNS} FROM app.community_circles WHERE public_no=$1 AND deleted_at IS NULL`, [Number(q)])
      : await this.db.query(`SELECT ${COLUMNS} FROM app.community_circles WHERE deleted_at IS NULL AND searchable AND name ILIKE $1 ESCAPE '\\'
          ORDER BY (lower(name)=lower($2)) DESC,(name ILIKE $3 ESCAPE '\\') DESC,created_at DESC LIMIT 20`, [likeContains(q), q, likePrefix(q)])
    const profiles = await this.community.profileViews(rows.map(r => r.owner_profile_id))
    const items = await Promise.all(rows.map(async r => ({ circle: await this.face(this.db, r, profiles), status: await this.standing(this.db, r, userId) })))
    return { items }
  }

  /** Apply through the link or by id. Tree members just come back in; everyone else waits for the owner (a rejected person may ask again). */
  private async applyTo(m: EntityManager, circle: CircleRow, userId: string, me: { id: string }) {
    if (circle.owner_user_id === userId) return { status: 'owner' as const }
    const [optout] = await m.query('SELECT reason FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2', [circle.id, userId])
    if (optout?.reason === 'removed') throw new ForbiddenException({ code: 'CIRCLE_REMOVED', message: 'The owner removed you from this circle.' })
    if (await this.inDownline(m, circle.owner_user_id, userId)) {
      if (optout) await m.query('DELETE FROM app.community_circle_optouts WHERE circle_id=$1 AND user_id=$2', [circle.id, userId])
      return { status: 'member' as const }
    }
    const [guest] = await m.query('SELECT status FROM app.community_circle_guests WHERE circle_id=$1 AND user_id=$2', [circle.id, userId])
    if (guest?.status === 'member') return { status: 'member' as const }
    if (guest?.status === 'pending') return { status: 'pending' as const }
    await m.query(`INSERT INTO app.community_circle_guests(circle_id,user_id,status) VALUES($1,$2,'pending')
      ON CONFLICT (circle_id,user_id) DO UPDATE SET status='pending',created_at=now(),decided_at=NULL`, [circle.id, userId])
    await noticeUser(m, 'community.circle.request', circle.owner_user_id, circle.id, { profileId: me.id })
    return { status: 'pending' as const }
  }
  apply(userId: string, code: string) {
    return this.db.transaction(async m => {
      const me = await this.myProfile(m, userId)
      return this.applyTo(m, await this.byCode(m, code), userId, me)
    })
  }
  applyById(userId: string, circleId: string) {
    return this.db.transaction(async m => {
      const me = await this.myProfile(m, userId)
      return this.applyTo(m, await this.load(m, circleId), userId, me)
    })
  }

  /** Pending applicants, oldest first. */
  async requests(userId: string, circleId: string) {
    await this.requireOwner(this.db, circleId, userId)
    const rows: Array<{ profile_id: string; identity_configured: boolean; at: Date }> = await this.db.query(`SELECT p.id AS profile_id,p.identity_configured,g.created_at AS at FROM app.community_circle_guests g
      JOIN app.community_profiles p ON p.user_id=g.user_id AND ${MEMBER_PROFILE} WHERE g.circle_id=$1 AND g.status='pending' ORDER BY g.created_at,p.id LIMIT 100`, [circleId])
    const profiles = await this.community.profileViews(rows.map(r => r.profile_id))
    return { items: rows.filter(r => profiles.has(r.profile_id)).map(r => ({ profile: profiles.get(r.profile_id)!, identityConfigured: r.identity_configured, createdAt: r.at })) }
  }

  private decide(userId: string, circleId: string, profileId: string, status: 'member' | 'rejected') {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      const target = await this.profileUser(m, profileId)
      const done = await m.query(`UPDATE app.community_circle_guests SET status=$3,decided_at=now() WHERE circle_id=$1 AND user_id=$2 AND status='pending' RETURNING 1`, [circleId, target, status])
      if (!done.length) throw new NotFoundException('CIRCLE_REQUEST_NOT_FOUND')
      await noticeUser(m, status === 'member' ? 'community.circle.joined' : 'community.circle.rejected', target, circleId)
    })
  }
  async approve(userId: string, circleId: string, profileId: string) { await this.decide(userId, circleId, profileId, 'member'); return { approved: true } }
  async reject(userId: string, circleId: string, profileId: string) { await this.decide(userId, circleId, profileId, 'rejected'); return { rejected: true } }

  /** New random code; the old link stops working at once. */
  resetInvite(userId: string, circleId: string) {
    return this.db.transaction(async m => {
      await this.myProfile(m, userId)
      await this.requireOwner(m, circleId, userId)
      const [row] = await m.query('UPDATE app.community_circles SET invite_code=$2,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING invite_code', [circleId, newInviteCode()])
      return { inviteCode: row.invite_code as string }
    })
  }
}
