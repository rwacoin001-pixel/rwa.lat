import { request, type ApiResult } from '@/lib/api/_http'

type PasskeyCreationOptionsJSON = Omit<
  PublicKeyCredentialCreationOptions,
  'challenge' | 'user' | 'excludeCredentials'
> & {
  challenge: string
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string }
  excludeCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>
}

type PasskeyRegistrationStart = {
  challengeId: string
  options: PasskeyCreationOptionsJSON
}

export type PasskeyRegistrationResult = {
  registered: true
  passkeyId: string
  label: string
}

function localError(code: string, message: string): ApiResult<never> {
  return { ok: false, error: { status: 0, code, message } }
}

function decodeBase64Url(value: string): ArrayBuffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error('Invalid WebAuthn value')
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function passkeyCreationError(error: unknown): ApiResult<never> {
  const name = error && typeof error === 'object' && 'name' in error
    ? String((error as { name?: unknown }).name)
    : ''

  if (name === 'NotAllowedError' || name === 'AbortError') {
    return localError('PASSKEY_REGISTRATION_CANCELLED', 'Passkey setup was cancelled.')
  }
  if (name === 'InvalidStateError') {
    return localError('PASSKEY_ALREADY_REGISTERED', 'This passkey is already registered.')
  }
  if (name === 'NotSupportedError') {
    return localError('PASSKEY_UNSUPPORTED', 'Passkeys are not supported by this browser or device.')
  }
  return localError('PASSKEY_REGISTRATION_FAILED', 'Passkey setup could not be completed.')
}

export async function registerPasskey(): Promise<ApiResult<PasskeyRegistrationResult>> {
  if (
    typeof window === 'undefined' ||
    !window.isSecureContext ||
    typeof window.PublicKeyCredential !== 'function' ||
    typeof navigator.credentials?.create !== 'function'
  ) {
    return localError('PASSKEY_UNSUPPORTED', 'Passkeys are not supported by this browser or device.')
  }

  const start = await request<PasskeyRegistrationStart>('/v1/security/passkeys/registration', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!start.ok) return { ok: false, error: start.error }

  let credential: Credential | null
  try {
    const options = start.data.options
    const publicKey: PublicKeyCredentialCreationOptions = {
      ...options,
      challenge: decodeBase64Url(options.challenge),
      user: { ...options.user, id: decodeBase64Url(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map((item) => ({
        ...item,
        id: decodeBase64Url(item.id),
      })),
    }
    credential = await navigator.credentials.create({ publicKey })
  } catch (error) {
    return passkeyCreationError(error)
  }

  if (!credential || credential.type !== 'public-key') {
    return localError('PASSKEY_REGISTRATION_CANCELLED', 'Passkey setup was cancelled.')
  }

  const publicKeyCredential = credential as PublicKeyCredential
  const attestation = publicKeyCredential.response as AuthenticatorAttestationResponse
  const rawId = encodeBase64Url(publicKeyCredential.rawId)
  const response = {
    id: rawId,
    rawId,
    type: publicKeyCredential.type,
    response: {
      clientDataJSON: encodeBase64Url(attestation.clientDataJSON),
      attestationObject: encodeBase64Url(attestation.attestationObject),
      ...(typeof attestation.getTransports === 'function' ? { transports: attestation.getTransports() } : {}),
    },
    clientExtensionResults: publicKeyCredential.getClientExtensionResults(),
    ...(publicKeyCredential.authenticatorAttachment
      ? { authenticatorAttachment: publicKeyCredential.authenticatorAttachment }
      : {}),
  }

  return request<PasskeyRegistrationResult>('/v1/security/passkeys/registration/finish', {
    method: 'POST',
    body: JSON.stringify({ challengeId: start.data.challengeId, response }),
  })
}

export type SecurityFactors = {
  totp: Array<{ id: string; label: string; state: string; activatedAt: string | null; revokedAt: string | null; recoveryCodesRemaining: number }>
  passkeys: Array<{ id: string; label: string; state: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }>
}
export type SecurityEventView = { id: string; action: string; occurredAt: string }
/** A five-minute, session-bound token for sensitive actions. Keep it in memory only. */
export type StepUpResult = { reauthentication: string; expiresInSeconds: number; method: 'totp' | 'recovery_code' | 'passkey' }

export const listSecurityFactors = () => request<SecurityFactors>('/v1/security/factors')
export const listSecurityEvents = () => request<SecurityEventView[]>('/v1/security/events')
export const stepUpWithTotp = (code: string, signal?: AbortSignal) => request<StepUpResult>('/v1/security/step-up/totp', { method: 'POST', body: JSON.stringify({ code }), signal, loading: 'silent' })
export const stepUpWithRecoveryCode = (code: string, signal?: AbortSignal) => request<StepUpResult>('/v1/security/step-up/recovery-code', { method: 'POST', body: JSON.stringify({ code }), signal, loading: 'silent' })

type PasskeyRequestOptionsJSON = Omit<PublicKeyCredentialRequestOptions, 'challenge' | 'allowCredentials'> & {
  challenge: string
  allowCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>
}

export async function stepUpWithPasskey(signal?: AbortSignal): Promise<ApiResult<StepUpResult>> {
  if (
    typeof window === 'undefined' ||
    !window.isSecureContext ||
    typeof window.PublicKeyCredential !== 'function' ||
    typeof navigator.credentials?.get !== 'function'
  ) {
    return localError('PASSKEY_UNSUPPORTED', 'Passkeys are not supported by this browser or device.')
  }
  const start = await request<{ challengeId: string; options: PasskeyRequestOptionsJSON }>('/v1/security/step-up/passkey', { method: 'POST', body: JSON.stringify({}), signal, loading: 'silent' })
  if (!start.ok) return { ok: false, error: start.error }
  if (signal?.aborted) return localError('PASSKEY_CANCELLED', 'Passkey verification was cancelled.')

  let credential: Credential | null
  try {
    const options = start.data.options
    credential = await navigator.credentials.get({
      signal,
      mediation: 'required',
      publicKey: {
        ...options,
        challenge: decodeBase64Url(options.challenge),
        allowCredentials: options.allowCredentials?.map((item) => ({ ...item, id: decodeBase64Url(item.id) })),
      },
    })
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : ''
    return name === 'NotAllowedError' || name === 'AbortError'
      ? localError('PASSKEY_CANCELLED', 'Passkey verification was cancelled.')
      : localError('PASSKEY_VERIFICATION_FAILED', 'Passkey verification could not be completed.')
  }
  if (signal?.aborted || !credential || credential.type !== 'public-key') return localError('PASSKEY_CANCELLED', 'Passkey verification was cancelled.')

  const publicKeyCredential = credential as PublicKeyCredential
  const assertion = publicKeyCredential.response as AuthenticatorAssertionResponse
  const rawId = encodeBase64Url(publicKeyCredential.rawId)
  const response = {
    id: rawId,
    rawId,
    type: publicKeyCredential.type,
    response: {
      clientDataJSON: encodeBase64Url(assertion.clientDataJSON),
      authenticatorData: encodeBase64Url(assertion.authenticatorData),
      signature: encodeBase64Url(assertion.signature),
      ...(assertion.userHandle ? { userHandle: encodeBase64Url(assertion.userHandle) } : {}),
    },
    clientExtensionResults: publicKeyCredential.getClientExtensionResults(),
  }
  return request<StepUpResult>('/v1/security/step-up/passkey/finish', {
    method: 'POST',
    signal,
    loading: 'silent',
    body: JSON.stringify({ challengeId: start.data.challengeId, response }),
  })
}
