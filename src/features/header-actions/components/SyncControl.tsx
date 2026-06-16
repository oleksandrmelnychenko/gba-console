import {
  ActionIcon,
  Box,
  Button,
  Group,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowsExchange2 } from '@tabler/icons-react'
import { useCallback, useEffect, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { markDataSyncStarted } from '../../../shared/realtime/dataSyncProgressStore'
import { realtimeEvents, useRealtimeEvent, type DataSyncNotification } from '../../../shared/realtime/events'
import { getSyncHistory, startDailySync, startGbaToOneCSync, startRemnantsSync } from '../api/syncApi'
import { TypeOfXmlDocument, type SyncHistoryItem, type SyncRunResponse } from '../types'
import {
  getDefaultDailyRange,
  getLastWeekRange,
  parseDateInputValue,
  parseDateTimeInputValue,
  toDateInputValue,
  toDateTimeInputValue,
} from '../utils'
import { allDailySyncTypes, defaultSelectedSyncTypes, syncTypeOptions } from '../syncOptions'
import { AppModal } from '../../../shared/ui/AppModal'
import { DailySyncTypeChecklist } from './DailySyncTypeChecklist'
import { SyncTypeChecklist } from './SyncTypeChecklist'
import { SyncHistoryPanel } from './SyncHistoryPanel'

type SyncTab = 'fenix' | 'amg' | 'gba-to-1c' | 'daily'

const syncTabs: { value: SyncTab; label: (t: (key: 'Вигрузка GBA в 1С' | 'Щоденна синхронізація') => string) => string }[] = [
  { value: 'fenix', label: () => 'FENIX' },
  { value: 'amg', label: () => 'AMG' },
  { value: 'gba-to-1c', label: (t) => t('Вигрузка GBA в 1С') },
  { value: 'daily', label: (t) => t('Щоденна синхронізація') },
]

type SyncState = {
  activeTab: SyncTab
  dailyForAmg: string
  dailyFrom: Date
  dailyTo: Date
  documentType: string
  fromDate: Date
  history: SyncHistoryItem[]
  isHistoryLoading: boolean
  isSyncing: boolean
  messages: string[]
  opened: boolean
  selectedDailyTypes: string[]
  selectedSyncTypes: Record<string, boolean>
  toDate: Date
}

type SyncAction =
  | { type: 'opened' }
  | { type: 'closed' }
  | { type: 'tabChanged'; tab: SyncTab }
  | { type: 'historyStarted' }
  | { type: 'historySucceeded'; history: SyncHistoryItem[] }
  | { type: 'historyFailed'; message: string }
  | { type: 'syncNotification'; isFinished: boolean; message: string }
  | { type: 'syncStarted' }
  | { type: 'syncSucceeded'; message: string }
  | { type: 'syncFailed'; message: string }
  | { type: 'syncTypeChanged'; key: string; checked: boolean }
  | { type: 'dailyTypesChanged'; types: string[] }
  | { type: 'dailyOrganisationChanged'; value: string }
  | { type: 'fromDateChanged'; date: Date }
  | { type: 'toDateChanged'; date: Date }
  | { type: 'dailyFromChanged'; date: Date }
  | { type: 'dailyToChanged'; date: Date }
  | { type: 'documentTypeChanged'; value: string }

function createInitialSyncState(): SyncState {
  const dailyRange = getDefaultDailyRange()

  return {
    activeTab: 'amg',
    dailyForAmg: 'true',
    dailyFrom: dailyRange.from,
    dailyTo: dailyRange.to,
    documentType: String(TypeOfXmlDocument.Sales),
    fromDate: new Date(),
    history: [],
    isHistoryLoading: false,
    isSyncing: false,
    messages: [],
    opened: false,
    selectedDailyTypes: [],
    selectedSyncTypes: defaultSelectedSyncTypes,
    toDate: new Date(),
  }
}

function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'opened':
      return {
        ...state,
        opened: true,
      }
    case 'closed':
      return {
        ...state,
        messages: [],
        opened: false,
        selectedSyncTypes: defaultSelectedSyncTypes,
      }
    case 'tabChanged':
      return {
        ...state,
        activeTab: action.tab,
      }
    case 'historyStarted':
      return {
        ...state,
        isHistoryLoading: true,
      }
    case 'historySucceeded':
      return {
        ...state,
        history: action.history,
        isHistoryLoading: false,
      }
    case 'historyFailed':
      return {
        ...state,
        history: [],
        isHistoryLoading: false,
        messages: [action.message, ...state.messages],
      }
    case 'syncNotification':
      return {
        ...state,
        isSyncing: !action.isFinished,
        messages: appendSyncMessage(state.messages, action.message),
      }
    case 'syncStarted':
      return {
        ...state,
        isSyncing: true,
      }
    case 'syncSucceeded':
      return {
        ...state,
        isSyncing: false,
        messages: [action.message, ...state.messages],
      }
    case 'syncFailed':
      return {
        ...state,
        isSyncing: false,
        messages: [action.message, ...state.messages],
      }
    case 'syncTypeChanged':
      return {
        ...state,
        selectedSyncTypes: {
          ...state.selectedSyncTypes,
          [action.key]: action.checked,
        },
      }
    case 'dailyTypesChanged':
      return {
        ...state,
        selectedDailyTypes: getKnownDailyTypes(action.types),
      }
    case 'dailyOrganisationChanged':
      return {
        ...state,
        dailyForAmg: action.value,
      }
    case 'fromDateChanged':
      return {
        ...state,
        fromDate: action.date,
      }
    case 'toDateChanged':
      return {
        ...state,
        toDate: action.date,
      }
    case 'dailyFromChanged':
      return {
        ...state,
        dailyFrom: action.date,
      }
    case 'dailyToChanged':
      return {
        ...state,
        dailyTo: action.date,
      }
    case 'documentTypeChanged':
      return {
        ...state,
        documentType: action.value,
      }
    default:
      return state
  }
}

