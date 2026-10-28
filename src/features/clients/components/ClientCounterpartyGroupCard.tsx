import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { FolderInput } from 'lucide-react'
import { useEffect, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getClientCounterpartyGroup,
  getCounterpartyGroupTree,
  moveClientsToCounterpartyGroup,
  type ClientCounterpartyGroupPlacement,
  type CounterpartyGroupNode,
} from '../api/counterpartyGroupsApi'
import { CounterpartyGroupPickerModal } from './CounterpartyGroupModals'

export function ClientCounterpartyGroupCard({ clientNetUid, canEdit }: { clientNetUid: string, canEdit: boolean }) {
  const { t } = useI18n()
  const [placement, setPlacement] = useValueState<ClientCounterpartyGroupPlacement | null>(null)
  const [groups, setGroups] = useValueState<CounterpartyGroupNode[]>([])
  const [opened, setOpened] = useValueState(false)
  const [saving, setSaving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    const controller = new AbortController()
    void getClientCounterpartyGroup(clientNetUid, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setPlacement(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setPlacement(null)
      })
    return () => controller.abort()
  }, [clientNetUid, reloadKey, setPlacement])

  const openPicker = async () => {
    setError(null)
    try {
      setGroups(await getCounterpartyGroupTree())
      setOpened(true)
    } catch (loadError) {
      notifications.show({ color: 'red', message: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити групи контрагентів.') })
    }
  }

  const move = async (groupNetUid: string) => {
    setSaving(true)
    setError(null)
    try {
      await moveClientsToCounterpartyGroup([clientNetUid], groupNetUid)
      notifications.show({ color: 'green', message: t('Групу контрагента змінено.') })
      setOpened(false)
      reload()
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : t('Не вдалося змінити групу контрагента.'))
    } finally {
      setSaving(false)
    }
  }

  if (!placement) return null

  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text className="client-section-title" fw={600}>{t('Група контрагентів')}</Text>
          <Text size="sm">{placement.GroupPath || placement.GroupName}</Text>
          <Group gap={6}>
            {!placement.IsPlaced ? <Badge color="gray" variant="light">{t('без групи')}</Badge>
              : placement.IsManuallyPlaced ? <Badge color="blue" variant="light">{t('змінено в GBA')}</Badge>
                : <Badge color="gray" variant="light">{t('з 1С')}</Badge>}
          </Group>
        </Stack>
        {canEdit ? (
          <Button leftSection={<FolderInput size={16} />} size="sm" variant="default" onClick={() => void openPicker()}>
            {t('Змінити групу')}
          </Button>
        ) : null}
      </Group>
      <CounterpartyGroupPickerModal
        currentNetUid={placement.IsPlaced ? placement.GroupNetUid : null}
        description={t('Звіти й список клієнтів одразу покажуть контрагента в новій групі. Синхронізація з 1С його не повертає.')}
        error={error}
        groups={groups}
        opened={opened}
        saving={saving}
        title={t('Змінити групу контрагента')}
        onClose={() => setOpened(false)}
        onSubmit={(groupNetUid) => void move(groupNetUid)}
      />
    </Card>
  )
}
