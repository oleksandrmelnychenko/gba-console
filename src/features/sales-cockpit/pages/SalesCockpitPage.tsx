import { ActionIcon, Alert, Badge, Card, SegmentedControl, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, RefreshCw, Sparkles } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  addTaskNote,
  getCockpitInbox,
  getCockpitTarget,
  regenerateCockpit,
  setTaskStatus,
} from '../api/salesCockpitApi'
import { CockpitDashboardPanel } from '../components/CockpitDashboardPanel'
import { DoneModal } from '../components/DoneModal'
import { NoteModal } from '../components/NoteModal'
import { SnoozeModal } from '../components/SnoozeModal'
import { TaskCard } from '../components/TaskCard'
import { TaskFilters } from '../components/TaskFilters'
import type { CockpitTarget, CockpitTask, CockpitTaskType, CockpitUrgency, HeadPaceStatus } from '../types'
import './sales-cockpit-page.css'

const INBOX_LIMIT = 50
const POLL_INTERVAL_MS = 20_000

// Inbox ordering: triage by urgency band, then business tier (debt = cash at risk first), then score.
// Mirrors the gba-nba inbox ordering so the cockpit shows the same queue order.
const URGENCY_RANK: Record<CockpitUrgency, number> = { critical: 0, high: 1, normal: 2, low: 3 }
const TYPE_RANK: Record<CockpitTaskType, number> = {
  debt_followup: 0,
  reorder_due: 1,
  churn_winback: 2,
  cross_sell: 3,
  new_client_activation: 4,
}

const PACE_COLOR: Record<HeadPaceStatus, string> = {
  ahead: 'green',
  on: 'blue',
  behind: 'red',
  no_target: 'gray',
}

const PACE_LABEL: Record<HeadPaceStatus, string> = {
  ahead: 'Випереджає',
  on: 'У графіку',
  behind: 'Відстає',
  no_target: 'Немає цілі',
}

// Maps a pace status to the metric tile's left-accent variant in sales-cockpit-page.css.
const PACE_ACCENT: Record<HeadPaceStatus, string> = {
  ahead: 'success',
  on: 'info',
  behind: 'danger',
  no_target: 'neutral',
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

type DayFilter = 'all' | 'today'

const KYIV_TZ = 'Europe/Kyiv'

// Compares two instants by their calendar day in Europe/Kyiv, so "Сьогодні"
// means "today in Kyiv" regardless of the viewer's local timezone.
const kyivDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KYIV_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function kyivDayKey(value: Date): string {
  return kyivDayFormatter.format(value)
}

// A task is "today" when its due_date (preferred when present) or generated_at
// falls on today's Kyiv calendar day. Tasks without a usable date are excluded.
function isTaskToday(task: CockpitTask, todayKey: string): boolean {
  const raw = task.due_date ?? task.generated_at
  if (!raw) {
    return false
  }

  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) {
    return false
  }

  return kyivDayKey(new Date(parsed)) === todayKey
}

function inboxOrder(left: CockpitTask, right: CockpitTask): number {
  return (
    getUrgencyRank(left.urgency) - getUrgencyRank(right.urgency) ||
    getTaskTypeRank(left.task_type) - getTaskTypeRank(right.task_type) ||
    (right.priority ?? 0) - (left.priority ?? 0)
  )
}

function getUrgencyRank(urgency?: CockpitUrgency): number {
  return urgency ? URGENCY_RANK[urgency] : 9
}

function getTaskTypeRank(taskType?: CockpitTaskType): number {
  return taskType ? TYPE_RANK[taskType] : 9
}

