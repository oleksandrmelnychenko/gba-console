import { Button, Card } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import type { ProtocolDetail } from '../detailTypes'

const CHANGE_STATUS_PERMISSION = 'ProductDeliveryProtocols_unified_services_ChangeStatusBtn_PKEY'

export function StatusSection({
  protocol,
  canEdit,
  isUpdating,
  onChangeStatus,
}: {
  canEdit: boolean
  isUpdating: boolean
  onChangeStatus: () => void
  protocol: ProtocolDetail
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()

  if (!canEdit || !hasPermission(CHANGE_STATUS_PERMISSION)) {
    return null
  }

  let statusLabel = t('В дорозі')

  if (protocol.IsShipped) {
    statusLabel = t('Прибув')
  }

  if (protocol.IsCompleted) {
    statusLabel = t('Завершено')
  }

  return (
    <Card withBorder radius="md" padding="md">
      <Button
        color="violet"
        disabled={protocol.IsCompleted}
        fullWidth
        loading={isUpdating}
        variant="light"
        onClick={onChangeStatus}
      >
        {statusLabel}
      </Button>
    </Card>
  )
}
