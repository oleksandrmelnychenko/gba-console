import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle, IconRefresh } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { Client } from '../../supply-ukraine-orders/types'
import { getProducerPlan } from '../api/procurementApi'
import type { ProcurementUrgency, ProducerPlan, ReorderSuggestion } from '../procurementTypes'

type BuyerCockpitState = {
  plan: ProducerPlan | null
  error: string | null
  isLoading: boolean
}

type BuyerCockpitAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; plan: ProducerPlan }
  | { type: 'loading' }
  | { type: 'reset' }

const initialState: BuyerCockpitState = {
  plan: null,
  error: null,
  isLoading: false,
}

function cockpitReducer(_state: BuyerCockpitState, action: BuyerCockpitAction): BuyerCockpitState {
  switch (action.type) {
    case 'failed':
      return { plan: null, error: action.error, isLoading: false }
    case 'loaded':
      return { plan: action.plan, error: null, isLoading: false }
    case 'loading':
      return { plan: null, error: null, isLoading: true }
    case 'reset':
      return initialState
  }
}

const URGENCY_LABEL: Record<ProcurementUrgency, string> = {
  critical: 'Критична',
  high: 'Висока',
  normal: 'Звичайна',
  none: 'Достатньо',
}

const URGENCY_BADGE_COLOR: Record<ProcurementUrgency, string> = {
  critical: 'red',
  high: 'orange',
  normal: 'yellow',
  none: 'gray',
}

const URGENCY_RANK: Record<ProcurementUrgency, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  none: 3,
}

const LEAD_TIME_SOURCE_LABEL: Record<string, string> = {
  empirical: 'емпіричний',
  default: 'за замовч.',
}

const qtyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

const countFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
})

const eurFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 1,
})

