import { Injectable, OnModuleDestroy, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EmailDeliveryClient } from '../common/email-delivery.client'
import type { IdentityOneTimeTokenPurpose } from './identity-one-time-token.entity'
import { emailExpiryText, remainingEmailMinutes, renderEmailTemplate } from '../common/email-template'

type EmailCodePurpose = 'login' | 'register' | 'reset' | 'email_bind' | 'email_change' | 'step_up'
const CODE_TEMPLATES: Record<EmailCodePurpose, string> = {
  login: 'login-code', register: 'registration-code', reset: 'reset-password-code', step_up: 'step-up-code',
  email_bind: 'bind-email-code', email_change: 'change-email-code',
}
@Injectable()
export class IdentityDeliveryService implements OnModuleDestroy {
  private readonly logger = new Logger(IdentityDeliveryService.name)
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

  async sendOneTimeLink(input: { email: string; purpose: IdentityOneTimeTokenPurpose; token: string; locale?: string; expiresAt?: Date }): Promise<void> {
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
    try {
      const template = input.purpose === 'email_verification' ? 'verification-link'
        : input.purpose === 'email_login' ? 'magic-login-link' : 'recovery-link'
      const message = renderEmailTemplate(template, input.locale, { actionUrl: link,
        expiryText: emailExpiryText(input.expiresAt ?? new Date(Date.now() + 3_600_000), input.locale) })
      await this.delivery.send({
        to: input.email,
        ...message,
      })
    } catch {
      throw new ServiceUnavailableException({
        code: 'AUTH_DELIVERY_FAILED',
        message: 'Account email could not be delivered. Please retry later.',
      })
    }
  }

  async sendEmailCode(input: { email: string; intent: 'login' | 'register'; code: string; locale: string; purpose?: EmailCodePurpose; expiresAt?: Date }): Promise<void> {
    if (this.demoMode) {
      this.demoOutbox.set(`code:${input.purpose === 'step_up' ? 'step_up' : input.intent}:${input.email.toLowerCase()}`, input.code)
      return
    }
    if (!this.delivery.configured) throw new ServiceUnavailableException({ code: 'AUTH_DELIVERY_NOT_CONFIGURED', message: 'Account email delivery is not configured.' })
    let phase: 'render' | 'transport' = 'render'
    try {
      const message = renderEmailTemplate(CODE_TEMPLATES[input.purpose ?? input.intent], input.locale, {
        code: input.code, expiryMinutes: remainingEmailMinutes(input.expiresAt ?? new Date(Date.now() + 600_000)),
      })
      phase = 'transport'
      await this.delivery.send({ to: input.email, ...message })
    } catch (error) {
      // Never log the recipient, code, credentials, provider response body or exception message.
      const status = error && typeof error === 'object' && 'providerStatus' in error ? error.providerStatus : undefined
      const providerStatus = typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
      this.logger.warn({ providerStatus, event: 'identity_email_delivery_failed', stage: 'code', phase, cause: error instanceof Error && ['Error', 'EmailTemplateInputError', 'AbortError', 'TimeoutError'].includes(error.name) ? error.name : 'UnknownError' })
      throw new ServiceUnavailableException({ code: 'AUTH_DELIVERY_FAILED', message: 'Account email could not be delivered. Please retry later.' })
    }
  }

  /** Explicit demo adapter only; never exposed through an HTTP endpoint. */
  lastDemoCode(email: string, intent: 'login' | 'register' | 'step_up'): string | undefined {
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
