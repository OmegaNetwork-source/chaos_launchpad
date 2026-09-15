import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, AreaSeries, CrosshairMode } from 'lightweight-charts'
import type { IChartApi, Time, ISeriesApi, SeriesType } from 'lightweight-charts'
import { Loader2 } from 'lucide-react'

export interface PriceDataPoint {
  time: number
  price: number
}

interface TooltipData {
  price: number
  time: number
  x: number
  y: number
}

interface PriceChartProps {
  tokenAddress?: string
  curveAddress?: string
  isSeed?: boolean
  priceHistory?: PriceDataPoint[]
  isLoading?: boolean
  className?: string
}

const formatPrice = (price: number): string => {
  if (price < 0.00000001) return price.toExponential(2)
  if (price < 0.0001) return price.toFixed(10)
  if (price < 1) return price.toFixed(6)
  return price.toFixed(2)
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PriceChart({
  isSeed,
  priceHistory = [],
  isLoading = false,
  className = '',
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

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
        mode: CrosshairMode.Magnet,
        vertLine: { color: 'rgba(255, 255, 255, 0.4)', width: 1, style: 0, labelVisible: false },
        horzLine: { color: 'rgba(255, 255, 255, 0.4)', width: 1, style: 0, labelVisible: true },
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
        formatter: formatPrice,
      },
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#22c55e',
      crosshairMarkerBackgroundColor: '#fff',
      crosshairMarkerBorderWidth: 2,
    })
    seriesRef.current = areaSeries

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

    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null)
        return
      }

      const seriesData = param.seriesData.get(areaSeries)
      if (!seriesData || !('value' in seriesData)) {
        setTooltip(null)
        return
      }

      const time = typeof param.time === 'number' ? param.time : Number(param.time)
      setTooltip({
        price: seriesData.value as number,
        time,
        x: param.point.x,
        y: param.point.y,
      })
    })

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
      seriesRef.current = null
      setTooltip(null)
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
          {tooltip ? (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[var(--text-secondary)] font-mono">{formatPrice(tooltip.price)}</span>
              <span className="text-[var(--text-muted)]">{formatTime(tooltip.time)}</span>
            </div>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)]">{priceHistory.length} trades</span>
          )}
        </div>
      </div>
      <div className="relative">
        <div ref={chartContainerRef} className="w-full cursor-crosshair" />
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10 px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border)] shadow-lg"
            style={{
              left: Math.min(tooltip.x + 12, (chartContainerRef.current?.clientWidth ?? 300) - 120),
              top: Math.max(tooltip.y - 40, 4),
            }}
          >
            <div className="text-xs font-mono text-[#22c55e] font-semibold">{formatPrice(tooltip.price)}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{formatTime(tooltip.time)}</div>
          </div>
        )}
      </div>
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