export function SyncControl() {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(syncReducer, undefined, createInitialSyncState)
  const handleRealtimeSyncNotification = useCallback((notification: DataSyncNotification) => {
    dispatch({
      isFinished: Boolean(notification.StopProgressBar || notification.IsError),
      message: notification.DisplayMessage || '',
      type: 'syncNotification',
    })
  }, [])

  useRealtimeEvent(realtimeEvents.dataSyncNotification, handleRealtimeSyncNotification)

  useEffect(() => {
    if (!state.opened || state.activeTab === 'gba-to-1c') {
      return undefined
    }

    let cancelled = false
    const range = getLastWeekRange()
    const forAmg = getHistoryForAmg(state.activeTab, state.dailyForAmg)

    dispatch({ type: 'historyStarted' })

    getSyncHistory({
      forAmg,
      from: range.from,
      to: range.to,
    })
      .then((history) => {
        if (!cancelled) {
          dispatch({ type: 'historySucceeded', history })
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          dispatch({ type: 'historyFailed', message: error.message })
        }
      })

    return () => {
      cancelled = true
    }
  }, [state.activeTab, state.dailyForAmg, state.opened])

  async function runRemnantsSync(forAmg: boolean) {
    const types: string[] = []

    for (const option of syncTypeOptions) {
      if (state.selectedSyncTypes[option.value]) {
        types.push(option.value)
      }
    }

    if (types.length === 0) {
      notifications.show({ color: 'red', message: t('Оберіть типи синхронізації') })
      return
    }

    if (!confirm(t('Ви впевнені, що хочете синхронізувати?'))) {
      return
    }

    await runSyncRequest(() => startRemnantsSync({ forAmg, types }))
  }

  async function runGbaToOneCSync() {
    if (!confirm(t('Ви впевнені, що хочете синхронізувати?'))) {
      return
    }

    await runSyncRequest(() =>
      startGbaToOneCSync({
        from: state.fromDate,
        to: state.toDate,
        typeDocument: Number(state.documentType) as TypeOfXmlDocument,
      }),
    )
  }

  async function runDailySync() {
    if (state.selectedDailyTypes.length === 0) {
      notifications.show({ color: 'red', message: t('Оберіть типи синхронізації') })
      return
    }

    if (!confirm(t('Ви впевнені, що хочете синхронізувати?'))) {
      return
    }

    await runSyncRequest(() =>
      startDailySync({
        forAmg: state.dailyForAmg === 'true',
        from: state.dailyFrom,
        to: state.dailyTo,
        types: state.selectedDailyTypes,
      }),
    )
  }

  const isEveryDailyTypeSelected = state.selectedDailyTypes.length === allDailySyncTypes.length

  async function runSyncRequest(request: () => Promise<SyncRunResponse>) {
    dispatch({ type: 'syncStarted' })

    try {
      const response = await request()
      const message = response?.Message || t('Синхронізацію запущено')
      markDataSyncStarted(message)
      dispatch({ type: 'syncSucceeded', message })
      notifications.show({ color: 'green', message })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Не вдалося запустити синхронізацію')
      dispatch({ type: 'syncFailed', message })
      notifications.show({ color: 'red', message })
    }
  }

  return (
    <>
      <Tooltip label={t('1С синхронізація')} openDelay={300}>
        <ActionIcon
          aria-label={t('1С синхронізація')}
          className="console-header-action"
          variant="subtle"
          color="gray"
          size="lg"
          onClick={() => dispatch({ type: 'opened' })}
        >
          <IconArrowsExchange2 size={24} stroke={1.7} />
        </ActionIcon>
      </Tooltip>

      <AppModal
        opened={state.opened}
        onClose={() => dispatch({ type: 'closed' })}
        title={t('Синхронізація')}
        size="xl"
        className="sync-modal"
        centered
      >
        <Stack gap="md">
          <Group gap={6} wrap="wrap" className="sync-pills">
            {syncTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`sync-pill${state.activeTab === tab.value ? ' is-active' : ''}`}
                onClick={() => dispatch({ type: 'tabChanged', tab: tab.value })}
                aria-pressed={state.activeTab === tab.value}
              >
                {tab.label(t)}
              </button>
            ))}
          </Group>

          <Stack gap="md" className="sync-resizable">
          <Box className="sync-panel">
            {(state.activeTab === 'fenix' || state.activeTab === 'amg') && (
              <Stack gap="md">
                <SyncHistoryPanel history={state.history} isLoading={state.isHistoryLoading} />
                <RemnantsSyncSection
                  isLoading={state.isSyncing}
                  selectedTypes={state.selectedSyncTypes}
                  title={t('Залишки з 1С в GBA')}
                  onRun={() => runRemnantsSync(state.activeTab === 'amg')}
                  onTypeChange={(key, checked) => dispatch({ type: 'syncTypeChanged', key, checked })}
                />
              </Stack>
            )}

            {state.activeTab === 'gba-to-1c' && (
              <Stack gap="md">
                <SyncSectionHeader title={t('Вигрузка GBA в 1С')} />
                <Group gap="sm" align="end" wrap="wrap">
                  <TextInput
                    label={t('З')}
                    type="date"
                    value={toDateInputValue(state.fromDate)}
                    onChange={(event) =>
                      dispatch({
                        type: 'fromDateChanged',
                        date: parseDateInputValue(event.currentTarget.value, state.fromDate),
                      })
                    }
                  />
                  <TextInput
                    label={t('По')}
                    type="date"
                    value={toDateInputValue(state.toDate)}
                    onChange={(event) =>
                      dispatch({
                        type: 'toDateChanged',
                        date: parseDateInputValue(event.currentTarget.value, state.toDate, true),
                      })
                    }
                  />
                  <Select
                    label={t('Тип')}
                    value={state.documentType}
                    onChange={(value) => value && dispatch({ type: 'documentTypeChanged', value })}
                    data={[
                      { value: String(TypeOfXmlDocument.Sales), label: t('Продажі') },
                      { value: String(TypeOfXmlDocument.ProductIncomes), label: t('Прихідні накладні на товар') },
                    ]}
                  />
                  <Button color="violet" loading={state.isSyncing} onClick={runGbaToOneCSync}>
                    {t('Синхронізувати')}
                  </Button>
                </Group>
              </Stack>
            )}

            {state.activeTab === 'daily' && (
              <Stack gap="md">
                <SyncHistoryPanel history={state.history} isLoading={state.isHistoryLoading} />
                <SyncSectionHeader title={t('Щоденна синхронізація руху товарів')} />
                <Group gap="sm" align="end" wrap="wrap">
                  <TextInput
                    label={t('З')}
                    type="datetime-local"
                    value={toDateTimeInputValue(state.dailyFrom)}
                    onChange={(event) =>
                      dispatch({
                        type: 'dailyFromChanged',
                        date: parseDateTimeInputValue(event.currentTarget.value, state.dailyFrom),
                      })
                    }
                  />
                  <TextInput
                    label={t('По')}
                    type="datetime-local"
                    value={toDateTimeInputValue(state.dailyTo)}
                    onChange={(event) =>
                      dispatch({
                        type: 'dailyToChanged',
                        date: parseDateTimeInputValue(event.currentTarget.value, state.dailyTo),
                      })
                    }
                  />
                  <Select
                    label={t('Організація')}
                    value={state.dailyForAmg}
                    onChange={(value) => value && dispatch({ type: 'dailyOrganisationChanged', value })}
                    data={[
                      { value: 'true', label: 'AMG' },
                      { value: 'false', label: 'FENIX' },
                    ]}
                  />
                </Group>
                <DailySyncTypeChecklist
                  selectedTypes={state.selectedDailyTypes}
                  onChange={(types) => dispatch({ type: 'dailyTypesChanged', types })}
                />
                <Group justify="flex-end">
                  <Button
                    color="violet"
                    loading={state.isSyncing}
                    onClick={() =>
                      dispatch({
                        type: 'dailyTypesChanged',
                        types: isEveryDailyTypeSelected ? [] : allDailySyncTypes,
                      })
                    }
                    variant="light"
                  >
                    {t(isEveryDailyTypeSelected ? 'Скинути' : 'Вибрати всі')}
                  </Button>
                  <Button color="violet" loading={state.isSyncing} onClick={runDailySync}>
                    {t('Синхронізувати')}
                  </Button>
                </Group>
              </Stack>
            )}
          </Box>

          <Box className={`sync-messages${state.isSyncing ? ' is-active' : ''}`}>
            <Group justify="space-between" mb={8}>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                {t('Процес синхронізації')}
              </Text>
              <Box className="sync-messages-pulse" data-active={state.isSyncing} />
            </Group>
            <ScrollArea h={108} type="auto">
              {state.messages.length === 0 ? (
                <Text size="xs" c="dimmed" className="sync-message-empty">
                  {state.isSyncing ? t('Очікування…') : t('Лог появиться тут')}
                </Text>
              ) : (
                <Stack gap={3}>
                  {state.messages.map((message, index) => (
                    // Messages are only prepended, so (length - index) is stable per row —
                    // existing rows keep their key and don't remount (only the new row animates),
                    // which stops the whole log from re-flashing on every notification.
                    <Text key={state.messages.length - index} size="xs" className="sync-message tx-text-swap">
                      {message}
                    </Text>
                  ))}
                </Stack>
              )}
            </ScrollArea>
          </Box>
          </Stack>
        </Stack>
      </AppModal>
    </>
  )
}

