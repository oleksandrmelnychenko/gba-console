import { Card, Checkbox, Group, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SupplyInvoice } from '../detailTypes'
import { getProtocolInvoiceAssignmentKey } from '../protocolInvoiceAssignment'
import { formatDateTime, getInvoiceCurrencyCode, getInvoiceTotalNetPrice } from './protocolDetailHelpers'
import { TableChip } from '../../../shared/ui/TableChip'
import '../../../shared/ui/selection-surface.css'
import './invoice-select-list.css'

const invoiceAmountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function InvoiceSelectList({
  disabled = false,
  invoices,
  selected,
  onToggle,
}: {
  disabled?: boolean
  invoices: SupplyInvoice[]
  onToggle: (invoice: SupplyInvoice) => void
  selected: Record<string, boolean>
}) {
  const { t } = useI18n()

  if (invoices.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t('Інвойсів не знайдено')}
      </Text>
    )
  }

  return (
    <Stack gap="xs">
      {invoices.map((invoice, index) => {
        const key = getProtocolInvoiceAssignmentKey(invoice)
        const currencyCode = getInvoiceCurrencyCode(invoice)
        const isSelected = Boolean(selected[key])
        const supplier = invoice.SupplyOrder?.Client?.FullName || '-'
        const amount = invoiceAmountFormatter.format(getInvoiceTotalNetPrice(invoice))

        return (
          <Card
            key={key || `invoice-${index}`}
            className="invoice-select-card app-selection-surface"
            data-selected={isSelected}
            withBorder
            padding="sm"
            radius="sm"
          >
            <span className="app-selection-surface__marker" aria-hidden="true" />
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <Checkbox
                aria-label={`${t('Інвойс')} ${invoice.Number || '-'}`}
                checked={isSelected}
                className="invoice-select-card__checkbox"
                disabled={disabled || !key}
                onChange={() => onToggle(invoice)}
              />
              <Stack className="invoice-select-card__content" gap={8}>
                <Group align="center" className="invoice-select-card__head" gap={8} wrap="nowrap">
                  <TableChip tone="document" value={`№ ${invoice.Number || '-'}`} />
                  <span className="invoice-select-card__supplier"><TableChip tone="document" value={supplier} /></span>
                </Group>
                <div className="invoice-select-card__meta">
                  <span>
                    <Text component="span">{t('Дата інвойса')}</Text>
                    <strong>{formatDateTime(invoice.DateFrom)}</strong>
                  </span>
                  <span>
                    <Text component="span">{t('Загальна сума інвойса')}</Text>
                    <strong>{amount}</strong>
                    {currencyCode && (
                      <TableChip tone="source" value={currencyCode} />
                    )}
                  </span>
                </div>
              </Stack>
            </Group>
          </Card>
        )
      })}
    </Stack>
  )
}
