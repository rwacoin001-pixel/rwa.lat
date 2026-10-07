import { randomUUID } from 'node:crypto'
import type { EntityManager } from 'typeorm'
import { IsNull } from 'typeorm'
import { IdentityCrypto } from './identity-crypto.service'
import { LoginIdentity } from './login-identity.entity'

/** Only accepts email proof obtained by the server's provider exchange. Never merges accounts. */
export async function persistProviderEmail(manager: EntityManager, crypto: IdentityCrypto, identity: LoginIdentity, email?: string) {
  if (identity.kind === 'google') return persistGoogleEmail(manager, crypto, identity, email)
  if (identity.kind !== 'github' || !email) return
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || /@(?:users\.)?noreply\.github\.com$/i.test(normalized)) return
  const hash = crypto.hashIdentifier(normalized)
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`account-email:${hash.toString('hex')}`])
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`user-email:${identity.userId}`])
  const identities = manager.getRepository(LoginIdentity)
  const existing = await identities.findOne({ where: { userId: identity.userId, kind: 'email' } })
  if (existing) {
    if (existing.state === 'pending' && !existing.revokedAt && existing.identifierHash.equals(hash)) {
      await identities.update({ id: existing.id, state: 'pending', identifierHash: hash, revokedAt: IsNull() }, { state: 'verified', verifiedAt: new Date() })
    }
    return
  }
  const encrypted = crypto.encrypt(normalized)
  await manager.query(`INSERT INTO app.login_identities
    (id,user_id,kind,state,identifier_hash,identifier_ciphertext,encryption_key_version,verified_at)
    SELECT $1,$2,'email','verified',$3,$4,$5,now()
    WHERE NOT EXISTS (SELECT 1 FROM app.login_identities WHERE user_id=$2 AND kind='email')
    ON CONFLICT (kind,identifier_hash) DO NOTHING`,
  [randomUUID(), identity.userId, hash, encrypted.ciphertext, encrypted.keyVersion])
}

/** Only call with an email verified by the server's Google userinfo exchange. */
export async function persistGoogleEmail(manager: EntityManager, crypto: IdentityCrypto, identity: LoginIdentity, email?: string) {
  if (identity.kind !== 'google' || !email) return
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return
  const key = crypto.decrypt(identity.identifierCiphertext, identity.encryptionKeyVersion)
  // Existing rows store google:sub; new rows also retain the provider's email proof.
  const subject = key.startsWith('google:') ? key.slice(7) : JSON.parse(key).subject
  const profile = crypto.encrypt(JSON.stringify({ version: 1, provider: 'google', subject, email: normalized }))
  await manager.getRepository(LoginIdentity).update({ id: identity.id }, {
    identifierCiphertext: profile.ciphertext, encryptionKeyVersion: profile.keyVersion,
  })

  // Serialize email acquisition against registration and first Google linking.
  const hash = crypto.hashIdentifier(normalized)
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`account-email:${hash.toString('hex')}`])
  // Keep already-linked accounts stable and preserve explicit email changes/revocations.
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`user-email:${identity.userId}`])
  const identities = manager.getRepository(LoginIdentity)
  const existing = await identities.findOne({ where: { userId: identity.userId, kind: 'email' } })
  if (existing) {
    if (existing.state === 'pending' && !existing.revokedAt && existing.identifierHash.equals(hash)) {
      await identities.update({ id: existing.id, state: 'pending', identifierHash: hash, revokedAt: IsNull() }, { state: 'verified', verifiedAt: new Date() })
    }
    return
  }
  const encrypted = crypto.encrypt(normalized)
  await manager.query(`INSERT INTO app.login_identities
    (id,user_id,kind,state,identifier_hash,identifier_ciphertext,encryption_key_version,verified_at)
    SELECT $1,$2,'email','verified',$3,$4,$5,now()
    WHERE NOT EXISTS (SELECT 1 FROM app.login_identities WHERE user_id=$2 AND kind='email')
    ON CONFLICT (kind,identifier_hash) DO NOTHING`,
  [randomUUID(), identity.userId, hash, encrypted.ciphertext, encrypted.keyVersion])
}

export function verifiedGoogleEmail(crypto: IdentityCrypto, identity: LoginIdentity | null): string | null {
  if (!identity || identity.kind !== 'google' || identity.state !== 'verified' || identity.revokedAt) return null
  try {
    const profile = JSON.parse(crypto.decrypt(identity.identifierCiphertext, identity.encryptionKeyVersion))
    if (profile.version !== 1 || profile.provider !== 'google' || typeof profile.subject !== 'string'
      || typeof profile.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
      || !crypto.hashIdentifier(`google:${profile.subject}`).equals(identity.identifierHash)) return null
    return profile.email
  } catch { return null }
}
