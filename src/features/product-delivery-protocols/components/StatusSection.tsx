import { Button, Card, Group, Text } from '@mantine/core'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { useAuth } from '../../auth/useAuth'
import type { ProtocolDetail } from '../detailTypes'
import { getProtocolStatusActionLabel } from '../protocolStatus'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

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
  const [confirmOpen, setConfirmOpen] = useValueState(false)
  const canChangeStatus = canEdit && hasPermission(CHANGE_STATUS_PERMISSION) && !protocol.IsCompleted
  const actionLabel = getProtocolStatusActionLabel(protocol, t)

  return (
    <>
      <Card withBorder radius="md" padding="md">
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={!canChangeStatus}
          fullWidth
          loading={canChangeStatus && isUpdating}
          variant="light"
          onClick={() => {
            if (canChangeStatus) {
              setConfirmOpen(true)
            }
          }}
        >
          {actionLabel}
        </Button>
      </Card>

      <AppModal
        opened={confirmOpen && canChangeStatus}
        title={t('Підтвердити зміну статусу')}
        onClose={() => setConfirmOpen(false)}
      >
        <Text size="sm">{t('Змінити статус протоколу?')}</Text>
        <Group justify="flex-end" mt="md">
          <Button color="gray" disabled={isUpdating} variant="light" onClick={() => setConfirmOpen(false)}>
            {t('Скасувати')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            loading={isUpdating}
            onClick={() => {
              setConfirmOpen(false)
              onChangeStatus()
            }}
          >
            {t('Підтвердити')}
          </Button>
        </Group>
      </AppModal>
    </>
  )
}
