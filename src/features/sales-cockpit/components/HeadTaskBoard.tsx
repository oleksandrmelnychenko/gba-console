import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  Select,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, CircleDashed, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getHeadTasks, regenerateCockpit } from '../api/salesCockpitApi'
import type { HeadTask, HeadTaskByStatus, HeadTaskManager, HeadTasksResponse } from '../types'
import { useCockpitRealtimeReload } from '../hooks/useCockpitRealtimeReload'

const POLL_INTERVAL_MS = 60_000
const RELATIVE_TIME_TICK_MS = 30_000
const PAGE_SIZE = 50

type BoardStatus = 'ready' | 'open' | 'in_progress' | 'done'
type TFn = (key: string, params?: Record<string, number | string>) => string

const STATUS_TABS: { value: BoardStatus; label: string; count: (status: HeadTaskByStatus) => number }[] = [
  { value: 'ready', label: 'Готові', count: (status) => status.Open + status.InProgress },
  { value: 'open', label: 'Нові', count: (status) => status.Open },
  { value: 'in_progress', label: 'В роботі', count: (status) => status.InProgress },
  { value: 'done', label: 'Виконано', count: (status) => status.Done },
]

// Urgency → shared outlined-pill variant (docs/ui-patterns.md §4);
// normal keeps the default blue pill.
const URGENCY_PILL: Record<string, string> = {
  critical: 'is-red',
  high: 'is-orange',
  normal: '',
  low: 'is-gray',
}

const URGENCY_LABEL: Record<string, string> = {
  critical: 'Критично',
  high: 'Високий',
  normal: 'Звичайний',
  low: 'Низький',
}

