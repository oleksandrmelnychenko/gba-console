import { useEffect, useId, useRef, useState } from 'react'
import './analytics-controls.css'

export type AnalyticsSeriesPoint = { label: string; actual: number | null; forecast?: number | null }

const defaultFormat = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 2 })
const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

export function AnalyticsSeriesChart({ points, valueLabel, formatValue = defaultFormat, height = 220, emptyLabel = 'Немає даних' }: {
  points: AnalyticsSeriesPoint[]
  valueLabel: string
  formatValue?: (value: number) => string
  height?: number
  emptyLabel?: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [inspected, setInspected] = useState<number | null>(null)
  const [actualVisible, setActualVisible] = useState(true)
  const [forecastVisible, setForecastVisible] = useState(true)
  const descriptionId = useId()
  const values = points.flatMap((point) => [point.actual, point.forecast].filter(finite))
  const hasActual = points.some((point) => finite(point.actual))
  const hasForecast = points.some((point) => finite(point.forecast))
  const actualShown = hasActual && (actualVisible || !hasForecast)
  const forecastShown = hasForecast && (forecastVisible || !hasActual)
  const selectedIndex = Math.min(inspected ?? points.length - 1, points.length - 1)
  const selected = points[selectedIndex]
  const chartHeight = Math.max(140, height)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min || 1
  const top = 12
  const bottom = chartHeight - 32
  const left = Math.min(120, Math.max(48, ...[min, max].map((value) => formatValue(value).length * 7 + 12)))
  const right = width - 16
  const x = (index: number) => points.length <= 1 ? (left + right) / 2 : left + index * (right - left) / (points.length - 1)
  const y = (value: number) => bottom - (value - min) / span * (bottom - top)

  useEffect(() => {
    const element = container.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(240, entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function pathFor(series: 'actual' | 'forecast') {
    let previousWasValid = false
    return points.map((point, index) => {
      const value = point[series]
      if (!finite(value)) { previousWasValid = false; return '' }
      const previousActual = index > 0 ? points[index - 1].actual : null
      // Anchor a new forecast segment to an adjacent observation without
      // assigning that observation a forecast value or bridging missing data.
      const anchor = series === 'forecast' && !previousWasValid && finite(previousActual)
        ? `M${x(index - 1)},${y(previousActual)} L`
        : previousWasValid ? 'L' : 'M'
      const segment = `${anchor}${x(index)},${y(value)}`
      previousWasValid = true
      return segment
    }).join(' ')
  }

  return (
    <div ref={container} className="app-analytics-chart">
      {values.length === 0 ? <div className="app-analytics-chart-empty" style={{ minHeight: chartHeight }} role="status">{emptyLabel}</div> : <>
        <div className="app-analytics-chart-readout" aria-live="polite" aria-atomic="true">
          <span>{selected?.label}</span>
          <span className="app-analytics-chart-measure">{valueLabel}</span>
          {hasActual && <button type="button" className="app-analytics-series-value" aria-label="Факт" aria-pressed={actualShown} disabled={!forecastShown} onClick={() => setActualVisible((visible) => !visible)}><i aria-hidden="true" />Факт <strong>{finite(selected?.actual) ? formatValue(selected.actual) : '—'}</strong></button>}
          {hasForecast && <button type="button" className="app-analytics-series-value is-forecast" aria-label="Прогноз" aria-pressed={forecastShown} disabled={!actualShown} onClick={() => setForecastVisible((visible) => !visible)}><i aria-hidden="true" />Прогноз <strong>{finite(selected?.forecast) ? formatValue(selected.forecast) : '—'}</strong></button>}
        </div>
        <span id={descriptionId} className="app-analytics-sr-only">Стрілки ліворуч і праворуч — період, Home і End — початок і кінець. Тире означає відсутні дані.</span>
        <div
          className="app-analytics-chart-interaction"
          role="group"
          aria-label={`Графік: ${valueLabel}`}
          aria-describedby={descriptionId}
          tabIndex={0}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            setInspected(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1
              : Math.max(0, Math.min(points.length - 1, selectedIndex + (event.key === 'ArrowRight' ? 1 : -1))))
          }}
        >
          <svg
            width="100%" height={chartHeight} viewBox={`0 0 ${width} ${chartHeight}`}
            role="img" aria-label={`${valueLabel}: ${points.length} періодів`}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              if (!bounds.width) return
              const position = (event.clientX - bounds.left) * width / bounds.width
              setInspected(points.length <= 1 ? 0 : Math.max(0, Math.min(points.length - 1, Math.round((position - left) / (right - left) * (points.length - 1)))))
            }}
            onPointerLeave={() => setInspected(null)}
          >
            {[0, 0.5, 1].map((fraction) => {
              const value = min + span * fraction
              return <g key={fraction} className="app-analytics-chart-axis">
                <line x1={left} x2={right} y1={y(value)} y2={y(value)} />
                <text x={left - 8} y={y(value) + 4} textAnchor="end"><title>{formatValue(value)}</title>{formatValue(value).length > 14 ? value.toLocaleString('uk-UA', { notation: 'compact', maximumFractionDigits: 1 }) : formatValue(value)}</text>
              </g>
            })}
            {points.map((point, index) => {
              const stride = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((right - left) / 110))))
              if (index % stride !== 0 && index !== points.length - 1) return null
              if (index !== points.length - 1 && points.length - 1 - index < stride) return null
              const labelLimit = Math.max(8, Math.min(16, Math.floor((right - left) / 16)))
              return <text key={index} className="app-analytics-chart-period" x={x(index)} y={chartHeight - 10} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}><title>{point.label}</title>{point.label.length > labelLimit ? `${point.label.slice(0, labelLimit - 1)}…` : point.label}</text>
            })}
            {actualShown && <path className="app-analytics-chart-line" data-series="actual" d={pathFor('actual')} />}
            {forecastShown && <path className="app-analytics-chart-line is-forecast" data-series="forecast" d={pathFor('forecast')} />}
            {points.flatMap((point, index) => (['actual', 'forecast'] as const).map((series) => (series === 'actual' ? actualShown : forecastShown) && finite(point[series]) && <circle key={`${index}-${series}`} cx={x(index)} cy={y(point[series])} r={2.5} className={`app-analytics-chart-dot${series === 'forecast' ? ' is-forecast' : ''}`} />))}
            {selected && <line className="app-analytics-chart-cursor" x1={x(selectedIndex)} x2={x(selectedIndex)} y1={top} y2={bottom} />}
          </svg>
        </div>
      </>}
    </div>
  )
}
