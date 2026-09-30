import type { ButtonHTMLAttributes } from 'react'
export function Sel({ state = 'rest', variant = 'chip', className = '', disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { state?: 'rest' | 'pressed' | 'selected' | 'disabled'; variant?: 'chip' | 'row' }) {
  return <button {...props} type={props.type ?? 'button'} disabled={disabled || state === 'disabled'} className={`rwa-sel ${className}`} data-variant={variant} data-state={disabled ? 'disabled' : state} aria-pressed={state === 'selected'} />
}
