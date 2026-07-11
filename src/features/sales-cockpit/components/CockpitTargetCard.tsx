import { Badge, Card, SimpleGrid, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CockpitTarget, HeadPaceStatus } from '../types'

// Pace status → shared outlined-pill variant (docs/ui-patterns.md §4);
// "on" keeps the default blue pill.
const PACE_PILL: Record<HeadPaceStatus, string> = {
  ahead: 'is-green',
  on: '',
  behind: 'is-red',
  no_target: 'is-gray',
}

const PACE_LABEL: Record<HeadPaceStatus, string> = {
  ahead: 'Випереджає',
  on: 'У графіку',
  behind: 'Відстає',
  no_target: 'Немає цілі',
}

// Maps a pace status to the metric tile's left-accent variant in sales-cockpit-page.css.
const PACE_ACCENT: Record<HeadPaceStatus, string> = {
  ahead: 'success',
  on: 'info',
  behind: 'danger',
  no_target: 'neutral',
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

export function CockpitTargetCard({ target }: { target: CockpitTarget }) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card" withBorder radius="md">
      <Stack gap="sm">
        <Text className="app-section-title" fw={600} size="sm">
          {t('Моя ціль (місяць)')}
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TargetMetric label={t('Відвантаження')} metric={target.shipped} t={t} />
          <TargetMetric label={t('Оплати')} metric={target.paid} t={t} />
        </SimpleGrid>
      </Stack>
    </Card>
  )
}

function TargetMetric({
  label,
  metric,
  t,
}: {
  label: string
  metric: CockpitTarget['shipped']
  t: (key: string) => string
}) {
  return (
    <div className={`cockpit-metric is-${PACE_ACCENT[metric.pace_status]}`}>
      <div className="cockpit-metric-head">
        <span className="cockpit-metric-label">{label}</span>
        <Badge className={`app-role-pill ${PACE_PILL[metric.pace_status]}`.trim()} size="sm" variant="light">
          {t(PACE_LABEL[metric.pace_status])}
        </Badge>
      </div>
      <div className="cockpit-target-row">
        <span className="cockpit-metric-value">{formatMoney(metric.mtd)}</span>
        <span className="cockpit-target-of">
          / {formatMoney(metric.target)} · {formatPercent(metric.attainment_pct)}
        </span>
      </div>
      <span className="cockpit-metric-sub">
        {t('Сьогодні потрібно')}: <span className="app-money">{formatMoney(metric.today_needed)}</span>
      </span>
    </div>
  )
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${value}%`
}
