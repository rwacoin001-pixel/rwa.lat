import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import { atomicAmountToAbiWord, tronAddressToAbiWord } from './tron-address.util'

export const DEFAULT_TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

export interface NormalizedTrc20Transfer {
  transactionId: string
  from: string
  to: string
  atomicAmount: string
  decimals: number
  contractAddress: string
  blockTimestamp: number
}

export interface TronTransactionInfo {
  blockNumber: number
  blockTimestamp: number
  receiptResult: string | null
}

export interface BuiltTronTransaction {
  txId: string
  rawDataHex: string
  transaction: Record<string, unknown>
}

export interface BroadcastResult {
  ok: boolean
  txid: string | null
  code: string | null
  message: string | null
}

const DEFAULT_TRON_BASE_URL = 'https://api.trongrid.io'
const COOLDOWN_INITIAL_MS = 5_000
const COOLDOWN_MAX_MS = 120_000
const RETRY_AFTER_MAX_MS = 300_000

export type TronProviderKind = 'node' | 'index'

/**
 * Thrown without contacting the provider while it is cooling down after a 429,
 * so callers can stop the rest of their batch instead of hammering a throttled IP.
 */
export class TronRateLimitedError extends Error {
  constructor(readonly provider: TronProviderKind, readonly retryInMs: number) {
    super(`TRON ${provider} provider is rate limited; retry in ${Math.ceil(retryInMs / 1000)}s`)
    this.name = 'TronRateLimitedError'
  }
}

/** Request pacing and 429 cooldown for one upstream origin (shared when node and index use the same host). */
class ProviderGate {
  private nextSlotAt = 0
  private cooldownUntil = 0
  private cooldownMs = 0

  constructor(private readonly minIntervalMs: number) {}

  remainingCooldown(now = Date.now()): number {
    return Math.max(0, this.cooldownUntil - now)
  }

  async acquire(provider: TronProviderKind): Promise<void> {
    const now = Date.now()
    const waitCooldown = this.remainingCooldown(now)
    if (waitCooldown > 0) throw new TronRateLimitedError(provider, waitCooldown)
    const slot = Math.max(now, this.nextSlotAt)
    this.nextSlotAt = slot + this.minIntervalMs
    if (slot > now) await delay(slot - now)
    const afterWait = this.remainingCooldown()
    if (afterWait > 0) throw new TronRateLimitedError(provider, afterWait)
  }

  rateLimited(retryAfterMs: number | null): number {
    this.cooldownMs = this.cooldownMs ? Math.min(this.cooldownMs * 2, COOLDOWN_MAX_MS) : COOLDOWN_INITIAL_MS
    const wait = Math.max(this.cooldownMs, retryAfterMs ?? 0)
    this.cooldownUntil = Date.now() + wait
    return wait
  }

  succeeded() {
    this.cooldownMs = 0
  }
}

interface ProviderEndpoint {
  kind: TronProviderKind
  baseUrl: string
  /** TronGrid API keys are only ever sent to TronGrid hosts (never to GetBlock or other node URLs). */
  sendsApiKey: boolean
  gate: ProviderGate
}

/**
 * Minimal TRON HTTP client. Full-node calls (/wallet/*) go to TRON_NODE_URL
 * (e.g. a GetBlock endpoint whose access token is part of the URL path), while
 * TronGrid's indexed /v1/* queries go to TRON_INDEX_URL. Both fall back to
 * TRON_API_BASE_URL and then the public TronGrid host.
 *
 * Read endpoints retry on transient failures; transaction-building retries are
 * safe because a rebuild produces a fresh reference block. Broadcast retries are
 * safe because the node de-duplicates identical signed transactions by txID.
 * A 429 puts that provider into an escalating cooldown during which calls fail
 * fast with TronRateLimitedError.
 */
@Injectable()
export class TronClientService {
  private readonly log = new Logger(TronClientService.name)
  private readonly node: ProviderEndpoint
  private readonly index: ProviderEndpoint
  private readonly apiKey: string | null
  private readonly timeoutMs: number
  private readonly maxRetries: number
  readonly usdtContract: string
  readonly feeLimitSun: number

