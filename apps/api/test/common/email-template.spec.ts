import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { emailLocale, renderEmailTemplate, remainingEmailMinutes } from '../../src/common/email-template'

const contracts = JSON.parse(readFileSync(join(__dirname, '../../src/assets/email-templates/data-contract.json'), 'utf8')) as
  { id: string; locale: string; fields: string[] }[]
function sample(fields: string[]) {
  return Object.fromEntries(fields.filter(field => !['assetBaseUrl', 'year', 'supportUrl'].includes(field)).map(field =>
    [field, field === 'code' ? '012345' : field.endsWith('Url') ? 'https://a-reit.com/profile/security'
      : field === 'amount' ? '123.45' : field === 'currency' ? 'USDT' : field === 'expiryMinutes' ? '1.5' : 'TEST_VALUE']))
}

describe('Production email template rendering', () => {
  it.each(contracts.map(contract => [contract.id, contract.locale, contract.fields] as const))(
    'renders %s/%s with complete matching HTML and plain-text values', (id, locale, fields) => {
      const result = renderEmailTemplate(id, locale, sample(fields))
      expect(result.subject.length).toBeGreaterThan(0)
      expect(result.html).toContain(`lang="${locale}"`)
      expect(result.html).not.toMatch(/\{\{|PREVIEW_NOT_A_VALID_TOKEN|localhost|<script\b/)
      expect(result.text).not.toMatch(/\{\{|PREVIEW_NOT_A_VALID_TOKEN|localhost/)
      expect(`${result.subject} ${result.html} ${result.text}`).not.toMatch(/RWA\.LAT|rwa\.lat/i)
      expect(result.html).toContain('https://api.a-reit.com/v1/media/email-v2/logo-lockup.png')
      expect(result.html).not.toMatch(/identity-envelope|funds-wallet|security-key|<svg\b|background-image:/)
      expect(result.html).toContain('name="color-scheme"')
      expect(Buffer.byteLength(result.html)).toBeLessThan(80_000)
      for (const field of fields.filter(field => !['assetBaseUrl', 'year'].includes(field))) {
        expect(result.html).toContain(String(sample(fields)[field] ?? 'https://a-reit.com/profile/support'))
        expect(result.text).toContain(String(sample(fields)[field] ?? 'https://a-reit.com/profile/support'))
      }
      if (fields.includes('code')) { expect(result.html).toContain('012345'); expect(result.text).toContain('012345') }
      if (fields.includes('amount')) { expect(result.html).toContain('123.45'); expect(result.text).toContain('123.45') }
      if (fields.includes('actionUrl')) expect(result.html).toContain('<v:roundrect')
      if (fields.includes('code')) expect(result.html).not.toContain('<v:roundrect')
    })

  it('escapes dynamic HTML text while preserving the plain-text fallback', () => {
    const contract = contracts.find(item => item.id === 'support-reply' && item.locale === 'en')!
    const data = sample(contract.fields)
    const field = contract.fields.find(item => !item.endsWith('Url') && !['year', 'assetBaseUrl'].includes(item))!
    data[field] = '<script>alert("x")</script>'
    const result = renderEmailTemplate(contract.id, 'en', data)
    expect(result.html).toContain('&lt;script&gt;')
    expect(result.html).not.toContain('<script>')
    expect(result.text).toContain(data[field])
  })
  it.each(['javascript:alert(1)', 'https://a-reit.com.evil.example/recovery', 'https://user:password@a-reit.com/recovery',
    'http://a-reit.com/recovery', 'https://a-reit.com:8443/recovery'])(
    'rejects untrusted action URLs: %s', actionUrl => {
      expect(() => renderEmailTemplate('recovery-link', 'en', { actionUrl, expiryText: '2 min' })).toThrow()
    })
  it('rejects missing, unknown, malformed and path-traversal input', () => {
    expect(() => renderEmailTemplate('../identity.service', 'en', {})).toThrow()
    expect(() => renderEmailTemplate('login-code', 'en', { code: '012345' })).toThrow()
    expect(() => renderEmailTemplate('login-code', 'en', { code: '012345', expiryMinutes: '10', assetBaseUrl: 'https://evil.example' })).toThrow()
    expect(() => renderEmailTemplate('login-code', 'en', { code: '<01234', expiryMinutes: '10' })).toThrow()
  })
  it('normalizes supported locale variants and safely falls back', () => {
    expect(emailLocale('zh')).toBe('zh-CN')
    expect(emailLocale('PT-br')).toBe('pt')
    expect(emailLocale('../../secret')).toBe('en')
    expect(emailLocale('de-DE')).toBe('en')
  })
  it('keeps Arabic code and money in left-to-right text without changing the document direction', () => {
    const code = renderEmailTemplate('login-code', 'ar', { code: '012345', expiryMinutes: '1.5' })
    const money = renderEmailTemplate('withdrawal-submitted', 'ar', sample(contracts.find(c => c.id === 'withdrawal-submitted' && c.locale === 'ar')!.fields))
    expect(code.html).toContain('dir="rtl"')
    expect(code.html).toMatch(/dir="ltr"[^>]*>012345</)
    expect(money.html).toMatch(/dir="ltr"[^>]*>123\.45 /)
    expect(code.html).not.toContain('href="https://a-reit.com/profile/security"')
  })
  it('rejects expired and invalid timestamps', () => {
    expect(() => remainingEmailMinutes(new Date(Date.now() - 1))).toThrow()
    expect(() => remainingEmailMinutes(new Date(NaN))).toThrow()
  })
})
