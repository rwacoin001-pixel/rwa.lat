'use client'

import { useState } from 'react'
import { DataTable, Panel, RefreshButton, StatusPill, useApi, type Col } from './console/framework'

type Publication = { id: string; targetType: 'post' | 'comment'; body: string; handle: string; state: string; createdAt: string }
export function CommunityPublications() {
  const data = useApi<Publication[]>('/api/admin/community/publications')
  const [selected, setSelected] = useState<Publication | null>(null)
  const [state, setState] = useState('hidden'); const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('')
  const submit = async () => {
    if (!selected || !reason.trim() || busy) return
    setBusy(true); setNotice('')
    try {
      const response = await fetch('/api/admin/community/publications/moderate', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetType: selected.targetType, targetId: selected.id, state, reason }) })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.message ?? '处理失败')
      setSelected(null); setReason(''); setNotice('已更新公开状态并记录处理原因。'); data.reload()
    } catch (error) { setNotice(error instanceof Error ? error.message : '处理失败') }
    finally { setBusy(false) }
  }
  const columns: Col<Publication>[] = [
    { key: 'body', label: '用户内容', render: row => <div><b>@{row.handle} · {row.targetType === 'post' ? '帖子' : '回复'}</b><p className="max-w-lg whitespace-pre-wrap">{row.body}</p></div> },
    { key: 'state', label: '状态', render: row => <StatusPill value={row.state} /> },
    { key: 'action', label: '事后处理', render: row => <button type="button" disabled={busy} onClick={() => { setSelected(row); setState('hidden'); setReason('') }}>处理</button> },
  ]
  return <Panel title="用户公开内容" subtitle="用户帖子与回复直接公开；授权管理员可事后隐藏、恢复或移除，并记录原因。" actions={<RefreshButton loading={data.loading} onClick={data.reload} />}>
    <DataTable columns={columns} rows={data.data ?? null} loading={data.loading} error={data.error} onReload={data.reload} emptyHint="暂无用户发布内容" />
    {notice && <p role="status">{notice}</p>}
    {selected && <fieldset disabled={busy} className="mt-4 space-y-3 rounded-xl border p-4"><p>处理 @{selected.handle} 的{selected.targetType === 'post' ? '帖子' : '回复'}</p>
      <label>处理动作 <select value={state} onChange={e => setState(e.target.value)}><option value="hidden">隐藏</option>{selected.state !== 'removed' && <option value="published">恢复公开</option>}<option value="removed">移除</option></select></label>
      <label className="block">处理原因<textarea className="block w-full rounded-xl border p-3" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
      <button type="button" disabled={!reason.trim()} onClick={() => void submit()}>确认处理</button><button type="button" onClick={() => setSelected(null)} className="ml-4">取消</button>
    </fieldset>}
  </Panel>
}