export function SalesCockpitPage() {
  const { t } = useI18n()
  const [tasks, setTasks] = useValueState<CockpitTask[]>([])
  const [target, setTarget] = useValueState<CockpitTarget | null>(null)
  const [taskTypeFilter, setTaskTypeFilter] = useValueState<CockpitTaskType | null>(null)
  const [urgencyFilter, setUrgencyFilter] = useValueState<CockpitUrgency | null>(null)
  const [dayFilter, setDayFilter] = useValueState<DayFilter>('all')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isRegenerating, setRegenerating] = useState(false)
  const [pendingTaskKey, setPendingTaskKey] = useState<string | null>(null)
  const [noteTask, setNoteTask] = useState<CockpitTask | null>(null)
  const [snoozeTask, setSnoozeTask] = useState<CockpitTask | null>(null)
  const [doneTask, setDoneTask] = useState<CockpitTask | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const busyRef = useRef(false)
  useEffect(() => {
    busyRef.current = Boolean(noteTask || snoozeTask || doneTask || pendingTaskKey || isRegenerating)
  }, [noteTask, snoozeTask, doneTask, pendingTaskKey, isRegenerating])

  useEffect(() => {
    const controller = new AbortController()

    async function loadInbox() {
      setError(null)

      try {
        const [inbox, cockpitTarget] = await Promise.all([getCockpitInbox({ limit: INBOX_LIMIT }), getCockpitTarget()])

        if (!controller.signal.aborted) {
          setTasks(inbox.tasks)
          setTarget(cockpitTarget)
        }
      } catch (loadError) {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити завдання'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadInbox()

    const interval = setInterval(() => {
      if (!busyRef.current) {
        void loadInbox()
      }
    }, POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [reloadKey, setError, setTarget, setTasks, t])

  // Recomputed each render (a single cheap formatter call) so the "today" window
  // stays current across a midnight boundary without an extra dependency.
  const todayKey = kyivDayKey(new Date())

  const todayCount = useMemo(
    () => tasks.reduce((count, task) => (isTaskToday(task, todayKey) ? count + 1 : count), 0),
    [tasks, todayKey],
  )

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter(
      (task) =>
        (!taskTypeFilter || task.task_type === taskTypeFilter) &&
        (!urgencyFilter || task.urgency === urgencyFilter) &&
        (dayFilter === 'all' || isTaskToday(task, todayKey)),
    )

    return filtered.toSorted(inboxOrder)
  }, [tasks, taskTypeFilter, urgencyFilter, dayFilter, todayKey])

  const handleDoneSubmit = useCallback(
    async (task: CockpitTask, outcome: { sold: boolean; amount: number | null }) => {
      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, {
          To: 'done',
          Sold: outcome.sold,
          Amount: outcome.amount ?? undefined,
        })
        notifications.show({ color: 'green', message: t('Завдання виконано') })
        setDoneTask(null)
        reload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [t],
  )

  const handleDismiss = useCallback(
    async (task: CockpitTask) => {
      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'dismissed' })
        notifications.show({ color: 'green', message: t('Завдання відхилено') })
        reload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [t],
  )

  const handleTakeInProgress = useCallback(
    async (task: CockpitTask) => {
      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'in_progress' })
        notifications.show({ color: 'green', message: t('Завдання взято в роботу') })
        reload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [t],
  )

  const handleSnoozeSubmit = useCallback(
    async (task: CockpitTask, snoozeUntil: string) => {
      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'snoozed', SnoozeUntil: snoozeUntil })
        notifications.show({ color: 'green', message: t('Завдання відкладено') })
        setSnoozeTask(null)
        reload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося відкласти завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [t],
  )

  const handleNoteSubmit = useCallback(
    async (task: CockpitTask, text: string) => {
      setPendingTaskKey(task.task_key)

      try {
        await addTaskNote(task.task_key, { Text: text })
        notifications.show({ color: 'green', message: t('Нотатку додано') })
        setNoteTask(null)
        reload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося додати нотатку'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [t],
  )

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)

    try {
      await regenerateCockpit()
      notifications.show({ color: 'green', message: t('Завдання оновлено') })
      reload()
    } catch (actionError) {
      notifications.show({
        color: 'red',
        message: actionError instanceof Error ? actionError.message : t('Не вдалося згенерувати завдання'),
      })
    } finally {
      setRegenerating(false)
    }
  }, [t])

  const handleReload = useCallback(() => {
    setLoading(true)
    reload()
  }, [])

  return (
    <Stack className="cockpit-page" gap={6}>
      <Card className="app-filter-card cockpit-toolbar-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar cockpit-command-bar">
          <TaskFilters
            taskType={taskTypeFilter}
            urgency={urgencyFilter}
            onTaskTypeChange={setTaskTypeFilter}
            onUrgencyChange={setUrgencyFilter}
          />
          <SegmentedControl
            className="cockpit-day-filter"
            data={[
              { label: t('Усі'), value: 'all' },
              { label: `${t('Сьогодні')} (${todayCount})`, value: 'today' },
            ]}
            size="sm"
            value={dayFilter}
            onChange={(value) => setDayFilter(value as DayFilter)}
          />
          <div className="app-filter-actions cockpit-command-actions">
            <Text className="cockpit-toolbar-count">
              {t('Завдань')}: <strong>{visibleTasks.length}</strong>
            </Text>
            <Tooltip label={t('Згенерувати завдання')}>
              <ActionIcon
                aria-label={t('Згенерувати завдання')}
                loading={isRegenerating}
                size={34}
                variant="light"
                onClick={handleRegenerate}
              >
                <Sparkles size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} loading={isLoading} size={34} variant="light" onClick={handleReload}>
                <RefreshCw size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
      </Card>

      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {target && <TargetCard target={target} />}

      <CockpitDashboardPanel reloadKey={reloadKey} />

      {isLoading ? (
        <CockpitTaskSkeleton label={t('Завантаження завдань')} />
      ) : visibleTasks.length === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Text c="dimmed" fw={600} ta="center">
            {t('Активних завдань немає')}
          </Text>
        </Card>
      ) : (
        <Stack gap="sm">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.task_key}
              pending={pendingTaskKey === task.task_key}
              task={task}
              onAddNote={setNoteTask}
              onDismiss={handleDismiss}
              onDone={setDoneTask}
              onSnooze={setSnoozeTask}
              onTakeInProgress={handleTakeInProgress}
            />
          ))}
        </Stack>
      )}

      <NoteModal
        saving={Boolean(noteTask && pendingTaskKey === noteTask.task_key)}
        task={noteTask}
        onClose={() => setNoteTask(null)}
        onSubmit={handleNoteSubmit}
      />

      <SnoozeModal
        saving={Boolean(snoozeTask && pendingTaskKey === snoozeTask.task_key)}
        task={snoozeTask}
        onClose={() => setSnoozeTask(null)}
        onSubmit={handleSnoozeSubmit}
      />

      <DoneModal
        saving={Boolean(doneTask && pendingTaskKey === doneTask.task_key)}
        task={doneTask}
        onClose={() => setDoneTask(null)}
        onSubmit={handleDoneSubmit}
      />
    </Stack>
  )
}

