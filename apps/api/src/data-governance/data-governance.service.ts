import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BackupDrill, DataDeletionRequest, DeletionState } from './data-governance.entities'
import { DATA_GOVERNANCE_ERROR_CODES, DataGovernanceError } from './data-governance.errors'
import {
  maskEmail,
  maskPhone,
  maskName,
  maskAccount,
  maskGeneric,
  looksLikePII,
} from './data-masking.util'

/** 默认保留期：删除请求批准后保留 30 天再物理清除（满足"保留策略"）。 */
const DEFAULT_RETENTION_DAYS = 30

@Injectable()
export class DataGovernanceService {
  constructor(
    @InjectRepository(BackupDrill)
    private readonly drills: Repository<BackupDrill>,
    @InjectRepository(DataDeletionRequest)
    private readonly deletions: Repository<DataDeletionRequest>,
  ) {}

  // ---- 脱敏（复用纯函数，便于在服务层统一出口） ----
  maskEmail(v: string): string {
    return maskEmail(v)
  }
  maskPhone(v: string): string {
    return maskPhone(v)
  }
  maskName(v: string): string {
    return maskName(v)
  }
  maskAccount(v: string): string {
    return maskAccount(v)
  }
  maskGeneric(v: string, keep = 4): string {
    return maskGeneric(v, keep)
  }
  looksLikePII(v: string): boolean {
    return looksLikePII(v)
  }

  // ---- 备份恢复演练 ----
  async startDrill(kind: BackupDrill['kind'], performedBy?: string, target = 'rwa_lat'): Promise<BackupDrill> {
    const drill = this.drills.create({ kind, performedBy, target, status: 'running' })
    return this.drills.save(drill)
  }

  async finishDrill(id: string, status: 'succeeded' | 'failed', notes = ''): Promise<BackupDrill> {
    const drill = await this.drills.findOne({ where: { id } })
    if (!drill) {
      throw new DataGovernanceError(DATA_GOVERNANCE_ERROR_CODES.DRILL_NOT_FOUND, 'Backup drill not found', 404)
    }
    drill.status = status
    drill.finishedAt = new Date()
    drill.notes = notes
    return this.drills.save(drill)
  }

  async listDrills(limit = 50): Promise<BackupDrill[]> {
    return this.drills.find({ order: { startedAt: 'DESC' }, take: limit })
  }

  // ---- 删除请求生命周期 ----
  async requestDeletion(input: {
    subjectType: DataDeletionRequest['subjectType']
    subjectId: string
    requestedBy: string
    reasonCode?: string
    retentionDays?: number
  }): Promise<DataDeletionRequest> {
    const days = input.retentionDays ?? DEFAULT_RETENTION_DAYS
    if (!Number.isFinite(days) || days < 0) {
      throw new DataGovernanceError(DATA_GOVERNANCE_ERROR_CODES.INVALID_RETENTION_PERIOD, 'retentionDays must be >= 0', 400)
    }
    const retainUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const req = this.deletions.create({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      requestedBy: input.requestedBy,
      reasonCode: input.reasonCode ?? 'user_request',
      retainUntil,
      state: 'requested',
    })
    return this.deletions.save(req)
  }

  async decideDeletion(id: string, approved: boolean, decidedBy: string): Promise<DataDeletionRequest> {
    const req = await this.deletions.findOne({ where: { id } })
    if (!req) {
      throw new DataGovernanceError(DATA_GOVERNANCE_ERROR_CODES.DELETION_NOT_FOUND, 'Deletion request not found', 404)
    }
    if (req.state !== 'requested') {
      throw new DataGovernanceError(
        DATA_GOVERNANCE_ERROR_CODES.DELETION_ALREADY_DECIDED,
        `Deletion already ${req.state}`,
        409,
      )
    }
    req.state = approved ? 'approved' : 'rejected'
    req.approvedBy = decidedBy
    req.decidedAt = new Date()
    return this.deletions.save(req)
  }

  /** 保留期到期后物理清除：将状态翻为 purged 并记录时间。
   *  真实数据擦除由各业务模块订阅此事件执行；此处只推进治理状态机。 */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const due = await this.deletions.find({
      where: { state: 'approved' },
    })
    const ready = due.filter((d) => new Date(d.retainUntil) <= now)
    if (ready.length === 0) return 0
    for (const r of ready) {
      r.state = 'purged' as DeletionState
      r.purgedAt = now
    }
    await this.deletions.save(ready)
    return ready.length
  }

  async listDeletions(state?: DeletionState, limit = 50): Promise<DataDeletionRequest[]> {
    const where = state ? { state } : {}
    return this.deletions.find({ where, order: { requestedAt: 'DESC' }, take: limit })
  }
}
