import { Badge, Card, Group, Progress, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { UrgencyDonut } from '../../../shared/ui/charts/UrgencyDonut'
import type { UrgencySliceInput } from '../../../shared/ui/charts/donutData'
import type { CartPlan } from '../procurementTypes'

export type BudgetCartFinancials = {
  expectedMarginEur: number | null
  expectedRevenueEur: number | null
  selectedProducerCount: number
  selectedUnits: number
}

type BudgetCartSummaryProps = {
  financials: BudgetCartFinancials
  plan: CartPlan
  splitSlices: UrgencySliceInput[]
  utilization: number
}

const qtyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

const countFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const eurFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 1,
})

export function BudgetCartSummary({
  financials,
  plan,
  splitSlices,
  utilization,
}: BudgetCartSummaryProps) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card budget-cart-summary" padding="md" radius="md" withBorder>
      <Group className="budget-cart-summary__head" justify="space-between">
        <div>
          <Text className="app-section-title" fw={600} size="sm">
            {t('Результат оптимізації')}
          </Text>
          <Text c="dimmed" size="xs">
            {t('Як бюджет розподілено між товарами та виробниками')}
          </Text>
        </div>
        <Badge className="app-role-pill is-orange" variant="light">
          {getMethodLabel(plan, t)}
        </Badge>
      </Group>

      <div className="budget-cart-summary__layout">
        <Stack gap="md">
          <div className="budget-cart-summary__primary">
            <SummaryItem label={`${t('Бюджет')} (EUR)`} money value={`€${eurFormatter.format(plan.budget_eur)}`} />
            <SummaryItem label={`${t('Використано')} (EUR)`} money value={`€${eurFormatter.format(plan.budget_used_eur)}`} />
            <SummaryItem
              hint={t('Оцінка маржі/попиту, яку AI вважає втраченою без закупівлі')}
              label={`${t('Цінність під ризиком')} (EUR)`}
              money
              value={`€${eurFormatter.format(plan.value_captured_eur)}`}
            />
            <SummaryItem label={t('В бюджеті')} money value={countFormatter.format(plan.selected_count)} />
            <SummaryItem label={t('Відкладено')} money value={countFormatter.format(plan.deferred_count)} />
          </div>

          <Stack className="budget-cart-summary__progress" gap={5}>
            <Group justify="space-between">
              <Text c="gray.9" size="xs">
                {t('Використання бюджету')}
              </Text>
              <Text className="app-money" fw={600} size="xs">
                {percentFormatter.format(utilization)}%
              </Text>
            </Group>
            <Progress color={CREATE_ACTION_COLOR} radius="xl" size="md" value={utilization} />
          </Stack>

          <div className="budget-cart-summary__secondary">
            <SummaryItem
              hint={t('Потенційна виручка по рядках, які потрапили в бюджет')}
              label={`${t('Потенційна виручка')} (EUR)`}
              money
              value={formatNullableEuro(financials.expectedRevenueEur)}
            />
            <SummaryItem
              hint={t('Потенційна маржа по рядках, які потрапили в бюджет')}
              label={`${t('Потенційна маржа')} (EUR)`}
              money
              value={formatNullableEuro(financials.expectedMarginEur)}
            />
            <SummaryItem label={t('Одиниць товару')} money value={qtyFormatter.format(financials.selectedUnits)} />
            <SummaryItem label={t('Виробників')} money value={countFormatter.format(financials.selectedProducerCount)} />
          </div>
        </Stack>

        {splitSlices.length > 0 ? (
          <Stack align="center" className="budget-cart-summary__distribution" gap="xs">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Розподіл позицій')}
            </Text>
            <UrgencyDonut
              chartLabel={countFormatter.format(plan.item_count)}
              data={splitSlices}
              emptyLabel={t('Немає позицій')}
              valueFormatter={(value) => countFormatter.format(value)}
            />
          </Stack>
        ) : null}
      </div>
    </Card>
  )
}

function SummaryItem({
  hint,
  label,
  money,
  value,
}: {
  hint?: string
  label: string
  money?: boolean
  value: string
}) {
  return (
    <Stack className="budget-cart-summary__metric" gap={2} title={hint}>
      <Text c="gray.9" size="xs">
        {label}
      </Text>
      <Text c="gray.8" className={money ? 'app-money' : undefined} fw={600}>
        {value}
      </Text>
    </Stack>
  )
}

function formatNullableEuro(value: number | null): string {
  return value === null ? '—' : `€${eurFormatter.format(value)}`
}

function getMethodLabel(plan: CartPlan, t: (value: string) => string): string {
  if (plan.method_used === 'milp') {
    return t('Оптимальний')
  }

  if (plan.method_used === 'greedy') {
    return t('Швидкий')
  }

  return t('Не вказано')
}
