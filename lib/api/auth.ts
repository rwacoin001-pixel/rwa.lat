import { clearSession, readSession, request, saveSession, type ApiResult } from './_http'
import { consumeOAuthState, rememberOAuthState } from './oauth-state'
import { authDevice } from './auth-flow'
import type { ApiSchemas } from './types'
import type { WalletProvider } from './wallet-connection'

export type AuthSession = { token: string; sessionId?: string; userId?: string }
export type AuthConsent = ApiSchemas['ConsentAcceptanceDto'] & { accepted: true }
export type AuthConsentRequirements = { required: Array<{ documentType: 'terms' | 'privacy'; version: string; href: string }> }
type AuthResponse = { token?: unknown; sessionToken?: unknown; accessToken?: unknown; sessionId?: unknown; userId?: unknown }

export function mapLogin(dto: AuthResponse): ApiResult<AuthSession> {
  const token = [dto.sessionToken, dto.token, dto.accessToken].find(value => typeof value === 'string')
  if (typeof token !== 'string') return { ok: false, error: { status: 200, code: 'AUTH_TOKEN_MISSING', message: '登录响应缺少会话凭证' } }
  return { ok: true, data: { token, sessionId: typeof dto.sessionId === 'string' ? dto.sessionId : undefined, userId: typeof dto.userId === 'string' ? dto.userId : undefined } }
}

export const getAuthConsentRequirements = () => request<AuthConsentRequirements>('/v1/auth/consent-requirements')

export const registerEmail = (email: string, locale: string, consents: AuthConsent[]) =>
  request<{ accepted: true }>('/v1/auth/register/email', { method: 'POST', body: JSON.stringify({ email, locale, consents } satisfies ApiSchemas['RegisterEmailRequestDto']) })

export const loginEmail = (email: string) =>
  request<{ accepted?: boolean }>('/v1/auth/login/email', { method: 'POST', body: JSON.stringify({ email }) })

export async function loginPassword(email: string, password: string): Promise<ApiResult<AuthSession>> {
  const result = await request<AuthResponse>('/v1/auth/login/password', { method: 'POST', body: JSON.stringify({ email, password, device: authDevice() }) })
  if (!result.ok) return result
  const mapped = mapLogin(result.data)
  if (mapped.ok) saveSession(mapped.data.token, { sessionId: mapped.data.sessionId, userId: mapped.data.userId })
  return mapped
}

// Email-first sign-in: the form asks which path an address takes before sending anything.
export type EmailLookup = ApiSchemas['EmailLookupResultDto']
export const lookupEmail = (email: string) =>
  request<EmailLookup>('/v1/auth/email/lookup', { method: 'POST', body: JSON.stringify({ email } satisfies ApiSchemas['EmailLookupDto']) })

export type EmailCodeChallenge = { accepted: true; challengeId: string; expiresIn: number; retryAfter: number }
export const requestEmailCode = (email: string, intent: 'login' | 'register', locale: string, consents: AuthConsent[] = []) =>
  request<EmailCodeChallenge>('/v1/auth/email-code/request', { method: 'POST', body: JSON.stringify({ email, intent, locale, ...(intent === 'register' ? { consents } : {}) } satisfies ApiSchemas['RequestEmailCodeDto']) })

export async function confirmEmailCode(email: string, intent: 'login' | 'register', challengeId: string, code: string): Promise<ApiResult<AuthSession>> {
  const response = await request<AuthResponse>('/v1/auth/email-code/confirm', { method: 'POST', body: JSON.stringify({ email, intent, challengeId, code, device: authDevice() } satisfies ApiSchemas['ConfirmEmailCodeDto']) })
  if (!response.ok) return response
  const mapped = mapLogin(response.data)
  if (mapped.ok) saveSession(mapped.data.token, { sessionId: mapped.data.sessionId, userId: mapped.data.userId })
  return mapped
}

