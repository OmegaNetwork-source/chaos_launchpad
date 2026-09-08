import { useEffect, useRef } from 'react'
import { createChart, ColorType, AreaSeries, CrosshairMode } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'
import { Loader2 } from 'lucide-react'

export interface PriceDataPoint {
  time: number
  price: number
}

interface PriceChartProps {
  tokenAddress?: string
  curveAddress?: string
  isSeed?: boolean
  priceHistory?: PriceDataPoint[]
  isLoading?: boolean
  className?: string
}

export function PriceChart({
  isSeed,
  priceHistory = [],
  isLoading = false,
  className = '',
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current || isLoading || priceHistory.length === 0 || isSeed) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b8b8b',
        fontSize: 10,
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255, 255, 255, 0.2)', width: 1, style: 2 },
        horzLine: { color: 'rgba(255, 255, 255, 0.2)', width: 1, style: 2 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        minBarSpacing: 2,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      kineticScroll: { mouse: true, touch: true },
    })

    chartRef.current = chart

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#22c55e',
      topColor: 'rgba(34, 197, 94, 0.3)',
      bottomColor: 'rgba(34, 197, 94, 0.02)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => {
          if (price < 0.00000001) return price.toExponential(2)
          if (price < 0.0001) return price.toFixed(10)
          if (price < 1) return price.toFixed(6)
          return price.toFixed(2)
        },
      },
    })

    const chartData = priceHistory.map((d) => ({
      time: d.time as Time,
      value: d.price,
    }))

    // Avoid degenerate scale with a single point — still allow pan/zoom
    if (chartData.length === 1) {
      const only = chartData[0]
      const t = typeof only.time === 'number' ? only.time : Number(only.time)
      chartData.push({ time: (t + 1) as Time, value: only.value })
    }

    areaSeries.setData(chartData)
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [priceHistory, isLoading, isSeed])

  if (isSeed) {
    return (
      <div className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden ${className}`}>
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <span className="text-xs font-medium text-[var(--text-tertiary)]">Price chart</span>
        </div>
        <div className="h-[200px] flex items-center justify-center text-xs text-[var(--text-muted)]">
          Chart available for real tokens
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden ${className}`}>
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <span className="text-xs font-medium text-[var(--text-tertiary)]">Price chart</span>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-[var(--text-tertiary)] animate-spin" />
        </div>
      </div>
    )
  }

  if (priceHistory.length === 0) {
    return (
      <div className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden ${className}`}>
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <span className="text-xs font-medium text-[var(--text-tertiary)]">Price chart</span>
        </div>
        <div className="h-[200px] flex items-center justify-center text-sm text-[var(--text-muted)]">
          No trades yet
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden ${className}`}>
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-tertiary)]">Price chart</span>
          <span className="text-[10px] text-[var(--text-muted)]">{priceHistory.length} trades</span>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full cursor-grab active:cursor-grabbing touch-none" style={{ touchAction: 'none' }} />
    </div>
  )
}

export function SparklineChart({
  data,
  width = 80,
  height = 24,
  positive = true,
}: {
  data: number[]
  width?: number
  height?: number
  positive?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length < 2) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const points = data.map((value, i) => ({
      x: (i / (data.length - 1)) * width,
      y: height - ((value - min) / range) * (height - 4) - 2,
    }))

    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    if (positive) {
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)')
      gradient.addColorStop(1, 'rgba(34, 197, 94, 0)')
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)')
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
    }

    ctx.beginPath()
    ctx.moveTo(points[0].x, height)
    points.forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.lineTo(points[points.length - 1].x, height)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    points.forEach((p) => ctx.lineTo(p.x, p.y))
    ctx.strokeStyle = positive ? '#22c55e' : '#ef4444'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [data, width, height, positive])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height }}
      className="opacity-80"
    />
  )
}
