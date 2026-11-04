'use client'

/**
 * Pick a share-a-result card (2026-11-01). Three steps in one sheet: the card shelf (every kind as a small ticket; kinds
 * with no data are greyed with the reason), the record (for kinds about one item), then the preview with a switch per
 * field. One field must stay visible, so the last switch cannot be turned off. The figures come from the server.
 */
import { ArrowLeft, ArrowRight, ChevronRight, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Sheet } from '@/components/maison/Sheet'
import controls from '@/components/ui/controls.module.css'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { CARD_FIELDS, cardGroup, getCardKinds, getCardSources, previewCard, type CardDraft, type CardKind, type CardKindInfo, type CardPreview, type CardSource } from '@/lib/community-cards'
import { ResultCard, useResultCardCopy } from './ResultCard'
import s from './card-picker.module.css'

type Copy = { title: string; pickKind: string; pickSource: string; preview: string; use: string; back: string; loading: string; failed: string; none: string; soon: string; hint: string; lastOne: string; reasons: Record<string, string>; about: Record<CardKind, string>; show: string; feel: string; step: (n: number) => string }
const copy: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': {
    title: '晒单卡片', pickKind: '选一种卡片', pickSource: '选一笔', preview: '预览和隐藏', use: '放进帖子', back: '返回', loading: '正在读取…', failed: '没有读取成功，请稍后再试。', none: '没有可以选的记录。', soon: '晒单卡片即将开放',
    hint: '金额和收益率同时显示时，别人可以算出你的本金。', lastOne: '至少要显示一项',
    about: { quant_day: '某一天结算的收益', quant_product: '一个产品的盈亏和持有天数', quant_total: '量化账户的累计收益', holdings: '现在持有什么，各占多少', prediction_bet: '一笔预测和它的结果', prediction_record: '胜率和最近 10 次', deposit: '一笔充值记录', withdrawal: '一笔提现记录' },
    show: '卡片上显示', feel: '按住卡片可以倾斜，点按翻到背面', step: (n) => `第 ${n} 步，共 3 步`,
    reasons: { NO_QUANT: '还没有量化持仓', NO_SETTLED_DAY: '还没有已结算的收益', NO_PREDICTION: '还没有预测记录', NO_SETTLED_PREDICTION: '还没有已结算的预测', NO_DEPOSIT: '还没有充值记录', NO_WITHDRAWAL: '还没有提现记录' },
  },
  en: {
    title: 'Result card', pickKind: 'Choose a card', pickSource: 'Choose one', preview: 'Preview and hide', use: 'Add to post', back: 'Back', loading: 'Loading…', failed: 'Could not load. Please try again.', none: 'Nothing to choose yet.', soon: 'Result cards are coming soon',
    hint: 'Showing both amount and return lets others work out your principal.', lastOne: 'Keep at least one visible',
    about: { quant_day: 'One settled day', quant_product: "One product's P&L and days held", quant_total: 'All of Koala Quant so far', holdings: 'What you hold now, and how much', prediction_bet: 'One prediction and its result', prediction_record: 'Win rate and the last ten', deposit: 'One deposit', withdrawal: 'One withdrawal' },
    show: 'On the card', feel: 'Hold the card to tilt it, tap to turn it over', step: (n) => `Step ${n} of 3`,
    reasons: { NO_QUANT: 'No Koala Quant holdings yet', NO_SETTLED_DAY: 'No settled day yet', NO_PREDICTION: 'No predictions yet', NO_SETTLED_PREDICTION: 'No settled predictions yet', NO_DEPOSIT: 'No deposits yet', NO_WITHDRAWAL: 'No withdrawals yet' },
  },
}

