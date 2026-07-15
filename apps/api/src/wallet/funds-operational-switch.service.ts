import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { WALLET_ERROR_CODES } from './wallet.errors'

export const WITHDRAWAL_EXECUTION_SWITCH = 'wallet.withdrawals.execution'

@Injectable()
export class FundsOperationalSwitchService {
  private readonly environmentAllowsExecution: boolean

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.environmentAllowsExecution = config.get<string>('PRODUCTION_FINANCIAL_FEATURES_ENABLED') === 'true'
      && config.get<string>('WALLET_EXECUTION_ENABLED') === 'true'
  }

  async isWithdrawalExecutionEnabled(): Promise<boolean> {
    if (!this.environmentAllowsExecution) return false
    const rows = await this.dataSource.query(
      `SELECT enabled FROM app.operational_switches WHERE switch_key = $1`,
      [WITHDRAWAL_EXECUTION_SWITCH],
    )
    return rows[0]?.enabled === true
  }

  async status() {
    const [current] = await this.dataSource.query(
      `SELECT switch_key AS "switchKey", enabled, version, reason,
              changed_by AS "changedBy", updated_at AS "updatedAt"
         FROM app.operational_switches WHERE switch_key = $1`,
      [WITHDRAWAL_EXECUTION_SWITCH],
    )
    const pending = await this.dataSource.query(
      `SELECT id, requested_state AS "requestedState", state,
              requested_by AS "requestedBy", change_id AS "changeId",
              reason, request_id AS "requestId", requested_at AS "requestedAt"
         FROM app.operational_switch_change_requests
        WHERE switch_key = $1 AND state = 'requested'
        ORDER BY requested_at DESC`,
      [WITHDRAWAL_EXECUTION_SWITCH],
    )
    return { current: current ?? null, pending, environmentAllowsExecution: this.environmentAllowsExecution }
  }

  async pause(adminId: string, reason: string, requestId: string) {
    const normalizedReason = reason.trim()
    return this.transaction(async (runner) => {
      const [current] = await runner.query(
        `SELECT enabled, version FROM app.operational_switches WHERE switch_key = $1 FOR UPDATE`,
        [WITHDRAWAL_EXECUTION_SWITCH],
      )
      if (!current) throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Funds switch was not found.' })
      await runner.query(
        `UPDATE app.operational_switches
            SET enabled = false, version = version + 1, reason = $2,
                changed_by = $3, updated_at = now()
          WHERE switch_key = $1`,
        [WITHDRAWAL_EXECUTION_SWITCH, normalizedReason, adminId],
      )
      await runner.query(
        `UPDATE app.operational_switch_change_requests
            SET state = 'rejected',
                decided_by = CASE WHEN requested_by = $2 THEN NULL ELSE $2 END,
                decided_at = now()
          WHERE switch_key = $1 AND state = 'requested'`,
        [WITHDRAWAL_EXECUTION_SWITCH, adminId],
      )
      await this.audit(runner, adminId, requestId, 'wallet.withdrawal.execution_paused', {
        reason: normalizedReason,
        wasEnabled: current.enabled as boolean,
      })
      return { enabled: false, duplicate: current.enabled !== true }
    })
  }

  async requestResume(adminId: string, changeId: string, reason: string, requestId: string) {
    if (!this.environmentAllowsExecution) {
      throw new ConflictException({
        code: WALLET_ERROR_CODES.EXECUTION_DISABLED,
        message: 'Environment-level financial execution must be enabled before a resume can be requested.',
      })
    }
    return this.transaction(async (runner) => {
      const [current] = await runner.query(
        `SELECT enabled FROM app.operational_switches WHERE switch_key = $1 FOR UPDATE`,
        [WITHDRAWAL_EXECUTION_SWITCH],
      )
      if (!current) throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Funds switch was not found.' })
      if (current.enabled) return { enabled: true, duplicate: true, requestId: null }
      const [pending] = await runner.query(
        `SELECT id, state, requested_by AS "requestedBy", change_id AS "changeId",
                requested_at AS "requestedAt"
           FROM app.operational_switch_change_requests
          WHERE switch_key = $1 AND state = 'requested'`,
        [WITHDRAWAL_EXECUTION_SWITCH],
      )
      if (pending) {
        if (pending.changeId === changeId.trim()) return { ...pending, duplicate: true }
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_SWITCH_CONFLICT,
          message: 'Another funds execution resume request is already pending.',
        })
      }
      const id = randomUUID()
      const rows = await runner.query(
        `INSERT INTO app.operational_switch_change_requests
          (id, switch_key, requested_state, requested_by, change_id, reason, request_id)
         VALUES ($1, $2, true, $3, $4, $5, $6)
         ON CONFLICT (switch_key, change_id) DO NOTHING
         RETURNING id, state, requested_at AS "requestedAt"`,
        [id, WITHDRAWAL_EXECUTION_SWITCH, adminId, changeId.trim(), reason.trim(), requestId],
      )
      if (!rows.length) {
        const [existing] = await runner.query(
          `SELECT id, state, requested_at AS "requestedAt"
             FROM app.operational_switch_change_requests
            WHERE switch_key = $1 AND change_id = $2`,
          [WITHDRAWAL_EXECUTION_SWITCH, changeId.trim()],
        )
        return { ...existing, duplicate: true }
      }
      await this.audit(runner, adminId, requestId, 'wallet.withdrawal.execution_resume_requested', {
        resumeRequestId: id,
        changeId: changeId.trim(),
        reason: reason.trim(),
      })
      return { ...rows[0], duplicate: false }
    })
  }

  async decideResume(resumeRequestId: string, adminId: string, approve: boolean, requestId: string) {
    return this.transaction(async (runner) => {
      const [change] = await runner.query(
        `SELECT * FROM app.operational_switch_change_requests WHERE id = $1 FOR UPDATE`,
        [resumeRequestId],
      )
      if (!change) throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Funds resume request was not found.' })
      if (change.state !== 'requested') {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_SWITCH_CONFLICT,
          message: `Funds resume request cannot be decided from ${change.state}.`,
        })
      }
      if (change.requested_by === adminId) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_SWITCH_CONFLICT,
          message: 'The administrator who requested funds execution cannot approve its resumption.',
        })
      }
      const state = approve ? 'approved' : 'rejected'
      await runner.query(
        `UPDATE app.operational_switch_change_requests
            SET state = $2, decided_by = $3, decided_at = now()
          WHERE id = $1`,
        [resumeRequestId, state, adminId],
      )
      if (approve) {
        if (!this.environmentAllowsExecution) {
          throw new ConflictException({
            code: WALLET_ERROR_CODES.EXECUTION_DISABLED,
            message: 'Environment-level financial execution is disabled.',
          })
        }
        await runner.query(
          `UPDATE app.operational_switches
              SET enabled = true, version = version + 1,
                  reason = $2, changed_by = $3, updated_at = now()
            WHERE switch_key = $1`,
          [WITHDRAWAL_EXECUTION_SWITCH, `Approved change ${change.change_id}`, adminId],
        )
      }
      await this.audit(
        runner,
        adminId,
        requestId,
        approve ? 'wallet.withdrawal.execution_resumed' : 'wallet.withdrawal.execution_resume_rejected',
        { resumeRequestId, requestedBy: change.requested_by, changeId: change.change_id },
      )
      return { id: resumeRequestId, state, enabled: approve }
    })
  }

  private audit(runner: QueryRunner, adminId: string, requestId: string, action: string, metadata: Record<string, unknown>) {
    return runner.query(
      `INSERT INTO app.audit_logs
        (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'admin', $2, $3, 'operational_switch', $4, $5, $6)`,
      [randomUUID(), adminId, action, WITHDRAWAL_EXECUTION_SWITCH, requestId, JSON.stringify(metadata)],
    )
  }

  private async transaction<T>(work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const result = await work(runner)
      await runner.commitTransaction()
      return result
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }
}
