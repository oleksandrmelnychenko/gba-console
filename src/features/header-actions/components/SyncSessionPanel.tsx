import { ActionIcon, Badge, Box, Group, Loader, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, CircleCheck, Clock3, RefreshCw } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  cleanStartedBy,
  getCompositeSyncProgress,
  getSyncOperationLabel,
  getSyncScopeSummary,
  getSyncSessionModeLabel,
  getSyncSessionStatusLabel,
  getSyncSessionTone,
  getSyncSourceLabel,
  getVisibleSyncRun,
  type CompositeSyncProgressView,
  type CompositeSyncStageTone,
} from '../syncSession'
import type { DataSyncStatus } from '../types'

type SyncSessionPanelProps = {
  isRefreshing: boolean
  onRefresh: () => void
  progressMessage?: string
  status: DataSyncStatus | null
  statusError?: string
}

const syncDateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  year: 'numeric',
})

export function SyncSessionPanel({
  isRefreshing,
  onRefresh,
  progressMessage,
  status,
  statusError,
}: SyncSessionPanelProps) {
  const { t } = useI18n()
  const run = getVisibleSyncRun(status)
  const tone = getSyncSessionTone(status)
  const isRunning = tone === 'running'
  const compositeSession = status?.Session
  const compositeProgress = getCompositeSyncProgress(compositeSession)
  const isUnresolvedRunningSession = isRunning && !run && !compositeSession
  const isLockStatusUnavailable = Boolean(status && status.IsGlobalLockStatusAvailable !== true)
  const scope = run?.AcceptedScope
  const operationLabel = compositeSession
    ? getSyncSessionModeLabel(compositeSession.Mode)
    : getSyncOperationLabel(scope?.OperationType)
  const statusLabel = getSyncSessionStatusLabel(tone)
  const sourceForAmg = compositeSession?.ForAmg ?? scope?.ForAmg

  return (
    <Box className={`sync-session-panel is-${tone}`}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <span className={`sync-session-icon is-${tone}`}>
            <SyncSessionIcon isRefreshing={isRefreshing} tone={tone} />
          </span>
          <Box>
            <Text fw={650} size="sm" lh={1.25}>
              {run || compositeSession
                ? t(operationLabel)
                : t(isUnresolvedRunningSession ? 'Сервер зайнятий синхронізацією' : 'Сесія синхронізації')}
            </Text>
            <Text size="xs" c="dimmed">
              {run || compositeSession
                ? getSyncSourceLabel(sourceForAmg)
                : t(isUnresolvedRunningSession ? 'Глобальне блокування активне' : 'Немає активної синхронізації')}
            </Text>
          </Box>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Badge className={`app-role-pill ${getStatusBadgeClass(tone)}`} variant="light">
            {t(statusLabel)}
          </Badge>
          <Tooltip label={t('Оновити статус')} openDelay={300}>
            <ActionIcon
              aria-label={t('Оновити статус')}
              color="gray"
              disabled={isRefreshing}
              onClick={onRefresh}
              size="sm"
              variant="subtle"
            >
              <RefreshCw size={15} strokeWidth={1.8} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {run ? (
        <Stack gap="xs" mt="sm">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" className="sync-session-meta">
            <SyncSessionMeta label={t('Початок')} value={formatSyncDateTime(run.StartedAtUtc)} />
            <SyncSessionMeta
              label={t(isRunning ? 'Стан' : 'Завершення')}
              value={isRunning ? t('Виконується') : formatSyncDateTime(run.CompletedAtUtc)}
            />
            <SyncSessionMeta label={t('Запустив')} value={cleanStartedBy(run.StartedBy)} />
            <SyncSessionMeta label={t('Обсяг')} value={getSyncScopeSummary(scope) || '—'} />
          </SimpleGrid>

          {isRunning && progressMessage ? (
            <Text size="xs" className="sync-session-progress">
              {progressMessage}
            </Text>
          ) : null}

          {tone === 'error' && run.FailedStep ? (
            <Text size="xs" c="red.7">
              {t('Крок із помилкою')}: {run.FailedStep}
            </Text>
          ) : null}
        </Stack>
      ) : compositeSession ? null : isUnresolvedRunningSession ? (
        <Text size="sm" c="dimmed" mt="sm">
          {t('Нова сесія стане доступною після завершення поточної синхронізації')}
        </Text>
      ) : (
        <Text size="sm" c="dimmed" mt="sm">
          {t('Синхронізація ще не запускалась')}
        </Text>
      )}

      {compositeProgress ? <CompositeSessionProgress progress={compositeProgress} /> : null}

      {statusError ? (
        <Text size="xs" c="red.7" mt="xs">
          {statusError}
        </Text>
      ) : null}

      {isLockStatusUnavailable ? (
        <Text size="xs" c="red.7" mt="xs">
          {t('Не вдалося перевірити глобальне блокування. Запуск вимкнено')}
        </Text>
      ) : null}
    </Box>
  )
}

