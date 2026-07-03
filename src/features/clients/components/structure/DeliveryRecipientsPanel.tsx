import {
  ActionIcon,
  Alert,
  Avatar,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { AppModal } from '../../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../../shared/ui/page-header-actions/PageHeaderActions'
import { useValueState } from '../../../../shared/hooks/useValueState'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  createDeliveryRecipient,
  getClientDeliveryRecipients,
  getClientDeliveryRecipientsWithDeleted,
  removeDeliveryRecipient,
} from '../../api/clientCabinetApi'
import type { DeliveryRecipient } from '../../types'
import { NewDeliveryRecipientModal } from './NewDeliveryRecipientModal'

const EMPTY_NET_UID = '00000000-0000-0000-0000-000000000000'

export type DeliveryRecipientsPanelProps = {
  clientId: number
  clientNetId: string
  includeDeleted?: boolean
  onChange?: (recipients: DeliveryRecipient[]) => void
}

function sortRecipients(recipients: DeliveryRecipient[]): DeliveryRecipient[] {
  return recipients.toSorted((a, b) => {
    if (Boolean(a.Deleted) === Boolean(b.Deleted)) {
      if (a.FullName) {
        return a.FullName.localeCompare(b.FullName || '')
      }

      return (a.NetUid || '').localeCompare(b.NetUid || '')
    }

    return a.Deleted ? 1 : -1
  })
}

export function DeliveryRecipientsPanel({
  clientId,
  clientNetId,
  includeDeleted = true,
  onChange,
}: DeliveryRecipientsPanelProps) {
  const { t } = useI18n()
  const [recipients, setRecipients] = useValueState<DeliveryRecipient[]>([])
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [deletingNetUid, setDeletingNetUid] = useValueState<string | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [modalOpened, setModalOpened] = useValueState(false)
  const [removeTarget, setRemoveTarget] = useValueState<DeliveryRecipient | null>(null)

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function loadRecipients() {
      setLoading(true)
      setError(null)

      try {
        const items = includeDeleted
          ? await getClientDeliveryRecipientsWithDeleted(clientNetId)
          : await getClientDeliveryRecipients(clientNetId)

        if (!cancelled) {
          setRecipients(sortRecipients(items))
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t('Не вдалося завантажити отримувачів'),
          )
          setRecipients([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRecipients()

    return () => {
      cancelled = true
    }
  }, [clientNetId, includeDeleted, setRecipients, setLoading, setError, t])

  const isBusy = isSaving || Boolean(deletingNetUid)

  async function reload() {
    const items = includeDeleted
      ? await getClientDeliveryRecipientsWithDeleted(clientNetId)
      : await getClientDeliveryRecipients(clientNetId)

    const sorted = sortRecipients(items)
    setRecipients(sorted)
    onChange?.(sorted)
  }

  async function handleCreate(name: string) {
    if (isBusy) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createDeliveryRecipient({
        Id: 0,
        NetUid: EMPTY_NET_UID,
        Deleted: false,
        FullName: name,
        ClientId: clientId,
      })

      await reload()
      setModalOpened(false)
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : t('Не вдалося створити отримувача'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!removeTarget || !removeTarget.NetUid || isBusy) {
      setRemoveTarget(null)
      return
    }

    const netUid = removeTarget.NetUid
    setDeletingNetUid(netUid)
    setError(null)

    try {
      await removeDeliveryRecipient(netUid)
      await reload()
      setRemoveTarget(null)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити отримувача'),
      )
    } finally {
      setDeletingNetUid(null)
    }
  }

  return (
    <Stack gap="md">
      <Card className="app-section-card" withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text fw={600}>{t('Отримувачі доставки')}</Text>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={isBusy}
              leftSection={<IconPlus size={16} />}
              size="xs"
              variant="light"
              onClick={() => setModalOpened(true)}
            >
              {t('Додати')}
            </Button>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader color="orange" size="sm" />
              <Text c="dimmed" size="sm">
                {t('Завантаження')}
              </Text>
            </Group>
          ) : recipients.length === 0 ? (
            <Text c="dimmed" size="sm" py="md">
              {t('Отримувачів не додано')}
            </Text>
          ) : (
            <Stack gap="xs">
              {recipients.map((recipient, index) => (
                <RecipientItem
                  key={recipient.NetUid || recipient.Id || index}
                  isDeleting={deletingNetUid === recipient.NetUid}
                  recipient={recipient}
                  onRemove={() => setRemoveTarget(recipient)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <NewDeliveryRecipientModal
        isSaving={isSaving}
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        onSave={(name) => void handleCreate(name)}
      />

      <AppModal
        centered
        opened={Boolean(removeTarget)}
        title={t('Ви впевнені, що хочете видалити?')}
        onClose={() => setRemoveTarget(null)}
      >
        <Stack gap="md">
          {removeTarget && (
            <Text fw={500} size="sm">
              {removeTarget.FullName?.trim()}
            </Text>
          )}
          <Group justify="flex-end">
            <Button color="gray" variant="subtle" onClick={() => setRemoveTarget(null)}>
              {t('Ні')}
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={Boolean(deletingNetUid)}
              onClick={() => void handleDelete()}
            >
              {t('Так')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function RecipientItem({
  recipient,
  isDeleting,
  onRemove,
}: {
  recipient: DeliveryRecipient
  isDeleting: boolean
  onRemove: () => void
}) {
  const fullName = recipient.FullName?.trim()
  const [isHovered, setHovered] = useState(false)

  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      style={{
        backgroundColor: isHovered ? 'var(--mantine-color-orange-0)' : undefined,
        borderColor: isHovered ? 'var(--mantine-color-orange-3)' : undefined,
        boxShadow: isHovered ? 'var(--mantine-shadow-xs)' : undefined,
        opacity: recipient.Deleted ? 0.55 : 1,
        transition: 'background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar color={recipient.Deleted ? 'gray' : CREATE_ACTION_COLOR} radius="xl">
            {fullName ? fullName.slice(0, 2).toUpperCase() : 'OO'}
          </Avatar>
          <Tooltip
            disabled={!fullName}
            label={fullName}
            multiline
            position="top-start"
            withArrow
            withinPortal
          >
            <Text fw={500} size="sm" truncate style={{ minWidth: 0 }}>
              {fullName}
            </Text>
          </Tooltip>
        </Group>

        {!recipient.Deleted && (
          <ActionIcon
            color="red"
            loading={isDeleting}
            variant="subtle"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
          >
            <IconTrash size={18} />
          </ActionIcon>
        )}
      </Group>
    </Card>
  )
}
