import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { Banknote, CircleAlert, CircleCheckBig, Map, Radio, RefreshCw, Truck, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../shared/api/apiClient'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getEscalated, getHeadTeam } from '../api/salesCockpitApi'
import { HeadAiFleetStatus } from '../components/HeadAiFleetStatus'
import { HeadDashboardChartsPanel } from '../components/HeadDashboardChartsPanel'
import { HeadTaskBoard } from '../components/HeadTaskBoard'
import { useCockpitRealtimeReload } from '../hooks/useCockpitRealtimeReload'
import type { CockpitUrgency, EscalatedResponse, EscalatedTask, HeadTeam, HeadTeamRow } from '../types'
import './sales-cockpit-page.css'

const POLL_INTERVAL_MS = 60_000

const URGENCY_COLOR: Record<CockpitUrgency, string> = {
  critical: 'red',
  high: 'orange',
  normal: 'blue',
  low: 'gray',
}

const URGENCY_LABEL: Record<CockpitUrgency, string> = {
  critical: 'Критично',
  high: 'Високий',
  normal: 'Звичайний',
  low: 'Низький',
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const EMPTY_TEAM: HeadTeam = {
  is_head: false,
  as_of: null,
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
  count: 0,
  tasks: [],
}

export function HeadDashboardPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [team, setTeam] = useValueState<HeadTeam>(EMPTY_TEAM)
  const [escalated, setEscalated] = useValueState<EscalatedResponse>(EMPTY_ESCALATED)
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [asOfDate, setAsOfDate] = useValueState<string | undefined>(undefined)
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
        const [result, escalatedResult] = await Promise.all([getHeadTeam(asOfDate), getEscalated()])

        if (active) {
          setTeam(result)
          setEscalated(escalatedResult)
          setForbidden(result.is_head === false)
          setError(null)
        }
      } catch (loadError) {
        if (!active) return

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
  }, [asOfDate, reloadKey, setError, setEscalated, setTeam, t])

  const rows = useMemo(
    () => team.team.toSorted((left, right) => priorityScore(right) - priorityScore(left)),
    [team.team],
  )

  const selectedManager = useMemo(
    () => rows.find((row) => row.manager_id === selectedManagerId) ?? null,
    [rows, selectedManagerId],
  )

  const handleAsOfDateChange = useCallback(
    (value: string | undefined) => {
      setAsOfDate(value)
      setLoading(true)
    },
    [setAsOfDate],
  )

  return (
    <Stack className="cockpit-page cockpit-head-page" gap="sm">
      <Card className="app-filter-card cockpit-toolbar-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar cockpit-command-bar cockpit-head-command-bar">
          <Group gap="xs" wrap="nowrap">
            <AiFeatureBadge size="sm" tooltip={t('AI-сервіс керівника продажів')} />
            <Stack gap={0}>
              <Text fw={700} size="sm">{t('Дашборд відділу продажів')}</Text>
              <Text c="dimmed" size="xs">{t('Поточний стан команди та задач')}</Text>
            </Stack>
          </Group>

          <TextInput
            className="cockpit-date-filter"
            label={t('Дата зрізу')}
            type="date"
            value={asOfDate ?? ''}
            w={170}
            onChange={(event) => handleAsOfDateChange(event.currentTarget.value || undefined)}
          />

          <Group className="cockpit-command-actions" gap="xs" justify="flex-end">
            <Badge color={asOfDate ? 'gray' : 'green'} leftSection={<Radio size={12} />} variant="light">
              {asOfDate ? t('Історичний зріз') : t('Наживо')}
            </Badge>
            <Button
              className="cockpit-toolbar-button"
              color="orange"
              leftSection={<Map size={16} />}
              size="sm"
              variant="outline"
              onClick={() => navigate('/sales/geography')}
            >
              {t('Карта продажів і боргу')}
            </Button>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} loading={isLoading} size={34} variant="light" onClick={triggerReload}>
                <RefreshCw size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </div>
      </Card>

      {forbidden ? (
        <Card className="app-section-card" withBorder radius="md" padding="xl">
          <Text c="dimmed" fw={600} ta="center">{t('Доступ лише для керівника відділу')}</Text>
        </Card>
      ) : (
        <>
          {error ? (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>
          ) : null}

          <SimpleGrid className="cockpit-head-kpis" cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <DepartmentMetric
              accent="brand"
              icon={<Truck size={17} />}
              label={t('Відвантажено цього місяця')}
              target={team.totals.shipped_target}
              value={team.totals.shipped_mtd}
            />
            <DepartmentMetric
              accent="info"
              icon={<Banknote size={17} />}
              label={t('Отримано оплат цього місяця')}
              target={team.totals.paid_target}
              value={team.totals.paid_mtd}
            />
            <OutcomeMetric
              icon={<CircleCheckBig size={17} />}
              label={t('Результат AI-задач за місяць')}
              primary={`${team.totals.done_month} ${t('виконано')}`}
              secondary={`${team.totals.sold_month} ${t('з продажем')} · ${formatRate(team.totals.conversion_rate)} ${t('конверсія')}`}
            />
            <OutcomeMetric
              accent="success"
              icon={<Users size={17} />}
              label={t('Виручка з виконаних AI-задач')}
              primary={formatMoney(team.totals.revenue_month)}
              secondary={`${team.totals.generated_month} ${t('задач сформовано за місяць')}`}
            />
          </SimpleGrid>

          <div className="cockpit-head-workspace">
            <HeadTaskBoard
              managerId={selectedManagerId}
              onManagerChange={setSelectedManagerId}
            />

            <Stack className="cockpit-head-sidebar" gap="sm">
              <TeamMonitor
                isLoading={isLoading}
                rows={rows}
                selectedManagerId={selectedManagerId}
                onSelect={setSelectedManagerId}
              />
              <EscalationsPanel escalated={escalated} />
              <HeadAiFleetStatus />
            </Stack>
          </div>

          {selectedManager ? (
            <Alert color="blue" variant="light">
              {t('Черга відфільтрована за менеджером')}: <strong>{managerName(selectedManager)}</strong>
            </Alert>
          ) : null}

          <HeadDashboardChartsPanel asOfDate={asOfDate} reloadKey={reloadKey} rows={rows} />
        </>
      )}
    </Stack>
  )
}

