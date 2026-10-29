'use client'
import { FORMULA_SVG } from './quant-formulas'

import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AppLocale } from '@/lib/i18n'
import r from './quant-research.module.css'

/**
 * Research method on the product page (2026-10-29, user: from the strategy summary, not only the film; show the formulas;
 * professional; animated charts — reviewed with Codex, G:/Media/quant-cover-v2/design.md). One ruled editorial panel:
 * the pipeline, then six pillars, each with a plain explanation, the formula typeset, one line on how to read it, and —
 * for four of them — a small animated diagram. Diagrams are illustrations (labelled 示意), never performance.
 * Formulas are plain HTML (no maths library): italic variables, real fractions, operators with limits.
 */

const formulas = { ofi: 1, micro: 1, hawkes: 1, dsr: 1, es: 1, kelly: 1 } as const

/* ── Copy ────────────────────────────────────────────────────────────────────────────────────────────────────────── */
type Pillar = { key: keyof typeof formulas; tag: string; title: string; body: string; read: string; diagram?: 'book' | 'hawkes' | 'cpcv' | 'tail' }
type Copy = { heading: string; lead: string; note: string; pipeline: [string, string][]; sketch: string; formula: string; read: string; pillars: Pillar[] }
const zh: Copy = {
  heading: '研究方法',
  lead: '每一笔交易都来自同一条流水线：读懂订单流，大模型提出假设，统计检验做裁判，多个模型分工给出信号，最后经过成本和风控的约束才下单。下面是其中最关键的六个环节，以及它们背后的数学。',
  note: '本节说明研究方法。标“示意”的图只用来解释概念，不是实际交易数据，也不代表收益承诺。',
  pipeline: [['订单流', 'OFI'], ['因子工厂', '大模型'], ['模型分工', '集成 · 蒸馏'], ['执行', '计成本'], ['风控', '撮合前']],
  sketch: '示意', formula: '公式', read: '读法',
  pillars: [
    { key: 'ofi', tag: 'OFI', title: '订单流不平衡：看买卖压力', body: '价格只是结果，订单簿里的挂单、撤单和成交才是原因。OFI 把盘口前 K 档买卖量的净变化加权相加，衡量这一刻买方和卖方谁在加力。', read: '各档的买卖净变化 ΔI 乘以权重 w 再相加；为正说明买方在加力。', diagram: 'book' },
    { key: 'micro', tag: 'Microprice', title: '微观价格：看盘口重心', body: '中间价很容易被一两笔小单“晃动”。微观价格按对侧挂单量加权：买盘越厚，重心越靠近卖价，更接近下一笔成交可能发生的位置。', read: 'P 是报价，Q 是挂单量；a 为卖方，b 为买方。' },
    { key: 'hawkes', tag: 'Hawkes', title: '自激发过程：看交易聚集', body: '一笔成交会引来更多成交，波动会扎堆出现。Hawkes 过程把这种“传染”写成强度函数；分支比 α/β 接近 1 时，市场容易连锁爆发，我们会降低交易强度。', read: '当前强度 = 基础强度 μ + 过去每笔事件随时间衰减的影响。', diagram: 'hawkes' },
    { key: 'dsr', tag: 'DSR · PBO · CPCV', title: '收缩夏普：让检验做裁判', body: '大模型只负责提出因子假设，而且只能写成受限的公式语言；留不留由统计检验决定。试得越多越容易撞上“好运”，DSR 把尝试次数、偏度和峰度一起扣掉；再要求过拟合概率 PBO < 0.2，并用组合净化交叉验证 CPCV 生成几十条互不“偷看”的回测路径，按偏保守的 P25 结果决定能否上线。', read: '实测夏普 SR 减去 N 次尝试的“幸运基准” SR₀，按样本长度 T、偏度 γ₃、峰度 γ₄ 校正后，得到它真实有效的概率。', diagram: 'cpcv' },
    { key: 'es', tag: 'ES 97.5% · EVT', title: '预期亏损：先看最坏的日子', body: '只看平均波动会低估风险。我们关心最差 2.5% 的日子平均亏多少，并用极值理论 EVT 给“肥尾”单独建模；尾部变厚时自动降低仓位。下单前还有一道硬风控：单笔上限、价格带、防自成交和一键熔断。', read: '把损失 L 在最差 2.5% 区间里各个分位点的值取平均。', diagram: 'tail' },
    { key: 'kelly', tag: 'Kelly', title: '分数凯利：按把握下注', body: '先校准概率：模型说六成把握，历史上就真的约六成。再用凯利公式算出理论仓位，并乘以小于 1 的折扣 c，给估计误差留余地。实际组合还要考虑相关性和风险上限。', read: '胜率 p、盈亏比 b 给出理论比例，再乘折扣 c；这不是当前仓位。' },
  ],
}
const en: Copy = {
  heading: 'Research method',
  lead: 'Every trade comes out of one pipeline: read the order flow, let a large model propose hypotheses, let statistical tests decide, let several models share the work of producing signals, and only then trade within cost and risk limits. Here are the six most important steps and the maths behind them.',
  note: 'This section explains the method. Figures marked “Illustration” explain ideas only; they are not trading data and promise no returns.',
  pipeline: [['Flow', 'OFI'], ['Factors', 'large model'], ['Models', 'distilled'], ['Execute', 'cost-aware'], ['Risk', 'pre-trade']],
  sketch: 'Illustration', formula: 'Formula', read: 'Reading',
  pillars: [
    { key: 'ofi', tag: 'OFI', title: 'Order-flow imbalance: who is pressing', body: 'Price is the result; orders added, pulled and filled in the book are the cause. OFI adds up the weighted net change in bid and ask size over the top K levels, measuring which side is pressing right now.', read: 'Net change ΔI at each level times its weight w, summed; positive means buyers are pressing.', diagram: 'book' },
    { key: 'micro', tag: 'Microprice', title: 'Microprice: where the book leans', body: 'The mid price is easily nudged by a small order. The microprice weights each quote by the size on the other side: the thicker the bids, the closer it sits to the ask — nearer to where the next trade is likely.', read: 'P is a quote, Q a resting size; a is the ask side, b the bid side.' },
    { key: 'hawkes', tag: 'Hawkes', title: 'Self-exciting flow: trades cluster', body: 'One trade invites more; volatility arrives in bursts. A Hawkes process writes that contagion as an intensity; when the branching ratio α/β nears 1, cascades become likely and we trade less.', read: 'Intensity now = base rate μ + the decaying influence of every past event.', diagram: 'hawkes' },
    { key: 'dsr', tag: 'DSR · PBO · CPCV', title: 'Deflated Sharpe: tests decide', body: 'The large model only proposes factor ideas, in a restricted formula language; tests decide what stays. The more you try, the likelier a lucky hit — DSR discounts the number of trials, skew and kurtosis. We also require a backtest-overfitting probability under 0.2 and use combinatorial purged cross-validation to build dozens of paths that never peek at each other, deciding on the conservative P25.', read: 'Observed Sharpe SR minus the lucky benchmark SR₀ of N trials, corrected for length T, skew γ₃ and kurtosis γ₄: the probability it is real.', diagram: 'cpcv' },
    { key: 'es', tag: 'ES 97.5% · EVT', title: 'Expected shortfall: the worst days first', body: 'Average volatility understates risk. We watch the average loss on the worst 2.5% of days and model fat tails with extreme-value theory, cutting risk automatically when tails grow. Hard checks also run before every order: size limits, price bands, self-trade guards and a kill switch.', read: 'The average of the loss quantiles across the worst 2.5%.', diagram: 'tail' },
    { key: 'kelly', tag: 'Kelly', title: 'Fractional Kelly: size by confidence', body: 'Probabilities are calibrated first: when the model says 60%, it has been right about 60% of the time. Kelly gives a theoretical size, multiplied by a discount c below 1 to leave room for estimation error. Real portfolios also respect correlation and risk limits.', read: 'Win rate p and payoff b give the theoretical fraction, times the discount c; this is not the live position.' },
  ],
}

