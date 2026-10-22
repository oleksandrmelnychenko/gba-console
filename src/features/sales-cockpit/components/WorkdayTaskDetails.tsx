import { Alert, Button, Group, Loader, Modal, Pagination, Stack, Text, getDefaultZIndex } from '@mantine/core'
import { useCallback, useReducer, useState, type ComponentProps } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getWorkdayTasks } from '../api/workdayApi'
import { useWorkdayResource } from '../hooks/useWorkdayResource'
import type { CockpitTask } from '../types'
import type { WorkdayRow, WorkdayScope } from '../workdayTypes'
import { formatContactDate } from '../utils/contactDate'
import { TaskCard } from './TaskCard'

export type WorkdayTaskActions = Omit<ComponentProps<typeof TaskCard>, 'task' | 'pending'> & { pendingTaskKey: string | null }
export function WorkdayTaskDetails({ row, actions, revision, paused, onClose }: {
  row: Pick<WorkdayRow, 'key' | 'client_name' | 'can_contact'>; actions: WorkdayTaskActions; revision: number; paused: boolean; onClose: () => void
}) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<{ scope: WorkdayScope; page: number }>({ scope: 'active', page: 1 })
  const [retry, refresh] = useReducer((x: number) => x + 1, 0)
  const load = useCallback(async (signal: AbortSignal) => {
    const data = await getWorkdayTasks(row.key, filter.scope, (filter.page - 1) * 20, signal)
    const lastPage = Math.max(1, Math.ceil(data.total / 20))
    if (!signal.aborted && filter.page > lastPage) setFilter((current) => current === filter ? { ...current, page: lastPage } : current)
    return data
  }, [filter, row.key])
  const state = useWorkdayResource(load, `${row.key}:${filter.scope}:${filter.page}:${revision}:${retry}`, paused)
  const editable = filter.scope === 'active'
  return <Modal opened zIndex={getDefaultZIndex('modal') - 1} onClose={onClose} title={`${t('Завдання клієнта')}: ${row.client_name || t('Без клієнта')}`} size="xl" trapFocus={!paused} closeButtonProps={{ 'aria-label': t('Закрити завдання') }} closeOnEscape={!paused} closeOnClickOutside={!paused} withCloseButton={!paused}>
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs">{(['active', 'history'] as const).map((scope) => <Button key={scope} variant={filter.scope === scope ? 'filled' : 'light'} onClick={() => setFilter({ scope, page: 1 })}>{t(scope === 'active' ? 'Активні завдання' : 'Історія завдань')}</Button>)}</Group>
        <Button variant="default" onClick={refresh}>{t('Оновити завдання')}</Button>
      </Group>
      <Text size="xs" c="dimmed">{t('Завдання, призначені вам. Історія контактів зберігає авторів і доступна поточному відповідальному за клієнта.')}</Text>
      {state.loading ? <Loader aria-label={t('Завантаження завдань')} /> : state.error ? <Alert color="red">{state.error}</Alert> : state.data ? <>
        <Text size="sm">{t('Завдань')}: {state.data.total}</Text>
        {!state.data.total && <Text>{t(editable ? 'Активних завдань немає' : 'Завершених завдань немає')}</Text>}
        {state.data.tasks.map((task) => <Stack key={task.task_key} gap={4}>
          <TaskCard {...actions} task={task} pending={actions.pendingTaskKey === task.task_key}
            canAddNote={editable && actions.canAddNote} canComplete={editable && actions.canComplete}
            canDismiss={editable && actions.canDismiss} canSnooze={editable && actions.canSnooze}
            canTakeInProgress={editable && actions.canTakeInProgress} onContact={row.can_contact ? actions.onContact : undefined} />
          <TaskHistory task={task} />
        </Stack>)}
        {state.data.total > 20 && <Pagination value={filter.page} total={Math.ceil(state.data.total / 20)} onChange={(page) => setFilter({ ...filter, page })} />}
      </> : null}
    </Stack>
  </Modal>
}
const STATUS_LABELS: Record<string, string> = { generated: 'Згенеровано', open: 'Відкрито', in_progress: 'У роботі', snoozed: 'Відкладено', done: 'Виконано', dismissed: 'Не актуально', orphaned: 'Більше не актуально' }
function TaskHistory({ task }: { task: CockpitTask }) {
  const { t } = useI18n()
  const history = Array.isArray(task.status_history) ? task.status_history as Record<string, unknown>[] : []
  return <Stack gap={4} px="sm" pb="sm">
    <Text size="sm">{t('Статус')}: {t(STATUS_LABELS[task.status ?? ''] ?? task.status ?? '—')}</Text>
    {typeof task.resolution_reason === 'string' && task.resolution_reason && <Text size="sm">{task.resolution_reason}</Text>}
    <TaskOutcome value={task.outcome} />
    {(task.notes?.length || history.length) ? <details><summary>{t('Нотатки та зміни статусу')}</summary><Stack gap={6} mt="xs">
      {keyedRecords(task.notes ?? []).map(({ record: note, key }) => <Text key={key} size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{note.author_name || t('Автор')} · {note.created_at ? formatContactDate(note.created_at) : '—'}: {note.text}</Text>)}
      {keyedRecords(history).map(({ record: entry, key }) => <TaskStatusEntry key={key} entry={entry} />)}
    </Stack></details> : null}
  </Stack>
}
function TaskOutcome({ value }: { value: unknown }) {
  const { t } = useI18n()
  if (!value || typeof value !== 'object') return null
  const outcome = value as Record<string, unknown>
  return <>
    {typeof outcome.sold === 'boolean' && <Text size="sm">{t(outcome.sold ? 'Продаж зі слів менеджера' : 'Без продажу')}{typeof outcome.amount === 'number' ? ` · €${outcome.amount}` : ''}</Text>}
    {typeof outcome.note === 'string' && outcome.note && <Text size="sm">{outcome.note}</Text>}
  </>
}
function TaskStatusEntry({ entry }: { entry: Record<string, unknown> }) {
  const { t } = useI18n()
  return <Text size="xs">{typeof entry.at === 'string' ? formatContactDate(entry.at) : '—'} · {t(STATUS_LABELS[String(entry.to)] ?? String(entry.to ?? ''))}{typeof entry.reason === 'string' ? ` · ${entry.reason}` : ''}</Text>
}
// Legacy notes and transitions have no IDs. Content plus an occurrence number keeps
// existing rows stable when a new distinct history record is added at the start.
function keyedRecords<T>(records: T[]): { record: T; key: string }[] {
  const occurrences = new Map<string, number>()
  return records.map((record) => {
    const content = JSON.stringify(record)
    const occurrence = occurrences.get(content) ?? 0
    occurrences.set(content, occurrence + 1)
    return { record, key: `${content}:${occurrence}` }
  })
}
