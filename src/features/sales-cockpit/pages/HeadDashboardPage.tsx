import { ActionIcon, Alert, Badge, Card, Group, Loader, SimpleGrid, Stack, Table, Text, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getEscalated, getHeadTeam } from '../api/salesCockpitApi'
import { HeadDashboardChartsPanel } from '../components/HeadDashboardChartsPanel'
import { HeadTaskBoard } from '../components/HeadTaskBoard'
import type { CockpitUrgency, EscalatedResponse, EscalatedTask, HeadPaceStatus, HeadTeam, HeadTeamRow } from '../types'
import './sales-cockpit-page.css'

const POLL_INTERVAL_MS = 60_000

const PACE_COLOR: Record<HeadPaceStatus, string> = {
  ahead: 'green',
  on: 'blue',
  behind: 'red',
  no_target: 'gray',
}

const PACE_LABEL: Record<HeadPaceStatus, string> = {
  ahead: 'Випереджає',
  on: 'У графіку',
  behind: 'Відстає',
  no_target: 'Немає цілі',
}

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
  const [team, setTeam] = useValueState<HeadTeam>(EMPTY_TEAM)
  const [escalated, setEscalated] = useValueState<EscalatedResponse>(EMPTY_ESCALATED)
  const [error, setError] = useValueState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [isLoading, setLoading] = useState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    let active = true

    async function loadTeam() {
      try {
        const [result, escalatedResult] = await Promise.all([getHeadTeam(), getEscalated()])

        if (active) {
          setTeam(result)
          setEscalated(escalatedResult)
          setForbidden(result.is_head === false)   // gba-nba returns 200 {is_head:false} for non-heads
          setError(null)
        }
      } catch (loadError) {
        if (!active) {
          return
        }

        if (loadError instanceof ApiError && loadError.status === 403) {
          setForbidden(true)
          setError(null)
        } else {
          setForbidden(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дашборд'))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadTeam()

    const interval = setInterval(() => {
      void loadTeam()
    }, POLL_INTERVAL_MS)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [reloadKey, setError, setEscalated, setTeam, t])

  const rows = useMemo(
    () => team.team.toSorted((left, right) => attainment(right) - attainment(left)),
    [team.team],
  )

  const handleReload = useCallback(() => {
    setLoading(true)
    reload()
  }, [])

  return (
    <Stack className="cockpit-page" gap="md">
      <Group gap="xs" justify="flex-end">
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="subtle" onClick={handleReload}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {forbidden ? (
        <Card className="app-section-card" withBorder radius="md" padding="xl">
          <Text c="dimmed" fw={600} ta="center">
            {t('Доступ лише для керівника відділу')}
          </Text>
        </Card>
      ) : (
        <>
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
            <TotalCard
              label={t('Відвантаження (план / факт)')}
              value={`${formatMoney(team.totals.shipped_target)} / ${formatMoney(team.totals.shipped_mtd)}`}
            />
            <TotalCard
              label={t('Оплати (план / факт)')}
              value={`${formatMoney(team.totals.paid_target)} / ${formatMoney(team.totals.paid_mtd)}`}
            />
            <TotalCard
              accent="success"
              label={t('Виконано / Продано за місяць')}
              value={`${team.totals.done_month} / ${team.totals.sold_month}`}
            />
            <TotalCard accent="brand" label={t('Виторг за місяць')} value={formatMoney(team.totals.revenue_month)} />
            <TotalCard
              accent="info"
              label={t('Закриття / Конверсія')}
              value={`${formatRate(team.totals.close_rate)} / ${formatRate(team.totals.conversion_rate)}`}
            />
          </SimpleGrid>

          <HeadDashboardChartsPanel reloadKey={reloadKey} rows={rows} />

          {isLoading && rows.length === 0 ? (
            <Group justify="center" py="xl">
              <Loader />
              <Text c="dimmed" size="sm">
                {t('Завантаження дашборду')}
              </Text>
            </Group>
          ) : rows.length === 0 ? (
            <Card className="app-section-card" withBorder radius="md" padding="xl">
              <Text c="dimmed" fw={600} ta="center">
                {t('Немає менеджерів для відображення')}
              </Text>
            </Card>
          ) : (
            <Card className="app-section-card" withBorder radius="md" padding={0}>
              <Table.ScrollContainer minWidth={960}>
                <Table className="cockpit-team-table" highlightOnHover striped withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('Менеджер')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Відвантаження план')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Відвантаження факт')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Виконання відвантаження')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Виконання оплат')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Виконано')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Продано')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Закриття')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Конверсія')}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{t('Виторг')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => (
                      <Table.Tr key={row.manager_id}>
                        <Table.Td className="cockpit-team-manager">{row.manager_name?.trim() || `#${row.manager_id}`}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatMoney(row.target.shipped.target)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatMoney(row.target.shipped.mtd)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Group gap="xs" justify="flex-end" wrap="nowrap">
                            <Text size="sm">{formatPercent(row.target.shipped.attainment_pct)}</Text>
                            <Badge color={PACE_COLOR[row.target.shipped.pace_status]} variant="light">
                              {t(PACE_LABEL[row.target.shipped.pace_status])}
                            </Badge>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Group gap="xs" justify="flex-end" wrap="nowrap">
                            <Text size="sm">{formatPercent(row.target.paid.attainment_pct)}</Text>
                            <Badge color={PACE_COLOR[row.target.paid.pace_status]} variant="light">
                              {t(PACE_LABEL[row.target.paid.pace_status])}
                            </Badge>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{row.tasks.done_month}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{row.tasks.sold_month}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatRate(row.tasks.close_rate)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatRate(row.tasks.conversion_rate)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatMoney(row.tasks.revenue_month)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Card>
          )}

          <HeadTaskBoard />

          <Card className="app-section-card" withBorder radius="md">
            <Stack gap="sm">
              <Group gap="xs">
                <Text className="cockpit-section-title">{t('Ескальовані задачі')}</Text>
                <Badge color={escalated.count > 0 ? 'red' : 'gray'} variant="light">
                  {escalated.count}
                </Badge>
              </Group>

              {escalated.tasks.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {t('Ескальованих задач немає')}
                </Text>
              ) : (
                <Stack gap="xs">
                  {escalated.tasks.map((task) => (
                    <EscalatedRow key={task.task_key} task={task} />
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  )
}

function EscalatedRow({ task }: { task: EscalatedTask }) {
  const { t } = useI18n()

  return (
    <Group align="center" className="cockpit-escalated-row" gap="sm" justify="space-between" wrap="nowrap">
      <Stack gap={2}>
        <Text className="cockpit-escalated-title">{task.title || t('Завдання')}</Text>
        {task.client_name && <Text className="cockpit-escalated-client">{task.client_name}</Text>}
      </Stack>

      <Group gap="xs" wrap="nowrap">
        <Badge color={urgencyColor(task.urgency)} variant="filled">
          {urgencyLabel(task.urgency, t)}
        </Badge>
        {typeof task.manager_id === 'number' && (
          <Badge color="gray" variant="light">
            {t('Менеджер')} #{task.manager_id}
          </Badge>
        )}
      </Group>
    </Group>
  )
}

function urgencyColor(urgency?: CockpitUrgency): string {
  return urgency ? URGENCY_COLOR[urgency] : 'blue'
}

function urgencyLabel(urgency: CockpitUrgency | undefined, t: (key: string) => string): string {
  return t(urgency ? URGENCY_LABEL[urgency] : URGENCY_LABEL.normal)
}

function TotalCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={`cockpit-metric${accent ? ` is-${accent}` : ''}`}>
      <span className="cockpit-metric-label">{label}</span>
      <span className="cockpit-metric-value">{value}</span>
    </div>
  )
}

function attainment(row: HeadTeamRow): number {
  return row.target.shipped.attainment_pct
}

function formatMoney(value: number): string {
  return `€${moneyFormatter.format(value)}`
}

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`   // close_rate / conversion_rate are 0..1 ratios
}

function formatPercent(value: number): string {
  return `${value}%`
}
