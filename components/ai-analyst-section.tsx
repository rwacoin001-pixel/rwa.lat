'use client'

import { motion } from 'framer-motion'
import { Clock, TrendingUp, ListChecks } from 'lucide-react'

const reasons = [
  { icon: '▲', text: 'AI infrastructure demand accelerating', value: '+206%' },
  { icon: '▲', text: 'Data center revenue growth record', value: '+94%' },
  { icon: '▲', text: 'Institutional adoption increasing', value: '+38%' },
]

const signals = [
  { label: 'Market Trend', value: 'Bullish', color: '#34D399' },
  { label: 'Volatility', value: 'Low', color: '#5FF3AB' },
  { label: 'Momentum', value: 'Strong', color: '#34D399' },
  { label: 'Risk Score', value: '24/100', color: '#34D399' },
]

export default function AIAnalystSection() {
  return (
    <section id="ai" className="relative py-28 px-4 overflow-hidden" aria-label="AI Investment Analyst">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(46, 232, 142,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{
              background: 'rgba(46, 232, 142,0.08)',
              border: '1px solid rgba(46, 232, 142,0.2)',
              color: '#5FF3AB',
            }}
          >
            AI Intelligence Showcase
          </div>
          <h2
            className="text-balance text-4xl md:text-5xl font-bold"
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #6B7280 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Your AI Investment Analyst.
          </h2>
        </motion.div>

        {/* Main report card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          {/* Left: AI Report */}
          <motion.div
            className="glass-card p-8 relative overflow-hidden"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Top glow */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-0.5"
              style={{ background: 'linear-gradient(90deg, transparent, #2EE88E, transparent)' }}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(46, 232, 142,0.2)', border: '1px solid rgba(46, 232, 142,0.4)', color: '#5FF3AB' }}
                >
                  N
                </div>
                <div>
                  <div className="text-white font-bold text-lg">NVIDIA</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>NVDA · NASDAQ</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Report</div>
                <div
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}
                >
                  Live
                </div>
              </div>
            </div>

            {/* Confidence */}
            <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl" style={{ background: 'rgba(46, 232, 142,0.06)', border: '1px solid rgba(46, 232, 142,0.15)' }}>
              <div>
                <div className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Confidence</div>
                <div className="flex items-baseline gap-1">
                  <motion.span
                    className="text-4xl font-bold"
                    style={{ color: '#2EE88E' }}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    86
                  </motion.span>
                  <span className="text-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>/100</span>
                </div>
              </div>
              <div className="flex-1">
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #2EE88E, #5FF3AB)' }}
                    initial={{ width: 0 }}
                    whileInView={{ width: '86%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: 'easeOut', delay: 0.4 }}
                  />
                </div>
                <div className="text-xs mt-1.5 font-semibold" style={{ color: '#34D399' }}>
                  BULLISH
                </div>
              </div>
            </div>

            {/* Reasons */}
            <div className="mb-6">
              <div className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                KEY DRIVERS
              </div>
              <div className="flex flex-col gap-2.5">
                {reasons.map((r, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#34D399' }}>{r.icon}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{r.text}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: '#34D399' }}>{r.value}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Signals grid */}
            <div className="grid grid-cols-2 gap-2">
              {signals.map((s, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</div>
                  <div className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Feature list */}
          <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            {[
              {
                title: 'Institutional-Grade Analysis',
                desc: 'Our AI processes 50M+ data points daily — earnings reports, analyst ratings, social sentiment, and macro signals — all synthesized into a single confidence score.',
                icon: (
                  <Clock size={20} strokeWidth={1.5} color="#2EE88E" />
                ),
              },
              {
                title: 'Real-Time Signal Processing',
                desc: 'Continuous monitoring of market microstructure, dark pool activity, and options flow gives you alpha before it is priced in.',
                icon: (
                  <TrendingUp size={20} strokeWidth={1.5} color="#2EE88E" />
                ),
              },
              {
                title: 'Explainable AI Decisions',
                desc: 'Every recommendation comes with a complete chain of reasoning — no black boxes, no guesswork. You always know why.',
                icon: (
                  <ListChecks size={20} strokeWidth={1.5} color="#2EE88E" />
                ),
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex gap-4"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.12 }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex-none flex items-center justify-center"
                  style={{ background: 'rgba(46, 232, 142,0.1)', border: '1px solid rgba(46, 232, 142,0.2)' }}
                >
                  {item.icon}
                </div>
                <div>
                  <div className="text-base font-semibold text-white mb-1.5">{item.title}</div>
                  <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {item.desc}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
