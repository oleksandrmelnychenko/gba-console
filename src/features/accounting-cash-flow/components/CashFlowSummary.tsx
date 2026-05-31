import { Card, SimpleGrid, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { AccountingCashFlow, AccountingCashFlowHeadItem } from '../types'

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function CashFlowSummary({
  cashFlow,
  lastItem,
}: {
  cashFlow: AccountingCashFlow | null
  lastItem?: AccountingCashFlowHeadItem
}) {
  const { t } = useI18n()
  const closingBalance = typeof lastItem?.CurrentBalance === 'number' ? lastItem.CurrentBalance : 0

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }} spacing="sm">
      <SummaryValue label={t('Вхідний дебет')} value={cashFlow?.BeforeRangeInAmount} />
      <SummaryValue label={t('Вхідний кредит')} value={cashFlow?.BeforeRangeOutAmount} />
      <SummaryValue label={t('Вхідний баланс')} value={cashFlow?.BeforeRangeBalance} />
      <SummaryValue label={t('Дебет за період')} value={cashFlow?.AfterRangeInAmount} />
      <SummaryValue label={t('Кредит за період')} value={cashFlow?.AfterRangeOutAmount} />
      <SummaryValue label={t('Баланс після періоду')} value={closingBalance} />
    </SimpleGrid>
  )
}

function SummaryValue({ label, value }: { label: string; value?: number }) {
  const isNegative = typeof value === 'number' && value < 0

  return (
    <Card withBorder radius="md" padding="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="lg" fw={700} c={isNegative ? 'red' : undefined}>
        {formatMoney(value)}
      </Text>
    </Card>
  )
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}
