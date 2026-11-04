'use client'

/**
 * Prediction filters after the user's Polymarket recording (2026-11-05): a title with a filter key that folds the rows
 * away, the topic chips, then three choice pills — sort, ending window, status — each opening a bottom sheet with a
 * tick on the current choice, and three "hide" boxes (sports, crypto, earnings) with 清除筛选 once anything differs from
 * the defaults. Type and ink only (no tinted tiles); the sheet is the app's own Sheet.
 */
import { Check, ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Sheet } from './Sheet'
import { useI18n, type AppLocale } from '@/lib/i18n'
import type { FeedHide, FeedStatus, FeedWindow } from '@/lib/api/polymarket-feed'
import s from './prediction-filters.module.css'

export type FilterSort = 'volume24hr' | 'volume' | 'liquidity' | 'createdAt' | 'endDate' | 'competitive'
export const FILTER_SORTS: FilterSort[] = ['volume24hr', 'volume', 'liquidity', 'createdAt', 'endDate', 'competitive']
const WINDOWS: FeedWindow[] = ['day', 'week', 'month', 'all']
const STATUSES: FeedStatus[] = ['active', 'resolved']
const HIDES: FeedHide[] = ['sports', 'crypto', 'earnings']

type Copy = { title: string; filters: string; search: string; sort: Record<FilterSort, string>; window: Record<FeedWindow, string>; status: Record<FeedStatus, string>; hide: Record<FeedHide, string>; clear: string; sortTitle: string; windowTitle: string; statusTitle: string }
const zh: Copy = {
  title: '全部预测', filters: '筛选', search: '搜索预测市场',
  sort: { volume24hr: '24h 成交', volume: '总成交', liquidity: '流动性', createdAt: '最新', endDate: '即将截止', competitive: '势均力敌' },
  window: { day: '今天截止', week: '本周截止', month: '本月截止', all: '全部时间' }, status: { active: '进行中', resolved: '已结束' },
  hide: { sports: '不看体育', crypto: '不看加密', earnings: '不看财报' }, clear: '清除筛选', sortTitle: '排序', windowTitle: '截止时间', statusTitle: '状态',
}
const en: Copy = {
  title: 'All markets', filters: 'Filters', search: 'Search predictions',
  sort: { volume24hr: '24hr Volume', volume: 'Total Volume', liquidity: 'Liquidity', createdAt: 'Newest', endDate: 'Ending Soon', competitive: 'Competitive' },
  window: { day: 'Daily', week: 'Weekly', month: 'Monthly', all: 'All' }, status: { active: 'Active', resolved: 'Resolved' },
  hide: { sports: 'Hide sports', crypto: 'Hide crypto', earnings: 'Hide earnings' }, clear: 'Clear filters', sortTitle: 'Sort by', windowTitle: 'Ends within', statusTitle: 'Status',
}
const COPY: Partial<Record<AppLocale, Copy>> = { 'zh-CN': zh, en }

export type FilterState = { sort: FilterSort; window: FeedWindow; status: FeedStatus; hide: FeedHide[] }
export const DEFAULT_FILTERS: FilterState = { sort: 'volume24hr', window: 'all', status: 'active', hide: [] }
export const filtersChanged = (f: FilterState) => f.sort !== DEFAULT_FILTERS.sort || f.window !== 'all' || f.status !== 'active' || f.hide.length > 0

export function PredictionFilters({ value, onChange, chips, search, onSearch }: { value: FilterState; onChange: (next: FilterState) => void; chips: React.ReactNode; search: string; onSearch: (text: string) => void }) {
  const { locale } = useI18n()
  const k = COPY[locale] ?? en
  const [open, setOpen] = useState(true)
  const [sheet, setSheet] = useState<'sort' | 'window' | 'status' | null>(null)
  const [searching, setSearching] = useState(Boolean(search))
  const set = (patch: Partial<FilterState>) => { onChange({ ...value, ...patch }); setSheet(null); navigator.vibrate?.(4) }
  const options = sheet === 'sort' ? FILTER_SORTS.map((key) => [key, k.sort[key]] as const)
    : sheet === 'window' ? WINDOWS.map((key) => [key, k.window[key]] as const)
    : sheet === 'status' ? STATUSES.map((key) => [key, k.status[key]] as const) : []
  const current = sheet === 'sort' ? value.sort : sheet === 'window' ? value.window : value.status
  return <div className={s.root}>
    <div className={s.head}>
      <h2>{k.title}</h2>
      <button type="button" className={s.icon} aria-label={k.search} aria-pressed={searching} onClick={() => setSearching((v) => !v)}><Search size={20} strokeWidth={1.8} /></button>
      <button type="button" className={s.icon} aria-label={k.filters} aria-expanded={open} onClick={() => setOpen((v) => !v)}><SlidersHorizontal size={20} strokeWidth={1.8} /></button>
    </div>
    {searching && <label className={s.search}><Search size={16} strokeWidth={1.8} aria-hidden="true" /><input type="search" autoFocus placeholder={k.search} aria-label={k.search} maxLength={120} value={search} onChange={(e) => onSearch(e.target.value)} /></label>}
    {chips}
    {open && <>
      <div className={s.pills} role="group" aria-label={k.filters}>
        <button type="button" className={s.pill} onClick={() => setSheet('sort')}><span>{k.sort[value.sort]}</span><ChevronDown size={14} strokeWidth={2} aria-hidden="true" /></button>
        <button type="button" className={s.pill} disabled={value.status === 'resolved'} onClick={() => setSheet('window')}><span>{k.window[value.window]}</span><ChevronDown size={14} strokeWidth={2} aria-hidden="true" /></button>
        <button type="button" className={s.pill} onClick={() => setSheet('status')}><span>{k.status[value.status]}</span><ChevronDown size={14} strokeWidth={2} aria-hidden="true" /></button>
      </div>
      <div className={s.hides}>
        {HIDES.map((key) => <label key={key} className={s.box}><input type="checkbox" checked={value.hide.includes(key)} onChange={(e) => onChange({ ...value, hide: e.target.checked ? [...value.hide, key] : value.hide.filter((h) => h !== key) })} /><span>{k.hide[key]}</span></label>)}
      </div>
      {filtersChanged(value) && <button type="button" className={s.clear} onClick={() => onChange(DEFAULT_FILTERS)}>{k.clear}</button>}
    </>}
    <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet === 'sort' ? k.sortTitle : sheet === 'window' ? k.windowTitle : k.statusTitle}>
      <ul className={s.options}>{options.map(([key, label]) => <li key={key}><button type="button" aria-pressed={current === key} onClick={() => set(sheet === 'sort' ? { sort: key as FilterSort } : sheet === 'window' ? { window: key as FeedWindow } : { status: key as FeedStatus, ...(key === 'resolved' ? { window: 'all' as const } : {}) })}>
        <span>{label}</span>{current === key && <Check size={18} strokeWidth={2} aria-hidden="true" />}
      </button></li>)}</ul>
    </Sheet>
  </div>
}
