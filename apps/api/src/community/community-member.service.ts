import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common'
import { parseProofRequest, resolveProof } from './community-proof'
import { createHash, randomUUID } from 'node:crypto'
import { predictionThreadId } from './prediction-discussion'
import { communityCityCode } from './community-identity'
import { DataSource, EntityManager } from 'typeorm'
import { CommunityComment, CommunityFollow, CommunityLike, CommunityPost, CommunityProfile, CommunityTopic } from './community.entities'
import { normalizeCommunityLang, sanitizeTopics } from './community.util'
import { MEMBER_MEDIA_MAX, MemberCommentDto, MemberPostDto, MemberProfileDto, ModerateMemberContentDto } from './community-member.dto'
import { ObjectStorageService, communityMediaPath, type CommunityImagePurpose } from '../object-storage/object-storage.service'
import { communityMediaId } from './community.util'

@Injectable()
export class CommunityMemberService {
  constructor(private readonly db: DataSource, @Optional() private readonly storage?: ObjectStorageService) {}

  private requireStorage() {
    if (!this.storage) throw new ServiceUnavailableException('Media storage is not available')
    return this.storage
  }
  /** Resolves member-supplied object ids into stored media paths after ownership and upload checks. */
  private async media(userId: string, ids: string[] | undefined, purpose: CommunityImagePurpose) {
    if (!ids?.length) return []
    if (ids.length > MEMBER_MEDIA_MAX) throw new BadRequestException('At most four images')
    return (await this.requireStorage().attachableCommunityImages(userId, ids, purpose)).map(communityMediaPath)
  }
  uploadImage(userId: string, purpose: CommunityImagePurpose, file: { buffer: Buffer; mimetype?: string } | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Image file required')
    return this.db.transaction(async m => { await this.member(m, userId) }).then(async () => {
      const stored = await this.requireStorage().storeCommunityImage(userId, purpose, file.buffer, file.mimetype)
      return { ...stored, url: communityMediaPath(stored.objectId) }
    })
  }
  async setAvatar(userId: string, objectId: string | null) {
    const [path] = objectId ? await this.media(userId, [objectId], 'avatar') : [null]
    return this.db.transaction(async m => {
      const p = await this.member(m, userId)
      p.avatar_url = path
      return this.view(await m.save(p))
    })
  }

