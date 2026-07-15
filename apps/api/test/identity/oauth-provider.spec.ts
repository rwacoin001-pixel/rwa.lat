import { OAuthProviderService } from '../../src/identity/oauth-provider.service'

function config(provider: 'google' | 'x') {
  const prefix = provider === 'google' ? 'GOOGLE' : 'X'
  const values: Record<string, string> = {
    [`${prefix}_OAUTH_ENABLED`]: 'true',
    [`${prefix}_OAUTH_CLIENT_ID`]: `${provider}-client-id`,
    [`${prefix}_OAUTH_CLIENT_SECRET`]: `${provider}-client-secret`,
    [`${prefix}_OAUTH_REDIRECT_URI`]: `https://app.rwa.lat/auth/callback/${provider}`,
    OAUTH_HTTP_TIMEOUT_MS: '5000',
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
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('oauth_authorization_flows'),
      expect.arrayContaining(['google', expect.any(Buffer), expect.any(Buffer), 2]),
    )
  })

  it('consumes the state once, exchanges the Google code, and trusts only provider userinfo', async () => {
    const flow = {
      code_verifier_ciphertext: Buffer.from('encrypted'), encryption_key_version: 2,
      redirect_uri: 'https://app.rwa.lat/auth/callback/google',
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
    )).resolves.toEqual({ subject: 'google-subject', displayName: 'Verified User', locale: 'en' })

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
      expires_at: new Date(Date.now() + 60_000), consumed_at: null,
    }
    const tx = runner(flow)
    const dataSource = { createQueryRunner: () => tx }
    const service = new OAuthProviderService(dataSource as never, crypto() as never, config('x') as never)
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'x-access-token' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 'x-subject', name: 'X User' } }) }) as never

    await expect(service.exchange('x', 'authorization-code', 's'.repeat(43))).resolves.toEqual({
      subject: 'x-subject', displayName: 'X User',
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
