'use client'

import { Check, ChevronDown, Globe2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { localeOptions, useI18n } from '@/lib/i18n'

export default function LanguageMenu({ variant = 'compact', onChange }: { variant?: 'compact' | 'wide' | 'settings'; onChange?: (label: string) => void }) {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const active = localeOptions.find((item) => item.code === locale) ?? localeOptions[0]

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('rwa:catalog-overlay-open', close)
    return () => window.removeEventListener('rwa:catalog-overlay-open', close)
  }, [])

  const toggleMenu = () => {
    setOpen((value) => {
      if (!value) window.dispatchEvent(new CustomEvent('rwa:language-overlay-open'))
      return !value
    })
  }

  return (
    <div className={`language-control language-control--${variant} ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button className="language-control__trigger" type="button" aria-label={t('common.language')} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={toggleMenu}>
        <span className="language-control__icon"><Globe2 size={variant === 'compact' ? 17 : 19} strokeWidth={1.65} /></span>
        {variant !== 'compact' && <span className="language-control__copy"><b>{active.label}</b>{variant === 'settings' && <small>{t('common.language')}</small>}</span>}
        {variant !== 'compact' && <ChevronDown className="language-control__chevron" size={16} strokeWidth={1.7} />}
      </button>
      {open && (
        <div className="language-popover" id={menuId} role="menu" aria-label={t('common.language')}>
          <div className="language-popover__head"><span><Globe2 size={17} /></span><p><b>{t('common.language')}</b><small>{t('common.languagesCount')}</small></p></div>
          <div className="language-popover__list">
            {localeOptions.map((item) => (
              <button className={item.code === locale ? 'is-selected' : ''} type="button" role="menuitemradio" aria-checked={item.code === locale} key={item.code} onClick={() => { setLocale(item.code); setOpen(false); onChange?.(item.label) }}>
                <span><b>{item.label}</b><small>{item.code}</small></span><i>{item.code === locale && <Check size={14} strokeWidth={2.2} />}</i>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
