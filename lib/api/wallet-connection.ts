import { isAndroidApp } from '../android-app'

export type WalletProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

// Public Reown project identifier, not a secret. Restrict origins in its dashboard.
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '2defc1dee243f5dd45ecbe0bbe5b4919'
type WalletModal = Awaited<ReturnType<typeof import('@reown/appkit')['createAppKit']>>
type WalletConnectionModal = Pick<WalletModal, 'close' | 'getAccount' | 'getProvider' | 'open' | 'subscribeAccount' | 'subscribeProviders' | 'subscribeState'>
export type WalletPageLifecycle = {
  isForeground: () => boolean
  subscribe: (listener: () => void) => () => void
}
let modalPromise: Promise<WalletModal> | undefined

function createBrowserPageLifecycle(): WalletPageLifecycle {
  const isForeground = () => document.visibilityState !== 'hidden' && document.hasFocus()
  return {
    isForeground,
    subscribe(listener) {
      const notify = () => listener()
      document.addEventListener('visibilitychange', notify)
      window.addEventListener('focus', notify)
      window.addEventListener('blur', notify)
      window.addEventListener('pageshow', notify)
      window.addEventListener('pagehide', notify)
      return () => {
        document.removeEventListener('visibilitychange', notify)
        window.removeEventListener('focus', notify)
        window.removeEventListener('blur', notify)
        window.removeEventListener('pageshow', notify)
        window.removeEventListener('pagehide', notify)
      }
    },
  }
}

const walletError = (code: string, message: string) => Object.assign(new Error(message), { code })

/** Inside the Android app the wallet returns through areit://wallet (the app comes back to the front, the page waits). */
export const ANDROID_APP_WALLET_RETURN = 'areit://wallet'

export function buildWalletConnectMetadata(origin: string, inAndroidApp = false) {
  const metadata = { name: 'A-REIT', description: 'Sign in to A-REIT', url: origin, icons: [`${origin}/icons/a-reit-v1-512.png`] }
  const universal = new URL('/login', origin).href
  return { ...metadata, redirect: inAndroidApp ? { native: ANDROID_APP_WALLET_RETURN, universal } : { universal } }
}

