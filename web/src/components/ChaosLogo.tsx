interface ChaosLogoProps {
  size?: number
  className?: string
  blink?: boolean
  chaosMode?: boolean
}

/**
 * Chaos mark — eye with C-shaped sclera (the whitening forms the C).
 * Monochrome flat SVG. Set blink=true for idle blink animation.
 * Set chaosMode=true for neon glow + animated look-around pupil.
 */
export function ChaosLogo({ size = 32, className = '', blink = false, chaosMode = false }: ChaosLogoProps) {
  const glowFilter = chaosMode ? 'url(#chaos-glow)' : undefined
  const strokeColor = chaosMode ? '#00ffff' : '#f5f5f7'
  const fillColor = chaosMode ? '#00ffff' : '#f5f5f7'
  const bgColor = chaosMode ? '#0a0a0a' : '#0a0a0a'
  
  const uniqueId = `chaos-logo-${Math.random().toString(36).slice(2, 9)}`
  const glowId = `${uniqueId}-glow`
  const pupilAnimId = `${uniqueId}-pupil`
  const irisAnimId = `${uniqueId}-iris`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${blink ? 'chaos-logo-blink' : ''} ${chaosMode ? 'chaos-logo-glow chaos-logo-active' : ''}`}
      aria-hidden
    >
      <defs>
        {chaosMode && (
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        )}
      </defs>
      <rect width="32" height="32" rx="7.2" fill={bgColor} />
      {/* C-shaped sclera / eye outline (open on the right) */}
      <path
        d="M22.5 9.2A9 9 0 1 0 22.5 22.8"
        stroke={strokeColor}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
        filter={chaosMode ? `url(#${glowId})` : undefined}
      />
      {/* Iris - moves with pupil in chaos mode */}
      <circle 
        cx="14.5" 
        cy="16" 
        r="5.2" 
        fill={fillColor} 
        filter={chaosMode ? `url(#${glowId})` : undefined}
        className={chaosMode ? 'chaos-iris' : ''}
      >
        {chaosMode && (
          <animate
            id={irisAnimId}
            attributeName="cx"
            values="14.5;16;14.5;12.5;14.5;15;14.5;13.5;14.5"
            keyTimes="0;0.12;0.24;0.36;0.48;0.6;0.72;0.84;1"
            dur="3.5s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
          />
        )}
      </circle>
      {/* Pupil - looks around in chaos mode */}
      <circle 
        cx="14.5" 
        cy="16" 
        r="2.4" 
        fill={bgColor}
        className={chaosMode ? 'chaos-pupil' : ''}
      >
        {chaosMode && (
          <>
            {/* Horizontal look-around */}
            <animate
              id={pupilAnimId}
              attributeName="cx"
              values="14.5;16.5;14.5;12;14.5;15.5;14.5;13;14.5"
              keyTimes="0;0.12;0.24;0.36;0.48;0.6;0.72;0.84;1"
              dur="3.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
            />
            {/* Vertical subtle movement */}
            <animate
              attributeName="cy"
              values="16;15.5;16;16.5;16;15.2;16;16.3;16"
              keyTimes="0;0.12;0.24;0.36;0.48;0.6;0.72;0.84;1"
              dur="3.5s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
            />
          </>
        )}
      </circle>
      {/* Eyelid for blink animation - enhanced in chaos mode */}
      {(blink || chaosMode) && (
        <rect
          className={`chaos-eyelid ${chaosMode ? 'chaos-eyelid-active' : ''}`}
          x="4"
          y="6"
          width="20"
          height="20"
          rx="10"
          fill={bgColor}
        />
      )}
      {/* Catchlight - visible in chaos mode */}
      <circle 
        cx="16.2" 
        cy="14.4" 
        r="0.9" 
        fill={chaosMode ? '#ffffff' : bgColor} 
        opacity={chaosMode ? '0.6' : '0'}
        className={chaosMode ? 'chaos-catchlight' : ''}
      >
        {chaosMode && (
          <animate
            attributeName="cx"
            values="16.2;17.8;16.2;14.2;16.2;17;16.2;15;16.2"
            keyTimes="0;0.12;0.24;0.36;0.48;0.6;0.72;0.84;1"
            dur="3.5s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
          />
        )}
      </circle>
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