export async function startOAuth(provider: 'google' | 'github' | 'x', intent: 'login' | 'register', consents: AuthConsent[] = []): Promise<ApiResult<string>> {
  const result = await request<{ authorizationUrl?: string; intent?: string }>(`/v1/auth/oauth/${provider}/start`, { method: 'POST', body: JSON.stringify({ intent, ...(intent === 'register' ? { consents } : {}) }) })
  if (!result.ok) return result
  if (result.data.intent !== intent) return { ok: false, error: { status: 200, code: 'AUTH_FLOW_VERSION_MISMATCH', message: '认证服务尚未支持此注册流程，请稍后重试' } }
  if (typeof result.data.authorizationUrl !== 'string' || !/^https:\/\//.test(result.data.authorizationUrl)) {
    return { ok: false, error: { status: 200, code: 'AUTH_URL_MISSING', message: '授权地址不可用' } }
  }
  try { rememberOAuthState(localStorage, provider, result.data.authorizationUrl) }
  catch { return { ok: false, error: { status: 0, code: 'OAUTH_STATE_UNAVAILABLE', message: '请允许此页面使用会话存储后重新发起登录' } } }
  return { ok: true, data: result.data.authorizationUrl }
}

export async function confirmLoginEmail(token: string): Promise<ApiResult<AuthSession>> {
  const response = await request<AuthResponse>('/v1/auth/login/email/confirm', { method: 'POST', body: JSON.stringify({ token, device: authDevice() }) })
  if (!response.ok) return response
  const mapped = mapLogin(response.data)
  if (mapped.ok) saveSession(mapped.data.token, { sessionId: mapped.data.sessionId, userId: mapped.data.userId })
  return mapped
}

export async function confirmOAuth(provider: 'google' | 'github' | 'x', code: string, state: string): Promise<ApiResult<AuthSession>> {
  // Best-effort cross-context guard only: an installed PWA and the browser that returns from the
  // provider can hold different storage, so a missing entry must NOT block the exchange — the API
  // validates the state itself (single use, 10-minute TTL, redirect-URI binding).
  consumeOAuthState(localStorage, provider, state)
  const response = await request<AuthResponse>(`/v1/auth/oauth/${provider}`, { method: 'POST', body: JSON.stringify({ code, state, device: authDevice() }) })
  if (!response.ok) return response
  const mapped = mapLogin(response.data)
  if (mapped.ok) saveSession(mapped.data.token, { sessionId: mapped.data.sessionId, userId: mapped.data.userId })
  return mapped
}

export type WalletLoginChallenge = { address: string; nonce: string; registrationRequired: boolean }
// Retain the selected mobile/extension provider through the registration consent step.
const walletChallengeProviders = new WeakMap<WalletLoginChallenge, WalletProvider>()

// AppKit's UniversalProvider returns a number; injected EIP-1193 wallets return hex.
function walletChainId(value: unknown): number | undefined {
  const chainId = typeof value === 'number' ? value
    : typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(chainId) && chainId > 0 ? chainId : undefined
}

function walletOperationFailure(failure: unknown, fallbackCode: string) {
  const rawCode = typeof failure === 'object' && failure !== null && 'code' in failure ? failure.code : undefined
  const numericCode = typeof rawCode === 'number' ? rawCode
    : typeof rawCode === 'string' && /^-?\d+$/.test(rawCode) ? Number(rawCode) : NaN
  const providerCode = Number.isSafeInteger(numericCode) ? numericCode : undefined
  // Only explicit EIP-1193 / WalletConnect user rejection is a cancellation.
  const code = providerCode === 4001 || providerCode === 5000 ? 'WALLET_CANCELLED' : fallbackCode
  return { ok: false as const, error: { status: 0, code, message: 'Wallet sign-in failed',
    ...(providerCode !== undefined ? { details: { providerCode } } : {}) } }
}

function validWalletMessage(challenge: WalletLoginChallenge, address: string, chainId: number): boolean {
  const lines = challenge.nonce.split('\n')
  const field = (name: string) => lines.find(line => line.startsWith(name + ': '))?.slice(name.length + 2)
  const issued = Date.parse(field('Issued At') ?? '')
  const expiry = Date.parse(field('Expiration Time') ?? '')
  return lines[0] === `${location.origin} wants you to sign in with your Ethereum account:`
    && lines[1]?.toLowerCase() === address.toLowerCase()
    && challenge.address.toLowerCase() === address.toLowerCase()
    && field('URI') === `${location.origin}/login` && field('Version') === '1'
    && field('Chain ID') === String(chainId) && /^[a-zA-Z0-9]{8,}$/.test(field('Nonce') ?? '')
    && issued <= Date.now() + 30000 && expiry > Date.now() && expiry - issued <= 300000
}

