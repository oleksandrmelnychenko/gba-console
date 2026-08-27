import { Button, Group } from '@mantine/core'
import { RefreshCw, Save } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { ActProvidingServiceDisplayModel } from '../utils'
import { usePermissions } from '../../auth/usePermissions'
import {
  ActProvidingServiceDetailBody,
} from './ActProvidingServiceDetail'
import {
  useActProvidingServiceDetailModel,
} from './useActProvidingServiceDetailModel'

export type ActProvidingServiceDetailDrawerProps = {
  row: ActProvidingServiceDisplayModel | null
  onClose: () => void
}

export function ActProvidingServiceDetailDrawer({ row, onClose }: ActProvidingServiceDetailDrawerProps) {
  const { t } = useI18n()
  const { can } = usePermissions()
  const canEdit = can(PermissionKeys.ProvidingServiceActs.Act.Edit)
  const model = useActProvidingServiceDetailModel(row?.netId, undefined, canEdit)
  const { act, displayModel, isDirty, isLoading, isSaving, loadAct, save } = model
  const title = `${t('Акт надання послуг')} ${displayCode(displayModel?.number ?? row?.number ?? row?.actNumber)}`.trim()

  return (
    <AppDrawer
      opened={Boolean(row)}
      position="right"
      size="standard"
      title={title}
      onClose={onClose}
      footer={
        <Group gap="xs">
          <Button
            color="gray"
            leftSection={<RefreshCw size={16} />}
            loading={isLoading}
            variant="light"
            onClick={loadAct}
          >
            {t('Оновити')}
          </Button>
          {canEdit && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!act || !isDirty || isLoading}
              leftSection={<Save size={16} />}
              loading={isSaving}
              onClick={save}
            >
              {t('Зберегти')}
            </Button>
          )}
        </Group>
      }
    >
      <ActProvidingServiceDetailBody canEdit={canEdit} model={model} />
    </AppDrawer>
  )
}

function displayCode(value?: string): string {
  return value ? value : ''
}
