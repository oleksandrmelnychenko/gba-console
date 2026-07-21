import { Alert, Stack } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
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
import { CockpitQueueSummary } from '../components/CockpitQueueSummary'
import { CockpitTargetCard } from '../components/CockpitTargetCard'
import { CockpitTaskList } from '../components/CockpitTaskList'
import { CockpitToolbar, type CockpitDayFilter } from '../components/CockpitToolbar'
import { DoneModal } from '../components/DoneModal'
import { NoteModal } from '../components/NoteModal'
import { SnoozeModal } from '../components/SnoozeModal'
import type { CockpitTarget, CockpitTask, CockpitTaskType, CockpitUrgency } from '../types'
import { buildCockpitTaskInsights, isCockpitTaskToday, kyivDayKey } from '../utils/taskInsights'
import { useCockpitRealtimeReload } from '../hooks/useCockpitRealtimeReload'
import './sales-cockpit-page.css'

const INBOX_LIMIT = 50
const POLL_INTERVAL_MS = 60_000

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
  const [dayFilter, setDayFilter] = useValueState<CockpitDayFilter>('all')
  const [asOfDate, setAsOfDate] = useValueState<string | undefined>(undefined)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isRegenerating, setRegenerating] = useState(false)
  const [pendingTaskKey, setPendingTaskKey] = useState<string | null>(null)
  const [noteTask, setNoteTask] = useState<CockpitTask | null>(null)
  const [snoozeTask, setSnoozeTask] = useState<CockpitTask | null>(null)
  const [doneTask, setDoneTask] = useState<CockpitTask | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const triggerReload = useCallback(() => {
    setLoading(true)
    reload()
  }, [])
  const scheduleReload = useCockpitRealtimeReload(triggerReload)

  const busyRef = useRef(false)
  useEffect(() => {
    busyRef.current = Boolean(noteTask || snoozeTask || doneTask || pendingTaskKey || isRegenerating)
  }, [noteTask, snoozeTask, doneTask, pendingTaskKey, isRegenerating])

  useEffect(() => {
    const controller = new AbortController()

    async function loadInbox() {
      setError(null)

      try {
        const [inbox, cockpitTarget] = await Promise.all([
          getCockpitInbox({ limit: INBOX_LIMIT }),
          getCockpitTarget(asOfDate),
        ])

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
  }, [asOfDate, reloadKey, setError, setTarget, setTasks, t])

  // Recomputed each render (a single cheap formatter call) so the "today" window
  // stays current across a midnight boundary without an extra dependency.
  const todayKey = kyivDayKey(new Date())

  const todayCount = useMemo(
    () => tasks.reduce((count, task) => (isCockpitTaskToday(task, todayKey) ? count + 1 : count), 0),
    [tasks, todayKey],
  )

  const queueInsights = useMemo(() => buildCockpitTaskInsights(tasks, todayKey), [tasks, todayKey])

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter(
      (task) =>
        (!taskTypeFilter || task.task_type === taskTypeFilter) &&
        (!urgencyFilter || task.urgency === urgencyFilter) &&
        (dayFilter === 'all' || isCockpitTaskToday(task, todayKey)),
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
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [scheduleReload, t],
  )

  const handleDismiss = useCallback(
    async (task: CockpitTask) => {
      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'dismissed' })
        notifications.show({ color: 'green', message: t('Завдання відхилено') })
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [scheduleReload, t],
  )

  const handleTakeInProgress = useCallback(
    async (task: CockpitTask) => {
      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'in_progress' })
        notifications.show({ color: 'green', message: t('Завдання взято в роботу') })
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося оновити завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [scheduleReload, t],
  )

  const handleSnoozeSubmit = useCallback(
    async (task: CockpitTask, snoozeUntil: string) => {
      setPendingTaskKey(task.task_key)

      try {
        await setTaskStatus(task.task_key, { To: 'snoozed', SnoozeUntil: snoozeUntil })
        notifications.show({ color: 'green', message: t('Завдання відкладено') })
        setSnoozeTask(null)
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося відкласти завдання'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [scheduleReload, t],
  )

  const handleNoteSubmit = useCallback(
    async (task: CockpitTask, text: string) => {
      setPendingTaskKey(task.task_key)

      try {
        await addTaskNote(task.task_key, { Text: text })
        notifications.show({ color: 'green', message: t('Нотатку додано') })
        setNoteTask(null)
        scheduleReload()
      } catch (actionError) {
        notifications.show({
          color: 'red',
          message: actionError instanceof Error ? actionError.message : t('Не вдалося додати нотатку'),
        })
      } finally {
        setPendingTaskKey(null)
      }
    },
    [scheduleReload, t],
  )

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)

    try {
      await regenerateCockpit(asOfDate)
      notifications.show({ color: 'green', message: t('Завдання оновлено') })
      scheduleReload()
    } catch (actionError) {
      notifications.show({
        color: 'red',
        message: actionError instanceof Error ? actionError.message : t('Не вдалося згенерувати завдання'),
      })
    } finally {
      setRegenerating(false)
    }
  }, [asOfDate, scheduleReload, t])

  const handleReload = triggerReload

  const handleAsOfDateChange = useCallback(
    (value: string | undefined) => {
      setAsOfDate(value)
      setLoading(true)
    },
    [setAsOfDate],
  )

  return (
    <Stack className="cockpit-page" gap={6}>
      <CockpitToolbar
        asOfDate={asOfDate}
        dayFilter={dayFilter}
        isLoading={isLoading}
        isRegenerating={isRegenerating}
        taskType={taskTypeFilter}
        todayCount={todayCount}
        urgency={urgencyFilter}
        visibleCount={visibleTasks.length}
        onAsOfDateChange={handleAsOfDateChange}
        onDayFilterChange={setDayFilter}
        onRegenerate={handleRegenerate}
        onReload={handleReload}
        onTaskTypeChange={setTaskTypeFilter}
        onUrgencyChange={setUrgencyFilter}
      />

      <div className="cockpit-page-content">
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {target && <CockpitTargetCard target={target} />}

        <CockpitQueueSummary insights={queueInsights} isLoading={isLoading} visibleCount={visibleTasks.length} />

        <CockpitDashboardPanel asOfDate={asOfDate} reloadKey={reloadKey} />

        <CockpitTaskList
          isLoading={isLoading}
          pendingTaskKey={pendingTaskKey}
          tasks={visibleTasks}
          onAddNote={setNoteTask}
          onDismiss={handleDismiss}
          onDone={setDoneTask}
          onSnooze={setSnoozeTask}
          onTakeInProgress={handleTakeInProgress}
        />
      </div>

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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
