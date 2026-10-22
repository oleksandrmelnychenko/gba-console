import { Alert, Badge, Button, Card, Group, Loader, Pagination, Stack, Text, TextInput } from '@mantine/core'
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
  return <Stack gap="sm" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
    <Group justify="space-between"><Text fw={600}>{t('Робоча черга клієнтів')}</Text><Group gap="xs">
      <Button aria-label={t('Скинути фільтри черги')} variant="default" disabled={filter.bucket === 'all' && !filter.search && filter.page === 1} onClick={() => setFilter({ bucket: 'all', search: '', page: 1 })}>{t('Скинути')}</Button>
      <Button variant="default" onClick={refresh}>{t('Оновити чергу')}</Button>
    </Group></Group>
    <Text size="sm" c="dimmed">{t('Один клієнт — одна картка з усіма активними задачами та останньою домовленістю. Спочатку прострочені, далі сьогодні. Час Києва.')}</Text>
    <TextInput label={t('Пошук у робочій черзі')} placeholder={t('Клієнт, завдання або наступна дія')} maxLength={200} value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.currentTarget.value, page: 1 })} />
    <Group gap="xs">{Object.entries(WORKDAY_BUCKETS).map(([bucket, label]) => <Button key={bucket} size="xs" aria-pressed={filter.bucket === bucket} variant={filter.bucket === bucket ? 'filled' : 'light'} onClick={() => setFilter({ ...filter, bucket: bucket as WorkdayBucket, page: 1 })}>{t(label)}{state.data && !loading ? ` (${state.data.counts[bucket as WorkdayBucket]})` : ''}</Button>)}</Group>
    {loading ? <Loader aria-label={t('Завантаження робочої черги')} /> : state.error ? <Alert color="red">{state.error}</Alert> : state.data ? <>
      <Text size="xs" c="dimmed">{t('Станом на')}: {state.data.as_of} · {t('Карток у черзі')}: {state.data.total}</Text>
      {!state.data.total && <Text role="status">{t('За цими умовами роботи немає. Змініть фільтри або запишіть контакт у «Мої клієнти».')}</Text>}
      {state.data.rows.map((row) => <Card key={row.key} withBorder padding="sm"><Stack gap={6}>
        <Group justify="space-between"><Text fw={600}>{row.client_name || t('Завдання без клієнта')}</Text><Badge>{t(WORKDAY_BUCKETS[row.bucket])}</Badge></Group>
        <Text size="sm">{t('Відповідальний')}: {row.manager_name || `#${row.manager_id}`} · {t('Активних задач')}: {row.task_count} · {t('У роботі')}: {row.in_progress_count} · {t('Від керівника')}: {row.manual_count}</Text>
        <Text size="sm">{t('Найближча дія')}: {row.due_at ? `${formatContactDate(row.due_at)} (${t('Київ')})` : t('Без дати')}</Text>
        {row.primary_task && <><Text size="sm" fw={500}>{row.primary_task.title || t('Завдання')}</Text>{row.primary_task.reason && <Text size="sm" c="dimmed">{row.primary_task.reason}</Text>}</>}
        {row.latest_contact && <>
          <Text size="sm">{t('Останній контакт')}: {formatContactDate(row.latest_contact.at)} · {row.latest_contact.manager_name} · {t(CONTACT_RESULTS[row.latest_contact.result])}</Text>
          <Text size="sm">{row.latest_contact.next_contact_at ? `${t('Наступний контакт')}: ${formatContactDate(row.latest_contact.next_contact_at)} — ${row.latest_contact.next_action}` : t('Без наступної домовленості')}</Text>
        </>}
        {!row.latest_contact && <Text size="sm" c="dimmed">{t('Контактів ще немає')} · {t('Наступну домовленість не визначено')}</Text>}
        {!row.can_contact && <Text size="xs" c="dimmed">{t('Клієнт поза вашим поточним списком. Доступні лише ваші завдання.')}</Text>}
        <Group justify="flex-end"><Button size="xs" variant="light" onClick={() => setDetails(row)}>{t('Завдання та історія')}</Button>
          {row.can_contact && row.client_id !== null && <Button size="xs" variant="light" onClick={() => onContact({ client_id: row.client_id!, client_name: row.client_name })}>{t(actions.canAddNote ? 'Записати контакт та історія' : 'Історія контактів')}</Button>}
        </Group>
      </Stack></Card>)}
      {state.data.total > 20 && <Pagination value={filter.page} total={Math.ceil(state.data.total / 20)} onChange={(page) => setFilter({ ...filter, page })} />}
    </> : null}
    {details && <WorkdayTaskDetails key={details.key} row={details} actions={actions} revision={revision} paused={paused} onClose={() => setDetails(null)} />}
  </Stack>
}
