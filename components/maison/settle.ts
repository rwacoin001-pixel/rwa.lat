import type { ApiResult } from '@/lib/api/_http'

/**
 * Adapts the older axios clients (support-data, session-data), which throw ApiClientError,
 * to the ApiResult shape useQuery and the Maison screens expect. No request is made here.
 */
export async function settle<T>(run: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await run() }
  } catch (error) {
    const e = (error ?? {}) as { status?: number; code?: string; message?: string }
    return { ok: false, error: { status: typeof e.status === 'number' ? e.status : 0, code: e.code ?? 'UNKNOWN', message: e.message || 'Request failed' } }
  }
}
