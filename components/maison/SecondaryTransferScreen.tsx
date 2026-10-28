'use client'

/**
 * 二级市场转让（/secondary）：意向登记（waitlist）+ 标准转让协议下载 + 状态说明。
 * 撮合与结算能力就绪前，先提供登记与协议准备，不展示虚假流动性。
 */
import { useEffect, useState, type FormEvent } from 'react'
import { Check, FileText, Handshake } from 'lucide-react'
import RwaTopbar from '@/components/rwa-topbar'
import { Notice } from '@/components/ui/Notice'
import { getPositions, type PositionView } from '@/lib/portfolio-data'
import { backOr } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, maison as s } from './primitives'

type Intent = { id: string; productName: string; quantity: string; targetPrice: string; note: string; createdAt: string }

const STORAGE_KEY = 'rwa-secondary-intents'

function downloadAgreement() {
  const content = [
    'A-REIT 二级市场转让意向协议（标准模板 · 模拟）',
    '',
    '本模板用于登记转让意向，正式协议需在撮合与合规审核通过后签署。',
    '',
    '第一条 转让标的：用户持有的 A-REIT 平台产品权益（以持仓记录为准）。',
    '第二条 转让方式：意向登记后，由平台在二级市场撮合通道开通时通知双方。',
    '第三条 价格与结算：以双方确认价格为准，结算通过平台账本完成。',
    '第四条 合规要求：受让方须通过 KYC 与资格评估（SEC Reg D / MAS 视地区）。',
    '第五条 风险提示：二级市场存在流动性风险，登记不代表成交承诺。',
    '',
    `生成时间：${new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`,
  ].join('\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'A-REIT-二级市场转让协议模板.txt'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SecondaryTransferScreen() {
  const [positions, setPositions] = useState<PositionView[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [intents, setIntents] = useState<Intent[]>([])
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    getPositions()
      .then((list) => {
        setPositions(list)
        if (list.length > 0) setProduct(list[0].productName)
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) setIntents(JSON.parse(stored) as Intent[])
    } catch {}
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!product || !quantity.trim() || !targetPrice.trim()) { setFormError('请填写产品、数量与期望价格'); return }
    const intent: Intent = {
      id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : String(Date.now()),
      productName: product, quantity: quantity.trim(), targetPrice: targetPrice.trim(), note: note.trim(), createdAt: new Date().toISOString(),
    }
    const next = [intent, ...intents].slice(0, 50)
    setIntents(next)
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
    setQuantity('')
    setTargetPrice('')
    setNote('')
    setFormError(null)
    setSubmitted(true)
    window.setTimeout(() => setSubmitted(false), 2600)
  }

  const topbar = <RwaTopbar screen="secondary" title="二级市场转让" onBack={() => backOr('/assets')} />

  return <MaisonPage page="secondary" dock topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}>SECONDARY / TRANSFER</p>
      <h1 className={s.titleL}>转让意向登记</h1>
      <p className={s.lede}>撮合通道开放前，先登记你的转让意向；开放时我们会按登记顺序通知你。</p>
    </header>

    <section className={s.card}>
      <p className={s.kicker}><Handshake size={14} aria-hidden="true" /> 二级市场筹备中</p>
      <p className={s.lede}>登记不收费用、不锁定资产；正式转让须经合规审核与双方协议签署。</p>
    </section>

    {loadState === 'loading' && <Skeleton rows={2} />}
    {loadState === 'error' && <Notice tone="error">持仓加载失败。仍然可以手动填写产品名称登记意向。</Notice>}

    <form className={s.card} onSubmit={submit} style={{ marginTop: 12 }}>
      <label className={s.field}>
        <span>选择产品</span>
        {positions.length > 0
          ? <select value={product} onChange={(event) => setProduct(event.target.value)}>{positions.map((pos) => <option key={pos.productId} value={pos.productName}>{pos.productName}（{pos.quantity.toFixed(2)} 份）</option>)}</select>
          : <input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="手动输入产品名称" />}
      </label>
      <label className={s.field}><span>转让数量</span><input inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="如 100" /></label>
      <label className={s.field}><span>期望单价（USDT）</span><input inputMode="decimal" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="如 1.05" /></label>
      <label className={s.field}><span>备注（可选）</span><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="期望成交时间等" /></label>
      {formError && <p className={s.fieldError} role="alert">{formError}</p>}
      <button className={s.ghost} type="submit" disabled={submitted} style={{ marginTop: 16 }}>{submitted ? <><Check size={15} aria-hidden="true" /> 已登记</> : '提交转让意向'}</button>
    </form>

    <ul className={s.list} style={{ marginTop: 12 }}><li>
      <button type="button" className={s.row} onClick={downloadAgreement}>
        <FileText size={18} aria-hidden="true" />
        <span className={s.rowMain}><b>下载标准转让协议（模板）</b><small>含合规要求与风险提示条款</small></span>
      </button>
    </li></ul>

    {intents.length > 0 && <>
      <SectionHead title="我的登记" action={<small className={`${s.muted} ${s.num}`}>{intents.length}</small>} />
      <ul className={s.list}>{intents.map((intent) => <li key={intent.id} className={s.row}>
        <span className={s.rowMain}><b>{intent.productName}</b><small>{intent.quantity} 份 · 期望 {intent.targetPrice} USDT · {new Date(intent.createdAt).toLocaleDateString('zh-CN')}</small>{intent.note && <small>{intent.note}</small>}</span>
      </li>)}</ul>
      <p className={s.foot}><span>登记保存在本机；功能开通后会自动同步到你的账户。</span></p>
    </>}
  </MaisonPage>
}