const TASK_TYPE_LABEL: Record<string, string> = {
  reorder_due: 'Час повторного замовлення',
  debt_followup: 'Контроль заборгованості',
  cross_sell: 'Крос-продаж',
  churn_winback: 'Повернення клієнта',
  new_client_activation: 'Активація нового клієнта',
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const EMPTY_RESPONSE: HeadTasksResponse = {
  Total: 0,
  Tasks: [],
  ByStatus: { Open: 0, InProgress: 0, Done: 0, Snoozed: 0, Dismissed: 0 },
  Managers: [],
}

export function HeadTaskBoard({
  managerId,
  onManagerChange,
}: {
  managerId: number | null
  onManagerChange: (managerId: number | null) => void
}) {
  const { t } = useI18n()
  const [data, setData] = useValueState<HeadTasksResponse>(EMPTY_RESPONSE)
  const [status, setStatus] = useValueState<BoardStatus>('ready')
  const [urgency, setUrgency] = useValueState<string | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useValueState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [isGenerating, setGenerating] = useState(false)
  const [isLoading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [, setTick] = useState(0)

  const triggerReload = useCallback(() => {
    setLoading(true)
    reload()
  }, [])
  const scheduleReload = useCockpitRealtimeReload(triggerReload)

  const skip = (page - 1) * PAGE_SIZE
  const statusesQuery = getStatusesQuery(status)

  useEffect(() => {
    let active = true
    let interval: ReturnType<typeof setInterval> | null = null

    async function load() {
      try {
        const result = await getHeadTasks({
          statuses: statusesQuery,
          managerId: managerId ?? undefined,
          urgency: urgency ?? undefined,
          skip,
          limit: PAGE_SIZE,
        })

        if (!active) {
          return
        }

        setData(result)
        setForbidden(false)
        setError(null)
        setLastUpdated(Date.now())
      } catch (loadError) {
        if (!active) {
          return
        }

        if (loadError instanceof ApiError && loadError.status === 403) {
          setForbidden(true)
          setError(null)
        } else {
          setForbidden(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дошку задач'))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    function startInterval() {
      if (interval || document.visibilityState === 'hidden') {
        return
      }
      interval = setInterval(() => {
        void load()
      }, POLL_INTERVAL_MS)
    }

    function stopInterval() {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void load()
        startInterval()
      } else {
        stopInterval()
      }
    }

    void load()
    startInterval()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      active = false
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [statusesQuery, managerId, urgency, skip, reloadKey, setData, setError, t])

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), RELATIVE_TIME_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const managerOptions = useMemo(() => buildManagerOptions(data.Managers), [data.Managers])
  const totalPages = Math.max(1, Math.ceil(data.Total / PAGE_SIZE))

  const handleStatusChange = useCallback(
    (next: BoardStatus) => {
      setStatus(next)
      setPage(1)
      setLoading(true)
    },
    [setStatus],
  )

  const handleManagerChange = useCallback(
    (value: string | null) => {
      onManagerChange(value ? Number(value) : null)
      setPage(1)
      setLoading(true)
    },
    [onManagerChange],
  )

  const handleUrgencyChange = useCallback(
    (value: string | null) => {
      setUrgency(value)
      setPage(1)
      setLoading(true)
    },
    [setUrgency],
  )

  const handleGenerate = useCallback(async () => {
    setGenerating(true)

    try {
      await regenerateCockpit()
      notifications.show({
        color: 'green',
        message: t('AI задачі поставлено на перерахунок. Борд оновиться автоматично.'),
        title: t('AI задачі продажів'),
      })
      scheduleReload()
    } catch (generateError) {
      notifications.show({
        color: 'red',
        message: generateError instanceof Error ? generateError.message : t('Не вдалося перегенерувати задачі'),
        title: t('AI задачі продажів'),
      })
    } finally {
      setGenerating(false)
    }
  }, [scheduleReload, t])

  if (forbidden) {
    return null
  }

  return (
    <Card className="app-section-card cockpit-board-card" withBorder radius="md" padding={0}>
      <Group align="center" className="cockpit-board-header" gap="sm" justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Text className="app-section-title" fw={600} size="sm">{t('Черга задач')}</Text>
          <Badge className="app-role-pill is-orange" leftSection={<CircleDashed size={12} />} variant="light">
            {t('наживо')}
          </Badge>
        </Group>

        <Group gap="xs">
          <Text c="dimmed" size="xs">
            {relativeUpdatedLabel(lastUpdated, t)}
          </Text>
          {isLoading && <span className="cockpit-inline-loading" aria-hidden="true" />}
        </Group>
      </Group>

      <div className="pill-tabs cockpit-board-tabs" role="tablist" aria-label={t('Статуси задач')}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`pill-tab${tab.value === status ? ' is-active' : ''}`}
            role="tab"
            type="button"
            aria-selected={tab.value === status}
            onClick={() => handleStatusChange(tab.value)}
          >
            {t(tab.label)}
            <Badge className={`app-role-pill ${tab.value === status ? 'is-orange' : 'is-gray'}`} size="sm" variant="light">
              {tab.count(data.ByStatus)}
            </Badge>
          </button>
        ))}
      </div>

      <HeadTaskProgressSummary byStatus={data.ByStatus} />

      <div className="app-filter-bar cockpit-board-filter">
        <Select
          clearable
          data={managerOptions}
          label={t('Менеджер')}
          placeholder={t('Усі менеджери')}
          size="sm"
          value={managerId === null ? null : String(managerId)}
          w={220}
          onChange={handleManagerChange}
        />
        <Select
          clearable
          data={URGENCY_OPTIONS.map((value) => ({ value, label: t(URGENCY_LABEL[value]) }))}
          label={t('Терміновість')}
          placeholder={t('Будь-яка')}
          size="sm"
          value={urgency}
          w={200}
          onChange={handleUrgencyChange}
        />
        <div className="app-filter-actions cockpit-command-actions">
          <Button
            color={CREATE_ACTION_COLOR}
            leftSection={<Sparkles size={16} fill="currentColor" strokeWidth={0} />}
            loading={isGenerating}
            size="sm"
            variant="outline"
            onClick={handleGenerate}
          >
            {t('Перерахувати AI задачі')}
          </Button>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              size={34}
              variant="light"
              onClick={() => {
                triggerReload()
              }}
            >
              <RefreshCw size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {error && (
        <Alert className="cockpit-board-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading && data.Tasks.length === 0 ? (
        <HeadTaskBoardSkeleton label={t('Завантаження задач')} />
      ) : data.Tasks.length === 0 ? (
        <Text c="dimmed" className="cockpit-board-empty" size="sm" ta="center">
          {t('Задач за цим фільтром немає')}
        </Text>
      ) : (
        <div className="cockpit-board-list">
          {data.Tasks.map((task) => <HeadTaskRow key={task.TaskKey} task={task} />)}
        </div>
      )}

      {totalPages > 1 && (
        <Group className="cockpit-board-pagination" justify="space-between">
          <Text c="dimmed" size="xs">
            {t('Усього')}: {data.Total}
          </Text>
          <Pagination
            size="sm"
            total={totalPages}
            value={page}
            onChange={(next) => {
              setPage(next)
              setLoading(true)
            }}
          />
        </Group>
      )}
    </Card>
  )
}

