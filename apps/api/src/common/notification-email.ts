import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EMAIL_ASSET_BASE_URL, EMAIL_LOCALES, EmailLocale, EmailTemplateInputError, renderEmailTemplate } from './email-template'

type NotificationEmail = { kind: string; title: string; body?: string; payload?: Record<string, unknown> }
const PREFERENCES_URL = 'https://a-reit.com/profile/marketing'
const NOTIFICATIONS_URL = 'https://a-reit.com/notifications'
const SUPPORT_URL = 'https://a-reit.com/profile/support'
const COMMON_FIELDS = new Set(['assetBaseUrl', 'supportUrl', 'year'])
// Notification kind, never caller-supplied templateId, selects a scenario. Authentication
// challenges stay with IdentityDeliveryService, which owns their validity and expiry.
const SCENARIOS = new Set([
  'welcome', 'new-login', 'password-changed', 'email-changed', 'security-factor-changed',
  'recovery-completed', 'account-closed', 'deposit-received', 'withdrawal-submitted',
  'withdrawal-completed', 'withdrawal-failed', 'transfer-sent', 'transfer-received',
  'order-submitted', 'order-completed', 'order-failed', 'redemption-completed',
  'dividend-paid', 'prediction-settled', 'kyc-approved', 'kyc-action-required',
  'kyc-expiring', 'support-reply', 'statement-ready', 'policy-update', 'ai-allocation-update',
])
let scenarioFields: Map<string, string[]> | undefined

export function notificationEmailLocale(...values: Array<string | null | undefined>): EmailLocale {
  for (const value of values) {
    const language = value?.trim().toLowerCase().replace(/_/g, '-').split('-')[0]
    if (language === 'zh') return 'zh-CN'
    const supported = EMAIL_LOCALES.find(locale => locale === language)
    if (supported) return supported
  }
  return 'en'
}