/** True once the element has been on screen (diagrams start then, once). */
function useSeen<T extends Element>(margin = '0px 0px -30% 0px') {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSeen(true); return }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0, rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [margin])
  return [ref, seen] as const
}

/* ── Diagrams (illustrations; fixed shapes, nothing derived from trading) ───────────────────────────────────────── */
const BOOK = [[.42, .55], [.58, .4], [.74, .62], [.5, .8], [.9, .48], [.66, .7], [.8, .9], [1, .58]] as const
function Book() {
  return <svg viewBox="0 0 320 132" className={r.svg} aria-hidden="true">
    <line x1="160" y1="4" x2="160" y2="128" className={r.axis} />
    {BOOK.map(([bid, ask], i) => <g key={i} style={{ ['--i' as string]: i }}>
      <rect className={`${r.grow} ${r.bid}`} x={156 - bid * 136} y={6 + i * 15.5} width={bid * 136} height="11" rx="2" style={{ transformOrigin: '156px 0' }} />
      <rect className={`${r.grow} ${r.ask}`} x="164" y={6 + i * 15.5} width={ask * 136} height="11" rx="2" style={{ transformOrigin: '164px 0' }} />
    </g>)}
  </svg>
}
const EVENTS = [18, 46, 52, 58, 64, 118, 150, 156, 160, 166, 171, 240, 286]
function hawkesPath() {
  const mu = 12, a = 15, b = 0.07, pts: string[] = []
  for (let x = 0; x <= 320; x += 2) {
    const v = mu + EVENTS.filter((t) => t <= x).reduce((s, t) => s + a * Math.exp(-b * (x - t)), 0)
    pts.push(`${x},${(104 - Math.min(96, v)).toFixed(1)}`)
  }
  return `M${pts.join(' L')}`
}
const HAWKES = hawkesPath()
function Hawkes() {
  return <svg viewBox="0 0 320 132" className={r.svg} aria-hidden="true">
    <line x1="0" y1="92" x2="320" y2="92" className={r.base} />
    <path d={HAWKES} className={r.draw} pathLength={1} />
    {EVENTS.map((t, i) => <line key={t} x1={t} x2={t} y1="114" y2="126" className={r.tick} style={{ ['--i' as string]: i }} />)}
  </svg>
}
// Six of the C(10,2) splits: each row is one path; two blocks test, purged neighbours stay out, the rest train.
const CPCV = [[0, 1], [2, 5], [3, 8], [1, 6], [4, 9], [0, 7]]
function Cpcv() {
  return <svg viewBox="0 0 320 132" className={r.svg} aria-hidden="true">
    {CPCV.map((test, row) => Array.from({ length: 10 }, (_, col) => {
      const kind = test.includes(col) ? 'test' : test.some((tcol) => Math.abs(tcol - col) === 1) ? 'purge' : 'train'
      return <rect key={`${row}-${col}`} x={col * 32 + 2} y={row * 21 + 4} width="28" height="15" rx="3" className={`${r.cell} ${r[kind]}`} style={{ ['--i' as string]: row * 2 + col * 0.4 }} />
    }))}
  </svg>
}
const TAIL = Array.from({ length: 26 }, (_, i) => { const x = (i - 15) / 4.2; return Math.exp(-x * x / 2) + (i < 5 ? 0.06 * (5 - i) / 5 + 0.03 : 0) })
function Tail() {
  const max = Math.max(...TAIL)
  return <svg viewBox="0 0 320 132" className={r.svg} aria-hidden="true">
    {TAIL.map((v, i) => <rect key={i} className={`${r.rise} ${i < 3 ? r.loss : r.mass}`} x={i * 12.3 + 1} y={116 - (v / max) * 104} width="10" height={(v / max) * 104} rx="2" style={{ ['--i' as string]: i }} />)}
    <line x1="37.5" y1="6" x2="37.5" y2="118" className={r.cut} />
    <line x1="0" y1="117" x2="320" y2="117" className={r.base} />
  </svg>
}
const diagrams = { book: Book, hawkes: Hawkes, cpcv: Cpcv, tail: Tail }
const legends: Record<string, { zh: string; en: string }> = {
  book: { zh: '左：买盘各档挂单　右：卖盘各档挂单', en: 'Left: bid sizes by level · Right: ask sizes' },
  hawkes: { zh: '每笔事件抬高强度，随后按指数衰减', en: 'Each event lifts the intensity, which then decays' },
  cpcv: { zh: '深色：测试段　浅色：训练段　空心：净化隔离', en: 'Dark: test · Light: train · Outline: purged' },
  tail: { zh: '红色：最差 2.5%；ES 是这一段的平均', en: 'Red: the worst 2.5%; ES is their average' },
}

