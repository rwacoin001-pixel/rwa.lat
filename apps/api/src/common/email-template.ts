import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const EMAIL_LOCALES = ['zh-CN', 'en', 'hi', 'es', 'ar', 'fr', 'pt'] as const
export type EmailLocale = typeof EMAIL_LOCALES[number]
export const EMAIL_ASSET_BASE_URL = 'https://api.a-reit.com/v1/media/email-v1'
const RESOURCE_ROOT = join(__dirname, '..', 'assets', 'email-templates')
const ALLOWED_HOSTS = new Set(['a-reit.com', 'www.a-reit.com'])
const COMMON_FIELDS = new Set(['assetBaseUrl', 'supportUrl', 'year'])
type Contract = { id: string; locale: EmailLocale; subject: string; fields: string[] }
let contracts: Map<string, Contract> | undefined
const templates = new Map<string, { html: string; text: string }>()

export function emailLocale(value?: string): EmailLocale {
  const language = (value ?? 'en').toLowerCase().split('-')[0]
  return language === 'zh' ? 'zh-CN' : EMAIL_LOCALES.find(locale => locale === language) ?? 'en'
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function remainingEmailMinutes(expiresAt: Date): string {
  const remaining = expiresAt.getTime() - Date.now()
  if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('Email challenge expired')
  // Round down so resends cannot advertise a longer life than the stored challenge.
  return (Math.floor(remaining / 600) / 100).toString()
}

export function emailExpiryText(expiresAt: Date, locale?: string): string {
  const minutes = remainingEmailMinutes(expiresAt)
  const units: Record<EmailLocale, string> = { 'zh-CN': '分钟', en: 'min', hi: 'मिनट', es: 'min', ar: 'دقيقة', fr: 'min', pt: 'min' }
  return `${minutes} ${units[emailLocale(locale)]}`
}

/** Only server-owned events select a template. This function never sends mail or changes business state. */
export function renderEmailTemplate(id: string, locale: string | undefined, data: Record<string, string | number>): {
  subject: string; html: string; text: string
} {
  if (!contracts) {
    const rows = JSON.parse(readFileSync(join(RESOURCE_ROOT, 'data-contract.json'), 'utf8')) as Contract[]
    contracts = new Map(rows.map(row => [`${row.id}/${row.locale}`, row]))
  }
  const language = emailLocale(locale)
  const key = `${id}/${language}`
  const contract = contracts.get(key)
  if (!contract) throw new Error('Unknown email template')
  const values: Record<string, string | number> = { ...data, assetBaseUrl: EMAIL_ASSET_BASE_URL,
    supportUrl: 'https://a-reit.com/profile/support', year: new Date().getUTCFullYear() }
  for (const field of Object.keys(data)) {
    if (COMMON_FIELDS.has(field) || !contract.fields.includes(field)) throw new Error('Unexpected email field')
  }
  for (const field of contract.fields) {
    const value = values[field]
    if ((typeof value !== 'string' && typeof value !== 'number') || (typeof value === 'number' && !Number.isFinite(value))
      || String(value).length > 4000 || /[\u0000\r]/.test(String(value))) throw new Error('Invalid email field')
    if (field.endsWith('Url') && field !== 'assetBaseUrl') {
      const url = new URL(String(value))
      if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password || url.port) {
        throw new Error('Untrusted email URL')
      }
    }
  }
  if ('code' in values && !/^\d{6}$/.test(String(values.code))) throw new Error('Invalid verification code')
  if (!templates.has(key)) templates.set(key, {
    html: readFileSync(join(RESOURCE_ROOT, 'templates', language, `${id}.html`), 'utf8'),
    text: readFileSync(join(RESOURCE_ROOT, 'templates', language, `${id}.txt`), 'utf8'),
  })
  const template = templates.get(key)!
  const replace = (content: string, html: boolean) => {
    const rendered = content.replace(/\{\{([A-Za-z]+)\}\}/g, (_match, field: string) => {
      if (!contract.fields.includes(field)) throw new Error('Unknown email variable')
      return html ? escapeHtml(String(values[field])) : String(values[field])
    })
    if (/\{\{|\}\}/.test(rendered)) throw new Error('Unresolved email variable')
    return rendered
  }
  return { subject: contract.subject, html: replace(template.html, true), text: replace(template.text, false) }
}
