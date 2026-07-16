'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import AnimatedBrand from './animated-brand'

const navLinks = [
  { label: 'Product', href: '#product' },
  { label: 'AI', href: '#ai' },
  { label: 'Markets', href: '#markets' },
  { label: 'Compute', href: '#compute' },
  { label: 'Signals', href: '#signals' },
  { label: 'Pricing', href: '#pricing' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 px-4"
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <nav
        className="flex items-center gap-1 px-3 py-2 transition-all duration-500"
        style={{
          background: scrolled
            ? 'rgba(5, 7, 13, 0.85)'
            : 'rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '9999px',
          boxShadow: scrolled
            ? '0 8px 32px rgba(0,0,0,0.5)'
            : '0 4px 24px rgba(0,0,0,0.3)',
        }}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <a
          href="#"
          className="mr-3 flex min-h-8 items-center px-3"
          aria-label="RWA.LAT home"
        >
          <AnimatedBrand compact />
        </a>

        {/* Divider */}
        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.15)' }} />

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3.5 py-1.5 text-xs font-medium transition-all duration-200 rounded-full"
              style={{ color: 'rgba(255,255,255,0.65)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.15)' }} />

        {/* Right actions */}
        <div className="flex items-center gap-1.5 ml-1">
          <a
            href="#login"
            className="hidden sm:block px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.65)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Login
          </a>
          <a
            href="#app"
            className="px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 whitespace-nowrap"
            style={{
              background: '#2EE88E',
              color: '#fff',
              boxShadow: '0 0 20px rgba(46, 232, 142,0.4)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0052CC'
              e.currentTarget.style.boxShadow = '0 0 30px rgba(46, 232, 142,0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#2EE88E'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(46, 232, 142,0.4)'
            }}
          >
            Download App
          </a>
        </div>
      </nav>
    </motion.header>
  )
}
