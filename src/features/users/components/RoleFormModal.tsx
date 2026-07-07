import { Button, Group, NumberInput, Stack, TextInput } from '@mantine/core'
import { Save, Trash2 } from 'lucide-react'
import { type FormEvent } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { UserRoleType } from '../../../shared/auth/types'
import type { UserRole } from '../types'

const MODAL_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

const DEFAULT_DASHBOARD = '/dashboard'

type RoleFormModalProps = {
  canDelete?: boolean
  isSaving: boolean
  opened: boolean
  role: UserRole | null
  onClose: () => void
  onDelete?: () => void
  onSubmit: (values: { Dashboard: string; Name: string }) => void
}

export function RoleFormModal({
  canDelete = false,
  isSaving,
  opened,
  role,
  onClose,
  onDelete,
  onSubmit,
}: RoleFormModalProps) {
  const { t } = useI18n()
  const [name, setName] = useValueState(role?.Name || '')
  const [dashboard] = useValueState(role?.Dashboard || DEFAULT_DASHBOARD)
  const [error, setError] = useValueState<string | null>(null)
  const roleType = role ? role.UserRoleType : UserRoleType.Driver

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError(t("Поле обов'язкове для заповнення"))
      return
    }

    onSubmit({ Dashboard: dashboard, Name: trimmedName })
  }

  return (
    <AppModal
      centered
      opened={opened}
      title={<span style={MODAL_MONO_STYLE}>{role ? t('Редагування ролі') : t('Нова роль')}</span>}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            disabled={isSaving}
            error={error}
            label={t('Найменування')}
            required
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value)
              setError(null)
            }}
          />
          <TextInput disabled label="Dashboard" value={dashboard} />
          <NumberInput disabled label={t('Тип')} value={roleType} />
          <Group justify={role && canDelete ? 'space-between' : 'flex-end'}>
            {role && canDelete ? (
              <Button
                color="red"
                disabled={isSaving}
                leftSection={<Trash2 size={16} />}
                type="button"
                variant="subtle"
                onClick={onDelete}
              >
                {t('Видалити')}
              </Button>
            ) : null}
            <Group gap="xs">
              <Button
                color="gray"
                disabled={isSaving}
                variant="subtle"
                onClick={onClose}
              >
                {t('Скасувати')}
              </Button>
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Save size={16} />}
                loading={isSaving}
                styles={{ label: MODAL_MONO_STYLE }}
                type="submit"
              >
                {t('Зберегти')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}
