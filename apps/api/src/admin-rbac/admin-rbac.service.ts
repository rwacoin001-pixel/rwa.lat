import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'
import { AuditLog } from '../security/audit-log.entity'
import {
  AdminApprovalRequest,
  AdminRole,
  AdminRolePermission,
  AdminUser,
  ApprovalState,
} from './admin-rbac.entities'
import { AdminRbacError } from './admin-rbac.errors'

export interface AdminProfile {
  id: string
  email: string
  roleId: string
  roleName: string
  permissions: string[]
  disabled: boolean
}

export interface AdminAuditContext {
  requestId: string
  ipAddress?: string
  userAgent?: string
}

@Injectable()
export class AdminRbacService {
  constructor(
    @InjectRepository(AdminUser) private readonly adminUsers: Repository<AdminUser>,
    @InjectRepository(AdminRole) private readonly roles: Repository<AdminRole>,
    @InjectRepository(AdminRolePermission) private readonly rolePerms: Repository<AdminRolePermission>,
    @InjectRepository(AdminApprovalRequest) private readonly approvals: Repository<AdminApprovalRequest>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async getProfile(adminId: string): Promise<AdminProfile> {
    const u = await this.adminUsers.findOne({ where: { id: adminId } })
    if (!u) throw AdminRbacError.adminUserNotFound(adminId)
    const role = await this.roles.findOne({ where: { id: u.roleId } })
    const perms = role ? await this.rolePerms.find({ where: { roleId: role.id } }) : []
    return {
      id: u.id,
      email: u.email,
      roleId: u.roleId,
      roleName: role?.name ?? 'unknown',
      permissions: perms.map((p) => p.permission),
      disabled: u.disabledAt != null,
    }
  }

  async assertPermission(adminId: string, permission: string): Promise<void> {
    const profile = await this.getProfile(adminId)
    if (profile.disabled) throw AdminRbacError.permissionDenied(permission)
    if (!profile.permissions.includes(permission)) throw AdminRbacError.permissionDenied(permission)
  }

  async listApprovals(state?: ApprovalState, limit = 50): Promise<AdminApprovalRequest[]> {
    const where = state ? { state } : {}
    return this.approvals.find({ where, order: { createdAt: 'DESC' }, take: Math.min(Math.max(limit, 1), 200) })
  }

  async createApproval(input: {
    actorId: string
    action: string
    objectType: string
    objectId?: string
    payload?: Record<string, unknown>
    auditContext: AdminAuditContext
  }): Promise<AdminApprovalRequest> {
    const r = this.approvals.create({
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId ?? null,
      payloadJson: input.payload ?? {},
      state: 'requested',
      requestedBy: input.actorId,
    })
    const saved = await this.approvals.save(r)
    await this.writeAudit({
      actorId: input.actorId,
      action: 'admin.approval.requested',
      objectType: 'admin_approval_request',
      objectId: saved.id,
      requestId: input.auditContext.requestId,
      metadata: {
        action: saved.action,
        objectType: saved.objectType,
        objectId: saved.objectId,
        ipAddress: input.auditContext.ipAddress ?? null,
        userAgent: this.safeUserAgent(input.auditContext.userAgent),
      },
    })
    return saved
  }

  async decideApproval(id: string, adminActorId: string, approve: boolean, reasonCode?: string, auditContext?: AdminAuditContext): Promise<AdminApprovalRequest> {
    const r = await this.approvals.findOne({ where: { id } })
    if (!r) throw AdminRbacError.approvalNotFound(id)
    if (r.state !== 'requested') throw AdminRbacError.approvalStateInvalid(id, r.state)
    if (r.requestedBy === adminActorId) throw AdminRbacError.selfApprovalForbidden()
    r.state = approve ? 'approved' : 'rejected'
    r.approvedBy = adminActorId
    r.decidedAt = new Date()
    r.reasonCode = reasonCode ?? null
    const saved = await this.approvals.save(r)
    await this.writeAudit({
      actorId: adminActorId,
      action: approve ? 'admin.approval.approved' : 'admin.approval.rejected',
      objectType: 'admin_approval_request',
      objectId: saved.id,
      reasonCode: saved.reasonCode,
      requestId: auditContext?.requestId,
      metadata: {
        requestedBy: saved.requestedBy,
        approvalAction: saved.action,
        subjectType: saved.objectType,
        subjectId: saved.objectId,
        ipAddress: auditContext?.ipAddress ?? null,
        userAgent: this.safeUserAgent(auditContext?.userAgent),
      },
    })
    return saved
  }

  // 审计导出：只读查询不可变 audit_logs（触发器禁止改/TRUNCATE）
  async exportAudit(opts: {
    actorType?: string
    userId?: string
    action?: string
    from?: Date
    to?: Date
    limit?: number
  }): Promise<AuditLog[]> {
    const qb = this.auditLogs.createQueryBuilder('a')
    if (opts.actorType) qb.andWhere('a.actor_type = :actorType', { actorType: opts.actorType })
    if (opts.userId) qb.andWhere('a.user_id = :userId', { userId: opts.userId })
    if (opts.action) qb.andWhere('a.action = :action', { action: opts.action })
    if (opts.from) qb.andWhere('a.occurred_at >= :from', { from: opts.from })
    if (opts.to) qb.andWhere('a.occurred_at <= :to', { to: opts.to })
    qb.orderBy('a.occurred_at', 'DESC').take(Math.min(Math.max(opts.limit ?? 100, 1), 500))
    return qb.getMany()
  }

  private async writeAudit(input: {
    actorId: string
    action: string
    objectType: string
    objectId?: string | null
    reasonCode?: string | null
    requestId?: string
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await this.auditLogs.insert({
      id: randomUUID(),
      actorType: 'admin',
      actorId: input.actorId,
      userId: null,
      action: input.action,
      objectType: input.objectType,
      objectId: input.objectId ?? null,
      requestId: input.requestId ?? randomUUID(),
      reasonCode: input.reasonCode ?? null,
      metadata: (input.metadata ?? {}) as never,
    })
  }

  private safeUserAgent(value?: string): string | null {
    return value ? value.slice(0, 1024) : null
  }
}
