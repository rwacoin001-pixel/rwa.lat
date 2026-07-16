'use client'

import { motion } from 'framer-motion'
import { useRef, useEffect } from 'react'
import AnimatedBrand from './animated-brand'

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const setSize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    setSize()
    window.addEventListener('resize', setSize)

    interface Particle {
      x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number
    }
    const particles: Particle[] = []
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.6,
        size: 1 + Math.random() * 2,
        life: Math.random() * 100,
        maxLife: 80 + Math.random() * 60,
      })
    }

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.life++
        if (p.life > p.maxLife || p.y < 0) {
          p.x = Math.random() * canvas.width
          p.y = canvas.height + 10
          p.life = 0
        }
        const fade = Math.min(p.life / 20, 1) * Math.min(1, (p.maxLife - p.life) / 20)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(46, 232, 142,${0.4 * fade})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', setSize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}

const footerLinks = [
  { group: 'Product', links: ['AI Agents', 'Stock Intelligence', 'Compute', 'Signals', 'Portfolio'] },
  { group: 'Company', links: ['About', 'Careers', 'Blog', 'Press'] },
  { group: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Disclosures'] },
]

export default function CTASection() {
  return (
    <>
      {/* CTA */}
      <section
        id="pricing"
        className="relative py-32 px-4 overflow-hidden"
        aria-label="Call to action"
      >
        <ParticleField />

        {/* Blue radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 50% 60%, rgba(46, 232, 142,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Eyebrow */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8"
              style={{
                background: 'rgba(46, 232, 142,0.08)',
                border: '1px solid rgba(46, 232, 142,0.25)',
                color: '#5FF3AB',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#2EE88E', boxShadow: '0 0 8px #2EE88E' }}
              />
              The Future is Here
            </div>

            <h2
              className="text-balance font-bold leading-tight mb-6"
              style={{
                fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #6B7280 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              The future of investing is intelligent.
            </h2>

            <p
              className="text-base md:text-lg leading-relaxed mb-10 max-w-xl mx-auto"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Join thousands of investors already using RWA.LAT to make smarter,
              faster, and more confident investment decisions powered by AI.
            </p>

            {/* CTA button */}
            <motion.a
              href="#app"
              className="inline-flex items-center gap-3 px-10 py-4 text-base font-semibold rounded-full transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 0 60px rgba(46, 232, 142,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
              whileHover={{
                scale: 1.04,
                boxShadow: '0 0 80px rgba(46, 232, 142,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
              whileTap={{ scale: 0.98 }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: '#2EE88E', boxShadow: '0 0 10px #2EE88E' }}
              />
              Join RWA.LAT
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.a>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-6 mt-10 flex-wrap">
              {[
                { label: 'Active Users', value: '24K+' },
                { label: 'Assets Analyzed', value: '$2.4B+' },
                { label: 'AI Accuracy', value: '91.4%' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  className="text-center"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Giant brand wordmark */}
      <section
        className="relative overflow-hidden px-4 pt-10 pb-4 select-none"
        aria-hidden="true"
      >
        <motion.div
          className="max-w-[1600px] mx-auto flex items-center justify-center gap-[0.05em]"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-15%' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.img
            src="/media/brand/rwa-logo-v2.svg"
            alt=""
            aria-hidden="true"
            className="block h-auto"
            style={{
              width: 'clamp(12rem, 42vw, 42rem)',
              filter: 'drop-shadow(0 0 50px rgba(47,230,191,.14))',
            }}
          />
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative border-t px-6 py-14" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div>
              <div className="mb-3">
                <AnimatedBrand compact />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                AI-powered investment intelligence for the next generation of investors.
              </p>
            </div>
            {footerLinks.map((group) => (
              <div key={group.group}>
                <div className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {group.group}
                </div>
                <ul className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-xs transition-colors duration-200"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#fff' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t text-xs"
            style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }}
          >
            <span>© 2026 RWA.LAT. All rights reserved.</span>
            <span>Investment intelligence powered by artificial intelligence. Not financial advice.</span>
          </div>
        </div>
      </footer>
    </>
  )
}
