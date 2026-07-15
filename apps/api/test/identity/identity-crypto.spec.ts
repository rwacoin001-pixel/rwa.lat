import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'

function makeCrypto(values: Record<string, string> = {}): IdentityCrypto {
  const configured = {
    IDENTITY_HMAC_KEY: 'a'.repeat(64),
    IDENTITY_ENC_KEY: 'b'.repeat(64),
    ...values,
  }
  const cfg: any = {
    get: (k: string) => configured[k as keyof typeof configured],
    getOrThrow: (k: string) => configured[k as keyof typeof configured] ?? (() => {
      throw new Error(`unknown config ${k}`)
    })(),
  }
  return new IdentityCrypto(cfg)
}

function deriveAddress(priv: Uint8Array): string {
  const pub = secp256k1.getPublicKey(priv, false)
  return '0x' + Buffer.from(keccak_256(pub.subarray(1)).subarray(12)).toString('hex')
}

function signMessage(priv: Uint8Array, message: string): string {
  const prefix = `\x19Ethereum Signed Message:\n${Buffer.byteLength(message)}${message}`
  const msgHash = keccak_256(Buffer.from(prefix, 'utf8'))
  const sig = secp256k1.sign(msgHash, priv)
  const rBytes = Buffer.from(sig.r.toString(16).padStart(64, '0'), 'hex')
  const sBytes = Buffer.from(sig.s.toString(16).padStart(64, '0'), 'hex')
  const sigBytes = Buffer.concat([rBytes, sBytes, Buffer.from([sig.recovery! + 27])])
  return '0x' + sigBytes.toString('hex')
}

describe('IdentityCrypto', () => {
  const crypto = makeCrypto()

  it('hashIdentifier is case-insensitive and stable', () => {
    expect(crypto.hashIdentifier('A@B.com').equals(crypto.hashIdentifier('a@b.com'))).toBe(true)
  })

  it('encrypt / decrypt round-trips', () => {
    const { ciphertext, keyVersion } = crypto.encrypt('hello@x.com')
    expect(keyVersion).toBe(1)
    expect(crypto.decrypt(ciphertext)).toBe('hello@x.com')
  })

  it('writes with the active encryption key while retaining old-key decryption', () => {
    const oldCrypto = makeCrypto({ IDENTITY_ENC_KEY: '1'.repeat(64) })
    const old = oldCrypto.encrypt('rotated-secret')
    const rotated = makeCrypto({
      IDENTITY_ENC_KEYS_JSON: JSON.stringify({ 1: '1'.repeat(64), 2: '2'.repeat(64) }),
      IDENTITY_ACTIVE_KEY_VERSION: '2',
    })
    const current = rotated.encrypt('current-secret')

    expect(current.keyVersion).toBe(2)
    expect(rotated.decrypt(old.ciphertext, old.keyVersion)).toBe('rotated-secret')
    expect(rotated.decrypt(current.ciphertext, current.keyVersion)).toBe('current-secret')
  })

  it('signState / verifyState round-trips and rejects tampering', () => {
    const token = crypto.signState('user1:email@x.com')
    expect(crypto.verifyState(token)).toBe('user1:email@x.com')
    expect(crypto.verifyState('not.a.token')).toBeNull()
  })

  it('verifyWalletSignature recovers the claimed address from a real EIP-191 signature', () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const address = deriveAddress(priv)
    const message = crypto.issueWalletChallenge(address)
    const signature = signMessage(priv, message)
    expect(crypto.verifyWalletSignature(address, message, signature)).toBe(true)
    expect(crypto.verifyWalletSignature('0x' + '0'.repeat(40), message, signature)).toBe(false)
  })

  it('verifyWalletSignature rejects malformed signatures', () => {
    expect(crypto.verifyWalletSignature('0x' + '1'.repeat(40), 'x', '0xdead')).toBe(false)
  })
})
