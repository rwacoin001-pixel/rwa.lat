import { UnauthorizedException } from '@nestjs/common'
import type { IdentityCrypto } from '../identity/identity-crypto.service'

/** Shared verification without an IdentityModule/SecurityModule dependency cycle. */
export function assertReauthentication(
  crypto: IdentityCrypto, actor: { userId: string; sessionId: string }, token: string,
): void {
  const fail = () => { throw new UnauthorizedException({ code: 'STEP_UP_REQUIRED', message: 'Confirm your identity before continuing.' }) }
  const payload = crypto.verifyState(token)
  if (!payload) return fail()
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(payload) } catch { return fail() }
  if (!parsed || parsed.audience !== 'rwa-lat-security-step-up' || parsed.userId !== actor.userId ||
    parsed.sessionId !== actor.sessionId || typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now() ||
    !['passkey', 'totp', 'recovery_code'].includes(String(parsed.method))) return fail()
}
