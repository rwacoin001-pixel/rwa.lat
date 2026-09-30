import { ApiClientError, createAdminApiClient } from '../../../packages/api-client/src/client'
import { apiClient, getAuthToken, setAuthToken } from '../../../lib/api-client'
import { apiUrl, isKycEligibilityError, parseApiError, request, shouldExpireSessionOn401, SESSION_CHANGED, SESSION_EXPIRED } from '../../../lib/api/_http'
import { statusBadge, type Tone } from '../../../lib/api/_status'

describe('frontend HTTP contract', () => {
  it('parses the Core API error envelope and preserves details and request ID', () => {
    const error = ApiClientError.fromAxiosError(axiosError({
      error: {
        code: 'ORDER_NOT_ELIGIBLE',
        message: 'The current user is not eligible for this product.',
        details: { decision: 'browse_only', reasonCodes: ['kyc_not_approved'] },
      },
      requestId: 'request-123',
    }))

    expect(error).toMatchObject({
      code: 'ORDER_NOT_ELIGIBLE',
      message: 'The current user is not eligible for this product.',
      status: 403,
      details: { decision: 'browse_only', reasonCodes: ['kyc_not_approved'] },
      requestId: 'request-123',
    })
  })

  it('continues to accept flat API error bodies', () => {
    const error = ApiClientError.fromAxiosError(axiosError({ code: 'LEGACY_FAILURE', message: 'Legacy message' }))
    expect(error).toMatchObject({ code: 'LEGACY_FAILURE', message: 'Legacy message', status: 403 })
  })

  it('keeps structured eligibility details and only classifies an explicit KYC block as KYC-required', () => {
    const parsed = parseApiError(403, {
      error: {
        code: 'ORDER_NOT_ELIGIBLE',
        message: 'Not eligible',
        details: { decision: 'browse_only', reasonCodes: ['kyc_not_approved'] },
      },
      requestId: 'request-456',
    }, new Headers())

    expect(parsed.details).toEqual({ decision: 'browse_only', reasonCodes: ['kyc_not_approved'] })
    expect(parsed.requestId).toBe('request-456')
    expect(isKycEligibilityError(parsed)).toBe(true)
    expect(isKycEligibilityError({ ...parsed, code: 'INVESTMENT_NOT_ELIGIBLE' })).toBe(true)
    expect(isKycEligibilityError({
      ...parsed,
      details: { decision: 'manual_review', reasonCodes: ['sanctions_review'] },
    })).toBe(false)
  })

  it('expires sessions only for authenticated non-public requests', () => {
    expect(shouldExpireSessionOn401('/v1/auth/verify-email', true)).toBe(false)
    expect(shouldExpireSessionOn401('/v1/auth/session', true)).toBe(true)
    expect(shouldExpireSessionOn401('/v1/auth/logout', true)).toBe(true)
    expect(shouldExpireSessionOn401('/v1/wallet', true)).toBe(true)
    expect(shouldExpireSessionOn401('/v1/wallet', false)).toBe(false)
  })

  it('uses a configured API origin and falls back to same-origin paths', () => {
    const previousUrl = process.env.NEXT_PUBLIC_API_URL
    const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL
    try {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test///'
      delete process.env.NEXT_PUBLIC_API_BASE_URL
      expect(apiUrl('/v1/wallet')).toBe('https://api.example.test/v1/wallet')

      delete process.env.NEXT_PUBLIC_API_URL
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://core.example.test/'
      expect(apiUrl('/v1/wallet')).toBe('https://core.example.test/v1/wallet')

      delete process.env.NEXT_PUBLIC_API_BASE_URL
      expect(apiUrl('/v1/wallet')).toBe('/v1/wallet')
    } finally {
      if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL
      else process.env.NEXT_PUBLIC_API_URL = previousUrl
      if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL
      else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase
    }
  })

  it('maps all seven backend KYC states to a badge', () => {
    const cases: Array<[string, Tone, string]> = [
      ['not_started', 'neutral', '未开始'],
      ['in_progress', 'processing', '进行中'],
      ['submitted', 'pending', '已提交'],
      ['needs_information', 'pending', '需补充资料'],
      ['approved', 'success', '已批准'],
      ['rejected', 'failed', '已拒绝'],
      ['expired', 'failed', '已过期'],
    ]

    for (const [state, tone, label] of cases) {
      expect(statusBadge('kyc', state)).toEqual({ tone, label })
    }
  })

  it('uses the canonical H5 session for Axios and clears it on 401', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    const dispatchEvent = jest.fn()
    const assign = jest.fn()
    const fakeWindow = {
      dispatchEvent,
      location: { pathname: '/account', search: '?tab=security', assign },
    }
    Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow })
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })

    const oldAdapter = apiClient.axios.defaults.adapter
    try {
      values.set('rwa-session-id', 'stale-session-id')
      setAuthToken('canonical-token')
      expect(getAuthToken()).toBe('canonical-token')
      expect(values.has('rwa-session-id')).toBe(false)
      expect(dispatchEvent.mock.calls.map(([event]) => event.type)).toEqual([SESSION_CHANGED])
      dispatchEvent.mockClear()

      apiClient.axios.defaults.adapter = async (config) => {
        throw axiosError({ error: { code: 'EMAIL_TOKEN_EXPIRED', message: 'Email token expired.' } }, config, 401)
      }
      await expect(apiClient.axios.post('/v1/auth/verify-email', { token: 'expired-link-token' })).rejects.toMatchObject({
        name: 'ApiClientError',
        code: 'EMAIL_TOKEN_EXPIRED',
      })
      expect(values.has('rwa.session')).toBe(true)
      expect(assign).not.toHaveBeenCalled()
      expect(dispatchEvent).not.toHaveBeenCalled()

      values.set('rwa-session-id', 'stale-session-id')
      apiClient.axios.defaults.adapter = async (config) => {
        throw axiosError({
          error: { code: 'SESSION_EXPIRED', message: 'Session expired.' },
          requestId: 'request-789',
        }, config, 401)
      }

      await expect(apiClient.axios.get('/v1/private')).rejects.toMatchObject({
        name: 'ApiClientError',
        code: 'SESSION_EXPIRED',
      })
      for (const key of ['rwa.session', 'rwa-session-token', 'rwa-session-id', 'auth_token', 'rwa-session-mode']) {
        expect(values.has(key)).toBe(false)
      }
      expect(dispatchEvent.mock.calls.map(([event]) => event.type)).toEqual([SESSION_CHANGED, SESSION_EXPIRED])
      expect(assign).toHaveBeenCalledWith('/login?returnTo=%2Faccount%3Ftab%3Dsecurity')

      const adminClient = createAdminApiClient()
      adminClient.axios.defaults.adapter = async (config) => {
        throw axiosError({ error: { code: 'SESSION_EXPIRED', message: 'Session expired.' } }, config, 401)
      }
      await expect(adminClient.axios.get('/users')).rejects.toMatchObject({ name: 'ApiClientError' })
      expect(assign).toHaveBeenCalledTimes(1)
      expect(dispatchEvent.mock.calls.map(([event]) => event.type)).toEqual([SESSION_CHANGED, SESSION_EXPIRED])
    } finally {
      apiClient.axios.defaults.adapter = oldAdapter
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
      else Reflect.deleteProperty(globalThis, 'window')
      if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })
})

function axiosError(
  data: unknown,
  config: unknown = {},
  status = 403,
): Parameters<typeof ApiClientError.fromAxiosError>[0] {
  const response = {
    data,
    status,
    statusText: status === 401 ? 'Unauthorized' : 'Forbidden',
    headers: {},
    config,
  }
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    config,
    response,
  }) as Parameters<typeof ApiClientError.fromAxiosError>[0]
}
