import { Accordion, Alert, Badge, Button, Group, Loader, MultiSelect, SegmentedControl, Select, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PageSubmenuActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import { getReportHistory, getReportHistoryUsers, type ReportHistoryItem, type ReportHistoryUser } from '../api/reportHistoryApi'
import { availableBug1274WorkbookLaunches, type WorkbookLaunch } from '../data/bug1274WorkbookLaunch'
import { BUG_1274_ACTIVE_DATA_SOURCES } from '../data/reportMigration'
import {
  defaultHistoryPeriod, distinctLabels, historyDayTitle, historyPeriodPresets, historyReportKeyName, historyReportOptions, historySummary, historyTime,
  movementHistorySummary, rememberHistoryRun, rememberWorkbookOpen, type ReportHistoryAction,
} from '../data/reportHistory'
import { useReportDatasets } from '../hooks/useReportDatasets'
import type { ReportDataset } from '../types'
import { ReportsNavigation } from './workbook-desk/ReportsNavigation'
import { WorkbookPeriodField } from './workbook-desk/WorkbookSettings'

const DAY_PAGE = 50
type DayState = { items: ReportHistoryItem[]; loading: boolean; error: string | null; done: boolean }
type Grouping = 'day' | 'report'
type HistoryGroup = { key: string; title: string; count: number; from: string; to: string; reports: string[] }

const KYIV_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' })
const kyivDay = (value: string) => KYIV_DAY.format(new Date(value))

export function ReportHistoryPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const allowed = hasPermission(PermissionKeys.ReportsStocks.Report.Generate)
  const today = useMemo(() => formatKyivBusinessDate(), [])
  const initial = useMemo(() => defaultHistoryPeriod(today), [today])
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [reports, setReports] = useState<string[]>([])
  const [user, setUser] = useState<string | null>(null)
  const [grouping, setGrouping] = useState<Grouping>('day')
  const [days, setDays] = useState<{ day: string; count: number }[] | null>(null)
  const [reportCounts, setReportCounts] = useState<{ report: string; count: number }[]>([])
  const [isHead, setIsHead] = useState(false)
  const [users, setUsers] = useState<ReportHistoryUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [opened, setOpened] = useState<string[]>([])
  const [dayStates, setDayStates] = useState<Record<string, DayState>>({})
  const generation = useRef(0)
  const datasetStorage = useReportDatasets(allowed)
  const datasets = datasetStorage.datasets
  const launches = useMemo(() => availableBug1274WorkbookLaunches(datasets), [datasets])
  const periodError = !from || !to || from > to ? t('Вкажіть правильний період.') : null
  const sources = reports

  const reportOptions = useMemo(() => historyReportOptions(datasets, launches, BUG_1274_ACTIVE_DATA_SOURCES)
    .map(item => ({ ...item, label: t(item.label) })), [datasets, launches, t])
  const groups: HistoryGroup[] = useMemo(() => grouping === 'day'
    ? (days ?? []).map(day => ({ key: day.day, title: historyDayTitle(day.day), count: day.count, from: day.day, to: day.day, reports: sources }))
    : reportCounts.map(item => ({ key: item.report, title: t(historyReportKeyName(item.report, datasets, launches)), count: item.count,
      from, to, reports: [item.report] })), [grouping, days, reportCounts, sources, from, to, datasets, launches, t])
  const userLabels = useMemo(() => distinctLabels(users, item => item.userName || t('Без імені'), item => item.userNetId), [users, t])

  useEffect(() => {
    if (!allowed || periodError) return
    const current = ++generation.current
    const controller = new AbortController()
    setDays(null); setError(null); setDayStates({}); setOpened([])
    getReportHistory({ from, to, reports: sources, user, limit: 1 }, controller.signal).then(page => {
      if (current !== generation.current) return
      setDays(page.days); setIsHead(page.isHead)
      setReportCounts(page.reports.map(item => ({ report: item.report, count: item.count })))
      const first = grouping === 'day' ? page.days[0]?.day : page.reports[0]?.report
      if (first) setOpened([first])
    }).catch(failure => {
      if (current === generation.current && !controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : t('Історія звітів тимчасово недоступна. Спробуйте ще раз.'))
    })
    return () => controller.abort()
  }, [allowed, from, to, sources, user, periodError, grouping, t])

  useEffect(() => {
    if (!allowed || !isHead || periodError) { setUsers([]); return }
    const controller = new AbortController()
    getReportHistoryUsers(from, to, controller.signal).then(setUsers).catch(() => { if (!controller.signal.aborted) setUsers([]) })
    return () => controller.abort()
  }, [allowed, isHead, from, to, periodError])

  const loadDay = useCallback(async (group: HistoryGroup, offset: number) => {
    const current = generation.current
    const day = group.key
    setDayStates(state => ({ ...state, [day]: { ...(state[day] ?? { items: [], done: false }), loading: true, error: null } }))
    try {
      const page = await getReportHistory({ from: group.from, to: group.to, reports: group.reports, user, offset, limit: DAY_PAGE })
      if (current !== generation.current) return
      setDayStates(state => {
        const items = [...(offset ? state[day]?.items ?? [] : []), ...page.items]
        return { ...state, [day]: { items, loading: false, error: null, done: page.items.length < DAY_PAGE || items.length >= page.total } }
      })
    } catch (failure) {
      if (current !== generation.current) return
      setDayStates(state => ({ ...state, [day]: { ...(state[day] ?? { items: [], done: false }), loading: false,
        error: failure instanceof Error ? failure.message : t('Історія звітів тимчасово недоступна. Спробуйте ще раз.') } }))
    }
  }, [user, t])

  useEffect(() => {
    for (const key of opened) {
      const group = groups.find(item => item.key === key)
      if (group && !dayStates[key]) void loadDay(group, 0)
    }
  }, [opened, dayStates, loadDay, groups])

  function run(item: ReportHistoryItem, action: ReportHistoryAction) {
    rememberHistoryRun(item.id, action, sessionStorage, Date.now(), item.report)
    navigate('/reports/stocks')
  }

  function openWorkbook(launch: WorkbookLaunch) {
    rememberWorkbookOpen(launch.fileName)
    navigate('/reports/stocks')
  }

  const datasetOf = (source: number): ReportDataset | undefined => datasets.find(item => item.DataSource === source)

  function entry(item: ReportHistoryItem) {
    const dataset = datasetOf(item.dataSource)
    const name = t(historyReportKeyName(item.report, datasets, launches))
    const summary = item.movement ? movementHistorySummary(item.movement, item.names) : item.data ? historySummary(item.data, item.kind === 'regional' ? datasetOf(39) : dataset) : null
    const usable = item.kind === 'movement' ? Boolean(item.movement)
      : Boolean(item.data && datasetOf(item.data.dataSource ?? -1) && BUG_1274_ACTIVE_DATA_SOURCES.has(item.data.dataSource ?? -1))
    return <Group key={item.id} justify="space-between" align="flex-start" wrap="nowrap" className="report-history__entry"
      data-testid="report-history-entry">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={600}>{grouping === 'report' ? `${historyDayTitle(kyivDay(item.formedAtUtc))}, ` : ''}{historyTime(item.formedAtUtc)}</Text>
          <Text size="sm" fw={600}>{name}</Text>
          <Badge variant="light" color={item.output === 'excel' ? 'green' : 'gray'}>{item.output === 'excel' ? 'Excel' : t('На екрані')}</Badge>
        </Group>
        {summary ? <Text size="sm">{t('Період')}: {summary.period}</Text> : null}
        {summary?.filters ? <Text size="sm" c="dimmed" lineClamp={2} title={summary.filters}>{summary.filters}</Text> : null}
        <Text size="xs" c="dimmed">{t('Рядків')}: {item.rowCount.toLocaleString('uk-UA')}
          {isHead ? ` · ${userLabels.get(item.userNetId) ?? (item.userName || t('Без імені'))}` : ''}</Text>
        {!usable ? <Text size="xs" c="dimmed">{t('Цей звіт більше не можна відкрити.')}</Text> : null}
      </Stack>
      <Group gap="xs" wrap="nowrap">
        <Button size="xs" variant="default" disabled={!usable} onClick={() => run(item, 'open')}>{t('Відкрити')}</Button>
        <Button size="xs" variant="default" disabled={!usable} onClick={() => run(item, 'excel')}>Excel</Button>
      </Group>
    </Group>
  }

  return <Stack className="reports-history-page" gap="sm">
    <PageSubmenuActions>
      <ReportsNavigation launches={launches} active={null} movement={false} historyActive
        disabled={!datasetStorage.loaded} onOpen={openWorkbook} onStocks={() => navigate('/reports/stocks')} />
    </PageSubmenuActions>
    {!allowed ? <Alert color="yellow" icon={<CircleAlert size={18} />} title={t('Немає доступу до звітів')}>
      {t('Ваша роль не дозволяє формувати звіти. Зверніться до адміністратора.')}
    </Alert> : <>
      <Group align="flex-end" gap="md" wrap="wrap">
        <WorkbookPeriodField from={from} to={to} minDate="2020-01-01" maxDate={today} presets={historyPeriodPresets(today)}
          error={periodError} onFromChange={setFrom} onToChange={setTo} />
        <MultiSelect label={t('Звіт')} placeholder={reports.length ? undefined : t('Усі звіти')} data={reportOptions}
          value={reports} onChange={setReports} clearable searchable style={{ minWidth: 260 }} />
        <Stack gap={4}>
          <Text size="sm" fw={500}>{t('Групувати')}</Text>
          <SegmentedControl size="xs" value={grouping} onChange={value => setGrouping(value as Grouping)}
            data={[{ value: 'day', label: t('за днями') }, { value: 'report', label: t('за звітами') }]} />
        </Stack>
        {isHead ? <Select label={t('Користувач')} placeholder={t('Усі')} clearable searchable value={user} onChange={setUser}
          data={users.map(item => ({ value: item.userNetId, label: userLabels.get(item.userNetId)! }))} style={{ minWidth: 220 }} /> : null}
      </Group>
      {error ? <Alert color="red" icon={<CircleAlert size={18} />}>{error}</Alert>
        : days === null ? periodError ? null : <Group role="status" gap="xs"><Loader size="sm" /><Text size="sm">{t('Завантаження…')}</Text></Group>
        : days.length === 0 ? <Text size="sm" c="dimmed">{t('За вибраний період звітів не формували.')}</Text>
        : <Accordion multiple value={opened} onChange={setOpened} variant="separated">
          {groups.map(group => {
            const state = dayStates[group.key]
            return <Accordion.Item key={group.key} value={group.key}>
              <Accordion.Control>
                <Group gap="xs"><Text fw={600}>{group.title}</Text><Badge variant="light">{group.count}</Badge></Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  {state?.items.map(entry)}
                  {state?.error ? <Alert color="red" icon={<CircleAlert size={18} />}>{state.error}</Alert> : null}
                  {state?.loading ? <Group role="status" gap="xs"><Loader size="sm" /><Text size="sm">{t('Завантаження…')}</Text></Group> : null}
                  {state && !state.loading && !state.done ? <Button size="xs" variant="subtle"
                    onClick={() => void loadDay(group, state.items.length)}>{t('Показати ще')}</Button> : null}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          })}
        </Accordion>}
    </>}
  </Stack>
}
