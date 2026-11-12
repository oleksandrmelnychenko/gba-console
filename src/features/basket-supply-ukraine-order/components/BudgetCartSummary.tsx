import { Badge, Card, Group, Progress, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { UrgencyDonut } from '../../../shared/ui/charts/UrgencyDonut'
import type { UrgencySliceInput } from '../../../shared/ui/charts/donutData'
import type { CartPlan } from '../procurementTypes'

export type BudgetCartFinancials = {
  selectedProducerCount: number
}

type BudgetCartSummaryProps = {
  financials: BudgetCartFinancials
  plan: CartPlan
  splitSlices: UrgencySliceInput[]
  utilization: number
}

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
            {t('Ліміт вартості товару без ПДВ, доставки та митних витрат')}
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
              hint={t('Сума ваг терміновості обраних рядків; без грошової одиниці')}
              label={t('Бал терміновості')}
              value={plan.budget_score === null ? '—' : percentFormatter.format(plan.budget_score)}
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
            <SummaryItem label={t('Маржа та очікуваний прибуток')} value={t('Недоступні: податковий склад ціни продажу не підтверджено')} />
            <SummaryItem label={t('Виробників')} money value={countFormatter.format(financials.selectedProducerCount)} />
            {typeof plan.estimated_total_cost_eur === 'number' && (
              <SummaryItem
                hint={getEstimateSplit(plan, t)}
                label={`${t('Оцінка всього плану')} (EUR)`}
                money
                value={`≈ €${eurFormatter.format(plan.estimated_total_cost_eur)}`}
              />
            )}
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

function getEstimateSplit(plan: CartPlan, t: (value: string) => string): string {
  const parts: string[] = []

  if (typeof plan.certified_cost_eur === 'number') {
    parts.push(`${t('Підтверджено')}: €${eurFormatter.format(plan.certified_cost_eur)}`)
  }
  if (typeof plan.uncertified_cost_eur === 'number') {
    parts.push(`${t('За останнім приходом')}: €${eurFormatter.format(plan.uncertified_cost_eur)}`)
  }
  if (typeof plan.unestimated_item_count === 'number' && plan.unestimated_item_count > 0) {
    parts.push(`${t('Без оцінки')}: ${countFormatter.format(plan.unestimated_item_count)} ${t('позицій')}`)
  }

  return parts.join(' · ')
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
