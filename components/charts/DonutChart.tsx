'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useReducedMotion } from 'motion/react'
import { ChartPie } from 'lucide-react'
import { DUR } from '@/lib/motion'
import { useI18n } from '@/lib/i18n'
import { EmptyState } from '../ui/Empty'
export function DonutChart({ items }: { items: { name: string; value: string | null }[] }) {
  const { locale } = useI18n()
  const reduced = useReducedMotion()
  const data = items.map(item => ({ name: item.name, value: item.value === null ? null : Number(item.value) })).filter(item => item.value !== null && Number.isFinite(item.value) && item.value > 0)
  if (!data.length) return <EmptyState variant="inline" icon={ChartPie} title={locale === 'zh-CN' ? '暂无分布数据' : 'No allocation data yet'} body={locale === 'zh-CN' ? '有可用的组合数据后，这里会显示分布。' : 'The allocation will appear when portfolio data is available.'} />
  const colors = ['var(--accent)', 'var(--info)', 'var(--up)', 'var(--warn)', 'var(--ink-2)', 'var(--ink-3)']
  return <div className="rwa-chart" data-testid="donut-chart" data-item-count={items.length}><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}><PieChart accessibilityLayer><Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" isAnimationActive={!reduced} animationDuration={DUR.long} stroke="var(--surface)">{data.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
}