function Figure({ kind, label, zhLegend }: { kind: keyof typeof diagrams; label: string; zhLegend: boolean }) {
  const [ref, seen] = useSeen<HTMLDivElement>()
  const D = diagrams[kind]
  return <figure ref={ref} className={r.figure} data-seen={seen || undefined}>
    <span className={r.sketch}>{label}</span>
    <D />
    <figcaption>{zhLegend ? legends[kind].zh : legends[kind].en}</figcaption>
  </figure>
}

/** The MathJax SVGs with a pen order: every glyph and rule gets its start time (--k) in document order, which is
 *  MathJax's writing order (left to right, numerator before denominator), at most 3.6 s for the whole formula. */
const WRITTEN: Record<string, string> = Object.fromEntries(Object.entries(FORMULA_SVG).map(([key, { svg }]) => {
  const count = (svg.match(/<(path|rect)(?=[\s/>])/g) ?? []).length || 1
  const step = Math.min(120, 3600 / count)
  let i = 0
  return [key, svg.replace(/<(path|rect)(?=[\s/>])/g, (_, tag: string) => `<${tag} ${tag === 'path' ? 'pathLength="1" ' : ''}style="--k:${Math.round(i++ * step)}ms"`)]
}))

/**
 * A formula written out by hand when it scrolls into view (2026-10-29, user: write the formulas slowly, not all at
 * once). MathJax glyphs are filled outlines; each is first traced with a thin pen (stroke-dashoffset, pathLength 1),
 * in pen order, then its ink fills in. Rules (fraction bars, radicals) are drawn as lines from the left.
 */
