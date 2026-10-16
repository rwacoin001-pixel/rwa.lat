import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWalletConnectMetadata, connectedWalletLink, waitForLoginWalletConnection, type WalletPageLifecycle, type WalletProvider } from '../lib/api/wallet-connection'

class TestLifecycle implements WalletPageLifecycle {
  active = true
  private listeners = new Set<() => void>()
  isForeground = () => this.active
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  setForeground(active: boolean) { this.active = active; this.listeners.forEach(listener => listener()) }
}

function createModal() {
  let connectedProvider: WalletProvider | undefined
  let opened = false
  const providerListeners = new Set<() => void>()
  const stateListeners = new Set<(state: { open: boolean }) => void>()
  const emitState = () => stateListeners.forEach(listener => listener({ open: opened }))
  const modal = {
    open: async () => { opened = true; emitState() },
    close: async () => { opened = false; emitState() },
    getAccount: () => ({ isConnected: Boolean(connectedProvider) }),
    getProvider: () => connectedProvider,
    subscribeProviders: (listener: () => void) => { providerListeners.add(listener); return () => providerListeners.delete(listener) },
    subscribeAccount: (_listener: () => void) => () => {},
    subscribeState: (listener: (state: { open: boolean }) => void) => { stateListeners.add(listener); return () => stateListeners.delete(listener) },
    setOpen(value: boolean) { opened = value; emitState() },
    setConnected(value: WalletProvider) { connectedProvider = value; providerListeners.forEach(listener => listener()) },
  }
  return modal
}

const provider: WalletProvider = { request: async () => [] }
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const pending = new Set<Promise<unknown>>()
function wait(modal: ReturnType<typeof createModal>, lifecycle: TestLifecycle, options: { closeGraceMs?: number; returnRetryDelaysMs?: number[] } = {}) {
  const promise = waitForLoginWalletConnection(modal as never, { timeoutMs: 2_000, lifecycle, ...options })
  pending.add(promise)
  void promise.finally(() => pending.delete(promise)).catch(() => {})
  return promise
}

afterEach(async () => { await Promise.allSettled([...pending]) })

test('WalletConnect metadata points mobile wallets back to the PWA login route', () => {
  const metadata = buildWalletConnectMetadata('https://rwa.lat')
  assert.equal(metadata.url, 'https://rwa.lat')
  assert.equal(metadata.redirect.universal, 'https://rwa.lat/login')
  assert.match(metadata.icons[0], /^https:\/\/rwa\.lat\//)
  assert.equal('native' in metadata.redirect, false)
})

test('inside the Android app the wallet returns to the app, with the web route as fallback', () => {
  const metadata = buildWalletConnectMetadata('https://a-reit.com', true)
  assert.deepEqual(metadata.redirect, { native: 'areit://wallet', universal: 'https://a-reit.com/login' })
})

test('an approved wallet session resolves after returning to the PWA', async () => {
  const lifecycle = new TestLifecycle()
  const modal = createModal()
  const connection = wait(modal, lifecycle, { closeGraceMs: 20, returnRetryDelaysMs: [0, 5, 30] })
  await tick()
  lifecycle.setForeground(false)
  modal.setOpen(false)
  setTimeout(() => {
    lifecycle.setForeground(true)
    setTimeout(() => modal.setConnected(provider), 10)
  }, 10)
  assert.equal(await connection, provider)
})

test('closing the wallet picker in the foreground remains a cancellation', async () => {
  const lifecycle = new TestLifecycle()
  const modal = createModal()
  const connection = wait(modal, lifecycle, { closeGraceMs: 5 })
  await tick()
  modal.setOpen(false)
  await assert.rejects(connection, error => (error as { code?: string }).code === 'WALLET_CANCELLED')
})

test('returning without an approved session reports a missing connection, not cancellation', async () => {
  const lifecycle = new TestLifecycle()
  const modal = createModal()
  const connection = wait(modal, lifecycle, { closeGraceMs: 20, returnRetryDelaysMs: [0, 5] })
  await tick()
  lifecycle.setForeground(false)
  modal.setOpen(false)
  lifecycle.setForeground(true)
  await assert.rejects(connection, error => (error as { code?: string }).code === 'WALLET_CONNECTION_NOT_FOUND')
})

test('only a remembered wallet app link is reopened for signing; unsafe or missing links are ignored', () => {
  const store = (value: unknown) => ({ getItem: () => value === undefined ? null : JSON.stringify(value) })
  assert.equal(connectedWalletLink(store({ href: 'bnc://app.binance.com/cedefi/', name: 'Binance Wallet' })), 'bnc://app.binance.com/cedefi/')
  assert.equal(connectedWalletLink(store({ href: 'https://metamask.app.link/', name: 'MetaMask' })), 'https://metamask.app.link/')
  for (const href of ['javascript:alert(1)', 'data:text/html,x', 'http://evil.test/', 'not a link', 42]) assert.equal(connectedWalletLink(store({ href })), null, String(href))
  assert.equal(connectedWalletLink(store(undefined)), null)
  assert.equal(connectedWalletLink({ getItem: () => '{broken' }), null)
})