function getHistoryForAmg(activeTab: SyncTab, dailyForAmg: string): boolean {
  return activeTab === 'daily' ? dailyForAmg === 'true' : activeTab === 'amg'
}

function getKnownDailyTypes(types: string[]): string[] {
  const selectedTypes = new Set(types)

  return allDailySyncTypes.filter((type) => selectedTypes.has(type))
}

function appendSyncMessage(messages: string[], message: string): string[] {
  const nextMessage = message.trim()

  if (!nextMessage) {
    return messages
  }

  return [nextMessage, ...messages]
}

function RemnantsSyncSection({
  isLoading,
  onRun,
  onTypeChange,
  selectedTypes,
  title,
}: {
  isLoading: boolean
  onRun: () => void
  onTypeChange: (key: string, checked: boolean) => void
  selectedTypes: Record<string, boolean>
  title: string
}) {
  const { t } = useI18n()

  return (
    <Stack gap="md" className="sync-modal-section">
      <SyncSectionHeader title={title} />
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <SyncTypeChecklist selectedTypes={selectedTypes} onChange={onTypeChange} />
        <Button color="violet" loading={isLoading} onClick={onRun} className="sync-run-button">
          {t('Синхронізувати')}
        </Button>
      </Group>
    </Stack>
  )
}

function SyncSectionHeader({ title }: { title: string }) {
  return (
    <Text fw={700} size="lg" lh={1.2}>
      {title}
    </Text>
  )
}
