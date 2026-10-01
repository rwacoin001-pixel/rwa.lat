'use client'

import { useState } from 'react'
import AiQuestionCard from '../maison/AiQuestionCard'
import type { AiQuestion } from '@/lib/api/ai-customer'

const questions: AiQuestion[] = [
  { id: 'intent', title: '你希望先解决哪件事？', multiple: false, options: [
    { id: 'account', label: '账户与安全', description: '登录、认证或账户设置' },
    { id: 'order', label: '订单与到账', description: '查询订单、充值或赎回进度' },
    { id: 'planning', label: '了解投资配置', description: '先明确目标，再比较适合的方向' },
  ] },
  { id: 'preferences', title: '哪些信息对你最有帮助？', multiple: true, options: [
    { id: 'terms', label: '期限与退出方式' },
    { id: 'costs', label: '费用和成本' },
    { id: 'risks', label: '风险与波动' },
  ] },
]

/** Development-only deterministic UI preview; never calls a model or handles funds. */
export default function AiCardsPreview() {
  const [dark, setDark] = useState(false)
  const [reference, setReference] = useState(true)
  const [width, setWidth] = useState(440)
  const [generation, setGeneration] = useState(0)
  const [answer, setAnswer] = useState('')
  const [failure, setFailure] = useState(false)
  const [error, setError] = useState('')
  return <main style={{ minHeight: '100dvh', background: dark ? '#121212' : '#f7f7f7', color: dark ? '#ebebeb' : '#202020', padding: '32px 16px', fontFamily: 'Arial, sans-serif' }}>
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
      <button onClick={() => setDark(v => !v)}>{dark ? '浅色' : '深色'}</button>
      <button onClick={() => setWidth(v => v === 440 ? 320 : 440)}>{width === 440 ? '320px' : '440px'}</button>
      <button onClick={() => { setGeneration(v => v + 1); setAnswer(''); setError('') }}>重置</button>
      <button onClick={() => { setReference(v => !v); setGeneration(v => v + 1) }}>{reference ? '多题测试' : '截图对照'}</button>
      <label><input type="checkbox" checked={failure} onChange={e => setFailure(e.target.checked)} />模拟请求失败</label>
    </nav>
    <div style={{ width: '100%', maxWidth: width, margin: '0 auto', '--background': dark ? '#181818' : '#fff', '--foreground': dark ? '#ebebeb' : '#202020' } as React.CSSProperties}>
      <p style={{ fontSize: 13, fontWeight: 600 }}>RWA.LAT AI</p>
      <p style={{ fontSize: 14, lineHeight: 1.7 }}>先确认一下你的需求。</p>
      <div style={{height:520,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',width:'calc(100% - 32px)',maxWidth:width,'--m-gutter':'0px'} as React.CSSProperties}>
          <AiQuestionCard key={generation} questions={reference ? [{id:'reference',title:'客服弹框的选项如何展示？',multiple:false,options:[{id:'compact',label:'紧凑列表，每个选项一行'},{id:'description',label:'选项附带一行简短说明'},{id:'names',label:'只展示选项名称'}]}] : questions} locale="zh-CN" onConfirm={async value => { await new Promise(resolve => setTimeout(resolve,2000)); if (failure) { setError('请求失败，选择已保留，请重试。'); return false } setError(''); setAnswer(value); return true }} />
          <div style={{border:'1px solid '+(dark?'#333':'#ddd'),borderRadius:18,padding:'14px 16px',background:dark?'#202020':'#fff',minHeight:86}}><span style={{color:dark?'#777':'#aaa',fontSize:13}}>输入消息…</span><div style={{display:'flex',justifyContent:'space-between',marginTop:14,fontSize:12,color:dark?'#aaa':'#777'}}><span>＋</span><span>↑</span></div></div>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {answer && <p style={{ whiteSpace: 'pre-wrap', padding: 16, background: dark ? '#252525' : '#eaeaea', borderRadius: 16, fontSize: 13 }}>{answer}</p>}
    </div>
  </main>
}