  constructor(config: ConfigService) {
    const legacyBase = config.get<string>('TRON_API_BASE_URL')?.trim() || DEFAULT_TRON_BASE_URL
    const nodeBase = normalizeBaseUrl(config.get<string>('TRON_NODE_URL')?.trim() || legacyBase)
    const indexBase = normalizeBaseUrl(config.get<string>('TRON_INDEX_URL')?.trim() || legacyBase)
    this.apiKey = config.get<string>('TRON_API_KEY')?.trim() || null
    this.timeoutMs = readBounded(config.get<string>('TRON_API_TIMEOUT_MS'), 12_000, 3_000, 30_000)
    this.maxRetries = readBounded(config.get<string>('TRON_API_MAX_RETRIES'), 2, 0, 3)
    this.usdtContract = config.get<string>('TRON_USDT_CONTRACT')?.trim() || DEFAULT_TRON_USDT_CONTRACT
    this.feeLimitSun = readBounded(config.get<string>('TRON_WITHDRAWAL_FEE_LIMIT_SUN'), 100_000_000, 1_000_000, 1_000_000_000)

    // Keyless TronGrid throttles bursts per IP, so space its calls out; keyed or paid nodes can go faster.
    const intervalFor = (kind: TronProviderKind, base: string) => {
      const keyless = isTronGrid(base) && !this.apiKey
      const configured = config.get<string>(kind === 'node' ? 'TRON_NODE_MIN_INTERVAL_MS' : 'TRON_INDEX_MIN_INTERVAL_MS')
      return readBounded(configured, keyless ? 1_500 : 100, 0, 10_000)
    }
    const gates = new Map<string, ProviderGate>()
    const gateFor = (kind: TronProviderKind, base: string) => {
      const origin = new URL(base).origin
      let gate = gates.get(origin)
      if (!gate) {
        gate = new ProviderGate(intervalFor(kind, base))
        gates.set(origin, gate)
      }
      return gate
    }
    this.node = { kind: 'node', baseUrl: nodeBase, sendsApiKey: isTronGrid(nodeBase), gate: gateFor('node', nodeBase) }
    this.index = { kind: 'index', baseUrl: indexBase, sendsApiKey: isTronGrid(indexBase), gate: gateFor('index', indexBase) }
  }

  /** Milliseconds until the provider accepts requests again (0 when available). */
  cooldownRemaining(kind: TronProviderKind): number {
    return (kind === 'node' ? this.node : this.index).gate.remainingCooldown()
  }

  async listIncomingTransfers(address: string, input: { minTimestampMs: number; limit?: number }): Promise<NormalizedTrc20Transfer[]> {
    return this.listTransfers(address, 'to', input)
  }

  async listOutgoingTransfers(address: string, input: { minTimestampMs: number; limit?: number }): Promise<NormalizedTrc20Transfer[]> {
    return this.listTransfers(address, 'from', input)
  }

  async getNowBlockNumber(): Promise<number> {
    const body = await this.request<{ block_header?: { raw_data?: { number?: number } } }>('/wallet/getnowblock', { method: 'POST', body: {} })
    const number = body?.block_header?.raw_data?.number
    if (typeof number !== 'number' || !Number.isFinite(number)) {
      throw new Error('TRON node returned an invalid block header')
    }
    return number
  }

  async getTransactionInfo(transactionId: string): Promise<TronTransactionInfo | null> {
    const body = await this.request<{ blockNumber?: number; blockTimeStamp?: number; receipt?: { result?: string } }>(
      '/wallet/gettransactioninfobyid',
      { method: 'POST', body: { value: transactionId } },
    )
    if (!body || typeof body !== 'object' || typeof body.blockNumber !== 'number') return null
    return {
      blockNumber: body.blockNumber,
      blockTimestamp: typeof body.blockTimeStamp === 'number' ? body.blockTimeStamp : 0,
      receiptResult: typeof body.receipt?.result === 'string' ? body.receipt.result : null,
    }
  }

  /**
   * Builds an unsigned TRC-20 transfer and verifies the node's txID matches
   * sha256(raw_data_hex), so a corrupted or altered response can never be signed.
   */
  async buildTrc20Transfer(input: { ownerAddress: string; toAddress: string; atomicAmount: string }): Promise<BuiltTronTransaction> {
    const parameter = `${tronAddressToAbiWord(input.toAddress)}${atomicAmountToAbiWord(input.atomicAmount)}`
    const body = await this.request<{ result?: { result?: boolean; message?: string }; transaction?: Record<string, unknown> }>(
      '/wallet/triggersmartcontract',
      {
        method: 'POST',
        body: {
          owner_address: input.ownerAddress,
          contract_address: this.usdtContract,
          function_selector: 'transfer(address,uint256)',
          parameter,
          fee_limit: this.feeLimitSun,
          call_value: 0,
          visible: true,
        },
      },
    )
    const transaction = body?.transaction
    if (!transaction || typeof transaction.txID !== 'string' || typeof transaction.raw_data_hex !== 'string') {
      const reason = typeof body?.result?.message === 'string' ? Buffer.from(body.result.message, 'hex').toString('utf8') : 'transaction not built'
      throw new Error(`TRON node could not build the transfer transaction: ${sanitize(reason)}`)
    }
    const computed = createHash('sha256').update(Buffer.from(transaction.raw_data_hex as string, 'hex')).digest('hex')
    if (computed !== (transaction.txID as string)) {
      throw new Error('TRON node returned a transaction whose hash does not match its raw data')
    }
    return { txId: transaction.txID, rawDataHex: transaction.raw_data_hex, transaction }
  }

  async broadcastTransaction(transaction: Record<string, unknown>): Promise<BroadcastResult> {
    const body = await this.request<{ result?: boolean; txid?: string; code?: string; message?: string }>(
      '/wallet/broadcasttransaction',
      { method: 'POST', body: transaction },
    )
    const code = typeof body?.code === 'string' ? body.code : null
    const message = typeof body?.message === 'string' ? Buffer.from(body.message, 'hex').toString('utf8') : null
    if (body?.result === true) {
      return { ok: true, txid: typeof body.txid === 'string' ? body.txid : null, code, message }
    }
    return { ok: false, txid: typeof body?.txid === 'string' ? body.txid : null, code, message }
  }

