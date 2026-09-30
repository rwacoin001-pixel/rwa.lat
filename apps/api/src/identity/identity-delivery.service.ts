import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EmailDeliveryClient } from '../common/email-delivery.client'
import type { IdentityOneTimeTokenPurpose } from './identity-one-time-token.entity'

@Injectable()
export class IdentityDeliveryService implements OnModuleDestroy {
  private readonly demoOutbox = new Map<string, string>()
  private readonly demoMode: boolean
  private readonly delivery: EmailDeliveryClient
  private readonly publicAppUrl: string

  constructor(private readonly config: ConfigService) {
    this.demoMode = config.get<string>('AUTH_ADAPTER') === 'demo'
    this.publicAppUrl = config.get<string>('PUBLIC_APP_URL') ?? ''
    this.delivery = new EmailDeliveryClient(config)
  }

  onModuleDestroy(): void {
    this.delivery.close()
  }

  async sendOneTimeLink(input: { email: string; purpose: IdentityOneTimeTokenPurpose; token: string }): Promise<void> {
    if (this.demoMode) {
      this.demoOutbox.set(this.key(input.email, input.purpose), input.token)
      return
    }
    if (!this.delivery.configured || !this.publicAppUrl) {
      throw new ServiceUnavailableException({
        code: 'AUTH_DELIVERY_NOT_CONFIGURED',
        message: 'Account email delivery is not configured.',
      })
    }
    const link = this.oneTimeLink(input.purpose, input.token)
    const subject = input.purpose === 'email_verification'
      ? 'Verify your RWA.LAT account'
      : input.purpose === 'email_login'
        ? 'Sign in to RWA.LAT'
        : 'Recover your RWA.LAT account'
    const action = input.purpose === 'email_verification'
      ? 'Verify account'
      : input.purpose === 'email_login'
        ? 'Sign in'
        : 'Recover account'
    try {
      await this.delivery.send({
        to: input.email,
        subject,
        text: `${action}: ${link}`,
        html: `<p>${action}</p><p><a href="${escapeHtml(link)}">${action}</a></p><p>This link expires in 60 minutes and can be used once.</p>`,
      })
    } catch {
      throw new ServiceUnavailableException({
        code: 'AUTH_DELIVERY_FAILED',
        message: 'Account email could not be delivered. Please retry later.',
      })
    }
  }

  async sendEmailCode(input: { email: string; intent: 'login' | 'register'; code: string; locale: string }): Promise<void> {
    if (this.demoMode) {
      this.demoOutbox.set(`code:${input.intent}:${input.email.toLowerCase()}`, input.code)
      return
    }
    if (!this.delivery.configured) throw new ServiceUnavailableException({ code: 'AUTH_DELIVERY_NOT_CONFIGURED', message: 'Account email delivery is not configured.' })
    const chinese = input.locale === 'zh' || input.locale === 'zh-CN'
    const subject = chinese ? 'RWA.LAT 邮箱验证码' : 'Your RWA.LAT verification code'
    const instruction = chinese ? '请在发起登录或注册的页面输入以下验证码：' : 'Enter this code on the page where you started signing in or creating an account:'
    const note = chinese ? '验证码 10 分钟内有效，只能使用一次。请勿向任何人透露；如非本人操作，请忽略此邮件。' : 'This code expires in 10 minutes and can be used once. Never share it. If you did not request it, ignore this email.'
    try {
      await this.delivery.send({ to: input.email, subject,
        text: `${instruction}\n\n${input.code}\n\n${note}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;color:#182522"><p style="font-size:18px;font-weight:700">RWA.LAT</p><p>${instruction}</p><p style="font-size:36px;letter-spacing:8px;font-weight:700">${escapeHtml(input.code)}</p><p style="font-size:13px;line-height:1.7">${note}</p></div>` })
    } catch {
      throw new ServiceUnavailableException({ code: 'AUTH_DELIVERY_FAILED', message: 'Account email could not be delivered. Please retry later.' })
    }
  }

  /** Explicit demo adapter only; never exposed through an HTTP endpoint. */
  lastDemoCode(email: string, intent: 'login' | 'register'): string | undefined {
    return this.demoOutbox.get(`code:${intent}:${email.trim().toLowerCase()}`)
  }

  /** Test-only accessor for the explicitly enabled demo delivery adapter. */
  lastDemoToken(email: string, purpose: IdentityOneTimeTokenPurpose): string | undefined {
    return this.demoOutbox.get(this.key(email, purpose))
  }

  private key(email: string, purpose: IdentityOneTimeTokenPurpose): string {
    return `${purpose}:${email.trim().toLowerCase()}`
  }

  private oneTimeLink(purpose: IdentityOneTimeTokenPurpose, token: string): string {
    const path = purpose === 'email_verification'
      ? '/verify-email'
      : purpose === 'email_login'
        ? '/auth/callback/email'
        : '/recovery'
    const link = new URL(path, this.publicAppUrl)
    link.searchParams.set('token', token)
    return link.toString()
  }

}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
