'use client'

import { motion } from 'framer-motion'
import { WordReveal, CountUp } from './motion-primitives'

function PortfolioChart() {
  // in-function scope: avoids Turbopack export-mode SSR hoisting drop of module-level const
  const portfolioPoints = [
    62, 58, 71, 68, 75, 72, 80, 76, 84, 81, 88, 87, 91, 89, 94, 92, 96, 95, 100, 98,
  ]
  const w = 600
  const h = 120
  const padX = 20

  const path = portfolioPoints
    .map((p, i) => {
      const x = padX + (i / (portfolioPoints.length - 1)) * (w - padX * 2)
      const y = h - (p / 100) * (h - 16) - 8
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')

  const lastX = padX + ((portfolioPoints.length - 1) / (portfolioPoints.length - 1)) * (w - padX * 2)
  const lastY = h - (portfolioPoints[portfolioPoints.length - 1] / 100) * (h - 16) - 8

  const areaPath = `${path} L${lastX},${h} L${padX},${h} Z`

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 140 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h + 20}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2EE88E" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2EE88E" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[25, 50, 75].map((v) => (
          <line
            key={v}
            x1={0}
            y1={h - (v / 100) * (h - 16) - 8}
            x2={w}
            y2={h - (v / 100) * (h - 16) - 8}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}
        <path d={areaPath} fill="url(#portfolioGrad)" />
        <motion.path
          d={path}
          fill="none"
          stroke="#2EE88E"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
        />
        {/* End dot */}
        <circle cx={lastX} cy={lastY} r="5" fill="#2EE88E" opacity="0.9" />
        <circle cx={lastX} cy={lastY} r="9" fill="#2EE88E" opacity="0.15" />
      </svg>
    </div>
  )
}

export default function PortfolioSection() {
  // in-function scope: avoids Turbopack export-mode SSR hoisting drop of module-level const
  const assets = [
    { name: 'Stocks', allocation: 52, value: '$66,841', change: '+12.4%', up: true, color: '#2EE88E' },
    { name: 'AI Compute', allocation: 31, value: '$39,847', change: '+28.6%', up: true, color: '#5FF3AB' },
    { name: 'Cash', allocation: 17, value: '$21,852', change: '+0.8%', up: true, color: '#93C5FD' },
  ]

  return (
    <section id="signals" className="relative py-24 px-4 overflow-hidden" aria-label="Portfolio Intelligence">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-14"
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
            Personal Portfolio Intelligence
          </div>
          <WordReveal
            as="h2"
            text="Your Portfolio, Reimagined."
            stagger={0.09}
            className="text-balance text-4xl md:text-5xl font-bold"
            style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #6B7280 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          />
        </motion.div>

        {/* Portfolio card */}
        <motion.div
          className="glass-card p-6 md:p-8 relative overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ boxShadow: '0 8px 60px rgba(0,0,0,0.5)' }}
        >
          {/* Top border glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-0.5"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(46, 232, 142,0.6), transparent)' }}
          />

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-8">
            <div>
              <div className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Total Portfolio Value
              </div>
              <div className="text-4xl md:text-5xl font-bold text-white">
                <CountUp to={128540} duration={2.4} prefix="$" separator />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-semibold" style={{ color: '#34D399' }}>
                  <CountUp to={14230} duration={2} prefix="+$" separator />
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>+12.4% this month</span>
              </div>
            </div>

            {/* AI Score */}
            <div
              className="flex items-center gap-4 p-4 rounded-2xl"
              style={{
                background: 'rgba(46, 232, 142,0.06)',
                border: '1px solid rgba(46, 232, 142,0.15)',
              }}
            >
              <div className="relative w-14 h-14">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(46, 232, 142,0.15)" strokeWidth="3" />
                  <motion.circle
                    cx="28"
                    cy="28"
                    r="22"
                    fill="none"
                    stroke="#2EE88E"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 22}`}
                    style={{ transformOrigin: '28px 28px', rotate: '-90deg' }}
                    initial={{ strokeDashoffset: `${2 * Math.PI * 22}` }}
                    whileInView={{ strokeDashoffset: `${2 * Math.PI * 22 * (1 - 87 / 100)}` }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, ease: 'easeOut', delay: 0.5 }}
                  />
                </svg>
                <div
                  className="absolute inset-0 flex items-center justify-center text-lg font-bold"
                  style={{ color: '#5FF3AB' }}
                >
                  <CountUp to={87} duration={2} />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  AI Portfolio Score
                </div>
                <div className="text-sm font-semibold text-white mt-0.5">Excellent</div>
                <div className="text-xs mt-0.5" style={{ color: '#34D399' }}>Top 8% globally</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <PortfolioChart />

          {/* Asset breakdown */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {assets.map((asset, i) => (
              <motion.div
                key={i}
                className="p-4 rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + i * 0.1 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white">{asset.name}</span>
                  <span className="text-xs font-semibold" style={{ color: asset.up ? '#34D399' : '#F87171' }}>
                    {asset.change}
                  </span>
                </div>
                <div className="text-base font-bold text-white mb-2">{asset.value}</div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: asset.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${asset.allocation}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: 0.7 + i * 0.1, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {asset.allocation}% allocation
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
