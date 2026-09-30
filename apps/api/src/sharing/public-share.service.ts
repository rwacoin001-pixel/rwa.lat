import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DataSource, EntityManager } from 'typeorm'

export type PublicShareKind = 'product' | 'community_post'
export type SharedResource = { kind: PublicShareKind; title: string; summary: string; path: string }
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

@Injectable()
export class PublicShareService {
  constructor(private readonly db: DataSource) {}
  private async target(query: Pick<EntityManager, 'query'>, kind: PublicShareKind, id: string, lock = false): Promise<SharedResource> {
    if (kind === 'product') {
      const [row] = await query.query(`SELECT display_name,summary FROM app.products WHERE id=$1 AND state='published'${lock ? ' FOR SHARE' : ''}`, [id])
      if (!row) throw new NotFoundException('分享内容不存在或已停止公开')
      return { kind, title: row.display_name, summary: row.summary ?? '', path: `/asset/${id}` }
    }
    const [row] = await query.query(`SELECT p.body FROM app.community_posts p JOIN app.community_profiles author ON author.id=p.profile_id WHERE p.id=$1 AND p.state='published' AND author.is_active=true${lock ? ' FOR SHARE OF p,author' : ''}`, [id])
    if (!row) throw new NotFoundException('分享内容不存在或已停止公开')
    return { kind, title: '社区公开帖子', summary: row.body, path: `/community/post/${id}` }
  }
  async create(userId: string, input: { kind: PublicShareKind; resourceId: string }) {
    return this.db.transaction(async tx => {
      const [user] = await tx.query('SELECT status FROM app.users WHERE id=$1 FOR SHARE', [userId])
      if (user?.status !== 'active') throw new ConflictException('当前账户不能创建分享链接')
      await this.target(tx, input.kind, input.resourceId, true)
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