export function BuyerCockpitTab() {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(cockpitReducer, initialState)
  const [producers, setProducers] = useState<Client[]>([])
  const [producersError, setProducersError] = useState<string | null>(null)
  const [areProducersLoading, setProducersLoading] = useState(true)
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null)
  const [draftQty, setDraftQty] = useState<Record<number, number>>({})
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { plan, error, isLoading } = state

  useEffect(() => {
    let cancelled = false

    async function loadProducers() {
      setProducersLoading(true)
      setProducersError(null)

      try {
        const loaded = await getSupplyOrderSuppliers()

        if (!cancelled) {
          setProducers(loaded)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProducers([])
          setProducersError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити виробників'))
        }
      } finally {
        if (!cancelled) {
          setProducersLoading(false)
        }
      }
    }

    void loadProducers()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (selectedProducerId === null) {
      dispatch({ type: 'reset' })
      return
    }

    const producerId = Number(selectedProducerId)

    if (!Number.isFinite(producerId)) {
      dispatch({ type: 'reset' })
      return
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadPlan() {
      dispatch({ type: 'loading' })

      try {
        const loaded = await getProducerPlan(producerId, undefined, controller.signal)

        if (!cancelled) {
          setDraftQty(buildDraftQty(loaded.items))
          dispatch({ plan: loaded, type: 'loaded' })
        }
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити план поповнення'),
            type: 'failed',
          })
        }
      }
    }

    void loadPlan()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedProducerId, reloadKey, t])

  const producerOptions = useMemo(() => buildProducerOptions(producers), [producers])

  const sortedItems = useMemo(
    () => (plan ? [...plan.items].sort((left, right) => URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency]) : []),
    [plan],
  )

  const urgencyCounts = useMemo(() => buildUrgencyCounts(plan?.items ?? []), [plan])

  const totalDraftCost = useMemo(
    () =>
      sortedItems.reduce((sum, item) => {
        const qty = getDraftQty(draftQty, item)
        const unitCost = lineUnitCost(item)

        return sum + qty * unitCost
      }, 0),
    [sortedItems, draftQty],
  )

  function updateDraftQty(productId: number, value: number | '') {
    const nextValue = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0

    setDraftQty((current) => ({ ...current, [productId]: nextValue }))
  }

  const columns = useMemo<Array<DataTableColumn<ReorderSuggestion>>>(
    () => [
      {
        id: 'product',
        header: t('Товар'),
        accessor: (item) => item.product_id,
        cell: (item) => `#${item.product_id}`,
        width: 110,
      },
      {
        id: 'urgency',
        header: t('Терміновість'),
        accessor: (item) => URGENCY_RANK[item.urgency],
        cell: (item) => (
          <Badge color={URGENCY_BADGE_COLOR[item.urgency]} size="sm" variant="light">
            {t(URGENCY_LABEL[item.urgency])}
          </Badge>
        ),
        width: 130,
      },
      {
        id: 'quadrant',
        header: t('Квадрант'),
        accessor: (item) => quadrantLabel(item),
        cell: (item) => {
          const label = quadrantLabel(item)

          if (!label) {
            return (
              <Text c="dimmed" size="sm">
                —
              </Text>
            )
          }

          return (
            <Badge color="blue" size="sm" variant="outline">
              {label}
            </Badge>
          )
        },
        width: 110,
      },
      {
        id: 'draftQty',
        header: t('К-сть до замовлення'),
        accessor: (item) => getDraftQty(draftQty, item),
        cell: (item) => (
          <NumberInput
            allowNegative={false}
            min={0}
            onChange={(value) => updateDraftQty(item.product_id, typeof value === 'number' ? value : '')}
            size="xs"
            value={getDraftQty(draftQty, item)}
            w={120}
          />
        ),
        width: 150,
        align: 'right',
      },
      {
        id: 'unitCost',
        header: `${t('Ціна')} (EUR)`,
        accessor: (item) => item.unit_cost_eur ?? 0,
        cell: (item) => (item.unit_cost_eur === null ? '—' : eurFormatter.format(item.unit_cost_eur)),
        width: 120,
        align: 'right',
      },
      {
        id: 'unitMargin',
        header: `${t('Маржа')} (EUR)`,
        accessor: (item) => item.unit_margin_eur ?? 0,
        cell: (item) => {
          if (item.unit_margin_eur === null) {
            return '—'
          }

          return (
            <Text c={item.unit_margin_eur >= 0 ? 'green' : 'red'} fw={600} size="sm">
              {eurFormatter.format(item.unit_margin_eur)}
            </Text>
          )
        },
        width: 120,
        align: 'right',
      },
      {
        id: 'serviceLevel',
        header: t('Рівень сервісу'),
        accessor: (item) => item.applied_service_level ?? 0,
        cell: (item) =>
          item.applied_service_level === null ? '—' : `${percentFormatter.format(item.applied_service_level * 100)}%`,
        width: 130,
        align: 'right',
      },
      {
        id: 'daysOfCover',
        header: t('Днів покриття'),
        accessor: (item) => item.days_of_cover,
        cell: (item) => qtyFormatter.format(item.days_of_cover),
        width: 120,
        align: 'right',
      },
      {
        id: 'cheaperAlt',
        header: '',
        cell: (item) =>
          item.cheaper_alt ? (
            <Tooltip
              label={`${t('дешевший постачальник')}: €${eurFormatter.format(item.cheaper_alt.cost_eur)}`}
            >
              <ActionIcon aria-label={t('дешевший постачальник')} color="orange" size="sm" variant="subtle">
                <IconAlertTriangle size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null,
        width: 56,
        enableSorting: false,
      },
    ],
    [draftQty, t],
  )

  const toolbarRight = (
    <Tooltip label={t('Оновити')}>
      <ActionIcon
        aria-label={t('Оновити')}
        disabled={selectedProducerId === null}
        loading={isLoading}
        size="sm"
        variant="subtle"
        onClick={() => reload()}
      >
        <IconRefresh size={16} />
      </ActionIcon>
    </Tooltip>
  )

  const hasSelection = selectedProducerId !== null
  const hasPlan = Boolean(plan) && !isLoading
  const hasItems = sortedItems.length > 0

  return (
    <Stack gap="lg">
      {producersError && (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />} variant="light">
          {producersError}
        </Alert>
      )}

      <Group align="flex-end" gap="md" wrap="wrap">
        <Select
          clearable
          data={producerOptions}
          disabled={areProducersLoading}
          label={t('Виробник')}
          nothingFoundMessage={t('Нічого не знайдено')}
          onChange={setSelectedProducerId}
          placeholder={areProducersLoading ? t('Завантаження…') : t('Оберіть виробника')}
          searchable
          value={selectedProducerId}
          w={360}
        />
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
          {error}
        </Alert>
      )}

      {!hasSelection && !error && (
        <Card padding="lg" radius="md" withBorder>
          <Text c="dimmed" size="sm" ta="center">
            {t('Оберіть виробника')}
          </Text>
        </Card>
      )}

      {hasSelection && isLoading && (
        <Card padding="lg" radius="md" withBorder>
          <Group justify="center">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              {t('Завантаження…')}
            </Text>
          </Group>
        </Card>
      )}

      {hasSelection && hasPlan && plan && (
        <Card padding="md" radius="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap">
              <Stack gap={2}>
                <Text fw={600} size="lg">
                  {plan.producer_name || `#${plan.producer_id ?? ''}`}
                </Text>
                <Group gap="xs">
                  <Text c="dimmed" size="sm">
                    {t('Час постачання')}: {qtyFormatter.format(plan.lead_time_days)} ±{' '}
                    {qtyFormatter.format(plan.lead_time_std_days)} {t('днів')}
                  </Text>
                  {plan.lead_time_source && (
                    <Badge color="gray" size="sm" variant="light">
                      {t(LEAD_TIME_SOURCE_LABEL[plan.lead_time_source] ?? plan.lead_time_source)}
                    </Badge>
                  )}
                </Group>
              </Stack>
              <Stack align="flex-end" gap={2}>
                <Text c="dimmed" size="xs">
                  {t('Чернетка замовлення')} (EUR)
                </Text>
                <Text fw={700} size="lg">
                  €{eurFormatter.format(totalDraftCost)}
                </Text>
              </Stack>
            </Group>

            <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
              <SummaryItem label={t('Позицій')} value={countFormatter.format(plan.item_count)} />
              <SummaryItem
                color={URGENCY_BADGE_COLOR.critical}
                label={t(URGENCY_LABEL.critical)}
                value={countFormatter.format(urgencyCounts.critical)}
              />
              <SummaryItem
                color={URGENCY_BADGE_COLOR.high}
                label={t(URGENCY_LABEL.high)}
                value={countFormatter.format(urgencyCounts.high)}
              />
              <SummaryItem
                color={URGENCY_BADGE_COLOR.normal}
                label={t(URGENCY_LABEL.normal)}
                value={countFormatter.format(urgencyCounts.normal)}
              />
              <SummaryItem
                label={t(URGENCY_LABEL.none)}
                value={countFormatter.format(urgencyCounts.none)}
              />
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {hasSelection && hasPlan && (
        <Card padding="md" radius="md" withBorder>
          <Stack gap="md">
            <DataTable
              columns={columns}
              data={sortedItems}
              emptyText={t('Немає позицій до замовлення')}
              getRowId={(item) => String(item.product_id)}
              isLoading={isLoading}
              maxHeight={560}
              minWidth={1040}
              tableId="basket-supply-ukraine-order-buyer-cockpit"
              toolbarRight={toolbarRight}
            />

            <Group justify="flex-end">
              <Tooltip label={t('незабаром')}>
                <Button disabled>{t('Створити замовлення постачальнику')}</Button>
              </Tooltip>
            </Group>

            {hasItems && (
              <Text c="dimmed" size="xs" ta="right">
                {t('Чернетка')}: {countFormatter.format(sortedItems.length)} {t('позицій')} · €
                {eurFormatter.format(totalDraftCost)}
              </Text>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  )
}

function SummaryItem({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text c={color} fw={700}>
        {value}
      </Text>
    </Stack>
  )
}

function buildProducerOptions(producers: Client[]) {
  return producers
    .map((producer) => {
      const id = producer.Id

      if (typeof id !== 'number' || !Number.isFinite(id)) {
        return null
      }

      const label = producer.FullName || producer.Name || producer.Code || `#${id}`

      return { label, value: String(id) }
    })
    .filter((option): option is { label: string; value: string } => option !== null)
}

function buildDraftQty(items: ReorderSuggestion[]): Record<number, number> {
  return items.reduce<Record<number, number>>((draft, item) => {
    draft[item.product_id] = item.suggested_qty
    return draft
  }, {})
}

function getDraftQty(draftQty: Record<number, number>, item: ReorderSuggestion): number {
  const value = draftQty[item.product_id]

  return typeof value === 'number' && Number.isFinite(value) ? value : item.suggested_qty
}

function lineUnitCost(item: ReorderSuggestion): number {
  if (item.unit_cost_eur !== null) {
    return item.unit_cost_eur
  }

  if (item.line_cost_eur !== null && item.suggested_qty > 0) {
    return item.line_cost_eur / item.suggested_qty
  }

  return 0
}

function buildUrgencyCounts(items: ReorderSuggestion[]): Record<ProcurementUrgency, number> {
  return items.reduce<Record<ProcurementUrgency, number>>(
    (counts, item) => {
      counts[item.urgency] += 1
      return counts
    },
    { critical: 0, high: 0, normal: 0, none: 0 },
  )
}

function quadrantLabel(item: ReorderSuggestion): string {
  if (item.quadrant) {
    return item.quadrant
  }

  const abc = item.abc ?? ''
  const xyz = item.xyz ?? ''
  const label = `${abc}${xyz}`

  return label
}
