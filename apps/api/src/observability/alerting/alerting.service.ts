import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

export interface AlertRule {
  name: string
  query: () => Promise<number>
  threshold: number
  operator: 'gt' | 'lt' | 'eq'
  cooldownMs: number
  severity: 'critical' | 'warning' | 'info'
  description: string
}

export interface Alert {
  id: string
  ruleName: string
  message: string
  value: number
  threshold: number
  severity: AlertRule['severity']
  timestamp: Date
  acknowledged: boolean
}

@Injectable()
export class AlertingService implements OnModuleInit, OnModuleDestroy {
  private readonly rules: AlertRule[] = []
  private readonly alerts: Alert[] = []
  private readonly lastFired = new Map<string, number>()
  private emailTransporter?: nodemailer.Transporter
  private evaluationTimer: NodeJS.Timeout | null = null

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (this.config.get('SMTP_HOST')) {
      this.emailTransporter = nodemailer.createTransport({
        host: this.config.get('SMTP_HOST'),
        port: this.config.get('SMTP_PORT') ?? 587,
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASSWORD'),
        },
      })
    }

    // Default alert rules
    this.registerRule({
      name: 'high_error_rate',
      query: async () => {
        // Would integrate with metrics service
        return 0
      },
      threshold: 0.05,
      operator: 'gt',
      cooldownMs: 5 * 60 * 1000,
      severity: 'critical',
      description: 'Error rate > 5%',
    })

    this.registerRule({
      name: 'high_latency_p99',
      query: async () => 0,
      threshold: 2,
      operator: 'gt',
      cooldownMs: 10 * 60 * 1000,
      severity: 'warning',
      description: 'P99 latency > 2s',
    })

    // Check rules every 30s
    this.evaluationTimer = setInterval(() => void this.evaluateRules(), 30_000)
    this.evaluationTimer.unref()
  }

  onModuleDestroy(): void {
    if (this.evaluationTimer) clearInterval(this.evaluationTimer)
    this.evaluationTimer = null
    this.emailTransporter?.close()
  }

  registerRule(rule: AlertRule): void {
    this.rules.push(rule)
  }

  async evaluateRules(): Promise<void> {
    for (const rule of this.rules) {
      const now = Date.now()
      const last = this.lastFired.get(rule.name) ?? 0
      if (now - last < rule.cooldownMs) continue

      try {
        const value = await rule.query()
        let shouldFire = false
        if (rule.operator === 'gt' && value > rule.threshold) shouldFire = true
        if (rule.operator === 'lt' && value < rule.threshold) shouldFire = true
        if (rule.operator === 'eq' && value === rule.threshold) shouldFire = true

        if (shouldFire) {
          await this.fireAlert(rule, value)
          this.lastFired.set(rule.name, now)
        }
      } catch (e) {
        console.error(`Alert rule ${rule.name} failed:`, e)
      }
    }
  }

  private async fireAlert(rule: AlertRule, value: number): Promise<void> {
    const alert: Alert = {
      id: crypto.randomUUID(),
      ruleName: rule.name,
      message: `${rule.description} (current: ${value}, threshold: ${rule.threshold})`,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      timestamp: new Date(),
      acknowledged: false,
    }

    this.alerts.unshift(alert)
    if (this.alerts.length > 1000) this.alerts.pop()

    console.warn(`[ALERT ${rule.severity.toUpperCase()}] ${alert.message}`)

    if (this.emailTransporter && rule.severity === 'critical') {
      await this.sendEmailAlert(alert)
    }
  }

  private async sendEmailAlert(alert: Alert): Promise<void> {
    if (!this.emailTransporter) return
    try {
      await this.emailTransporter.sendMail({
        from: this.config.get('ALERT_FROM_EMAIL') ?? 'alerts@rwa-lat.com',
        to: this.config.get('ALERT_TO_EMAIL') ?? 'ops@rwa-lat.com',
        subject: `[${alert.severity.toUpperCase()}] ${alert.ruleName}`,
        text: `${alert.message}\n\nTime: ${alert.timestamp.toISOString()}\nValue: ${alert.value}\nThreshold: ${alert.threshold}`,
      })
    } catch (e) {
      console.error('Failed to send alert email:', e)
    }
  }

  getAlerts(since?: Date, severity?: AlertRule['severity']): Alert[] {
    let result = this.alerts
    if (since) result = result.filter((a) => a.timestamp >= since)
    if (severity) result = result.filter((a) => a.severity === severity)
    return result
  }

  acknowledgeAlert(id: string): boolean {
    const alert = this.alerts.find((a) => a.id === id)
    if (!alert) return false
    alert.acknowledged = true
    return true
  }

  async manualFire(ruleName: string, value: number): Promise<void> {
    const rule = this.rules.find((r) => r.name === ruleName)
    if (!rule) throw new Error(`Rule ${ruleName} not found`)
    await this.fireAlert(rule, value)
  }
}
