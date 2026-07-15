import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, timingSafeEqual } from 'node:crypto'
import { Repository } from 'typeorm'
import { AdminSession, AdminUser } from './admin-rbac.entities'
import { AdminRbacService, type AdminProfile } from './admin-rbac.service'

export interface AuthenticatedAdmin {
  id: string
  email: string
  roleId: string
  roleName: string
  permissions: string[]
  sessionId: string
}

@Injectable()
export class AdminSessionAuthService {
  constructor(
    @InjectRepository(AdminSession) private readonly sessions: Repository<AdminSession>,
    @InjectRepository(AdminUser) private readonly admins: Repository<AdminUser>,
    private readonly rbac: AdminRbacService,
  ) {}

  async authenticate(rawToken: string): Promise<AuthenticatedAdmin> {
    const token = rawToken.trim()
    if (token.length < 32) throw new UnauthorizedException('Admin session is invalid')
    const hash = createHash('sha256').update(token).digest()
    const session = await this.sessions.createQueryBuilder('session')
      .addSelect('session.tokenHash')
      .where('session.token_hash = :hash', { hash })
      .andWhere('session.revoked_at IS NULL')
      .andWhere('session.expires_at > now()')
      .getOne()
    if (!session || !timingSafeEqual(session.tokenHash, hash)) {
      throw new UnauthorizedException('Admin session is invalid or expired')
    }
    const admin = await this.admins.findOne({ where: { id: session.adminUserId } })
    if (!admin || admin.disabledAt) throw new UnauthorizedException('Admin account is unavailable')
    const profile = await this.rbac.getProfile(admin.id)
    if (profile.disabled) throw new UnauthorizedException('Admin account is unavailable')
    await this.sessions.update({ id: session.id }, { lastSeenAt: new Date() })
    return this.toActor(profile, session.id)
  }

  private toActor(profile: AdminProfile, sessionId: string): AuthenticatedAdmin {
    return {
      id: profile.id,
      email: profile.email,
      roleId: profile.roleId,
      roleName: profile.roleName,
      permissions: profile.permissions,
      sessionId,
    }
  }
}