export async function beginWalletLogin(selectedProvider?: WalletProvider): Promise<ApiResult<WalletLoginChallenge>> {
  const provider = selectedProvider ?? (window as Window & { ethereum?: WalletProvider }).ethereum
  if (!provider) return { ok: false, error: { status: 0, code: 'WALLET_MISSING', message: '未检测到兼容的钱包' } }
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' })
    const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : null
    if (!address) return { ok: false, error: { status: 0, code: 'WALLET_MISSING', message: '请先连接钱包' } }
    const chainId = walletChainId(await provider.request({ method: 'eth_chainId' }))
    if (chainId === undefined) return { ok: false, error: { status: 0, code: 'WALLET_CHAIN_INVALID', message: '钱包未返回有效网络，请重新连接' } }
    const result = await request<WalletLoginChallenge>('/v1/auth/wallet/challenge', { method: 'POST', body: JSON.stringify({ address, chainId }) })
    if (!result.ok) return result
    const challenge = result.data
    if (typeof challenge?.address !== 'string' || typeof challenge.nonce !== 'string' || typeof challenge.registrationRequired !== 'boolean') {
      return { ok: false, error: { status: 200, code: 'AUTH_FLOW_VERSION_MISMATCH', message: '认证服务尚未支持钱包注册同意步骤，请稍后重试' } }
    }
    if (!validWalletMessage(challenge, address, chainId)) return { ok: false, error: { status: 0, code: 'WALLET_NONCE_MISMATCH', message: '钱包登录请求无效或已过期，请重新连接' } }
    walletChallengeProviders.set(challenge, provider)
    return result
  } catch (failure) { return walletOperationFailure(failure, 'WALLET_CONNECTION_FAILED') }
}

export type WalletLoginStage = 'checking' | 'signing' | 'verifying'
export async function completeWalletLogin(challenge: WalletLoginChallenge, consents: AuthConsent[] = [], onStage?: (stage: WalletLoginStage) => void): Promise<ApiResult<AuthSession>> {
  const provider = walletChallengeProviders.get(challenge)
  if (!provider) return { ok: false, error: { status: 0, code: 'WALLET_MISSING', message: '未检测到兼容的钱包' } }
  let failureCode = 'WALLET_CONNECTION_FAILED'
  try {
    onStage?.('checking')
    const chainId = walletChainId(await provider.request({ method: 'eth_chainId' }))
    const accounts = await provider.request({ method: 'eth_accounts' })
    const address = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : ''
    if (chainId === undefined || !validWalletMessage(challenge, address, chainId)) {
      return { ok: false, error: { status: 0, code: 'WALLET_NONCE_MISMATCH', message: '钱包账户、网络或登录请求已变化，请重新连接' } }
    }
    const encoded = '0x' + Array.from(new TextEncoder().encode(challenge.nonce), byte => byte.toString(16).padStart(2, '0')).join('')
    failureCode = 'WALLET_SIGNATURE_FAILED'
    onStage?.('signing')
    const signature = await provider.request({ method: 'personal_sign', params: [encoded, challenge.address] })
    if (typeof signature !== 'string') return { ok: false, error: { status: 0, code: 'WALLET_SIGNATURE_MISSING', message: '钱包未返回签名' } }
    onStage?.('verifying')
    const verified = await request<AuthResponse>('/v1/auth/wallet/verify', { method: 'POST', loading: 'silent', referralAttribution: challenge.registrationRequired ? 'include' : 'skip', body: JSON.stringify({ address: challenge.address, signature, nonce: challenge.nonce, device: authDevice(), ...(consents.length ? { consents } : {}) }) })
    if (!verified.ok) return verified
    const mapped = mapLogin(verified.data)
    failureCode = 'AUTH_SESSION_STORAGE_FAILED'
    if (mapped.ok) saveSession(mapped.data.token, { sessionId: mapped.data.sessionId, userId: mapped.data.userId })
    return mapped
  } catch (failure) { return walletOperationFailure(failure, failureCode) }
}

