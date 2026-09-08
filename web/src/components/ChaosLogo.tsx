interface ChaosLogoProps {
  size?: number
  className?: string
  blink?: boolean
  chaosMode?: boolean
}

/**
 * Chaos mark — eye with C-shaped sclera (the whitening forms the C).
 * Monochrome flat SVG. Set blink=true for idle blink animation.
 * Set chaosMode=true for neon glow effect.
 */
export function ChaosLogo({ size = 32, className = '', blink = false, chaosMode = false }: ChaosLogoProps) {
  const glowFilter = chaosMode ? 'url(#chaos-glow)' : undefined
  const strokeColor = chaosMode ? '#00ffff' : '#f5f5f7'
  const fillColor = chaosMode ? '#00ffff' : '#f5f5f7'
  const bgColor = chaosMode ? '#0a0a0a' : '#0a0a0a'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${blink ? 'chaos-logo-blink' : ''} ${chaosMode ? 'chaos-logo-glow' : ''}`}
      aria-hidden
    >
      {chaosMode && (
        <defs>
          <filter id="chaos-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      )}
      <rect width="32" height="32" rx="7.2" fill={bgColor} />
      {/* C-shaped sclera / eye outline (open on the right) */}
      <path
        d="M22.5 9.2A9 9 0 1 0 22.5 22.8"
        stroke={strokeColor}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
        filter={glowFilter}
      />
      {/* Iris */}
      <circle cx="14.5" cy="16" r="5.2" fill={fillColor} filter={glowFilter} />
      {/* Pupil */}
      <circle cx="14.5" cy="16" r="2.4" fill={bgColor} />
      {/* Eyelid for blink animation */}
      {blink && (
        <rect
          className="chaos-eyelid"
          x="4"
          y="6"
          width="20"
          height="20"
          rx="10"
          fill={bgColor}
        />
      )}
      {/* Catchlight */}
      <circle cx="16.2" cy="14.4" r="0.9" fill={bgColor} opacity="0" />
    </svg>
  )
}

export function ChaosLogoSimple({ size = 24, className = '', blink = false, chaosMode = false }: ChaosLogoProps) {
  return <ChaosLogo size={size} className={className} blink={blink} chaosMode={chaosMode} />
}

export function ChaosWordmark({ className = '' }: { className?: string }) {
  return <span className={`chaos-wordmark ${className}`}>Chaos</span>
}

export const FuseLogo = ChaosLogo
export const FuseLogoSimple = ChaosLogoSimple
export const FuseWordmark = ChaosWordmark
