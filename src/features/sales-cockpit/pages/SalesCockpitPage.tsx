import { ActionIcon, Alert, Badge, Card, Group, Loader, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconRefresh, IconSparkles } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
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

const INBOX_LIMIT = 50

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

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

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
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isRegenerating, setRegenerating] = useState(false)
  const [pendingTaskKey, setPendingTaskKey] = useState<string | null>(null)
  const [noteTask, setNoteTask] = useState<CockpitTask | null>(null)
  const [snoozeTask, setSnoozeTask] = useState<CockpitTask | null>(null)
  const [doneTask, setDoneTask] = useState<CockpitTask | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadInbox() {
      setLoading(true)
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
          setTasks([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadInbox()

    return () => controller.abort()
  }, [reloadKey, setError, setTarget, setTasks, t])

  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter(
      (task) =>
        (!taskTypeFilter || task.task_type === taskTypeFilter) &&
        (!urgencyFilter || task.urgency === urgencyFilter),
    )

    return filtered.toSorted(inboxOrder)
  }, [tasks, taskTypeFilter, urgencyFilter])

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

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={700} size="xl">
              {t('Кокпіт продажів')}
            </Text>

            <Group gap="xs">
              <Badge color="blue" variant="light">
                {t('Завдань')}: {visibleTasks.length}
              </Badge>
              <Tooltip label={t('Згенерувати завдання')}>
                <ActionIcon
                  aria-label={t('Згенерувати завдання')}
                  color="violet"
                  loading={isRegenerating}
                  variant="light"
                  onClick={handleRegenerate}
                >
                  <IconSparkles size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <TaskFilters
            taskType={taskTypeFilter}
            urgency={urgencyFilter}
            onTaskTypeChange={setTaskTypeFilter}
            onUrgencyChange={setUrgencyFilter}
          />
        </Stack>
      </Card>

      {target && <TargetCard target={target} />}

      <CockpitDashboardPanel reloadKey={reloadKey} />

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
          <Text c="dimmed" size="sm">
            {t('Завантаження завдань')}
          </Text>
        </Group>
      ) : visibleTasks.length === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Text c="dimmed" ta="center">
            {t('Активних завдань немає')}
          </Text>
        </Card>
      ) : (
        <Stack gap="sm">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.task_key}
              task={task}
              onAddNote={setNoteTask}
              onDismiss={handleDismiss}
              onDone={setDoneTask}
              onSnooze={setSnoozeTask}
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
    <Card withBorder radius="md" shadow="sm">
      <Stack gap="sm">
        <Text fw={700} size="lg">
          {t('Моя ціль (місяць)')}
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Stack gap={4}>
            <Group gap="xs" wrap="nowrap">
              <Text c="dimmed" size="xs" tt="uppercase">
                {t('Відвантаження')}
              </Text>
              <Badge color={PACE_COLOR[target.shipped.pace_status]} variant="light">
                {t(PACE_LABEL[target.shipped.pace_status])}
              </Badge>
            </Group>
            <Text fw={600} size="sm">
              {formatMoney(target.shipped.mtd)} / {formatMoney(target.shipped.target)} · {formatPercent(target.shipped.attainment_pct)}
            </Text>
            <Text c="dimmed" size="xs">
              {t('Сьогодні потрібно')}: {formatMoney(target.shipped.today_needed)}
            </Text>
          </Stack>

          <Stack gap={4}>
            <Group gap="xs" wrap="nowrap">
              <Text c="dimmed" size="xs" tt="uppercase">
                {t('Оплати')}
              </Text>
              <Badge color={PACE_COLOR[target.paid.pace_status]} variant="light">
                {t(PACE_LABEL[target.paid.pace_status])}
              </Badge>
            </Group>
            <Text fw={600} size="sm">
              {formatMoney(target.paid.mtd)} / {formatMoney(target.paid.target)} · {formatPercent(target.paid.attainment_pct)}
            </Text>
            <Text c="dimmed" size="xs">
              {t('Сьогодні потрібно')}: {formatMoney(target.paid.today_needed)}
            </Text>
          </Stack>
        </SimpleGrid>
      </Stack>
    </Card>
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
