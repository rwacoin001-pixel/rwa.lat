import {
  INSTALLED_PRODUCTION_CAPABILITIES,
  validateProductionRuntimeCapabilities,
} from '../../src/config/production-runtime-capabilities'

describe('production runtime capability manifest', () => {
  it('allows locked production and refuses live funds when any placeholder capability remains', () => {
    expect(validateProductionRuntimeCapabilities({
      APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false',
    })).toMatchObject({ PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false' })

    // 2026-09-18：制裁筛查为操作方显式关闭（disabled 审慎模式），托管为手动模式；
    // 释放镜像不再包含 stub 占位能力。
    expect(INSTALLED_PRODUCTION_CAPABILITIES).toEqual({ kyc: 'live', sanctions: 'disabled', custody: 'manual' })

    // 手动托管模式通过能力清单（其余资金校验仍由生产环境校验执行）。
    expect(validateProductionRuntimeCapabilities({
      APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true',
    })).toMatchObject({ PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true' })

    // 任何 stub 占位都必须拒绝以真实资金开机。
    let message = ''
    try {
      validateProductionRuntimeCapabilities(
        { APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true' },
        { kyc: 'live', sanctions: 'disabled', custody: 'stub' },
      )
    } catch (error) {
      message = String(error)
    }
    expect(message).toContain('custody')
    expect(message).not.toContain('sanctions')
  })
})
