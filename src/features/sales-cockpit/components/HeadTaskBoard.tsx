import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  Pagination,
  Select,
  Table,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconProgress, IconRefresh } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getHeadTasks } from '../api/salesCockpitApi'
import type { HeadTask, HeadTaskManager, HeadTasksResponse } from '../types'

const POLL_INTERVAL_MS = 7_000
const PAGE_SIZE = 50

type BoardStatus = 'open' | 'in_progress' | 'done'
type TFn = (key: string, params?: Record<string, number | string>) => string

const STATUS_TABS: { value: BoardStatus; label: string; countKey: keyof HeadTasksResponse['ByStatus'] }[] = [
  { value: 'open', label: 'Відкриті', countKey: 'Open' },
  { value: 'in_progress', label: 'В роботі', countKey: 'InProgress' },
  { value: 'done', label: 'Виконано', countKey: 'Done' },
]

const URGENCY_COLOR: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  normal: 'blue',
  low: 'gray',
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

export function HeadTaskBoard() {
  const { t } = useI18n()
  const [data, setData] = useValueState<HeadTasksResponse>(EMPTY_RESPONSE)
  const [status, setStatus] = useValueState<BoardStatus>('in_progress')
  const [managerId, setManagerId] = useValueState<string | null>(null)
  const [urgency, setUrgency] = useValueState<string | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useValueState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [isLoading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [, setTick] = useState(0)

  const skip = (page - 1) * PAGE_SIZE

  useEffect(() => {
    let active = true
    let interval: ReturnType<typeof setInterval> | null = null

    async function load() {
      try {
        const result = await getHeadTasks({
          statuses: status,
          managerId: managerId ? Number(managerId) : undefined,
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
  }, [status, managerId, urgency, skip, setData, setError, t])

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 1_000)
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
      setManagerId(value)
      setPage(1)
      setLoading(true)
    },
    [setManagerId],
  )

  const handleUrgencyChange = useCallback(
    (value: string | null) => {
      setUrgency(value)
      setPage(1)
      setLoading(true)
    },
    [setUrgency],
  )

  if (forbidden) {
    return null
  }

  return (
    <Card className="app-section-card cockpit-board-card" withBorder radius="md" padding={0}>
      <Group align="center" className="cockpit-board-header" gap="sm" justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Text className="app-section-title" fw={600}>{t('Усі задачі (live)')}</Text>
          <Badge color="orange" leftSection={<IconProgress size={12} />} variant="light">
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
              {data.ByStatus[tab.countKey]}
            </Badge>
          </button>
        ))}
      </div>

      <div className="app-filter-bar cockpit-board-filter">
        <Select
          clearable
          data={managerOptions}
          label={t('Менеджер')}
          placeholder={t('Усі менеджери')}
          size="sm"
          value={managerId}
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
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} size={34} variant="light" onClick={() => setLoading(true)}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {error && (
        <Alert className="cockpit-board-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
        <Table.ScrollContainer className="cockpit-board-table" minWidth={920}>
          <Table className="cockpit-team-table" highlightOnHover striped withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Менеджер')}</Table.Th>
                <Table.Th>{t('Клієнт')}</Table.Th>
                <Table.Th>{t('Задача')}</Table.Th>
                <Table.Th>{t('Терміновість')}</Table.Th>
                <Table.Th>{t('Статус')}</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>{t('Очікувана цінність')}</Table.Th>
                <Table.Th>{t('SLA')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.Tasks.map((task) => (
                <HeadTaskRow key={task.TaskKey} task={task} />
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
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

function HeadTaskRow({ task }: { task: HeadTask }) {
  const { t } = useI18n()

  return (
    <Table.Tr>
      <Table.Td className="cockpit-team-manager">{task.ManagerName?.trim() || `#${task.ManagerId}`}</Table.Td>
      <Table.Td>{task.ClientName?.trim() || `#${task.ClientId}`}</Table.Td>
      <Table.Td>
        <Group gap={6} wrap="nowrap">
          <Text size="sm">{task.Title?.trim() || t('Завдання')}</Text>
          {task.TaskType && (
            <Badge color="gray" size="sm" variant="light">
              {taskTypeLabel(task.TaskType, t)}
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Badge color={urgencyColor(task.Urgency)} variant="light">
          {urgencyLabel(task.Urgency, t)}
        </Badge>
      </Table.Td>
      <Table.Td>
        {task.Status === 'in_progress' ? (
          <Badge color="orange" leftSection={<IconProgress size={12} />} variant="light">
            {inProgressLabel(task.InProgressSince, t)}
          </Badge>
        ) : (
          <Badge color={statusColor(task.Status)} variant="light">
            {statusLabel(task.Status, t)}
          </Badge>
        )}
      </Table.Td>
      <Table.Td style={{ textAlign: 'right' }}>
        {task.ExpectedValue !== null ? (
          <Group gap={6} justify="flex-end" wrap="nowrap">
            <Text className="cockpit-task-ev" size="sm">
              {formatMoney(task.ExpectedValue)}
            </Text>
            {task.POutcome !== null && (
              <Badge color="teal" size="sm" variant="light">
                {t('шанс')} {formatPercent(task.POutcome)}
              </Badge>
            )}
          </Group>
        ) : (
          <Text c="dimmed" size="sm">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {task.SlaBreached ? (
          <Badge color="red" variant="filled">
            {t('Прострочено SLA')}
          </Badge>
        ) : (
          <Text c="dimmed" size="sm">
            —
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  )
}

function HeadTaskBoardSkeleton({ label }: { label: string }) {
  return (
    <div className="cockpit-table-skeleton is-board" aria-busy="true" aria-label={label}>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div key={rowIndex} className="cockpit-table-skeleton-row">
          {Array.from({ length: 7 }).map((__, columnIndex) => (
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

function buildManagerOptions(managers: HeadTaskManager[]): { value: string; label: string }[] {
  return managers.map((manager) => ({
    value: String(manager.ManagerId),
    label: manager.Name?.trim() || `#${manager.ManagerId}`,
  }))
}

function urgencyColor(urgency: string | null): string {
  return (urgency && URGENCY_COLOR[urgency]) || 'blue'
}

function urgencyLabel(urgency: string | null, t: (key: string) => string): string {
  return urgency ? t(URGENCY_LABEL[urgency] ?? urgency) : t(URGENCY_LABEL.normal)
}

function taskTypeLabel(taskType: string, t: (key: string) => string): string {
  return t(TASK_TYPE_LABEL[taskType] ?? taskType)
}

const STATUS_COLOR: Record<string, string> = {
  open: 'blue',
  in_progress: 'orange',
  done: 'green',
  snoozed: 'gray',
  dismissed: 'gray',
  generated: 'blue',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Відкрита',
  in_progress: 'В роботі',
  done: 'Виконано',
  snoozed: 'Відкладено',
  dismissed: 'Відхилено',
  generated: 'Нова',
}

function statusColor(status: string | null): string {
  return (status && STATUS_COLOR[status]) || 'gray'
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

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}
