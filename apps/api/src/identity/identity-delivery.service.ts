import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport, type Transporter } from 'nodemailer'
import type { IdentityOneTimeTokenPurpose } from './identity-one-time-token.entity'

@Injectable()
export class IdentityDeliveryService {
  private readonly demoOutbox = new Map<string, string>()
  private readonly demoMode: boolean
  private readonly transporter: Transporter | null
  private readonly publicAppUrl: string
  private readonly fromAddress: string
  private readonly fromName: string

  constructor(private readonly config: ConfigService) {
    this.demoMode = config.get<string>('AUTH_ADAPTER') === 'demo'
    this.publicAppUrl = config.get<string>('PUBLIC_APP_URL') ?? ''
    this.fromAddress = config.get<string>('EMAIL_FROM') ?? ''
    this.fromName = config.get<string>('EMAIL_FROM_NAME') ?? 'RWA.LAT'
    this.transporter = this.createSmtpTransport()
  }

  async sendOneTimeLink(input: { email: string; purpose: IdentityOneTimeTokenPurpose; token: string }): Promise<void> {
    if (this.demoMode) {
      this.demoOutbox.set(this.key(input.email, input.purpose), input.token)
      return
    }
    if (!this.transporter || !this.publicAppUrl || !this.fromAddress) {
      throw new ServiceUnavailableException({
        code: 'AUTH_DELIVERY_NOT_CONFIGURED',
        message: 'Account email delivery is not configured.',
      })
    }
    const link = this.oneTimeLink(input.purpose, input.token)
    const verification = input.purpose === 'email_verification'
    const subject = verification ? 'Verify your RWA.LAT account' : 'Recover your RWA.LAT account'
    const action = verification ? 'Verify account' : 'Recover account'
    try {
      await this.transporter.sendMail({
        from: { name: this.fromName, address: this.fromAddress },
        to: input.email,
        subject,
        text: `${action}: ${link}`,
        html: `<p>${action}</p><p><a href="${escapeHtml(link)}">${action}</a></p><p>This link expires in 15 minutes and can be used once.</p>`,
      })
    } catch {
      throw new ServiceUnavailableException({
        code: 'AUTH_DELIVERY_FAILED',
        message: 'Account email could not be delivered. Please retry later.',
      })
    }
  }

  /** Test-only accessor for the explicitly enabled demo delivery adapter. */
  lastDemoToken(email: string, purpose: IdentityOneTimeTokenPurpose): string | undefined {
    return this.demoOutbox.get(this.key(email, purpose))
  }

  private key(email: string, purpose: IdentityOneTimeTokenPurpose): string {
    return `${purpose}:${email.trim().toLowerCase()}`
  }

  private oneTimeLink(purpose: IdentityOneTimeTokenPurpose, token: string): string {
    const path = purpose === 'email_verification' ? '/verify-email' : '/recover'
    const link = new URL(path, this.publicAppUrl)
    link.searchParams.set('token', token)
    return link.toString()
  }

  private createSmtpTransport(): Transporter | null {
    if (this.demoMode || this.config.get<string>('EMAIL_PROVIDER') !== 'smtp') return null
    const secure = this.config.get<string>('SMTP_SECURE') === 'true'
    const authMode = this.config.get<string>('SMTP_AUTH_MODE') ?? 'plain'
    const port = Number(this.config.get<string>('SMTP_PORT') ?? (secure ? '465' : '587'))
    return createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port,
      secure,
      requireTLS: !secure,
      connectionTimeout: readPositiveInteger(this.config.get<string>('SMTP_CONNECTION_TIMEOUT_MS'), 10_000),
      greetingTimeout: readPositiveInteger(this.config.get<string>('SMTP_GREETING_TIMEOUT_MS'), 10_000),
      socketTimeout: readPositiveInteger(this.config.get<string>('SMTP_SOCKET_TIMEOUT_MS'), 20_000),
      auth: authMode === 'plain' ? {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      } : undefined,
      tls: { rejectUnauthorized: true },
    })
  }
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