function CompositeSessionProgress({ progress }: { progress: CompositeSyncProgressView }) {
  const { t } = useI18n()
  const currentStageSummary =
    progress.currentStage && progress.currentStageNumber
      ? `${t('Етап')} ${progress.currentStageNumber} ${t('з')} ${progress.totalStages}: ${t(progress.currentStage.label)}`
      : `${progress.completedStages} ${t('з')} ${progress.totalStages} ${t('етапів завершено')}`

  return (
    <Box className="sync-composite-progress" mt="sm">
      <Group justify="space-between" align="baseline" gap="sm" wrap="wrap">
        <Text fw={650} size="xs">
          {t('Хід сесії синхронізації')}
        </Text>
        <Text c="dimmed" size="xs" className="sync-composite-progress-summary">
          {currentStageSummary}
        </Text>
      </Group>
      <Progress
        aria-label={t('Завершені етапи сесії')}
        color="var(--brand-orange)"
        mt={7}
        radius="xs"
        size="sm"
        value={progress.progressPercent}
      />
      <Stack className="sync-composite-stage-list" gap={0} mt={8}>
        {progress.stages.map((stage) => (
          <Box
            aria-current={stage.isCurrent ? 'step' : undefined}
            className={`sync-composite-stage is-${stage.tone}`}
            key={stage.ordinal}
          >
            <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
              <Box className="sync-composite-stage-content">
                <Text fw={stage.isCurrent ? 650 : 550} size="xs">
                  {stage.ordinal + 1}. {t(stage.label)}
                </Text>
                {stage.range ? (
                  <Text c="dimmed" size="xs" className="sync-composite-stage-range">
                    {stage.range}
                  </Text>
                ) : null}
                {stage.failedStep ? (
                  <Text c="red.7" size="xs">
                    {t('Крок із помилкою')}: {stage.failedStep}
                  </Text>
                ) : null}
              </Box>
              <Badge color={getStageBadgeColor(stage.tone)} size="xs" variant="light">
                {t(stage.statusLabel)}
              </Badge>
            </Group>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

function SyncSessionIcon({
  isRefreshing,
  tone,
}: {
  isRefreshing: boolean
  tone: ReturnType<typeof getSyncSessionTone>
}) {
  if (isRefreshing || tone === 'running') {
    return <Loader color="var(--brand-orange)" size={16} type="oval" />
  }

  if (tone === 'error') {
    return <CircleAlert size={18} strokeWidth={1.8} />
  }

  if (tone === 'success') {
    return <CircleCheck size={18} strokeWidth={1.8} />
  }

  return <Clock3 size={18} strokeWidth={1.8} />
}

function SyncSessionMeta({ label, value }: { label: string; value: string }) {
  return (
    <Box className="sync-session-meta-item">
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={600} size="xs" className="sync-session-meta-value">
        {value}
      </Text>
    </Box>
  )
}

function getStageBadgeColor(tone: CompositeSyncStageTone): string {
  switch (tone) {
    case 'running':
      return 'orange'
    case 'error':
      return 'red'
    case 'success':
      return 'green'
    default:
      return 'gray'
  }
}

function getStatusBadgeClass(
  tone: ReturnType<typeof getSyncSessionTone>,
): 'is-gray' | 'is-green' | 'is-orange' | 'is-red' {
  switch (tone) {
    case 'running':
      return 'is-orange'
    case 'error':
      return 'is-red'
    case 'success':
      return 'is-green'
    default:
      return 'is-gray'
  }
}

function formatSyncDateTime(value?: string | null): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : syncDateTimeFormatter.format(date)
}