function HeadTaskProgressSummary({ byStatus }: { byStatus: HeadTaskByStatus }) {
  const { t } = useI18n()
  const ready = byStatus.Open + byStatus.InProgress
  const terminal = byStatus.Done + byStatus.Dismissed
  const paused = byStatus.Snoozed
  const knownTotal = ready + terminal + paused
  const activeFlow = byStatus.Open + byStatus.InProgress + byStatus.Done
  const completion = activeFlow > 0 ? byStatus.Done / activeFlow : 0
  const adoption = ready > 0 ? byStatus.InProgress / ready : 0

  return (
    <div className="cockpit-progress-panel">
      <div className="cockpit-progress-grid">
        <ProgressMetric
          accent="brand"
          label={t('Готові до дії')}
          subLabel={t('нові + в роботі')}
          value={String(ready)}
        />
        <ProgressMetric
          accent="info"
          label={t('В роботі зараз')}
          subLabel={`${formatPercent(adoption)} ${t('від готових')}`}
          value={String(byStatus.InProgress)}
        />
        <ProgressMetric
          accent="success"
          label={t('Виконано')}
          subLabel={`${formatPercent(completion)} ${t('закриття активного потоку')}`}
          value={String(byStatus.Done)}
        />
        <ProgressMetric
          accent={paused > 0 ? 'warning' : 'muted'}
          label={t('Відкладені')}
          subLabel={t('не в активній черзі')}
          value={String(paused)}
        />
      </div>

      <div className="cockpit-progress-track" aria-label={t('Прогрес задач')}>
        <span className="is-open" style={{ width: percentWidth(byStatus.Open, knownTotal) }} />
        <span className="is-progress" style={{ width: percentWidth(byStatus.InProgress, knownTotal) }} />
        <span className="is-done" style={{ width: percentWidth(byStatus.Done, knownTotal) }} />
        <span className="is-paused" style={{ width: percentWidth(paused + byStatus.Dismissed, knownTotal) }} />
      </div>

      <Group gap="xs" justify="space-between" wrap="wrap">
        <Text c="dimmed" size="xs">
          {t('Усього задач у поточному циклі')}: {knownTotal}
        </Text>
        <Text c="dimmed" size="xs">
          {t('Закриті або відхилені')}: {terminal}
        </Text>
      </Group>
    </div>
  )
}

function ProgressMetric({
  accent,
  label,
  subLabel,
  value,
}: {
  accent: 'brand' | 'info' | 'muted' | 'success' | 'warning'
  label: string
  subLabel: string
  value: string
}) {
  return (
    <div className={`cockpit-progress-metric is-${accent}`}>
      <span className="cockpit-progress-metric__label">{label}</span>
      <span className="cockpit-progress-metric__value">{value}</span>
      <span className="cockpit-progress-metric__sub">{subLabel}</span>
    </div>
  )
}

function HeadTaskRow({ task }: { task: HeadTask }) {
  const { t } = useI18n()

  return (
    <div className={`cockpit-board-row${task.SlaBreached ? ' is-breached' : ''}`}>
      <div className="cockpit-board-row__task">
        <Group gap={6} wrap="wrap">
          <Text className="cockpit-board-row__title">{task.Title?.trim() || t('Завдання')}</Text>
          {task.TaskType && (
            <Badge className="app-role-pill is-gray" size="sm" variant="light">
              {taskTypeLabel(task.TaskType, t)}
            </Badge>
          )}
        </Group>
        <Group gap={6} mt={4} wrap="wrap">
          <Text c="dimmed" size="xs">{task.ClientName?.trim() || `#${task.ClientId}`}</Text>
          <span className="cockpit-board-row__separator" aria-hidden="true" />
          <Text c="dimmed" size="xs">{task.ManagerName?.trim() || `#${task.ManagerId}`}</Text>
        </Group>
      </div>

      <div className="cockpit-board-row__value">
        <span className="cockpit-board-row__label">{t('Очікувана виручка')}</span>
        <strong>{task.ExpectedValue !== null ? formatMoney(task.ExpectedValue) : '—'}</strong>
        <span>{task.POutcome !== null ? `${t('Шанс результату')} ${formatPercent(task.POutcome)}` : `${t('Пріоритет')} ${Math.round(task.Priority)}`}</span>
      </div>

      <div className="cockpit-board-row__badges">
        <Badge className={`app-role-pill ${urgencyPill(task.Urgency)}`.trim()} size="sm" variant="light">
          {urgencyLabel(task.Urgency, t)}
        </Badge>
        {task.Status === 'in_progress' ? (
          <Badge className="app-role-pill is-orange" leftSection={<CircleDashed size={12} />} size="sm" variant="light">
            {inProgressLabel(task.InProgressSince, t)}
          </Badge>
        ) : (
          <Badge className={`app-role-pill ${statusPill(task.Status)}`.trim()} size="sm" variant="light">
            {statusLabel(task.Status, t)}
          </Badge>
        )}
        {task.SlaBreached ? (
          <Badge className="app-role-pill is-red" size="sm" variant="light">
            {t('Прострочено SLA')}
          </Badge>
        ) : null}
      </div>

      <div className="cockpit-board-row__updated">
        <span className="cockpit-board-row__label">{t('Оновлено')}</span>
        <span>{relativeTaskDateLabel(task.UpdatedAt || task.GeneratedAt, t)}</span>
      </div>
    </div>
  )
}

