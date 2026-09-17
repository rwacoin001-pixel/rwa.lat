import { secp256k1 } from '@noble/curves/secp256k1'
import { tronAddressFromPublicKey, parseTronPrivateKey } from './tron-address.util'

/**
 * TRON transaction signatures are r(32) || s(32) || recovery(1) over the
 * transaction hash (sha256 of the protobuf raw_data, i.e. the txID),
 * with canonical low-s values. Verified against a live mainnet transaction.
 */
export function signTronTransactionHash(transactionHashHex: string, privateKeyHex: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(transactionHashHex)) {
    throw new Error('TRON transaction hash must be a 32-byte hex value')
  }
  const privateKey = parseTronPrivateKey(privateKeyHex)
  const signature = secp256k1.sign(Uint8Array.from(Buffer.from(transactionHashHex, 'hex')), privateKey, { lowS: true })
  return Buffer.concat([
    Buffer.from(signature.toCompactRawBytes()),
    Buffer.from([signature.recovery]),
  ]).toString('hex')
}

/** Test/verification helper: recover the base58 address that produced a signature. */
export function recoverTronAddressFromSignature(transactionHashHex: string, signatureHex: string): string {
  if (!/^[0-9a-fA-F]{130}$/.test(signatureHex)) {
    throw new Error('TRON signatures must be 65 bytes of hex')
  }
  const bytes = Buffer.from(signatureHex, 'hex')
  const recovery = bytes[64]
  if (recovery > 1) throw new Error('TRON signature recovery id is invalid')
  const compact = Uint8Array.from(bytes.subarray(0, 64))
  const signature = secp256k1.Signature.fromCompact(compact).addRecoveryBit(recovery)
  const publicKey = signature.recoverPublicKey(Uint8Array.from(Buffer.from(transactionHashHex, 'hex'))).toRawBytes(false)
  return tronAddressFromPublicKey(publicKey)
}
