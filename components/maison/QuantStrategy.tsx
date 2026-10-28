'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, X } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import q from './quant-strategy.module.css'

/**
 * "How the strategy works" on the product page (2026-10-29, user: a fuller, professional introduction with the film).
 * Source: the strategy report the Koala Quant film was made from — the same six ideas, the same maxims, jargon kept but
 * each term said in plain words. No performance promise here; the figures live in the performance section.
 * The film plays from the help site (720p web copy), full screen, Back closes it.
 */
type Step = { title: string; body: string; terms: string }
type StrategyCopy = { heading: string; lead: string; motto: string; film: string; filmMeta: string; play: string; close: string; steps: Step[] }
const zh: StrategyCopy = {
  heading: '我们的量化策略',
  lead: '考拉量化是 A-REIT 旗下的量化交易策略。研究时慢下来，反复检验每一个想法；交易时快而有纪律，每一笔都先过风控。',
  motto: '想得慢一点，下单快一点。',
  film: '考拉量化 · 策略影片',
  filmMeta: '4 分钟 · 讲清楚我们怎么做',
  play: '播放影片',
  close: '关闭',
  steps: [
    { title: '看清每一笔订单', body: '不只看价格，还看订单簿里买卖双方的力量：哪一边在加单、哪一边在撤单；按两边挂单量加权的“微观价格”，比中间价更难被小单晃动；成交会不会引来更多成交。成交之后价格往哪走，也每天检查，避免成为别人的接盘方。', terms: '订单流不平衡 OFI · 微观价格 · Hawkes 自激发 · Markout' },
    { title: '大模型提想法，数学做裁判', body: '大模型阅读研报和市场数据，提出因子假设，但只能用受限的公式语言写出来。每个因子都要过关：扣掉“试了很多次总会撞上一次好运”后仍然有效，回测过拟合的概率低于 20%，扣除交易成本后仍然赚钱，而且和已有因子不重复。不合格的会附上原因退回，让大模型换个方向。', terms: '收缩夏普 DSR · 过拟合概率 PBO < 0.2 · 正交化' },
    { title: '多个模型，各做一件事', body: '一个模型给每个品种打分，一个预测波动和相关性，一个读很长的行情序列，一个找品种之间的先后传导。复杂的组合留在线下训练，再“蒸馏”成一个小模型上线：线上每次判断不到 10 微秒。', terms: 'LightGBM · PatchTST · Mamba-2 · 图注意力网络 · 知识蒸馏' },
    { title: '按把握下注，不按心情', body: '先校准概率：模型说有六成把握，历史上就真的大约六成。再按把握大小决定仓位。每个品种有目标权重和容忍带，偏离太远才调整，调整时把交易成本算进去。', terms: '概率校准 ECE · 分数凯利 · 容忍带再平衡' },
    { title: '先活下来，复利才会发生', body: '下单前有一道硬风控：单笔上限、价格带、防误操作、防自成交，必要时一键停止。我们关心最坏的那 2.5% 的日子平均亏多少，用极值理论给“肥尾”建模；先算出市场跌多少会出大问题，再决定杠杆。尾部风险变大时自动降低仓位。', terms: '撮合前风控 · 预期亏损 ES 97.5% · 极值理论 EVT · 逆向压力测试' },
    { title: '诚实地检验，持续地迭代', body: '回测按真实的排队成交，扣除全部成本。把历史切成 10 段，组合出几十条互不“偷看”的回测路径，按偏保守的结果决定能否上线。新模型先在旁边“影子运行”，结果对得上才切换；因子变弱会自动报警。', terms: '组合净化交叉验证 CPCV · 影子模型 · 滚动 IC 监控' },
  ],
}
const en: StrategyCopy = {
  heading: 'How the strategy works',
  lead: 'Koala Quant is the quantitative trading strategy of A-REIT. Slow in research, testing every idea again and again; fast and disciplined in trading, with every order passing risk checks first.',
  motto: 'Think slow, trade fast.',
  film: 'Koala Quant · the film',
  filmMeta: '4 minutes · how we do it',
  play: 'Play the film',
  close: 'Close',
  steps: [
    { title: 'Read every order', body: 'Not just the price, but the balance of buyers and sellers in the order book: who is adding, who is pulling; a size-weighted “micro-price” that small orders cannot easily push; whether trades set off more trades. Where the price goes after each fill is checked every day, so we are not the one left holding the other side.', terms: 'Order-flow imbalance · Microprice · Hawkes process · Markout' },
    { title: 'A large model proposes; maths decides', body: 'A large language model reads research and market data and proposes factor ideas — written only in a restricted formula language. Each one must pass: still valid after discounting the luck of many tries, a backtest-overfitting probability under 20%, still profitable after costs, and not a copy of factors we already have. Rejected ideas go back with the reasons, so the model looks elsewhere.', terms: 'Deflated Sharpe (DSR) · PBO < 0.2 · Orthogonalisation' },
    { title: 'Several models, one job each', body: 'One scores each instrument, one forecasts volatility and correlation, one reads long price sequences, one finds which markets lead which. The heavy ensemble stays offline and is distilled into one small model for trading: under 10 microseconds per decision.', terms: 'LightGBM · PatchTST · Mamba-2 · Graph attention · Distillation' },
    { title: 'Size by confidence, not by mood', body: 'Probabilities are calibrated first: when the model says 60%, it has been right about 60% of the time. Positions follow that confidence. Each instrument has a target weight and a band; we rebalance only when it drifts too far, with trading costs counted.', terms: 'Calibration (ECE) · Fractional Kelly · Band rebalancing' },
    { title: 'Survive first; compounding follows', body: 'Hard checks run before every order: size limits, price bands, fat-finger and self-trade guards, and a kill switch. We watch the average loss on the worst 2.5% of days and model fat tails with extreme-value theory; we work out how far markets must fall to hurt us before choosing leverage, and cut risk automatically when the tails grow.', terms: 'Pre-trade risk · Expected Shortfall 97.5% · EVT · Reverse stress test' },
    { title: 'Test honestly, keep improving', body: 'Backtests assume realistic queue fills and every cost. History is cut into 10 parts and recombined into dozens of paths that never peek at each other; the conservative result decides whether a model goes live. New models shadow the live one before switching, and fading factors raise an alarm.', terms: 'Combinatorial purged CV (CPCV) · Shadow models · Rolling IC' },
  ],
}

