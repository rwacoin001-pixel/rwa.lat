import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { NotificationService } from '../notification/notification.service'
import { ObjectStorageService } from '../object-storage/object-storage.service'
import { CommunityProfileKind } from './community.entities'
import { DmMessagesQueryDto, DmSendDto, DmSettingsDto } from './community-dm.dto'
import { riskyDm } from './community-dm.policy'
import { communityMediaId, decodeCursor, encodeCursor, isValidHandle, normalizeHandle } from './community.util'

type Profile = { id: string; user_id: string | null; handle: string; display_name: string; avatar_url: string | null; kind: CommunityProfileKind; dm_policy: 'everyone' | 'following'; identity_configured: boolean; is_active: boolean; status?: string; muted?: boolean }
type Thread = { id: string; a_profile_id: string; b_profile_id: string; muted: boolean; archived: boolean }
type Message = { id: string; thread_id: string; sender_profile_id: string; client_id: string; body: string; created_at: Date; deleted_at: Date | null; sequence: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** DMs never create a community identity implicitly. Also shared by the private report path. */
export async function requireDmIdentity(m: EntityManager, userId: string): Promise<Profile> {
  const [p] = await m.query(`SELECT p.*,u.status FROM app.community_profiles p
    JOIN app.users u ON u.id=p.user_id WHERE p.user_id=$1`, [userId])
  if (!p || !p.identity_configured) throw new ConflictException({ code: 'COMMUNITY_IDENTITY_REQUIRED', message: 'Set up your community identity to use messages.' })
  if (p.status !== 'active' || !p.is_active) throw new ForbiddenException('Active community account required')
  return p
}

@Injectable()
export class CommunityDmService {
  constructor(
    private readonly db: DataSource,
    private readonly notifications: NotificationService,
    @Optional() private readonly storage?: ObjectStorageService,
  ) {}

  private pair(a: string, b: string) { return [a, b].sort() }
  private lock(m: EntityManager, key: string) { return m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]) }
  private pairLock(m: EntityManager, a: string, b: string) { return this.lock(m, `community-dm-pair:${this.pair(a, b).join(':')}`) }
  private async resolve(m: EntityManager, handle: string): Promise<Profile> {
    const key = normalizeHandle(handle)
    if (!isValidHandle(key)) throw new BadRequestException('COMMUNITY_HANDLE_INVALID')
    const [p] = await m.query(`SELECT p.* FROM app.community_profiles p WHERE p.is_active=true
      AND (p.handle=$1 OR p.id IN (SELECT profile_id FROM app.community_handle_aliases WHERE handle=$1))
      AND (p.kind<>'member' OR p.identity_configured=true) LIMIT 1`, [key])
    if (!p) throw new NotFoundException('Member not found')
    return p
  }
  private async member(m: EntityManager, profileId: string, threadId: string, lock = false): Promise<Thread> {
    const [t] = await m.query(`SELECT t.*,member.muted,member.archived FROM app.community_dm_threads t
      JOIN app.community_dm_members member ON member.thread_id=t.id
      WHERE t.id=$1 AND member.profile_id=$2 ${lock ? 'FOR UPDATE OF t' : ''}`, [threadId, profileId])
    if (!t) throw new NotFoundException('DM_THREAD_NOT_FOUND')
    return t
  }
  private async allowed(m: EntityManager, senderId: string, recipient: Profile) {
    const blocks = await m.query(`SELECT 1 FROM app.community_dm_blocks
      WHERE (blocker_profile_id=$1 AND blocked_profile_id=$2) OR (blocker_profile_id=$2 AND blocked_profile_id=$1) LIMIT 1`, [senderId, recipient.id])
    if (blocks.length) throw new ForbiddenException({ code: 'DM_BLOCKED', message: 'Messaging is unavailable for this profile.' })
    if (!recipient.is_active) throw new ForbiddenException({ code: 'DM_NOT_ALLOWED', message: 'This profile is not accepting messages.' })
    if (recipient.dm_policy === 'following') {
      const follows = await m.query('SELECT 1 FROM app.community_follows WHERE follower_id=$1 AND followee_id=$2', [recipient.id, senderId])
      if (!follows.length) throw new ForbiddenException({ code: 'DM_NOT_ALLOWED', message: 'This profile only accepts messages from people they follow.' })
    }
  }
  private audit(m: EntityManager, userId: string, action: string, objectId: string, metadata: Record<string, unknown> = {}) {
    return m.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
      VALUES($1,'user',$2,$3,'community_dm',$4,$5,$6::jsonb)`, [randomUUID(), userId, action, objectId, randomUUID(), JSON.stringify(metadata)])
  }
  private shapeMessage(row: Message) {
    return { id: row.id, threadId: row.thread_id, senderProfileId: row.sender_profile_id, body: row.deleted_at ? '' : row.body, createdAt: row.created_at, deletedAt: row.deleted_at ?? null }
  }

  open(userId: string, handle: string) {
    return this.db.transaction(async m => {
      const p = await requireDmIdentity(m, userId)
      await this.lock(m, `community-dm-sender:${p.id}`)
      const other = await this.resolve(m, handle)
      if (other.id === p.id) throw new BadRequestException('Cannot message yourself')
      await this.pairLock(m, p.id, other.id)
      await this.allowed(m, p.id, other)
      const pair = this.pair(p.id, other.id)
      const [existing] = await m.query('SELECT id FROM app.community_dm_threads WHERE a_profile_id=$1 AND b_profile_id=$2', pair)
      if (existing) return { id: existing.id as string }
      const [{ count }] = await m.query(`SELECT count(*) FROM app.community_dm_threads
        WHERE created_by_profile_id=$1 AND created_at>clock_timestamp()-interval '1 day'`, [p.id])
      if (Number(count) >= 10) throw new HttpException({ code: 'DM_THREAD_RATE_LIMIT', message: 'You can start up to 10 conversations a day. Please try again later.' }, HttpStatus.TOO_MANY_REQUESTS)
      const [t] = await m.query(`INSERT INTO app.community_dm_threads(a_profile_id,b_profile_id,created_by_profile_id)
        VALUES($1,$2,$3) RETURNING id,last_message_at`, [...pair, p.id])
      await m.query(`INSERT INTO app.community_dm_members(thread_id,profile_id,last_message_at)
        VALUES($1,$2,$4),($1,$3,$4)`, [t.id, ...pair, t.last_message_at])
      await this.audit(m, userId, 'community.dm.open', t.id)
      return { id: t.id as string }
    })
  }

  async threads(userId: string, cursor?: string) {
    const after = cursor ? decodeCursor(cursor) : undefined
    if (cursor && (!after || !Number.isFinite(after.at.getTime()) || !UUID.test(after.id))) throw new BadRequestException('COMMUNITY_CURSOR_INVALID')
    const rows = await this.db.transaction(async m => {
      const p = await requireDmIdentity(m, userId)
      return m.query(`SELECT t.id,member.last_message_at,member.muted,member.archived,
        other.id AS other_id,other.handle,other.display_name,other.avatar_url,other.kind,
        preview.body AS preview,preview.id AS last_message_id,preview.sender_profile_id AS last_sender_id,
        (SELECT count(*) FROM app.community_dm_messages msg
          WHERE msg.thread_id=t.id AND msg.sender_profile_id<>$1 AND msg.deleted_at IS NULL
          AND msg.sequence>COALESCE(read.sequence,0)) AS unread_count
        FROM app.community_dm_members member JOIN app.community_dm_threads t ON t.id=member.thread_id
        JOIN app.community_profiles other ON other.id=CASE WHEN t.a_profile_id=$1 THEN t.b_profile_id ELSE t.a_profile_id END
        LEFT JOIN app.community_dm_messages read ON read.id=member.last_read_message_id
        LEFT JOIN LATERAL (SELECT id,sender_profile_id,left(body,80) AS body FROM app.community_dm_messages
          WHERE thread_id=t.id AND deleted_at IS NULL ORDER BY sequence DESC LIMIT 1) preview ON true
        WHERE member.profile_id=$1 AND member.archived=false
          AND ($2::timestamptz IS NULL OR (member.last_message_at,t.id)<($2::timestamptz,$3::uuid))
        ORDER BY member.last_message_at DESC,t.id DESC LIMIT 31`, [p.id, after?.at ?? null, after?.id ?? null])
    })
    const visible = rows.slice(0, 30)
    const mediaIds = visible.map((r: { avatar_url: string | null }) => communityMediaId(r.avatar_url)).filter((id: string | null): id is string => !!id)
    const readable = mediaIds.length && this.storage ? await this.storage.readableCommunityImageIds(mediaIds).catch(() => new Set<string>()) : new Set<string>()
    const items = visible.map((r: { id: string; other_id: string; handle: string; display_name: string; avatar_url: string | null; kind: CommunityProfileKind; preview: string | null; last_message_id: string | null; last_sender_id: string | null; unread_count: string; last_message_at: Date; muted: boolean; archived: boolean }) => {
      const media = communityMediaId(r.avatar_url)
      return { id: r.id, otherProfile: { id: r.other_id, handle: r.handle, displayName: r.display_name, avatarUrl: media && !readable.has(media) ? null : r.avatar_url, avatarSeed: r.other_id, kind: r.kind },
        lastMessage: r.last_message_id ? { id: r.last_message_id, senderProfileId: r.last_sender_id!, preview: Array.from(r.preview ?? '').slice(0, 80).join('') } : null,
        unreadCount: Number(r.unread_count), updatedAt: r.last_message_at, muted: r.muted, archived: r.archived }
    })
    const last = visible[visible.length - 1]
    return { items, nextCursor: rows.length > 30 && last ? encodeCursor(last.last_message_at, last.id) : null }
  }

  messages(userId: string, threadId: string, query: DmMessagesQueryDto) {
    return this.db.transaction(async m => {
      const p = await requireDmIdentity(m, userId)
      await this.member(m, p.id, threadId)
      let before: string | null = null
      if (query.before) {
        const [cursor] = await m.query('SELECT id, sequence FROM app.community_dm_messages WHERE thread_id=$1 AND id=$2', [threadId, query.before])
        if (!cursor) throw new NotFoundException('DM_MESSAGE_NOT_FOUND')
        before = cursor.sequence
      }
      const limit = query.limit ?? 30
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('Invalid message limit')
      const rows: Message[] = await m.query(`SELECT * FROM app.community_dm_messages
        WHERE thread_id=$1 AND deleted_at IS NULL AND ($2::bigint IS NULL OR sequence<$2::bigint)
        ORDER BY sequence DESC LIMIT $3`, [threadId, before, limit + 1])
      const items = rows.slice(0, limit).map(r => this.shapeMessage(r))
      return { items, nextBefore: rows.length > limit ? items[items.length - 1].id : null }
    })
  }

  send(userId: string, threadId: string, input: DmSendDto) {
    return this.db.transaction(async m => {
      const p = await requireDmIdentity(m, userId)
      await this.lock(m, `community-dm-sender:${p.id}`)
      // Check membership before looking up idempotency or revealing any thread state.
      const t = await this.member(m, p.id, threadId)
      const otherId = t.a_profile_id === p.id ? t.b_profile_id : t.a_profile_id
      await this.pairLock(m, p.id, otherId)
      await this.member(m, p.id, threadId, true)
      const [other]: Profile[] = await m.query(`SELECT p.*,member.muted FROM app.community_profiles p
        JOIN app.community_dm_members member ON member.profile_id=p.id WHERE member.thread_id=$1 AND p.id=$2`, [threadId, otherId])
      if (!other) throw new NotFoundException('DM_THREAD_NOT_FOUND')
      await this.allowed(m, p.id, other)
      const body = typeof input.body === 'string' ? input.body.trim() : ''
      if (!body || Array.from(body).length > 2000 || !UUID.test(input.clientId ?? '')) throw new BadRequestException('Invalid message')
      const [existing]: Message[] = await m.query('SELECT * FROM app.community_dm_messages WHERE sender_profile_id=$1 AND client_id=$2', [p.id, input.clientId])
      if (existing) {
        if (existing.thread_id !== threadId || existing.body !== body) throw new ConflictException({ code: 'DM_CLIENT_ID_REUSED', message: 'This client ID belongs to another message.' })
        return { ...this.shapeMessage(existing), duplicate: true }
      }
      if (riskyDm(body)) throw new BadRequestException({ code: 'COMMUNITY_CONTENT_NOT_ALLOWED', message: 'Messages cannot include private contact details or promise returns. Please edit and try again.' })
      const [{ count }] = await m.query(`SELECT count(*) FROM app.community_dm_messages
        WHERE sender_profile_id=$1 AND created_at>clock_timestamp()-interval '1 minute'`, [p.id])
      if (Number(count) >= 20) throw new HttpException({ code: 'DM_MESSAGE_RATE_LIMIT', message: 'You can send up to 20 messages a minute. Please try again shortly.' }, HttpStatus.TOO_MANY_REQUESTS)
      const [message]: Message[] = await m.query(`INSERT INTO app.community_dm_messages(thread_id,sender_profile_id,body,client_id)
        VALUES($1,$2,$3,$4) RETURNING *`, [threadId, p.id, body, input.clientId])
      await m.query('UPDATE app.community_dm_threads SET last_message_at=$2 WHERE id=$1', [threadId, message.created_at])
      await m.query('UPDATE app.community_dm_members SET last_message_at=$2,archived=false WHERE thread_id=$1', [threadId, message.created_at])
      if (other.user_id && !other.muted) await this.notifications.coalesceCommunityDm(m, other.user_id, threadId, p.handle)
      await this.audit(m, userId, 'community.dm.send', message.id, { threadId })
      return { ...this.shapeMessage(message), duplicate: false }
    })
  }

  private async unread(m: EntityManager, profileId: string, threadId?: string): Promise<number> {
    const [{ count }] = await m.query(`SELECT count(*) FROM app.community_dm_members member
      JOIN app.community_dm_messages msg ON msg.thread_id=member.thread_id
      LEFT JOIN app.community_dm_messages read ON read.id=member.last_read_message_id
      WHERE member.profile_id=$1 AND msg.sender_profile_id<>$1 AND msg.deleted_at IS NULL
        AND msg.sequence>COALESCE(read.sequence,0) ${threadId ? 'AND member.thread_id=$2' : ''}`, threadId ? [profileId, threadId] : [profileId])
    return Number(count)
  }
  unreadCount(userId: string) {
    return this.db.transaction(async m => ({ count: await this.unread(m, (await requireDmIdentity(m, userId)).id) }))
  }
  read(userId: string, threadId: string, messageId: string) {
    return this.db.transaction(async m => {
      const p = await requireDmIdentity(m, userId)
      await this.member(m, p.id, threadId, true)
      const [message] = await m.query('SELECT id, sequence FROM app.community_dm_messages WHERE thread_id=$1 AND id=$2', [threadId, messageId])
      if (!message) throw new NotFoundException('DM_MESSAGE_NOT_FOUND')
      await m.query(`UPDATE app.community_dm_members SET last_read_message_id=$4
        WHERE thread_id=$1 AND profile_id=$2 AND (last_read_message_id IS NULL OR last_read_message_id IN
          (SELECT id FROM app.community_dm_messages WHERE thread_id=$1 AND sequence<$3))`, [threadId, p.id, message.sequence, messageId])
      const unreadCount = await this.unread(m, p.id, threadId)
      if (!unreadCount) await this.notifications.readCommunityDm(m, userId, threadId)
      return { unreadCount }
    })
  }
  settings(userId: string, threadId: string, input: DmSettingsDto) {
    return this.db.transaction(async m => {
      const p = await requireDmIdentity(m, userId)
      const t = await this.member(m, p.id, threadId, true)
      const muted = input.muted ?? t.muted, archived = input.archived ?? t.archived
      await m.query('UPDATE app.community_dm_members SET muted=$3,archived=$4 WHERE thread_id=$1 AND profile_id=$2', [threadId, p.id, muted, archived])
      await this.audit(m, userId, 'community.dm.settings', threadId, { muted, archived })
      return { muted, archived }
    })
  }
  block(userId: string, handle: string, blocked: boolean) {
    return this.db.transaction(async m => {
      const p = await requireDmIdentity(m, userId), other = await this.resolve(m, handle)
      if (p.id === other.id) throw new BadRequestException('Cannot block yourself')
      await this.pairLock(m, p.id, other.id)
      if (blocked) await m.query('INSERT INTO app.community_dm_blocks(blocker_profile_id,blocked_profile_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [p.id, other.id])
      else await m.query('DELETE FROM app.community_dm_blocks WHERE blocker_profile_id=$1 AND blocked_profile_id=$2', [p.id, other.id])
      await this.audit(m, userId, blocked ? 'community.dm.block' : 'community.dm.unblock', other.id)
      return { blocked }
    })
  }
}
