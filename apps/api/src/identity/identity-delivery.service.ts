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
    const verification = input.purpose === 'email_verification'
    const subject = verification ? 'Verify your RWA.LAT account' : 'Recover your RWA.LAT account'
    const action = verification ? 'Verify account' : 'Recover account'
    try {
      await this.delivery.send({
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

}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
