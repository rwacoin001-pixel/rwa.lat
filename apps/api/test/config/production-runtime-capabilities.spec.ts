import {
  INSTALLED_PRODUCTION_CAPABILITIES,
  validateProductionRuntimeCapabilities,
} from '../../src/config/production-runtime-capabilities'

describe('production runtime capability manifest', () => {
  it('allows locked production but refuses live funds until custody is no longer a stub placeholder', () => {
    expect(validateProductionRuntimeCapabilities({
      APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false',
    })).toMatchObject({ PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false' })

    // 2026-09-18：操作方显式关闭制裁筛查（disabled 为审慎模式，允许开机）；
    // custody 仍为桩，资金模式开机被拒。
    expect(INSTALLED_PRODUCTION_CAPABILITIES).toEqual({ kyc: 'live', sanctions: 'disabled', custody: 'stub' })

    let message = ''
    try {
      validateProductionRuntimeCapabilities({
        APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true',
      })
    } catch (error) {
      message = String(error)
    }
    expect(message).toContain('custody')
    expect(message).not.toContain('sanctions')
  })
})
