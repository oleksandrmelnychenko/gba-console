import {
  ActionIcon,
  Box,
  Button,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ArrowRightLeft, Play } from 'lucide-react'
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
  startSyncSession,
} from '../api/syncApi'
import {
  createSyncStartOperation,
  type SyncStartDescriptor,
} from '../syncStartOperation'
import {
  createInitialSyncState,
  getFirstSyncDateRangeError,
  getSessionDocumentTypes,
  getTodaySyncDate,
  hasSyncDateRangeErrors,
  syncReducer,
  type SyncDateRange,
  type SyncMode,
  type SyncSource,
  validateSyncDateRange,
} from '../syncSessionForm'
import { DataSyncSessionMode, type SyncRunResponse } from '../types'
import { SyncSessionPanel } from './SyncSessionPanel'
import { SyncSessionConfigurator } from './SyncSessionConfigurator'

const STATUS_POLL_INTERVAL_MS = 3_000

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
      state.status?.ActiveRun?.Status === 'Running' ||
      state.status?.Session?.Stages.some((stage) => stage.Status === 'Running'),
  )
  const isSyncInProgress = state.isStarting || isServerSyncActive || dataSyncProgress.isActive
  const isStatusUnknown =
    !state.status ||
    state.status.IsGlobalLockStatusAvailable !== true ||
    Boolean(state.statusError)
  const isStartBlocked = isSyncInProgress || state.isStatusRefreshing || isStatusUnknown
  const sourceForAmg = state.source === 'amg'
  const today = getTodaySyncDate()
  const activeRange = state.dateRanges[state.mode]
  const activeRangeErrors = validateSyncDateRange(activeRange, today)

  function requestSync(mode: SyncMode) {
    const types = getSessionDocumentTypes(mode, state.selectedDailyDocumentTypes)
    if (types.length === 0) {
      notifications.show({ color: 'red', message: t('Оберіть типи синхронізації') })
      return
    }

    const errors = validateSyncDateRange(state.dateRanges[mode], today)
    if (hasSyncDateRangeErrors(errors)) {
      notifications.show({ color: 'red', message: t(getFirstSyncDateRangeError(errors)) })
      return
    }

    dispatch({ type: 'confirmationRequested', mode })
  }

  async function runConfirmedSync() {
    const mode = state.pendingRun
    if (!mode) {
      return
    }

    const range = state.dateRanges[mode]
    const errors = validateSyncDateRange(range, today)
    if (hasSyncDateRangeErrors(errors)) {
      notifications.show({ color: 'red', message: t(getFirstSyncDateRangeError(errors)) })
      dispatch({ type: 'confirmationCanceled' })
      return
    }

    const sessionMode = mode === 'full' ? DataSyncSessionMode.Full : DataSyncSessionMode.Daily
    const types = getSessionDocumentTypes(mode, state.selectedDailyDocumentTypes)

    await runSyncRequest(
      {
        forAmg: sourceForAmg,
        from: range.from,
        mode,
        to: range.to,
        types,
      },
      (operationId) =>
        startSyncSession({
          forAmg: sourceForAmg,
          from: range.from,
          mode: sessionMode,
          operationId,
          to: range.to,
          types,
        }),
    )
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

          <SyncSessionConfigurator
            dateErrors={activeRangeErrors}
            mode={state.mode}
            range={activeRange}
            selectedDailyDocumentTypes={state.selectedDailyDocumentTypes}
            source={state.source}
            today={today}
            onDailyDocumentTypesChange={(types) =>
              dispatch({ type: 'dailyDocumentTypesChanged', types })
            }
            onDateChange={(boundary, value) =>
              dispatch({ type: 'dateChanged', boundary, mode: state.mode, value })
            }
            onSourceChange={(source) => dispatch({ type: 'sourceChanged', source })}
          />

          {state.pendingRun ? (
            <SyncConfirmation
              documentTypeCount={
                getSessionDocumentTypes(
                  state.pendingRun,
                  state.selectedDailyDocumentTypes,
                ).length
              }
              mode={state.pendingRun}
              range={state.dateRanges[state.pendingRun]}
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
                onClick={() => requestSync(state.mode)}
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
  documentTypeCount,
  isLoading,
  mode,
  onCancel,
  onConfirm,
  range,
  source,
}: {
  documentTypeCount: number
  isLoading: boolean
  mode: SyncMode
  onCancel: () => void
  onConfirm: () => void
  range: SyncDateRange
  source: SyncSource
}) {
  const { t } = useI18n()
  const confirmationRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    confirmationRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  return (
    <Group
      ref={confirmationRef}
      justify="space-between"
      align="flex-end"
      gap="md"
      className="sync-confirmation"
      wrap="wrap"
    >
      <Box className="sync-confirmation-summary">
        <Text fw={650} size="sm">
          {t('Підтвердити запуск')}
        </Text>
        <Group gap="lg" mt={6} wrap="wrap">
          <SyncConfirmationItem
            label={t('Режим')}
            value={t(mode === 'full' ? 'Повна синхронізація' : 'Щоденна синхронізація')}
          />
          <SyncConfirmationItem label={t('Джерело')} value={source === 'amg' ? 'AMG' : 'FENIX'} />
          <SyncConfirmationItem label={t('Період')} value={formatConfirmationRange(range)} />
          <SyncConfirmationItem
            label={t('Документи')}
            value={formatDocumentTypeCount(documentTypeCount)}
          />
        </Group>
        <Text className="sync-confirmation-order" mt={8} size="xs">
          <Text c="dimmed" component="span" size="xs">
            {t('Порядок виконання')}:{' '}
          </Text>
          {t(
            mode === 'full'
              ? 'Довідники → історія документів → поточний стан'
              : 'Документи за період → поточний стан',
          )}
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

function SyncConfirmationItem({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={600} size="xs">
        {value}
      </Text>
    </Box>
  )
}

function formatConfirmationRange(range: SyncDateRange): string {
  return `${formatConfirmationDate(range.from)} – ${formatConfirmationDate(range.to)}`
}

function formatConfirmationDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

function formatDocumentTypeCount(count: number): string {
  const remainder100 = count % 100
  const remainder10 = count % 10
  const label =
    remainder100 >= 11 && remainder100 <= 14
      ? 'типів документів'
      : remainder10 === 1
        ? 'тип документа'
        : remainder10 >= 2 && remainder10 <= 4
          ? 'типи документів'
          : 'типів документів'

  return `${count} ${label}`
}

function SyncModeLabel({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="sync-mode-label-long">{full}</span>
      <span className="sync-mode-label-short">{short}</span>
    </>
  )
}
