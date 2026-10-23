import { departmentPaceColor } from '../metricPresentation'
import { CockpitSourceStatus } from '../components/CockpitSourceStatus'
import {
  Alert,
  Button,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { CircleAlert, Info, Map, RefreshCw, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../shared/api/apiClient'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useValueState } from '../../../shared/hooks/useValueState'
import { AiHistoryLineageNote } from '../../../shared/ai/AiHistoryLineageNote'
import { hasAiHistoryLineage } from '../../../shared/ai/aiHistoryLineage'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PagePermissionBoundary } from '../../auth/components/PagePermissionBoundary'
import { getEscalated, getHeadTeam } from '../api/salesCockpitApi'
import { HeadAiFleetStatus } from '../components/HeadAiFleetStatus'
import { DocumentaryResultsPanel } from '../components/DocumentaryResultsPanel'
import { HeadDashboardChartsPanel } from '../components/HeadDashboardChartsPanel'
import { HeadCoachingPanel } from '../components/HeadCoachingPanel'
import { HeadTaskBoard } from '../components/HeadTaskBoard'
import { useCockpitRealtimeReload } from '../hooks/useCockpitRealtimeReload'
import type { CockpitUrgency, EscalatedResponse, EscalatedTask, HeadTeam, HeadTeamRow } from '../types'
import './sales-cockpit-page.css'
import './head-dashboard-page.css'

const POLL_INTERVAL_MS = 60_000

const URGENCY_TONE: Record<CockpitUrgency, TableChipTone> = {
  critical: 'danger', high: 'warning', normal: 'document', low: 'neutral',
}

const URGENCY_LABEL: Record<CockpitUrgency, string> = {
  critical: 'Критично',
  high: 'Високий',
  normal: 'Звичайний',
  low: 'Низький',
}

const PROGRESS_TONE: Record<string, TableChipTone> = {
  gray: 'neutral', green: 'success', orange: 'warning', red: 'danger',
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const EMPTY_TEAM: HeadTeam = {
  is_head: false,
  as_of: null,
  expected_manager_count: 0,
  returned_manager_count: 0,
  team: [],
  totals: {
    shipped_target: 0,
    shipped_mtd: 0,
    paid_target: 0,
    paid_mtd: 0,
    generated_month: 0,
    done_month: 0,
    sold_month: 0,
    dismissed_month: 0,
    revenue_month: 0,
    close_rate: 0,
    conversion_rate: 0,
  },
}

const EMPTY_ESCALATED: EscalatedResponse = {
  is_head: false,
  requested_limit: 100,
  count: 0,
  tasks: [],
}

export function HeadDashboardPage() {
  return (
    <PagePermissionBoundary permissionKey={PermissionKeys.SystemPages.SalesHeadDashboard.View}>
      <HeadDashboardPageContent />
    </PagePermissionBoundary>
  )
}

function HeadDashboardPageContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [team, setTeam] = useValueState<HeadTeam>(EMPTY_TEAM)
  const [escalated, setEscalated] = useValueState<EscalatedResponse>(EMPTY_ESCALATED)
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [isLoading, setLoading] = useState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const triggerReload = useCallback(() => {
    setLoading(true)
    reload()
  }, [])
  useCockpitRealtimeReload(triggerReload)

  useEffect(() => {
    let active = true

    async function loadTeam() {
      try {
        const [result, escalatedResult] = await Promise.all([getHeadTeam(), getEscalated()])

        if (active) {
          setTeam(result)
          setEscalated(escalatedResult)
          setForbidden(result.is_head === false)
          setError(null)
        }
      } catch (loadError) {
        if (!active) return
        setTeam(EMPTY_TEAM)
        setEscalated(EMPTY_ESCALATED)

        if (loadError instanceof ApiError && loadError.status === 403) {
          setForbidden(true)
          setError(null)
        } else {
          setForbidden(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дашборд'))
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadTeam()
    const interval = window.setInterval(() => void loadTeam(), POLL_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [reloadKey, setError, setEscalated, setTeam, t])

  const rows = useMemo(
    () => team.team.toSorted((left, right) => right.tasks.active - left.tasks.active || left.manager_id - right.manager_id),
    [team.team],
  )

  return (
    <Stack className="cockpit-page cockpit-head-page" gap={6}>
      <CockpitSourceStatus head />
      <Card className="app-filter-card cockpit-toolbar-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar cockpit-command-bar cockpit-head-command-bar">
          <Stack className="cockpit-head-title" gap={3}>
            <Group gap={6} wrap="nowrap">
              <Text className="app-section-title" component="h1" fw={600} size="sm">{t('Дашборд відділу продажів')}</Text>
            </Group>
          </Stack>

          <Group className="app-filter-actions cockpit-command-actions" gap={10} justify="flex-end">
            <TableChip tone={error ? 'warning' : 'neutral'} value={t(error ? 'Не вдалося оновити' : isLoading ? 'Оновлення…' : team.as_of ? 'Оновлюється щохвилини' : 'Немає даних')} />
            <Button color="brand" variant="filled" size="sm"
              className="cockpit-toolbar-button app-filter-primary-action"
              leftSection={<Map size={16} />}
              onClick={() => navigate('/sales/geography')}
            >
              {t('Карта продажів і боргу')}
            </Button>
            <Button leftSection={<RefreshCw size={16} />} loading={isLoading} variant="default" onClick={triggerReload}>{t('Оновити')}</Button>
          </Group>
        </div>
      </Card>

      <div className="cockpit-page-content">
        {forbidden ? (
          <Card className="app-section-card" withBorder radius="md" padding="xl">
            <Text c="dimmed" fw={600} ta="center">{t('Доступ лише для керівника відділу')}</Text>
          </Card>
        ) : (
          <>
            {error ? (
              <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>
            ) : null}

            {team.as_of && <Card className="app-section-card cockpit-head-summary" withBorder radius="md" padding={0}>
              <Stack gap={0}>
                <div className="cockpit-head-section-heading">
                  <div>
                    <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Результат відділу')}</Text>
                  </div>
                  {hasAiHistoryLineage(team) && <AiHistoryLineageNote lineage={team} />}
                </div>

                <div className="cockpit-head-kpis">
                  <DepartmentMetric
                    accent="brand"
                    label={t('Накладні за місяць, брутто')}
                    target={team.totals.shipped_target}
                    expected={team.team.reduce((sum, row) => sum + row.target.shipped.expected_to_date, 0)}
                    value={team.totals.shipped_mtd}
                  />
                  <DepartmentMetric
                    accent="info"
                    label={t('Документи оплат за місяць')}
                    target={team.totals.paid_target}
                    expected={team.team.reduce((sum, row) => sum + row.target.paid.expected_to_date, 0)}
                    value={team.totals.paid_mtd}
                  />
                  <OutcomeMetric
                    label={t('Результат задач за місяць')}
                    primary={`${team.totals.done_month} ${t('виконано')}`}
                    secondary={`${team.totals.sold_month} ${t('позначено продажем')} · ${formatRate(team.totals.conversion_rate)} ${t('за відмітками менеджерів')}`}
                  />
                  <OutcomeMetric
                    accent="success"
                    label={t('Сума продажів зі слів менеджерів')}
                    primary={formatMoney(team.totals.revenue_month)}
                    secondary={t('Ручні результати задач; без звірки з документами продажу')}
                  />
                </div>
              </Stack>
            </Card>}

            <div className="cockpit-head-workspace">
              <Stack className="cockpit-head-sidebar" gap={8}>
                {team.as_of && <TeamMonitor
                  isLoading={isLoading}
                  rows={rows}
                  selectedManagerId={selectedManagerId}
                  onSelect={setSelectedManagerId}
                />}
                {team.as_of && <EscalationsPanel escalated={escalated} />}
                <HeadAiFleetStatus />
              </Stack>

              <Stack className="cockpit-head-main" gap={8}>
                <HeadCoachingPanel managerId={selectedManagerId} onManagerChange={setSelectedManagerId} managers={rows.map(row => ({ id: row.manager_id, name: managerName(row) }))} onChanged={triggerReload} />
                <HeadTaskBoard
                  managerId={selectedManagerId}
                  onManagerChange={setSelectedManagerId}
                />
                <HeadDashboardChartsPanel reloadKey={reloadKey} rows={rows} />
                <DocumentaryResultsPanel head revision={reloadKey} />
              </Stack>
            </div>

          </>
        )}
      </div>
    </Stack>
  )
}

function DepartmentMetric({
  accent,
  label,
  target,
  expected,
  value,
}: {
  accent: 'brand' | 'info'
  label: string
  target: number
  expected: number
  value: number
}) {
  const { t } = useI18n()
  const percent = target > 0 ? Math.round((value / target) * 100) : 0
  const progressColor = departmentPaceColor(target, value, expected)

  return (
    <div className={`cockpit-head-kpi is-${accent}`}>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <span className="cockpit-head-kpi__label">{label}</span>
        <TableChip tone={PROGRESS_TONE[progressColor] ?? 'neutral'} title={t('Частка історичного орієнтира')} value={target > 0 ? `${percent}%` : t('Орієнтир відсутній')} />
      </Group>
      <div className="cockpit-head-kpi__value">{formatMoney(value)}</div>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <span className="cockpit-head-kpi__sub">
          {t('Орієнтир')}: <span className="app-money">{formatMoney(target)}</span>
        </span>
      </Group>
      <Progress color={progressColor} radius="xl" size={4} value={Math.min(percent, 100)} />
    </div>
  )
}

function OutcomeMetric({
  accent = 'brand',
  label,
  primary,
  secondary,
}: {
  accent?: 'brand' | 'success'
  label: string
  primary: string
  secondary: string
}) {
  return (
    <div className={`cockpit-head-kpi is-${accent}`}>
      <span className="cockpit-head-kpi__label">{label}</span>
      <div className="cockpit-head-kpi__value">{primary}</div>
      <span className="cockpit-head-kpi__sub">{secondary}</span>
    </div>
  )
}

function TeamMonitor({
  isLoading,
  onSelect,
  rows,
  selectedManagerId,
}: {
  isLoading: boolean
  onSelect: (managerId: number | null) => void
  rows: HeadTeamRow[]
  selectedManagerId: number | null
}) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card cockpit-team-monitor" withBorder radius="md" padding={0}>
      <Group className="cockpit-side-header" gap="xs" justify="space-between">
        <div>
          <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Команда')}</Text>

        </div>
        {selectedManagerId !== null ? (
          <Button leftSection={<RotateCcw size={13} />} size="compact-xs" variant="default" onClick={() => onSelect(null)}>{t('Усі')}</Button>
        ) : null}
      </Group>

      <details className="cockpit-head-data-note">
        <summary><Info size={13} />{t('Про дані')}</summary>
        <Text size="xs" c="dimmed">{t('Історичний орієнтир за поточною клієнтською базою менеджера; передача клієнта змінює цей зріз. Це не персональна історична виручка і не затверджений план. Темп розподілено за умовним календарем Пн–Сб; свята не враховано. Повнота імпорту не підтверджена.')}</Text>
      </details>

      {isLoading && rows.length === 0 ? (
        <div className="cockpit-side-empty">{t('Завантаження')}</div>
      ) : rows.length === 0 ? (
        <div className="cockpit-side-empty">{t('Менеджерів немає')}</div>
      ) : (
        <div className="cockpit-manager-list">
          {rows.map((row) => {
            const selected = selectedManagerId === row.manager_id
            return (
              <UnstyledButton
                key={row.manager_id}
                title={t('Показати задачі менеджера')}
                aria-pressed={selected}
                className={`cockpit-manager-row${selected ? ' is-selected' : ''}`}
                onClick={() => onSelect(selected ? null : row.manager_id)}
              >
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text className="cockpit-manager-row__name">{managerName(row)}</Text>
                  <TableChip value={`${row.tasks.active} ${t('активних')}`} />
                </Group>
                <div className="cockpit-manager-row__metrics">
                  <span>{t('Накладні, брутто')} <strong className={paceClass(row.target.shipped.pace_status)}>{row.target.shipped.pace_status === 'no_target' ? t('Немає орієнтира') : formatPercent(row.target.shipped.attainment_pct)}</strong></span>
                  <span>{t('Документи оплат')} <strong className={paceClass(row.target.paid.pace_status)}>{row.target.paid.pace_status === 'no_target' ? t('Немає орієнтира') : formatPercent(row.target.paid.attainment_pct)}</strong></span>
                  <span>{t('Продано')} <strong>{row.tasks.sold_month}</strong></span>
                </div>
              </UnstyledButton>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function EscalationsPanel({ escalated }: { escalated: EscalatedResponse }) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card" withBorder radius="md" padding={0}>
      <Group className="cockpit-side-header" gap="xs" justify="space-between">
        <div>
          <Text className="app-section-title" component="h2" fw={600} size="sm">{t('Потребують уваги')}</Text>

        </div>
        <TableChip tone={escalated.count > 0 ? 'danger' : 'neutral'} value={escalated.count} />
      </Group>

      {escalated.tasks.length === 0 ? (
        <div className="cockpit-side-empty">{t('Ескалацій немає')}</div>
      ) : (
        <div className="cockpit-escalated-list">
          {escalated.tasks.slice(0, 6).map((task) => <EscalatedRow key={task.task_key} task={task} />)}
        </div>
      )}
    </Card>
  )
}

function EscalatedRow({ task }: { task: EscalatedTask }) {
  const { t } = useI18n()

  return (
    <div className="cockpit-escalated-row">
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text className="cockpit-escalated-title">{task.title || t('Завдання')}</Text>
        <TableChip tone={URGENCY_TONE[task.urgency ?? 'normal']} value={urgencyLabel(task.urgency, t)} />
      </Group>
      <Text className="cockpit-escalated-client">{task.client_name || t('Клієнт не вказаний')}</Text>
    </div>
  )
}

function managerName(row: HeadTeamRow): string {
  return row.manager_name?.trim() || `#${row.manager_id}`
}

function urgencyLabel(urgency: CockpitUrgency | undefined, t: (key: string) => string): string {
  return t(urgency ? URGENCY_LABEL[urgency] : URGENCY_LABEL.normal)
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`
}

function paceClass(status: string): string {
  return status === 'ahead' ? 'is-good' : status === 'behind' ? 'is-low' : ''
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
