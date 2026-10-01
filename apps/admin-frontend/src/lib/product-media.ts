export function productMediaRefs(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((ref): ref is string => typeof ref === 'string' && ref.length > 0) : []
}
