import { keccak_256 } from '@noble/hashes/sha3'

/** EOA sign-in format: https://eips.ethereum.org/EIPS/eip-4361 */
export function walletSignInMessage(origin: string, address: string, chainId: number, nonce: string, issuedAt: Date, expiresAt: Date): string {
  const url = new URL(origin)
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Wallet sign-in requires a trusted application origin')
  if (!Number.isSafeInteger(chainId) || chainId <= 0 || !/^0x[0-9a-fA-F]{40}$/.test(address) || !/^[a-zA-Z0-9]{8,}$/.test(nonce)) throw new Error('Invalid wallet challenge fields')
  const lower = address.slice(2).toLowerCase()
  const hash = Buffer.from(keccak_256(Buffer.from(lower))).toString('hex')
  const checksum = '0x' + [...lower].map((c, i) => parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c).join('')
  return `${url.origin} wants you to sign in with your Ethereum account:\n${checksum}\n\nSign in to A-REIT. This does not authorize a transaction.\n\nURI: ${url.origin}/login\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`
}
