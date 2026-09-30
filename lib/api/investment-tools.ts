import { request } from './_http'
export type RecurringPlan = { id: string; productId: string; productName: string; amountAtomic: string; frequency: string; nextRunAt: string; state: 'active' | 'paused' | 'cancelled'; runs: Array<{ state: string; orderId: string | null; failureCode: string | null; scheduledAt: string }> }
export const listRecurring = () => request<RecurringPlan[]>('/v1/recurring-investments')
export const createRecurring = (input: { productId: string; amountAtomic: string; frequency: string; firstRunAt: string; consent: true }, key: string) => request<{ id: string }>('/v1/recurring-investments', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(input) })
export const changeRecurring = (id: string, state: RecurringPlan['state']) => request(`/v1/recurring-investments/${encodeURIComponent(id)}/state`, { method: 'PUT', body: JSON.stringify({ state }) })
