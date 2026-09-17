import {
  atomicAmountToAbiWord,
  base58CheckDecode,
  base58CheckEncode,
  generateTronKeypair,
  isValidTronAddress,
  tronAddressFromPrivateKey,
  tronAddressToAbiWord,
  tronAddressToHex,
} from '../../src/wallet/manual/tron-address.util'

// Vectors extracted from live TRON mainnet data (2026-09-18):
// - USDT contract address inside transaction 951b31f6c00a9518...
// - its sender address 414b793c13ddb8a198984ebbd8bcc082a716c82e27 -> TGrG...
const USDT_CONTRACT_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const SENDER_HEX = '414b793c13ddb8a198984ebbd8bcc082a716c82e27'
const SENDER = 'TGrGuykvnhBySJ4wFFMj7AmbAFZwbT1dCp'

describe('TRON address utilities', () => {
  it('encodes the exact base58check addresses observed on mainnet', () => {
    expect(base58CheckEncode(Buffer.from(USDT_CONTRACT_HEX, 'hex'))).toBe(USDT_CONTRACT)
    expect(base58CheckEncode(Buffer.from(SENDER_HEX, 'hex'))).toBe(SENDER)
  })

  it('round-trips hex and enforces checksums', () => {
    expect(tronAddressToHex(USDT_CONTRACT)).toBe(USDT_CONTRACT_HEX)
    expect(base58CheckDecode(USDT_CONTRACT).toString('hex')).toBe(USDT_CONTRACT_HEX)
    expect(() => base58CheckDecode('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u')).toThrow(/checksum/i)
  })

  it('builds ABI words exactly as they appear in mainnet raw transactions', () => {
    // From the same live transaction: transfer(address,uint256) with 10 USDT.
    expect(tronAddressToAbiWord(USDT_CONTRACT)).toBe(`0000000000000000000000${USDT_CONTRACT_HEX}`)
    expect(atomicAmountToAbiWord('10000000')).toBe('0000000000000000000000000000000000000000000000000000000000989680')
  })

  it('generates valid keypairs and derives stable addresses', () => {
    const keypair = generateTronKeypair()
    expect(keypair.privateKeyHex).toMatch(/^[0-9a-f]{64}$/)
    expect(isValidTronAddress(keypair.address)).toBe(true)
    expect(keypair.address.startsWith('T')).toBe(true)
    expect(tronAddressFromPrivateKey(keypair.privateKeyHex)).toBe(keypair.address)
  })

  it('rejects malformed addresses, keys and amounts', () => {
    expect(isValidTronAddress('TK5DoRjYhtjjJ25ZEDsq31Gtmd3MRnZKZ')).toBe(false)
    expect(isValidTronAddress('0x1234')).toBe(false)
    expect(() => tronAddressFromPrivateKey('00')).toThrow(/32-byte hex/)
    expect(() => tronAddressFromPrivateKey('0'.repeat(64))).toThrow(/valid secp256k1/)
    expect(() => atomicAmountToAbiWord('0')).toThrow()
    expect(() => atomicAmountToAbiWord('10.5')).toThrow()
  })
})
