import { formatUnitCost } from '../procurementMoneyFormat'
import { Badge, Group, Stack, Text } from '@mantine/core'
import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { buildReorderExplanation } from '../procurementOrderQty'
import { procurementQuantityFormat as qtyFormatter } from '../procurementQuantityFormat'
import type { ProcurementUrgency, ReorderSuggestion } from '../procurementTypes'
import { ProcurementCostBadge, ProcurementCostProof } from './ProcurementCostProof'
import { ProcurementProductCell } from './ProcurementProductCell'

type DecisionSignal = {
  label: string
  pillClass: string
}

type BudgetCartTableProps = {
  items: ReorderSuggestion[]
  maxHeight?: string
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

export function BudgetCartTable({ items, maxHeight = 'calc(100vh - 300px)', producerNameById }: BudgetCartTableProps) {
  const { t } = useI18n()
  const columns = useMemo(() => buildColumns(t, producerNameById), [producerNameById, t])

  return (
    <DataTable
      columns={columns}
      data={items}
      defaultLayout={{
        columnPinning: { left: ['product'], right: ['budget'] },
        columnVisibility: {
          forecast: false,
          quadrant: false,
          budgetPriority: false,
        },
        density: 'normal',
      }}
      distributeAvailableWidth
      emptyText={t('Немає позицій')}
      getRowId={(item) => `${item.producer_id}-${item.product_id}`}
      layoutVersion="budget-cart-plan-cost-proof-3"
      maxHeight={maxHeight}
      minWidth={1520}
      showLayoutControls
      showToolbar={false}
      tableId="budget-cart-plan"
    />
  )
}

function buildColumns(
  t: (value: string) => string,
  producerNameById: Map<number, string>,
): DataTableColumn<ReorderSuggestion>[] {
  return [
    {
      id: 'producer',
      header: t('Виробник'),
      width: 210,
      minWidth: 170,
      accessor: (item) => producerNameById.get(item.producer_id) || String(item.producer_id),
      cell: (item) => (
        <Text c="gray.8" fw={600} size="sm">
          {producerNameById.get(item.producer_id) || item.producer_id}
        </Text>
      ),
    },
    {
      id: 'product',
      header: t('Товар'),
      width: 320,
      minWidth: 260,
      accessor: (item) => item.product_id,
      cell: (item) => <ProcurementProductCell row={item} t={t} />,
      fill: true,
    },
    {
      id: 'urgency',
      header: t('Терміновість'),
      width: 118,
      minWidth: 104,
      accessor: (item) => item.urgency,
      cell: (item) => (
        <Badge className={URGENCY_PILL_CLASS[item.urgency]} size="sm" variant="light">
          {t(URGENCY_LABEL[item.urgency])}
        </Badge>
      ),
    },
    {
      id: 'quadrant',
      header: t('Квадрант'),
      width: 104,
      minWidth: 92,
      accessor: (item) => quadrantLabel(item),
      cell: (item) => {
        const quadrant = quadrantLabel(item)

        return quadrant ? (
          <Badge className="app-role-pill" size="sm" variant="outline">
            {quadrant}
          </Badge>
        ) : (
          <span aria-hidden="true" />
        )
      },
    },
    {
      id: 'forecast',
      header: t('Прогноз'),
      width: 132,
      minWidth: 116,
      align: 'right',
      accessor: (item) => item.forecast.forecast_units,
      cell: (item) => (
        <Stack align="end" gap={1}>
          <Text className="app-money" size="sm">
            {qtyFormatter.format(item.forecast.forecast_units)}
          </Text>
          <Text c="gray.8" size="xs" style={MONO_STYLE}>
            {item.forecast.horizon_days > 0
              ? `${qtyFormatter.format(item.forecast.mean_daily)} / ${t('день')}, ${item.forecast.horizon_days} ${t('дн.')}`
              : `${qtyFormatter.format(item.forecast.mean_daily)} / ${t('день')}`}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'available',
      header: t('Залишок'),
      width: 132,
      minWidth: 112,
      align: 'right',
      accessor: (item) => item.inventory.available,
      cell: (item) => (
        <Stack align="end" gap={1}>
          <Text className="app-money" size="sm">
            {qtyFormatter.format(item.inventory.available)}
          </Text>
          <Text c="gray.8" size="xs" style={MONO_STYLE}>
            {t('В наявності')}: {qtyFormatter.format(item.inventory.on_hand)}
          </Text>
        </Stack>
      ),
    },
    {
      id: 'suggestedQty',
      header: t('Рекомендовано'),
      width: 128,
      minWidth: 112,
      align: 'right',
      accessor: (item) => item.suggested_qty,
      cell: (item) => (
        <Text
          className="app-money"
          size="sm"
        >
          {qtyFormatter.format(item.suggested_qty)}
        </Text>
      ),
    },
    {
      id: 'unitCost',
      header: `${t('Оцінка одиниці')} (EUR)`,
      width: 110,
      minWidth: 96,
      align: 'right',
      accessor: (item) => item.unit_cost_eur,
      cell: (item) => (
        <Text className="app-money" size="sm">
          {item.unit_cost_eur === null ? '' : formatUnitCost(item.unit_cost_eur)}
        </Text>
      ),
    },
    {
      id: 'lineCost',
      header: `${t('Оцінка рядка')} (EUR)`,
      width: 118,
      minWidth: 104,
      align: 'right',
      accessor: (item) => item.line_cost_eur,
      cell: (item) => (
        <Text className="app-money" size="sm">
          {item.line_cost_eur === null ? '' : eurFormatter.format(item.line_cost_eur)}
        </Text>
      ),
    },
    {
      id: 'budgetPriority',
      header: t('Вага терміновості'),
      width: 104,
      minWidth: 92,
      align: 'right',
      accessor: (item) => item.budget_priority_weight,
      cell: (item) => (
        <Text className="app-money" size="sm">
          {densityFormatter.format(item.budget_priority_weight)}
        </Text>
      ),
    },
    {
      id: 'signals',
      header: t('AI-сигнали'),
      width: 270,
      minWidth: 220,
      enableSorting: false,
      cell: (item) => <SignalsCell item={item} />,
    },
    {
      id: 'budget',
      header: t('Бюджет'),
      width: 118,
      minWidth: 104,
      align: 'center',
      accessor: (item) => item.within_budget === null ? null : Number(item.within_budget),
      cell: (item) => (
        <Badge
          className={item.within_budget === true ? 'app-role-pill is-green' : 'app-role-pill is-gray'}
          size="sm"
          variant="light"
        >
          {item.within_budget === null ? t('Не застосовано') : item.within_budget ? t('В бюджеті') : item.cost_provenance.budget_eligible ? t('Відкладено') : t('Виключено')}
        </Badge>
      ),
    },
  ]
}

function SignalsCell({ item }: { item: ReorderSuggestion }) {
  const { t } = useI18n()
  const signals = buildDecisionSignals(item, t)
  const explanation = buildReorderExplanation(item, t)

  return (
    <Stack gap={4}>
    <ProcurementCostBadge proof={item.cost_provenance} />
    <Group
      className="budget-cart-signals"
      gap={4}
      title={explanation}
      wrap="wrap"
    >
      {signals.map((signal) => (
        <Badge className={signal.pillClass} key={signal.label} size="xs" variant="light">
          {signal.label}
        </Badge>
      ))}
    </Group>
    <details><summary>{t('Джерело вартості')}</summary><ProcurementCostProof item={item} /></details>
    </Stack>
  )
}

function buildDecisionSignals(item: ReorderSuggestion, t: (value: string) => string): DecisionSignal[] {
  const signals: DecisionSignal[] = []

  if (item.inventory.available <= item.reorder_point) {
    signals.push({ label: t('Нижче точки замовлення'), pillClass: 'app-role-pill is-red' })
  }

  if (item.days_of_cover > 0) {
    signals.push({
      label: `${t('Покриття')}: ${qtyFormatter.format(item.days_of_cover)} ${t('дн.')}`,
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
      label: `${t('Рівень сервісу')} ${percentFormatter.format(item.applied_service_level * 100)}%`,
      pillClass: 'app-role-pill is-green',
    })
  }

  if (item.cheaper_alt) {
    signals.push({ label: t('нижча історична оцінка'), pillClass: 'app-role-pill is-yellow' })
  }

  return signals.slice(0, 4)
}

function quadrantLabel(item: ReorderSuggestion): string {
  if (item.quadrant) {
    return item.quadrant
  }

  const abc = item.abc ?? ''
  const xyz = item.xyz ?? ''

  return `${abc}${xyz}`
}
