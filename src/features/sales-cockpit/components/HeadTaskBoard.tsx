import {
  Alert,
  Button,
  Card,
  Group,
  Pagination,
  Select,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  Ban,
  CircleCheck,
  CirclePlay,
  ListTodo,
  CircleAlert,
  ClipboardList,
  ClipboardPen,
  Clock3,
  MessageSquare,
  Plus,
  RefreshCw,
  Repeat,
  Shuffle,
  ListRestart,
  UserMinus,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { usePermissions } from '../../auth/usePermissions'
import {
  addHeadTaskNote,
  dismissHeadTask,
  getHeadTasks,
  regenerateHeadCockpit,
} from '../api/salesCockpitApi'
import type { HeadTask, HeadTaskByStatus, HeadTaskManager, HeadTasksResponse } from '../types'
import { useCockpitRealtimeReload } from '../hooks/useCockpitRealtimeReload'
import { BoardCancelModal, BoardNoteModal } from './HeadTaskBoardModals'
import { HeadDismissalsPanel } from './HeadDismissalsPanel'
import { NewHeadTaskModal } from './NewHeadTaskModal'

const POLL_INTERVAL_MS = 60_000
const RELATIVE_TIME_TICK_MS = 30_000
const PAGE_SIZE = 50

type BoardStatus = 'ready' | 'open' | 'in_progress' | 'done' | 'dismissed'
type TFn = (key: string, params?: Record<string, number | string>) => string

const STATUS_TABS: { value: BoardStatus; label: string; icon: LucideIcon; count: (status: HeadTaskByStatus) => number }[] = [
  { value: 'ready', label: 'Готові', icon: ClipboardList, count: (status) => status.Open + status.InProgress },
  { value: 'open', label: 'Нові', icon: ListTodo, count: (status) => status.Open },
  { value: 'in_progress', label: 'В роботі', icon: CirclePlay, count: (status) => status.InProgress },
  { value: 'done', label: 'Виконано', icon: CircleCheck, count: (status) => status.Done },
  { value: 'dismissed', label: 'Неактуальні', icon: Ban, count: (status) => status.Dismissed },
]

// Urgency → shared outlined-pill variant (docs/ui-patterns.md §4);
// normal keeps the default blue pill.
const URGENCY_PILL: Record<string, TableChipTone> = {
  critical: 'danger',
  high: 'warning',
  normal: 'document',
  low: 'neutral',
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
  manual: 'Від керівника',
}

const TASK_TYPE_VIEW: Record<string, { icon: LucideIcon; tone: string }> = {
  churn_winback: { icon: UserMinus, tone: 'red' },
  cross_sell: { icon: Shuffle, tone: 'teal' },
  debt_followup: { icon: Wallet, tone: 'orange' },
  default: { icon: ClipboardList, tone: 'gray' },
  manual: { icon: ClipboardPen, tone: 'brand' },
  new_client_activation: { icon: UserPlus, tone: 'green' },
  reorder_due: { icon: Repeat, tone: 'blue' },
}

const TASK_TYPE_FILTER_OPTIONS = [
  { value: 'manual', label: 'Від керівника' },
  { value: 'reorder_due', label: 'Час повторного замовлення' },
  { value: 'debt_followup', label: 'Контроль заборгованості' },
  { value: 'cross_sell', label: 'Крос-продаж' },
  { value: 'churn_winback', label: 'Повернення клієнта' },
  { value: 'new_client_activation', label: 'Активація нового клієнта' },
]

const dueDateFormatter = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit' })

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const EMPTY_RESPONSE: HeadTasksResponse = {
  IsHead: false,
  RequestedManagerNetUid: '',
  RequestedStatuses: [],
  RequestedManagerId: null,
  RequestedUrgency: null,
  RequestedTaskType: null,
  Skip: 0,
  Limit: 50,
  ReturnedCount: 0,
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
  const { can } = usePermissions()
  const canCreateTask = can(PermissionKeys.SalesHeadDashboard.Task.Create)
  const canAddNote = can(PermissionKeys.SalesHeadDashboard.Task.AddNote)
  const canDismissTask = can(PermissionKeys.SalesHeadDashboard.Task.Dismiss)
  const canGenerateTasks = can(PermissionKeys.SalesHeadDashboard.Task.Generate)
  const [data, setData] = useValueState<HeadTasksResponse>(EMPTY_RESPONSE)
  const [status, setStatus] = useValueState<BoardStatus>('ready')
  const [urgency, setUrgency] = useValueState<string | null>(null)
  const [taskType, setTaskType] = useValueState<string | null>(null)
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [noteTask, setNoteTask] = useState<HeadTask | null>(null)
  const [cancelTask, setCancelTask] = useState<HeadTask | null>(null)
  const [isActionPending, setActionPending] = useState(false)
  const [pageSelection, setPageSelection] = useState({ managerId, page: 1 })
  // The parent team list can change manager independently of the board select.
  const page = pageSelection.managerId === managerId ? pageSelection.page : 1
  if (pageSelection.managerId !== managerId) {
    setPageSelection({ managerId, page: 1 })
  }
  const setPage = useCallback((nextPage: number) => {
    setPageSelection({ managerId, page: nextPage })
  }, [managerId])
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

    async function load() {
      try {
        const result = await getHeadTasks({
          statuses: statusesQuery,
          managerId: managerId ?? undefined,
          urgency: urgency ?? undefined,
          taskType: taskType ?? undefined,
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

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }, POLL_INTERVAL_MS)

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }

    void load()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      active = false
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [statusesQuery, managerId, urgency, taskType, skip, reloadKey, setData, setError, t])

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
    [setPage, setStatus],
  )

  const handleManagerChange = useCallback(
    (value: string | null) => {
      onManagerChange(value ? Number(value) : null)
      setPage(1)
      setLoading(true)
    },
    [onManagerChange, setPage],
  )

  const handleUrgencyChange = useCallback(
    (value: string | null) => {
      setUrgency(value)
      setPage(1)
      setLoading(true)
    },
    [setPage, setUrgency],
  )

  const handleTaskTypeChange = useCallback(
    (value: string | null) => {
      setTaskType(value)
      setPage(1)
      setLoading(true)
    },
    [setPage, setTaskType],
  )

  const handleBoardNoteSubmit = useCallback(
    async (task: HeadTask, text: string) => {
      if (!can(PermissionKeys.SalesHeadDashboard.Task.AddNote)) {
        return
      }

      setActionPending(true)

      try {
        await addHeadTaskNote(task.TaskKey, { Text: text })
        notifications.show({ color: 'green', message: t('Коментар додано') })
        setNoteTask(null)
        scheduleReload()
      } catch (noteError) {
        notifications.show({
          color: 'red',
          message: noteError instanceof Error ? noteError.message : t('Не вдалося додати коментар'),
        })
      } finally {
        setActionPending(false)
      }
    },
    [can, scheduleReload, t],
  )

  const handleBoardCancelSubmit = useCallback(
    async (task: HeadTask, reason: string | null) => {
      if (!can(PermissionKeys.SalesHeadDashboard.Task.Dismiss)) {
        return
      }

      setActionPending(true)

      try {
        await dismissHeadTask(task.TaskKey, reason)
        notifications.show({ color: 'green', message: t('Задачу скасовано') })
        setCancelTask(null)
        scheduleReload()
      } catch (cancelError) {
        notifications.show({
          color: 'red',
          message: cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати задачу'),
        })
      } finally {
        setActionPending(false)
      }
    },
    [can, scheduleReload, t],
  )

  const handleGenerate = useCallback(async () => {
    if (!can(PermissionKeys.SalesHeadDashboard.Task.Generate)) {
      return
    }

    setGenerating(true)

    try {
      await regenerateHeadCockpit()
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
  }, [can, scheduleReload, t])

  if (forbidden) {
    return null
  }

  return (
    <Card className="app-section-card cockpit-board-card" withBorder radius="md" padding={0}>
      <Group align="center" className="cockpit-board-header" gap="sm" justify="space-between" wrap="wrap">
        <Group gap="xs">
          <Text className="app-section-title" fw={600} size="sm">{t('Черга задач')}</Text>
          <TableChip value={t('Оновлюється щохвилини')} />
        </Group>

        <Group gap="xs">
          <Text c="dimmed" size="xs">
            {relativeUpdatedLabel(lastUpdated, t)}
          </Text>
          {isLoading && <span className="cockpit-inline-loading" aria-hidden="true" />}
        </Group>
      </Group>

      <div className="app-screen-tabs" role="tablist" aria-label={t('Статуси задач')}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`app-screen-tab${tab.value === status ? ' is-active' : ''}`}
            role="tab"
            type="button"
            aria-selected={tab.value === status}
            onClick={() => handleStatusChange(tab.value)}
          >
            <tab.icon size={16} aria-hidden="true" />
            {t(tab.label)}
            <TableChip value={tab.count(data.ByStatus)} />
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
          value={managerId === null ? null : String(managerId)}
          onChange={handleManagerChange}
        />
        <Select
          clearable
          data={URGENCY_OPTIONS.map((value) => ({ value, label: t(URGENCY_LABEL[value]) }))}
          label={t('Терміновість')}
          placeholder={t('Будь-яка')}
          size="sm"
          value={urgency}
          onChange={handleUrgencyChange}
        />
        <Select
          clearable
          data={TASK_TYPE_FILTER_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))}
          label={t('Тип задачі')}
          placeholder={t('Усі типи')}
          size="sm"
          value={taskType}
          onChange={handleTaskTypeChange}
        />
        <div className="app-filter-actions cockpit-command-actions">
          {canCreateTask && (
            <Button
              color={CREATE_ACTION_COLOR}
              leftSection={<Plus size={16} />}
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              {t('Нова задача')}
            </Button>
          )}
          {canGenerateTasks && (
            <Button color="gray" variant="default" size="sm"
              leftSection={<ListRestart size={16} />}
              loading={isGenerating}
              onClick={handleGenerate}
            >
              {t('Перерахувати AI задачі')}
            </Button>
          )}
          <Button leftSection={<RefreshCw size={16} />} variant="default" onClick={triggerReload}>{t('Оновити')}</Button>
        </div>
      </div>


      {status === 'dismissed' && data.IsHead && <HeadDismissalsPanel managerId={managerId} />}

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
          <div aria-hidden="true" className="cockpit-board-list__head">
            <span />
            <span>{t('Задача')}</span>
            <span>{t('Очікувана сума · шанс')}</span>
            <span>{t('Терміновість')}</span>
            <span>{t('Оновлено')}</span>
            <span />
          </div>
          {data.Tasks.map((task) => (
            <HeadTaskRow
              canAddNote={canAddNote}
              canDismiss={canDismissTask}
              key={task.TaskKey}
              task={task}
              onAddNote={setNoteTask}
              onCancel={setCancelTask}
            />
          ))}
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

      <NewHeadTaskModal
        managers={data.Managers}
        opened={canCreateTask && isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={scheduleReload}
      />

      <BoardNoteModal
        saving={isActionPending}
        task={canAddNote ? noteTask : null}
        onClose={() => setNoteTask(null)}
        onSubmit={handleBoardNoteSubmit}
      />

      <BoardCancelModal
        saving={isActionPending}
        task={canDismissTask ? cancelTask : null}
        onClose={() => setCancelTask(null)}
        onSubmit={handleBoardCancelSubmit}
      />
    </Card>
  )
}

