export function adminErrorMessage(data: unknown, status: number): string {
  const fallback: Record<number, string> = {
    401: '登录已失效，请重新登录。',
    403: '当前管理员没有权限执行此操作。',
    502: '服务请求失败，请刷新重试。',
    503: '服务暂不可用，请稍后重试。',
    504: '请求超时，请重试。',
  }
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    const nested = body.error && typeof body.error === 'object' ? (body.error as Record<string, unknown>).message : undefined
    const value = nested ?? body.message
    const message = typeof value === 'string' ? value : Array.isArray(value) && value.every(item => typeof item === 'string') ? value.join('；') : ''
    if (message.trim() && !/[<>]/.test(message)) return message.slice(0, 300)
  }
  return fallback[status] ?? `请求失败 (HTTP ${status})`
}
