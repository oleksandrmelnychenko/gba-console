import { Alert, Button, Group, Loader, Pagination, Stack, Text } from '@mantine/core'
import { useEffect, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getContactHistory } from '../api/contactsApi'
import { CONTACT_RESULTS, type ContactHistory } from '../contactTypes'
import { formatContactDate } from '../utils/contactDate'

export function ContactHistoryPanel({ clientId }: { clientId: number }) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [reload, refresh] = useReducer((x: number) => x + 1, 0)
  const query = `${clientId}:${page}:${reload}`
  const [state, setState] = useState<{ data?: ContactHistory; error?: string; query: string }>({ query: '' })
  useEffect(() => {
    const controller = new AbortController()
    void getContactHistory(clientId, (page - 1) * 20, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setState({ data, query }) },
      (error: unknown) => { if (!controller.signal.aborted) setState({ error: error instanceof Error ? error.message : t('Не вдалося завантажити історію'), query }) },
    )
    return () => controller.abort()
  }, [clientId, page, query, t])
  return <Stack gap="sm" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
    <Group justify="space-between"><Text fw={600}>{t('Історія контактів')}</Text><Button variant="subtle" size="xs" onClick={refresh}>{t('Оновити')}</Button></Group>
    {state.query !== query ? <Loader size="sm" /> : state.error ? <Alert color="red">{state.error}</Alert> : state.data ? <>
      {state.data.total === 0 && <Text c="dimmed">{t('Контактів ще не записано')}</Text>}
      {state.data.events.map((event) => <Stack key={event.event_id} gap={3} style={{ borderBottom: '1px solid var(--mantine-color-default-border)', paddingBottom: 8 }}>
        <Text size="sm" fw={600}>{t(CONTACT_RESULTS[event.result])}</Text>
        <Text size="xs" c="dimmed">{formatContactDate(event.at)} ({t('Київ')}) · {event.manager_name}</Text>
        {event.note && <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{event.note}</Text>}
        <Text size="sm">{event.next_contact_at ? `${formatContactDate(event.next_contact_at)} (${t('Київ')}) — ${event.next_action}` : t('Без наступної домовленості')}</Text>
      </Stack>)}
      {state.data.total > 20 && <Pagination value={page} total={Math.ceil(state.data.total / 20)} onChange={setPage} />}
    </> : null}
  </Stack>
}
