import { Alert, Button, Card, Group, Loader, Select, Stack, Text, Title } from '@mantine/core'
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PermissionKeys } from '../../shared/auth/permissionKeys'
import { AUTH_SESSION_CHANGED_EVENT, readSession } from '../../shared/auth/session'
import { ApiError } from '../../shared/api/apiClient'
import type { ApiStreamSession } from '../../shared/api/apiStreamClient'
import { getRegisterSchema, generateRegisterStatement, listRegisterPublications } from './registerReportsApi'
import type { RegisterPublicationSummary } from './publicationCatalogue'
import type { SourceRegisterDescriptorWire, SourceRegisterQueryDraft, SourceRegisterQueryWire, SourceRegisterResultWire } from './types'
import { emptyRegisterQueryDraft } from './query'
import { registerPeriodDraft, displayRegisterPeriod } from './period'
import { SourceRegisterReportBuilder } from './SourceRegisterReportBuilder'
import { SourceRegisterResultTable } from './SourceRegisterResultTable'

type Loaded<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T }
function subscribeStoredOwner(listener: () => void) {
  window.addEventListener('storage', listener); window.addEventListener(AUTH_SESSION_CHANGED_EVENT, listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, listener) }
}
const storedOwner = () => readSession()?.userNetUid ?? ''
function failure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Сесію завершено. Увійдіть повторно.'
    if (error.status === 403) return 'Недостатньо прав для формування звітів регістрів.'
    if (error.status === 404) return 'Публікація більше недоступна. Оновіть список публікацій.'
    if (error.status === 503) return 'Дані публікації поки недоступні. Спробуйте пізніше або оновіть список.'
    if (error.status === 400) return 'Перевірте параметри звіту та межі доступного періоду.'
    if (error.status === 413) return 'Параметри перевищують дозволений розмір. Зменште кількість показників.'
    if (error.status === 0) return 'Сервер недоступний. Спробуйте ще раз.'
  }
  return 'Дані звіту не пройшли перевірку формату, обсягу або відповідності публікації.'
}
function LoadFailure({ message, retry }: { message: string; retry: () => void }) {
  return <Alert color="red" title="Не вдалося завантажити звіт"><Stack gap="sm"><Text>{message}</Text><Button variant="light" onClick={retry}>Спробувати ще раз</Button></Stack></Alert>
}

export function SourceRegisterReportsPage() {
  const auth = useAuth()
  const currentOwner = useSyncExternalStore(subscribeStoredOwner, storedOwner, () => '')
  const owner = auth.session?.userNetUid, csrfToken = auth.session?.csrfToken
  const session = useMemo(() => ({ userNetUid: owner ?? '', csrfToken }), [owner, csrfToken])
  const [reload, setReload] = useState(0)
  if (auth.isLoading || auth.isPermissionsLoading) return <Loader aria-label="Перевірка доступу" />
  if (!auth.isAuthenticated || !owner || currentOwner !== owner) return <Alert color="yellow">Дочекайтеся завантаження користувача або увійдіть повторно.</Alert>
  if (!auth.hasPermission(PermissionKeys.ReportsStocks.Report.Generate)) return <Alert color="red">Недостатньо прав для формування звітів регістрів.</Alert>
  return <Stack p="md">
    <Group justify="space-between" wrap="wrap">
      <Title order={2}>Звіти регістрів</Title>
      <Group wrap="wrap">
        {auth.hasPermission(PermissionKeys.ReportsStocks.Page.View) ? <Button component={Link} to="/reports/stocks" variant="subtle">До звітів</Button> : null}
        <Button variant="light" onClick={() => setReload(value => value + 1)}>Оновити публікації</Button>
      </Group>
    </Group>
    <Text c="dimmed">Оберіть доступну публікацію даних, її період і показники звіту.</Text>
    <PublicationCatalogue key={JSON.stringify([owner, reload])} session={session} retry={() => setReload(value => value + 1)} />
  </Stack>
}

function PublicationCatalogue({ session, retry }: { session: ApiStreamSession; retry: () => void }) {
  const [state, setState] = useState<Loaded<readonly RegisterPublicationSummary[]>>({ status: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const load = useEffectEvent((signal: AbortSignal) => listRegisterPublications({ session, signal }))
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(
      value => { if (!controller.signal.aborted) setState({ status: 'ready', value }) },
      error => { if (!controller.signal.aborted) setState({ status: 'error', message: failure(error) }) },
    )
    return () => controller.abort()
  }, [])
  if (state.status === 'loading') return <Loader aria-label="Завантаження публікацій" />
  if (state.status === 'error') return <LoadFailure message={state.message} retry={retry} />
  if (state.value.length === 0) return <Alert color="blue" title="Публікацій поки немає">Дані для звітів регістрів ще не підготовлено.</Alert>
  const publication = state.value.find(item => item.publicationId === selectedId)
  return <Stack>
    <PublicationPicker items={state.value} value={selectedId} onChange={setSelectedId} />
    {publication ? <SelectedPublication key={JSON.stringify([publication.publicationId, publication.authorizationVersion, attempt])} publication={publication} session={session} retry={() => setAttempt(value => value + 1)} /> : null}
  </Stack>
}

