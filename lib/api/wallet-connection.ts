export type WalletProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

// Public Reown project identifier, not a secret. Restrict origins in its dashboard.
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '2defc1dee243f5dd45ecbe0bbe5b4919'
type WalletModal = Awaited<ReturnType<typeof import('@reown/appkit')['createAppKit']>>
let modalPromise: Promise<WalletModal> | undefined

async function getModal(): Promise<WalletModal> {
  if (!modalPromise) {
    modalPromise = (async () => {
      // Load wallet SDKs only after the wallet icon is pressed, never on every app page.
      const [{ createAppKit }, { EthersAdapter }, networks] = await Promise.all([
        import('@reown/appkit'), import('@reown/appkit-adapter-ethers'), import('@reown/appkit/networks'),
      ])
      const modal = createAppKit({
        projectId: PROJECT_ID,
        adapters: [new EthersAdapter()],
        networks: [networks.mainnet, networks.arbitrum, networks.base, networks.optimism, networks.polygon, networks.bsc],
        allowUnsupportedChain: true,
        defaultAccountTypes: { eip155: 'eoa' },
        coinbasePreference: 'eoaOnly',
        allWallets: 'SHOW',
        metadata: { name: 'RWA.LAT', description: 'Sign in to RWA.LAT', url: location.origin, icons: [`${location.origin}/icons/rwa-pwa-v2-512.png`] },
        features: { analytics: false, email: false, socials: false, swaps: false, onramp: false, send: false, history: false },
        themeVariables: { '--w3m-accent': '#b68b4f', '--w3m-border-radius-master': '2px', '--w3m-z-index': 10000 },
      })
      await modal.ready()
      return modal
    })().catch(error => { modalPromise = undefined; throw error })
  }
  return modalPromise
}

/** The same EIP-1193 interface for mobile WalletConnect, EIP-6963 extensions and wallet browsers. */
export async function connectLoginWallet(): Promise<WalletProvider> {
  const modal = await getModal()
  modal.setThemeMode(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const connected = () => modal.getAccount('eip155')?.isConnected ? modal.getProvider<WalletProvider>('eip155') : undefined
  const existing = connected()
  if (existing) return existing
  return new Promise<WalletProvider>((resolve, reject) => {
    let settled = false
    let opened = false
    const subscriptions: Array<() => void> = []
    const finish = (provider?: WalletProvider, error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      subscriptions.forEach(unsubscribe => unsubscribe())
      if (provider) { void modal.close(); resolve(provider) }
      else reject(error ?? Object.assign(new Error('Wallet connection cancelled'), { code: 'WALLET_CANCELLED' }))
    }
    const check = () => { const provider = connected(); if (provider) finish(provider) }
    const timeout = setTimeout(() => { void modal.close(); finish(undefined, Object.assign(new Error('Wallet connection timed out'), { code: 'WALLET_CONNECTION_TIMEOUT' })) }, 180000)
    const subscribe = (unsubscribe: () => void) => { if (settled) unsubscribe(); else subscriptions.push(unsubscribe) }
    subscribe(modal.subscribeProviders(check))
    subscribe(modal.subscribeAccount(check, 'eip155'))
    subscribe(modal.subscribeState(state => {
      if (state.open) opened = true
      if (opened && !state.open) { const provider = connected(); finish(provider) }
    }))
    if (settled) return
    void modal.open({ view: 'Connect', namespace: 'eip155' }).then(check).catch(error => finish(undefined, error))
  })
}
