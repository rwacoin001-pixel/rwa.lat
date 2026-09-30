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
