import {
  add18,
  atomicTo18,
  cmp18,
  div18,
  format18,
  mul18,
  parse18,
  sub18,
  toAtomic,
  toAtomicRounded,
  toAtomicSigned,
  weightPct18,
} from '../../src/basket/basket.decimals'

describe('basket decimals (18dp fixed point)', () => {
  it('parses and formats decimal strings exactly', () => {
    expect(format18(parse18('1'))).toBe('1.000000000000000000')
    expect(format18(parse18('100.25'))).toBe('100.250000000000000000')
    expect(format18(parse18('0.000000000000000001'))).toBe('0.000000000000000001')
    expect(format18(parse18('-2.5'))).toBe('-2.500000000000000000')
    expect(() => parse18('1.1234567890123456789')).toThrow() // 19 位小数
    expect(() => parse18('abc')).toThrow()
  })

  it('adds, subtracts, multiplies and divides with floor rounding', () => {
    expect(format18(add18(parse18('0.1'), parse18('0.2')))).toBe('0.300000000000000000')
    expect(format18(sub18(parse18('1'), parse18('0.999999999999999999')))).toBe('0.000000000000000001')
    expect(format18(mul18(parse18('100'), parse18('0.315')))).toBe('31.500000000000000000')
    expect(format18(div18(parse18('1000'), parse18('3')))).toBe('333.333333333333333333')
    expect(cmp18(parse18('1'), parse18('1.0'))).toBe(0)
  })

  it('converts to atomic units with strict and rounded modes', () => {
    expect(toAtomic(parse18('100'), 6)).toBe('100000000')
    expect(() => toAtomic(parse18('0.0000005'), 6)).toThrow() // 低于原子精度
    expect(toAtomicRounded(parse18('0.0000005'), 6)).toBe('1') // 四舍五入
    expect(toAtomicRounded(parse18('0.0000004'), 6)).toBe('0')
    expect(toAtomicSigned(parse18('-1.25'), 6)).toBe('-1250000')
    expect(atomicTo18('100000000', 6)).toBe(parse18('100'))
  })

  it('computes percentage weights at 4dp', () => {
    expect(weightPct18(parse18('25'), parse18('100'))).toBe('25.0000')
    expect(weightPct18(parse18('1'), parse18('3'))).toBe('33.3333')
    expect(weightPct18(parse18('0'), parse18('0'))).toBe('0.0000')
  })

  it('keeps the zero cash-buffer invariant: units * nav == amount', () => {
    const amount = parse18('1000')
    const nav = parse18('1')
    const units = div18(amount, nav)
    expect(format18(mul18(units, nav))).toBe('1000.000000000000000000')
  })
})
