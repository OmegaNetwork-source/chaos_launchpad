import { useState, useEffect, useCallback, useRef } from 'react'

interface MemeConfig {
  src: string
  caption: string
}

const MEME_CONFIGS: MemeConfig[] = [
  { src: '/memes/doge.gif', caption: 'Much wow!' },
  { src: '/memes/moon.gif', caption: 'TO THE MOON!' },
  { src: '/memes/rocket.gif', caption: 'LFG!' },
  { src: '/memes/fire.gif', caption: 'This is fine 🔥' },
  { src: '/memes/party.gif', caption: 'WAGMI!' },
  { src: '/memes/money.gif', caption: 'Making it rain!' },
  { src: '/memes/stonks.gif', caption: 'STONKS!' },
  { src: '/memes/wow.gif', caption: 'WOW!' },
]

type BubbleShape = 'burst' | 'cloud' | 'speech' | 'pow'

interface Popup {
  id: number
  meme: MemeConfig
  x: number
  y: number
  shape: BubbleShape
  color: string
  rotation: number
  scale: number
}

const COLORS = [
  '#00ffff',
  '#ff00ff',
  '#39ff14',
  '#ff1493',
  '#ffff00',
  '#ff6b35',
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
  const popupIdRef = useRef(0)

  const createPopup = useCallback(() => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const popup: Popup = {
      id: popupIdRef.current++,
      meme: getRandomItem(MEME_CONFIGS),
      x: Math.random() * (rect.width - 180) + 40,
      y: Math.random() * (rect.height - 140) + 40,
      shape: getRandomItem(['burst', 'cloud', 'speech', 'pow'] as BubbleShape[]),
      color: getRandomItem(COLORS),
      rotation: (Math.random() - 0.5) * 20,
      scale: 0.85 + Math.random() * 0.3,
    }

    setPopups(prev => [...prev.slice(-3), popup])
  }, [containerRef])

  useEffect(() => {
    if (!active) {
      setPopups([])
      return
    }

    setTimeout(() => createPopup(), 200)

    const spawnPopup = () => {
      if (!active) return
      createPopup()
      const nextDelay = 4000 + Math.random() * 4000
      setTimeout(spawnPopup, nextDelay)
    }

    const initialTimer = setTimeout(spawnPopup, 2000)
    return () => clearTimeout(initialTimer)
  }, [active, createPopup])

  useEffect(() => {
    if (popups.length === 0) return

    const timer = setTimeout(() => {
      setPopups(prev => prev.slice(1))
    }, 3000)

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
          <div className="chaos-popup-content">
            <img 
              src={popup.meme.src} 
              alt="" 
              className="chaos-popup-image"
              loading="eager"
            />
            <span className="chaos-popup-caption">{popup.meme.caption}</span>
          </div>
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

    const flashInterval = setInterval(() => {
      const numCards = 21
      const flashCount = 1 + Math.floor(Math.random() * 3)
      const newFlashes = new Set<number>()
      
      for (let i = 0; i < flashCount; i++) {
        newFlashes.add(Math.floor(Math.random() * numCards))
      }
      
      setFlashCards(newFlashes)
      
      setTimeout(() => setFlashCards(new Set()), 400)
    }, 600 + Math.random() * 800)

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