function HeadTaskRow({
  canAddNote,
  canDismiss,
  task,
  onAddNote,
  onCancel,
}: {
  canAddNote: boolean
  canDismiss: boolean
  task: HeadTask
  onAddNote: (task: HeadTask) => void
  onCancel: (task: HeadTask) => void
}) {
  const { t } = useI18n()
  const isManual = task.TaskType === 'manual'
  const dueDate = formatDueDate(task.DueDate)
  const lastNote = task.Notes.length > 0 ? task.Notes[task.Notes.length - 1] : null
  const isActive = task.Status === 'open' || task.Status === 'in_progress' || task.Status === 'snoozed'

  const managerName = task.ManagerName?.trim() || `#${task.ManagerId}`
  const typeView = TASK_TYPE_VIEW[task.TaskType ?? ''] ?? TASK_TYPE_VIEW.default
  const chance = task.POutcome !== null ? Math.max(0, Math.min(1, task.POutcome)) : null

  return (
    <div className={`cockpit-board-row is-urgency-${task.Urgency ?? 'normal'}${task.SlaBreached ? ' is-breached' : ''}`}>
      <span aria-hidden="true" className={`cockpit-board-row__type is-${typeView.tone}`}>
        <typeView.icon size={17} strokeWidth={1.9} />
      </span>

      <div className="cockpit-board-row__task">
        <div className="cockpit-board-row__headline">
          <Text className="cockpit-board-row__title">{task.Title?.trim() || t('Завдання')}</Text>
          {isManual && dueDate && (
            <span className="cockpit-board-row__type-label is-gray">{t('Термін')}: {dueDate}</span>
          )}
        </div>
        <div className="cockpit-board-row__meta">
          {task.TaskType && (
            <span className="cockpit-board-row__type-label">{taskTypeLabel(task.TaskType, t)}</span>
          )}
          <span className="cockpit-board-row__client" title={task.ClientName ?? undefined}>
            {task.ClientName?.trim() || (task.ClientId !== null && task.ClientId > 0 ? `#${task.ClientId}` : t('Клієнт не вказаний'))}
          </span>
          <span className="cockpit-board-row__manager">{managerName}</span>
          {lastNote?.Text && (
            <Tooltip label={`${lastNote.AuthorName ? `${lastNote.AuthorName}: ` : ''}${lastNote.Text}`} multiline w={320}>
              <span className="cockpit-board-row__notes">
                <MessageSquare size={12} /> {task.Notes.length}
              </span>
            </Tooltip>
          )}
        </div>
        {task.Status === 'dismissed' && task.ResolutionReason && (
          <Text c="red.7" mt={4} size="xs">
            {t('Причина')}: {task.ResolutionReason}
          </Text>
        )}
        {task.Status === 'done' && task.Outcome && (
          <Text c={task.Outcome.Sold ? 'green.7' : 'dimmed'} mt={4} size="xs">
            {task.Outcome.Sold
              ? `${t('Продаж відбувся')}${task.Outcome.Amount ? `: ${formatMoney(task.Outcome.Amount)}` : ''}`
              : t('Виконано без продажу')}
          </Text>
        )}
      </div>

      <div className="cockpit-board-row__value">
        <strong>{task.ExpectedValue !== null ? formatMoney(task.ExpectedValue) : '—'}</strong>
        {chance !== null ? (
          <span className="cockpit-board-row__chance" title={t('Шанс результату')}>
            <span className="cockpit-board-row__chance-track" aria-hidden="true">
              <span style={{ width: `${Math.max(4, Math.round(chance * 100))}%` }} />
            </span>
            {formatPercent(chance)}
          </span>
        ) : (
          <span className="cockpit-board-row__chance">{t('Пріоритет')} {Math.round(task.Priority)}</span>
        )}
      </div>

      <div className="cockpit-board-row__badges">
        <TableChip tone={urgencyPill(task.Urgency)} value={urgencyLabel(task.Urgency, t)} />
        {task.Status === 'in_progress' ? (
          <TableChip tone="warning" value={inProgressLabel(task.InProgressSince, t)} />
        ) : task.Status !== 'open' ? (
          <TableChip tone={statusPill(task.Status)} value={statusLabel(task.Status, t)} />
        ) : null}
        {task.SlaBreached && <TableChip tone="danger" value={t('Прострочено SLA')} />}
      </div>

      <div className="cockpit-board-row__updated">
        <Clock3 aria-hidden="true" size={12} />
        <span>{relativeTaskDateLabel(task.UpdatedAt || task.GeneratedAt, t)}</span>
      </div>

      <Group className="cockpit-board-row__actions" gap={4} wrap="nowrap">
        {canAddNote && <TableRowAction action="edit" label={t('Коментар керівника')} onClick={() => onAddNote(task)} />}
        {canDismiss && isManual && isActive && <TableRowAction action="cancel" label={t('Скасувати задачу')} onClick={() => onCancel(task)} />}
      </Group>
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

function urgencyPill(urgency: string | null): TableChipTone {
  return (urgency && URGENCY_PILL[urgency]) || 'document'
}

function urgencyLabel(urgency: string | null, t: (key: string) => string): string {
  return urgency ? t(URGENCY_LABEL[urgency] ?? urgency) : t(URGENCY_LABEL.normal)
}

function taskTypeLabel(taskType: string, t: (key: string) => string): string {
  return t(TASK_TYPE_LABEL[taskType] ?? taskType)
}

// Status → shared outlined-pill variant; open/generated keep the default blue pill.
const STATUS_PILL: Record<string, TableChipTone> = {
  open: 'document',
  in_progress: 'warning',
  done: 'success',
  snoozed: 'neutral',
  dismissed: 'neutral',
  generated: 'document',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Відкрита',
  in_progress: 'В роботі',
  done: 'Виконано',
  snoozed: 'Відкладено',
  dismissed: 'Відхилено',
  generated: 'Нова',
}

function statusPill(status: string | null): TableChipTone {
  return (status && STATUS_PILL[status]) || 'neutral'
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

function formatDueDate(value: string | null): string | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : dueDateFormatter.format(parsed)
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}
