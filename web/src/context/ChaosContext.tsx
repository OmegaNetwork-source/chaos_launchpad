import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

interface ChaosContextValue {
  isChaosMode: boolean
  toggleChaosMode: () => void
  enableChaosMode: () => void
  disableChaosMode: () => void
}

const ChaosContext = createContext<ChaosContextValue | undefined>(undefined)

const STORAGE_KEY = 'chaos-mode-enabled'

export function ChaosProvider({ children }: { children: ReactNode }) {
  const [isChaosMode, setIsChaosMode] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, isChaosMode ? 'true' : 'false')
    } catch {
      // localStorage unavailable
    }
  }, [isChaosMode])

  useEffect(() => {
    if (isChaosMode) {
      document.body.classList.add('chaos-mode')
    } else {
      document.body.classList.remove('chaos-mode')
    }
    return () => {
      document.body.classList.remove('chaos-mode')
    }
  }, [isChaosMode])

  const toggleChaosMode = useCallback(() => {
    setIsChaosMode(prev => !prev)
  }, [])

  const enableChaosMode = useCallback(() => {
    setIsChaosMode(true)
  }, [])

  const disableChaosMode = useCallback(() => {
    setIsChaosMode(false)
  }, [])

  return (
    <ChaosContext.Provider value={{ isChaosMode, toggleChaosMode, enableChaosMode, disableChaosMode }}>
      {children}
    </ChaosContext.Provider>
  )
}

export function useChaos() {
  const context = useContext(ChaosContext)
  if (!context) {
    throw new Error('useChaos must be used within a ChaosProvider')
  }
  return context
}
