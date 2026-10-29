import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { AdminRequest } from './admin-session.guard'

@Injectable()
export class AdminAiMfaGuard implements CanActivate {
  constructor(private readonly db: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const actor = context.switchToHttp().getRequest<AdminRequest>().admin
    if (actor) {
      const [session] = await this.db.query(`SELECT s.id FROM app.admin_sessions s
        JOIN app.admin_users u ON u.id=s.admin_user_id
        WHERE s.id=$1 AND s.admin_user_id=$2 AND s.mfa_verified_at IS NOT NULL
          AND s.revoked_at IS NULL AND s.expires_at>now() AND u.mfa_state='enabled' AND u.disabled_at IS NULL`, [actor.sessionId, actor.id])
      if (session) return true
    }
    throw new ForbiddenException({ code: 'ADMIN_AI_MFA_REQUIRED', message: '请完成双重验证后重新登录，再使用数据 AI。' })
  }
}
