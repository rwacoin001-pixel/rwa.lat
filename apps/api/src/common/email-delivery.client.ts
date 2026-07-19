import { ConfigService } from '@nestjs/config'
import { createTransport, type Transporter } from 'nodemailer'

const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails'

export interface EmailDeliveryMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export class EmailDeliveryClient {
  private readonly provider: string
  private readonly fromAddress: string
  private readonly fromName: string
  private readonly resendApiKey: string
  private readonly resendTimeoutMs: number
  private readonly smtpTransporter: Transporter | null

  constructor(private readonly config: ConfigService) {
    this.provider = config.get<string>('EMAIL_PROVIDER') ?? ''
    this.fromAddress = config.get<string>('EMAIL_FROM') ?? ''
    this.fromName = sanitizeDisplayName(config.get<string>('EMAIL_FROM_NAME') ?? 'RWA.LAT')
    this.resendApiKey = config.get<string>('RESEND_API_KEY') ?? ''
    this.resendTimeoutMs = readPositiveInteger(config.get<string>('RESEND_HTTP_TIMEOUT_MS'), 10_000)
    this.smtpTransporter = this.createSmtpTransport()
  }

  get configured(): boolean {
    if (!this.fromAddress) return false
    if (this.provider === 'smtp') return this.smtpTransporter !== null
    if (this.provider === 'resend') return this.resendApiKey.length > 0
    return false
  }

  async send(message: EmailDeliveryMessage): Promise<void> {
    if (!this.configured) throw new Error('Email delivery is not configured')
    if (this.provider === 'smtp') {
      await this.smtpTransporter!.sendMail({
        from: { name: this.fromName, address: this.fromAddress },
        ...message,
      })
      return
    }
    await this.sendWithResend(message)
  }

  close(): void {
    this.smtpTransporter?.close()
  }

  private createSmtpTransport(): Transporter | null {
    if (this.provider !== 'smtp') return null
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

  private async sendWithResend(message: EmailDeliveryMessage): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.resendTimeoutMs)
    timeout.unref()
    try {
      const response = await fetch(RESEND_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.resendApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromAddress}>`,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Email provider rejected the request')
    } finally {
      clearTimeout(timeout)
    }
  }
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function sanitizeDisplayName(value: string): string {
  return value.replace(/[\r\n<>]/g, '').trim() || 'RWA.LAT'
}
