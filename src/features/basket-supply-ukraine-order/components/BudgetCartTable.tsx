import { Badge, Divider, Group, Stack, Text, Tooltip } from '@mantine/core'
import { Info } from 'lucide-react'
import { Fragment } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ProcurementUrgency, ReorderSuggestion } from '../procurementTypes'

type DecisionSignal = {
  label: string
  pillClass: string
}

type BudgetCartTableProps = {
  firstDeferredIndex: number
  items: ReorderSuggestion[]
  producerNameById: Map<number, string>
}

const URGENCY_LABEL: Record<ProcurementUrgency, string> = {
  critical: 'Критична',
  high: 'Висока',
  normal: 'Звичайна',
  none: 'Достатньо',
}

const URGENCY_PILL_CLASS: Record<ProcurementUrgency, string> = {
  critical: 'app-role-pill is-red',
  high: 'app-role-pill is-orange',
  normal: 'app-role-pill is-yellow',
  none: 'app-role-pill is-gray',
}

const MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

const qtyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

const eurFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const densityFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const percentFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 1,
})

export function BudgetCartTable({
  firstDeferredIndex,
  items,
  producerNameById,
}: BudgetCartTableProps) {
  const { t } = useI18n()

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="budget-cart-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>{t('Виробник')}</th>
            <th style={{ textAlign: 'left' }}>{t('Товар')}</th>
            <th style={{ textAlign: 'left' }}>{t('Терміновість')}</th>
            <th style={{ textAlign: 'left' }}>{t('Квадрант')}</th>
            <th style={{ textAlign: 'right' }}>{t('Прогноз')}</th>
            <th style={{ textAlign: 'right' }}>{t('Залишок')}</th>
            <th style={{ textAlign: 'right' }}>{t('Рекомендовано')}</th>
            <th style={{ textAlign: 'right' }}>{`${t('Ціна')} (EUR)`}</th>
            <th style={{ textAlign: 'right' }}>{`${t('Маржа')} (EUR)`}</th>
            <th style={{ textAlign: 'right' }}>{`${t('Сума')} (EUR)`}</th>
            <th style={{ textAlign: 'right' }}>{t('Цінність/€')}</th>
            <th style={{ textAlign: 'left' }}>{t('AI сигнали')}</th>
            <th style={{ textAlign: 'center' }}>{t('Бюджет')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <Fragment key={`${item.producer_id}-${item.product_id}`}>
              {index === firstDeferredIndex && firstDeferredIndex > 0 && (
                <tr className="budget-cart-divider-row">
                  <td colSpan={13}>
                    <Divider label={t('Поза бюджетом')} labelPosition="center" my="xs" />
                  </td>
                </tr>
              )}
              <BudgetCartRow item={item} producerNameById={producerNameById} />
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BudgetCartRow({
  item,
  producerNameById,
}: {
  item: ReorderSuggestion
  producerNameById: Map<number, string>
}) {
  const { t } = useI18n()
  const deferred = item.within_budget === false
  const quadrant = quadrantLabel(item)
  const signals = buildDecisionSignals(item, t)

  return (
    <tr style={deferred ? { opacity: 0.7 } : undefined}>
      <td>
        <Text size="sm">{producerNameById.get(item.producer_id) || `#${item.producer_id}`}</Text>
      </td>
      <td>
        <Stack gap={1}>
          <Text fw={600} size="sm" style={MONO_STYLE}>#{item.product_id}</Text>
          <Text c="dimmed" size="xs">{item.forecast.method || t('історичний прогноз')}</Text>
        </Stack>
      </td>
      <td>
        <Badge className={URGENCY_PILL_CLASS[item.urgency]} size="sm" variant="light">
          {t(URGENCY_LABEL[item.urgency])}
        </Badge>
      </td>
      <td>
        {quadrant ? (
          <Badge className="app-role-pill" size="sm" variant="outline">
            {quadrant}
          </Badge>
        ) : (
          <Text c="dimmed" size="sm">
            -
          </Text>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <Stack align="end" gap={1}>
          <Text fw={600} size="sm">
            {qtyFormatter.format(item.forecast.forecast_units)}
          </Text>
          <Text c="dimmed" size="xs">
            {item.forecast.horizon_days > 0
              ? `${qtyFormatter.format(item.forecast.mean_daily)} / ${t('день')}, ${item.forecast.horizon_days}${t('д')}`
              : `${qtyFormatter.format(item.forecast.mean_daily)} / ${t('день')}`}
          </Text>
        </Stack>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Stack align="end" gap={1}>
          <Text fw={600} size="sm">
            {qtyFormatter.format(item.inventory.available)}
          </Text>
          <Text c="dimmed" size="xs">
            {t('на руках')}: {qtyFormatter.format(item.inventory.on_hand)}
          </Text>
        </Stack>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text fw={600} size="sm">
          {qtyFormatter.format(item.suggested_qty)}
        </Text>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text className="app-money" size="sm">{item.unit_cost_eur === null ? '' : eurFormatter.format(item.unit_cost_eur)}</Text>
      </td>
      <td style={{ textAlign: 'right' }}>
        {item.unit_margin_eur === null ? (
          <Text size="sm">-</Text>
        ) : (
          <Text className="app-money" fw={600} size="sm">
            {eurFormatter.format(item.unit_margin_eur)}
          </Text>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text className="app-money" size="sm">{item.line_cost_eur === null ? '' : eurFormatter.format(item.line_cost_eur)}</Text>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Text size="sm">{item.value_density === null ? '' : densityFormatter.format(item.value_density)}</Text>
      </td>
      <td>
        <Tooltip
          label={item.reason || t('AI зіставив прогноз попиту, залишки, точку дозамовлення і правила закупівлі')}
          multiline
          maw={360}
        >
          <Group className="budget-cart-signals" gap={4} wrap="wrap">
            {signals.map((signal) => (
              <Badge className={signal.pillClass} key={signal.label} size="xs" variant="light">
                {signal.label}
              </Badge>
            ))}
            <Badge className="app-role-pill is-gray" leftSection={<Info size={11} />} size="xs" variant="light">
              {t('причина')}
            </Badge>
          </Group>
        </Tooltip>
      </td>
      <td style={{ textAlign: 'center' }}>
        <Badge className={deferred ? 'app-role-pill is-gray' : 'app-role-pill is-green'} size="sm" variant="light">
          {deferred ? t('відкладено') : t('в бюджеті')}
        </Badge>
      </td>
    </tr>
  )
}

function buildDecisionSignals(item: ReorderSuggestion, t: (value: string) => string): DecisionSignal[] {
  const signals: DecisionSignal[] = []

  if (item.inventory.available <= item.reorder_point) {
    signals.push({ label: t('нижче точки'), pillClass: 'app-role-pill is-red' })
  }

  if (item.days_of_cover > 0) {
    signals.push({
      label: `${t('покриття')} ${qtyFormatter.format(item.days_of_cover)}${t('д')}`,
      pillClass: item.days_of_cover <= 14 ? 'app-role-pill is-orange' : 'app-role-pill is-gray',
    })
  }

  if (item.moq !== null && item.moq > 0) {
    signals.push({ label: `MOQ ${qtyFormatter.format(item.moq)}`, pillClass: 'app-role-pill' })
  }

  if (item.order_multiple !== null && item.order_multiple > 0) {
    signals.push({ label: `${t('кратно')} ${qtyFormatter.format(item.order_multiple)}`, pillClass: 'app-role-pill' })
  }

  if (item.applied_service_level !== null) {
    signals.push({
      label: `SL ${percentFormatter.format(item.applied_service_level * 100)}%`,
      pillClass: 'app-role-pill is-green',
    })
  }

  if (item.cheaper_alt) {
    signals.push({ label: t('є дешевший аналог'), pillClass: 'app-role-pill is-yellow' })
  }

  return signals.slice(0, 5)
}

function quadrantLabel(item: ReorderSuggestion): string {
  if (item.quadrant) {
    return item.quadrant
  }

  const abc = item.abc ?? ''
  const xyz = item.xyz ?? ''

  return `${abc}${xyz}`
}
