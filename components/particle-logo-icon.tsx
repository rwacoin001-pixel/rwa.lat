type ParticleLogoIconProps = {
  className?: string
  label?: string
}

/**
 * Shared RWA particle mark used for the AI entry point.
 * The transparent WebM supplies the motion; the alpha PNG keeps the mark
 * visible on browsers that do not support transparent video.
 */
export default function ParticleLogoIcon({ className = '', label }: ParticleLogoIconProps) {
  const accessibility = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const }

  return (
    <span className={`particle-logo-icon ${className}`.trim()} {...accessibility}>
      <img
        className="particle-logo-icon__fallback"
        src="/media/ai-particle-icon/rwa-particle-icon-alpha-512.png"
        alt=""
        aria-hidden="true"
      />
      <video
        className="particle-logo-icon__motion"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/media/ai-particle-icon/rwa-particle-icon-alpha-512.png"
        aria-hidden="true"
      >
        <source src="/media/ai-particle-icon/rwa-particle-alpha.webm" type="video/webm" />
      </video>
    </span>
  )
}
