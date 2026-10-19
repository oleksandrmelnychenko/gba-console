import { Text } from '@mantine/core'
import { useId, type ReactNode } from 'react'
import './document-detail.css'

export function DocumentDetailLayout({
  actions,
  children,
  summary,
  variant = 'compact',
}: {
  actions?: ReactNode
  children: ReactNode
  summary: ReactNode
  variant?: 'default' | 'compact' | 'inventory'
}) {
  return (
    <div className={`document-detail-drawer${variant !== 'default' ? ' document-detail-drawer--compact' + (variant === 'inventory' ? ' inventory-document-detail' : '') : ''}`}>
      {variant !== 'default' ? (summary || actions ? <div className="document-detail-top">
        {summary}
        {actions ? <div className="document-detail-top__actions">{actions}</div> : null}
      </div> : null) : <>{summary}{actions}</>}
      <div className="document-detail-tree">{children}</div>
    </div>
  )
}

export function DocumentDetailSummary({
  eyebrow,
  meta,
  metrics,
  title,
  status,
}: {
  status?: ReactNode
  eyebrow: string
  meta?: ReactNode
  metrics: ReactNode
  title: string
}) {
  return (
    <section className="document-detail-summary">
      <div className="document-detail-summary__main">
        <span className="document-detail-eyebrow">{eyebrow}</span>
        <div className="document-detail-summary__identity"><Text className="document-detail-summary__title">{title}</Text>{status}</div>
        {meta ? <div className="document-detail-summary__meta">{meta}</div> : null}
      </div>
      <div className="document-detail-summary__metrics">{metrics}</div>
    </section>
  )
}

export function DocumentDetailMetric({
  label,
  suffix,
  tone,
  value,
}: {
  label: string
  suffix?: string
  tone?: 'danger'
  value: string
}) {
  return (
    <div className={`document-detail-metric${tone ? ` is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>
        {value}
        {suffix ? <em>{suffix}</em> : null}
      </strong>
    </div>
  )
}

export function DocumentDetailSection({
  children,
  stacked,
  subtitle,
  title,
}: {
  children: ReactNode
  stacked?: boolean
  subtitle?: ReactNode
  title: string
}) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="document-detail-section">
      <div className="document-detail-section__head">
        <span className="document-detail-section__title" id={titleId}>{title}</span>
        {subtitle ? <span className="document-detail-section__subtitle">{subtitle}</span> : null}
      </div>
      <div className={`document-detail-section__body${stacked ? ' is-stacked' : ''}`}>{children}</div>
    </section>
  )
}

export function DocumentDetailRow({
  label,
  mono,
  tone,
  value,
  wide,
}: {
  label: string
  mono?: boolean
  tone?: 'danger'
  value?: ReactNode
  wide?: boolean
}) {
  return (
    <div className={`document-detail-row${wide ? ' is-wide' : ''}`}>
      <span className="document-detail-row__label">{label}</span>
      <span className="document-detail-row__line" aria-hidden />
      <span className={`document-detail-row__value${mono ? ' app-money' : ''}${tone ? ` is-${tone}` : ''}`}>
        {value === '' || value == null ? '-' : value}
      </span>
    </div>
  )
}

export function DocumentDetailFlag({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`document-detail-flag${active ? ' is-active' : ''}`}>
      <span aria-hidden />
      {label}
    </span>
  )
}

/** Compact metadata for the approved document sheet pattern (UI patterns §7.3). */
export function DocumentDetailChip({ children, icon, tone = 'neutral' }: {
  children: ReactNode; icon?: ReactNode; tone?: 'neutral' | 'info' | 'document' | 'product' | 'source' | 'storage' | 'success' | 'danger' | 'warning'
}) {
  return <span className={`document-detail-chip is-${tone}`}>
    {icon ? <span className="document-detail-chip__icon" aria-hidden="true">{icon}</span> : null}{children}
  </span>
}
