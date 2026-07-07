import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CircleAlert, Plus, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  changeClientGroup,
  createClientGroup,
  deleteClientGroup,
  getClientGroups,
} from '../../api/clientCabinetApi'
import type { ClientGroup } from '../../types'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'

export type GroupsModalProps = {
  opened: boolean
  clientId: number
  clientNetId: string
  onClose: () => void
  onChange?: (groups: ClientGroup[]) => void
}

export function GroupsModal({ opened, clientId, clientNetId, onClose, onChange }: GroupsModalProps) {
  const { t } = useI18n()
  const [groups, setGroups] = useValueState<ClientGroup[]>([])
  const [name, setName] = useValueState('')
  const [editingGroup, setEditingGroup] = useValueState<ClientGroup | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSubmitting, setSubmitting] = useValueState(false)
  const [deletingNetUid, setDeletingNetUid] = useValueState<string | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [dirty, setDirty] = useValueState(false)
  const [groupPendingDelete, setGroupPendingDelete] = useValueState<ClientGroup | null>(null)
  const [prevOpened, setPrevOpened] = useValueState(opened)

  if (opened !== prevOpened) {
    setPrevOpened(opened)

    if (opened) {
      setName('')
      setEditingGroup(null)
      setError(null)
      setDirty(false)
      setGroupPendingDelete(null)
    }
  }

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    async function loadGroups() {
      setLoading(true)
      setError(null)

      try {
        const nextGroups = await getClientGroups(clientNetId)

        if (!cancelled) {
          setGroups(nextGroups)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити групи'))
          setGroups([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadGroups()

    return () => {
      cancelled = true
    }
  }, [opened, clientNetId, setGroups, setLoading, setError, t])

  const trimmedName = name.trim()
  const isEditing = Boolean(editingGroup)
  const isBusy = isSubmitting || Boolean(deletingNetUid)

  function selectGroup(group: ClientGroup) {
    setEditingGroup(group)
    setName(group.Name || '')
    setError(null)
  }

  function resetForm() {
    setEditingGroup(null)
    setName('')
    setError(null)
  }

  async function handleSubmit() {
    if (!trimmedName || isBusy) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const saved = editingGroup
        ? await changeClientGroup({
            ...editingGroup,
            Name: trimmedName,
            ClientId: clientId,
          } as ClientGroup)
        : await createClientGroup(trimmedName, clientId)

      const nextGroups = await getClientGroups(clientNetId)
      setGroups(nextGroups)
      setDirty(true)
      setEditingGroup(null)
      setName('')
      void saved
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('Не вдалося зберегти групу'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(group: ClientGroup) {
    if (isBusy || !group.NetUid) {
      return
    }

    setDeletingNetUid(group.NetUid)
    setError(null)

    try {
      await deleteClientGroup(group)

      if (editingGroup && editingGroup.NetUid === group.NetUid) {
        resetForm()
      }

      const nextGroups = await getClientGroups(clientNetId)
      setGroups(nextGroups)
      setDirty(true)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити групу'))
    } finally {
      setDeletingNetUid(null)
    }
  }

  function handleClose() {
    if (isBusy) {
      return
    }

    if (dirty) {
      onChange?.(groups)
    }

    onClose()
  }

  return (
    <>
    <AppModal
      centered
      closeOnClickOutside={!isBusy}
      opened={opened}
      title={t('Підгрупи')}
      onClose={handleClose}
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Group align="flex-end" gap="xs" wrap="nowrap">
          <TextInput
            disabled={isBusy}
            maxLength={100}
            placeholder={t('Назва групи')}
            style={{ flex: 1 }}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
          <ActionIcon
            color="gray"
            disabled={!trimmedName || isBusy}
            size="lg"
            variant="light"
            onClick={resetForm}
          >
            <X size={18} />
          </ActionIcon>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={!trimmedName}
            leftSection={<Plus size={16} />}
            loading={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isEditing ? t('Зберегти') : t('Створити')}
          </Button>
        </Group>

        {isLoading ? (
          <Group justify="center" py="md">
            <Loader color="orange" size="sm" />
          </Group>
        ) : groups.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Груп не додано')}
          </Text>
        ) : (
          <Stack gap="xs">
            {groups.map((group) => (
              <Group
                key={group.NetUid || group.Id}
                align="center"
                gap="xs"
                justify="space-between"
                wrap="nowrap"
                p="xs"
                style={{
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  background:
                    editingGroup && editingGroup.NetUid === group.NetUid
                      ? 'var(--mantine-color-orange-0)'
                      : undefined,
                }}
              >
                <UnstyledButton
                  disabled={isBusy}
                  style={{ flex: 1, minWidth: 0 }}
                  onClick={() => selectGroup(group)}
                >
                  <Text size="sm" truncate>
                    {group.Name}
                  </Text>
                </UnstyledButton>
                <ActionIcon
                  color="red"
                  disabled={isBusy}
                  loading={deletingNetUid === group.NetUid}
                  variant="subtle"
                  onClick={() => setGroupPendingDelete(group)}
                >
                  <Trash2 size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </AppModal>

    <AppModal
      centered
      opened={Boolean(groupPendingDelete)}
      title={t('Ви впевнені, що хочете видалити групу?')}
      onClose={() => setGroupPendingDelete(null)}
    >
      <Stack gap="md">
        <Text size="sm">{groupPendingDelete?.Name}</Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => setGroupPendingDelete(null)}>
            {t('Скасувати')}
          </Button>
          <Button
            color="red"
            loading={Boolean(deletingNetUid)}
            onClick={() => {
              const group = groupPendingDelete

              if (group) {
                setGroupPendingDelete(null)
                void handleDelete(group)
              }
            }}
          >
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
    </>
  )
}
