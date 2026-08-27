import { Text } from '@mantine/core'
import { useId, type ReactNode } from 'react'
import './document-detail.css'

export function DocumentDetailLayout({
  actions,
  children,
  summary,
}: {
  actions?: ReactNode
  children: ReactNode
  summary: ReactNode
}) {
  return (
    <div className="document-detail-drawer">
      {summary}
      {actions}
      <div className="document-detail-tree">{children}</div>
    </div>
  )
}

export function DocumentDetailSummary({
  eyebrow,
  meta,
  metrics,
  title,
}: {
  eyebrow: string
  meta?: ReactNode
  metrics: ReactNode
  title: string
}) {
  return (
    <section className="document-detail-summary">
      <div className="document-detail-summary__main">
        <span className="document-detail-eyebrow">{eyebrow}</span>
        <Text className="document-detail-summary__title">{title}</Text>
        {meta ? <Text className="document-detail-summary__meta">{meta}</Text> : null}
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
  value?: string | number | null
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
