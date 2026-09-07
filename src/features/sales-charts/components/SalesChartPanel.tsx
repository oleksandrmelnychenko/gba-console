import { Text } from '@mantine/core'
import type { ReactNode } from 'react'

type SalesChartMetric = {
  label: string
  value: ReactNode
  money?: boolean
}

export function SalesChartPanel({
  title,
  metrics = [],
  children,
}: {
  title: string
  metrics?: SalesChartMetric[]
  children: ReactNode
}) {
  return (
    <section className="sales-chart-panel">
      <div className="sales-chart-panel__heading">
        <Text className="app-section-title" component="h2" fw={600} size="sm">
          {title}
        </Text>
        {metrics.length > 0 && (
          <dl className="sales-chart-metrics">
            {metrics.map((metric) => (
              <div className="sales-chart-metric" key={metric.label}>
                <dt>{metric.label}</dt>
                <dd className={metric.money ? 'app-money' : undefined}>{metric.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {children}
    </section>
  )
}

export function SalesChartEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="sales-chart-empty" role="status">
      <Text c="gray.7" fw={600} size="sm">{title}</Text>
      <Text c="gray.6" size="xs">{description}</Text>
    </div>
  )
}
