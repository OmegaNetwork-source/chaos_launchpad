import { useState, useEffect, useCallback } from 'react'

const MEME_PHRASES = [
  'WAGMI',
  'LFG!',
  'TO THE MOON',
  'HODL',
  'NGMI',
  'SER',
  'DEGEN',
  'APE IN',
  'GG',
  'BULLISH',
  'PUMP IT',
  'NO CAP',
  'BASED',
  'FOMO',
  'MOON SOON',
  'CHAD',
  'DIAMOND HANDS',
  'LETS GO',
  'SENDING IT',
  'FULL SEND',
  'VIBE CHECK',
  'BIG BRAIN',
  'YEET',
  'HUGE',
  'WEN LAMBO',
  'BRUH',
  'SHEESH',
  'HYPE',
  'SMASH',
  'BOOM',
  'POW',
  'ZAP',
  'WHAM',
  'ZOOM',
]

type BubbleShape = 'burst' | 'cloud' | 'speech' | 'pow'

interface Popup {
  id: number
  text: string
  x: number
  y: number
  shape: BubbleShape
  color: string
  rotation: number
  scale: number
}

const COLORS = [
  '#00ffff', // cyan
  '#ff00ff', // magenta
  '#39ff14', // green
  '#ff1493', // pink
  '#ffff00', // yellow
  '#ff6b35', // orange
]

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface ChaosMemePopupProps {
  active: boolean
  containerRef: React.RefObject<HTMLElement | null>
}

export function ChaosMemePopup({ active, containerRef }: ChaosMemePopupProps) {
  const [popups, setPopups] = useState<Popup[]>([])
  const popupIdRef = { current: 0 }

  const createPopup = useCallback(() => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const popup: Popup = {
      id: popupIdRef.current++,
      text: getRandomItem(MEME_PHRASES),
      x: Math.random() * (rect.width - 120) + 20,
      y: Math.random() * (rect.height - 80) + 20,
      shape: getRandomItem(['burst', 'cloud', 'speech', 'pow'] as BubbleShape[]),
      color: getRandomItem(COLORS),
      rotation: (Math.random() - 0.5) * 30,
      scale: 0.8 + Math.random() * 0.4,
    }

    setPopups(prev => [...prev.slice(-4), popup]) // Keep max 5 popups
  }, [containerRef])

  useEffect(() => {
    if (!active) {
      setPopups([])
      return
    }

    // Initial burst of popups
    setTimeout(() => createPopup(), 100)
    setTimeout(() => createPopup(), 400)

    // Continue spawning popups at random intervals
    const spawnPopup = () => {
      if (!active) return
      createPopup()
      const nextDelay = 800 + Math.random() * 1500 // 0.8-2.3 seconds
      setTimeout(spawnPopup, nextDelay)
    }

    const initialTimer = setTimeout(spawnPopup, 1000)
    return () => clearTimeout(initialTimer)
  }, [active, createPopup])

  // Remove popups after animation
  useEffect(() => {
    if (popups.length === 0) return

    const timer = setTimeout(() => {
      setPopups(prev => prev.slice(1))
    }, 1200)

    return () => clearTimeout(timer)
  }, [popups])

  if (!active || popups.length === 0) return null

  return (
    <div className="chaos-popup-container">
      {popups.map(popup => (
        <div
          key={popup.id}
          className={`chaos-popup chaos-popup-${popup.shape}`}
          style={{
            left: popup.x,
            top: popup.y,
            '--popup-color': popup.color,
            '--popup-rotation': `${popup.rotation}deg`,
            '--popup-scale': popup.scale,
          } as React.CSSProperties}
        >
          <span className="chaos-popup-text">{popup.text}</span>
        </div>
      ))}
    </div>
  )
}

export function ChaosFlashOverlay({ active }: { active: boolean }) {
  const [flashCards, setFlashCards] = useState<Set<number>>(new Set())
  const [highlightIndex, setHighlightIndex] = useState(-1)

  useEffect(() => {
    if (!active) {
      setFlashCards(new Set())
      setHighlightIndex(-1)
      return
    }

    // Random card flashes
    const flashInterval = setInterval(() => {
      const numCards = 21 // PAGE_SIZE
      const flashCount = 1 + Math.floor(Math.random() * 3) // Flash 1-3 cards
      const newFlashes = new Set<number>()
      
      for (let i = 0; i < flashCount; i++) {
        newFlashes.add(Math.floor(Math.random() * numCards))
      }
      
      setFlashCards(newFlashes)
      
      // Clear flashes after animation
      setTimeout(() => setFlashCards(new Set()), 400)
    }, 600 + Math.random() * 800)

    // Cycling highlight that sweeps through cards
    const cycleInterval = setInterval(() => {
      setHighlightIndex(prev => {
        const next = prev + 1
        return next >= 21 ? -1 : next
      })
    }, 150)

    return () => {
      clearInterval(flashInterval)
      clearInterval(cycleInterval)
    }
  }, [active])

  return { flashCards, highlightIndex }
}
