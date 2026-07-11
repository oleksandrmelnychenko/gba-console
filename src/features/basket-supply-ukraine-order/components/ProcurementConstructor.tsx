import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ChevronDown, ChevronRight, Plus, Sparkles, Trash2, Truck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { Client } from '../../clients/types'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import {
  createCockpitDraftOrder,
  getBudgetCartPlan,
  getProcurementCharts,
  getProducerPlan,
} from '../api/procurementApi'
import type { ProcurementCharts, ProcurementUrgency, ReorderSuggestion } from '../procurementTypes'

type Lens = 'warehouse' | 'producer'

const amount = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qty = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })

const URGENCY_META: Record<ProcurementUrgency, { color: string; label: string; order: number }> = {
  critical: { color: 'red', label: 'Критично', order: 0 },
  high: { color: 'orange', label: 'Скоро', order: 1 },
  normal: { color: 'blue', label: 'За планом', order: 2 },
  none: { color: 'gray', label: 'Достатньо', order: 3 },
}

type BasketLine = { suggestion: ReorderSuggestion; qty: number }

export function ProcurementConstructor() {
  const { t } = useI18n()
  const [lens, setLens] = useState<Lens>('warehouse')

  const [producers, setProducers] = useState<Client[]>([])
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null)

  const [rows, setRows] = useState<ReorderSuggestion[]>([])
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [charts, setCharts] = useState<ProcurementCharts | null>(null)

  const [expanded, setExpanded] = useState<number | null>(null)
  const [basket, setBasket] = useState<Map<number, BasketLine>>(new Map())
  const [creatingProducer, setCreatingProducer] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getSupplyOrderSuppliers()
      .then((list) => {
        if (!cancelled) {
          setProducers(list)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  const loadRows = useCallback(
    (signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      const producerId = selectedProducerId ? Number(selectedProducerId) : null

      const plan =
        lens === 'warehouse'
          ? getBudgetCartPlan({ budgetEur: 0, method: 'greedy' }, signal).then((p) => p.items)
          : producerId
            ? getProducerPlan(producerId, undefined, signal).then((p) => p.items)
            : Promise.resolve<ReorderSuggestion[]>([])

      plan
        .then((items) => {
          if (!signal.aborted) {
            setRows(items.filter((item) => item.suggested_qty > 0))
          }
        })
        .catch(() => {
          if (!signal.aborted) {
            setError(t('Не вдалося завантажити план закупівлі'))
          }
        })
        .finally(() => {
          if (!signal.aborted) {
            setLoading(false)
          }
        })

      getProcurementCharts(producerId ? { producerId } : {}, signal)
        .then((data) => {
          if (!signal.aborted) {
            setCharts(data)
          }
        })
        .catch(() => undefined)
    },
    [lens, selectedProducerId, t],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadRows(controller.signal)

    return () => controller.abort()
  }, [loadRows])

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          URGENCY_META[a.urgency].order - URGENCY_META[b.urgency].order ||
          (b.line_cost_eur ?? 0) - (a.line_cost_eur ?? 0),
      ),
    [rows],
  )

  const demandByProduct = useMemo(() => {
    const map = new Map<number, number[]>()
    charts?.demand_series.forEach((series) => {
      map.set(
        series.product_id,
        series.points.map((point) => point.units),
      )
    })

    return map
  }, [charts])

  function addToBasket(suggestion: ReorderSuggestion, quantity?: number) {
    setBasket((previous) => {
      const next = new Map(previous)
      next.set(suggestion.product_id, {
        suggestion,
        qty: quantity ?? previous.get(suggestion.product_id)?.qty ?? suggestion.suggested_qty,
      })

      return next
    })
  }

  function addAllCritical() {
    const critical = sortedRows.filter((row) => row.urgency === 'critical' || row.urgency === 'high')
    setBasket((previous) => {
      const next = new Map(previous)
      critical.forEach((row) => next.set(row.product_id, { suggestion: row, qty: row.suggested_qty }))

      return next
    })
    notifications.show({ color: 'blue', message: t('Додано {n} позицій у кошик').replace('{n}', String(critical.length)) })
  }

  function setBasketQty(productId: number, value: number) {
    setBasket((previous) => {
      const line = previous.get(productId)
      if (!line) {
        return previous
      }

      const next = new Map(previous)
      if (value <= 0) {
        next.delete(productId)
      } else {
        next.set(productId, { ...line, qty: value })
      }

      return next
    })
  }

  const basketByProducer = useMemo(() => {
    const groups = new Map<number, { name: string; lines: BasketLine[]; total: number }>()
    basket.forEach((line) => {
      const pid = line.suggestion.producer_id
      const group = groups.get(pid) ?? {
        name: line.suggestion.producer_name || `#${pid}`,
        lines: [],
        total: 0,
      }
      group.lines.push(line)
      group.total += (line.suggestion.unit_cost_eur ?? 0) * line.qty
      groups.set(pid, group)
    })

    return [...groups.entries()].map(([producerId, group]) => ({ producerId, ...group }))
  }, [basket])

  async function createDraft(producerId: number, lines: BasketLine[]) {
    setCreatingProducer(producerId)
    try {
      await createCockpitDraftOrder(
        producerId,
        lines.map((line) => ({ productId: line.suggestion.product_id, qty: line.qty })),
      )
      notifications.show({ color: 'green', message: t('Чернетку замовлення створено') })
      setBasket((previous) => {
        const next = new Map(previous)
        lines.forEach((line) => next.delete(line.suggestion.product_id))

        return next
      })
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити чернетку') })
    } finally {
      setCreatingProducer(null)
    }
  }

  const basketCount = basket.size

  return (
    <Stack gap={10}>
      <Group justify="space-between" wrap="wrap">
        <Group gap={10} wrap="nowrap">
          <SegmentedControl
            data={[
              { label: t('Склад'), value: 'warehouse' },
              { label: t('Виробник'), value: 'producer' },
            ]}
            value={lens}
            onChange={(value) => setLens(value as Lens)}
          />
          {lens === 'producer' && (
            <Select
              clearable
              data={producers.map((producer) => ({
                value: String(producer.Id),
                label: producer.Name || producer.FullName || `#${producer.Id}`,
              }))}
              placeholder={t('Оберіть виробника')}
              searchable
              value={selectedProducerId}
              w={280}
              onChange={setSelectedProducerId}
            />
          )}
        </Group>
        <Button
          disabled={sortedRows.length === 0}
          leftSection={<Sparkles size={15} />}
          size="xs"
          variant="light"
          onClick={addAllCritical}
        >
          {t('Додати критичні в кошик')}
        </Button>
      </Group>

      {charts && <ChartsStrip charts={charts} t={t} />}

      <Group align="flex-start" gap={12} wrap="nowrap" style={{ minHeight: 0 }}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          {isLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
              <Text size="sm">{t('Розрахунок потреби…')}</Text>
            </Group>
          ) : error ? (
            <Text c="red" py="md" size="sm">
              {error}
            </Text>
          ) : sortedRows.length === 0 ? (
            <Text c="dimmed" py="md" ta="center">
              {lens === 'producer' && !selectedProducerId
                ? t('Оберіть виробника, щоб побачити потребу')
                : t('Немає позицій, що потребують замовлення')}
            </Text>
          ) : (
            <Box className="procure-constructor__table" style={{ overflowX: 'auto' }}>
              <Table highlightOnHover stickyHeader verticalSpacing={5}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={30} />
                    <Table.Th>{t('Терміновість')}</Table.Th>
                    <Table.Th>{t('Товар')}</Table.Th>
                    {lens === 'warehouse' && <Table.Th>{t('Виробник')}</Table.Th>}
                    <Table.Th ta="right">{t('Наявн.')}</Table.Th>
                    <Table.Th ta="right">{t('Покриття')}</Table.Th>
                    <Table.Th ta="right">{t('Замовити')}</Table.Th>
                    <Table.Th ta="right">{t('Сума EUR')}</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {sortedRows.map((row) => {
                    const meta = URGENCY_META[row.urgency]
                    const isOpen = expanded === row.product_id
                    const inBasket = basket.has(row.product_id)

                    return (
                      <>
                        <Table.Tr key={row.product_id}>
                          <Table.Td>
                            <ActionIcon
                              aria-label={t('Пруфи')}
                              size="sm"
                              variant="subtle"
                              onClick={() => setExpanded(isOpen ? null : row.product_id)}
                            >
                              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </ActionIcon>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={meta.color} size="sm" variant="light">
                              {t(meta.label)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">#{row.product_id}</Text>
                            {row.abc && (
                              <Text c="dimmed" size="xs">
                                {row.abc}
                                {row.xyz ?? ''}
                              </Text>
                            )}
                          </Table.Td>
                          {lens === 'warehouse' && (
                            <Table.Td>
                              <Text size="sm" title={row.producer_name ?? ''} truncate>
                                {row.producer_name || `#${row.producer_id}`}
                              </Text>
                            </Table.Td>
                          )}
                          <Table.Td ta="right">
                            <Text size="sm">{qty.format(row.inventory.on_hand)}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text c={row.days_of_cover < 30 ? 'red' : undefined} size="sm">
                              {row.days_of_cover >= 9999 ? '∞' : `${qty.format(row.days_of_cover)} ${t('дн')}`}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} size="sm">
                              {qty.format(row.suggested_qty)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm">{amount.format(row.line_cost_eur ?? 0)}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Tooltip label={inBasket ? t('У кошику') : t('Додати в кошик')}>
                              <ActionIcon
                                color={inBasket ? 'green' : 'blue'}
                                size="sm"
                                variant={inBasket ? 'filled' : 'light'}
                                onClick={() => addToBasket(row)}
                              >
                                <Plus size={15} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                        {isOpen && (
                          <Table.Tr key={`${row.product_id}-proof`}>
                            <Table.Td colSpan={lens === 'warehouse' ? 9 : 8}>
                              <ProofPanel row={row} demand={demandByProduct.get(row.product_id)} t={t} />
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Box>
          )}
        </Box>

        <Box className="procure-constructor__basket" style={{ flex: '0 0 340px', minWidth: 300 }}>
          <Group gap={8} mb={6}>
            <Truck size={16} />
            <Text fw={600} size="sm">
              {t('Замовлення')} {basketCount > 0 ? `(${basketCount})` : ''}
            </Text>
          </Group>
          {basketByProducer.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Кошик порожній. Додайте позиції з таблиці.')}
            </Text>
          ) : (
            <Stack gap={10}>
              {basketByProducer.map((group) => (
                <Box key={group.producerId} className="procure-constructor__basket-group">
                  <Group justify="space-between" mb={4} wrap="nowrap">
                    <Text fw={600} size="xs" title={group.name} truncate>
                      {group.name}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {amount.format(group.total)} EUR
                    </Text>
                  </Group>
                  <Stack gap={3}>
                    {group.lines.map((line) => (
                      <Group key={line.suggestion.product_id} gap={4} wrap="nowrap">
                        <Text size="xs" style={{ flex: 1 }} truncate>
                          #{line.suggestion.product_id}
                        </Text>
                        <NumberInput
                          hideControls
                          min={0}
                          size="xs"
                          value={line.qty}
                          w={72}
                          onChange={(value) => setBasketQty(line.suggestion.product_id, Number(value) || 0)}
                        />
                        <ActionIcon
                          color="red"
                          size="sm"
                          variant="subtle"
                          onClick={() => setBasketQty(line.suggestion.product_id, 0)}
                        >
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                  <Button
                    fullWidth
                    loading={creatingProducer === group.producerId}
                    mt={6}
                    size="compact-xs"
                    variant="light"
                    onClick={() => void createDraft(group.producerId, group.lines)}
                  >
                    {t('Створити чернетку')}
                  </Button>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Group>
    </Stack>
  )
}

function ProofPanel({
  row,
  demand,
  t,
}: {
  demand?: number[]
  row: ReorderSuggestion
  t: (key: string) => string
}) {
  const leadDemand = row.lead_demand ?? Math.max(0, row.reorder_point - row.safety_stock)
  const orderUpTo = row.order_up_to ?? row.reorder_point + row.suggested_qty
  const scaleMax = Math.max(orderUpTo, row.reorder_point, row.inventory.position, 1)

  return (
    <Group align="flex-start" gap={20} wrap="wrap" py={4}>
      <Stack gap={6} style={{ flex: '1 1 320px', minWidth: 280 }}>
        <Text fw={600} size="xs">
          {t('Чому саме стільки')}
        </Text>
        <ProofBar
          color="gray"
          label={t('Поточна позиція')}
          note={`${qty.format(row.inventory.on_hand)} ${t('склад')} − ${qty.format(row.inventory.reserved)} ${t('резерв')} + ${qty.format(row.inventory.on_order)} ${t('в дорозі')}`}
          scaleMax={scaleMax}
          value={row.inventory.position}
        />
        <ProofBar color="orange" label={t('Точка замовлення')} note={`${t('попит за lead-time')} ${qty.format(leadDemand)} + ${t('страховий')} ${qty.format(row.safety_stock)}`} scaleMax={scaleMax} value={row.reorder_point} />
        <ProofBar color="blue" label={t('Дозамовити до')} note={`+ ${qty.format(row.forecast.mean_daily * row.forecast.horizon_days)} ${t('на горизонт')}`} scaleMax={scaleMax} value={orderUpTo} />
        <Text fw={600} size="xs">
          {t('Замовити')} = {qty.format(orderUpTo)} − {qty.format(row.inventory.position)} = {qty.format(row.suggested_qty)}
        </Text>
      </Stack>

      <Stack gap={4} style={{ flex: '1 1 240px', minWidth: 220 }}>
        <Text fw={600} size="xs">
          {t('Прогноз попиту')}
        </Text>
        {demand && demand.length > 0 ? (
          <Sparkline values={demand} />
        ) : (
          <Text c="dimmed" size="xs">
            {t('Історія продажів у графіках зверху')}
          </Text>
        )}
        <ProofFact label={t('Попит/день')} value={`${amount.format(row.forecast.mean_daily)} ± ${amount.format(row.forecast.std_daily)}`} />
        <ProofFact label={t('Метод')} value={row.forecast.method} />
        <ProofFact label={t('Рівень сервісу')} value={row.applied_service_level ? `${(row.applied_service_level * 100).toFixed(1)}%` : '—'} />
        {row.unit_margin_eur != null && (
          <ProofFact label={t('Маржа/од')} value={`${amount.format(row.unit_margin_eur)} EUR`} />
        )}
        {row.cheaper_alt && (
          <Text c="orange" size="xs">
            {t('Дешевше в іншого виробника')}: #{row.cheaper_alt.producer_id} · {amount.format(row.cheaper_alt.cost_eur)} EUR
          </Text>
        )}
      </Stack>
    </Group>
  )
}

function ProofBar({
  color,
  label,
  note,
  scaleMax,
  value,
}: {
  color: string
  label: string
  note: string
  scaleMax: number
  value: number
}) {
  const pct = Math.max(2, Math.min(100, (value / scaleMax) * 100))

  return (
    <Box>
      <Group justify="space-between" wrap="nowrap">
        <Text size="xs">{label}</Text>
        <Text fw={600} size="xs">
          {qty.format(value)}
        </Text>
      </Group>
      <Box style={{ background: 'var(--mantine-color-gray-2)', borderRadius: 3, height: 8, overflow: 'hidden' }}>
        <Box style={{ background: `var(--mantine-color-${color}-5)`, height: '100%', width: `${pct}%` }} />
      </Box>
      <Text c="dimmed" size="xs">
        {note}
      </Text>
    </Box>
  )
}

function ProofFact({ label, value }: { label: string; value: string }) {
  return (
    <Group gap={6} justify="space-between" wrap="nowrap">
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text size="xs" title={value} truncate>
        {value}
      </Text>
    </Group>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)

  return (
    <Group align="flex-end" gap={2} h={40}>
      {values.map((value, index) => (
        <Box
          key={index}
          style={{
            background: 'var(--brand-orange, var(--mantine-color-orange-5))',
            borderRadius: 1,
            flex: 1,
            height: `${Math.max(3, (value / max) * 100)}%`,
            minWidth: 3,
          }}
          title={String(value)}
        />
      ))}
    </Group>
  )
}

function ChartsStrip({ charts, t }: { charts: ProcurementCharts; t: (key: string) => string }) {
  const totalUrgency = charts.urgency_mix.reduce((sum, bucket) => sum + bucket.count, 0) || 1

  return (
    <Group gap={20} wrap="wrap">
      <Box>
        <Text c="dimmed" mb={4} size="xs">
          {t('Терміновість позицій')}
        </Text>
        <Group gap={4} wrap="nowrap">
          {charts.urgency_mix.map((bucket) => {
            const meta = URGENCY_META[bucket.urgency as ProcurementUrgency] ?? URGENCY_META.none

            return (
              <Tooltip key={bucket.urgency} label={`${t(meta.label)}: ${bucket.count}`}>
                <Box
                  style={{
                    background: `var(--mantine-color-${meta.color}-5)`,
                    borderRadius: 3,
                    height: 18,
                    width: `${Math.max(6, (bucket.count / totalUrgency) * 180)}px`,
                  }}
                />
              </Tooltip>
            )
          })}
        </Group>
      </Box>
      <Box>
        <Text c="dimmed" mb={4} size="xs">
          {t('Днів покриття')}
        </Text>
        <Group align="flex-end" gap={3} h={22}>
          {charts.days_of_cover_hist.map((bucket) => (
            <Tooltip key={bucket.bucket} label={`${bucket.bucket}: ${bucket.count}`}>
              <Box
                style={{
                  background: 'var(--mantine-color-blue-4)',
                  borderRadius: 2,
                  height: `${Math.max(4, bucket.count)}px`,
                  width: 16,
                }}
              />
            </Tooltip>
          ))}
        </Group>
      </Box>
    </Group>
  )
}
