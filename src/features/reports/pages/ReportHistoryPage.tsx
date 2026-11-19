import { ActionIcon, Alert, Button, Group, SegmentedControl, Select, Stack } from '@mantine/core'
import type { DatePickerPreset } from '@mantine/dates'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { formatKyivBusinessDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { PageSubmenuActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import { useAuth } from '../../auth/useAuth'
import { getReportHistory, getReportHistoryUsers, type ReportHistoryItem, type ReportHistoryUser } from '../api/reportHistoryApi'
import { availableBug1274WorkbookLaunches, type WorkbookLaunch } from '../data/bug1274WorkbookLaunch'
import { BUG_1274_ACTIVE_DATA_SOURCES } from '../data/reportMigration'
import {
  defaultHistoryPeriod, distinctLabels, historyDayTitle, historyPeriodPresets, historyReportKeyName, historyReportOptions,
  rememberHistoryRun, rememberWorkbookOpen, type ReportHistoryAction,
} from '../data/reportHistory'
import { useReportDatasets } from '../hooks/useReportDatasets'
import { ReportHistoryTable, type HistoryGroup, type HistoryGrouping, type HistoryGroupState } from './ReportHistoryTable'
import { ReportsNavigation } from './workbook-desk/ReportsNavigation'
import '../../../shared/ui/console-table-page.css'
import './report-history-page.css'

const DAY_PAGE = 50

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
  const [grouping, setGrouping] = useState<HistoryGrouping>('day')
  const [days, setDays] = useState<{ day: string; count: number }[] | null>(null)
  const [reportCounts, setReportCounts] = useState<{ report: string; count: number }[]>([])
  const [isHead, setIsHead] = useState(false)
  const [users, setUsers] = useState<ReportHistoryUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [opened, setOpened] = useState<string[]>([])
  const [dayStates, setDayStates] = useState<Record<string, HistoryGroupState>>({})
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

  const run = useCallback((item: ReportHistoryItem, action: ReportHistoryAction) => {
    rememberHistoryRun(item.id, action, sessionStorage, Date.now(), item.report)
    navigate('/reports/stocks')
  }, [navigate])

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

  function toggleGroup(key: string) {
    setOpened(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  return <Stack className="console-table-page reports-history-page" gap={8}>
    <PageSubmenuActions>
      <ReportsNavigation launches={launches} active={null} movement={false} historyActive
        disabled={!datasetStorage.loaded} onOpen={openWorkbook} onStocks={() => navigate('/reports/stocks')} />
    </PageSubmenuActions>
    <div className="console-table-shell report-history__shell">
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
            <SegmentedControl size="xs" aria-label={t('Групувати')} value={grouping} onChange={value => setGrouping(value as HistoryGrouping)}
            data={[{ value: 'day', label: t('за днями') }, { value: 'report', label: t('за звітами') }]} />
          </div>
          <ActionIcon size={32} color="gray" variant="light" disabled={!filtered} aria-label={t('Скинути фільтри')} title={t('Скинути фільтри')}
            onClick={resetFilters}><RotateCcw size={16} aria-hidden="true" /></ActionIcon>
        </div>
      </div>
      <div className="console-table-body">
      {periodError ? <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />}>{periodError}</Alert>
        : error ? <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />}>
          <Group gap={8}>{error}<Button size="xs" variant="default" onClick={() => setReload(value => value + 1)}>{t('Спробувати ще раз')}</Button></Group>
        </Alert>
        : <ReportHistoryTable groups={groups} grouping={grouping} opened={opened} groupStates={dayStates} datasets={datasets}
          launches={launches} userLabels={isHead ? userLabels : undefined} loading={days === null}
          onToggleGroup={toggleGroup} onLoadGroup={loadDay} onRun={run} />}
      </div>
    </>}
    </div>
  </Stack>
}
