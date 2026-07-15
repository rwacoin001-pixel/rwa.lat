import {
  maskEmail,
  maskPhone,
  maskName,
  maskAccount,
  maskGeneric,
  looksLikePII,
} from '../../src/data-governance/data-masking.util'

describe('data-masking.util', () => {
  it('maskEmail keeps first char and domain', () => {
    expect(maskEmail('alice@example.com')).toBe('a****@example.com')
  })

  it('maskEmail handles short local part', () => {
    expect(maskEmail('a@example.com')).toBe('***@example.com')
  })

  it('maskPhone keeps first 3 and last 4, preserves intl prefix', () => {
    expect(maskPhone('+86 138 0000 8000')).toBe('+86 138****8000')
  })

  it('maskName keeps surname for CJK', () => {
    expect(maskName('张三')).toBe('张*')
  })

  it('maskName masks English name initials', () => {
    expect(maskName('John Doe')).toBe('J*** D**')
  })

  it('maskAccount shows only last 4', () => {
    expect(maskAccount('6222021234567890123')).toBe('***************0123')
  })

  it('maskGeneric keeps edges', () => {
    expect(maskGeneric('abcdefgh', 4)).toBe('ab****gh')
  })

  it('looksLikePII detects email and phone', () => {
    expect(looksLikePII('a@b.com')).toBe(true)
    expect(looksLikePII('13800008000')).toBe(true)
    expect(looksLikePII('productId_123')).toBe(false)
  })
})
