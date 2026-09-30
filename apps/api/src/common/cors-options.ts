export const API_CORS_EXPOSED_HEADERS = ['Retry-After', 'x-request-id'] as const

export function createApiCorsOptions(origins: string[]) {
  return {
    origin: origins,
    credentials: true,
    exposedHeaders: [...API_CORS_EXPOSED_HEADERS],
  }
}