function DepartmentMetric({
  accent,
  icon,
  label,
  target,
  value,
}: {
  accent: 'brand' | 'info'
  icon: React.ReactNode
  label: string
  target: number
  value: number
}) {
  const { t } = useI18n()
  const percent = target > 0 ? Math.round((value / target) * 100) : 0
  const progressColor = target <= 0 ? 'gray' : percent >= 100 ? 'green' : percent >= 80 ? 'orange' : 'red'

  return (
    <div className={`cockpit-head-kpi is-${accent}`}>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Group gap={7} wrap="nowrap">
          <span className="cockpit-head-kpi__icon">{icon}</span>
          <span className="cockpit-head-kpi__label">{label}</span>
        </Group>
        <Badge color={progressColor} size="sm" variant="light">
          {target > 0 ? `${percent}% ${t('плану')}` : t('План не задано')}
        </Badge>
      </Group>
      <div className="cockpit-head-kpi__value">{formatMoney(value)}</div>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <span className="cockpit-head-kpi__sub">{t('План')}: {formatMoney(target)}</span>
        <strong className="cockpit-head-kpi__percent">{target > 0 ? `${percent}%` : '—'}</strong>
      </Group>
      <Progress color={progressColor} radius="xl" size={6} value={Math.min(percent, 100)} />
    </div>
  )
}

function OutcomeMetric({
  accent = 'brand',
  icon,
  label,
  primary,
  secondary,
}: {
  accent?: 'brand' | 'success'
  icon: React.ReactNode
  label: string
  primary: string
  secondary: string
}) {
  return (
    <div className={`cockpit-head-kpi is-${accent}`}>
      <Group gap={7} wrap="nowrap">
        <span className="cockpit-head-kpi__icon">{icon}</span>
        <span className="cockpit-head-kpi__label">{label}</span>
      </Group>
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
          <Text className="app-section-title" fw={700}>{t('Команда')}</Text>
          <Text c="dimmed" size="xs">{t('План, оплати та активні задачі')}</Text>
        </div>
        {selectedManagerId !== null ? (
          <Button size="compact-xs" variant="subtle" onClick={() => onSelect(null)}>{t('Усі')}</Button>
        ) : null}
      </Group>

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
                aria-pressed={selected}
                className={`cockpit-manager-row${selected ? ' is-selected' : ''}`}
                onClick={() => onSelect(selected ? null : row.manager_id)}
              >
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text className="cockpit-manager-row__name">{managerName(row)}</Text>
                  <Badge color={row.tasks.active > 0 ? 'orange' : 'gray'} size="sm" variant="light">
                    {row.tasks.active} {t('активних')}
                  </Badge>
                </Group>
                <div className="cockpit-manager-row__metrics">
                  <span>{t('Відвантаження')} <strong>{formatPercent(row.target.shipped.attainment_pct)}</strong></span>
                  <span>{t('Оплати')} <strong>{formatPercent(row.target.paid.attainment_pct)}</strong></span>
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
          <Text className="app-section-title" fw={700}>{t('Потребують уваги')}</Text>
          <Text c="dimmed" size="xs">{t('Прострочені та ескальовані задачі')}</Text>
        </div>
        <Badge color={escalated.count > 0 ? 'red' : 'gray'} variant="light">{escalated.count}</Badge>
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
        <Badge color={urgencyColor(task.urgency)} size="sm" variant="filled">
          {urgencyLabel(task.urgency, t)}
        </Badge>
      </Group>
      <Text className="cockpit-escalated-client">{task.client_name || t('Клієнт не вказаний')}</Text>
    </div>
  )
}

function priorityScore(row: HeadTeamRow): number {
  return row.tasks.active * 10_000 + Math.max(0, 100 - row.target.shipped.attainment_pct)
}

function managerName(row: HeadTeamRow): string {
  return row.manager_name?.trim() || `#${row.manager_id}`
}

function urgencyColor(urgency?: CockpitUrgency): string {
  return urgency ? URGENCY_COLOR[urgency] : 'blue'
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

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
