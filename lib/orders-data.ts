/**
 * Orders data layer — real order records + receipts via Core API.
 */
import { apiClient } from './api-client'

export type OrderState = 'draft' | 'submitted' | 'accepted' | 'processing' | 'partially_filled' | 'filled' | 'failed' | 'cancelled' | string

export type OrderEvent = {
  previousState?: string | null
  nextState?: string | null
  actorType: string
  reasonCode?: string | null
  metadata?: Record<string, unknown>
  createdAt: string
}

export type OrderView = {
  id: string
  userId: string
  productId: string
  productName: string
  assetClassId: string
  outcomeKey?: string | null
  requestedAtomicAmount: string | number
  filledAtomicAmount?: string | number | null
  filledQuantityAtomicAmount?: string | number | null
  unitPriceAtomicAmount?: string | number | null
  state: OrderState
  failureReason?: string | null
  submittedAt: string
  completedAt?: string | null
  events: OrderEvent[]
}

export async function listOrders(): Promise<OrderView[]> {
  const { data } = await apiClient.axios.get('/v1/orders')
  return Array.isArray(data) ? data : data?.items ?? []
}

export async function getOrder(id: string): Promise<OrderView> {
  const { data } = await apiClient.axios.get(`/v1/orders/${encodeURIComponent(id)}`)
  return data
}

export const ORDER_STATE_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  accepted: 'Accepted',
  processing: 'Processing',
  partially_filled: 'Partially filled',
  filled: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const ORDER_STATE_TONE: Record<string, 'info' | 'warn' | 'ok' | 'error' | 'mute'> = {
  draft: 'mute',
  submitted: 'info',
  accepted: 'info',
  processing: 'warn',
  partially_filled: 'warn',
  filled: 'ok',
  failed: 'error',
  cancelled: 'mute',
}

/** 原子单位转显示金额（USDT 6 位小数） */
export function fromAtomic(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const numeric = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(numeric)) return 0
  return numeric / 1_000_000
}

/** 生成订单凭证 CSV（含真实字段；用于税务/审计/争议） */
export function orderToCsv(order: OrderView): string {
  const rows = [
    ['Field', 'Value'],
    ['Order ID', order.id],
    ['Product', order.productName],
    ['Asset class', order.assetClassId],
    ['Requested amount (USDT)', fromAtomic(order.requestedAtomicAmount).toFixed(6)],
    ['Filled amount (USDT)', fromAtomic(order.filledAtomicAmount).toFixed(6)],
    ['Filled quantity (atomic)', String(order.filledQuantityAtomicAmount ?? '')],
    ['Unit price (atomic)', String(order.unitPriceAtomicAmount ?? '')],
    ['State', ORDER_STATE_LABELS[order.state] ?? order.state],
    ['Failure reason', order.failureReason ?? ''],
    ['Submitted at', order.submittedAt],
    ['Completed at', order.completedAt ?? ''],
    ['', ''],
    ['Event timeline', ''],
    ['Time', 'Change', 'Actor', 'Reason code'],
    ...order.events.map((event) => [
      event.createdAt,
      `${event.previousState ?? '—'} → ${event.nextState ?? '—'}`,
      event.actorType,
      event.reasonCode ?? '',
    ]),
  ]
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export type CreateOrderInput = {
  productId: string
  amountAtomic: string
  outcomeKey?: 'long' | 'yes' | 'no'
}

/** 真实下单（POST /v1/orders，需要 idempotency-key） */
export async function createOrder(input: CreateOrderInput): Promise<OrderView> {
  const idempotencyKey = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : String(Date.now())
  const { data } = await apiClient.axios.post('/v1/orders', {
    productId: input.productId,
    atomicAmount: input.amountAtomic,
    outcomeKey: input.outcomeKey ?? 'long',
    riskAccepted: true,
  }, { headers: { 'idempotency-key': idempotencyKey } })
  return data
}
