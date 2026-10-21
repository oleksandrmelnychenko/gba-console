import type { ReactNode } from 'react'
import './analytics-controls.css'

export type AnalyticsTabItem = {
  value: string
  label: string
  icon?: ReactNode
  valueLabel?: ReactNode
}

export function AnalyticsTabs({ label, value, onChange, items }: {
  label: string
  value: string
  onChange: (value: string) => void
  items: AnalyticsTabItem[]
}) {
  return (
    <div className="app-analytics-tabs" role="group" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={item.value === value}
          className={`app-analytics-tab${item.valueLabel != null ? ' is-metric' : ''}`}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            if (!direction && event.key !== 'Home' && event.key !== 'End') return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
              : (index + direction + items.length) % items.length
            onChange(items[next].value)
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
          }}
        >
          <span className="app-analytics-tab-label">
            {item.icon && <span aria-hidden="true" className="app-analytics-tab-icon">{item.icon}</span>}
            {item.label}
          </span>
          {item.valueLabel != null && <> <span className="app-analytics-tab-value">{item.valueLabel}</span></>}
        </button>
      ))}
    </div>
  )
}
