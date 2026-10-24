import { useSingleFlight } from '../../../../shared/hooks/useSingleFlight'
import { useBusyState } from '../../../../shared/hooks/useBusyState'
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
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'
import { CircleAlert, FolderTree, Plus, Save, Trash2, X } from 'lucide-react'
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
import './groups-modal.css'

export type GroupsModalProps = {
  canManage: boolean
  opened: boolean
  clientId: number
  clientNetId: string
  onClose: () => void
  onChange?: (groups: ClientGroup[]) => void
}

export function GroupsModal({ canManage, opened, clientId, clientNetId, onClose, onChange }: GroupsModalProps) {
  const runActionOnce = useSingleFlight()
  const { t } = useI18n()
  const [groups, setGroups] = useValueState<ClientGroup[]>([])
  const [name, setName] = useValueState('')
  const [editingGroup, setEditingGroup] = useValueState<ClientGroup | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSubmitting, setSubmitting, tryStartSubmitting] = useBusyState()
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
    if (!canManage) {
      return
    }

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
    if (!canManage || !trimmedName || isBusy) {
      return
    }

    if (!tryStartSubmitting()) {
      return
    }
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
    return runActionOnce('handleDelete', async () => {
      if (!canManage || isBusy || !group.NetUid) {
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
    })
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
      className="client-groups-modal"
      size={420}
      closeOnClickOutside={!isBusy}
      opened={opened}
      title={t('Підгрупи')}
      onClose={handleClose}
    >
      <Stack gap={12}>
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Group className="client-groups-form" align="flex-end" gap={8} wrap="nowrap">
          <TextInput
            disabled={!canManage || isBusy}
            maxLength={100}
            aria-label={t('Назва групи')}
            size="sm"
            rightSection={name || isEditing ? (
              <ActionIcon aria-label={t('Очистити назву групи')} color="gray" disabled={!canManage || isBusy} size="sm" variant="subtle" onClick={resetForm}>
                <X size={14} />
              </ActionIcon>
            ) : null}
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
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={!canManage || !trimmedName || Boolean(deletingNetUid)}
            size="sm"
            leftSection={isEditing ? <Save size={15} /> : <Plus size={15} />}
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
          <Group className="client-groups-empty" gap={8}>
            <FolderTree size={18} aria-hidden="true" />
            <Text size="sm">{t('Груп не додано')}</Text>
          </Group>
        ) : (
          <Stack className="client-groups-list" gap={4}>
            {groups.map((group) => (
              <Group
                key={group.NetUid || group.Id}
                align="center"
                gap="xs"
                justify="space-between"
                wrap="nowrap"
                className={`client-groups-row${editingGroup?.NetUid === group.NetUid ? ' is-editing' : ''}`}
              >
                <UnstyledButton
                  disabled={!canManage || isBusy}
                  style={{ flex: 1, minWidth: 0 }}
                  onClick={() => selectGroup(group)}
                >
                  <Text size="sm" truncate>
                    {group.Name}
                  </Text>
                </UnstyledButton>
                {canManage && <ActionIcon
                  aria-label={`${t('Видалити групу')}: ${group.Name}`}
                  color="red"
                  disabled={isBusy}
                  loading={deletingNetUid === group.NetUid}
                  variant="subtle"
                  onClick={() => setGroupPendingDelete(group)}
                >
                  <Trash2 size={16} />
                </ActionIcon>}
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </AppModal>

    {canManage && <AppModal
      centered
      opened={Boolean(groupPendingDelete)}
      title={t('Ви впевнені, що хочете видалити групу?')}
      onClose={() => setGroupPendingDelete(null)}
    >
      <Stack className="app-compact-form" gap="md">
        <Text size="sm">{groupPendingDelete?.Name}</Text>
        <AppModalFooter>
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
        </AppModalFooter>
      </Stack>
    </AppModal>}
    </>
  )
}
