import { OAuthProviderService } from '../../src/identity/oauth-provider.service'
import { REGISTRATION_CONSENT_REQUIREMENTS, type RegistrationConsentAcceptance } from '../../src/identity/consent-policy'

const acceptedConsents: RegistrationConsentAcceptance[] = REGISTRATION_CONSENT_REQUIREMENTS.map(({ documentType, version }) => ({
  documentType,
  version,
  accepted: true,
}))

function config(provider: 'google' | 'x', overrides: Record<string, string> = {}) {
  const prefix = provider === 'google' ? 'GOOGLE' : 'X'
  const values: Record<string, string> = {
    [`${prefix}_OAUTH_ENABLED`]: 'true',
    [`${prefix}_OAUTH_CLIENT_ID`]: `${provider}-client-id`,
    [`${prefix}_OAUTH_CLIENT_SECRET`]: `${provider}-client-secret`,
    [`${prefix}_OAUTH_REDIRECT_URI`]: `https://app.rwa.lat/auth/callback/${provider}`,
    ...(provider === 'x' ? { X_OAUTH1_CONSUMER_KEY: 'x-consumer-key', X_OAUTH1_CONSUMER_SECRET: 'x-consumer-secret' } : {}),
    OAUTH_HTTP_TIMEOUT_MS: '5000',
    ...overrides,
  }
  return { get: (key: string) => values[key] }
}

function crypto() {
  return {
    encrypt: jest.fn(() => ({ ciphertext: Buffer.from('encrypted-verifier'), keyVersion: 2 })),
    decrypt: jest.fn(() => 'pkce-verifier'),
    hashToken: jest.fn((value: string) => Buffer.from(`hash:${value}`)),
  }
}

function runner(flow: Record<string, unknown>) {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query: jest.fn(async (sql: string) => sql.includes('SELECT code_verifier_ciphertext') ? [flow] : []),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  }
}