  private async member(m: EntityManager, userId: string) {
    await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`community-member:${userId}`])
    const [user] = await m.query('SELECT status FROM app.users WHERE id=$1', [userId])
    if (user?.status !== 'active') throw new ForbiddenException('Active account required')
    const repo = m.getRepository(CommunityProfile)
    let profile = await repo.findOneBy({ user_id: userId })
    if (!profile) {
      const handle = `u${userId.replace(/-/g, '')}`.slice(0, 32)
      profile = await repo.save(repo.create({ user_id: userId, handle, display_name: `Member ${handle.slice(-6)}`, kind: 'member', is_active: true }))
    }
    if (!profile.is_active) throw new ForbiddenException('Community profile is inactive')
    return profile
  }
  private publicProfile(p: CommunityProfile) { return { id: p.id, handle: p.identity_configured ? p.handle : '', handleBase: p.handle_base ?? '', city: p.city ?? null, countryCode: p.country_code ?? null, displayName: /^Member [0-9a-f]{6}$/.test(p.display_name) ? '' : p.display_name, identityConfigured: p.identity_configured, avatarSeed: p.id, kind: p.kind, bio: p.bio ?? null, avatarUrl: p.avatar_url ?? null } }
  /** Own-profile view: an avatar still in malware scan is reported as pending instead of a URL that would not load yet. */
  private async view(p: CommunityProfile) {
    const base = this.publicProfile(p)
    const id = communityMediaId(base.avatarUrl)
    if (!id) return { ...base, avatarPending: false }
    const readable = this.storage ? await this.storage.readableCommunityImageIds([id]).catch(() => new Set<string>()) : new Set<string>()
    return readable.has(id) ? { ...base, avatarPending: false } : { ...base, avatarUrl: null, avatarPending: true }
  }
  async profile(userId: string) { return this.view(await this.db.transaction(async m => this.member(m, userId))) }
  updateProfile(userId: string, input: MemberProfileDto) {
    return this.db.transaction(async m => {
      const p = await this.member(m, userId)
      if (!input.displayName.trim()) throw new BadRequestException('Display name cannot be blank')
      const base = (input.handle ?? '').trim().toLowerCase()
      if (!/^[a-z0-9_]{3,20}$/.test(base)) throw new BadRequestException('COMMUNITY_HANDLE_INVALID')
      const location = input.location
      if (location && (!location.city?.trim() || location.city.length > 80 || !/^[A-Z]{2}$/.test(location.countryCode) || location.source !== 'device')) throw new BadRequestException('COMMUNITY_LOCATION_REQUIRED')
      const city = location?.city.trim() ?? p.city
      const country = location?.countryCode ?? p.country_code
      if (!city || !country) throw new BadRequestException('COMMUNITY_LOCATION_REQUIRED')
      const suffix = communityCityCode(city, country)
      // Numbered candidates can overlap literal bases (zhangqi01). Serialize the whole city namespace.
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`community-handle-city:${suffix}`])
      let handle = p.identity_configured && p.handle_base === base && !location ? p.handle : `${base}.${suffix}`
      for (let n = 0; ; n++) {
        const occupied = await m.query('SELECT profile_id FROM app.community_handle_aliases WHERE handle=$1 UNION SELECT id AS profile_id FROM app.community_profiles WHERE lower(handle)=$1', [handle])
        if (!occupied.some((row: { profile_id: string }) => row.profile_id !== p.id)) break
        if (n >= 9999) throw new ConflictException('COMMUNITY_HANDLE_TAKEN')
        handle = `${base}${String(n+1).padStart(2,'0')}.${suffix}`
      }
      await m.query('INSERT INTO app.community_handle_aliases(handle,profile_id) VALUES(lower($1),$3),($2,$3) ON CONFLICT DO NOTHING', [p.handle, handle, p.id])
      p.handle = handle; p.handle_base = base; p.city = city; p.country_code = country; p.identity_configured = true
      p.display_name = input.displayName.trim(); p.bio = input.bio?.trim() ?? p.bio
      return m.save(p)
    }).then(p => this.view(p))
  }
  private write(userId: string, key: string | undefined, intent: Record<string, unknown>, kind: 'post' | 'comment', work: (m: EntityManager, profile: CommunityProfile) => Promise<{ id: string }>) {
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new BadRequestException('Idempotency-Key UUID v4 required')
    const hash = createHash('sha256').update(JSON.stringify(intent)).digest('hex')
    return this.db.transaction(async m => {
      const profile = await this.member(m, userId)
      if (!profile.identity_configured) throw new ConflictException('COMMUNITY_IDENTITY_REQUIRED')
      const [existing] = await m.query('SELECT * FROM app.community_user_intents WHERE user_id=$1 AND idempotency_key=$2', [userId, key])
      if (existing) {
        if (existing.request_hash !== hash || existing.result_type !== kind) throw new ConflictException('Idempotency-Key belongs to another publication')
        return { id: existing.result_id, duplicate: true }
      }
      const result = await work(m, profile)
      await m.query('INSERT INTO app.community_user_intents(user_id,idempotency_key,request_hash,result_type,result_id) VALUES($1,$2,$3,$4,$5)', [userId, key, hash, kind, result.id])
      return { id: result.id, duplicate: false }
    })
  }
  async setCircleVisibility(userId: string, visible: boolean) {
    return this.db.transaction(async m => {
      const profile = await this.member(m, userId)
      await m.query('UPDATE app.community_profiles SET show_to_inviter = $2 WHERE id = $1', [profile.id, visible])
      return { showToInviter: visible }
    })
  }
  async proofPreview(userId: string, query: Record<string, unknown>) {
    const { kind, refId, title, pct, tradeDate } = await resolveProof(this.db, userId, parseProofRequest(query))
    const [table] = await this.db.query("SELECT to_regclass('app.community_post_proofs') IS NOT NULL AS ready")
    const shared = table?.ready ? (await this.db.query('SELECT 1 FROM app.community_post_proofs WHERE kind=$1 AND ref_id=$2', [kind, refId])).length > 0 : false
    return { kind, title, pct, tradeDate, shared }
  }
  async post(userId: string, key: string | undefined, input: MemberPostDto) {
    const body = (input.body ?? '').trim(); const lang = normalizeCommunityLang(input.lang)
    const imageIds = input.imageIds ?? []
    if ((!body && !imageIds.length && !input.proof) || body.length > 4000) throw new BadRequestException('Invalid post body')
    if (!input.location?.city?.trim() || input.location.city.trim().length > 80 || !/^[A-Z]{2}$/.test(input.location.countryCode ?? '') || input.location.source !== 'device') throw new BadRequestException('Device location required to publish')
    const location = { city: input.location.city.trim(), countryCode: input.location.countryCode, source: 'device' as const }
    const images = await this.media(userId, imageIds, 'post')
    const proof = input.proof ? parseProofRequest(input.proof) : null
    return this.write(userId, key, { body, lang, location, topics: input.topics ?? [], ...(images.length ? { images } : {}), ...(proof ? { proof } : {}) }, 'post', async (m, p) => {
      // The figure is resolved here, inside the same transaction, from the author's own ledger row.
      const resolved = proof ? await resolveProof(m, userId, proof) : null
      if (resolved && (await m.query('SELECT 1 FROM app.community_post_proofs WHERE kind=$1 AND ref_id=$2', [resolved.kind, resolved.refId])).length) throw new ConflictException('PROOF_ALREADY_SHARED')
      const topics = await m.getRepository(CommunityTopic).find()
      const saved = await m.save(m.create(CommunityPost, { profile_id: p.id, body, lang, location, topics: sanitizeTopics(input.topics, new Set(topics.map(t => t.slug))), images, source: 'user', state: 'published', published_at: new Date() }))
      if (resolved) await m.query('INSERT INTO app.community_post_proofs(post_id,user_id,kind,ref_id,title,pct,trade_date) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [saved.id, userId, resolved.kind, resolved.refId, resolved.title, resolved.pct, resolved.tradeDate])
        .catch((error: { code?: string }) => { throw error?.code === '23505' ? new ConflictException('PROOF_ALREADY_SHARED') : error })
      return saved
    })
  }
  async ensurePredictionThread(userId: string, eventId: string) {
    let id: string
    try { id = predictionThreadId(eventId) } catch { throw new BadRequestException('Invalid event ID') }
    await this.db.transaction(async m => { await this.member(m, userId) })
    const existing = await this.db.getRepository(CommunityPost).findOneBy({id})
    if (existing) {
      if(existing.state !== 'published') throw new NotFoundException('Discussion is not public')
      return id
    }
    const response = await fetch(`https://gamma-api.polymarket.com/events/${eventId}`, { headers: {accept:'application/json','user-agent':'A-REIT/0.1 market-data'}, signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new ServiceUnavailableException('Cannot verify prediction event')
    const event = await response.json() as {id?: string; title?: string}
    if (String(event.id) !== eventId || !event.title) throw new BadRequestException('Invalid event')
    await this.db.transaction(async m => {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['prediction-discussion:'+eventId])
      if (await m.getRepository(CommunityPost).existsBy({id})) return
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['prediction-discussion:official'])
      const profiles=m.getRepository(CommunityProfile)
      let official=await profiles.findOneBy({handle:'rwalat-predictions'})
      if(!official) official=await profiles.save(profiles.create({handle:'rwalat-predictions',display_name:'A-REIT · Predictions',kind:'official',is_active:true}))
      await m.save(m.create(CommunityPost,{id,profile_id:official.id,body:event.title!.slice(0,4000),images:[],topics:[],lang:'en',source:'event',state:'published',published_at:new Date()}))
    })
    return id
  }
  commentLike(userId:string, targetId:string, desired:boolean) {
    return this.db.transaction(async m=>{
      const p=await this.member(m,userId)
      const c=await m.getRepository(CommunityComment).findOne({where:{id:targetId},lock:{mode:'pessimistic_write'}})
      if(c?.state!=='published'||!await m.getRepository(CommunityPost).existsBy({id:c.post_id,state:'published'})) throw new NotFoundException('Reply is not public')
      const repo=m.getRepository(CommunityLike), where={profile_id:p.id,target_type:'comment' as const,target_id:targetId},exists=await repo.existsBy(where)
      const delta=desired&&!exists?1:!desired&&exists?-1:0
      if(delta===1)await repo.insert(where)
      if(delta===-1)await repo.delete(where)
      if(delta)await m.increment(CommunityComment,{id:targetId},'like_count',delta)
      return {liked:desired,likeCount:c.like_count+delta}
    })
  }
  commentLikeState(userId:string, ids:string[]) {
    if(ids.length>50||ids.some(id=>! /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))) throw new BadRequestException('Invalid reply IDs')
    return this.db.transaction(async m=>{
      const profile=await this.member(m,userId)
      const rows=await m.query("SELECT target_id FROM app.community_likes WHERE profile_id=$1 AND target_type='comment' AND target_id=ANY($2::uuid[])",[profile.id,ids])
      return {likedIds:rows.map((r:{target_id:string})=>r.target_id)}
    })
  }
  async comment(userId: string, key: string | undefined, postId: string, input: MemberCommentDto) {
    const body = (input.body ?? '').trim(); const lang = normalizeCommunityLang(input.lang)
    const imageIds = input.imageIds ?? []
    if ((!body && !imageIds.length) || body.length > 2000) throw new BadRequestException('Invalid reply body')
    const images = await this.media(userId, imageIds, 'post')
    return this.write(userId, key, { postId, body, lang, parentId: input.parentId ?? null, ...(images.length ? { images } : {}) }, 'comment', async (m, p) => {
      const post = await m.getRepository(CommunityPost).findOne({ where: { id: postId }, lock: { mode: 'pessimistic_write' } })
      if (post?.state !== 'published') throw new NotFoundException('Post is not public')
      if (input.parentId && !await m.getRepository(CommunityComment).existsBy({ id: input.parentId, post_id: postId, state: 'published' })) throw new BadRequestException('Invalid parent reply')
      const comment = await m.save(m.create(CommunityComment, { post_id: postId, profile_id: p.id, parent_id: input.parentId, body, images, lang, state: 'published' }))
      await m.increment(CommunityPost, { id: postId }, 'comment_count', 1)
      return comment
    })
  }
  like(userId: string, targetId: string, desired: boolean) {
    return this.db.transaction(async m => {
      const p = await this.member(m, userId)
      const post = await m.getRepository(CommunityPost).findOne({ where: { id: targetId }, lock: { mode: 'pessimistic_write' } })
      if (post?.state !== 'published') throw new NotFoundException('Post is not public')
      const repo = m.getRepository(CommunityLike); const where = { profile_id: p.id, target_type: 'post' as const, target_id: targetId }
      const exists = await repo.existsBy(where)
      if (desired && !exists) { await repo.insert(where); await m.increment(CommunityPost, { id: targetId }, 'like_count', 1) }
      if (!desired && exists) { await repo.delete(where); await m.decrement(CommunityPost, { id: targetId }, 'like_count', 1) }
      return { liked: desired, likeCount: post.like_count + (desired && !exists ? 1 : !desired && exists ? -1 : 0) }
    })
  }
  follow(userId: string, handle: string, desired: boolean) {
    return this.db.transaction(async m => {
      const p = await this.member(m, userId)
      const target = await this.resolveProfile(m, handle)
      if (!target) throw new NotFoundException('Member not found')
      if (target.id === p.id) throw new BadRequestException('Cannot follow yourself')
      const where = { follower_id: p.id, followee_id: target.id }; const repo = m.getRepository(CommunityFollow)
      if (desired) await repo.createQueryBuilder().insert().values(where).orIgnore().execute()
      else await repo.delete(where)
      return { following: desired, followerCount: await repo.countBy({ followee_id: target.id }) }
    })
  }
  state(userId: string, postId?: string, handle?: string) {
    return this.db.transaction(async m => {
      const p = await this.member(m, userId)
      const target = handle ? await this.resolveProfile(m, handle) : null
      return { profile: p, liked: postId ? await m.getRepository(CommunityLike).existsBy({ profile_id: p.id, target_type: 'post', target_id: postId }) : false, following: target ? await m.getRepository(CommunityFollow).existsBy({ follower_id: p.id, followee_id: target.id }) : false }
    }).then(async r => ({ ...r, profile: await this.view(r.profile) }))
  }
  private async resolveProfile(m: EntityManager, value: string) {
    const key=value.trim().toLowerCase(),repo=m.getRepository(CommunityProfile)
    let profile=await repo.findOneBy(/^[0-9a-f-]{36}$/i.test(key)?{id:key,is_active:true}:{handle:key,is_active:true})
    if(!profile){const [alias]=await m.query('SELECT profile_id FROM app.community_handle_aliases WHERE handle=$1',[key]);if(alias)profile=await repo.findOneBy({id:alias.profile_id,is_active:true})}
    return profile
  }
  publications() {
    return this.db.query(`SELECT p.id,'post' AS "targetType",p.body,p.state,p.created_at AS "createdAt",u.handle FROM app.community_posts p JOIN app.community_profiles u ON u.id=p.profile_id WHERE p.source='user'
      UNION ALL SELECT c.id,'comment',c.body,c.state,c.created_at,u.handle FROM app.community_comments c JOIN app.community_profiles u ON u.id=c.profile_id WHERE u.user_id IS NOT NULL ORDER BY "createdAt" DESC LIMIT 100`)
  }
  moderate(input: ModerateMemberContentDto, actorId: string) {
    if (!input.reason.trim()) throw new BadRequestException('Moderation reason required')
    return this.db.transaction(async m => {
      const table = input.targetType === 'post' ? 'community_posts' : 'community_comments'
      const [row] = await m.query(`SELECT * FROM app.${table} WHERE id=$1 FOR UPDATE`, [input.targetId])
      if (!row) throw new NotFoundException('Publication not found')
      if (row.state === 'removed' && input.state === 'published') throw new ConflictException('Removed publication cannot be restored directly')
      await m.query(`UPDATE app.${table} SET state=$2 WHERE id=$1`, [row.id, input.state])
      if (input.targetType === 'comment' && (row.state === 'published') !== (input.state === 'published')) {
        await m.query('UPDATE app.community_posts SET comment_count=GREATEST(0,comment_count+$2) WHERE id=$1', [row.post_id, input.state === 'published' ? 1 : -1])
      }
      await m.query(`INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata) VALUES($1,'admin',$2,'community.moderate',$3,$4,$5,$6::jsonb)`, [randomUUID(), actorId, input.targetType, row.id, randomUUID(), JSON.stringify({ from: row.state, to: input.state, reason: input.reason.trim() })])
      return { id: row.id, state: input.state }
    })
  }
}
