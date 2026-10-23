import { Alert, Button, Card, Group, Loader, Pagination, Stack, Text, TextInput } from '@mantine/core'
import { ClipboardList, History, MessageSquare, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import { useDebouncedValue } from '@mantine/hooks'
import { useCallback, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getWorkday } from '../api/workdayApi'
import { CONTACT_RESULTS, type ContactClient } from '../contactTypes'
import { useWorkdayResource } from '../hooks/useWorkdayResource'
import { formatContactDate } from '../utils/contactDate'
import { WORKDAY_BUCKETS, type WorkdayBucket, type WorkdayRow } from '../workdayTypes'
import { WorkdayTaskDetails, type WorkdayTaskActions } from './WorkdayTaskDetails'

export function WorkdayQueue({ revision, paused, actions, onContact }: {
  revision: number; paused: boolean; actions: WorkdayTaskActions; onContact: (client: ContactClient) => void
}) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<{ bucket: WorkdayBucket; search: string; page: number }>({ bucket: 'all', search: '', page: 1 })
  const [debounced] = useDebouncedValue(filter, 300)
  const [retry, refresh] = useReducer((x: number) => x + 1, 0)
  const [details, setDetails] = useState<WorkdayRow | null>(null)
  const load = useCallback(async (signal: AbortSignal) => {
    const data = await getWorkday(debounced.bucket, debounced.search.trim(), (debounced.page - 1) * 20, signal)
    const lastPage = Math.max(1, Math.ceil(data.total / 20))
    if (!signal.aborted && debounced.page > lastPage) setFilter((current) => current === debounced ? { ...current, page: lastPage } : current)
    return data
  }, [debounced])
  const state = useWorkdayResource(load, `${debounced.bucket}:${debounced.search}:${debounced.page}:${revision}:${retry}`, paused || details !== null)
  const loading = state.loading || debounced !== filter
  return <Stack gap={8} className="cockpit-workday-queue">
    <Group justify="space-between" gap={8}>
      <Text className="app-section-title" fw={600}>{t('Робоча черга клієнтів')}</Text>
      {state.data && !loading && <Group gap={6}>
        <Text className="cockpit-workday-asof">{t('Станом на')}: {state.data.as_of}</Text>
        <TableChip value={`${t('Карток у черзі')}: ${state.data.total}`} />
      </Group>}
    </Group>
    <div className="app-filter-bar cockpit-workday-toolbar">
      <div className="app-filter-field cockpit-workday-search">
        <TextInput leftSection={<Search size={16} />} label={t('Пошук у робочій черзі')} placeholder={t('Клієнт, завдання або наступна дія')} maxLength={200} value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.currentTarget.value, page: 1 })} />
      </div>
      <Button leftSection={<RotateCcw size={16} />} aria-label={t('Скинути фільтри черги')} variant="default" disabled={filter.bucket === 'all' && !filter.search && filter.page === 1} onClick={() => setFilter({ bucket: 'all', search: '', page: 1 })}>{t('Скинути')}</Button>
      <Button leftSection={<RefreshCw size={16} />} variant="default" onClick={refresh}>{t('Оновити чергу')}</Button>
    </div>
    <div className="cockpit-workday-buckets" role="group" aria-label={t('Статус робочої черги')}>
      {Object.entries(WORKDAY_BUCKETS).map(([bucket, label]) => <button type="button" key={bucket} aria-label={`${t(label)}${state.data && !loading ? ` (${state.data.counts[bucket as WorkdayBucket]})` : ''}`} className="cockpit-workday-bucket" aria-pressed={filter.bucket === bucket} onClick={() => setFilter({ ...filter, bucket: bucket as WorkdayBucket, page: 1 })}>
        {t(label)}{state.data && !loading && <TableChip value={state.data.counts[bucket as WorkdayBucket]} />}
      </button>)}
    </div>
    {loading ? <Loader aria-label={t('Завантаження робочої черги')} /> : state.error ? <Alert color="red">{state.error}</Alert> : state.data ? <>
      {!state.data.total && <div className="cockpit-workday-empty" role="status"><ClipboardList size={24} /><Text size="sm">{t('За цими умовами роботи немає. Змініть фільтри або запишіть контакт у «Мої клієнти».')}</Text></div>}
      {state.data.rows.map((row) => <Card key={row.key} className="cockpit-workday-client" withBorder padding="sm"><Stack gap={6}>
        <Group justify="space-between"><Text fw={600}>{row.client_name || t('Завдання без клієнта')}</Text><TableChip value={t(WORKDAY_BUCKETS[row.bucket])} tone={row.bucket === 'overdue' ? 'danger' : row.bucket === 'today' ? 'warning' : 'neutral'} /></Group>
        <Text size="sm">{t('Відповідальний')}: {row.manager_name || `#${row.manager_id}`} · {t('Активних задач')}: {row.task_count} · {t('У роботі')}: {row.in_progress_count} · {t('Від керівника')}: {row.manual_count}</Text>
        <Text size="sm">{t('Найближча дія')}: {row.due_at ? `${formatContactDate(row.due_at)} (${t('Київ')})` : t('Без дати')}</Text>
        {row.primary_task && <><Text size="sm" fw={500}>{row.primary_task.title || t('Завдання')}</Text>{row.primary_task.reason && <Text size="sm" c="dimmed">{row.primary_task.reason}</Text>}</>}
        {row.latest_contact && <>
          <Text size="sm">{t('Останній контакт')}: {formatContactDate(row.latest_contact.at)} · {row.latest_contact.manager_name} · {t(CONTACT_RESULTS[row.latest_contact.result])}</Text>
          <Text size="sm">{row.latest_contact.next_contact_at ? `${t('Наступний контакт')}: ${formatContactDate(row.latest_contact.next_contact_at)} — ${row.latest_contact.next_action}` : t('Без наступної домовленості')}</Text>
        </>}
        {!row.latest_contact && <Text size="sm" c="dimmed">{t('Контактів ще немає')} · {t('Наступну домовленість не визначено')}</Text>}
        {!row.can_contact && <Text size="xs" c="dimmed">{t('Клієнт поза вашим поточним списком. Доступні лише ваші завдання.')}</Text>}
        <Group justify="flex-end"><Button size="xs" variant="default" leftSection={<History size={14} />} onClick={() => setDetails(row)}>{t('Завдання та історія')}</Button>
          {row.can_contact && row.client_id !== null && <Button size="xs" variant="default" leftSection={<MessageSquare size={14} />} onClick={() => onContact({ client_id: row.client_id!, client_name: row.client_name })}>{t(actions.canAddNote ? 'Записати контакт та історія' : 'Історія контактів')}</Button>}
        </Group>
      </Stack></Card>)}
      {state.data.total > 20 && <Pagination value={filter.page} total={Math.ceil(state.data.total / 20)} onChange={(page) => setFilter({ ...filter, page })} />}
    </> : null}
    {details && <WorkdayTaskDetails key={details.key} row={details} actions={actions} revision={revision} paused={paused} onClose={() => setDetails(null)} />}
  </Stack>
}
