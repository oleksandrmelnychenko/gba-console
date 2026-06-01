import { Button, Group, NumberInput, Stack, TextInput } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { type FormEvent } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { UserRoleType } from '../../../shared/auth/types'
import type { UserRole } from '../types'

const DEFAULT_DASHBOARD = '/dashboard'

type RoleFormModalProps = {
  isSaving: boolean
  opened: boolean
  role: UserRole | null
  onClose: () => void
  onSubmit: (values: { Dashboard: string; Name: string }) => void
}

export function RoleFormModal({ isSaving, opened, role, onClose, onSubmit }: RoleFormModalProps) {
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
    <AppModal centered opened={opened} title={role ? t('Редагування') : t('Створення')} onClose={onClose}>
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
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
              {role ? t('Редагувати') : t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}
