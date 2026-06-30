import { Button, Group, Stack } from '@mantine/core'
import { IconArrowLeft, IconDeviceFloppy, IconRefresh } from '@tabler/icons-react'
import { Link, useParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  ActProvidingServiceDetailBody,
  useActProvidingServiceDetailModel,
} from '../components/ActProvidingServiceDetail'

export function ActProvidingServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const model = useActProvidingServiceDetailModel(id)
  const { act, isDirty, isLoading, isSaving, loadAct, save } = model

  return (
    <Stack gap="lg">
      <Group justify="space-between" gap="sm">
        <Button component={Link} leftSection={<IconArrowLeft size={16} />} to="/act-providing-services" variant="light">
          {t('Назад')}
        </Button>
        <Group gap="xs">
          <Button color="gray" leftSection={<IconRefresh size={16} />} loading={isLoading} variant="light" onClick={loadAct}>
            {t('Оновити')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={!act || !isDirty || isLoading}
            leftSection={<IconDeviceFloppy size={16} />}
            loading={isSaving}
            onClick={save}
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Group>

      <ActProvidingServiceDetailBody model={model} />
    </Stack>
  )
}
