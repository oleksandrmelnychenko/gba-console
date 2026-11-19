import { Accordion, ActionIcon, Alert, Button, Group, Loader, SegmentedControl, Select, Stack, Text } from '@mantine/core'
import type { DatePickerPreset } from '@mantine/dates'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { PageSubmenuActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
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
import '../../../shared/ui/console-table-page.css'
import './report-history-page.css'

const DAY_PAGE = 50
type DayState = { items: ReportHistoryItem[]; loading: boolean; error: string | null; done: boolean }
type Grouping = 'day' | 'report'
type HistoryGroup = { key: string; title: string; count: number; from: string; to: string; reports: string[] }

const KYIV_DAY = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' })

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
  const [reload, setReload] = useState(0)
  const [opened, setOpened] = useState<string[]>([])
  const [dayStates, setDayStates] = useState<Record<string, DayState>>({})
  const generation = useRef(0)
  const datasetStorage = useReportDatasets(allowed)
  const datasets = datasetStorage.datasets
  const launches = useMemo(() => availableBug1274WorkbookLaunches(datasets), [datasets])
  const periodError = !from || !to || from > to ? t('Вкажіть правильний період.') : null
  const sources = reports
  const filtered = from !== initial.from || to !== initial.to || reports.length > 0 || user !== null
  const presets = useMemo<DatePickerPreset<'range'>[]>(() => [
    ...historyPeriodPresets(today).map(preset => ({ label: t(preset.label), value: [preset.from, preset.to] as [string, string] })),
    { label: t('30 днів'), value: [initial.from, initial.to] },
  ], [today, initial, t])

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
  }, [allowed, from, to, sources, user, periodError, grouping, reload, t])

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

  function resetFilters() {
    setFrom(initial.from)
    setTo(initial.to)
    setReports([])
    setUser(null)
  }

  const datasetOf = (source: number): ReportDataset | undefined => datasets.find(item => item.DataSource === source)

  function entry(item: ReportHistoryItem) {
    const dataset = datasetOf(item.dataSource)
    const name = t(historyReportKeyName(item.report, datasets, launches))
    const summary = item.movement ? movementHistorySummary(item.movement, item.names) : item.data ? historySummary(item.data, item.kind === 'regional' ? datasetOf(39) : dataset) : null
    const usable = item.kind === 'movement' ? Boolean(item.movement)
      : Boolean(item.data && datasetOf(item.data.dataSource ?? -1) && BUG_1274_ACTIVE_DATA_SOURCES.has(item.data.dataSource ?? -1))
    const detailsId = `history-entry-${item.id}`
    const unavailable = usable ? undefined : t('Цей звіт більше не можна відкрити.')
    return <li key={item.id} className="report-history__entry" data-testid="report-history-entry">
      <div className="report-history__entry-main">
        <div className="report-history__entry-heading" id={detailsId}>
          <time dateTime={item.formedAtUtc} className="report-history__time">
            {grouping === 'report' ? `${KYIV_DAY.format(new Date(item.formedAtUtc))} · ` : ''}{historyTime(item.formedAtUtc)}
          </time>
          {grouping === 'day' ? <span className="report-history__entry-title">{name}</span> : null}
        </div>
        {summary?.filters ? <Text className="report-history__entry-detail" lineClamp={2} title={summary.filters}>{summary.filters}</Text> : null}
        {unavailable ? <Text className="report-history__entry-detail">{unavailable}</Text> : null}
      </div>
      <div className="report-history__entry-period">
        {summary ? <><span>{t('Період звіту')}</span> <span className="report-history__period-value">{summary.period}</span></> : null}
      </div>
      <div className="report-history__entry-meta">
        <span>{item.output === 'excel' ? 'Excel' : t('На екрані')}</span>
        <span>{t('Рядків')}: {item.rowCount.toLocaleString('uk-UA')}
          {isHead ? ` · ${userLabels.get(item.userNetId) ?? (item.userName || t('Без імені'))}` : ''}</span>
      </div>
      <div className="report-history__entry-actions">
        <TableRowAction action="open" label={t('Відкрити')} aria-describedby={detailsId} disabled={!usable} hint={unavailable}
          onClick={() => run(item, 'open')} />
        <TableRowAction action="download" label={t('Завантажити Excel')} aria-describedby={detailsId} disabled={!usable} hint={unavailable}
          onClick={() => run(item, 'excel')} />
      </div>
    </li>
  }

  return <Stack className="console-table-page reports-history-page" gap={8}>
    <PageSubmenuActions>
      <ReportsNavigation launches={launches} active={null} movement={false} historyActive
        disabled={!datasetStorage.loaded} onOpen={openWorkbook} onStocks={() => navigate('/reports/stocks')} />
    </PageSubmenuActions>
    <div className="console-table-shell report-history__shell">
      <h1 className="report-history__title">{t('Історія звітів')}</h1>
      {!allowed ? <Alert className="console-table-alert" color="yellow" icon={<CircleAlert size={18} />} title={t('Немає доступу до звітів')}>
      {t('Ваша роль не дозволяє формувати звіти. Зверніться до адміністратора.')}
    </Alert> : <>
      <div className="app-filter-bar is-labelled">
        <div className="app-filter-fields">
          <div className="app-filter-field report-history__date">
            <span className="mantine-InputWrapper-label">{t('Дата формування')}</span>
            <ToolbarDateRangeFilter from={from} to={to} min="2020-01-01" max={today} required trigger="range" label="Дата формування"
              presets={presets} onChange={range => { setFrom(range.from); setTo(range.to) }} />
          </div>
          <CheckboxMultiSelect className="report-history__report-filter" label={t('Звіт')} placeholder={t('Усі звіти')}
            clearOptionLabel={t('Усі звіти')} data={reportOptions} value={reports} onChange={setReports} />
          {isHead ? <Select className="report-history__user-filter" label={t('Користувач')} placeholder={t('Усі')} clearable searchable
            value={user} onChange={setUser} data={users.map(item => ({ value: item.userNetId, label: userLabels.get(item.userNetId)! }))} /> : null}
          <div className="app-filter-field report-history__grouping">
            <span className="mantine-InputWrapper-label">{t('Групувати')}</span>
            <SegmentedControl size="xs" aria-label={t('Групувати')} value={grouping} onChange={value => setGrouping(value as Grouping)}
            data={[{ value: 'day', label: t('за днями') }, { value: 'report', label: t('за звітами') }]} />
          </div>
          <ActionIcon size={32} color="gray" variant="light" disabled={!filtered} aria-label={t('Скинути фільтри')} title={t('Скинути фільтри')}
            onClick={resetFilters}><RotateCcw size={16} aria-hidden="true" /></ActionIcon>
        </div>
      </div>
      <div className="console-table-body report-history__results" role="region" aria-label={t('Історія звітів')} tabIndex={0}>
      {periodError ? <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />}>{periodError}</Alert>
        : error ? <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />}>
          <Group gap={8}>{error}<Button size="xs" variant="default" onClick={() => setReload(value => value + 1)}>{t('Спробувати ще раз')}</Button></Group>
        </Alert>
        : days === null ? <Group className="report-history__state" role="status" gap={8}><Loader size="sm" /><Text size="sm">{t('Завантаження…')}</Text></Group>
        : groups.length === 0 ? <Text className="report-history__state" size="sm" c="dimmed">{t('За вибраний період звітів не формували.')}</Text>
        : <Accordion className="report-history__groups" multiple value={opened} onChange={setOpened} variant="unstyled" order={2} chevronPosition="left">
          {groups.map(group => {
            const state = dayStates[group.key]
            return <Accordion.Item key={group.key} value={group.key}>
              <Accordion.Control className="report-history__group-control">
                <span className="report-history__group-title">{group.title}</span>
                <span className="report-history__group-count" title={t('Записів')}>{group.count.toLocaleString('uk-UA')}</span>
              </Accordion.Control>
              <Accordion.Panel>
                {state?.items.length ? <ul className="report-history__entries">{state.items.map(entry)}</ul> : null}
                {state?.error ? <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />}>
                  <Group gap={8}>{state.error}
                    <Button size="xs" variant="default" onClick={() => void loadDay(group, state.items.length)}>{t('Спробувати ще раз')}</Button>
                  </Group>
                </Alert> : null}
                {state?.loading ? <Group className="report-history__state" role="status" gap={8}><Loader size="sm" /><Text size="sm">{t('Завантаження…')}</Text></Group> : null}
                {state && !state.loading && !state.error && !state.done ? <div className="report-history__state">
                  <Button size="xs" variant="default" onClick={() => void loadDay(group, state.items.length)}>{t('Показати ще')}</Button>
                </div> : null}
              </Accordion.Panel>
            </Accordion.Item>
          })}
        </Accordion>}
      </div>
    </>}
    </div>
  </Stack>
}
