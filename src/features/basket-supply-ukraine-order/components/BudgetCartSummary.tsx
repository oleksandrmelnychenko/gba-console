import { Card, Group, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { Info } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
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
    <Card className="app-section-card" padding="md" radius="md" withBorder>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <SummaryItem label={`${t('Бюджет')} (EUR)`} value={`€${eurFormatter.format(plan.budget_eur)}`} />
            <SummaryItem label={`${t('Використано')} (EUR)`} value={`€${eurFormatter.format(plan.budget_used_eur)}`} />
            <SummaryItem
              color="teal"
              hint={t('Оцінка маржі/попиту, яку AI вважає втраченою без закупівлі')}
              label={`${t('Цінність під ризиком')} (EUR)`}
              value={`€${eurFormatter.format(plan.value_captured_eur)}`}
            />
            <SummaryItem
              color="blue"
              hint={t('Потенційна виручка по рядках, які потрапили в бюджет')}
              label={`${t('Потенційна виручка')} (EUR)`}
              value={formatNullableEuro(financials.expectedRevenueEur)}
            />
            <SummaryItem
              color="green"
              hint={t('Потенційна маржа по рядках, які потрапили в бюджет')}
              label={`${t('Потенційна маржа')} (EUR)`}
              value={formatNullableEuro(financials.expectedMarginEur)}
            />
            <SummaryItem color="green" label={t('В бюджеті')} value={countFormatter.format(plan.selected_count)} />
            <SummaryItem color="gray" label={t('Відкладено')} value={countFormatter.format(plan.deferred_count)} />
            <SummaryItem label={t('Одиниць товару')} value={qtyFormatter.format(financials.selectedUnits)} />
            <SummaryItem label={t('Виробників')} value={countFormatter.format(financials.selectedProducerCount)} />
            <SummaryItem label={t('Метод')} value={getMethodLabel(plan, t)} />
            <SummaryItem label={t('Позицій')} value={countFormatter.format(plan.item_count)} />
          </SimpleGrid>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text c="dimmed" size="xs">
                {t('Використання бюджету')}
              </Text>
              <Text fw={600} size="xs">
                {percentFormatter.format(utilization)}%
              </Text>
            </Group>
            <Progress color={utilization >= 99 ? 'orange' : 'teal'} radius="xl" size="lg" value={utilization} />
          </Stack>
        </Stack>

        <Stack align="center" gap="xs">
          <Text fw={600} size="sm">
            {t('Розподіл позицій')}
          </Text>
          <UrgencyDonut
            chartLabel={countFormatter.format(plan.item_count)}
            data={splitSlices}
            emptyLabel={t('Немає позицій')}
            valueFormatter={(value) => countFormatter.format(value)}
          />
        </Stack>
      </SimpleGrid>
    </Card>
  )
}

function SummaryItem({
  color,
  hint,
  label,
  value,
}: {
  color?: string
  hint?: string
  label: string
  value: string
}) {
  return (
    <Stack gap={2}>
      <Group gap={4} wrap="nowrap">
        <Text c="dimmed" size="xs">
          {label}
        </Text>
        {hint && (
          <Tooltip label={hint} maw={320} multiline>
            <Info size={12} color="var(--mantine-color-gray-5)" />
          </Tooltip>
        )}
      </Group>
      <Text c={color} fw={700}>
        {value}
      </Text>
    </Stack>
  )
}

function formatNullableEuro(value: number | null): string {
  return value === null ? '-' : `€${eurFormatter.format(value)}`
}

function getMethodLabel(plan: CartPlan, t: (value: string) => string): string {
  if (plan.method_used === 'milp') {
    return t('MILP')
  }

  if (plan.method_used === 'greedy') {
    return t('Жадібний')
  }

  return t('Не вказано')
}