describe('OAuthProviderService', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('persists a hashed state and returns a Google authorization-code URL bound to S256 PKCE', async () => {
    const dataSource = { query: jest.fn() }
    const service = new OAuthProviderService(dataSource as never, crypto() as never, config('google') as never)

    const result = await service.begin('google')
    const url = new URL(result.authorizationUrl)

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.rwa.lat/auth/callback/google')
    expect(result.intent).toBe('login')
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('oauth_authorization_flows'),
      expect.arrayContaining(['google', expect.any(Buffer), expect.any(Buffer), 2]),
    )
  })

  it('stores the registration intent, current consent versions and acceptance time with OAuth state', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) }
    const service = new OAuthProviderService(dataSource as never, crypto() as never, config('x') as never)
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => 'oauth_token=request-token-1234567890&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
    }) as never

    const result = await service.begin('x', 'register', acceptedConsents)
    const parameters = dataSource.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.oauth_authorization_flows'))![1] as unknown[]

    expect(result.intent).toBe('register')
    expect(parameters.slice(6, 9)).toEqual(['register', '2026-09-18', '2026-09-18'])
    expect(parameters[9]).toBeInstanceOf(Date)
  })

  it('starts X OAuth 1.0a with a server-side request token and no paid user lookup scopes', async () => {
    const dataSource = { query: jest.fn() }
    const service = new OAuthProviderService(dataSource as never, crypto() as never, config('x') as never)
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => 'oauth_token=request-token-1234567890&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
    }) as never
    const result = await service.begin('x')
    const authorization = new URL(result.authorizationUrl)
    expect(authorization.origin + authorization.pathname).toBe('https://api.x.com/oauth/authenticate')
    expect(authorization.searchParams.get('oauth_token')).toBe('request-token-1234567890')
    expect(authorization.searchParams.has('scope')).toBe(false)
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('oauth1_request_token_secret_ciphertext'), expect.any(Array))
  })

  it('supports public X clients without a client secret and ignores unverified id_token claims', async () => {
    const tx = runner({ code_verifier_ciphertext: Buffer.from('encrypted'), encryption_key_version: 2,
      redirect_uri: 'https://app.rwa.lat/auth/callback/x', intent: 'login',
      expires_at: new Date(Date.now() + 60_000), consumed_at: null })
    const service = new OAuthProviderService({ createQueryRunner: () => tx } as never, crypto() as never,
      config('x', { X_OAUTH_CLIENT_TYPE: 'public', X_OAUTH_CLIENT_SECRET: '' }) as never)
    const unverifiedToken = `e30.${Buffer.from(JSON.stringify({ sub: 'wrong-user' })).toString('base64url')}.fake`
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token', id_token: unverifiedToken }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'verified-user' } }) }) as never
    await expect(service.exchange('x', 'code', 's'.repeat(43))).resolves.toMatchObject({ subject: 'verified-user' })
    const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect((init.body as URLSearchParams).get('client_id')).toBe('x-client-id')
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
    expect((init.body as URLSearchParams).has('client_secret')).toBe(false)
  })

  it('gets the stable X identity from the OAuth 1.0a exchange without a paid profile request', async () => {
    const tx = runner({ code_verifier_ciphertext: null,
      oauth1_request_token_secret_ciphertext: Buffer.from('encrypted-request-secret'), encryption_key_version: 2,
      redirect_uri: 'https://app.rwa.lat/auth/callback/x', intent: 'login',
      expires_at: new Date(Date.now() + 60_000), consumed_at: null })
    const service = new OAuthProviderService({ createQueryRunner: () => tx } as never, crypto() as never, config('x') as never)
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => 'oauth_token=access-token&oauth_token_secret=access-secret&user_id=123456789&screen_name=x_user',
    }) as never

    await expect(service.exchange('x', 'verified-code', 'request-token-1234567890')).resolves.toMatchObject({
      subject: '123456789', displayName: 'x_user', intent: 'login',
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('https://api.x.com/oauth/access_token', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ authorization: expect.stringMatching(/^OAuth /) }),
    }))
    expect(tx.commitTransaction).toHaveBeenCalled()
  })

  it('rejects an OAuth 1.0a response with no stable user ID instead of trusting the screen name', async () => {
    const tx = runner({ code_verifier_ciphertext: null,
      oauth1_request_token_secret_ciphertext: Buffer.from('encrypted-request-secret'), encryption_key_version: 2,
      redirect_uri: 'https://app.rwa.lat/auth/callback/x', intent: 'login',
      expires_at: new Date(Date.now() + 60_000), consumed_at: null })
    const service = new OAuthProviderService({ createQueryRunner: () => tx } as never, crypto() as never, config('x') as never)
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => 'oauth_token=access-token&oauth_token_secret=access-secret&screen_name=x_user',
    }) as never
    await expect(service.exchange('x', 'verified-code', 'request-token-1234567890')).rejects.toMatchObject({ status: 401 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [403, { title: 'Forbidden' }, 'OAUTH_PROVIDER_ACCESS_DENIED', 503],
    [403, { title: 'CreditsDepleted' }, 'OAUTH_PROVIDER_BILLING_REQUIRED', 503],
    [402, {}, 'OAUTH_PROVIDER_BILLING_REQUIRED', 503],
    [429, {}, 'OAUTH_PROVIDER_RATE_LIMITED', 429],
    [500, {}, 'OAUTH_PROVIDER_UNAVAILABLE', 503],
    [401, {}, 'OAUTH_PROVIDER_UNAVAILABLE', 503],
  ])('classifies profile failure %s / %j without blaming the browser', async (status, body, code, expectedStatus) => {
    const tx = runner({ code_verifier_ciphertext: Buffer.from('encrypted'), encryption_key_version: 2,
      redirect_uri: 'https://app.rwa.lat/auth/callback/x', intent: 'login',
      expires_at: new Date(Date.now() + 60_000), consumed_at: null })
    const service = new OAuthProviderService({ createQueryRunner: () => tx } as never, crypto() as never, config('x') as never)
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access-token' }) })
      .mockResolvedValueOnce({ ok: false, status, json: async () => body }) as never
    await expect(service.exchange('x', 'code', 's'.repeat(43))).rejects.toMatchObject({ status: expectedStatus, response: { code } })
  })

  it('consumes the state once, exchanges the Google code, and trusts only provider userinfo', async () => {
    const flow = {
      code_verifier_ciphertext: Buffer.from('encrypted'), encryption_key_version: 2,
      redirect_uri: 'https://app.rwa.lat/auth/callback/google',
      intent: 'register' as const,
      terms_version: '2026-09-18',
      privacy_version: '2026-09-18',
      consented_at: new Date('2026-09-20T12:00:00.000Z'),
      expires_at: new Date(Date.now() + 60_000), consumed_at: null,
    }
    const tx = runner(flow)
    const dataSource = { createQueryRunner: () => tx }
    const service = new OAuthProviderService(dataSource as never, crypto() as never, config('google') as never)
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'google-access-token' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sub: 'google-subject', name: 'Verified User', locale: 'en' }) }) as never

    await expect(service.exchange(
      'google', 'authorization-code', 's'.repeat(43), 'https://app.rwa.lat/auth/callback/google',
    )).resolves.toEqual({
      subject: 'google-subject',
      displayName: 'Verified User',
      locale: 'en',
      intent: 'register',
      registrationConsents: acceptedConsents,
      consentedAt: new Date('2026-09-20T12:00:00.000Z'),
    })

    expect(tx.commitTransaction).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenNthCalledWith(
      1, 'https://oauth2.googleapis.com/token', expect.objectContaining({ method: 'POST' }),
    )
    expect(global.fetch).toHaveBeenNthCalledWith(
      2, 'https://openidconnect.googleapis.com/v1/userinfo', expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer google-access-token' }),
      }),
    )
  })

  it('uses confidential-client Basic authentication and /2/users/me for X', async () => {
    const flow = {
      code_verifier_ciphertext: Buffer.from('encrypted'), encryption_key_version: 2,
      redirect_uri: 'https://app.rwa.lat/auth/callback/x',
      intent: 'login' as const,
      terms_version: null,
      privacy_version: null,
      consented_at: null,
      expires_at: new Date(Date.now() + 60_000), consumed_at: null,
    }
    const tx = runner(flow)
    const dataSource = { createQueryRunner: () => tx }
    const service = new OAuthProviderService(dataSource as never, crypto() as never, config('x') as never)
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'x-access-token' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 'x-subject', name: 'X User' } }) }) as never

    await expect(service.exchange('x', 'authorization-code', 's'.repeat(43))).resolves.toEqual({
      subject: 'x-subject', displayName: 'X User', intent: 'login',
    })

    expect(global.fetch).toHaveBeenNthCalledWith(
      1, 'https://api.x.com/2/oauth2/token', expect.objectContaining({
        headers: expect.objectContaining({ authorization: expect.stringMatching(/^Basic /) }),
      }),
    )
    expect(global.fetch).toHaveBeenNthCalledWith(
      2, expect.stringContaining('https://api.x.com/2/users/me'), expect.any(Object),
    )
  })

  it('rejects an already consumed state before making any provider request', async () => {
    const tx = runner({
      code_verifier_ciphertext: Buffer.from('encrypted'), encryption_key_version: 2,
      redirect_uri: 'https://app.rwa.lat/auth/callback/google',
      intent: 'login', terms_version: null, privacy_version: null, consented_at: null,
      expires_at: new Date(Date.now() + 60_000), consumed_at: new Date(),
    })
    const service = new OAuthProviderService(
      { createQueryRunner: () => tx } as never, crypto() as never, config('google') as never,
    )
    global.fetch = jest.fn() as never

    await expect(service.exchange('google', 'code', 's'.repeat(43))).rejects.toMatchObject({ status: 401 })
    expect(tx.rollbackTransaction).toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
