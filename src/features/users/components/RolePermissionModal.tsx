import { Alert, Button, Checkbox, FileInput, Group, Image, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { IconAlertCircle, IconDeviceFloppy, IconPhoto } from '@tabler/icons-react'
import { type FormEvent } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { DashboardNode, UserPermission } from '../types'

export type RolePermissionSubmit = {
  image: File | null
  permission: UserPermission
}

type RolePermissionModalProps = {
  isSaving: boolean
  node: DashboardNode | null
  opened: boolean
  permission: UserPermission | null
  onClose: () => void
  onSubmit: (values: RolePermissionSubmit) => void
}

function toSecureImageUrl(url: string): string {
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

export function RolePermissionModal({ isSaving, node, opened, permission, onClose, onSubmit }: RolePermissionModalProps) {
  const { t } = useI18n()
  const [name, setName] = useValueState(permission?.Name || '')
  const [description, setDescription] = useValueState(permission?.Description || '')
  const [controlId, setControlId] = useValueState(permission?.ControlId || '')
  const [deleted, setDeleted] = useValueState(Boolean(permission?.Deleted))
  const [image, setImage] = useValueState<File | null>(null)
  const [error, setError] = useValueState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = name.trim()
    const trimmedDescription = description.trim()
    const trimmedControlId = controlId.trim()

    if (!trimmedName || !trimmedDescription || !trimmedControlId) {
      setError(t("Поле обов'язкове для заповнення"))
      return
    }

    const nextPermission: UserPermission = permission
      ? {
          ...permission,
          ControlId: trimmedControlId,
          Deleted: deleted,
          Description: trimmedDescription,
          Name: trimmedName,
        }
      : {
          ControlId: trimmedControlId,
          DashboardNodeId: node?.Id,
          Description: trimmedDescription,
          Name: trimmedName,
        }

    onSubmit({ image, permission: nextPermission })
  }

  return (
    <AppModal centered opened={opened} title={permission ? t('Редагування') : t('Створення')} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {error ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          ) : null}
          <TextInput
            disabled={isSaving}
            label={t('Найменування')}
            required
            value={name}
            onChange={(event) => {
              setName(event.currentTarget.value)
              setError(null)
            }}
          />
          <Textarea
            autosize
            disabled={isSaving}
            label={t('Опис')}
            minRows={4}
            required
            value={description}
            onChange={(event) => {
              setDescription(event.currentTarget.value)
              setError(null)
            }}
          />
          <TextInput
            disabled={isSaving}
            label={t('Ключ (dev)')}
            required
            value={controlId}
            onChange={(event) => {
              setControlId(event.currentTarget.value)
              setError(null)
            }}
          />
          {permission ? (
            <Checkbox
              checked={deleted}
              disabled={isSaving}
              label={t('Видалити')}
              onChange={(event) => setDeleted(event.currentTarget.checked)}
            />
          ) : null}
          {permission?.ImageUrl && !image ? (
            <Stack gap={4}>
              <Text c="dimmed" size="xs">
                {t('Поточне зображення')}
              </Text>
              <Image alt="" fit="contain" h={80} radius="sm" src={toSecureImageUrl(permission.ImageUrl)} w="auto" />
            </Stack>
          ) : null}
          <FileInput
            accept="image/*"
            clearable
            disabled={isSaving}
            label={t('Зображення')}
            leftSection={<IconPhoto size={16} />}
            placeholder={t('Оберіть файл')}
            value={image}
            onChange={setImage}
          />
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
              {permission ? t('Редагувати') : t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}
