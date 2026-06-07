import { Card, Checkbox, Group, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SupplyInvoice } from '../detailTypes'
import { getProtocolInvoiceAssignmentKey } from '../protocolInvoiceAssignment'
import { formatDateTime } from './protocolDetailHelpers'

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

        return (
          <Card key={key || `invoice-${index}`} withBorder padding="sm" radius="sm">
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <Checkbox disabled={disabled || !key} checked={Boolean(selected[key])} onChange={() => onToggle(invoice)} />
              <Stack gap={2} style={{ flex: 1 }}>
                <Text size="sm" fw={600}>
                  {t('Постачальник')}: {invoice.SupplyOrder?.Client?.FullName || '-'}
                </Text>
                <Text size="sm">
                  {t('Номер')}: {invoice.Number || '-'}
                </Text>
                <Text size="sm">
                  {t('Дата інвойса')}: {formatDateTime(invoice.DateFrom)}
                </Text>
                <Text size="sm">
                  {t('Загальна сума інвойса')}: {invoice.TotalNetPrice ?? 0} {currencyCode}
                </Text>
              </Stack>
            </Group>
          </Card>
        )
      })}
    </Stack>
  )
}