  private async listTransfers(address: string, direction: 'to' | 'from', input: { minTimestampMs: number; limit?: number }): Promise<NormalizedTrc20Transfer[]> {
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 100), 1), 200)
    const params = new URLSearchParams({
      limit: String(limit),
      min_timestamp: String(Math.max(0, Math.trunc(input.minTimestampMs))),
      only_confirmed: 'false',
      [direction === 'to' ? 'only_to' : 'only_from']: 'true',
    })
    if (this.usdtContract) params.set('contract_address', this.usdtContract)
    const body = await this.request<{ success?: boolean; data?: unknown[]; error?: string }>(
      `/v1/accounts/${encodeURIComponent(address)}/transactions/trc20?${params.toString()}`,
      { method: 'GET' },
    )
    if (body && body.success === false) {
      throw new Error(`TRON transfer index rejected the query: ${sanitize(String(body.error ?? 'unknown'))}`)
    }
    const rows = Array.isArray(body?.data) ? body.data : []
    const transfers: NormalizedTrc20Transfer[] = []
    for (const row of rows) {
      const transfer = normalizeTransfer(row)
      if (transfer) transfers.push(transfer)
    }
    return transfers
  }

  private async request<T>(path: string, options: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
    // TronGrid's indexed queries live under /v1; everything else is the standard full-node API.
    const provider = path.startsWith('/v1/') ? this.index : this.node
    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await delay(300 * attempt)
      try {
        const result = await this.requestOnce<T>(provider, path, options)
        provider.gate.succeeded()
        return result
      } catch (error) {
        lastError = error
        if (!isRetryableNetworkError(error) || attempt === this.maxRetries) break
        this.log.warn(`TRON request retry ${attempt + 1}/${this.maxRetries} for ${options.method} ${path.split('?')[0]}`)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('TRON request failed')
  }

  private async requestOnce<T>(provider: ProviderEndpoint, path: string, options: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
    await provider.gate.acquire(provider.kind)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const headers: Record<string, string> = { accept: 'application/json' }
      if (options.method === 'POST') headers['content-type'] = 'application/json'
      if (this.apiKey && provider.sendsApiKey) headers['TRON-PRO-API-KEY'] = this.apiKey
      // Never log this URL: node providers such as GetBlock carry the access token in the path.
      const response = await fetch(`${provider.baseUrl}${path}`, {
        method: options.method,
        headers,
        body: options.method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
        signal: controller.signal,
      })
      const text = await response.text()
      if (text.length > MAX_RESPONSE_BYTES) throw new Error('TRON response exceeded the size limit')
      if (response.status === 429) {
        const wait = provider.gate.rateLimited(parseRetryAfter(response.headers.get('retry-after')))
        throw new TronRateLimitedError(provider.kind, wait)
      }
      if (!response.ok) {
        throw new TronHttpError(response.status, `TRON node responded with HTTP ${response.status}`)
      }
      try {
        return JSON.parse(text) as T
      } catch {
        throw new Error('TRON node returned a non-JSON response')
      }
    } catch (error) {
      if (error instanceof TronHttpError) {
        if (error.status >= 500) throw error
        throw new Error(error.message)
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TronHttpError(0, 'TRON request timed out')
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}

class TronHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'TronHttpError'
  }
}

function isRetryableNetworkError(error: unknown): boolean {
  return error instanceof TronHttpError && (error.status === 0 || error.status >= 500)
}

function normalizeTransfer(row: unknown): NormalizedTrc20Transfer | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const tokenInfo = (record.token_info ?? {}) as Record<string, unknown>
  const transactionId = record.transaction_id
  const from = record.from
  const to = record.to
  const value = record.value
  const blockTimestamp = record.block_timestamp
  if (typeof transactionId !== 'string' || typeof from !== 'string' || typeof to !== 'string') return null
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  if (typeof blockTimestamp !== 'number' || !Number.isFinite(blockTimestamp)) return null
  const decimals = typeof tokenInfo.decimals === 'number' ? tokenInfo.decimals : 6
  return {
    transactionId,
    from,
    to,
    atomicAmount: value,
    decimals,
    contractAddress: typeof tokenInfo.address === 'string' ? tokenInfo.address : '',
    blockTimestamp,
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function isTronGrid(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname
    return host === 'trongrid.io' || host.endsWith('.trongrid.io')
  } catch {
    return false
  }
}

/** Retry-After as seconds or an HTTP date, capped; null when absent or unparseable. */
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  const ms = /^\d+$/.test(trimmed) ? Number(trimmed) * 1000 : Date.parse(trimmed) - Date.now()
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, RETRY_AFTER_MAX_MS) : null
}

function readBounded(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function sanitize(value: string): string {
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 200)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
