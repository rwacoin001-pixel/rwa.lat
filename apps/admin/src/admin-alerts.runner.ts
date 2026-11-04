import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import { DataSource } from 'typeorm'
import { AdminTodayService } from './admin-today.service'
import { AlertIssue, alertIssues, pickToSend, remember, renderAlertEmail, REPEAT_MS } from './admin-alerts'

type AdminRecipient = { id: string; email: string | null; permissions: string[] }

@Injectable()
export class AdminAlertsRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(AdminAlertsRunner.name)
  private readonly memory = new Map<string, Map<string, number>>()
  private firstTimer?: NodeJS.Timeout
  private interval?: NodeJS.Timeout
  private started = false
  private destroyed = false
  private running = false

  constructor(
    private readonly ds: DataSource,
    private readonly config: ConfigService,
    private readonly todayService: AdminTodayService,
  ) {}

  private enabled(): boolean {
    return this.config.get('APP_ENV') !== 'test' && this.config.get('NODE_ENV') !== 'test'
      && !['off', 'false', '0'].includes(String(this.config.get('ADMIN_ALERT_EMAILS') ?? '').toLowerCase().trim())
      && this.config.get('EMAIL_PROVIDER') === 'resend' && !!this.config.get('RESEND_API_KEY') && !!this.config.get('EMAIL_FROM')
  }

  onApplicationBootstrap(): void {
    if (this.started || this.destroyed) return
    this.started = true
    if (!this.enabled()) {
      this.log.log('Admin alert emails disabled')
      return
    }
    this.firstTimer = setTimeout(() => {
      if (this.destroyed) return
      this.interval = setInterval(() => { void this.runOnce() }, 5 * 60 * 1000)
      this.interval.unref()
      void this.runOnce()
    }, 60 * 1000)
    this.firstTimer.unref()
  }

  onModuleDestroy(): void {
    this.destroyed = true
    if (this.firstTimer) clearTimeout(this.firstTimer)
    if (this.interval) clearInterval(this.interval)
  }

  async runOnce(nowMs = Date.now()): Promise<void> {
    if (this.running || this.destroyed || !this.enabled()) return
    this.running = true
    try {
      const admins: AdminRecipient[] = await this.ds.query(`SELECT u.id, u.email, COALESCE(array_agg(rp.permission) FILTER (WHERE rp.permission IS NOT NULL), '{}') AS permissions
        FROM app.admin_users u JOIN app.admin_roles r ON r.id = u.role_id
        LEFT JOIN app.admin_role_permissions rp ON rp.role_id = r.id
        WHERE u.disabled_at IS NULL GROUP BY u.id, u.email`)
      const active = new Set(admins.filter((admin) => admin.email?.trim()).map((admin) => admin.id))
      for (const id of this.memory.keys()) if (!active.has(id)) this.memory.delete(id)
      for (const admin of admins) {
        if (this.destroyed) break
        if (!admin.email?.trim()) continue
        const memory = this.memory.get(admin.id) ?? new Map<string, number>()
        this.memory.set(admin.id, memory)
        let issues: AlertIssue[] | undefined
        let sent = false
        try {
          const today = await this.todayService.today({ id: admin.id, permissions: admin.permissions })
          issues = alertIssues(today, nowMs)
          const { send, fresh } = pickToSend(issues, memory, nowMs)
          if (send) {
            const consoleUrl = (this.config.get<string>('ADMIN_CONSOLE_URL') || 'https://admin.a-reit.com').replace(/\/+$/, '')
            const email = renderAlertEmail(issues, fresh, consoleUrl)
            const hash = createHash('sha256').update([...fresh].sort().join('\n')).digest('hex').slice(0, 16)
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                authorization: 'Bearer ' + this.config.get<string>('RESEND_API_KEY'),
                'content-type': 'application/json',
                'Idempotency-Key': `admin-alert-${admin.id}-${hash}-${Math.floor(nowMs / REPEAT_MS)}`,
              },
              body: JSON.stringify({ from: `A-REIT <${this.config.get<string>('EMAIL_FROM')}>`, to: [admin.email], ...email }),
              signal: AbortSignal.timeout(10000),
            })
            sent = response.ok
            if (!sent) this.log.warn(`Admin alert email delivery failed (status ${response.status})`)
          }
        } catch {
          // Upstream error messages can contain recipient addresses or credentials.
          this.log.warn('Admin alert email processing failed for an administrator')
        } finally {
          if (issues) remember(issues, memory, nowMs, sent)
        }
      }
    } catch {
      this.log.warn('Admin alert email recipient lookup failed')
    } finally {
      this.running = false
    }
  }
}
