/** Production API contracts are generated in CI/development, never exposed by the running service. */
export function exposeApiDocs(env: Record<string, string | undefined>): boolean {
  if (env.APP_ENV === 'production' || env.NODE_ENV === 'production') return false
  return env.API_DOCS_ENABLED !== 'false'
}