const decodeBase64Url = (value: string): ArrayBuffer => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4))
  return Uint8Array.from(binary, char => char.charCodeAt(0)).buffer
}
const encodeBase64Url = (value: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// mediation 'conditional' offers saved passkeys in the email field's autofill; an email scopes the prompt to that account.
export async function loginWithPasskey(options: { mediation?: CredentialMediationRequirement; signal?: AbortSignal; email?: string } = {}): Promise<ApiResult<AuthSession>> {
  if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) return { ok: false, error: { status: 0, code: 'PASSKEY_UNSUPPORTED', message: '当前设备不支持 Passkey' } }
  const challenge = await request<{ challengeId: string; options: { challenge: string; rpId?: string; timeout?: number; userVerification?: UserVerificationRequirement; allowCredentials?: Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }> } }>('/v1/auth/passkey/challenge', { method: 'POST', body: JSON.stringify(options.email ? { email: options.email } : {}), signal: options.signal, loading: 'silent' })
  if (!challenge.ok) return challenge
  if (options.signal?.aborted) return { ok: false, error: { status: 0, code: 'PASSKEY_CANCELLED', message: 'Passkey 验证未完成' } }
  try {
    const challengeOptions = challenge.data.options
    const credential = await navigator.credentials.get({
      publicKey: { ...challengeOptions, challenge: decodeBase64Url(challengeOptions.challenge), allowCredentials: challengeOptions.allowCredentials?.map(item => ({ ...item, id: decodeBase64Url(item.id) })) },
      mediation: options.mediation,
      signal: options.signal,
    }) as PublicKeyCredential | null
    if (!credential) return { ok: false, error: { status: 0, code: 'PASSKEY_CANCELLED', message: 'Passkey 验证未完成' } }
    if (options.signal?.aborted) return { ok: false, error: { status: 0, code: 'PASSKEY_CANCELLED', message: 'Passkey 验证未完成' } }
    const response = credential.response as AuthenticatorAssertionResponse
    const verified = await request<AuthResponse>('/v1/auth/passkey/verify', { method: 'POST', signal: options.signal, body: JSON.stringify({ challengeId: challenge.data.challengeId, response: { id: credential.id, rawId: encodeBase64Url(credential.rawId), type: credential.type, response: { authenticatorData: encodeBase64Url(response.authenticatorData), clientDataJSON: encodeBase64Url(response.clientDataJSON), signature: encodeBase64Url(response.signature), userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : undefined }, clientExtensionResults: credential.getClientExtensionResults() }, device: authDevice() }) })
    if (options.signal?.aborted) return { ok: false, error: { status: 0, code: 'PASSKEY_CANCELLED', message: 'Passkey 验证未完成' } }
    if (!verified.ok) return verified
    const mapped = mapLogin(verified.data)
    if (mapped.ok) saveSession(mapped.data.token, { sessionId: mapped.data.sessionId, userId: mapped.data.userId })
    return mapped
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    return { ok: false, error: { status: 0, code: ['NotAllowedError', 'AbortError'].includes(name) ? 'PASSKEY_CANCELLED' : 'PASSKEY_VERIFICATION_FAILED', message: 'Passkey 验证未完成' } }
  }
}

export async function verifyEmail(token: string): Promise<ApiResult<AuthSession>> {
  const response = await request<AuthResponse>('/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token, device: authDevice() }) })
  if (!response.ok) return response
  const mapped = mapLogin(response.data)
  if (mapped.ok) saveSession(mapped.data.token, { sessionId: mapped.data.sessionId, userId: mapped.data.userId })
  return mapped
}

export const requestRecovery = (email: string) =>
  request<{ accepted?: boolean }>('/v1/auth/recover', { method: 'POST', body: JSON.stringify({ email }) })

export async function confirmRecovery(token: string): Promise<ApiResult<AuthSession>> {
  const response = await request<AuthResponse>('/v1/auth/recover/confirm', { method: 'POST', body: JSON.stringify({ token, device: authDevice() }) })
  if (!response.ok) return response
  const mapped = mapLogin(response.data)
  if (mapped.ok) saveSession(mapped.data.token, { sessionId: mapped.data.sessionId, userId: mapped.data.userId })
  return mapped
}

export async function logout() {
  const session = readSession()
  if (!session?.sessionId) { clearSession(); return { ok: true, data: { revoked: false } } as const }
  const result = await request<{ revoked: boolean }>('/v1/auth/logout', { method: 'POST', body: JSON.stringify({ sessionId: session.sessionId, token: session.sessionToken }) })
  clearSession()
  return result
}
