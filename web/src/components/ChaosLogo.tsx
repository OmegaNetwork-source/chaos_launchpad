interface ChaosLogoProps {
  size?: number
  className?: string
}

/**
 * Chaos mark — eye with C-shaped sclera (the whitening forms the C).
 * Monochrome flat SVG.
 */
export function ChaosLogo({ size = 32, className = '' }: ChaosLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="7.2" fill="#0a0a0a" />
      {/* C-shaped sclera / eye outline (open on the right) */}
      <path
        d="M22.5 9.2A9 9 0 1 0 22.5 22.8"
        stroke="#f5f5f7"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Iris */}
      <circle cx="14.5" cy="16" r="5.2" fill="#f5f5f7" />
      {/* Pupil */}
      <circle cx="14.5" cy="16" r="2.4" fill="#0a0a0a" />
      {/* Catchlight */}
      <circle cx="16.2" cy="14.4" r="0.9" fill="#0a0a0a" opacity="0" />
    </svg>
  )
}

export function ChaosLogoSimple({ size = 24, className = '' }: ChaosLogoProps) {
  return <ChaosLogo size={size} className={className} />
}

export function ChaosWordmark({ className = '' }: { className?: string }) {
  return <span className={`chaos-wordmark ${className}`}>Chaos</span>
}

export const FuseLogo = ChaosLogo
export const FuseLogoSimple = ChaosLogoSimple
export const FuseWordmark = ChaosWordmark
