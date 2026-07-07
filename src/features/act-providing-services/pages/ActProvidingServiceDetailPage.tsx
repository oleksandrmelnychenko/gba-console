import { Button, Group } from '@mantine/core'
import { RefreshCw, Save } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  ActProvidingServiceDetailBody,
} from '../components/ActProvidingServiceDetail'
import {
  useActProvidingServiceDetailModel,
} from '../components/useActProvidingServiceDetailModel'

const DETAIL_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

export function ActProvidingServiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const navigate = useNavigate()
  const model = useActProvidingServiceDetailModel(id)
  const { act, isDirty, isLoading, isSaving, loadAct, save } = model

  return (
    <AppDrawer
      opened
      keepMounted={false}
      position="right"
      size="wide"
      title={<span style={DETAIL_MONO_STYLE}>{t('Акт надання послуг')}</span>}
      onClose={() => navigate('/act-providing-services')}
      footer={
        <Group gap="xs" justify="flex-end">
          <Button
            color="gray"
            leftSection={<RefreshCw size={16} />}
            loading={isLoading}
            styles={{ label: DETAIL_MONO_STYLE }}
            variant="light"
            onClick={loadAct}
          >
            {t('Оновити')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={!act || !isDirty || isLoading}
            leftSection={<Save size={16} />}
            loading={isSaving}
            styles={{ label: DETAIL_MONO_STYLE }}
            onClick={save}
          >
            {t('Зберегти')}
          </Button>
        </Group>
      }
    >
      <ActProvidingServiceDetailBody model={model} />
    </AppDrawer>
  )
}
