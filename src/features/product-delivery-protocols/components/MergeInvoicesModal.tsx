import { Button, Checkbox, Group, Stack, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { SpecificationSupplyInvoice } from '../specificationTypes'

type MergeInvoicesModalProps = {
  invoices: SpecificationSupplyInvoice[]
  isMerging: boolean
  opened: boolean
  selectedNetIds: string[]
  onClose: () => void
  onConfirm: () => void
  onToggle: (netId: string) => void
}

const invoiceDateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

export function MergeInvoicesModal({
  invoices,
  isMerging,
  opened,
  selectedNetIds,
  onClose,
  onConfirm,
  onToggle,
}: MergeInvoicesModalProps) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={opened}
      size="md"
      title={t("Об'єднати інвойси?")}
      onClose={() => {
        if (!isMerging) {
          onClose()
        }
      }}
    >
      <Stack gap="sm">
        {invoices.map((invoice) => {
          const netId = invoice.NetUid || ''

          return (
            <Checkbox
              key={netId || invoice.Id}
              checked={Boolean(netId) && selectedNetIds.includes(netId)}
              disabled={isMerging || !netId}
              label={
                <Text size="sm">
                  {t('Інвойс')} {invoice.Number} {t('Від')} {formatInvoiceDate(invoice.DateFrom)}
                </Text>
              }
              onChange={() => netId && onToggle(netId)}
            />
          )
        })}

        {selectedNetIds.length < 2 ? (
          <Text c="dimmed" size="sm">
            {t('Оберіть щонайменше два інвойси')}
          </Text>
        ) : null}

        <Group justify="flex-end">
          <Button disabled={isMerging} variant="subtle" onClick={onClose}>
            {t('Ні')}
          </Button>
          <Button disabled={isMerging || selectedNetIds.length < 2} loading={isMerging} onClick={onConfirm}>
            {t('Так')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function formatInvoiceDate(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return invoiceDateFormatter.format(date)
}
