'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { WordReveal, CountUp, TiltCard } from './motion-primitives'

// --- AI Agent Card ---
const chatMessages = [
  { role: 'user', text: 'Analyze NVIDIA for Q3 outlook' },
  { role: 'ai', text: 'NVIDIA shows strong momentum with AI Score 92/100. Data center revenue up 206% YoY. Institutional buying pressure increasing.' },
  { role: 'user', text: 'What is the price target?' },
  { role: 'ai', text: 'Consensus price target: $1,240. AI model projects 18–24% upside over 90 days with high confidence.' },
]

function AIAgentCard() {
  const [visibleMessages, setVisibleMessages] = useState(0)
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const show = () => {
      setVisibleMessages(0)
      setTyping(false)
      let i = 0
      const next = () => {
        if (i >= chatMessages.length) return
        if (chatMessages[i].role === 'ai') setTyping(true)
        setTimeout(() => {
          setTyping(false)
          setVisibleMessages((v) => v + 1)
          i++
          setTimeout(next, 900)
        }, 1200)
      }
      setTimeout(next, 600)
    }
    show()
    const interval = setInterval(show, 12000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(46, 232, 142,0.2)', border: '1px solid rgba(46, 232, 142,0.4)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="4" stroke="#2EE88E" strokeWidth="1.5" />
            <circle cx="7" cy="7" r="1.5" fill="#2EE88E" />
          </svg>
        </div>
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
          AI Investment Agent
        </span>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(46, 232, 142,0.15)', color: '#5FF3AB', border: '1px solid rgba(46, 232, 142,0.25)' }}
        >
          Active
        </span>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {chatMessages.slice(0, visibleMessages).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="text-xs leading-relaxed px-3 py-2 max-w-[85%]"
              style={{
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background:
                  msg.role === 'user'
                    ? 'rgba(46, 232, 142,0.2)'
                    : 'rgba(255,255,255,0.06)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(46, 232, 142,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: msg.role === 'user' ? '#93C5FD' : 'rgba(255,255,255,0.75)',
              }}
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
        {typing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div
              className="px-3 py-2 flex gap-1 items-center"
              style={{
                borderRadius: '12px 12px 12px 2px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#2EE88E' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// --- Stock Intelligence Card ---
function StockCard() {
  const points = [40, 52, 38, 65, 58, 72, 68, 85, 78, 92, 88, 96]
  const w = 260
  const h = 80
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - (p / 100) * h
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
  const areaPath = `${path} L${w},${h} L0,${h} Z`

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <polyline points="1,11 5,6 8,8 13,2" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Stock Intelligence
        </span>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-lg font-bold text-white">NVDA</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>NVIDIA Corporation</div>
        </div>
        <div className="text-right">
          <CountUp
            to={92}
            duration={2}
            className="text-lg font-bold"
            style={{
              background: 'linear-gradient(135deg, #2EE88E, #5FF3AB)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          />
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>AI Score</div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl" style={{ height: 80 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2EE88E" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#2EE88E" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGrad)" />
          <motion.path
            d={path}
            fill="none"
            stroke="#2EE88E"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          />
        </svg>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>90-day trend</span>
        <span className="text-xs font-semibold" style={{ color: '#34D399' }}>+42.6%</span>
      </div>
    </div>
  )
}

// --- Compute Card ---
const gpuModels = [
  { name: 'H100', util: 94, color: '#2EE88E' },
  { name: 'H200', util: 78, color: '#5FF3AB' },
  { name: 'B200', util: 62, color: '#93C5FD' },
]

function ComputeCard() {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="#5FF3AB" strokeWidth="1.5" />
            <rect x="4.5" y="4.5" width="5" height="5" rx="1" fill="#5FF3AB" opacity="0.4" />
          </svg>
        </div>
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
          AI Compute Infrastructure
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {gpuModels.map((gpu) => (
          <div
            key={gpu.name}
            className="flex flex-col items-center p-2.5 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="text-xs font-bold mb-2" style={{ color: gpu.color }}>
              {gpu.name}
            </div>
            {/* Circular utilization */}
            <div className="relative w-12 h-12">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <motion.circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="none"
                  stroke={gpu.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - gpu.util / 100)}`}
                  style={{ transformOrigin: '24px 24px', rotate: '-90deg' }}
                  initial={{ strokeDashoffset: `${2 * Math.PI * 18}` }}
                  whileInView={{
                    strokeDashoffset: `${2 * Math.PI * 18 * (1 - gpu.util / 100)}`,
                  }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              </svg>
              <div
                className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                style={{ color: gpu.color }}
              >
                <CountUp to={gpu.util} duration={1.6} suffix="%" />
              </div>
            </div>
            <div className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Utilization
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {['12,400 TFLOPS', '98.6% Uptime', '< 2ms Latency'].map((m) => (
          <span
            key={m}
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(46, 232, 142,0.08)',
              border: '1px solid rgba(46, 232, 142,0.2)',
              color: '#93C5FD',
            }}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}

// --- Prediction Card ---
const predictions = [
  { event: 'Fed Rate Cut', probability: 68, interpretation: 'Positive for technology sector', up: true },
  { event: 'Recession Risk', probability: 24, interpretation: 'Low probability in next 6 months', up: false },
  { event: 'AI M&A Wave', probability: 81, interpretation: 'High consolidation likelihood', up: true },
]

function PredictionCard() {
  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L8.5 5H13L9.5 7.5L11 12L7 9L3 12L4.5 7.5L1 5H5.5L7 1Z" stroke="#A78BFA" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Prediction Intelligence
        </span>
        <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          via Polymarket
        </span>
      </div>

      <div className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
        AI-interpreted market signals
      </div>

      <div className="flex flex-col gap-3">
        {predictions.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-white">{p.event}</span>
              <span
                className="text-sm font-bold"
                style={{ color: p.up ? '#34D399' : '#F87171' }}
              >
                <CountUp to={p.probability} duration={1.5} suffix="%" />
              </span>
            </div>
            <div
              className="h-1.5 rounded-full mb-1.5 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: p.up
                    ? 'linear-gradient(90deg, #2EE88E, #34D399)'
                    : 'linear-gradient(90deg, #F87171, #FB923C)',
                }}
                initial={{ width: 0 }}
                whileInView={{ width: `${p.probability}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.15 }}
              />
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {p.interpretation}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// --- Main Bento Section ---
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
}

const cards = [
  { id: 'agent', component: <AIAgentCard />, label: 'Card 1' },
  { id: 'stock', component: <StockCard />, label: 'Card 2' },
  { id: 'compute', component: <ComputeCard />, label: 'Card 3' },
  { id: 'prediction', component: <PredictionCard />, label: 'Card 4' },
]

export default function BentoSection() {
  return (
    <section id="product" className="relative py-24 px-4 max-w-6xl mx-auto" aria-label="Intelligence modules">
      {/* Section header */}
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
          Intelligence Modules
        </div>
        <WordReveal
          as="h2"
          text="One Platform. Full Spectrum."
          stagger={0.09}
          className="text-balance text-4xl md:text-5xl font-bold mb-4"
          style={{
            background: 'linear-gradient(180deg, #FFFFFF 0%, #6B7280 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        />
        <p className="text-base max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Every module powered by proprietary AI, working together to give you a complete investment edge.
        </p>
      </motion.div>

      {/* Bento grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
      >
        {cards.map((card) => (
          <motion.div key={card.id} variants={cardVariants}>
            <TiltCard
              maxTilt={5}
              className="glass-card min-h-72 relative overflow-hidden h-full cursor-default"
              style={{ boxShadow: '0 4px 40px rgba(0,0,0,0.4)', borderRadius: 32 }}
            >
              {card.component}
            </TiltCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
