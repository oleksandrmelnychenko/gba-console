import { Alert, Box, Group, Loader, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core'
import { Bot, CircleAlert, LayoutDashboard } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AiFeatureBadge } from '../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../shared/i18n/useI18n'
import { RoleDashboardWorkspace } from '../../features/role-dashboards/components/RoleDashboardWorkspace'
import { getDashboardWorkspaceCatalog } from '../../features/role-dashboards/api/dashboardWorkspacesApi'
import type { DashboardWorkspaceCatalog } from '../../features/role-dashboards/types'
import {
  groupDashboardWorkspaceOptions,
  resolveDashboardWorkspace,
} from '../../features/role-dashboards/utils/dashboardWorkspaceSelection'
import '../../features/role-dashboards/role-dashboards.css'

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom'

const LAST_GBA_WORKSPACE_KEY = 'gba_console_last_dashboard_workspace'

export function DashboardPage() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [catalog, setCatalog] = useState<DashboardWorkspaceCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(() => firstDayOfCurrentMonth())
  const [to, setTo] = useState(() => localDateValue(new Date()))
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month')
  const today = useMemo(() => localDateValue(new Date()), [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadCatalog() {
      setError(null)

      try {
        const loaded = await getDashboardWorkspaceCatalog(controller.signal)

        if (!controller.signal.aborted) {
          setCatalog(loaded)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дашборд'))
        }
      }
    }

    void loadCatalog()
    return () => controller.abort()
  }, [t])

  const selectedWorkspace = catalog
    ? resolveDashboardWorkspace(catalog, searchParams.get('view') ?? readLastWorkspace())
    : null
  const selectedDescriptor = catalog?.workspaces.find((workspace) => workspace.key === selectedWorkspace)
  const showsSharedPeriod = selectedWorkspace ? !['sales-manager', 'sales-head', 'buyer', 'buyer-head'].includes(selectedWorkspace) : false
  const period = useMemo(() => ({ from, toExclusive: addDays(to, 1) }), [from, to])
  const selectOptions = useMemo(
    () => catalog ? groupDashboardWorkspaceOptions(catalog, t) : [],
    [catalog, t],
  )

  function selectWorkspace(value: string | null) {
    if (!catalog?.canSwitchWorkspace || !value || !catalog.workspaces.some((workspace) => workspace.key === value)) {
      return
    }

    localStorage.setItem(LAST_GBA_WORKSPACE_KEY, value)

    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('view', value)
      return next
    }, { replace: true })
  }

  function applyPeriodPreset(value: string) {
    const preset = value as Exclude<PeriodPreset, 'custom'>
    const nextTo = new Date()
    let nextFrom = new Date(nextTo.getFullYear(), nextTo.getMonth(), nextTo.getDate())

    if (preset === '7d') {
      nextFrom.setDate(nextFrom.getDate() - 6)
    } else if (preset === '30d') {
      nextFrom.setDate(nextFrom.getDate() - 29)
    } else if (preset === 'month') {
      nextFrom = new Date(nextTo.getFullYear(), nextTo.getMonth(), 1)
    }

    setFrom(localDateValue(nextFrom))
    setTo(localDateValue(nextTo))
    setPeriodPreset(preset)
  }

  if (error) {
    return (
      <Alert color="red" icon={<CircleAlert size={17} />} title={t('Дашборд недоступний')} variant="light">
        {error}
      </Alert>
    )
  }

  if (!catalog) {
    return <Group justify="center" py="xl"><Loader size="sm" /></Group>
  }

  if (!selectedWorkspace || !selectedDescriptor || catalog.workspaces.length === 0) {
    return (
      <Alert color="gray" icon={<LayoutDashboard size={17} />} title={t('Дашборд не налаштовано')} variant="light">
        {t('Для цієї ролі немає доступного робочого дашборда')}
      </Alert>
    )
  }

  return (
    <Stack className="role-dashboard-page" gap="sm">
      <Group className="role-dashboard-toolbar" justify="space-between" wrap="wrap">
        <Group className="role-dashboard-title" gap="xs" wrap="nowrap">
          {selectedDescriptor.isAi ? <Bot size={20} /> : <LayoutDashboard size={20} />}
          <Box>
            <Group gap={6} wrap="nowrap">
              <Text fw={750}>{t(selectedDescriptor.name)}</Text>
              {selectedDescriptor.isAi && <AiFeatureBadge compact tooltip={t('AI-функція')} />}
            </Group>
            <Text c="dimmed" size="xs">{t(selectedDescriptor.group)}</Text>
          </Box>
        </Group>

        {catalog.canSwitchWorkspace && (
          <Select
            aria-label={t('Вибрати дашборд')}
            className="role-dashboard-selector"
            data={selectOptions}
            searchable
            value={selectedWorkspace}
            onChange={selectWorkspace}
          />
        )}

        {showsSharedPeriod && (
          <Group className="role-dashboard-period" gap={6} wrap="wrap">
            <SegmentedControl
              aria-label={t('Період')}
              data={[
                { label: t('Сьогодні'), value: 'today' },
                { label: t('7 днів'), value: '7d' },
                { label: t('30 днів'), value: '30d' },
                { label: t('Місяць'), value: 'month' },
              ]}
              size="xs"
              value={periodPreset}
              onChange={applyPeriodPreset}
            />
            <TextInput
              aria-label={t('Від')}
              max={to}
              required
              type="date"
              value={from}
              onChange={(event) => {
                if (event.currentTarget.value) {
                  setFrom(event.currentTarget.value)
                  setPeriodPreset('custom')
                }
              }}
            />
            <TextInput
              aria-label={t('До')}
              max={today}
              min={from}
              required
              type="date"
              value={to}
              onChange={(event) => {
                if (event.currentTarget.value) {
                  setTo(event.currentTarget.value)
                  setPeriodPreset('custom')
                }
              }}
            />
          </Group>
        )}
      </Group>

      <Box className="role-dashboard-content">
        <RoleDashboardWorkspace period={period} workspaceKey={selectedWorkspace} />
      </Box>
    </Stack>
  )
}

function readLastWorkspace(): string | null {
  try {
    return localStorage.getItem(LAST_GBA_WORKSPACE_KEY)
  } catch {
    return null
  }
}

function firstDayOfCurrentMonth(): string {
  const today = new Date()
  return localDateValue(new Date(today.getFullYear(), today.getMonth(), 1))
}

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  return localDateValue(new Date(year, month - 1, day + days))
}

function localDateValue(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
