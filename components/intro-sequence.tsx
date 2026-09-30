'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import AnimatedBrand from './animated-brand'

const INTRO_MS = 2600

export default function IntroSequence() {
  const [show, setShow] = useState(true)
  // Mobile PWAs throttle timers while backgrounded, which used to leave body.overflow='hidden'
  // stuck forever (page could not be scrolled after returning). Remember the previous inline
  // value, release exactly once, and rescue the lock on lifecycle events.
  const previousOverflow = useRef<string | null>(null)
  const released = useRef(false)
  const startedAt = useRef(0)

  const releaseScroll = useCallback(() => {
    if (released.current) return
    released.current = true
    document.body.style.overflow = previousOverflow.current ?? ''
  }, [])

  useEffect(() => {
    previousOverflow.current = document.body.style.overflow || null
    startedAt.current = Date.now()
    document.body.style.overflow = 'hidden'

    const timer = setTimeout(() => {
      setShow(false)
      releaseScroll()
    }, INTRO_MS)

    // Returning from the background: if the intro has served its time, finish it now.
    const onResume = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - startedAt.current >= INTRO_MS) {
        setShow(false)
        releaseScroll()
      }
    }

    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('focus', onResume)
    window.addEventListener('pagehide', releaseScroll)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pagehide', releaseScroll)
      releaseScroll()
    }
  }, [releaseScroll])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: '#05070D' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        >
          {/* Core light that grows */}
          <motion.div
            className="absolute rounded-full"
            style={{ background: '#2EE88E' }}
            initial={{ width: 6, height: 6, opacity: 0, filter: 'blur(2px)' }}
            animate={{
              width: [6, 10, 8],
              height: [6, 10, 8],
              opacity: [0, 1, 1],
              boxShadow: [
                '0 0 20px 4px rgba(46, 232, 142,0.5)',
                '0 0 120px 30px rgba(46, 232, 142,0.9)',
                '0 0 200px 60px rgba(46, 232, 142,0.7)',
              ],
            }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          />

          {/* Expanding rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{ border: '1px solid rgba(46, 232, 142,0.4)' }}
              initial={{ width: 0, height: 0, opacity: 0 }}
              animate={{
                width: [0, 400 + i * 120],
                height: [0, 400 + i * 120],
                opacity: [0, 0.5, 0],
              }}
              transition={{
                duration: 2,
                delay: 0.6 + i * 0.25,
                ease: 'easeOut',
              }}
            />
          ))}

          {/* Brand mark */}
          <motion.div
            className="absolute bottom-[18%] flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: [0, 1, 1], y: 0 }}
            transition={{ duration: 1.2, delay: 1.2 }}
          >
            <AnimatedBrand markOnly />
            <div className="relative h-px w-32 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: '#2EE88E', boxShadow: '0 0 10px #2EE88E' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
            </div>
            <span
              className="text-[10px] tracking-[0.3em] uppercase"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Initializing Intelligence
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
