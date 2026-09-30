import type { SVGProps } from 'react'

type RwaLogoMarkProps = SVGProps<SVGSVGElement> & {
  label?: string
  primaryColor?: string
  accentColor?: string
}

/** Transparent RWA mark for product UI. The square PWA icon remains a separate asset. */
export default function RwaLogoMark({ label = 'RWA', primaryColor = 'currentColor', accentColor = 'var(--rwa-logo-accent)', ...props }: RwaLogoMarkProps) {
  const titleId = props.id ? `${props.id}-title` : undefined
  return (
    <svg {...props} viewBox="140 188 226 124" role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} aria-labelledby={titleId} focusable="false">
      {label && <title id={titleId}>{label}</title>}
      <path fill={primaryColor} d="M150 198h51l27.3 53.1-13.1 24.4c-2.8 5.2-7.2 8.1-12.5 8.1-6.1 0-11.4-3.6-14.3-9.2L150 198Z" />
      <path fill={primaryColor} d="m228.3 251.1 12.4-26.2c2.8-5.9 7.4-9.1 13.1-9.1 6.2 0 10.9 3.5 13.7 9.4L304 302h-51.2l-24.5-50.9Z" />
      <path fill={accentColor} d="M305.4 198H356l-25.9 51.9h-28.2c-5.3 0-9.5-2.2-12.2-6.3-2.8-4.2-3.1-8.9-.8-13.6l16.5-32Z" />
    </svg>
  )
}
