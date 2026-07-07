import { Group, Paper, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SpecificationPackingList, SpecificationSupplyInvoice } from '../specificationTypes'
import './specification-totals.css'

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

type SpecificationTotalItem = {
  label: string
  meta?: string
  value: string
}

export function SpecificationTotals({ currencyIsEur, flat, invoice, packingList }: SpecificationTotalsProps) {
  const { t } = useI18n()
  const currencyCode = invoice?.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Code

  const totals: SpecificationTotalItem[] = [
    { label: t('К-сть'), value: String(packingList.TotalQuantity ?? 0) },
    {
      label: t('Заг. вартість нетто'),
      meta: currencyCode,
      value: priceFormatter.format(packingList.TotalNetPrice || 0),
    },
    { label: t('Заг. вага нетто'), value: weightFormatter.format(packingList.TotalNetWeight || 0) },
    { label: t('Заг. вага брутто'), value: weightFormatter.format(packingList.TotalGrossWeight || 0) },
    {
      label: t('Митна вартість'),
      meta: (packingList.TotalCustomValue || 0) > 0 ? 'UAH' : undefined,
      value: (packingList.TotalCustomValue || 0) > 0 ? priceFormatter.format(packingList.TotalCustomValue || 0) : '0',
    },
    {
      label: t('Мито'),
      meta: (packingList.TotalDuty || 0) > 0 ? 'UAH' : undefined,
      value: (packingList.TotalDuty || 0) > 0 ? priceFormatter.format(packingList.TotalDuty || 0) : '0',
    },
    {
      label: t('ПДВ'),
      meta: (packingList.TotalVatAmount || 0) > 0 ? 'UAH' : undefined,
      value: (packingList.TotalVatAmount || 0) > 0 ? priceFormatter.format(packingList.TotalVatAmount || 0) : '0',
    },
    {
      label: t('Заг. вартість брутто'),
      meta: currencyIsEur ? 'EUR' : 'UAH',
      value: currencyIsEur
        ? priceFormatter.format(packingList.TotalGrossPriceEur || 0)
        : priceFormatter.format(packingList.TotalGrossPrice || 0),
    },
    {
      label: `${t('Заг. вартість брутто')} ${t('Бух.')}`,
      meta: currencyIsEur ? 'EUR' : 'UAH',
      value: currencyIsEur
        ? priceFormatter.format(packingList.AccountingTotalGrossPriceEur || 0)
        : priceFormatter.format(packingList.AccountingTotalGrossPrice || 0),
    },
  ]

  const content = (
    <Group className={`specification-totals${flat ? ' is-flat' : ''}`} gap="xl" justify="flex-end" wrap="wrap">
      {totals.map((total) => (
        <Stack key={total.label} className="specification-total-item" gap={2}>
          <Text className="specification-total-label">
            {total.label}
          </Text>
          <Text className="app-money specification-total-value" component="strong">
            <span>{total.value}</span>
            {total.meta && <span className="app-money-meta specification-total-meta">{total.meta}</span>}
          </Text>
        </Stack>
      ))}
    </Group>
  )

  if (flat) {
    return content
  }

  return (
    <Paper className="specification-totals-paper" withBorder p="md" radius="md">
      {content}
    </Paper>
  )
}
