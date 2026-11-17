import { Button, Group, Stack, TextInput } from '@mantine/core'
import { Save, Trash2 } from 'lucide-react'
import { type FormEvent } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { UserRole } from '../types'

const MODAL_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

const DEFAULT_DASHBOARD = '/dashboard'
/** UserRole.Name is nvarchar(40) in the database. */
const ROLE_NAME_MAX_LENGTH = 40

type RoleFormModalProps = {
  canDelete?: boolean
  isSaving: boolean
  opened: boolean
  role: UserRole | null
  onClose: () => void
  onDelete?: () => void
  onSubmit: (values: { Dashboard: string; Name: string }) => void
  submitError?: string | null
}

export function RoleFormModal({
  canDelete = false,
  isSaving,
  opened,
  role,
  onClose,
  onDelete,
  onSubmit,
  submitError = null,
}: RoleFormModalProps) {
  const { t } = useI18n()
  const [name, setName] = useValueState(role?.Name || '')
  const dashboard = role?.Dashboard || DEFAULT_DASHBOARD
  const [error, setError] = useValueState<string | null>(null)
  const [submitErrorDismissed, setSubmitErrorDismissed] = useValueState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError(t("Поле обов'язкове для заповнення"))
      return
    }

    if (trimmedName.length > ROLE_NAME_MAX_LENGTH) {
      setError(t('Назва ролі має містити не більше {count} символів', { count: ROLE_NAME_MAX_LENGTH }))
      return
    }

    setSubmitErrorDismissed(false)
    onSubmit({ Dashboard: dashboard, Name: trimmedName })
  }

  return (
    <AppModal
      centered
      opened={opened}
      title={<span style={MODAL_MONO_STYLE}>{role ? t('Редагування ролі') : t('Нова роль')}</span>}
      onClose={onClose}
    >
      {/* noValidate: an empty name gets the Mantine field error below, not a browser tooltip. */}
      <form noValidate onSubmit={handleSubmit}>
        <Stack gap={10}>
          <TextInput
            disabled={isSaving}
            error={error ?? (submitErrorDismissed ? null : submitError)}
            label={t('Найменування')}
            maxLength={ROLE_NAME_MAX_LENGTH}
            required
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value)
              setError(null)
              setSubmitErrorDismissed(true)
            }}
          />
          <AppModalFooter className={role && canDelete ? 'app-modal-footer--split' : undefined}>
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
              {/* Never disabled: cancelling while saving aborts the request and closes the dialog. */}
              <Button
                color="gray"
                variant="default"
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
          </AppModalFooter>
        </Stack>
      </form>
    </AppModal>
  )
}
