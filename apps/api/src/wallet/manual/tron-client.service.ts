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

/**
 * Minimal TRON HTTP client (TronGrid/node API). Read endpoints retry on
 * transient failures; transaction-building retries are safe because a rebuild
 * produces a fresh reference block. Broadcast retries are safe because node
 * de-duplicates identical signed transactions by txID.
 */
@Injectable()
export class TronClientService {
  private readonly log = new Logger(TronClientService.name)
  private readonly baseUrl: string
  private readonly apiKey: string | null
  private readonly timeoutMs: number
  private readonly maxRetries: number
  readonly usdtContract: string
  readonly feeLimitSun: number

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('TRON_API_BASE_URL')?.trim() || 'https://api.trongrid.io').replace(/\/+$/, '')
    this.apiKey = config.get<string>('TRON_API_KEY')?.trim() || null
    this.timeoutMs = readBounded(config.get<string>('TRON_API_TIMEOUT_MS'), 12_000, 3_000, 30_000)
    this.maxRetries = readBounded(config.get<string>('TRON_API_MAX_RETRIES'), 2, 0, 3)
    this.usdtContract = config.get<string>('TRON_USDT_CONTRACT')?.trim() || DEFAULT_TRON_USDT_CONTRACT
    this.feeLimitSun = readBounded(config.get<string>('TRON_WITHDRAWAL_FEE_LIMIT_SUN'), 100_000_000, 1_000_000, 1_000_000_000)
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
    let lastError: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await delay(300 * attempt)
      try {
        return await this.requestOnce<T>(path, options)
      } catch (error) {
        lastError = error
        if (!isRetryableNetworkError(error) || attempt === this.maxRetries) break
        this.log.warn(`TRON request retry ${attempt + 1}/${this.maxRetries} for ${options.method} ${path.split('?')[0]}`)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('TRON request failed')
  }

  private async requestOnce<T>(path: string, options: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const headers: Record<string, string> = { accept: 'application/json' }
      if (options.method === 'POST') headers['content-type'] = 'application/json'
      if (this.apiKey) headers['TRON-PRO-API-KEY'] = this.apiKey
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method,
        headers,
        body: options.method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
        signal: controller.signal,
      })
      const text = await response.text()
      if (text.length > MAX_RESPONSE_BYTES) throw new Error('TRON response exceeded the size limit')
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
