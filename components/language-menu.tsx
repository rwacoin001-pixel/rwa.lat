'use client'

import { Check, ChevronDown, Globe2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { localeOptions, useI18n } from '@/lib/i18n'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

// Source: https://ui.shadcn.com/docs/components/popover

export default function LanguageMenu({ variant = 'compact', onChange }: { variant?: 'compact' | 'wide' | 'settings'; onChange?: (label: string) => void }) {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const active = localeOptions.find((item) => item.code === locale) ?? localeOptions[0]

  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('rwa:catalog-overlay-open', close)
    window.addEventListener('rwa:theme-overlay-open', close)
    return () => {
      window.removeEventListener('rwa:catalog-overlay-open', close)
      window.removeEventListener('rwa:theme-overlay-open', close)
    }
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) window.dispatchEvent(new CustomEvent('rwa:language-overlay-open'))
  }

  return (
    <div className={`language-control language-control--${variant} ${open ? 'is-open' : ''}`}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger render={<Button variant="ghost" size={variant === 'compact' ? 'icon' : 'default'} className="language-control__trigger" aria-label={t('common.language')} title={t('common.language')} />}>
          <span className="language-control__icon"><Globe2 size={variant === 'compact' ? 18 : 19} strokeWidth={1.65} /></span>
          {variant !== 'compact' && <span className="language-control__copy"><b>{active.label}</b>{variant === 'settings' && <small>{t('common.language')}</small>}</span>}
          {variant !== 'compact' && <ChevronDown className="language-control__chevron" size={16} strokeWidth={1.7} />}
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className={`language-popover language-popover--${variant}`} role="menu" aria-label={t('common.language')}>
          <div className="language-popover__head"><span><Globe2 size={17} /></span><p><b>{t('common.language')}</b><small>{t('common.languagesCount')}</small></p></div>
          <div className="language-popover__list">
            {localeOptions.map((item) => (
              <Button variant="ghost" className={item.code === locale ? 'is-selected' : ''} type="button" role="menuitemradio" aria-checked={item.code === locale} key={item.code} onClick={() => { setLocale(item.code); setOpen(false); onChange?.(item.label) }}>
                <span><b>{item.label}</b><small>{item.code}</small></span><i>{item.code === locale && <Check size={14} strokeWidth={2.2} />}</i>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
