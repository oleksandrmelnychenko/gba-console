import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ArrowRightLeft, Play, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  markDataSyncStarted,
  reconcileDataSyncProgress,
  useDataSyncProgress,
} from '../../../shared/realtime/dataSyncProgressStore'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  createSyncOperationId,
  getSyncStatus,
  startDailySync,
  startFullSync,
} from '../api/syncApi'
import {
  createSyncStartOperation,
  type SyncStartDescriptor,
} from '../syncStartOperation'
import { allDailySyncTypes, defaultSelectedSyncTypes, syncTypeOptions } from '../syncOptions'
import { DailyDataSyncStockMode, type DataSyncStatus, type SyncRunResponse } from '../types'
import {
  getDefaultDailyRange,
  parseDateTimeInputValue,
  toDateTimeInputValue,
} from '../utils'
import { DailySyncTypeChecklist } from './DailySyncTypeChecklist'
import { SyncSessionPanel } from './SyncSessionPanel'
import { SyncTypeChecklist } from './SyncTypeChecklist'

type SyncMode = 'daily' | 'full'
type SyncSource = 'amg' | 'fenix'

type SyncState = {
  dailyFrom: Date
  dailyTo: Date
  isStarting: boolean
  isStatusRefreshing: boolean
  mode: SyncMode
  opened: boolean
  pendingRun: SyncMode | null
  selectedDailyTypes: string[]
  selectedSyncTypes: Record<string, boolean>
  source: SyncSource
  status: DataSyncStatus | null
  statusError: string
}

type SyncAction =
  | { type: 'opened' }
  | { type: 'closed' }
  | { type: 'modeChanged'; mode: SyncMode }
  | { type: 'sourceChanged'; source: SyncSource }
  | { type: 'statusRefreshStarted' }
  | { type: 'statusSucceeded'; status: DataSyncStatus }
  | { type: 'statusFailed'; message: string }
  | { type: 'syncStarted' }
  | { type: 'syncFinished' }
  | { type: 'confirmationRequested'; mode: SyncMode }
  | { type: 'confirmationCanceled' }
  | { type: 'syncTypeChanged'; key: string; checked: boolean }
  | { type: 'dailyTypesChanged'; types: string[] }
  | { type: 'dailyFromChanged'; date: Date }
  | { type: 'dailyToChanged'; date: Date }

const STATUS_POLL_INTERVAL_MS = 3_000

function createInitialSyncState(): SyncState {
  const dailyRange = getDefaultDailyRange()

  return {
    dailyFrom: dailyRange.from,
    dailyTo: dailyRange.to,
    isStarting: false,
    isStatusRefreshing: false,
    mode: 'full',
    opened: false,
    pendingRun: null,
    selectedDailyTypes: [...allDailySyncTypes],
    selectedSyncTypes: defaultSelectedSyncTypes,
    source: 'amg',
    status: null,
    statusError: '',
  }
}

function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'opened':
      return { ...state, opened: true }
    case 'closed':
      return { ...state, opened: false, pendingRun: null }
    case 'modeChanged':
      return { ...state, mode: action.mode, pendingRun: null }
    case 'sourceChanged':
      return { ...state, source: action.source, pendingRun: null }
    case 'statusRefreshStarted':
      return { ...state, isStatusRefreshing: true }
    case 'statusSucceeded':
      return {
        ...state,
        isStatusRefreshing: false,
        status: action.status,
        statusError: '',
      }
    case 'statusFailed':
      return {
        ...state,
        isStatusRefreshing: false,
        statusError: action.message,
      }
    case 'syncStarted':
      return { ...state, isStarting: true, pendingRun: null }
    case 'syncFinished':
      return { ...state, isStarting: false }
    case 'confirmationRequested':
      return { ...state, pendingRun: action.mode }
    case 'confirmationCanceled':
      return { ...state, pendingRun: null }
    case 'syncTypeChanged':
      return {
        ...state,
        pendingRun: null,
        selectedSyncTypes: {
          ...state.selectedSyncTypes,
          [action.key]: action.checked,
        },
      }
    case 'dailyTypesChanged':
      return {
        ...state,
        pendingRun: null,
        selectedDailyTypes: getKnownDailyTypes(action.types),
      }
    case 'dailyFromChanged':
      return { ...state, dailyFrom: action.date, pendingRun: null }
    case 'dailyToChanged':
      return { ...state, dailyTo: action.date, pendingRun: null }
    default:
      return state
  }
}