/** Wait for the wallet session across an app switch; closing AppKit alone does not mean cancel. */
export function waitForLoginWalletConnection(
  modal: WalletConnectionModal,
  options: { lifecycle?: WalletPageLifecycle; timeoutMs?: number; closeGraceMs?: number; returnRetryDelaysMs?: number[] } = {},
): Promise<WalletProvider> {
  const lifecycle = options.lifecycle ?? createBrowserPageLifecycle()
  const timeoutMs = options.timeoutMs ?? 180_000
  const closeGraceMs = options.closeGraceMs ?? 3_000
  const returnRetryDelaysMs = options.returnRetryDelaysMs ?? [0, 250, 750, 1_500, 3_000]

  return new Promise<WalletProvider>((resolve, reject) => {
    let settled = false
    let opened = false
    let modalOpen = false
    let pageForeground = lifecycle.isForeground()
    let awayDuringAttempt = !pageForeground
    let timeoutRemaining = timeoutMs
    let timeoutStartedAt = 0
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    const returnTimers: ReturnType<typeof setTimeout>[] = []
    const subscriptions: Array<() => void> = []
    let unsubscribeLifecycle = () => {}

    const connected = () => modal.getAccount('eip155')?.isConnected ? modal.getProvider<WalletProvider>('eip155') : undefined
    const clearCloseTimer = () => { if (closeTimer) clearTimeout(closeTimer); closeTimer = undefined }
    const clearReturnTimers = () => { returnTimers.forEach(clearTimeout); returnTimers.length = 0 }
    const pauseTimeout = () => {
      if (!timeoutTimer) return
      clearTimeout(timeoutTimer)
      timeoutTimer = undefined
      timeoutRemaining = Math.max(0, timeoutRemaining - (Date.now() - timeoutStartedAt))
    }
    const finish = (provider?: WalletProvider, error?: unknown) => {
      if (settled) return
      settled = true
      if (timeoutTimer) clearTimeout(timeoutTimer)
      clearCloseTimer()
      clearReturnTimers()
      subscriptions.forEach(unsubscribe => unsubscribe())
      unsubscribeLifecycle()
      if (provider) {
        try { void modal.close().catch(() => {}) } catch { /* A connected provider remains usable if the dialog cannot close. */ }
        resolve(provider)
      } else reject(error ?? walletError('WALLET_CANCELLED', 'Wallet connection cancelled'))
    }
    const check = () => {
      const provider = connected()
      if (provider) finish(provider)
      return Boolean(provider)
    }
    const resumeTimeout = () => {
      if (settled || timeoutTimer || !pageForeground) return
      timeoutStartedAt = Date.now()
      timeoutTimer = setTimeout(() => {
        try { void modal.close().catch(() => {}) } catch { /* The timeout error is still actionable. */ }
        finish(undefined, walletError('WALLET_CONNECTION_TIMEOUT', 'Wallet connection timed out'))
      }, timeoutRemaining)
    }
    const scheduleCloseResult = () => {
      clearCloseTimer()
      if (!opened || modalOpen || !pageForeground) return
      closeTimer = setTimeout(() => {
        closeTimer = undefined
        if (settled || modalOpen || !pageForeground || check()) return
        finish(undefined, walletError(
          awayDuringAttempt ? 'WALLET_CONNECTION_NOT_FOUND' : 'WALLET_CANCELLED',
          awayDuringAttempt ? 'No wallet connection was received after returning to the app' : 'Wallet connection cancelled',
        ))
      }, closeGraceMs)
    }
    const retryAfterReturn = () => {
      clearReturnTimers()
      returnRetryDelaysMs.forEach((delay, index) => {
        const timer = setTimeout(() => {
          if (settled || !pageForeground || check()) return
          if (index === returnRetryDelaysMs.length - 1 && !modalOpen) {
            finish(undefined, walletError('WALLET_CONNECTION_NOT_FOUND', 'No wallet connection was received after returning to the app'))
          }
        }, delay)
        returnTimers.push(timer)
      })
    }

    const onPageLifecycle = () => {
      const isForeground = lifecycle.isForeground()
      if (!isForeground) {
        awayDuringAttempt = true
        pageForeground = false
        pauseTimeout()
        return
      }
      if (!pageForeground) {
        pageForeground = true
        resumeTimeout()
        clearCloseTimer()
        check()
        retryAfterReturn()
      } else check()
    }

    const subscribe = (unsubscribe: () => void) => { if (settled) unsubscribe(); else subscriptions.push(unsubscribe) }
    unsubscribeLifecycle = lifecycle.subscribe(onPageLifecycle)
    subscribe(modal.subscribeProviders(() => { check() }))
    subscribe(modal.subscribeAccount(() => { check() }, 'eip155'))
    subscribe(modal.subscribeState(state => {
      modalOpen = state.open
      if (state.open) {
        opened = true
        clearCloseTimer()
        return
      }
      if (!opened) return
      if (!check()) scheduleCloseResult()
    }))
    if (pageForeground) resumeTimeout()
    void modal.open({ view: 'Connect', namespace: 'eip155' })
      .then(() => { if (!settled) check() })
      .catch(error => finish(undefined, error))
  })
}

async function getModal(): Promise<WalletModal> {
  if (!modalPromise) {
    modalPromise = (async () => {
      // Load wallet SDKs only after the wallet icon is pressed, never on every app page.
      const [{ createAppKit }, { EthersAdapter }, networks, { UniversalProvider }] = await Promise.all([
        import('@reown/appkit'), import('@reown/appkit-adapter-ethers'), import('@reown/appkit/networks'),
        import('@walletconnect/universal-provider'),
      ])
      const metadata = { name: 'A-REIT', description: 'Sign in to A-REIT', url: location.origin, icons: [`${location.origin}/icons/a-reit-v1-512.png`] }
      // AppKit 1.8.24 rebuilds UniversalProvider metadata and omits `redirect`; provide the instance
      // ourselves so mobile wallets such as OKX know where to return after WalletConnect approval.
      const universalProvider = await UniversalProvider.init({
        projectId: PROJECT_ID,
        metadata: buildWalletConnectMetadata(location.origin, isAndroidApp()),
      })
      const modal = createAppKit({
        projectId: PROJECT_ID,
        adapters: [new EthersAdapter()],
        networks: [networks.mainnet, networks.arbitrum, networks.base, networks.optimism, networks.polygon, networks.bsc],
        allowUnsupportedChain: true,
        defaultAccountTypes: { eip155: 'eoa' },
        coinbasePreference: 'eoaOnly',
        allWallets: 'SHOW',
        metadata,
        universalProvider,
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
  return waitForLoginWalletConnection(modal)
}
