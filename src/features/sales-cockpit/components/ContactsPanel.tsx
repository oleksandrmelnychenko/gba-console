import { Alert, Badge, Button, Card, Group, Loader, Pagination, Stack, Text, TextInput } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getContacts } from '../api/contactsApi'
import { CONTACT_BUCKETS, CONTACT_RESULTS, type ContactBucket, type ContactClient, type ContactPage } from '../contactTypes'
import { formatContactDate } from '../utils/contactDate'

export function ContactsPanel({ onOpen, revision }: { onOpen: (client: ContactClient) => void; revision: number }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState<{ bucket: ContactBucket; search: string; page: number }>({ bucket: 'today', search: '', page: 1 })
  const [debounced] = useDebouncedValue(filter, 300)
  const [reload, refresh] = useReducer((x: number) => x + 1, 0)
  const [state, setState] = useState<{ data?: ContactPage; error?: string; loading: boolean }>({ loading: true })
  useEffect(() => {
    const controller = new AbortController()
    let inFlight = false
    async function load() {
      if (inFlight) return
      inFlight = true
      setState({ loading: true })
      try {
        const data = await getContacts(debounced.bucket, debounced.search.trim(), (debounced.page - 1) * 20, controller.signal)
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, Math.ceil(data.total / 20))
        if (debounced.page > lastPage) {
          setFilter((current) => current === debounced ? { ...current, page: lastPage } : current)
          return
        }
        setState({ data, loading: false })
      } catch (error) {
        if (!controller.signal.aborted) setState({ error: error instanceof Error ? error.message : t('Не вдалося завантажити контакти'), loading: false })
      } finally {
        inFlight = false
      }
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') void load() }
    void load()
    const interval = setInterval(refreshVisible, 60_000)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      controller.abort()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [debounced, revision, reload, t])
  const pending = state.loading || debounced !== filter
  return <Stack gap="sm" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
    <Group justify="space-between"><Text fw={600}>{t('Контакти та домовленості')}</Text><Button variant="default" onClick={refresh}>{t('Оновити')}</Button></Group>
    <Text size="sm" c="dimmed">{t('Остання домовленість по кожному клієнту. Час Києва. Записати перший контакт можна в «Мої клієнти» або з картки задачі.')}</Text>
    <TextInput label={t('Пошук контакту')} placeholder={t('Клієнт або наступна дія')} maxLength={200} value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.currentTarget.value, page: 1 })} />
    <Group gap="xs">{Object.entries(CONTACT_BUCKETS).map(([bucket, label]) => <Button key={bucket} size="xs" variant={filter.bucket === bucket ? 'filled' : 'light'} onClick={() => setFilter({ ...filter, bucket: bucket as ContactBucket, page: 1 })}>
      {t(label)} {state.data && !pending ? `(${state.data.counts[bucket as ContactBucket]})` : ''}
    </Button>)}</Group>
    {pending ? <Loader aria-label={t('Завантаження контактів')} size="sm" /> : state.error ? <Alert color="red">{state.error}</Alert> : state.data ? <>
      <Text size="xs" c="dimmed">{t('Станом на')}: {state.data.as_of} · {t('Знайдено')}: {state.data.total}</Text>
      {state.data.total === 0 && <Text>{t('Контактів за цими умовами немає')}</Text>}
      {state.data.contacts.map((contact) => <Card key={contact.client_id} withBorder padding="sm">
        <Stack gap={4} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Group justify="space-between"><Text fw={600}>{contact.client_name}</Text><Badge>{t(CONTACT_RESULTS[contact.result])}</Badge></Group>
          <Text size="sm">{contact.next_contact_at ? `${formatContactDate(contact.next_contact_at)} (${t('Київ')}) — ${contact.next_action}` : t('Без наступної домовленості')}</Text>
          {contact.note && <Text size="sm" style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{contact.note}</Text>}
          <Group justify="space-between"><Text size="xs" c="dimmed">{t('Останній контакт')}: {formatContactDate(contact.at)} · {contact.manager_name}</Text><Button size="xs" variant="light" onClick={() => onOpen(contact)}>{t('Контакт та історія')}</Button></Group>
        </Stack>
      </Card>)}
      {state.data.total > 20 && <Pagination value={filter.page} total={Math.ceil(state.data.total / 20)} onChange={(page) => setFilter({ ...filter, page })} />}
    </> : null}
  </Stack>
}
