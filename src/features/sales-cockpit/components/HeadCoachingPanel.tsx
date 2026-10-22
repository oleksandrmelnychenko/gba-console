import { Alert, Button, Card, Group, Modal, Pagination, Select, Stack, Text, Textarea } from '@mantine/core'
import { useEffect, useReducer, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import { usePermissions } from '../../auth/usePermissions'
import { useCockpitRealtimeReload } from '../hooks/useCockpitRealtimeReload'
import { assignHeadTask, getHeadCoaching, type CoachingBucket, type CoachingPage, type CoachingRow } from '../api/headCoachingApi'

const labels: Record<CoachingBucket, string> = { workload: 'Активні задачі', overdue_promises: 'Прострочені обіцянки', without_next_contact: 'Без наступного контакту', repeat_tasks: 'Повторні покупки: активні задачі' }
const statuses = [{ value: 'all', label: 'Усі активні' }, { value: 'open', label: 'Нові' }, { value: 'in_progress', label: 'У роботі' }, { value: 'snoozed', label: 'Відкладені' }]
const date = (value: string | null) => value ? new Date(value).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) : '—'
export function HeadCoachingPanel({ managerId, managers, onChanged }: { managerId: number | null; managers: { id: number; name: string }[]; onChanged: () => void }) {
  const { can } = usePermissions()
  const [bucket, setBucket] = useState<CoachingBucket>('overdue_promises')
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState({ from: '', to: '' })
  const [selection, setSelection] = useState({ managerId, page: 1 })
  const page = selection.managerId === managerId ? selection.page : 1
  if (selection.managerId !== managerId) setSelection({ managerId, page: 1 })
  const [data, setData] = useState<CoachingPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, reload] = useReducer(n => n + 1, 0)
  useCockpitRealtimeReload(reload)
  const [editing, setEditing] = useState<CoachingRow | null>(null)
  const [assignee, setAssignee] = useState<string | null>(null)
  const [clarification, setClarification] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  useEffect(() => {
    const timer = setInterval(reload, 60_000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setData(null)
    setError(null)
    void getHeadCoaching({ managerId: managerId ?? undefined, bucket, status, dateFrom: range.from || undefined, dateTo: range.to || undefined, offset: (page - 1) * 20, limit: 20 }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof ApiError && cause.status === 403 ? 'Немає доступу до черг керівника' : cause instanceof Error ? cause.message : 'Не вдалося завантажити чергу') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [managerId, bucket, status, range, page, revision])
  const resetPage = () => setSelection({ managerId, page: 1 })
  async function save() {
    if (!editing || !assignee || !clarification.trim()) return
    setSaving(true); setSaveError(null)
    try {
      await assignHeadTask(editing, Number(assignee), clarification.trim())
      setEditing(null); reload(); onChanged()
    } catch (cause) {
      setSaveError(cause instanceof ApiError && cause.status === 409 ? 'Задачу вже змінили або закрили. Закрийте вікно й оновіть чергу перед повторною спробою.' : cause instanceof Error ? cause.message : 'Не вдалося передати задачу')
    } finally { setSaving(false) }
  }
  return <Card component="section" aria-label="Робочі черги команди" withBorder padding="sm"><Stack gap="sm">
    <Group justify="space-between"><Text fw={600}>Робочі черги команди</Text><Button variant="subtle" size="xs" onClick={reload} loading={loading}>Оновити черги</Button></Group>
    <Text size="xs" c="dimmed">Поточний стан. Лічильники охоплюють усю вибірку. Це навантаження й домовленості, а не рейтинг якості менеджерів.</Text>
    <Group>{(Object.keys(labels) as CoachingBucket[]).map(value => <Button key={value} size="xs" variant={bucket === value ? 'filled' : 'light'} onClick={() => { setBucket(value); resetPage() }}>{labels[value]}{data ? ` · ${data.counts[value]}` : ''}</Button>)}</Group>
    <Group align="end"><Select label="Статус задач" data={statuses} value={status} disabled={bucket === 'overdue_promises' || bucket === 'without_next_contact'} onChange={value => { setStatus(value ?? 'all'); resetPage() }} />
      <ToolbarDateRangeFilter from={range.from} to={range.to} fromLabel="Строк від" toLabel="Строк до" onChange={value => { setRange(value); resetPage() }} />
      {(range.from || range.to) && <Button variant="subtle" onClick={() => { setRange({ from: '', to: '' }); resetPage() }}>Скинути дати</Button>}
    </Group>
    <Text size="xs" c="dimmed">Дати фільтрують строк задачі або наступного контакту за Києвом, не відновлюють історичну чергу. Без строку — лише без фільтра дат. Повторні покупки тут — збережені активні рекомендації.</Text>
    {error && <Alert color="red">{error}</Alert>}
    {loading && <Text role="status">Завантаження черги…</Text>}
    {data && <><Text size="xs" c="dimmed">Оновлено: {date(data.as_of)} · У вибірці: {data.total}</Text>
      {data.rows.length === 0 && <Text>{data.total > 0 ? 'На цій сторінці вже немає записів. Поверніться на першу.' : 'Записів за цими фільтрами немає.'}</Text>}
      {data.rows.map(row => <Card withBorder padding="xs" key={row.key}>
        <Group justify="space-between" align="start"><Stack gap={2} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Text fw={600} size="sm">{row.client_name || row.title}</Text><Text size="sm">{row.title}</Text>
          <Text size="xs">{row.manager_name} · {statuses.find(s => s.value === row.status)?.label ?? 'Контакт'} · Строк: {date(row.due_at)}</Text>
          {row.task_key && <Text size="xs" c="dimmed">{row.task_type === 'manual' ? 'Ручна задача' : 'AI-рекомендація'} · {row.task_key}</Text>}
          {!row.task_key && <Text size="xs" c="dimmed">Останній контакт: {date(row.contact_at)}</Text>}
          {row.assignment_history.map(entry => <Text size="xs" c="dimmed" key={entry.id ?? `${entry.at}-${entry.from}-${entry.to}-${entry.source}`}>{date(entry.at)} · #{entry.from} → #{entry.to} · {entry.clarification || entry.source}</Text>)}
        </Stack>{row.task_key && row.updated_at && can(PermissionKeys.SalesHeadDashboard.Task.Create) && <Button size="xs" variant="light" onClick={() => { setEditing(row); setAssignee(String(row.manager_id)); setClarification(''); setSaveError(null) }}>Передати / уточнити</Button>}</Group>
      </Card>)}
      {data.total > 20 && <Pagination total={Math.ceil(data.total / 20)} value={page} onChange={next => setSelection({ managerId, page: next })} />}
      {page > 1 && <Button variant="subtle" onClick={resetPage}>На першу сторінку</Button>}
    </>}
    <Modal opened={Boolean(editing)} onClose={() => { if (!saving) setEditing(null) }} title="Передати або уточнити задачу" closeOnClickOutside={!saving} closeOnEscape={!saving}>
      <Stack><Text size="sm">Передається лише задача. Клієнт залишається за основним менеджером; авторство минулих продажів зберігається.</Text>
        <Select label="Виконавець" data={managers.map(m => ({ value: String(m.id), label: m.name }))} value={assignee} onChange={setAssignee} searchable disabled={saving} />
        <Textarea label="Уточнення / причина" value={clarification} onChange={event => setClarification(event.currentTarget.value)} maxLength={2000} required disabled={saving} />
        {saveError && <Alert color="red">{saveError}</Alert>}
        <Button onClick={() => void save()} loading={saving} disabled={!assignee || !clarification.trim()}>Зберегти призначення</Button>
      </Stack>
    </Modal>
  </Stack></Card>
}
