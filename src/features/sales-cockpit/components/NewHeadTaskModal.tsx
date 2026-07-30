import { Button, Group, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { createHeadTask, getHeadClients } from '../api/salesCockpitApi'
import type { CockpitUrgency, HeadClient, HeadTaskManager } from '../types'

const URGENCY_OPTIONS: { value: CockpitUrgency; label: string }[] = [
  { value: 'critical', label: 'Критично' },
  { value: 'high', label: 'Високий' },
  { value: 'normal', label: 'Звичайний' },
  { value: 'low', label: 'Низький' },
]

export function NewHeadTaskModal({
  opened,
  managers,
  onClose,
  onCreated,
}: {
  opened: boolean
  managers: HeadTaskManager[]
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useI18n()
  const [managerId, setManagerId] = useValueState<string | null>(null)
  const [clientId, setClientId] = useValueState<string | null>(null)
  const [clients, setClients] = useValueState<HeadClient[]>([])
  const [loadedClientsManagerId, setLoadedClientsManagerId] = useState<string | null>(null)
  const [title, setTitle] = useValueState('')
  const [description, setDescription] = useValueState('')
  const [urgency, setUrgency] = useValueState<CockpitUrgency>('high')
  const [dueDate, setDueDate] = useValueState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!opened) {
      setManagerId(null)
      setClientId(null)
      setClients([])
      setTitle('')
      setDescription('')
      setUrgency('high')
      setDueDate('')
    }
  }, [opened, setClientId, setClients, setDescription, setDueDate, setManagerId, setTitle, setUrgency])

  useEffect(() => {
    setClientId(null)
    setClients([])

    if (!managerId) {
      return
    }

    let cancelled = false

    getHeadClients(Number(managerId))
      .then((result) => {
        if (!cancelled) {
          setClients(result.clients)
        }
      })
      .catch(() => {
        /* клієнт для задачі необовʼязковий — падіння списку не блокує створення */
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedClientsManagerId(managerId)
        }
      })

    return () => {
      cancelled = true
    }
  }, [managerId, setClientId, setClients])

  const managerOptions = useMemo(
    () =>
      managers.map((manager) => ({
        value: String(manager.ManagerId),
        label: manager.Name?.trim() || `#${manager.ManagerId}`,
      })),
    [managers],
  )

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: String(client.client_id),
        label: (client.full_name || client.name || `#${client.client_id}`).trim(),
      })),
    [clients],
  )

  const trimmedTitle = title.trim()
  const canSubmit = Boolean(managerId && trimmedTitle)
  const clientsLoading = Boolean(managerId && loadedClientsManagerId !== managerId)

  async function handleSubmit() {
    if (!managerId || !trimmedTitle) {
      return
    }

    setSaving(true)

    try {
      await createHeadTask({
        ManagerId: Number(managerId),
        ClientId: clientId ? Number(clientId) : undefined,
        Title: trimmedTitle,
        Description: description.trim() || undefined,
        Urgency: urgency,
        // end-of-workday Kyiv deadline for the chosen date
        DueDate: dueDate ? `${dueDate}T15:00:00Z` : undefined,
      })
      notifications.show({ color: 'green', message: t('Задачу призначено менеджеру') })
      onCreated()
      onClose()
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося створити задачу'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal
      opened={opened}
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Нова задача для менеджера')}</span>}
      onClose={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <Stack gap="md">
        <Select
          required
          data={managerOptions}
          disabled={saving}
          label={t('Менеджер')}
          placeholder={t('Оберіть менеджера')}
          searchable
          value={managerId}
          onChange={setManagerId}
        />

        <Select
          clearable
          data={clientOptions}
          disabled={saving || !managerId}
          label={t('Клієнт (необовʼязково)')}
          nothingFoundMessage={clientsLoading ? t('Завантаження…') : t('Нічого не знайдено')}
          placeholder={managerId ? t('Оберіть клієнта') : t('Спершу оберіть менеджера')}
          searchable
          value={clientId}
          onChange={setClientId}
        />

        <TextInput
          required
          disabled={saving}
          label={t('Задача')}
          maxLength={200}
          placeholder={t('Що потрібно зробити?')}
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />

        <Textarea
          autosize
          disabled={saving}
          label={t('Деталі (необовʼязково)')}
          maxLength={2000}
          minRows={2}
          placeholder={t('Контекст, очікуваний результат…')}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />

        <Group grow>
          <Select
            data={URGENCY_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))}
            disabled={saving}
            label={t('Терміновість')}
            value={urgency}
            onChange={(value) => setUrgency((value as CockpitUrgency) ?? 'high')}
          />
          <TextInput
            disabled={saving}
            label={t('Термін (необовʼязково)')}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.currentTarget.value)}
          />
        </Group>

        <Text c="dimmed" size="xs">
          {t('Менеджер побачить задачу першою у своєму кокпіті. Ви бачитимете виконання на цій дошці.')}
        </Text>

        <Group justify="flex-end">
          <Button color="gray" disabled={saving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color={CREATE_ACTION_COLOR} disabled={!canSubmit} loading={saving} onClick={handleSubmit}>
            {t('Призначити задачу')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
