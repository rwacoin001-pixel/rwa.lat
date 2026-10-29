'use client'

import { useEffect, useRef, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, Panel } from '@/components/console/framework'
import { useAdminProfile } from '@/components/rbac-gate'
import { adminErrorMessage } from '@/lib/admin-errors'

type Result = { auditId: string; sql: string; columns: { name: string; numeric: boolean }[]; rows: unknown[][]; rowCount: number; limited: boolean }
type Answer = { question: string; text: string; results: Result[] }
const EXAMPLES = ['今天新增多少用户？', '考拉量化当前总本金和持有人数', '近7天充值和提现总额']
const button = 'rounded-xl border border-ink/10 px-3 py-2 text-sm transition-colors hover:bg-ink/[0.04] disabled:opacity-40'
const display = (value: unknown) => value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)

export default function AdminAiPage() {
  return <AdminLayout><DataAi /></AdminLayout>
}

function DataAi() {
  const { profile } = useAdminProfile()
  const storageKey = profile?.id ? `admin-data-ai:queries:v1:${profile.id}` : null
  const [saved, setSaved] = useState<string[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!storageKey) return
    try {
      const data: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
      setSaved(Array.isArray(data) ? data.filter((q): q is string => typeof q === 'string' && q.length > 0 && q.length <= 2000).slice(0, 20) : [])
    } catch { setSaved([]) }
  }, [storageKey])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [answers.length])

  const save = (next: string[]) => {
    if (!storageKey) return
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next) }
    catch { setError('浏览器无法保存查询，请检查存储设置。') }
  }
  const ask = async (event: React.FormEvent) => {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const history = answers.slice(-6).flatMap(a => [{ role: 'user', content: a.question }, { role: 'assistant', content: a.text.slice(0, 4000) }])
      const response = await fetch('/api/admin/ai/query', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt, history }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(adminErrorMessage(data, response.status))
      setAnswers(prev => [...prev.slice(-19), { question: prompt, text: data.text, results: data.results }]); setQuestion('')
    } catch (e) { setError(e instanceof Error ? e.message : '查询失败，请稍后重试。') }
    finally { pending.current = false; setBusy(false) }
  }
  const exportCsv = async (id: string) => {
    setExporting(id); setError('')
    try {
      const response = await fetch('/api/admin/ai/export', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditId: id }) })
      if (!response.ok) throw new Error(adminErrorMessage(await response.json().catch(() => null), response.status))
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = 'data-ai.csv'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e instanceof Error ? e.message : '导出失败。') }
    finally { setExporting(null) }
  }

  return <div className="space-y-6">
    <PageHeader title="数据 AI" subtitle="用自然语言查询业务数据 · 只读 · 敏感信息已脱敏" />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-4">
        <Panel title="数据问答" pad={false}>
          <div className="space-y-6 p-4 sm:p-5" aria-live="polite" aria-busy={busy}>
            {!answers.length && <div className="space-y-4 py-6"><p className="text-sm text-text-secondary">从一个具体问题开始，查询结果会附上 SQL 和数据表。</p><div className="flex flex-wrap gap-2">{EXAMPLES.map(p => <button key={p} className={button} onClick={() => setQuestion(p)}>{p}</button>)}</div></div>}
            {answers.map((answer, index) => <article key={index} className="space-y-4 border-b border-ink/[0.06] pb-6 last:border-0">
              <div className="flex items-start justify-between gap-3"><h2 className="text-sm font-semibold">{answer.question}</h2><button className={button} disabled={saved.includes(answer.question) || saved.length >= 20} onClick={() => save([...saved, answer.question])}>{saved.includes(answer.question) ? '已保存' : '保存查询'}</button></div>
              <p className="whitespace-pre-wrap break-words text-sm leading-7 text-text-secondary">{answer.text}</p>
              {answer.results.map(result => <div key={result.auditId} className="min-w-0 space-y-3">
                <details className="rounded-xl border border-ink/10 px-3 py-2"><summary className="cursor-pointer text-xs text-text-secondary">查看 SQL</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre text-xs leading-6"><code>{result.sql}</code></pre></details>
                <div role="region" aria-label="查询结果" tabIndex={0} className="max-h-[420px] overflow-auto rounded-xl border border-ink/10">
                  <table className="w-full border-collapse text-sm"><thead className="sticky top-0 bg-white shadow-sm"><tr>{result.columns.map((c, i) => <th key={i} scope="col" className={`whitespace-nowrap px-4 py-3 font-medium ${c.numeric ? 'text-right' : 'text-left'}`}>{c.name}</th>)}</tr></thead>
                    <tbody>{result.rows.map((row, i) => <tr key={i} className="border-t border-ink/[0.06]">{result.columns.map((c, j) => <td key={j} className={`max-w-md whitespace-nowrap px-4 py-2.5 ${c.numeric ? 'text-right tabular-nums' : 'text-left'}`}>{display(row[j])}</td>)}</tr>)}</tbody></table>
                  {!result.rowCount && <p className="p-5 text-sm text-text-faint">没有符合条件的数据。</p>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-faint"><span>{result.rowCount} 行{result.limited ? ' · 已达 500 行上限，请缩小范围或查询汇总' : ''}</span><button className={button} disabled={exporting !== null} onClick={() => void exportCsv(result.auditId)}>{exporting === result.auditId ? '导出中…' : '导出 CSV（重新查询）'}</button></div>
              </div>)}
            </article>)}
            <div ref={end} />
            {busy && <p role="status" className="text-sm text-text-faint">正在查询，请稍候…</p>}
          </div>
        </Panel>
        {error && <p role="alert" className="rounded-xl border border-red-200 p-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={ask} className="glass-strong space-y-3 rounded-xl p-4">
          <label htmlFor="ai-question" className="text-sm font-medium">查询问题</label>
          <textarea id="ai-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} rows={3} placeholder="例如：近7天已入账充值总额，按天汇总" className="w-full resize-y rounded-xl border border-ink/10 bg-transparent px-3 py-2 text-sm focus:outline-mint" />
          <div className="flex items-center justify-between gap-3"><p className="text-xs text-text-faint">查询与导出均会记录审计日志。</p><button disabled={busy || !question.trim()} className="rounded-xl bg-ink px-5 py-2 text-sm text-white disabled:opacity-40">{busy ? '查询中…' : '发送'}</button></div>
        </form>
      </div>
      <Panel title="已保存查询"><div className="space-y-3 p-4"><p className="text-xs leading-5 text-text-faint">仅在当前浏览器保存问题，最多 20 条。再次使用时会查询最新数据。</p>{!saved.length && <p className="py-3 text-sm text-text-faint">还没有保存的查询。</p>}{saved.map(q => <div key={q} className="flex items-start gap-2 border-t border-ink/[0.06] pt-3"><button className="min-w-0 flex-1 break-words text-left text-sm leading-6 hover:text-mint" onClick={() => setQuestion(q)}>{q}</button><button className="shrink-0 text-xs text-text-faint hover:text-ink" aria-label={`删除查询：${q}`} onClick={() => save(saved.filter(s => s !== q))}>删除</button></div>)}</div></Panel>
    </div>
  </div>
}
