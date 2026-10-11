// Network metadata for the admin console. Wallet network ids mirror apps/api WalletNetwork;
// the extra explorer entries cover the catalog network slugs seeded by the RWA market sync.

export type WalletNetwork = 'tron' | 'ethereum' | 'arbitrum'

export const WALLET_NETWORKS: ReadonlyArray<{ id: WalletNetwork; label: string; assetDecimals: number }> = [
  { id: 'tron', label: 'TRON', assetDecimals: 6 },
  { id: 'ethereum', label: 'Ethereum', assetDecimals: 6 },
  { id: 'arbitrum', label: 'Arbitrum One', assetDecimals: 6 },
]

type Explorer = { base: string; tx: (hash: string) => string; address: (address: string) => string }

const scan = (base: string): Explorer => ({ base, tx: (h) => `${base}/tx/${h}`, address: (a) => `${base}/address/${a}` })

const EXPLORERS: Record<string, Explorer> = {
  tron: { base: 'https://tronscan.org', tx: (h) => `https://tronscan.org/#/transaction/${h}`, address: (a) => `https://tronscan.org/#/address/${a}` },
  ethereum: scan('https://etherscan.io'),
  arbitrum: scan('https://arbiscan.io'),
  'bnb-chain': scan('https://bscscan.com'),
  bsc: scan('https://bscscan.com'),
  polygon: scan('https://polygonscan.com'),
  optimism: scan('https://optimistic.etherscan.io'),
  base: scan('https://basescan.org'),
  avalanche: scan('https://snowtrace.io'),
  solana: { base: 'https://solscan.io', tx: (h) => `https://solscan.io/tx/${h}`, address: (a) => `https://solscan.io/account/${a}` },
  'xrp-ledger': { base: 'https://xrpscan.com', tx: (h) => `https://xrpscan.com/tx/${h}`, address: (a) => `https://xrpscan.com/account/${a}` },
}

const EVM_NETWORKS = new Set(['ethereum', 'arbitrum', 'bnb-chain', 'bsc', 'polygon', 'optimism', 'base', 'avalanche'])

export function networkLabel(network: string): string {
  return WALLET_NETWORKS.find((n) => n.id === network)?.label ?? network
}

export function assetDecimals(network: string): number {
  return WALLET_NETWORKS.find((n) => n.id === network)?.assetDecimals ?? 6
}

export function txExplorerUrl(network: string, hash: string | null | undefined): string | null {
  const explorer = EXPLORERS[network]
  if (!explorer || !hash || !/^(0x)?[0-9A-Za-z]+$/.test(hash)) return null
  return explorer.tx(hash)
}

export function addressExplorerUrl(network: string, address: string | null | undefined): string | null {
  const explorer = EXPLORERS[network]
  if (!explorer || !address || !/^[0-9A-Za-z]+$/.test(address)) return null
  return explorer.address(address)
}

/** Returns an error message for an invalid public address on the given network, or null. */
export function validateAddress(network: string, address: string): string | null {
  const a = address.trim()
  if (!a) return '请填写公开地址'
  if (/\s/.test(a)) return '地址不能包含空格'
  if (network === 'tron') {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a) ? null : 'TRON 地址应以 T 开头、共 34 位 Base58 字符'
  }
  if (EVM_NETWORKS.has(network)) {
    return /^0x[0-9a-fA-F]{40}$/.test(a) ? null : 'EVM 地址应为 0x 开头加 40 位十六进制字符'
  }
  if (network === 'solana') {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) ? null : 'Solana 地址应为 32-44 位 Base58 字符'
  }
  return /^[A-Za-z0-9:._-]{20,128}$/.test(a) ? null : '地址格式不正确（禁止私钥/助记词）'
}
