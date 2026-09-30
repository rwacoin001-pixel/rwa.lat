'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import RwaTopbar from '../rwa-topbar'
import { Card } from '../ui/card'
import { Sel } from '../ui/Sel'
import { StatusBadge } from '../ui/StatusBadge'
import { Toast, toast } from '../ui/Toast'
import { useRwaTheme } from '@/lib/rwa-theme'
import { useQuery } from '@/lib/api/_query'
import { getOverview, getAssetList, getAssetHistory, getAssetDetail } from '@/lib/api/foundation'
import { fmtUsd } from '@/lib/money'
const PriceArea = dynamic(() => import('../charts/PriceArea').then(module => module.PriceArea), { ssr: false })
const DonutChart = dynamic(() => import('../charts/DonutChart').then(module => module.DonutChart), { ssr: false })
const ScoreBars = dynamic(() => import('../charts/ScoreBars').then(module => module.ScoreBars), { ssr: false })
export function UiLab() {
  const { theme, setTheme, mode, setMode } = useRwaTheme()
  const [segment, setSegment] = useState(0)
  const [days, setDays] = useState(180)
  const overview = useQuery('market:overview', getOverview)
  const assets = useQuery('market:assets', getAssetList)
  const slug = assets.data?.items[0]?.slug
  const history = useQuery(slug ? `market:history:${slug}:${days}` : null, () => getAssetHistory(slug!, days))
  const detail = useQuery(slug ? `market:detail:${slug}` : null, () => getAssetDetail(slug!))
  const action = () => toast('操作已触发')
  const score = detail.data?.score
  return <main className="rwa-ui-lab rwa-enter" data-testid="ui-lab" data-mode={mode}>
    <p>S1 基础组件验收</p>
    <div className="rwa-ui-lab__controls" aria-label="外观与模式">
      <Sel state={theme === 'light' ? 'selected' : 'rest'} onClick={() => setTheme('light')}>浅色</Sel><Sel state={theme === 'dark' ? 'selected' : 'rest'} onClick={() => setTheme('dark')}>深色</Sel><Sel onClick={() => setTheme('system')}>跟随系统</Sel>
      <Sel state={mode === 'ledger' ? 'selected' : 'rest'} onClick={() => setMode('ledger')}>账本模式</Sel><Sel state={mode === 'instrument' ? 'selected' : 'rest'} onClick={() => setMode('instrument')}>终端模式</Sel>
    </div>
    <div className="rwa-ui-lab__frames">
      <div className="rwa-ui-lab__frame"><RwaTopbar template="T-Root" l1="logo" l2={null} r2="search" r1="bell" onSlot={action} c={null} /></div>
      <div className="rwa-ui-lab__frame"><RwaTopbar template="T-Child" l1="back" l2={null} r2="share" r1="info" onSlot={action} c={{kind:'title',text:'资产'}} /></div>
      <div className="rwa-ui-lab__frame"><RwaTopbar template="T-Segment" l1="back" l2={null} r2={null} r1="bell" onSlot={action} c={{kind:'segment',items:['持仓','组合','收益'],value:segment,onChange:setSegment}} /></div>
      <div className="rwa-ui-lab__frame"><RwaTopbar template="T-Flow" l1="close" l2={null} r2={null} r1="help" onSlot={action} c={{kind:'steps',total:3,current:1}} /></div>
    </div>
    <div className="rwa-ui-lab__cards">
      <Card variant="card-hero" state={overview.loading ? 'skeleton' : overview.error ? 'error' : undefined} message={overview.error?.message} retry={overview.refetch}><p>市场总市值</p><strong className="rwa-num" data-testid="market-cap" data-value={overview.data?.totalMarketCapUsd ?? ''}>{fmtUsd(overview.data?.totalMarketCapUsd, {compact:true})}</strong><p>资产数 <span data-testid="asset-count">{overview.data?.assetCount ?? '—'}</span></p></Card>
      <Card state="empty" /><Card variant="card-flat" state="skeleton" /><Card variant="card-row" state="error" retry={action} /><Card variant="card-tile" state="stale" asOf={overview.data?.latestDataTimestamp}><StatusBadge domain="order" state="filled" /></Card><Card variant="card-media"><p>{assets.data?.items[0]?.name ?? '—'}</p></Card>
    </div>
    <Card state={overview.error ? 'error' : overview.loading ? 'skeleton' : undefined} retry={overview.refetch}><DonutChart items={(overview.data?.categoryDistribution ?? []).map(item => ({name:item.assetClass,value:item.totalMarketCapUsd}))} /></Card>
    <Card state={history.error ? 'error' : history.loading ? 'skeleton' : undefined} retry={history.refetch}><PriceArea points={(history.data?.points ?? []).map(point => ({date:point.date,value:point.priceUsd}))} days={days} onDaysChange={setDays} /></Card>
    <Card state={detail.error ? 'error' : detail.loading ? 'skeleton' : !score ? 'empty' : undefined} retry={detail.refetch}><ScoreBars items={score ? Object.entries(score).filter(([key]) => key.endsWith('Score')).map(([label,value]) => ({label,value})) : []} /></Card>
    <Toast />
  </main>
}
