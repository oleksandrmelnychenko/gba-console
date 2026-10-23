import { Alert, Button, Card, Group, Loader, Pagination, Stack, Text, TextInput } from '@mantine/core'
import { History, MessagesSquare, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
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
  return <Stack gap={8} className="cockpit-workday-queue cockpit-contacts-panel">
    <Group justify="space-between" gap={8}>
      <Text className="app-section-title" fw={600}>{t('Контакти та домовленості')}</Text>
      {state.data && !pending && <Group gap={6}>
        <Text className="cockpit-workday-asof">{t('Станом на')}: {state.data.as_of}</Text>
        <TableChip value={`${t('Знайдено')}: ${state.data.total}`} />
      </Group>}
    </Group>
    <div className="app-filter-bar cockpit-workday-toolbar">
      <div className="app-filter-field cockpit-workday-search">
        <TextInput leftSection={<Search size={16} />} label={t('Пошук контакту')} placeholder={t('Клієнт або наступна дія')} maxLength={200} value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.currentTarget.value, page: 1 })} />
      </div>
      <Button leftSection={<RotateCcw size={16} />} variant="default" disabled={filter.bucket === 'today' && !filter.search && filter.page === 1} onClick={() => setFilter({ bucket: 'today', search: '', page: 1 })}>{t('Скинути')}</Button>
      <Button leftSection={<RefreshCw size={16} />} variant="default" onClick={refresh}>{t('Оновити')}</Button>
    </div>
    <div className="cockpit-workday-buckets" role="group" aria-label={t('Статус контакту')}>
      {Object.entries(CONTACT_BUCKETS).map(([bucket, label]) => <button type="button" key={bucket} className="cockpit-workday-bucket" aria-pressed={filter.bucket === bucket} aria-label={`${t(label)}${state.data && !pending ? ` (${state.data.counts[bucket as ContactBucket]})` : ''}`} onClick={() => setFilter({ ...filter, bucket: bucket as ContactBucket, page: 1 })}>
        {t(label)}{state.data && !pending && <TableChip value={state.data.counts[bucket as ContactBucket]} />}
      </button>)}
    </div>
    {pending ? <Loader aria-label={t('Завантаження контактів')} size="sm" /> : state.error ? <Alert color="red">{state.error}</Alert> : state.data ? <>
      {state.data.total === 0 && <div className="cockpit-workday-empty" role="status">
        <MessagesSquare size={24} />
        <Text size="sm">{t('Контактів за цими умовами немає')}</Text>
        <Text size="xs" c="dimmed">{t('Записати контакт можна у вкладці «Мої клієнти».')}</Text>
      </div>}
      {state.data.contacts.map((contact) => <Card key={contact.client_id} className="cockpit-workday-client" withBorder padding="sm">
        <Stack gap={6}>
          <Group justify="space-between" gap={8}><Text fw={600} size="sm">{contact.client_name}</Text><TableChip value={t(CONTACT_RESULTS[contact.result])} /></Group>
          <Text size="sm">{contact.next_contact_at ? `${formatContactDate(contact.next_contact_at)} (${t('Київ')}) — ${contact.next_action}` : t('Без наступної домовленості')}</Text>
          {contact.note && <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{contact.note}</Text>}
          <Group justify="space-between" gap={8}><Text className="cockpit-workday-asof">{t('Останній контакт')}: {formatContactDate(contact.at)} · {contact.manager_name}</Text><Button size="xs" variant="default" leftSection={<History size={14} />} onClick={() => onOpen(contact)}>{t('Контакт та історія')}</Button></Group>
        </Stack>
      </Card>)}
      {state.data.total > 20 && <Pagination value={filter.page} total={Math.ceil(state.data.total / 20)} onChange={(page) => setFilter({ ...filter, page })} />}
    </> : null}
  </Stack>
}
