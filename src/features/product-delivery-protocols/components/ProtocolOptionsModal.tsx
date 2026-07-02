import { Button, Stack, Text } from '@mantine/core'
import { PackageCheck, Route, ScanBarcode } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { DeliveryProductProtocol } from '../types'

export type ProtocolOptionsModalProps = {
  protocol: DeliveryProductProtocol | null
  onClose: () => void
  onOpenIncome: (protocol: DeliveryProductProtocol) => void
  onOpenLogisticPath: (protocol: DeliveryProductProtocol) => void
  onOpenSpecifications: (protocol: DeliveryProductProtocol) => void
  canOpenIncome: boolean
  canOpenLogisticPath: boolean
  canOpenSpecifications: boolean
}

/* Row-actions popup per docs/ui-patterns.md §7.1: mono title (the protocol
   number), subtle buttons with the icon in an outlined circle, orange on hover. */
export function ProtocolOptionsModal({
  protocol,
  onClose,
  onOpenIncome,
  onOpenLogisticPath,
  onOpenSpecifications,
  canOpenIncome,
  canOpenLogisticPath,
  canOpenSpecifications,
}: ProtocolOptionsModalProps) {
  const { t } = useI18n()
  const hasInvoices = Boolean(protocol?.SupplyInvoices && protocol.SupplyInvoices.length > 0)
  const hasVisibleOptions =
    canOpenLogisticPath || (canOpenSpecifications && hasInvoices && protocol?.IsShipped) || (canOpenIncome && hasInvoices && protocol?.IsCompleted)
  const protocolNumber = protocol?.DeliveryProductProtocolNumber?.Number

  return (
    <AppModal
      centered
      opened={Boolean(protocol)}
      size={496}
      title={
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {protocolNumber ? `${t('Протокол')} ${protocolNumber}` : t('Виберіть опцію')}
        </span>
      }
      onClose={onClose}
    >
      <Stack className="app-modal-actions" gap="xs">
        {canOpenLogisticPath && (
          <Button
            fullWidth
            justify="flex-start"
            color="dark"
            size="md"
            leftSection={
              <span className="app-action-icon">
                <Route size={20} color="var(--mantine-color-gray-7)" />
              </span>
            }
            variant="subtle"
            onClick={() => protocol && onOpenLogisticPath(protocol)}
          >
            {t('Логістичний шлях')}
          </Button>
        )}
        {canOpenSpecifications && hasInvoices && protocol?.IsShipped && (
          <Button
            fullWidth
            justify="flex-start"
            color="dark"
            size="md"
            leftSection={
              <span className="app-action-icon">
                <ScanBarcode size={20} color="var(--mantine-color-gray-7)" />
              </span>
            }
            variant="subtle"
            onClick={() => protocol && onOpenSpecifications(protocol)}
          >
            {t('Митні коди')}
          </Button>
        )}
        {canOpenIncome && hasInvoices && protocol?.IsCompleted && (
          <Button
            fullWidth
            justify="flex-start"
            color="dark"
            size="md"
            leftSection={
              <span className="app-action-icon">
                <PackageCheck size={20} color="var(--mantine-color-gray-7)" />
              </span>
            }
            variant="subtle"
            onClick={() => protocol && onOpenIncome(protocol)}
          >
            {t('Прихід товару згідно замовлення')}
          </Button>
        )}
        {!hasVisibleOptions && (
          <Text c="dimmed" size="sm">
            {t('Немає доступних опцій')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}
