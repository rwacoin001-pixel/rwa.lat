import {
  INSTALLED_PRODUCTION_CAPABILITIES,
  validateProductionRuntimeCapabilities,
} from '../../src/config/production-runtime-capabilities'

describe('production runtime capability manifest', () => {
  it('allows locked production but refuses a live-funds claim from the current stub-only image', () => {
    expect(validateProductionRuntimeCapabilities({
      APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false',
    })).toMatchObject({ PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'false' })

    expect(INSTALLED_PRODUCTION_CAPABILITIES).toEqual({ kyc: 'stub', sanctions: 'stub', custody: 'stub' })
    expect(() => validateProductionRuntimeCapabilities({
      APP_ENV: 'production', PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true',
    })).toThrow(/does not contain reviewed live implementations/)
  })
})