/** `panel`: inside the full-screen composer it is a panel over the composer (a second modal would be made inert). */
export function CardPicker({ open, onClose, onPick, panel = false }: { open: boolean; onClose: () => void; onPick: (draft: CardDraft) => void; panel?: boolean }) {
  const { locale } = useI18n()
  const k = copy[locale] ?? copy.en!
  const rc = useResultCardCopy()
  const [kinds, setKinds] = useState<CardKindInfo[] | null | undefined>(undefined)
  const [kind, setKind] = useState<CardKindInfo | null>(null)
  const [sources, setSources] = useState<CardSource[] | null>(null)
  const [sourceId, setSourceId] = useState<string | undefined>(undefined)
  const [preview, setPreview] = useState<CardPreview | null>(null)
  const [visible, setVisible] = useState<string[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind(null); setSources(null); setPreview(null); setFailed(false); setKinds(undefined)
    getCardKinds().then(setKinds).catch(() => { setKinds([]); setFailed(true) })
  }, [open])

  const loadPreview = (info: CardKindInfo, source?: string) => {
    setPreview(null); setFailed(false); setSourceId(source)
    previewCard(info.kind, source).then((data) => {
      setPreview(data)
      const usable = CARD_FIELDS[info.kind].filter((key) => data.snapshot[key] !== null && data.snapshot[key] !== undefined)
      const shown = usable.filter((key) => !info.defaultHidden.includes(key))
      setVisible(shown.length ? shown : usable.slice(0, 1))
    }).catch(() => setFailed(true))
  }
  const choose = (info: CardKindInfo) => {
    if (!info.available) return
    setKind(info)
    if (info.needsSource) { setSources(null); getCardSources(info.kind).then((page) => setSources(page.items)).catch(() => { setSources([]); setFailed(true) }) }
    else loadPreview(info)
  }
  const back = () => { if (kind?.needsSource && sourceId !== undefined) { setPreview(null); setSourceId(undefined); return } setKind(null); setPreview(null); setSources(null) }
  const toggle = (key: string) => setVisible((current) => current.includes(key) ? (current.length > 1 ? current.filter((item) => item !== key) : current) : CARD_FIELDS[kind!.kind].filter((item) => item === key || current.includes(item)))

  const shown = useMemo(() => {
    if (!preview || !kind) return null
    const snapshot = Object.fromEntries(Object.entries(preview.snapshot).filter(([key]) => !CARD_FIELDS[kind.kind].includes(key) || visible.includes(key)))
    return { kind: kind.kind, snapshot, visibleFields: visible, capturedAt: new Date().toISOString() }
  }, [preview, kind, visible])

  const step = !kind ? 'kinds' : kind.needsSource && !preview && sourceId === undefined ? 'source' : 'preview'
  const fields = kind ? CARD_FIELDS[kind.kind].filter((key) => preview?.snapshot[key] !== null && preview?.snapshot[key] !== undefined) : []

  const heading = step === 'kinds' ? k.pickKind : step === 'source' ? k.pickSource : k.preview
  const body = <>
    {step !== 'kinds' && <button type="button" className={s.back} onClick={back}><ArrowLeft size={16} aria-hidden="true" />{k.back}</button>}
    {failed && <p className={s.muted}>{k.failed}</p>}

    {step === 'kinds' && (kinds === undefined ? <p className={s.muted}>{k.loading}</p> : kinds === null ? <p className={s.muted}>{k.soon}</p> : <div className={s.groups}>
      {(['quant', 'prediction', 'funds'] as const).map((group) => { const items = kinds.filter((info) => cardGroup(info.kind) === group); return items.length > 0 && <section key={group}>
        <h3 className={s.groupHead}>{rc.group[group]}</h3>
        <ul className={s.list}>{items.map((info) => <li key={info.kind}><button type="button" className={s.row} disabled={!info.available} onClick={() => choose(info)}>
          <span className={s.rowText}><b>{rc.kinds[info.kind]}</b><small>{info.available ? k.about[info.kind] : k.reasons[info.reason ?? ''] ?? k.none}</small></span>
          {info.available && <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />}
        </button></li>)}</ul>
      </section> })}
    </div>)}

    {step === 'source' && (sources === null ? <p className={s.muted}>{k.loading}</p> : sources.length === 0 ? <p className={s.muted}>{k.none}</p> : <ul className={s.list}>
      {sources.map((item) => <li key={item.id}><button type="button" className={s.row} onClick={() => loadPreview(kind!, item.id)}><span className={s.rowText}><b dir="auto">{item.label}</b>{item.sublabel && <small dir="auto">{item.sublabel}</small>}</span><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button></li>)}
    </ul>)}

    {step === 'preview' && (!shown ? !failed && <p className={s.muted}>{k.loading}</p> : <div className={s.preview}>
      <div className={s.stage}><ResultCard card={shown} /><small className={s.muted}>{k.feel}</small></div>
      <h3 className={s.groupHead}>{k.show}</h3>
      <ul className={s.switches}>
        {fields.map((key) => { const on = visible.includes(key); const locked = on && visible.length === 1
          return <li key={key}><label><span>{rc.f[key] ?? key}{locked && <small>{k.lastOne}</small>}</span><input type="checkbox" role="switch" checked={on} disabled={locked} onChange={() => toggle(key)} /></label></li> })}
      </ul>
      {visible.some((key) => ['pnl', 'amount', 'stake', 'closedPnl'].includes(key)) && visible.includes('returnPct') && <p className={s.muted}>{k.hint}</p>}
      <button type="button" className={`${controls.primary} ${s.use}`} onClick={() => { if (preview && kind) onPick({ kind: kind.kind, sourceId, visibleFields: visible, preview }) }}><span>{k.use}</span><i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} strokeWidth={1.7} /></i></button>
    </div>)}
  </>
  if (panel) return open ? <div className={s.panel} role="dialog" aria-modal="true" aria-label={heading}>
    <header className={s.panelHead}><span><small>{k.title} · {k.step(step === 'kinds' ? 1 : step === 'source' ? 2 : 3)}</small><b>{heading}</b></span><button type="button" className={s.panelClose} aria-label={k.back} onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
    <div className={s.panelBody}>{body}</div>
  </div> : null
  return <Sheet open={open} onClose={onClose} title={heading} kicker={k.title}>{body}</Sheet>
}
