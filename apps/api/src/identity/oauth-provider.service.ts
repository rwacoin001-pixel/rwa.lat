import { HttpException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { IdentityCrypto } from './identity-crypto.service'
import { loadRegistrationConsents, validateRegistrationConsents, type RegistrationConsentAcceptance } from './consent-policy'

export type OAuthProviderName = 'google' | 'x'

export type VerifiedOAuthProfile = {
  subject: string; displayName?: string; locale?: string; verifiedEmail?: string;
  intent: 'login' | 'register'; registrationConsents?: RegistrationConsentAcceptance[]; consentedAt?: Date;
}

interface OAuthFlowRow {
  code_verifier_ciphertext: Buffer | null
  oauth1_request_token_secret_ciphertext: Buffer | null
  encryption_key_version: number
  redirect_uri: string
  expires_at: Date
  consumed_at: Date | null
  intent: 'login' | 'register'
  terms_version: string | null
  privacy_version: string | null
  consented_at: Date | null
}

interface OAuth1XConfig {
  consumerKey: string
  consumerSecret: string
  redirectUri: string
}

@Injectable()
export class OAuthProviderService {
  private readonly timeoutMs: number
  private readonly logger = new Logger(OAuthProviderService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: IdentityCrypto,
    private readonly config: ConfigService,
  ) {
    this.timeoutMs = boundedInteger(config.get<string>('OAUTH_HTTP_TIMEOUT_MS'), 10_000, 1_000, 30_000)
  }

  async begin(provider: OAuthProviderName, intent: 'login' | 'register' = 'login', consentInput?: unknown) {
    const consents = intent === 'register' ? validateRegistrationConsents(consentInput, await loadRegistrationConsents(this.dataSource, this.config)) : undefined
    const termsVersion = consents?.find((consent) => consent.documentType === 'terms')?.version ?? null
    const privacyVersion = consents?.find((consent) => consent.documentType === 'privacy')?.version ?? null
    const consentedAt = intent === 'register' ? new Date() : null

    if (provider === 'x') {
      const config = this.xOAuth1Config()
      const requestToken = await this.requestXOAuth1Token(config)
      const encryptedSecret = this.crypto.encrypt(requestToken.secret)
      const state = requestToken.token
      const expiresAt = new Date(Date.now() + 10 * 60_000)
      await this.dataSource.query(
        `INSERT INTO app.oauth_authorization_flows
          (id, provider, state_hash, code_verifier_ciphertext, oauth1_request_token_secret_ciphertext,
           encryption_key_version, redirect_uri, expires_at, intent, terms_version, privacy_version, consented_at)
         VALUES ($1, 'x', $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          randomUUID(), this.crypto.hashToken(state), encryptedSecret.ciphertext,
          encryptedSecret.keyVersion, config.redirectUri, expiresAt,
          intent, termsVersion, privacyVersion, consentedAt,
        ],
      )
      const authorization = new URL('https://api.x.com/oauth/authenticate')
      authorization.searchParams.set('oauth_token', state)
      return { provider, authorizationUrl: authorization.toString(), expiresAt, intent }
    }

    const providerConfig = this.providerConfig(provider)
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(48).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const encrypted = this.crypto.encrypt(verifier)
    const expiresAt = new Date(Date.now() + 10 * 60_000)
    await this.dataSource.query(
      `INSERT INTO app.oauth_authorization_flows
        (id, provider, state_hash, code_verifier_ciphertext, oauth1_request_token_secret_ciphertext,
         encryption_key_version, redirect_uri, expires_at, intent, terms_version, privacy_version, consented_at)
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $10, $11)`,
      [
        randomUUID(), provider, this.crypto.hashToken(state), encrypted.ciphertext,
        encrypted.keyVersion, providerConfig.redirectUri, expiresAt,
        intent, termsVersion, privacyVersion, consentedAt,
      ],
    )

    const authorization = new URL(providerConfig.authorizationEndpoint)
    authorization.searchParams.set('response_type', 'code')
    authorization.searchParams.set('client_id', providerConfig.clientId)
    authorization.searchParams.set('redirect_uri', providerConfig.redirectUri)
    authorization.searchParams.set('scope', 'openid email profile')
    authorization.searchParams.set('state', state)
    authorization.searchParams.set('code_challenge', challenge)
    authorization.searchParams.set('code_challenge_method', 'S256')
    if (provider === 'google') authorization.searchParams.set('prompt', 'select_account')

    return { provider, authorizationUrl: authorization.toString(), expiresAt, intent }
  }

  async exchange(provider: OAuthProviderName, code: string, state: string, suppliedRedirectUri?: string): Promise<VerifiedOAuthProfile> {
    const flow = await this.consumeFlow(provider, state, suppliedRedirectUri)
    if (provider === 'x' && flow.oauth1_request_token_secret_ciphertext) {
      const config = this.xOAuth1Config()
      const requestTokenSecret = this.crypto.decrypt(flow.oauth1_request_token_secret_ciphertext, flow.encryption_key_version)
      const profile = await this.exchangeXOAuth1Token(config, state, code, requestTokenSecret)
      return {
        subject: readSubject(profile, 'user_id'),
        displayName: readOptionalString(profile, 'screen_name'),
        locale: undefined,
        ...this.registrationSnapshot(flow),
      }
    }

    // Finish short-lived OAuth 2 callbacks created before the X protocol switch.
    const providerConfig = this.providerConfig(provider)
    if (!flow.code_verifier_ciphertext) throw invalidOAuth('OAuth flow secret is invalid or expired')
    const verifier = this.crypto.decrypt(flow.code_verifier_ciphertext, flow.encryption_key_version)
    const credentials = await this.exchangeToken(provider, providerConfig, code, verifier)
    const token = credentials.accessToken
    if (provider === 'google') {
      const profile = await this.getJson('https://openidconnect.googleapis.com/v1/userinfo', token)
      const email = readOptionalString(profile, 'email')?.trim().toLowerCase()
      return {
        subject: readSubject(profile, 'sub'),
        displayName: readOptionalString(profile, 'name'),
        locale: readOptionalString(profile, 'locale'),
        verifiedEmail: profile.email_verified === true && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
        ...this.registrationSnapshot(flow),
      }
    }
    // Legacy OAuth 2 callbacks only; new X sign-ins use the OAuth 1.0a response identity.
    const profile = await this.getJson('https://api.x.com/2/users/me?user.fields=id,name,username', token)
    const data = profile.data
    if (!data || typeof data !== 'object') throw invalidOAuth('X profile response did not contain a user')
    return {
      subject: readSubject(data as Record<string, unknown>, 'id'),
      displayName: readOptionalString(data as Record<string, unknown>, 'name'),
      locale: undefined,
      ...this.registrationSnapshot(flow),
    }
  }

  private registrationSnapshot(flow: OAuthFlowRow): {
    intent: 'login' | 'register'
    registrationConsents?: RegistrationConsentAcceptance[]
    consentedAt?: Date
  } {
    if (flow.intent !== 'register') return { intent: 'login' }
    if (!flow.terms_version || !flow.privacy_version || !flow.consented_at) {
      return { intent: 'register' }
    }
    return {
      intent: 'register',
      registrationConsents: [
        { documentType: 'terms', version: flow.terms_version, accepted: true },
        { documentType: 'privacy', version: flow.privacy_version, accepted: true },
      ],
      consentedAt: new Date(flow.consented_at),
    }
  }

  private async consumeFlow(provider: OAuthProviderName, state: string, suppliedRedirectUri?: string): Promise<OAuthFlowRow> {
    if (!/^[A-Za-z0-9_-]{16,512}$/.test(state)) throw invalidOAuth('OAuth state is invalid or expired')
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const rows = await runner.query(
        `SELECT code_verifier_ciphertext, oauth1_request_token_secret_ciphertext, encryption_key_version,
                redirect_uri, expires_at, consumed_at, intent, terms_version, privacy_version, consented_at
           FROM app.oauth_authorization_flows
          WHERE provider = $1 AND state_hash = $2
          FOR UPDATE`,
        [provider, this.crypto.hashToken(state)],
      ) as OAuthFlowRow[]
      const flow = rows[0]
      const now = new Date()
      if (!flow || flow.consumed_at || new Date(flow.expires_at) <= now) throw invalidOAuth('OAuth state is invalid or expired')
      if (suppliedRedirectUri && suppliedRedirectUri !== flow.redirect_uri) throw invalidOAuth('OAuth redirect URI does not match the initiated flow')
      await runner.query(
        `UPDATE app.oauth_authorization_flows SET consumed_at = $2 WHERE provider = $1 AND state_hash = $3`,
        [provider, now, this.crypto.hashToken(state)],
      )
      await runner.commitTransaction()
      return flow
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  private async exchangeToken(
    provider: OAuthProviderName,
    config: ReturnType<OAuthProviderService['providerConfig']>,
    code: string,
    verifier: string,
  ): Promise<{ accessToken: string }> {
    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    })
    const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' }
    if (provider === 'google') {
      body.set('client_id', config.clientId)
      body.set('client_secret', config.clientSecret)
    } else if (config.clientType === 'public') {
      body.set('client_id', config.clientId)
    } else {
      headers.authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
    }
    const response = await this.fetchProvider(config.tokenEndpoint, {
      method: 'POST', headers, body,
    }, 'oauth2_token')
    const payload = await response.json() as Record<string, unknown>
    const accessToken = readOptionalString(payload, 'access_token')
    if (!accessToken) throw invalidOAuth('OAuth token response was invalid')
    return { accessToken }
  }

  private async getJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
    const response = await this.fetchProvider(url, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    })
    const payload = await response.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalidOAuth('OAuth profile response was invalid')
    return payload as Record<string, unknown>
  }

  private async requestXOAuth1Token(config: OAuth1XConfig): Promise<{ token: string; secret: string }> {
    const endpoint = 'https://api.x.com/oauth/request_token'
    const authorization = oauth1AuthorizationHeader('POST', endpoint, { oauth_callback: config.redirectUri }, {}, config.consumerKey, config.consumerSecret)
    const response = await this.fetchProvider(endpoint, {
      method: 'POST',
      headers: { authorization, accept: 'application/x-www-form-urlencoded, application/json' },
    }, 'oauth1_request_token')
    const payload = await readOAuth1Response(response)
    const token = readOptionalString(payload, 'oauth_token')
    const secret = readOptionalString(payload, 'oauth_token_secret')
    if (!token || !secret || payload.oauth_callback_confirmed !== 'true' || token.length > 512) {
      throw oauthUnavailable()
    }
    return { token, secret }
  }

  private async exchangeXOAuth1Token(
    config: OAuth1XConfig,
    requestToken: string,
    verifier: string,
    requestTokenSecret: string,
  ): Promise<Record<string, unknown>> {
    if (!verifier || verifier.length > 255) throw invalidOAuth('OAuth verifier is invalid')
    const endpoint = 'https://api.x.com/oauth/access_token'
    const oauthParams = { oauth_token: requestToken }
    const requestParams = { oauth_verifier: verifier }
    const authorization = oauth1AuthorizationHeader('POST', endpoint, oauthParams, requestParams, config.consumerKey, config.consumerSecret, requestTokenSecret)
    const response = await this.fetchProvider(endpoint, {
      method: 'POST',
      headers: {
        authorization,
        accept: 'application/x-www-form-urlencoded, application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(requestParams),
    }, 'oauth1_access_token')
    const payload = await readOAuth1Response(response)
    if (!readOptionalString(payload, 'user_id')) throw invalidOAuth('OAuth token response did not contain a user identity')
    return payload
  }

  private xOAuth1Config(): OAuth1XConfig {
    if (this.config.get<string>('X_OAUTH_ENABLED') !== 'true') throw oauthUnavailable()
    const consumerKey = this.config.get<string>('X_OAUTH1_CONSUMER_KEY') ?? ''
    const consumerSecret = this.config.get<string>('X_OAUTH1_CONSUMER_SECRET') ?? ''
    const redirectUri = this.config.get<string>('X_OAUTH_REDIRECT_URI') ?? ''
    if (!consumerKey || !consumerSecret || !redirectUri) throw oauthUnavailable()
    return { consumerKey, consumerSecret, redirectUri }
  }

  private async fetchProvider(
    url: string,
    init: RequestInit,
    stage: 'profile' | 'oauth2_token' | 'oauth1_request_token' | 'oauth1_access_token' = 'profile',
  ): Promise<Response> {
    let response: Response
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) })
    } catch {
      throw new ServiceUnavailableException({ code: 'OAUTH_PROVIDER_UNAVAILABLE', message: 'Sign-in provider is temporarily unavailable.' })
    }
    if (!response.ok) {
      // Classify known upstream errors without logging bodies that can echo credentials.
      let reason = 'unknown'
      try {
        const payload = await response.json() as Record<string, unknown>
        const identifiers = [payload.error, payload.title, payload.type].filter(value => typeof value === 'string').join(' ').toLowerCase()
        if (/creditsdepleted|credits-depleted|usagecapexceeded|usage-capped|paymentrequired|payment-required/.test(identifiers)) reason = 'billing'
        else if (/invalid_client|unauthorized_client/.test(identifiers)) reason = 'client'
        else if (/invalid_scope|insufficient_scope/.test(identifiers)) reason = 'scope'
        else if (/invalid_grant/.test(identifiers)) reason = 'grant'
      } catch { /* A non-JSON error still has a useful HTTP status. */ }
      this.logger.warn(JSON.stringify({ event: 'oauth_provider_failure', host: new URL(url).host,
        stage, status: response.status, reason }))
      if (response.status === 429) throw new HttpException({ code: 'OAUTH_PROVIDER_RATE_LIMITED', message: 'Sign-in provider rate limit reached.' }, 429)
      if (response.status === 402 || reason === 'billing') throw new ServiceUnavailableException({ code: 'OAUTH_PROVIDER_BILLING_REQUIRED', message: 'Sign-in provider billing requires attention.' })
      if (reason === 'client') throw oauthUnavailable()
      if (response.status === 403 || reason === 'scope') throw new ServiceUnavailableException({ code: 'OAUTH_PROVIDER_ACCESS_DENIED', message: 'Sign-in provider denied API access.' })
      if ((stage === 'oauth2_token' || stage === 'oauth1_access_token') && response.status >= 400 && response.status < 500) throw invalidOAuth('OAuth authorization was rejected')
      if (stage === 'oauth1_request_token' && response.status >= 400 && response.status < 500) throw oauthUnavailable()
      throw new ServiceUnavailableException({ code: 'OAUTH_PROVIDER_UNAVAILABLE', message: 'Sign-in provider is temporarily unavailable.' })
    }
    return response
  }

  private providerConfig(provider: OAuthProviderName) {
    const prefix = provider === 'google' ? 'GOOGLE' : 'X'
    if (this.config.get<string>(`${prefix}_OAUTH_ENABLED`) !== 'true') throw oauthUnavailable()
    const clientId = this.config.get<string>(`${prefix}_OAUTH_CLIENT_ID`) ?? ''
    const clientSecret = this.config.get<string>(`${prefix}_OAUTH_CLIENT_SECRET`) ?? ''
    const redirectUri = this.config.get<string>(`${prefix}_OAUTH_REDIRECT_URI`) ?? ''
    const clientType = provider === 'x' ? this.config.get<string>('X_OAUTH_CLIENT_TYPE') ?? 'confidential' : 'confidential'
    if (!['public', 'confidential'].includes(clientType) || !clientId || !redirectUri || (clientType === 'confidential' && !clientSecret)) throw oauthUnavailable()
    return {
      clientId,
      clientSecret,
      clientType,
      redirectUri,
      authorizationEndpoint: provider === 'google'
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://x.com/i/oauth2/authorize',
      tokenEndpoint: provider === 'google'
        ? 'https://oauth2.googleapis.com/token'
        : 'https://api.x.com/2/oauth2/token',
    }
  }
}

function readSubject(input: Record<string, unknown>, key: string): string {
  const value = readOptionalString(input, key)
  if (!value || value.length > 255) throw invalidOAuth('OAuth profile response did not contain a stable subject')
  return value
}

function readOptionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

async function readOAuth1Response(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  try {
    const json = JSON.parse(text) as unknown
    if (json && typeof json === 'object' && !Array.isArray(json)) return json as Record<string, unknown>
  } catch { /* OAuth 1.0a responses are commonly form encoded. */ }
  return Object.fromEntries(new URLSearchParams(text).entries())
}

function oauth1AuthorizationHeader(
  method: string,
  url: string,
  oauthParams: Record<string, string>,
  requestParams: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  tokenSecret = '',
): string {
  const headerParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(18).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...oauthParams,
  }
  const normalizedParams = [...Object.entries(headerParams), ...Object.entries(requestParams)]
    .map(([key, value]) => [oauthEncode(key), oauthEncode(value)] as const)
    .sort(([keyA, valueA], [keyB, valueB]) => keyA < keyB ? -1 : keyA > keyB ? 1 : valueA < valueB ? -1 : valueA > valueB ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  const baseUrl = new URL(url)
  baseUrl.search = ''
  baseUrl.hash = ''
  const signatureBase = [method.toUpperCase(), oauthEncode(baseUrl.toString()), oauthEncode(normalizedParams)].join('&')
  const signingKey = `${oauthEncode(consumerSecret)}&${oauthEncode(tokenSecret)}`
  const signature = createHmac('sha1', signingKey).update(signatureBase).digest('base64')
  const header = { ...headerParams, oauth_signature: signature }
  const authorization = Object.entries(header)
    .sort(([keyA], [keyB]) => oauthEncode(keyA) < oauthEncode(keyB) ? -1 : oauthEncode(keyA) > oauthEncode(keyB) ? 1 : 0)
    .map(([key, value]) => `${oauthEncode(key)}="${oauthEncode(value)}"`)
    .join(', ')
  return `OAuth ${authorization}`
}

function oauthEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
}

function invalidOAuth(message: string) {
  return new UnauthorizedException({ code: 'OAUTH_VERIFICATION_FAILED', message })
}

function oauthUnavailable() {
  return new ServiceUnavailableException({
    code: 'OAUTH_PROVIDER_NOT_CONFIGURED',
    message: 'OAuth sign-in is not available. Please retry later or use another sign-in method.',
  })
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}
