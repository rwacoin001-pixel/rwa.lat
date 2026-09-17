import { createHash } from 'node:crypto'
import { generateTronKeypair, tronAddressFromPrivateKey } from '../../src/wallet/manual/tron-address.util'
import { recoverTronAddressFromSignature, signTronTransactionHash } from '../../src/wallet/manual/tron-signer'

describe('TRON transaction signing', () => {
  it('signs the transaction hash and recovers the signing address', () => {
    const keypair = generateTronKeypair()
    const txId = createHash('sha256').update('unit-test-raw-data').digest('hex')
    const signature = signTronTransactionHash(txId, keypair.privateKeyHex)
    expect(signature).toMatch(/^[0-9a-f]{130}$/)
    const recovery = parseInt(signature.slice(128, 130), 16)
    expect([0, 1]).toContain(recovery)
    expect(recoverTronAddressFromSignature(txId, signature)).toBe(tronAddressFromPrivateKey(keypair.privateKeyHex))
  })

  it('uses canonical low-s signatures', () => {
    const keypair = generateTronKeypair()
    const txId = createHash('sha256').update('low-s-check').digest('hex')
    const signature = signTronTransactionHash(txId, keypair.privateKeyHex)
    const s = BigInt(`0x${signature.slice(64, 128)}`)
    // secp256k1 half-order; canonical signatures never exceed n/2 (TRON requirement).
    const halfOrder = BigInt('0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0')
    expect(s <= halfOrder).toBe(true)
  })

  it('rejects malformed inputs', () => {
    const keypair = generateTronKeypair()
    expect(() => signTronTransactionHash('zz', keypair.privateKeyHex)).toThrow(/32-byte hex/)
    expect(() => signTronTransactionHash('ab'.repeat(32), 'nope')).toThrow()
    expect(() => recoverTronAddressFromSignature('ab'.repeat(32), 'ab')).toThrow(/65 bytes/)
  })
})
