export function idempotencyKeyForIntent(
  keys: Map<string, string>,
  method: string,
  path: string,
  body: unknown,
  createKey: () => string = () => crypto.randomUUID(),
): string {
  const fingerprint = JSON.stringify([method.toUpperCase(), path, body])
  const existing = keys.get(fingerprint)
  if (existing) return existing
  const key = createKey()
  keys.set(fingerprint, key)
  return key
}

/** Forget one confirmed intent's key (a new order of the same shape is a new intent) without touching other unresolved retries. */
export function retireIntentKey(keys: Map<string, string>, method: string, path: string, body: unknown): void {
  keys.delete(JSON.stringify([method.toUpperCase(), path, body]))
}

/**
 * True when the server has definitively refused this intent (a 4xx other than timeout / rate limit / still-processing).
 * The next attempt must then be a new intent with a new key: some endpoints keep the refused attempt under its key
 * (basket: a `pending` row; quant: a `rejected` order), so replaying that key would return the stale attempt as a
 * "duplicate" instead of trying again — e.g. after topping up a balance that was insufficient.
 */
export function isFinalRejection(error: { status: number; code?: string }): boolean {
  if (error.status < 400 || error.status >= 500 || [408, 425, 429].includes(error.status)) return false
  return !/IDEMPOTENCY_RETRY|IN_PROGRESS|STILL_PROCESSING/i.test(error.code ?? '')
}