function Formula({ k, label }: { k: string; label: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>('0px 0px -25% 0px')
  return <div ref={ref} className={r.formula} data-seen={seen || undefined} role="img" aria-label={label}>
    <MathInk html={WRITTEN[k] ?? ''} />
  </div>
}
// Memoised so a re-render never rewrites the SVG mid-stroke (fresh nodes would skip their transitions).
const MathInk = memo(function MathInk({ html }: { html: string }) {
  return <span className={r.mathSvg} dangerouslySetInnerHTML={{ __html: html }} />
})

function Pillar({ children }: { children: ReactNode }) {
  const [ref, seen] = useSeen<HTMLElement>('0px 0px -15% 0px')
  return <article ref={ref} className={r.pillar} data-seen={seen || undefined}>{children}</article>
}

export function QuantResearch({ locale }: { locale: AppLocale }) {
  const t = locale === 'zh-CN' ? zh : en
  const [flow, seen] = useSeen<HTMLOListElement>()
  return <section className={r.root} aria-labelledby="quant-research">
    <h2 id="quant-research">{t.heading}</h2>
    <p className={r.lead}>{t.lead}</p>
    <ol ref={flow} className={r.pipe} data-seen={seen || undefined}>
      {t.pipeline.map(([name, sub], i) => <li key={name} style={{ ['--i' as string]: i }}><b>{name}</b><small>{sub}</small></li>)}
      <i className={r.pulse} aria-hidden="true" />
    </ol>
    <div className={r.panel}>
      {t.pillars.map((pillar, index) => <Pillar key={pillar.key}>
        <header><span className={r.num}>{String(index + 1).padStart(2, '0')}</span><span className={r.tag}>{pillar.tag}</span></header>
        <h3>{pillar.title}</h3>
        <p>{pillar.body}</p>
        {/* Typeset by MathJax into SVG at build time, then written out stroke by stroke when seen. */}
        <Formula k={pillar.key} label={`${t.formula}: ${FORMULA_SVG[pillar.key]?.tex ?? pillar.tag}`} />
        <p className={r.read}><b>{t.read}</b>{pillar.read}</p>
        {pillar.diagram && <Figure kind={pillar.diagram} label={t.sketch} zhLegend={locale === 'zh-CN'} />}
      </Pillar>)}
    </div>
    <p className={r.note}>{t.note}</p>
  </section>
}
