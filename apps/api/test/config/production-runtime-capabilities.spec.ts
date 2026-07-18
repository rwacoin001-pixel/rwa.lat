import {
  INSTALLED_PRODUCTION_CAPABILITIES,
  validateProductionRuntimeCapabilities,
} from '../../src/config/production-runtime-capabilities'

describe('production runtime capability manifest', () => {
  it('allows locked production but refuses live funds until sanctions and custody adapters are installed', () => {
    expect(validateProductionRuntimeCapabilities({
      APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false',
    })).toMatchObject({ PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false' })

    expect(INSTALLED_PRODUCTION_CAPABILITIES).toEqual({ kyc: 'live', sanctions: 'stub', custody: 'stub' })
    expect(() => validateProductionRuntimeCapabilities({
      APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true',
    })).toThrow(/sanctions, custody/)
  })
})
