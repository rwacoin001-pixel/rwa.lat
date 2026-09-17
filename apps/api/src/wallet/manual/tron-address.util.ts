import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'
import { sha256 } from '@noble/hashes/sha256'

/**
 * Pure TRON address helpers for manual custody.
 *
 * Convention verified against live mainnet data (2026-09-18):
 * - address = Base58Check(0x41 || keccak256(uncompressedPubKey[1:])[12:])
 * - contract ABI 'address' words are the full 21-byte (0x41-prefixed) value
 *   left-padded to 32 bytes, e.g. '0'.repeat(22) + '41...40 hex'.
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_MAP = new Map([...BASE58_ALPHABET].map((char, index) => [char, index]))
const TRON_ADDRESS_PREFIX = 0x41
const TRON_ADDRESS_HEX_LENGTH = 42
const TRON_ADDRESS_BYTE_LENGTH = 21

export interface TronKeypair {
  privateKeyHex: string
  address: string
}

export function generateTronKeypair(): TronKeypair {
  const privateKey = secp256k1.utils.randomPrivateKey()
  const privateKeyHex = Buffer.from(privateKey).toString('hex')
  return { privateKeyHex, address: tronAddressFromPrivateKey(privateKeyHex) }
}

export function parseTronPrivateKey(privateKeyHex: string): Uint8Array {
  if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
    throw new Error('TRON private key must be a 32-byte hex value')
  }
  const key = Uint8Array.from(Buffer.from(privateKeyHex, 'hex'))
  if (!secp256k1.utils.isValidPrivateKey(key)) {
    throw new Error('TRON private key is not a valid secp256k1 scalar')
  }
  return key
}

export function tronAddressFromPrivateKey(privateKeyHex: string): string {
  const publicKey = secp256k1.getPublicKey(parseTronPrivateKey(privateKeyHex), false)
  return tronAddressFromPublicKey(publicKey)
}

export function tronAddressFromPublicKey(uncompressedPublicKey: Uint8Array): string {
  if (uncompressedPublicKey.length !== 65 || uncompressedPublicKey[0] !== 0x04) {
    throw new Error('TRON public keys must be uncompressed 65-byte points')
  }
  const hashed = keccak_256(uncompressedPublicKey.subarray(1))
  const payload = Buffer.concat([Buffer.from([TRON_ADDRESS_PREFIX]), Buffer.from(hashed.subarray(12))])
  return base58CheckEncode(payload)
}

export function isValidTronAddress(value: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) return false
  try {
    const payload = base58CheckDecode(value)
    return payload.length === TRON_ADDRESS_BYTE_LENGTH && payload[0] === TRON_ADDRESS_PREFIX
  } catch {
    return false
  }
}

/** 21-byte hex form (41-prefixed) used inside transaction parameters. */
export function tronAddressToHex(address: string): string {
  const payload = base58CheckDecode(address)
  if (payload.length !== TRON_ADDRESS_BYTE_LENGTH || payload[0] !== TRON_ADDRESS_PREFIX) {
    throw new Error('TRON address payload is invalid')
  }
  return payload.toString('hex')
}

/** 32-byte ABI word for a TRON address (22 zero hex + full 41-prefixed address). */
export function tronAddressToAbiWord(address: string): string {
  return tronAddressToHex(address).padStart(64, '0')
}

/** 32-byte ABI word for an unsigned integer amount. */
export function atomicAmountToAbiWord(atomicAmount: string): string {
  if (!/^[1-9]\d{0,77}$/.test(atomicAmount)) {
    throw new Error('Atomic amount must be a positive integer string')
  }
  const hex = BigInt(atomicAmount).toString(16)
  if (hex.length > 64) throw new Error('Atomic amount does not fit in a 32-byte word')
  return hex.padStart(64, '0')
}

export function base58CheckEncode(payload: Uint8Array): string {
  const checksum = sha256(sha256(payload)).subarray(0, 4)
  return base58Encode(Buffer.concat([Buffer.from(payload), Buffer.from(checksum)]))
}

export function base58CheckDecode(value: string): Buffer {
  const decoded = base58Decode(value)
  if (decoded.length < 5) throw new Error('Base58Check payload is too short')
  const payload = decoded.subarray(0, decoded.length - 4)
  const checksum = decoded.subarray(decoded.length - 4)
  const expected = Buffer.from(sha256(sha256(payload)).subarray(0, 4))
  if (!checksum.equals(expected)) throw new Error('Base58Check checksum mismatch')
  return Buffer.from(payload)
}

function base58Encode(bytes: Buffer): string {
  let value = bytes.length ? BigInt(`0x${bytes.toString('hex')}`) : 0n
  let output = ''
  while (value > 0n) {
    output = BASE58_ALPHABET[Number(value % 58n)] + output
    value /= 58n
  }
  for (const byte of bytes) {
    if (byte !== 0) break
    output = '1' + output
  }
  return output || '1'
}

function base58Decode(value: string): Buffer {
  if (!value) throw new Error('Base58 value is empty')
  let accumulator = 0n
  for (const char of value) {
    const digit = BASE58_MAP.get(char)
    if (digit === undefined) throw new Error('Base58 value contains an invalid character')
    accumulator = accumulator * 58n + BigInt(digit)
  }
  let hex = accumulator.toString(16)
  if (hex.length % 2) hex = `0${hex}`
  let bytes = hex === '00' && accumulator === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex')
  let leadingOnes = 0
  for (const char of value) {
    if (char !== '1') break
    leadingOnes++
  }
  if (leadingOnes) bytes = Buffer.concat([Buffer.alloc(leadingOnes), bytes])
  return bytes
}