function TargetCard({ target }: { target: CockpitTarget }) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card" withBorder radius="md">
      <Stack gap="sm">
        <Text className="app-section-title" fw={600}>{t('Моя ціль (місяць)')}</Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TargetMetric label={t('Відвантаження')} metric={target.shipped} t={t} />
          <TargetMetric label={t('Оплати')} metric={target.paid} t={t} />
        </SimpleGrid>
      </Stack>
    </Card>
  )
}

function CockpitTaskSkeleton({ label }: { label: string }) {
  return (
    <div className="cockpit-task-skeleton" aria-busy="true" aria-label={label}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="cockpit-task-skeleton-card">
          <span className="cockpit-task-skeleton-line is-title" />
          <span className="cockpit-task-skeleton-line" />
          <span className="cockpit-task-skeleton-line is-short" />
        </div>
      ))}
    </div>
  )
}

function TargetMetric({
  label,
  metric,
  t,
}: {
  label: string
  metric: CockpitTarget['shipped']
  t: (key: string) => string
}) {
  return (
    <div className={`cockpit-metric is-${PACE_ACCENT[metric.pace_status]}`}>
      <div className="cockpit-metric-head">
        <span className="cockpit-metric-label">{label}</span>
        <Badge color={PACE_COLOR[metric.pace_status]} size="sm" variant="light">
          {t(PACE_LABEL[metric.pace_status])}
        </Badge>
      </div>
      <div className="cockpit-target-row">
        <span className="cockpit-metric-value">{formatMoney(metric.mtd)}</span>
        <span className="cockpit-target-of">
          / {formatMoney(metric.target)} · {formatPercent(metric.attainment_pct)}
        </span>
      </div>
      <span className="cockpit-metric-sub">
        {t('Сьогодні потрібно')}: {formatMoney(metric.today_needed)}
      </span>
    </div>
  )
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${value}%`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
