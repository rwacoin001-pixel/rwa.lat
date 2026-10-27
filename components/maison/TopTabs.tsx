'use client'

import { motion, useReducedMotion } from 'framer-motion'
import styles from './TopTabs.module.css'

/** Palette A page menu: text tabs pinned under the status bar; the selected one is ink and bold with a sliding rule. */
export function TopTabs<T extends string>({ value, onChange, label, options }: { value: T; onChange: (value: T) => void; label: string; options: Array<{ value: T; label: string }> }) {
  const reduced = useReducedMotion()
  return <nav className={styles.tabs} aria-label={label}>
    <div role="tablist" aria-label={label}>
      {options.map((option) => <button key={option.value} type="button" role="tab" aria-selected={value === option.value} onClick={() => { if (value !== option.value) { navigator.vibrate?.(4); onChange(option.value); window.scrollTo({ top: 0 }) } }}>
        <span>{option.label}</span>
        {value === option.value && <motion.i layoutId={`top-tab-rule-${label}`} className={styles.rule} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }} />}
      </button>)}
    </div>
  </nav>
}

