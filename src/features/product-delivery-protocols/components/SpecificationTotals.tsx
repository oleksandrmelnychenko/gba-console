import { Group, Paper, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SpecificationPackingList, SpecificationSupplyInvoice } from '../specificationTypes'

type SpecificationTotalsProps = {
  currencyIsEur: boolean
  /** Render without the Paper card (for the pinned sheet footer). */
  flat?: boolean
  invoice: SpecificationSupplyInvoice | null
  packingList: SpecificationPackingList
}

const priceFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const weightFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
  minimumFractionDigits: 0,
})

export function SpecificationTotals({ currencyIsEur, flat, invoice, packingList }: SpecificationTotalsProps) {
  const { t } = useI18n()
  const currencyCode = invoice?.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Code

  const totals: { label: string; value: string }[] = [
    { label: t('К-сть'), value: String(packingList.TotalQuantity ?? 0) },
    {
      label: t('Заг. вартість нетто'),
      value: `${priceFormatter.format(packingList.TotalNetPrice || 0)}${currencyCode ? ` ${currencyCode}` : ''}`,
    },
    { label: t('Заг. вага нетто'), value: weightFormatter.format(packingList.TotalNetWeight || 0) },
    { label: t('Заг. вага брутто'), value: weightFormatter.format(packingList.TotalGrossWeight || 0) },
    {
      label: t('Митна вартість'),
      value: (packingList.TotalCustomValue || 0) > 0 ? `${priceFormatter.format(packingList.TotalCustomValue || 0)} UAH` : '0',
    },
    {
      label: t('Мито'),
      value: (packingList.TotalDuty || 0) > 0 ? `${priceFormatter.format(packingList.TotalDuty || 0)} UAH` : '0',
    },
    {
      label: t('ПДВ'),
      value: (packingList.TotalVatAmount || 0) > 0 ? `${priceFormatter.format(packingList.TotalVatAmount || 0)} UAH` : '0',
    },
    {
      label: t('Заг. вартість брутто'),
      value: currencyIsEur
        ? `${priceFormatter.format(packingList.TotalGrossPriceEur || 0)} EUR`
        : `${priceFormatter.format(packingList.TotalGrossPrice || 0)} UAH`,
    },
    {
      label: `${t('Заг. вартість брутто')} ${t('Бух.')}`,
      value: currencyIsEur
        ? `${priceFormatter.format(packingList.AccountingTotalGrossPriceEur || 0)} EUR`
        : `${priceFormatter.format(packingList.AccountingTotalGrossPrice || 0)} UAH`,
    },
  ]

  const content = (
    <Group gap="xl" wrap="wrap" style={flat ? { flex: 1 } : undefined}>
      {totals.map((total) => (
        <Stack key={total.label} gap={2}>
          <Text c="dimmed" size="xs">
            {total.label}
          </Text>
          <Text fw={600} size="sm">
            {total.value}
          </Text>
        </Stack>
      ))}
    </Group>
  )

  if (flat) {
    return content
  }

  return (
    <Paper withBorder p="md" radius="md">
      {content}
    </Paper>
  )
}