function HeadTaskBoardSkeleton({ label }: { label: string }) {
  return (
    <div className="cockpit-table-skeleton is-board" aria-busy="true" aria-label={label}>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div key={rowIndex} className="cockpit-table-skeleton-row">
          {Array.from({ length: 8 }).map((__, columnIndex) => (
            <span
              key={columnIndex}
              className={`cockpit-table-skeleton-line${columnIndex === 2 ? ' is-title' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

const URGENCY_OPTIONS = ['critical', 'high', 'normal', 'low']

function getStatusesQuery(status: BoardStatus): string {
  return status === 'ready' ? 'open,in_progress' : status
}

function buildManagerOptions(managers: HeadTaskManager[]): { value: string; label: string }[] {
  return managers.map((manager) => ({
    value: String(manager.ManagerId),
    label: manager.Name?.trim() || `#${manager.ManagerId}`,
  }))
}

function urgencyPill(urgency: string | null): string {
  return (urgency && URGENCY_PILL[urgency]) || ''
}

function urgencyLabel(urgency: string | null, t: (key: string) => string): string {
  return urgency ? t(URGENCY_LABEL[urgency] ?? urgency) : t(URGENCY_LABEL.normal)
}

function taskTypeLabel(taskType: string, t: (key: string) => string): string {
  return t(TASK_TYPE_LABEL[taskType] ?? taskType)
}

// Status → shared outlined-pill variant; open/generated keep the default blue pill.
const STATUS_PILL: Record<string, string> = {
  open: '',
  in_progress: 'is-orange',
  done: 'is-green',
  snoozed: 'is-gray',
  dismissed: 'is-gray',
  generated: '',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Відкрита',
  in_progress: 'В роботі',
  done: 'Виконано',
  snoozed: 'Відкладено',
  dismissed: 'Відхилено',
  generated: 'Нова',
}

function statusPill(status: string | null): string {
  return (status && STATUS_PILL[status]) ?? 'is-gray'
}

function statusLabel(status: string | null, t: (key: string) => string): string {
  return status ? t(STATUS_LABEL[status] ?? status) : '—'
}

function inProgressLabel(since: string | null, t: TFn): string {
  const elapsed = formatElapsed(since)
  return elapsed ? `${t('в роботі')} ${elapsed}` : t('В роботі')
}

function formatElapsed(since: string | null): string | null {
  if (!since) {
    return null
  }

  const start = Date.parse(since)
  if (Number.isNaN(start)) {
    return null
  }

  const diffMs = Date.now() - start
  if (diffMs < 0) {
    return null
  }

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) {
    return `${minutes} хв`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} год`
  }

  const days = Math.floor(hours / 24)
  return `${days} дн`
}

function relativeUpdatedLabel(lastUpdated: number | null, t: TFn): string {
  if (lastUpdated === null) {
    return ''
  }

  const seconds = Math.max(0, Math.floor((Date.now() - lastUpdated) / 1_000))
  if (seconds < 5) {
    return t('оновлено щойно')
  }

  return t('оновлено {seconds} с тому', { seconds })
}

function relativeTaskDateLabel(value: string | null, t: TFn): string {
  const elapsed = formatElapsed(value)
  return elapsed ? `${elapsed} ${t('тому')}` : '—'
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function percentWidth(value: number, total: number): string {
  if (total <= 0 || value <= 0) {
    return '0%'
  }

  return `${Math.max(2, Math.round((value / total) * 100))}%`
}
