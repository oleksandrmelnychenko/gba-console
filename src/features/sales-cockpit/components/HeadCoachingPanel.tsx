import { Alert, Button, Card, Group, Pagination, Select, Stack, Text, Textarea } from '@mantine/core'
import { ClipboardList, Info, RefreshCw, RotateCcw, Save, UserRoundPen } from 'lucide-react'
import { TableChip } from '../../../shared/ui/TableChip'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
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
function requestError(cause: unknown, status: number, statusMessage: string, fallback: string) {
  if (cause instanceof ApiError && cause.status === status) return statusMessage
  return cause instanceof Error ? cause.message : fallback
}
function ManagerFilter({ managerId, managers, onChange }: { managerId: number | null; managers: { id: number; name: string }[]; onChange?: (managerId: number | null) => void }) {
  if (!onChange) return null
  return <Select label="Виконавець черги" placeholder="Усі виконавці" data={managers.map(m => ({ value: String(m.id), label: m.name }))} value={managerId === null ? null : String(managerId)} clearable searchable onChange={value => onChange(value ? Number(value) : null)} />
}
function useManagerPage(managerId: number | null) {
  const [selection, setSelection] = useState({ managerId, page: 1 })
  const page = selection.managerId === managerId ? selection.page : 1
  if (selection.managerId !== managerId) setSelection({ managerId, page: 1 })
  return { page, setPage: (next: number) => setSelection({ managerId, page: next }) }
}
export function HeadCoachingPanel({ managerId, managers, onChanged, onManagerChange }: { managerId: number | null; managers: { id: number; name: string }[]; onChanged: () => void; onManagerChange?: (managerId: number | null) => void }) {
  const { can } = usePermissions()
  const [bucket, setBucket] = useState<CoachingBucket>('overdue_promises')
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState({ from: '', to: '' })
  const { page, setPage } = useManagerPage(managerId)
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
    async function load() {
      setLoading(true)
      setData(null)
      setError(null)
      try {
        const result = await getHeadCoaching({ managerId: managerId ?? undefined, bucket, status, dateFrom: range.from || undefined, dateTo: range.to || undefined, offset: (page - 1) * 20, limit: 20 }, controller.signal)
        if (!controller.signal.aborted) setData(result)
      } catch (cause) {
        if (!controller.signal.aborted) setError(requestError(cause, 403, 'Немає доступу до черг керівника', 'Не вдалося завантажити чергу'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [managerId, bucket, status, range, page, revision])
  const availableManagers = data?.managers ?? managers
  const resetPage = () => setPage(1)
  async function save() {
    if (!editing || !assignee || !clarification.trim()) return
    setSaving(true); setSaveError(null)
    try {
      await assignHeadTask(editing, Number(assignee), clarification.trim())
      setEditing(null); reload(); onChanged()
    } catch (cause) {
      setSaveError(requestError(cause, 409, 'Задачу вже змінили або закрили. Закрийте вікно й оновіть чергу перед повторною спробою.', 'Не вдалося передати задачу'))
    } finally { setSaving(false) }
  }
  return <Card component="section" className="app-section-card cockpit-coaching-panel" aria-label="Робочі черги команди" withBorder padding="sm"><Stack gap={8}>
    <Group justify="space-between" gap={8}>
      <Text className="app-section-title" fw={600}>Робочі черги команди</Text>
      {data && <TableChip value={`У вибірці: ${data.total}`} />}
    </Group>
    <div className="cockpit-workday-buckets" role="group" aria-label="Категорії робочих черг">
      {(Object.keys(labels) as CoachingBucket[]).map(value => <button type="button" className="cockpit-workday-bucket" key={value} aria-pressed={bucket === value} aria-label={`${labels[value]}${data ? ` · ${data.counts[value]}` : ''}`} onClick={() => { setBucket(value); resetPage() }}>
        {labels[value]}{data && <TableChip value={data.counts[value]} />}
      </button>)}
    </div>
    <div className="app-filter-bar cockpit-coaching-toolbar">
      <ManagerFilter managerId={managerId} managers={availableManagers} onChange={onManagerChange} />
      <Select label="Статус задач" data={statuses} value={status} disabled={bucket === 'overdue_promises' || bucket === 'without_next_contact'} onChange={value => { setStatus(value ?? 'all'); resetPage() }} />
      <ToolbarDateRangeFilter from={range.from} to={range.to} fromLabel="Строк від" toLabel="Строк до" onChange={value => { setRange(value); resetPage() }} />
      {(range.from || range.to) && <Button leftSection={<RotateCcw size={16} />} variant="default" onClick={() => { setRange({ from: '', to: '' }); resetPage() }}>Скинути дати</Button>}
      <Button leftSection={<RefreshCw size={16} />} variant="default" onClick={reload} loading={loading}>Оновити черги</Button>
    </div>
    <details className="cockpit-head-data-note">
      <summary><Info size={13} />Про дані{data && <span className="cockpit-workday-asof"> · Оновлено: {date(data.as_of)}</span>}</summary>
      <Text size="xs" c="dimmed">Поточний стан. Лічильники охоплюють усю вибірку. Це навантаження й домовленості, а не рейтинг якості менеджерів.</Text>
      <Text size="xs" c="dimmed">Дати фільтрують строк задачі або наступного контакту за Києвом, не відновлюють історичну чергу. Без строку — лише без фільтра дат. Повторні покупки тут — збережені активні рекомендації.</Text>
    </details>
    {error && <Alert color="red">{error}</Alert>}
    {loading && <Text role="status">Завантаження черги…</Text>}
    {data && <>
      {data.rows.length === 0 && <div className="cockpit-workday-empty" role="status"><ClipboardList size={24} /><Text size="sm">{data.total > 0 ? 'На цій сторінці вже немає записів. Поверніться на першу.' : 'Записів за цими фільтрами немає.'}</Text></div>}
      {data.rows.map(row => <CoachingTaskCard key={row.key} row={row} canAssign={can(PermissionKeys.SalesHeadDashboard.Task.Create)} onAssign={item => { setEditing(item); setAssignee(String(item.manager_id)); setClarification(''); setSaveError(null) }} />)}
      {data.total > 20 && <Pagination total={Math.ceil(data.total / 20)} value={page} onChange={setPage} />}
      {page > 1 && <Button variant="default" onClick={resetPage}>На першу сторінку</Button>}
    </>}
    <AppModal opened={Boolean(editing)} onClose={() => { if (!saving) setEditing(null) }} title="Передати або уточнити задачу" closeOnClickOutside={!saving} closeOnEscape={!saving}>
      <Stack gap={8}><Text size="xs" c="dimmed">Передається лише задача. Клієнт залишається за основним менеджером; авторство минулих продажів зберігається.</Text>
        <Select label="Виконавець" data={availableManagers.map(m => ({ value: String(m.id), label: m.name }))} value={assignee} onChange={setAssignee} searchable disabled={saving} />
        <Textarea label="Уточнення / причина" value={clarification} onChange={event => setClarification(event.currentTarget.value)} maxLength={2000} required disabled={saving} />
        {saveError && <Alert color="red">{saveError}</Alert>}
        <AppModalFooter><Button variant="default" disabled={saving} onClick={() => setEditing(null)}>Скасувати</Button><Button leftSection={<Save size={16} />} onClick={() => void save()} loading={saving} disabled={!assignee || !clarification.trim()}>Зберегти призначення</Button></AppModalFooter>
      </Stack>
    </AppModal>
  </Stack></Card>
}

function CoachingTaskCard({ row, canAssign, onAssign }: { row: CoachingRow; canAssign: boolean; onAssign: (row: CoachingRow) => void }) {
  return <Card className="cockpit-workday-client" withBorder padding="xs">
        <Group justify="space-between" align="start"><Stack gap={2} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <Text fw={600} size="sm">{row.client_name || row.title}</Text><Text size="sm">{row.title}</Text>
          <Text size="xs">{row.manager_name} · {statuses.find(s => s.value === row.status)?.label ?? 'Контакт'} · Строк: {date(row.due_at)}</Text>
          {row.task_key && <Text size="xs" c="dimmed">{row.task_type === 'manual' ? 'Ручна задача' : 'AI-рекомендація'} · {row.task_key}</Text>}
          {!row.task_key && <Text size="xs" c="dimmed">Останній контакт: {date(row.contact_at)}</Text>}
          {row.assignment_history.map(entry => <Text size="xs" c="dimmed" key={entry.id ?? `${entry.at}-${entry.from}-${entry.to}-${entry.source}`}>{date(entry.at)} · #{entry.from} → #{entry.to} · {entry.clarification || entry.source}</Text>)}
        </Stack>{row.task_key && row.updated_at && canAssign && <Button size="xs" variant="default" leftSection={<UserRoundPen size={14} />} onClick={() => onAssign(row)}>Передати / уточнити</Button>}</Group>
      </Card>
}
