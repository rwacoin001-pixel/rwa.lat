import RwaLogoMark from './rwa-logo'

type ParticleLogoIconProps = { className?: string; label?: string }

/** The AI entry uses the shared A-REIT identity. */
export default function ParticleLogoIcon({ className = '', label }: ParticleLogoIconProps) {
  return <span className={('particle-logo-icon ' + className).trim()}>
    <RwaLogoMark className="particle-logo-icon__fallback" label={label || ''} width="100%" height="100%" />
  </span>
}