function PublicationPicker({ items, value, onChange }: { items: readonly RegisterPublicationSummary[]; value: string | null; onChange: (value: string | null) => void }) {
  const data = useMemo(() => {
    const captions = new Map<string, number>()
    const label = (item: RegisterPublicationSummary) => `${item.caption} · ${item.schema.world} · редакція ${item.revision}`
    for (const item of items) { const key = label(item); captions.set(key, (captions.get(key) ?? 0) + 1) }
    return items.map(item => ({ value: item.publicationId, label: `${label(item)}${captions.get(label(item))! > 1 ? ` · ${item.publicationId}` : ''}` }))
  }, [items])
  return <Select label="Публікація даних" placeholder="Оберіть публікацію" searchable clearable limit={50} data={data} value={value} onChange={onChange} nothingFoundMessage="Публікацій не знайдено" />
}

function SelectedPublication({ publication, session, retry }: { publication: RegisterPublicationSummary; session: ApiStreamSession; retry: () => void }) {
  const [state, setState] = useState<Loaded<SourceRegisterDescriptorWire>>({ status: 'loading' })
  const load = useEffectEvent((signal: AbortSignal) => getRegisterSchema(publication, { session, signal }))
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal).then(
      value => { if (!controller.signal.aborted) setState({ status: 'ready', value }) },
      error => { if (!controller.signal.aborted) setState({ status: 'error', message: failure(error) }) },
    )
    return () => controller.abort()
  }, [])
  return <Stack>
    <Card withBorder><Text fw={600}>{publication.caption}</Text><Text size="sm">{publication.schema.world} · редакція {publication.revision}</Text>
      <Text size="sm">Доступний період: {displayRegisterPeriod(publication.coverageStart)} — {displayRegisterPeriod(publication.coverageEndExclusive)} (кінцева межа не включається).</Text></Card>
    {state.status === 'loading' ? <Loader aria-label="Завантаження опису регістру" /> : state.status === 'error' ? <LoadFailure message={state.message} retry={retry} />
      : <RegisterConstruction descriptor={state.value} publication={publication} session={session} />}
  </Stack>
}

function RegisterConstruction({ descriptor, publication, session }: { descriptor: SourceRegisterDescriptorWire; publication: RegisterPublicationSummary; session: ApiStreamSession }) {
  const [draft, setDraft] = useState<SourceRegisterQueryDraft>(() => ({ ...emptyRegisterQueryDraft(), from: registerPeriodDraft(publication.coverageStart), toExclusive: registerPeriodDraft(publication.coverageEndExclusive) }))
  const [generation, setGeneration] = useState<{ status: 'idle' | 'pending' } | { status: 'ready'; result: SourceRegisterResultWire } | { status: 'failed'; message: string }>({ status: 'idle' })
  const busy = generation.status === 'pending'
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  function change(value: SourceRegisterQueryDraft) {
    active.current?.abort(); active.current = null
    setGeneration({ status: 'idle' }); setDraft(value)
  }
  async function generate(query: SourceRegisterQueryWire) {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setGeneration({ status: 'pending' })
    try {
      const value = await generateRegisterStatement(publication, descriptor, query, { session, signal: controller.signal })
      if (!controller.signal.aborted && active.current === controller) setGeneration({ status: 'ready', result: value })
    } catch (caught) {
      if (!controller.signal.aborted && active.current === controller) setGeneration({ status: 'failed', message: failure(caught) })
    } finally { if (active.current === controller) active.current = null }
  }
  return <Stack>
    <SourceRegisterReportBuilder descriptor={descriptor} registerLabel={publication.caption} value={draft} onChange={change} onSubmit={generate} busy={busy} />
    {busy ? <Button variant="subtle" onClick={() => { active.current?.abort(); active.current = null; setGeneration({ status: 'idle' }) }}>Скасувати завантаження</Button> : null}
    {generation.status === 'failed' ? <Alert color="red" title="Звіт не сформовано">{generation.message}</Alert> : null}
    {generation.status === 'ready' ? <SourceRegisterResultTable descriptor={descriptor} registerLabel={publication.caption} result={generation.result} /> : null}
  </Stack>
}
