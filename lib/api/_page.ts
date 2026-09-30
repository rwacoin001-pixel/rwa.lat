export type Page<T> = { items: T[]; total?: number; page?: number; limit?: number; cursor?: string }
export function toPage<T>(input: unknown, key = 'items'): Page<T> {
  if (Array.isArray(input)) return { items: input as T[] }
  const res = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const items = [key, 'items', 'points', 'rows', 'data', 'entries', 'networks'].map(k => res[k]).find(Array.isArray) ?? []
  return { items: items as T[], total: typeof res.total === 'number' ? res.total : undefined,
    page: typeof res.page === 'number' ? res.page : undefined, limit: typeof res.limit === 'number' ? res.limit : undefined,
    cursor: typeof res.cursor === 'string' ? res.cursor : undefined }
}
