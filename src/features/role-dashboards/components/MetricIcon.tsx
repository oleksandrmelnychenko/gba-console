import { createElement } from 'react'
import type { LucideProps } from 'lucide-react'
import type { DashboardWorkspaceMetric } from '../types'
import { getMetricIcon } from '../utils/metricView'

export function MetricIcon({ metric, ...props }: LucideProps & { metric: DashboardWorkspaceMetric }) {
  return createElement(getMetricIcon(metric), props)
}
