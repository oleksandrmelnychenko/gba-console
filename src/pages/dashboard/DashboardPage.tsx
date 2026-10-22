import { Alert, Box, Card, Group, Loader, SegmentedControl, Select, Stack, Text } from '@mantine/core'
import { CircleAlert, LayoutDashboard } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AiFeatureBadge } from '../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../shared/i18n/useI18n'
import { PageHeaderTitle } from '../../shared/ui/page-header-actions/PageHeaderActions'
import { ToolbarDateRangeFilter } from '../../shared/ui/ToolbarDateRangeFilter'
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
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null)
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
  const usesInternalScroll = selectedWorkspace ? ['sales-manager', 'sales-head', 'buyer'].includes(selectedWorkspace) : false
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

  function applyCustomPeriod(range: { from: string; to: string }) {
    if (!range.from || !range.to) {
      return
    }

    setFrom(range.from)
    setTo(range.to)
    setPeriodPreset('custom')
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
    <Stack className={`role-dashboard-page${usesInternalScroll ? ' role-dashboard-page--bounded' : ''}`} gap={6}>
      <PageHeaderTitle>
        <Box className="role-dashboard-title">
          <h1 className="console-subnav-pill console-subnav-item is-active role-dashboard-heading" aria-current="page">
            <span className="role-dashboard-heading-label">{t('Робочий простір')}</span>
            {selectedDescriptor.isAi && <AiFeatureBadge compact tooltip={t('AI-функція')} />}
          </h1>
        </Box>
      </PageHeaderTitle>
      {(catalog.canSwitchWorkspace || showsSharedPeriod) && (
      <Card className="app-filter-card role-dashboard-toolbar-card" withBorder radius="md" padding={0}>
        <Group className="app-filter-bar role-dashboard-toolbar" wrap="nowrap">
          {catalog.canSwitchWorkspace && (
            <Box className="app-filter-field role-dashboard-selector-field">
              <Text className="app-filter-label">{t('Дашборд')}</Text>
              <Select
                aria-label={t('Вибрати дашборд')}
                className="role-dashboard-selector"
                data={selectOptions}
                searchable
                value={selectedWorkspace}
                onChange={selectWorkspace}
              />
            </Box>
          )}

          {showsSharedPeriod && (
            <Group className="role-dashboard-period" gap={8} wrap="nowrap">
              <Box className="app-filter-field role-dashboard-period-presets">
                <Text className="app-filter-label">{t('Період')}</Text>
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
              </Box>
              <ToolbarDateRangeFilter from={from} max={today} to={to} onChange={applyCustomPeriod} />
              <Text className={`role-dashboard-period-range${periodPreset === 'custom' ? ' is-custom' : ''}`} aria-live="polite">
                {formatDisplayDate(from)} — {formatDisplayDate(to)}
              </Text>
            </Group>
          )}
          <div className="role-dashboard-toolbar-slot" ref={setToolbarSlot} />
        </Group>
      </Card>
      )}

      <Box className={`role-dashboard-content${usesInternalScroll ? ' role-dashboard-content--bounded' : ''}`}>
        <RoleDashboardWorkspace
          period={period}
          toolbarTarget={catalog.canSwitchWorkspace || showsSharedPeriod ? toolbarSlot : undefined}
          workspaceKey={selectedWorkspace}
        />
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

function formatDisplayDate(value: string): string {
  return value.split('-').reverse().join('.')
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
