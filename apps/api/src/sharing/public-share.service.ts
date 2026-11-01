import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'
import { cardsFor, type CardView } from '../community/community-card'
import { ObjectStorageService } from '../object-storage/object-storage.service'
import { communityMediaId } from '../community/community.util'

export type PublicShareKind = 'product' | 'community_post' | 'community_card'
export type SharedResource = { kind: 'product' | 'community_post'; title: string; summary: string; path: string } | {
  kind: 'community_card'; author: { displayName: string; handle: string; avatarUrl: string | null; avatarSeed: string }
  card: CardView; referralCode: string | null; path: string; title?: never; summary?: never
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

@Injectable()
export class PublicShareService {
  constructor(private readonly db: DataSource, @Optional() private readonly storage?: ObjectStorageService) {}
  private async target(query: Pick<EntityManager, 'query'>, kind: PublicShareKind, id: string, lock = false, ownerId?: string): Promise<SharedResource> {
    if (kind === 'community_card') {
      const [row] = await query.query(`SELECT author.id,author.display_name,author.handle,author.identity_configured,author.kind,author.avatar_url,r.code
        FROM app.community_posts p JOIN app.community_profiles author ON author.id=p.profile_id
        JOIN app.community_post_cards c ON c.post_id=p.id AND c.user_id=author.user_id
        LEFT JOIN app.referral_codes r ON r.user_id=author.user_id
        WHERE p.id=$1 AND p.state='published' AND (p.circle_id IS NULL OR p.circle_only=false)
          AND author.is_active=true AND c.revoked_at IS NULL AND ($2::uuid IS NULL OR author.user_id=$2)
        ${lock ? 'FOR SHARE OF p,author,c' : ''}`, [id, ownerId ?? null])
      if (!row) throw new NotFoundException('CARD_NOT_PUBLIC')
      const card = (await cardsFor(query, [id])).get(id)
      if (!card) throw new NotFoundException('CARD_NOT_PUBLIC')
      const mediaId = communityMediaId(row.avatar_url)
      const cleared = mediaId && this.storage ? (await this.storage.readableCommunityImageIds([mediaId]).catch(() => new Set<string>())).has(mediaId) : false
      return { kind, author: { displayName: /^Member [0-9a-f]{6}$/.test(row.display_name) ? '' : row.display_name,
        handle: row.identity_configured ? row.handle : '', avatarUrl: row.avatar_url && (cleared || (!mediaId && row.kind === 'member')) ? row.avatar_url : null, avatarSeed: row.id },
        card, referralCode: row.code ?? null, path: `/community/post/${id}` }
    }
    if (kind === 'product') {
      const [row] = await query.query(`SELECT display_name,summary FROM app.products WHERE id=$1 AND state='published'${lock ? ' FOR SHARE' : ''}`, [id])
      if (!row) throw new NotFoundException('分享内容不存在或已停止公开')
      return { kind, title: row.display_name, summary: row.summary ?? '', path: `/asset/${id}` }
    }
    const [row] = await query.query(`SELECT p.body FROM app.community_posts p JOIN app.community_profiles author ON author.id=p.profile_id WHERE p.id=$1 AND p.state='published' AND (p.circle_id IS NULL OR p.circle_only=false) AND author.is_active=true${lock ? ' FOR SHARE OF p,author' : ''}`, [id])
    if (!row) throw new NotFoundException('分享内容不存在或已停止公开')
    return { kind, title: '社区公开帖子', summary: row.body, path: `/community/post/${id}` }
  }
  async create(userId: string, input: { kind: PublicShareKind; resourceId: string }) {
    return this.db.transaction(async tx => {
      const [user] = await tx.query('SELECT status FROM app.users WHERE id=$1 FOR SHARE', [userId])
      if (user?.status !== 'active') throw new ConflictException('当前账户不能创建分享链接')
      await this.target(tx, input.kind, input.resourceId, true, userId)
      const token = randomBytes(32).toString('base64url')
      const id = randomUUID()
      await tx.query('INSERT INTO app.public_resource_shares(id,token_hash,creator_id,kind,resource_id) VALUES($1,$2,$3,$4,$5)', [id, hash(token), userId, input.kind, input.resourceId])
      return { id, token }
    })
  }
  async resolve(token: string): Promise<SharedResource> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new NotFoundException('分享链接无效或已撤销')
    const [share] = await this.db.query('SELECT kind,resource_id FROM app.public_resource_shares WHERE token_hash=$1 AND revoked_at IS NULL', [hash(token)])
    if (!share) throw new NotFoundException('分享链接无效或已撤销')
    // Always resolve current publication state; never archive private account data.
    return this.target(this.db, share.kind, share.resource_id)
  }
  async revoke(userId: string, id: string) {
    const rows = await this.db.query('WITH changed AS (UPDATE app.public_resource_shares SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND creator_id=$2 RETURNING id) SELECT id FROM changed', [id,userId])
    if (!rows.length) throw new NotFoundException('分享链接不存在')
    return { id, revoked: true }
  }
  listOwn(userId:string,input:{kind:PublicShareKind;resourceId:string}) {
    return this.db.query('SELECT id,created_at AS "createdAt",revoked_at AS "revokedAt" FROM app.public_resource_shares WHERE creator_id=$1 AND kind=$2 AND resource_id=$3 ORDER BY created_at DESC LIMIT 200',[userId,input.kind,input.resourceId])
  }
}
