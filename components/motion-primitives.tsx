'use client'

import { DUR, EASE, STAGGER, seconds, reduced } from '@/lib/motion'

import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  useAnimationFrame,
} from 'motion/react'
import {
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react'

/* ------------------------------------------------------------------ */
/*  WordReveal — word-by-word reveal (blur -> sharp, upward movement)  */
/* ------------------------------------------------------------------ */

interface WordRevealProps {
  text: string
  className?: string
  style?: CSSProperties
  delay?: number
  stagger?: number
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  once?: boolean
}

export function WordReveal({
  text,
  className,
  style,
  delay = 0,
  stagger = STAGGER.step,
  as = 'span',
  once = true,
}: WordRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once, margin: '-10% 0px' })
  const words = text.split(' ')
  const MotionTag = motion[as]

  // Extract text-appearance styles (gradient / fill) so they can be applied to
  // the inner word spans — background-clip:text must live on the element that
  // actually paints the glyphs, not an ancestor.
  const {
    background,
    backgroundImage,
    WebkitBackgroundClip,
    backgroundClip,
    WebkitTextFillColor,
    color,
    ...layoutStyle
  } = (style ?? {}) as CSSProperties & Record<string, unknown>

  const textStyle: CSSProperties = {
    background,
    backgroundImage,
    WebkitBackgroundClip,
    backgroundClip,
    WebkitTextFillColor,
    color,
  } as CSSProperties

  return (
    <MotionTag ref={ref as never} className={className} style={layoutStyle}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}
        >
          <motion.span
            style={{
              display: 'inline-block',
              willChange: 'transform, filter, opacity',
              ...textStyle,
            }}
            initial={{ y: '110%', opacity: 0, filter: 'blur(14px)' }}
            animate={
              inView
                ? { y: '0%', opacity: 1, filter: 'blur(0px)' }
                : { y: '110%', opacity: 0, filter: 'blur(14px)' }
            }
            transition={{
              duration: seconds(DUR.reveal),
              delay: reduced() ? 0 : delay + Math.min(i, STAGGER.max - 1) * stagger,
              ease: EASE.std,
            }}
          >
            {word}
            {i < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  )
}

/* ------------------------------------------------------------------ */
/*  MagneticButton — follows cursor, glow increases on hover           */
/* ------------------------------------------------------------------ */

interface MagneticButtonProps {
  children: ReactNode
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'ghost'
  className?: string
  strength?: number
}

export function MagneticButton({
  children,
  href,
  onClick,
  variant = 'primary',
  className = '',
  strength = 0.4,
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 200, damping: 15, mass: 0.3 })
  const sy = useSpring(y, { stiffness: 200, damping: 15, mass: 0.3 })
  const [hovered, setHovered] = useState(false)

  const handleMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || reduced()) return
    const relX = e.clientX - (rect.left + rect.width / 2)
    const relY = e.clientY - (rect.top + rect.height / 2)
    x.set(relX * strength)
    y.set(relY * strength)
  }

  const handleLeave = () => {
    x.set(0)
    y.set(0)
    setHovered(false)
  }

  const isPrimary = variant === 'primary'

  return (
    <motion.a
      ref={ref}
      href={href}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      style={{
        x: sx,
        y: sy,
        background: isPrimary ? '#2EE88E' : 'rgba(255,255,255,0.05)',
        color: isPrimary ? '#05140C' : 'rgba(255,255,255,0.85)',
        border: isPrimary ? 'none' : '1px solid rgba(255,255,255,0.14)',
        boxShadow: isPrimary
          ? hovered
            ? '0 0 60px rgba(46, 232, 142,0.75), 0 8px 32px rgba(0,0,0,0.4)'
            : '0 0 28px rgba(46, 232, 142,0.45), 0 4px 20px rgba(0,0,0,0.3)'
          : hovered
          ? '0 0 24px rgba(255,255,255,0.06)'
          : 'none',
        transition: 'box-shadow var(--dur-long) var(--ease-std), background var(--dur-long) var(--ease-std), color var(--dur-long) var(--ease-std)',
      }}
      className={`relative inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-full cursor-pointer overflow-hidden ${className}`}
    >
      {/* glass reflection sweep */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
        }}
        initial={{ x: '-120%' }}
        animate={hovered ? { x: '120%' } : { x: '-120%' }}
        transition={{ duration: seconds(DUR.long), ease: EASE.std }}
      />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </motion.a>
  )
}

/* ------------------------------------------------------------------ */
/*  CountUp — animate a number counting upward when in view            */
/* ------------------------------------------------------------------ */

interface CountUpProps {
  to: number
  from?: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
  style?: CSSProperties
  separator?: boolean
}

export function CountUp({
  to,
  from = 0,
  duration = DUR.reveal / 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  style,
  separator = false,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px' })
  const [value, setValue] = useState(from)
  const startRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useAnimationFrame((t) => {
    if (reduced()) { if (!doneRef.current) { setValue(to); doneRef.current = true }; return }
    if (!inView || doneRef.current) return
    if (startRef.current === null) startRef.current = t
    const elapsed = (t - startRef.current) / 1000
    const progress = Math.min(elapsed / duration, 1)
    // easeOutExpo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
    setValue(from + (to - from) * eased)
    if (progress >= 1) doneRef.current = true
  })

  const formatted = (() => {
    const fixed = value.toFixed(decimals)
    if (!separator) return fixed
    const [intPart, decPart] = fixed.split('.')
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return decPart ? `${withSep}.${decPart}` : withSep
  })()

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  TiltCard — 3D tilt on hover with dynamic glow border               */
/* ------------------------------------------------------------------ */

interface TiltCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  maxTilt?: number
  glow?: boolean
}

export function TiltCard({ children, className = '', style }: TiltCardProps) {
  return <div className={`rwa-card card-media ${className}`} style={style}>{children}</div>
}

/* ------------------------------------------------------------------ */
/*  Reveal — generic in-view reveal wrapper with stagger support       */
/* ------------------------------------------------------------------ */

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
  style?: CSSProperties
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 40,
  once = true,
  style,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once, margin: '-12% 0px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      animate={
        inView
          ? { opacity: 1, y: 0, filter: 'blur(0px)' }
          : { opacity: 0, y, filter: 'blur(8px)' }
      }
      transition={{ duration: seconds(DUR.base), delay: reduced() ? 0 : delay, ease: EASE.std }}
    >
      {children}
    </motion.div>
  )
}