export function SyncControl() {
  const { t } = useI18n()
  const dataSyncProgress = useDataSyncProgress()
  const [state, dispatch] = useReducer(syncReducer, undefined, createInitialSyncState)
  const syncStartOperationRef = useRef<ReturnType<typeof createSyncStartOperation> | null>(null)
  syncStartOperationRef.current ??= createSyncStartOperation(createSyncOperationId)
  const syncStartOperation = syncStartOperationRef.current

  const loadStatus = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) {
      dispatch({ type: 'statusRefreshStarted' })
    }

    try {
      const status = await getSyncStatus()
      syncStartOperation.reconcile(status)
      reconcileDataSyncProgress(status.IsInProgress || status.IsGlobalLockHeld)
      dispatch({ type: 'statusSucceeded', status })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('Не вдалося отримати статус синхронізації')
      dispatch({ type: 'statusFailed', message })
    }
  }, [syncStartOperation, t])

  const handleRealtimeSyncNotification = useCallback(
    () => {
      void loadStatus(false)
    },
    [loadStatus],
  )

  useRealtimeEvent(realtimeEvents.dataSyncNotification, handleRealtimeSyncNotification)

  useEffect(() => {
    if (!state.opened) {
      return undefined
    }

    void loadStatus(true)

    const intervalId = window.setInterval(() => {
      void loadStatus(false)
    }, STATUS_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadStatus, state.opened])

  const isServerSyncActive = Boolean(
    state.status?.IsInProgress ||
      state.status?.IsGlobalLockHeld ||
      state.status?.ActiveRun?.Status === 'Running',
  )
  const isSyncInProgress = state.isStarting || isServerSyncActive || dataSyncProgress.isActive
  const isStatusUnknown =
    !state.status ||
    state.status.IsGlobalLockStatusAvailable !== true ||
    Boolean(state.statusError)
  const isStartBlocked = isSyncInProgress || state.isStatusRefreshing || isStatusUnknown
  const sourceForAmg = state.source === 'amg'
  const selectedFullTypeCount = syncTypeOptions.filter(
    (option) => state.selectedSyncTypes[option.value],
  ).length

  function requestFullSync() {
    if (selectedFullTypeCount === 0) {
      notifications.show({ color: 'red', message: t('Оберіть типи синхронізації') })
      return
    }

    dispatch({ type: 'confirmationRequested', mode: 'full' })
  }

  function requestDailySync() {
    if (state.selectedDailyTypes.length === 0) {
      notifications.show({ color: 'red', message: t('Оберіть типи синхронізації') })
      return
    }

    if (state.dailyFrom.getTime() > state.dailyTo.getTime()) {
      notifications.show({ color: 'red', message: t('Дата початку має бути раніше дати завершення') })
      return
    }

    dispatch({ type: 'confirmationRequested', mode: 'daily' })
  }

  async function runConfirmedSync() {
    if (state.pendingRun === 'full') {
      const types = getSelectedFullSyncTypes(state.selectedSyncTypes)
      await runSyncRequest({
        forAmg: sourceForAmg,
        mode: 'full',
        types,
      }, (operationId) =>
        startFullSync({
          forAmg: sourceForAmg,
          operationId,
          types,
        }),
      )
      return
    }

    if (state.pendingRun === 'daily') {
      await runSyncRequest({
        forAmg: sourceForAmg,
        from: state.dailyFrom,
        mode: 'daily',
        stockMode: DailyDataSyncStockMode.DocumentsOnly,
        to: state.dailyTo,
        types: state.selectedDailyTypes,
      }, (operationId) =>
        startDailySync({
          forAmg: sourceForAmg,
          from: state.dailyFrom,
          operationId,
          stockMode: DailyDataSyncStockMode.DocumentsOnly,
          to: state.dailyTo,
          types: state.selectedDailyTypes,
        }),
      )
    }
  }

  async function runSyncRequest(
    descriptor: SyncStartDescriptor,
    request: (operationId: string) => Promise<SyncRunResponse>,
  ) {
    if (isStartBlocked) {
      notifications.show({ color: 'yellow', message: t('Синхронізація вже виконується') })
      return
    }

    dispatch({ type: 'syncStarted' })

    let operationId = ''
    try {
      operationId = syncStartOperation.getOrCreate(descriptor)
      const response = await request(operationId)
      syncStartOperation.complete(operationId)
      const message = response?.Message || t('Синхронізацію запущено')
      markDataSyncStarted(message)
      notifications.show({ color: 'green', message })
      await loadStatus(false)
    } catch (error) {
      if (operationId) {
        syncStartOperation.handleFailure(operationId, error)
      }
      const message = error instanceof Error ? error.message : t('Не вдалося запустити синхронізацію')
      notifications.show({ color: 'red', message })
      await loadStatus(false)
    } finally {
      dispatch({ type: 'syncFinished' })
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
          <ArrowRightLeft size={24} strokeWidth={1.7} />
        </ActionIcon>
      </Tooltip>

      <AppModal
        opened={state.opened}
        onClose={() => dispatch({ type: 'closed' })}
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Синхронізація 1С')}</span>}
        size="xl"
        className="sync-modal"
        centered
      >
        <Stack gap="md">
          <SyncSessionPanel
            isRefreshing={state.isStatusRefreshing}
            onRefresh={() => void loadStatus(true)}
            progressMessage={isServerSyncActive ? dataSyncProgress.message : ''}
            status={state.status}
            statusError={state.statusError}
          />

          <SegmentedControl
            aria-label={t('Режим синхронізації')}
            className="sync-mode-control"
            fullWidth
            value={state.mode}
            onChange={(value) => dispatch({ type: 'modeChanged', mode: value as SyncMode })}
            data={[
              {
                value: 'full',
                label: <SyncModeLabel full={t('Повна синхронізація')} short={t('Повна')} />,
              },
              {
                value: 'daily',
                label: <SyncModeLabel full={t('Щоденна синхронізація')} short={t('Щоденна')} />,
              },
            ]}
          />

          <Box className="sync-config-panel">
            <Group justify="space-between" align="center" gap="md" wrap="wrap">
              <Box>
                <Text className="app-section-title" fw={600} size="sm">
                  {t(state.mode === 'full' ? 'Повна синхронізація' : 'Щоденна синхронізація')}
                </Text>
                <Text c="dimmed" size="xs">
                  {t('Джерело 1С')}
                </Text>
              </Box>
              <SegmentedControl
                aria-label={t('Джерело 1С')}
                className="sync-source-control"
                value={state.source}
                onChange={(value) => dispatch({ type: 'sourceChanged', source: value as SyncSource })}
                data={[
                  { value: 'amg', label: 'AMG' },
                  { value: 'fenix', label: 'FENIX' },
                ]}
              />
            </Group>

            <Divider my="md" />

            {state.mode === 'full' ? (
              <SyncTypeChecklist
                selectedTypes={state.selectedSyncTypes}
                onChange={(key, checked) => dispatch({ type: 'syncTypeChanged', key, checked })}
              />
            ) : (
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
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
                </SimpleGrid>

                <Group gap="xs" className="sync-safe-mode">
                  <ShieldCheck size={17} strokeWidth={1.8} />
                  <Text fw={600} size="xs">
                    {t('Без зміни залишків')}
                  </Text>
                </Group>

                <DailySyncTypeChecklist
                  selectedTypes={state.selectedDailyTypes}
                  onChange={(types) => dispatch({ type: 'dailyTypesChanged', types })}
                />
              </Stack>
            )}
          </Box>

          {state.pendingRun ? (
            <SyncConfirmation
              mode={state.pendingRun}
              source={state.source}
              onCancel={() => dispatch({ type: 'confirmationCanceled' })}
              onConfirm={() => void runConfirmedSync()}
              isLoading={state.isStarting}
            />
          ) : (
            <Group justify="flex-end" className="sync-action-bar">
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={isStartBlocked}
                leftSection={<Play size={16} strokeWidth={1.9} />}
                loading={state.isStarting}
                onClick={state.mode === 'full' ? requestFullSync : requestDailySync}
              >
                {t(state.mode === 'full' ? 'Запустити повну синхронізацію' : 'Запустити щоденну синхронізацію')}
              </Button>
            </Group>
          )}
        </Stack>
      </AppModal>
    </>
  )
}

function SyncConfirmation({
  isLoading,
  mode,
  onCancel,
  onConfirm,
  source,
}: {
  isLoading: boolean
  mode: SyncMode
  onCancel: () => void
  onConfirm: () => void
  source: SyncSource
}) {
  const { t } = useI18n()

  return (
    <Group justify="space-between" gap="md" className="sync-confirmation" wrap="wrap">
      <Box>
        <Text fw={650} size="sm">
          {t('Підтвердити запуск')}
        </Text>
        <Text c="dimmed" size="xs">
          {t(mode === 'full' ? 'Повна синхронізація' : 'Щоденна синхронізація')} ·{' '}
          {source === 'amg' ? 'AMG' : 'FENIX'}
        </Text>
      </Box>
      <Group gap="xs">
        <Button color="gray" disabled={isLoading} onClick={onCancel} variant="subtle">
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} loading={isLoading} onClick={onConfirm}>
          {t('Запустити')}
        </Button>
      </Group>
    </Group>
  )
}

function getKnownDailyTypes(types: string[]): string[] {
  const selectedTypes = new Set(types)
  return allDailySyncTypes.filter((type) => selectedTypes.has(type))
}

function getSelectedFullSyncTypes(selectedTypes: Record<string, boolean>): string[] {
  const result: string[] = []

  for (const option of syncTypeOptions) {
    if (selectedTypes[option.value]) {
      result.push(option.value)
    }
  }

  return result
}

function SyncModeLabel({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="sync-mode-label-long">{full}</span>
      <span className="sync-mode-label-short">{short}</span>
    </>
  )
}
