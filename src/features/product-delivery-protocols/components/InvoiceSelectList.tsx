import { Badge, Card, Checkbox, Group, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SupplyInvoice } from '../detailTypes'
import { getProtocolInvoiceAssignmentKey } from '../protocolInvoiceAssignment'
import { formatDateTime } from './protocolDetailHelpers'
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
        const currencyCode = invoice.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Code || ''
        const isSelected = Boolean(selected[key])
        const supplier = invoice.SupplyOrder?.Client?.FullName || '-'
        const amount =
          typeof invoice.TotalNetPrice === 'number' ? invoiceAmountFormatter.format(invoice.TotalNetPrice) : '0'

        return (
          <Card
            key={key || `invoice-${index}`}
            className={`invoice-select-card${isSelected ? ' is-selected' : ''}`}
            withBorder
            padding="sm"
            radius="sm"
          >
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <Checkbox
                checked={isSelected}
                className="invoice-select-card__checkbox"
                disabled={disabled || !key}
                onChange={() => onToggle(invoice)}
              />
              <Stack className="invoice-select-card__content" gap={8}>
                <Group align="center" className="invoice-select-card__head" gap={8} wrap="nowrap">
                  <Badge className="app-role-pill is-yellow invoice-select-card__number" size="sm" variant="light">
                    № {invoice.Number || '-'}
                  </Badge>
                  <Text className="invoice-select-card__supplier" title={supplier}>
                    {supplier}
                  </Text>
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
                      <Badge className="app-role-pill is-gray invoice-select-card__currency" size="sm" variant="light">
                        {currencyCode}
                      </Badge>
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
