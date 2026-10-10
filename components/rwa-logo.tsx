import type { SVGProps } from 'react'

type RwaLogoMarkProps = SVGProps<SVGSVGElement> & {
  label?: string
  primaryColor?: string
  accentColor?: string
}

/** A-REIT folded portal mark. The compatibility name keeps existing imports stable. */
export default function RwaLogoMark({ label = 'A-REIT', primaryColor = 'currentColor', accentColor = '#19C7AA', ...props }: RwaLogoMarkProps) {
  const titleId = props.id ? `${props.id}-title` : undefined
  return (
    <svg {...props} viewBox="0 0 500 280" role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} aria-label={titleId ? undefined : label || undefined} aria-labelledby={titleId} focusable="false">
      {label && <title id={titleId}>{label}</title>}
      <g transform="translate(126 0)">
        <path pathLength={1} fill={primaryColor} d="M4 78Q4 69 13 65L139 8Q146 5 153 8L213 37Q222 42 222 53V144L154 113V71L77 106V199Q77 207 70 211L16 242Q4 248 4 235Z" />
        <path pathLength={1} fill={accentColor} data-accent="" d="M113 95L238 152Q247 156 247 167V258Q247 270 236 265L121 213Q113 210 113 199Z" />
      </g>
    </svg>
  )
}