export function QuantStrategy({ locale }: { locale: AppLocale }) {
  const t = locale === 'zh-CN' ? zh : en
  const lang = locale === 'zh-CN' ? 'zh' : 'en'
  const [playing, setPlaying] = useState(false)
  return <section className={q.root} aria-labelledby="quant-strategy">
    <h2 id="quant-strategy">{t.heading}</h2>
    <p className={q.lead}>{t.lead}</p>
    <p className={q.motto}>{t.motto}</p>
    <button type="button" className={q.film} onClick={() => setPlaying(true)} aria-label={t.play}>
      <img src={`/media/quant/film-${lang}.webp`} alt="" width={540} height={960} loading="lazy" decoding="async" />
      <span className={q.filmText}><b>{t.film}</b><small>{t.filmMeta}</small></span>
      <span className={q.play} aria-hidden="true"><Play size={18} fill="currentColor" strokeWidth={0} /></span>
    </button>
    <ol className={q.steps}>
      {t.steps.map((step, index) => <li key={step.title}>
        <span className={q.num} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div><h3>{step.title}</h3><p>{step.body}</p><small>{step.terms}</small></div>
      </li>)}
    </ol>
    {playing && <FilmPlayer src={`https://help.a-reit.com/media/koala-${lang}-720p.mp4`} poster={`/media/quant/film-${lang}.webp`} label={t.film} close={t.close} onClose={() => setPlaying(false)} />}
  </section>
}

function FilmPlayer({ src, poster, label, close, onClose }: { src: string; poster: string; label: string; close: string; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const done = useRef(onClose)
  done.current = onClose
  useEffect(() => {
    // One history entry so the phone's Back closes the film, not the page.
    history.pushState({ ...(history.state ?? {}), rwaFilm: true }, '')
    const pop = () => done.current()
    window.addEventListener('popstate', pop)
    document.documentElement.setAttribute('data-photo-open', '')
    void video.current?.play().catch(() => undefined)
    return () => {
      window.removeEventListener('popstate', pop)
      document.documentElement.removeAttribute('data-photo-open')
    }
  }, [])
  const shut = () => { if (history.state?.rwaFilm) history.back(); else onClose() }
  return createPortal(<div className={q.player} role="dialog" aria-modal="true" aria-label={label}>
    <video ref={video} src={src} poster={poster} controls playsInline preload="metadata" />
    <button type="button" className={q.close} aria-label={close} onClick={shut}><X size={22} strokeWidth={2} /></button>
  </div>, document.body)
}
