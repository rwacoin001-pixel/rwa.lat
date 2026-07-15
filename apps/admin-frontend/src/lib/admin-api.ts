const API_BASE = '/api/admin'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

export const adminApi = {
  getProfile: () => request<{ id: string; email: string; roleName: string; permissions: string[] }>('/auth/me'),
  listApprovals: (params?: { state?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.state) qs.set('state', params.state)
    if (params?.limit) qs.set('limit', String(params.limit))
    return request<any[]>(`/approvals${qs.size ? `?${qs}` : ''}`)
  },
  createApproval: (data: { action: string; objectType: string; objectId?: string; payload: Record<string, unknown> }) =>
    request<any>('/approvals', { method: 'POST', body: JSON.stringify(data) }),
  decideApproval: (id: string, approved: boolean, reasonCode?: string) =>
    request<any>(`/approvals/${id}/${approved ? 'decide' : 'reject'}`, { method: 'PUT', body: JSON.stringify({ reasonCode }) }),
  exportAudit: (params: { actorType?: string; userId?: string; action?: string; from?: string; to?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined) qs.set(key, String(value)) })
    return request<any[]>(`/audit?${qs}`)
  },
}
