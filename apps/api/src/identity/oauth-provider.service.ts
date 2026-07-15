import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { IdentityCrypto } from './identity-crypto.service'

export type OAuthProviderName = 'google' | 'x'

interface OAuthFlowRow {
  code_verifier_ciphertext: Buffer
  encryption_key_version: number
  redirect_uri: string
  expires_at: Date
  consumed_at: Date | null
}

@Injectable()
export class OAuthProviderService {
  private readonly timeoutMs: number

  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: IdentityCrypto,
    private readonly config: ConfigService,
  ) {
    this.timeoutMs = boundedInteger(config.get<string>('OAUTH_HTTP_TIMEOUT_MS'), 10_000, 1_000, 30_000)
  }

  async begin(provider: OAuthProviderName) {
    const providerConfig = this.providerConfig(provider)
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(48).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const encrypted = this.crypto.encrypt(verifier)
    const expiresAt = new Date(Date.now() + 10 * 60_000)
    await this.dataSource.query(
      `INSERT INTO app.oauth_authorization_flows
        (id, provider, state_hash, code_verifier_ciphertext, encryption_key_version, redirect_uri, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(), provider, this.crypto.hashToken(state), encrypted.ciphertext,
        encrypted.keyVersion, providerConfig.redirectUri, expiresAt,
      ],
    )

    const authorization = new URL(providerConfig.authorizationEndpoint)
    authorization.searchParams.set('response_type', 'code')
    authorization.searchParams.set('client_id', providerConfig.clientId)
    authorization.searchParams.set('redirect_uri', providerConfig.redirectUri)
    authorization.searchParams.set('scope', provider === 'google' ? 'openid email profile' : 'users.read')
    authorization.searchParams.set('state', state)
    authorization.searchParams.set('code_challenge', challenge)
    authorization.searchParams.set('code_challenge_method', 'S256')
    if (provider === 'google') authorization.searchParams.set('prompt', 'select_account')

    return { provider, authorizationUrl: authorization.toString(), expiresAt }
  }

  async exchange(provider: OAuthProviderName, code: string, state: string, suppliedRedirectUri?: string) {
    const providerConfig = this.providerConfig(provider)
    const flow = await this.consumeFlow(provider, state, suppliedRedirectUri)
    const verifier = this.crypto.decrypt(flow.code_verifier_ciphertext, flow.encryption_key_version)
    const token = await this.exchangeToken(provider, providerConfig, code, verifier)
    if (provider === 'google') {
      const profile = await this.getJson('https://openidconnect.googleapis.com/v1/userinfo', token)
      const subject = readSubject(profile, 'sub')
      return {
        subject,
        displayName: readOptionalString(profile, 'name'),
        locale: readOptionalString(profile, 'locale'),
      }
    }
    const profile = await this.getJson('https://api.x.com/2/users/me?user.fields=id,name,username', token)
    const data = profile.data
    if (!data || typeof data !== 'object') throw invalidOAuth('X profile response did not contain a user')
    return {
      subject: readSubject(data as Record<string, unknown>, 'id'),
      displayName: readOptionalString(data as Record<string, unknown>, 'name'),
    }
  }

  private async consumeFlow(provider: OAuthProviderName, state: string, suppliedRedirectUri?: string): Promise<OAuthFlowRow> {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(state)) throw invalidOAuth('OAuth state is invalid or expired')
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const rows = await runner.query(
        `SELECT code_verifier_ciphertext, encryption_key_version, redirect_uri, expires_at, consumed_at
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
  ): Promise<string> {
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
    } else {
      headers.authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
    }
    const response = await this.fetchProvider(config.tokenEndpoint, {
      method: 'POST', headers, body,
    })
    const payload = await response.json() as Record<string, unknown>
    const accessToken = readOptionalString(payload, 'access_token')
    if (!accessToken) throw invalidOAuth('OAuth token response was invalid')
    return accessToken
  }

  private async getJson(url: string, accessToken: string): Promise<Record<string, unknown>> {
    const response = await this.fetchProvider(url, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    })
    const payload = await response.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalidOAuth('OAuth profile response was invalid')
    return payload as Record<string, unknown>
  }

  private async fetchProvider(url: string, init: RequestInit): Promise<Response> {
    let response: Response
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) })
    } catch {
      throw oauthUnavailable()
    }
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) throw invalidOAuth('OAuth authorization code was rejected')
      throw oauthUnavailable()
    }
    return response
  }

  private providerConfig(provider: OAuthProviderName) {
    const prefix = provider === 'google' ? 'GOOGLE' : 'X'
    if (this.config.get<string>(`${prefix}_OAUTH_ENABLED`) !== 'true') throw oauthUnavailable()
    const clientId = this.config.get<string>(`${prefix}_OAUTH_CLIENT_ID`) ?? ''
    const clientSecret = this.config.get<string>(`${prefix}_OAUTH_CLIENT_SECRET`) ?? ''
    const redirectUri = this.config.get<string>(`${prefix}_OAUTH_REDIRECT_URI`) ?? ''
    if (!clientId || !clientSecret || !redirectUri) throw oauthUnavailable()
    return {
      clientId,
      clientSecret,
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
