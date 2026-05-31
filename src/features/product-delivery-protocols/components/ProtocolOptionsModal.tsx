import { Button, Stack, Text } from '@mantine/core'
import { IconBarcode, IconRoute, IconTruckDelivery } from '@tabler/icons-react'
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

  return (
    <AppModal centered opened={Boolean(protocol)} size="sm" title={t('Виберіть опцію')} onClose={onClose}>
      <Stack gap="sm">
        {canOpenLogisticPath && (
          <Button
            color="violet"
            leftSection={<IconRoute size={18} />}
            variant="light"
            onClick={() => protocol && onOpenLogisticPath(protocol)}
          >
            {t('Логістичний шлях')}
          </Button>
        )}
        {canOpenSpecifications && hasInvoices && protocol?.IsShipped && (
          <Button
            color="violet"
            leftSection={<IconBarcode size={18} />}
            variant="light"
            onClick={() => protocol && onOpenSpecifications(protocol)}
          >
            {t('Митні коди')}
          </Button>
        )}
        {canOpenIncome && hasInvoices && protocol?.IsCompleted && (
          <Button
            color="violet"
            leftSection={<IconTruckDelivery size={18} />}
            variant="light"
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