export function isOptionalNotification(kind: string): boolean {
  return ['marketing', 'product-update'].includes(kind.replace(/_/g, '-'))
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const CHROME: Record<EmailLocale, { notice: string; view: string; support: string; preferences: string }> = {
  'zh-CN': { notice: '账户通知', view: '查看通知', support: '帮助与支持', preferences: '管理邮件偏好' },
  en: { notice: 'Account notice', view: 'View notifications', support: 'Help & support', preferences: 'Manage email preferences' },
  hi: { notice: 'खाता सूचना', view: 'सूचनाएँ देखें', support: 'सहायता और समर्थन', preferences: 'ईमेल प्राथमिकताएँ प्रबंधित करें' },
  es: { notice: 'Aviso de cuenta', view: 'Ver notificaciones', support: 'Ayuda y soporte', preferences: 'Gestionar preferencias de correo' },
  ar: { notice: 'إشعار الحساب', view: 'عرض الإشعارات', support: 'المساعدة والدعم', preferences: 'إدارة تفضيلات البريد الإلكتروني' },
  fr: { notice: 'Notification de compte', view: 'Voir les notifications', support: 'Aide et assistance', preferences: 'Gérer les préférences e-mail' },
  pt: { notice: 'Aviso da conta', view: 'Ver notificações', support: 'Ajuda e suporte', preferences: 'Gerenciar preferências de e-mail' },
}

/** Presentation only: this cannot create a delivery, challenge, transaction, or event. */
export function renderNotificationEmail(note: NotificationEmail, locale: EmailLocale): { subject: string; html: string; text: string } {
  const scenario = note.kind.replace(/_/g, '-')
  if (SCENARIOS.has(scenario)) {
    if (!scenarioFields) {
      const contracts = JSON.parse(readFileSync(join(__dirname, '..', 'assets', 'email-templates', 'data-contract.json'), 'utf8')) as Array<{ id: string; locale: string; fields: string[] }>
      scenarioFields = new Map(contracts.filter(row => row.locale === 'en').map(row => [row.id, row.fields.filter(field => !COMMON_FIELDS.has(field))]))
    }
    const fields = scenarioFields.get(scenario)
    const content = note.payload?.content ?? note.payload
    if (fields && content && typeof content === 'object' && !Array.isArray(content)) {
      const entries = Object.entries(content)
      // Incomplete or mismatched contracts fall back to the original notice. Never
      // infer an amount, destination, reference, code, URL, or financial state.
      if (entries.length === fields.length && entries.every(([key, value]) => fields.includes(key)
        && (typeof value === 'string' ? value.trim().length > 0 : typeof value === 'number' && Number.isFinite(value)))) {
        try { return renderEmailTemplate(scenario, locale, Object.fromEntries(entries) as Record<string, string | number>) }
        catch (error) {
          // Invalid notice data retains the safe original notice. Broken assets or
          // renderer failures must reach the queue's existing failure/retry path.
          if (!(error instanceof EmailTemplateInputError)) throw error
        }
      }
    }
  }
  const chrome = CHROME[locale]
  const title = note.title || chrome.notice
  const body = note.body || title
  const subject = `${title.replace(/[\r\n\u0000]/g, ' ').trim()} · A-REIT`
  const optional = isOptionalNotification(note.kind)
  const direction = locale === 'ar' ? 'rtl' : 'ltr'
  const align = locale === 'ar' ? 'right' : 'left'
  const preferences = optional ? `<br><a href="${PREFERENCES_URL}" class="mail-link" style="color:#92703f">${chrome.preferences}</a>` : ''
  const html = `<!doctype html>
<html lang="${locale}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(title)}</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse}img{border:0}.mail-bg{background:#f3f4f4}.surface{background:#ffffff}.ink{color:#161a1d}.muted{color:#747779}@media(max-width:620px){.body-pad{padding:30px 24px!important}.outer-pad{padding:16px 10px!important}}@media(prefers-color-scheme:dark){.mail-bg{background:#0e1115!important}.surface{background:#191e24!important}.ink{color:#f4f4f2!important}.muted{color:#a6aaae!important}.rule{border-color:#343b42!important}.mail-link{color:#e3bb7a!important}}[data-ogsc] .mail-bg{background:#0e1115!important}[data-ogsc] .surface{background:#191e24!important}[data-ogsc] .ink{color:#f4f4f2!important}[data-ogsc] .muted{color:#a6aaae!important}[data-ogsc] .mail-link{color:#e3bb7a!important}</style></head>
<body class="mail-bg" bgcolor="#f3f4f4" style="margin:0;padding:0;width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" class="outer-pad" style="padding:38px 16px">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" class="surface rule" bgcolor="#ffffff" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border:1px solid #e4e5e5">
<tr><td bgcolor="#11151b" style="padding:25px 36px;border-bottom:2px solid #d5b27c"><img alt="A-REIT" src="${EMAIL_ASSET_BASE_URL}/logo-lockup.png" width="122" height="25" style="display:block;width:122px;height:25px;color:#ffffff"><div style="padding-top:12px;color:#aeb0b3;font-size:11px">${chrome.notice}</div></td></tr>
<tr><td class="body-pad" align="${align}" style="padding:34px 36px 32px"><h1 class="ink" dir="auto" style="margin:0 0 22px;color:#161a1d;font-size:28px;line-height:1.3;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(title)}</h1>
<div class="ink" dir="auto" style="color:#161a1d;font-size:15px;line-height:1.8;overflow-wrap:anywhere;word-break:break-word">${escapeHtml(body).replace(/\r?\n/g, '<br>')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td bgcolor="#e3bb7a" align="center" style="border-radius:7px"><a href="${NOTIFICATIONS_URL}" style="display:block;padding:16px 20px;color:#1b1c1c;font-size:14px;font-weight:600;text-decoration:none">${chrome.view}</a></td></tr></table></td></tr>
<tr><td class="muted rule" style="padding:20px 24px;border-top:1px solid #e9e9e7;text-align:center;font-size:11px;line-height:1.9;color:#747779"><a class="mail-link" href="${SUPPORT_URL}" style="color:#92703f">${escapeHtml(chrome.support)}</a>${preferences}<br>© ${new Date().getUTCFullYear()} A-REIT</td></tr></table>
<!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`
  const text = `${title}\n\n${body}\n\n${chrome.view}: ${NOTIFICATIONS_URL}\n${chrome.support}: ${SUPPORT_URL}${optional ? `\n${chrome.preferences}: ${PREFERENCES_URL}` : ''}\n© ${new Date().getUTCFullYear()} A-REIT`
  return { subject, html, text }
}
