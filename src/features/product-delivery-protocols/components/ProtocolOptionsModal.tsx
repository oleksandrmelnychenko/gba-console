import { Button, Stack } from '@mantine/core'
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
}

export function ProtocolOptionsModal({
  protocol,
  onClose,
  onOpenIncome,
  onOpenLogisticPath,
  onOpenSpecifications,
}: ProtocolOptionsModalProps) {
  const { t } = useI18n()
  const hasInvoices = Boolean(protocol?.SupplyInvoices && protocol.SupplyInvoices.length > 0)

  return (
    <AppModal centered opened={Boolean(protocol)} size="sm" title={t('Виберіть опцію')} onClose={onClose}>
      <Stack gap="sm">
        <Button
          color="violet"
          leftSection={<IconRoute size={18} />}
          variant="light"
          onClick={() => protocol && onOpenLogisticPath(protocol)}
        >
          {t('Логістичний шлях')}
        </Button>
        {hasInvoices && protocol?.IsShipped && (
          <Button
            color="violet"
            leftSection={<IconBarcode size={18} />}
            variant="light"
            onClick={() => protocol && onOpenSpecifications(protocol)}
          >
            {t('Митні коди')}
          </Button>
        )}
        {hasInvoices && protocol?.IsCompleted && (
          <Button
            color="violet"
            leftSection={<IconTruckDelivery size={18} />}
            variant="light"
            onClick={() => protocol && onOpenIncome(protocol)}
          >
            {t('Прихід товару згідно замовлення')}
          </Button>
        )}
      </Stack>
    </AppModal>
  )
}
