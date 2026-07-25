import { BarChart, DonutChart, LineChart } from '@mantine/charts'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Loader,
  Menu,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getProductAnalytics } from '../../assortment/api/assortmentApi'
import type { ProductSalesSeriesPoint } from '../../assortment/types'
import { getSupplyOrderSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { Client } from '../../supply-ukraine-orders/types'
import {
  listSessions,
  removeSession,
  saveSession,
  type ProcurementSession,
} from '../procurementSessions'
import {
  createCockpitDraftOrder,
  getBudgetCartPlan,
  getProcurementCharts,
  getProducerPlan,
} from '../api/procurementApi'
import {
  filterProcurementRows,
  getProcurementDraftQuantity,
  getProcurementOrderQuantity,
  procurementLineKey,
  type ProcurementDraftQuantities,
} from '../procurementConstructorModel'
import { calculateProcurementDecision, type ProcurementDecision } from '../procurementDecision'
import type { ProcurementCharts, ProcurementUrgency, ReorderSuggestion } from '../procurementTypes'
import { ProcurementProductCell } from './ProcurementProductCell'
import { ProcurementWorkspaceState } from './ProcurementWorkspaceState'

type Lens = 'warehouse' | 'producer'

const amount = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qty = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const salesMonth = new Intl.DateTimeFormat('uk-UA', {
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
})

const URGENCY_META: Record<ProcurementUrgency, { color: string; label: string; order: number }> = {
  critical: { color: 'red', label: 'Критично', order: 0 },
  high: { color: 'orange', label: 'Скоро', order: 1 },
  normal: { color: 'blue', label: 'За планом', order: 2 },
  none: { color: 'gray', label: 'Достатньо', order: 3 },
}

type BasketLine = { suggestion: ReorderSuggestion; qty: number }

const PLAN_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['product'],
    right: ['actions'],
  },
  columnVisibility: {
    margin: false,
    moq: false,
    onOrder: false,
    position: false,
    reorderPoint: false,
    reserved: false,
    unitCost: false,
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

// Quadrant = ABC (revenue importance) × XYZ (demand predictability).
const QUADRANT_HINTS: Record<string, string> = {
  AX: 'Головні гроші + стабільний попит — тримати завжди на складі',
  AY: 'Важливий + сезонний попит — запас під сезон',
  AZ: 'Важливий + рваний попит — більший страховий запас',
  BX: 'Середній + стабільний — планове поповнення',
  BY: 'Середній + змінний попит',
  BZ: 'Середній + непередбачуваний попит',
  CX: 'Дрібний + стабільний',
  CY: 'Дрібний + змінний',
  CZ: 'Дрібний + непередбачуваний — під замовлення, не морозити склад',
}

function quadrantHint(quadrant: string, t: (key: string) => string): string {
  return t(QUADRANT_HINTS[quadrant.toUpperCase()] ?? 'ABC×XYZ: важливість × передбачуваність попиту')
}

function urgencyPillClass(urgency: ProcurementUrgency): string {
  if (urgency === 'critical') {
    return 'app-role-pill is-red'
  }

  if (urgency === 'high') {
    return 'app-role-pill is-orange'
  }

  if (urgency === 'none') {
    return 'app-role-pill is-gray'
  }

  return 'app-role-pill'
}

function formatSalesMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value)
  if (!match) {
    return value
  }

  return salesMonth.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
}

async function exportRowsToXlsx(
  rows: ReorderSuggestion[],
  lens: Lens,
  t: (key: string) => string,
  orderQty: (row: ReorderSuggestion) => number,
) {
  try {
    const XLSX = await import('xlsx')
    const data = rows.map((row) => {
      const q = orderQty(row)

      return {
        [t('Терміновість')]: row.urgency,
        [t('Код')]: row.vendor_code ?? '',
        [t('Назва')]: row.product_name ?? `#${row.product_id}`,
        OE: row.oe_number ?? '',
        [t('Виробник')]: row.producer_name ?? `#${row.producer_id}`,
        [t('Квадрант')]: row.quadrant ?? '',
        [t('Наявність')]: row.inventory.on_hand,
        [t('Позиція')]: row.inventory.position,
        [t('Днів покриття')]: row.days_of_cover >= 9999 ? '' : row.days_of_cover,
        [t('Замовити')]: q,
        [t('Ціна од., EUR')]: row.unit_cost_eur ?? '',
        [t('Сума, EUR')]: Math.round((row.unit_cost_eur ?? 0) * q * 100) / 100,
        [t('Маржа од., EUR')]: row.unit_margin_eur ?? '',
      }
    })
    const sheet = XLSX.utils.json_to_sheet(data)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, lens === 'warehouse' ? 'Склад' : 'Виробник')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(book, `procurement-${lens}-${stamp}.xlsx`)
  } catch {
    notifications.show({ color: 'red', message: t('Не вдалося сформувати Excel') })
  }
}

export function ProcurementConstructor() {
  const { t } = useI18n()
  const [lens, setLens] = useState<Lens>('warehouse')
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const [producers, setProducers] = useState<Client[]>([])
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null)

  const [rows, setRows] = useState<ReorderSuggestion[]>([])
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [charts, setCharts] = useState<ProcurementCharts | null>(null)
  const [isAnalyticsOpen, setAnalyticsOpen] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const [basket, setBasket] = useState<Map<string, BasketLine>>(new Map())
  const [creatingProducer, setCreatingProducer] = useState<number | null>(null)
  // Composite producer_id + product_id keys keep alternatives independent.
  const [draftQty, setDraftQty] = useState<ProcurementDraftQuantities>({})
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  const orderQtyFor = useCallback(
    (row: ReorderSuggestion) => getProcurementOrderQuantity(draftQty, row),
    [draftQty],
  )
  const isQtyAdjusted = useCallback((row: ReorderSuggestion) => {
    const draftValue = getProcurementDraftQuantity(draftQty, row)

    return draftValue !== undefined && draftValue !== row.suggested_qty
  }, [draftQty])
  const isInBasket = useCallback(
    (row: ReorderSuggestion) => basket.has(procurementLineKey(row)),
    [basket],
  )

  const [sessions, setSessions] = useState<ProcurementSession[]>(() => listSessions())

  function persistSession() {
    const name = window.prompt(t('Назва сесії'))?.trim()
    if (!name) {
      return
    }
    saveSession({
      name,
      lens,
      producerId: selectedProducerId,
      draftQty,
      basket: [...basket.values()],
    })
    setSessions(listSessions())
    notifications.show({ color: 'green', message: t('Сесію збережено') })
  }

  function restoreSession(id: string) {
    const session = sessions.find((item) => item.id === id)
    if (!session) {
      return
    }
    setLens(session.lens)
    setSelectedProducerId(session.producerId)
    setDraftQty(session.draftQty ?? {})
    setBasket(
      new Map(
        session.basket.map((line) => [procurementLineKey(line.suggestion), line]),
      ),
    )
    notifications.show({ color: 'blue', message: `${t('Відновлено')}: ${session.name}` })
  }

  function deleteSession(id: string) {
    removeSession(id)
    setSessions(listSessions())
  }

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

  const producerOptions = useMemo(
    () =>
      producers.map((producer) => ({
        value: String(producer.Id),
        label: producer.Name || producer.FullName || `#${producer.Id}`,
      })),
    [producers],
  )

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

      // Charts feed only the optional demand sparkline; the KPI/donut/bars overview is
      // computed client-side from the plan rows. Fetch charts only in the producer lens
      // (scoped, cheap) — the all-producer charts build is ~60s cold and would block.
      if (producerId) {
        getProcurementCharts({ producerId }, signal)
          .then((data) => {
            if (!signal.aborted) {
              setCharts(data)
            }
          })
          .catch(() => undefined)
      } else {
        setCharts(null)
      }
    },
    [lens, selectedProducerId, t],
  )

  useEffect(() => {
    const controller = new AbortController()
    const loadTimer = window.setTimeout(() => loadRows(controller.signal), 0)

    return () => {
      window.clearTimeout(loadTimer)
      controller.abort()
    }
  }, [loadRows, reloadKey])

  const sortedRows = useMemo(
    () =>
      rows.toSorted(
        (a, b) =>
          URGENCY_META[a.urgency].order - URGENCY_META[b.urgency].order ||
          (b.line_cost_eur ?? 0) - (a.line_cost_eur ?? 0),
      ),
    [rows],
  )

  const visibleRows = useMemo(
    () => filterProcurementRows(sortedRows, deferredSearchQuery),
    [deferredSearchQuery, sortedRows],
  )
  const overview = useMemo(() => computeOverview(visibleRows), [visibleRows])
  const urgentRowsToAdd = useMemo(
    () =>
      visibleRows.filter(
        (row) =>
          (row.urgency === 'critical' || row.urgency === 'high') &&
          !basket.has(procurementLineKey(row)) &&
          getProcurementOrderQuantity(draftQty, row) > 0,
      ),
    [basket, draftQty, visibleRows],
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

  const addToBasket = useCallback((suggestion: ReorderSuggestion, quantity?: number) => {
    setBasket((previous) => {
      const next = new Map(previous)
      const lineKey = procurementLineKey(suggestion)
      next.set(lineKey, {
        suggestion,
        qty: quantity ?? previous.get(lineKey)?.qty ?? suggestion.suggested_qty,
      })

      return next
    })
  }, [])

  function addAllCritical() {
    setBasket((previous) => {
      const next = new Map(previous)
      urgentRowsToAdd.forEach((row) =>
        next.set(procurementLineKey(row), {
          suggestion: row,
          qty: getProcurementOrderQuantity(draftQty, row),
        }),
      )

      return next
    })
    notifications.show({
      color: 'blue',
      message: t('Додано {n} позицій у кошик').replace(
        '{n}',
        String(urgentRowsToAdd.length),
      ),
    })
  }

  const setBasketQty = useCallback((lineKey: string, value: number) => {
    setBasket((previous) => {
      const line = previous.get(lineKey)
      if (!line) {
        return previous
      }

      const next = new Map(previous)
      if (value <= 0) {
        next.delete(lineKey)
      } else {
        next.set(lineKey, { ...line, qty: value })
      }

      return next
    })
  }, [])

  const setDraftQtyFor = useCallback(
    (row: ReorderSuggestion, value: number) => {
      const lineKey = procurementLineKey(row)
      setDraftQty((current) => ({ ...current, [lineKey]: value }))
      setBasket((previous) => {
        if (!previous.has(lineKey)) {
          return previous
        }
        const next = new Map(previous)
        const line = next.get(lineKey) as BasketLine
        if (value <= 0) {
          next.delete(lineKey)
        } else {
          next.set(lineKey, { ...line, qty: value })
        }

        return next
      })
    },
    [],
  )

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
        lines.forEach((line) => next.delete(procurementLineKey(line.suggestion)))

        return next
      })
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити чернетку') })
    } finally {
      setCreatingProducer(null)
    }
  }

  const basketCount = basket.size
  const emptyState = getCockpitEmptyState({
    hasSearch: deferredSearchQuery.trim().length > 0,
    isLoading,
    lens,
    selectedProducerId,
    t,
  })
  const planColumns = usePlanColumns({
    isInBasket,
    isQtyAdjusted,
    lens,
    onAddToBasket: addToBasket,
    onDraftQtyChange: setDraftQtyFor,
    orderQtyFor,
    t,
  })
  const renderProofPanel = useCallback(
    (row: ReorderSuggestion) => (
      <ProcurementProofPanel
        demand={demandByProduct.get(row.product_id)}
        row={row}
        selectedQty={orderQtyFor(row)}
        t={t}
      />
    ),
    [demandByProduct, orderQtyFor, t],
  )

  return (
    <div className="procure-cockpit">
      <Card className="app-data-card basket-supply-primary-card" padding={0} radius="md" withBorder>
        <div className="app-filter-bar procure-cockpit-bar">
          <div className="app-filter-field procure-cockpit-bar__lens">
            <Text className="app-filter-label">{t('План закупівлі')}</Text>
            <SegmentedControl
              color="orange"
              data={[
                { label: t('Увесь склад'), value: 'warehouse' },
                { label: t('За виробником'), value: 'producer' },
              ]}
              value={lens}
              onChange={(value) => setLens(value as Lens)}
            />
          </div>
          <TextInput
            aria-label={t('Пошук у плані')}
            label={t('Пошук у плані')}
            leftSection={<Search size={15} />}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder={t('Товар, код або виробник')}
            value={searchQuery}
            w={250}
          />
          {lens === 'producer' && (
            <Select
              clearable
              data={producerOptions}
              label={t('Виробник')}
              placeholder={t('Оберіть виробника')}
              searchable
              value={selectedProducerId}
              w={300}
              onChange={setSelectedProducerId}
            />
          )}

          <div className="app-filter-actions procure-cockpit-bar__actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                size={34}
                variant="light"
                onClick={() => {
                  setLens('warehouse')
                  setSelectedProducerId(null)
                  setSearchQuery('')
                }}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={34}
                variant="light"
                onClick={() => reload()}
              >
                <RefreshCw size={17} />
              </ActionIcon>
            </Tooltip>
            <Menu position="bottom-end" shadow="md" width={280}>
              <Menu.Target>
                <Button leftSection={<Bookmark size={15} />} variant="default">
                  {t('Сесії')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<Save size={14} />} onClick={persistSession}>
                  {t('Зберегти поточний стан')}
                </Menu.Item>
                {sessions.length > 0 && <Menu.Divider />}
                {sessions.map((session) => (
                  <Menu.Item
                    key={session.id}
                    rightSection={
                      <ActionIcon
                        color="red"
                        component="div"
                        size="sm"
                        variant="subtle"
                        onClick={(event) => {
                          event.stopPropagation()
                          deleteSession(session.id)
                        }}
                      >
                        <Trash2 size={13} />
                      </ActionIcon>
                    }
                    onClick={() => restoreSession(session.id)}
                  >
                    <Text size="sm" truncate>
                      {session.name}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {new Date(session.savedAt).toLocaleString('uk-UA')} · {session.basket.length} {t('поз.')}
                    </Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Tooltip label={t('Експорт в Excel')}>
              <ActionIcon
                aria-label={t('Експорт в Excel')}
                disabled={visibleRows.length === 0}
                size={34}
                variant="default"
                onClick={() => void exportRowsToXlsx(visibleRows, lens, t, orderQtyFor)}
              >
                <ExcelIcon size={22} />
              </ActionIcon>
            </Tooltip>
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={urgentRowsToAdd.length === 0}
            leftSection={<Sparkles size={15} />}
            onClick={addAllCritical}
          >
            {t('Термінові в кошик')} · {qty.format(urgentRowsToAdd.length)}
          </Button>
        </div>

        {error && (
          <Alert className="procure-cockpit__alert" color="red" icon={<CircleAlert size={16} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="procure-cockpit__overview">
          <div className="procure-cockpit__metrics">
            <div className="procure-metric">
              <span>{t('Позицій до замовлення')}</span>
              <strong>{qty.format(overview.count)}</strong>
            </div>
            <div className={`procure-metric${overview.criticalCount > 0 ? ' is-critical' : ''}`}>
              <span>{t('Критичних')}</span>
              <strong>{qty.format(overview.criticalCount)}</strong>
            </div>
            <div className="procure-metric">
              <span>{t('Сума потреби, EUR')}</span>
              <strong>{amount.format(overview.totalValue)}</strong>
            </div>
            <div className="procure-metric">
              <span>{t('Під ризиком, EUR')}</span>
              <strong>{amount.format(overview.valueAtRisk)}</strong>
            </div>
          </div>
          {visibleRows.length > 0 ? (
            <Button
              color="orange"
              rightSection={isAnalyticsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              size="xs"
              variant="subtle"
              onClick={() => setAnalyticsOpen((open) => !open)}
            >
              {t('Аналітика')}
            </Button>
          ) : (
            <Badge className={`app-role-pill ${emptyState.pillClass}`} variant="light">
              {emptyState.status}
            </Badge>
          )}
        </div>

        <Collapse expanded={isAnalyticsOpen}>
          <div className="procure-cockpit__charts">
            <OverviewCharts overview={overview} t={t} />
          </div>
        </Collapse>

        <div className="procure-cockpit__workspace">
          <div className="procure-cockpit__table">
            <DataTable
              columns={planColumns}
              data={visibleRows}
              defaultLayout={PLAN_TABLE_DEFAULT_LAYOUT}
              emptyText={
                <ProcurementWorkspaceState
                  description={emptyState.description}
                  isLoading={isLoading}
                  title={emptyState.title}
                />
              }
              fillAvailableWidth
              getRowId={procurementLineKey}
              height="100%"
              isLoading={isLoading}
              layoutVersion={4}
              loadingText={t('Розрахунок потреби…')}
              minWidth={1420}
              renderExpandedRow={renderProofPanel}
              showLayoutControls
              tableId="procure-cockpit-plan"
              toolbarPortalTarget={tableToolbarSlot}
            />
          </div>

          {basketCount > 0 && (
            <aside className="procure-cockpit__basket">
              <div className="procure-cockpit__basket-head">
                <Text className="app-section-title" fw={600} size="sm">
                  {t('Замовлення')}
                </Text>
                <Badge className="app-role-pill is-orange" variant="light">
                  {basketCount}
                </Badge>
              </div>
              <div className="procure-cockpit__basket-body">
                <Stack gap={10}>
                  {basketByProducer.map((group) => (
                    <Box key={group.producerId} className="procure-cockpit__basket-group">
                      <Group justify="space-between" mb={4} wrap="nowrap">
                        <Text fw={600} size="xs" title={group.name} truncate>
                          {group.name}
                        </Text>
                        <Text c="dimmed" size="xs">
                          {amount.format(group.total)} EUR
                        </Text>
                      </Group>
                      <Stack gap={3}>
                        {group.lines.map((line) => {
                          const lineKey = procurementLineKey(line.suggestion)
                          const lineName =
                            line.suggestion.vendor_code ||
                            line.suggestion.product_name ||
                            `#${line.suggestion.product_id}`

                          return (
                            <Group key={lineKey} gap={4} wrap="nowrap">
                              <Text
                                size="xs"
                                style={{ flex: 1 }}
                                title={line.suggestion.product_name ?? ''}
                                truncate
                              >
                                {lineName}
                              </Text>
                              <NumberInput
                                aria-label={`${t('Кількість')} ${lineName}`}
                                hideControls
                                min={0}
                                size="xs"
                                value={line.qty}
                                w={72}
                                onChange={(value) =>
                                  setBasketQty(lineKey, Number(value) || 0)
                                }
                              />
                              <ActionIcon
                                aria-label={`${t('Видалити')} ${lineName}`}
                                color="red"
                                size="sm"
                                variant="subtle"
                                onClick={() => setBasketQty(lineKey, 0)}
                              >
                                <Trash2 size={14} />
                              </ActionIcon>
                            </Group>
                          )
                        })}
                      </Stack>
                      <Button
                        color={CREATE_ACTION_COLOR}
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
              </div>
            </aside>
          )}
        </div>
      </Card>
    </div>
  )
}

function getCockpitEmptyState({
  hasSearch,
  isLoading,
  lens,
  selectedProducerId,
  t,
}: {
  hasSearch: boolean
  isLoading: boolean
  lens: Lens
  selectedProducerId: string | null
  t: (key: string) => string
}) {
  if (isLoading) {
    return {
      description: t('Зіставляємо прогноз попиту, залишки та правила закупівлі.'),
      pillClass: 'is-gray',
      status: t('Розрахунок'),
      title: t('Розраховуємо потребу'),
    }
  }

  if (hasSearch) {
    return {
      description: t('Змініть пошуковий запит або скиньте фільтри, щоб повернути весь план.'),
      pillClass: 'is-gray',
      status: t('Немає збігів'),
      title: t('За цим запитом нічого не знайдено'),
    }
  }

  if (lens === 'producer' && !selectedProducerId) {
    return {
      description: t('Виберіть виробника у фільтр-барі — таблиця покаже його потребу та рекомендовану кількість.'),
      pillClass: 'is-gray',
      status: t('Потрібен виробник'),
      title: t('Оберіть виробника'),
    }
  }

  return {
    description: t('Критичних дефіцитів немає: поточні залишки покривають розраховану потребу.'),
    pillClass: 'is-green',
    status: t('Запас покрито'),
    title: t('Позицій до замовлення немає'),
  }
}

function usePlanColumns({
  isInBasket,
  isQtyAdjusted,
  lens,
  onAddToBasket,
  onDraftQtyChange,
  orderQtyFor,
  t,
}: {
  isInBasket: (row: ReorderSuggestion) => boolean
  isQtyAdjusted: (row: ReorderSuggestion) => boolean
  lens: Lens
  onAddToBasket: (row: ReorderSuggestion, quantity?: number) => void
  onDraftQtyChange: (row: ReorderSuggestion, value: number) => void
  orderQtyFor: (row: ReorderSuggestion) => number
  t: (key: string) => string
}) {
  return useMemo<Array<DataTableColumn<ReorderSuggestion>>>(
    () => [
      {
        id: 'product',
        header: t('Товар'),
        accessor: (row) => row.product_name || `#${row.product_id}`,
        cell: (row) => <ProcurementProductCell row={row} t={t} />,
        enableHiding: false,
        fill: true,
        minWidth: 280,
      },
      {
        id: 'urgency',
        header: t('Терміновість'),
        accessor: (row) => URGENCY_META[row.urgency].order,
        cell: (row) => {
          const meta = URGENCY_META[row.urgency]

          return (
            <Badge className={urgencyPillClass(row.urgency)} size="sm" variant="light">
              {t(meta.label)}
            </Badge>
          )
        },
        width: 140,
      },
      {
        id: 'quadrant',
        header: t('Квадрант'),
        accessor: (row) => row.quadrant ?? '',
        cell: (row) =>
          row.quadrant ? (
            <Badge
              className="app-role-pill is-gray"
              size="sm"
              title={quadrantHint(row.quadrant, t)}
              variant="light"
            >
              {row.quadrant}
            </Badge>
          ) : null,
        width: 112,
      },
      ...(lens === 'warehouse'
        ? [
            {
              id: 'producer',
              header: t('Виробник'),
              accessor: (row) => row.producer_name || `#${row.producer_id}`,
              cell: (row) => <ProcurementProducerCell row={row} />,
              minWidth: 150,
              width: 172,
            } satisfies DataTableColumn<ReorderSuggestion>,
          ]
        : []),
      {
        id: 'onHand',
        header: t('На складі'),
        accessor: (row) => row.inventory.on_hand,
        cell: (row) => (
          <ProcurementNumberCell
            metaLabel={t('доступно')}
            metaValue={qty.format(row.inventory.available)}
            title={[
              `${t('На складі')}: ${qty.format(row.inventory.on_hand)}`,
              `${t('Доступно')}: ${qty.format(row.inventory.available)}`,
              `${t('У резерві')}: ${qty.format(row.inventory.reserved)}`,
              `${t('У дорозі')}: ${qty.format(row.inventory.on_order)}`,
            ].join(' · ')}
            value={qty.format(row.inventory.on_hand)}
          />
        ),
        align: 'right',
        width: 124,
      },
      {
        id: 'position',
        header: t('Позиція'),
        accessor: (row) => row.inventory.position,
        cell: (row) => <ProcurementNumberCell value={qty.format(row.inventory.position)} />,
        align: 'right',
        width: 112,
      },
      {
        id: 'reserved',
        header: t('Резерв'),
        accessor: (row) => row.inventory.reserved,
        cell: (row) => <ProcurementNumberCell value={qty.format(row.inventory.reserved)} />,
        align: 'right',
        width: 104,
      },
      {
        id: 'onOrder',
        header: t('У дорозі'),
        accessor: (row) => row.inventory.on_order,
        cell: (row) => <ProcurementNumberCell value={qty.format(row.inventory.on_order)} />,
        align: 'right',
        width: 112,
      },
      {
        id: 'cover',
        header: t('Покриття'),
        accessor: (row) => row.days_of_cover,
        cell: (row) => (
          <ProcurementNumberCell
            metaLabel={row.days_of_cover >= 9999 ? undefined : t('днів')}
            value={row.days_of_cover >= 9999 ? '∞' : qty.format(row.days_of_cover)}
          />
        ),
        align: 'right',
        width: 120,
      },
      {
        id: 'reorderPoint',
        header: t('Точка замовлення'),
        accessor: (row) => row.reorder_point,
        cell: (row) => <ProcurementNumberCell value={qty.format(row.reorder_point)} />,
        align: 'right',
        width: 168,
      },
      {
        id: 'moq',
        header: 'MOQ',
        accessor: (row) => row.moq,
        cell: (row) => row.moq === null ? null : <ProcurementNumberCell value={qty.format(row.moq)} />,
        align: 'right',
        width: 96,
      },
      {
        id: 'orderQty',
        header: t('Замовити'),
        accessor: (row) => orderQtyFor(row),
        cell: (row) => (
          <Box>
            <NumberInput
              aria-label={t('Замовити')}
              hideControls
              min={0}
              size="xs"
              className="procure-table-qty-input"
              styles={{ input: { textAlign: 'right' } }}
              value={orderQtyFor(row)}
              w={82}
              onChange={(value) => onDraftQtyChange(row, Number(value) || 0)}
            />
            {isQtyAdjusted(row) && (
              <Text c="dimmed" size="xs">
                {t('AI')}: {qty.format(row.suggested_qty)}
              </Text>
            )}
          </Box>
        ),
        align: 'right',
        enableSorting: false,
        width: 118,
      },
      {
        id: 'unitCost',
        header: t('Ціна, EUR'),
        accessor: (row) => row.unit_cost_eur,
        cell: (row) => <ProcurementMoneyCell value={row.unit_cost_eur} />,
        align: 'right',
        width: 128,
      },
      {
        id: 'lineCost',
        header: t('Сума, EUR'),
        accessor: (row) => row.unit_cost_eur === null ? null : row.unit_cost_eur * orderQtyFor(row),
        cell: (row) => (
          <ProcurementMoneyCell
            value={row.unit_cost_eur === null ? null : row.unit_cost_eur * orderQtyFor(row)}
          />
        ),
        align: 'right',
        width: 126,
      },
      {
        id: 'margin',
        header: t('Маржа, EUR'),
        accessor: (row) => row.unit_margin_eur,
        cell: (row) => <ProcurementMoneyCell value={row.unit_margin_eur} />,
        align: 'right',
        width: 136,
      },
      {
        id: 'actions',
        header: '',
        cell: (row) => {
          const inBasket = isInBasket(row)

          return (
            <TableRowAction
              action="add"
              label={inBasket ? t('У кошику') : t('Додати в кошик')}
              tone={inBasket ? 'success' : 'brand'}
              onClick={() => onAddToBasket(row, orderQtyFor(row))}
            />
          )
        },
        align: 'center',
        enableHiding: false,
        enableSorting: false,
        width: 56,
      },
    ],
    [
      isInBasket,
      isQtyAdjusted,
      lens,
      onAddToBasket,
      onDraftQtyChange,
      orderQtyFor,
      t,
    ],
  )
}

function ProcurementProducerCell({ row }: { row: ReorderSuggestion }) {
  const producerName = row.producer_name?.trim()

  return (
    <span className="procure-table-entity-cell">
      <span
        className={`procure-table-entity-cell__primary${producerName ? '' : ' is-code'}`}
        title={producerName || `#${row.producer_id}`}
      >
        {producerName || `#${row.producer_id}`}
      </span>
      {producerName && (
        <span className="procure-table-entity-cell__meta">
          <span>ID</span>
          <strong>{row.producer_id}</strong>
        </span>
      )}
    </span>
  )
}

function ProcurementNumberCell({
  value,
  metaLabel,
  metaValue,
  title,
}: {
  value: string
  metaLabel?: string
  metaValue?: string
  title?: string
}) {
  return (
    <span className="procure-table-value" title={title}>
      <span className="procure-table-value__primary">{value}</span>
      {metaLabel && (
        <span className="procure-table-value__meta">
          <span>{metaLabel}</span>
          {metaValue && <strong>{metaValue}</strong>}
        </span>
      )}
    </span>
  )
}

function ProcurementMoneyCell({ value }: { value: number | null }) {
  if (value === null) {
    return null
  }

  return (
    <span className="procure-table-money">
      <span className="app-money">{amount.format(value)}</span>
      <span className="app-money-meta">EUR</span>
    </span>
  )
}

export function ProcurementProofPanel({
  row,
  demand,
  selectedQty,
  t,
}: {
  demand?: number[]
  row: ReorderSuggestion
  selectedQty: number
  t: (key: string) => string
}) {
  // Lazy per-product monthly sales history — fetched when the row is expanded.
  const [history, setHistory] = useState<ProductSalesSeriesPoint[] | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    getProductAnalytics(row.product_id, undefined, 12)
      .then((data) => {
        if (!cancelled) {
          setHistory(data.sales_series ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [row.product_id])

  const decision = calculateProcurementDecision(row, selectedQty)
  const isAdjusted = selectedQty !== row.suggested_qty
  const productName = row.product_name || row.vendor_code || `#${row.product_id}`

  return (
    <article className="procure-proof">
      <header className="procure-proof__header">
        <div className="procure-proof__heading">
          <span className="procure-proof__icon" aria-hidden="true">
            <PackageCheck size={18} strokeWidth={1.7} />
          </span>
          <div className="procure-proof__heading-copy">
            <span className="procure-proof__eyebrow">{t('Рекомендація закупівлі')}</span>
            <strong className="procure-proof__title" title={productName}>
              {productName}
            </strong>
            <span className="procure-proof__summary">
              {decisionSummary(row, decision, t)}
            </span>
          </div>
        </div>

        <div className="procure-proof__decision">
          <div className="procure-proof__pills">
            <Badge className={urgencyPillClass(row.urgency)} variant="light">
              {t(URGENCY_META[row.urgency].label)}
            </Badge>
            {row.quadrant && (
              <Badge className="app-role-pill is-gray" variant="light">
                {row.quadrant}
              </Badge>
            )}
            {isAdjusted && (
              <Badge className="app-role-pill is-yellow" variant="light">
                {t('Змінено вручну')}
              </Badge>
            )}
          </div>
          <div className="procure-proof__order-qty">
            <span>{t('До замовлення')}</span>
            <strong>
              {qty.format(selectedQty)} <small>{t('шт.')}</small>
            </strong>
            {isAdjusted && (
              <small>
                {t('Рекомендація AI')}: {qty.format(row.suggested_qty)}
              </small>
            )}
          </div>
        </div>
      </header>

      <div className="procure-proof__metrics">
        <DecisionMetric
          label={t('Позиція зараз')}
          note={`${qty.format(row.inventory.on_hand)} − ${qty.format(row.inventory.reserved)} + ${qty.format(row.inventory.on_order)}`}
          value={qty.format(row.inventory.position)}
        />
        <DecisionMetric
          label={t('Точка замовлення')}
          note={`${t('Попит у поставці')} + ${t('страховий запас')}`}
          value={qty.format(row.reorder_point)}
        />
        <DecisionMetric
          label={t('Цільовий рівень')}
          note={t('Запас після планового поповнення')}
          value={qty.format(decision.orderUpTo)}
        />
        <DecisionMetric
          label={t('Сума партії')}
          note={decision.selectedCostEur !== null ? 'EUR' : ''}
          value={decision.selectedCostEur !== null ? amount.format(decision.selectedCostEur) : ''}
        />
      </div>

      <div className="procure-proof__main">
        <section className="procure-proof__section">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Як отримано кількість')}
          </Text>
          <div
            aria-label={`${t('Цільовий рівень')} ${qty.format(decision.orderUpTo)}, ${t('мінус позиція зараз')} ${qty.format(row.inventory.position)}, ${t('дорівнює рекомендація')} ${qty.format(row.suggested_qty)}`}
            className="procure-proof__equation"
            role="img"
          >
            <EquationTerm
              label={t('Цільовий рівень')}
              value={qty.format(decision.orderUpTo)}
            />
            <span className="procure-proof__operator">−</span>
            <EquationTerm
              label={t('Позиція зараз')}
              value={qty.format(row.inventory.position)}
            />
            <span className="procure-proof__operator">=</span>
            <EquationTerm
              accent
              label={t('Рекомендація')}
              value={qty.format(row.suggested_qty)}
            />
          </div>
          <div className="procure-proof__facts">
            <ProofFact label={t('На складі')} value={qty.format(row.inventory.on_hand)} />
            <ProofFact label={t('У резерві')} value={qty.format(row.inventory.reserved)} />
            <ProofFact label={t('У дорозі')} value={qty.format(row.inventory.on_order)} />
            <ProofFact label={t('Попит на час поставки')} value={qty.format(decision.leadDemand)} />
            <ProofFact label={t('Страховий запас')} value={qty.format(row.safety_stock)} />
            <ProofFact
              label={t('Позиція з обраною партією')}
              value={qty.format(decision.arrivalPosition)}
            />
          </div>
          {isAdjusted && (
            <p className="procure-proof__manual-note">
              {t('У полі «Замовити» встановлено')} {qty.format(selectedQty)} {t('шт.')} ·{' '}
              {t('базова рекомендація')} {qty.format(row.suggested_qty)} {t('шт.')}
            </p>
          )}
        </section>

        <section className="procure-proof__section is-risk">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Коли виникне дефіцит')}
          </Text>
          <DepletionChart decision={decision} row={row} t={t} />
        </section>
      </div>

      <div className="procure-proof__details">
        <section className="procure-proof__section is-history">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Продажі за 12 місяців')}
          </Text>
          {history === 'loading' ? (
            <div className="procure-proof__loading">
              <Loader size="xs" />
              <span>{t('Завантаження історії…')}</span>
            </div>
          ) : history.length === 0 ? (
            <p className="procure-proof__empty">{t('За цей період продажів немає')}</p>
          ) : (
            <div className="procure-proof-history-wrap">
              <table className="procure-proof-history">
                <thead>
                  <tr>
                    <th>{t('Місяць')}</th>
                    <th>{t('Продано, шт.')}</th>
                    <th>{t('Виручка, EUR')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((point) => (
                    <tr key={point.month}>
                      <td>
                        {formatSalesMonth(point.month)}
                        {!point.is_complete && (
                          <span className="procure-proof-history__current">
                            {t('поточний')}
                          </span>
                        )}
                      </td>
                      <td>{qty.format(point.units)}</td>
                      <td>{amount.format(point.revenue_eur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="procure-proof__section is-forecast">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Параметри прогнозу')}
          </Text>
          <div className="procure-proof__forecast-facts">
            <ProofFact
              label={t('Середній попит')}
              value={`${amount.format(row.forecast.mean_daily)} ${t('шт./день')}`}
            />
            <ProofFact
              label={t('Коливання попиту')}
              value={`± ${amount.format(row.forecast.std_daily)}`}
            />
            <ProofFact
              label={t('Горизонт прогнозу')}
              value={`${qty.format(row.forecast.horizon_days)} ${t('дн.')}`}
            />
            <ProofFact
              label={t('Рівень сервісу')}
              value={row.applied_service_level ? `${(row.applied_service_level * 100).toFixed(1)}%` : ''}
            />
            <ProofFact label={t('Метод прогнозу')} value={row.forecast.method} />
            <ProofFact
              label={t('Маржа на одиницю')}
              value={row.unit_margin_eur !== null ? `${amount.format(row.unit_margin_eur)} EUR` : ''}
            />
          </div>
          {demand && demand.length > 0 && (
            <div className="procure-proof__demand">
              <span>{t('Динаміка попиту')}</span>
              <Sparkline values={demand} />
            </div>
          )}
          {row.cheaper_alt && (
            <p className="procure-proof__alternative">
              {t('Є дешевша альтернатива у виробника')} №{row.cheaper_alt.producer_id}:{' '}
              <strong>{amount.format(row.cheaper_alt.cost_eur)} EUR</strong>
            </p>
          )}
        </section>
      </div>
    </article>
  )
}

function DecisionMetric({ label, note, value }: { label: string; note: string; value: string }) {
  return (
    <div className="procure-proof__metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

function decisionSummary(
  row: ReorderSuggestion,
  decision: ProcurementDecision,
  t: (key: string) => string,
): string {
  if (row.inventory.position <= 0) {
    return t('Доступний запас уже вичерпано — позицію потрібно додати в найближче замовлення.')
  }

  if (decision.isArrivalRisk) {
    return t('Запас може закінчитися раніше, ніж прибуде нова партія — замовляти потрібно зараз.')
  }

  if (row.inventory.position <= row.reorder_point) {
    return t('Позиція запасу вже нижче точки замовлення — поповнення потрібне за поточним планом.')
  }

  return t('Рекомендація підтримує цільовий запас на прогнозований горизонт продажів.')
}

function ProofFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="procure-proof__fact">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  )
}

function EquationTerm({
  accent = false,
  label,
  value,
}: {
  accent?: boolean
  label: string
  value: string
}) {
  return (
    <div className={`procure-proof__equation-term${accent ? ' is-accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)

  return (
    <div className="procure-proof__sparkline" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={index}
          style={{
            height: `${Math.max(3, (value / max) * 100)}%`,
          }}
          title={String(value)}
        />
      ))}
    </div>
  )
}

type Overview = {
  count: number
  criticalCount: number
  totalValue: number
  valueAtRisk: number
  urgencyDonut: Array<{ name: string; value: number; color: string }>
  coverHist: Array<{ bucket: string; count: number }>
  producerValue: Array<{ producer: string; value: number }>
}

function computeOverview(rows: ReorderSuggestion[]): Overview {
  const urgencyCounts: Record<string, number> = {}
  const coverBuckets = { '<0': 0, '0-7': 0, '8-30': 0, '31-90': 0, '90+': 0 }
  const producerTotals = new Map<string, number>()
  let totalValue = 0
  let valueAtRisk = 0
  let criticalCount = 0

  rows.forEach((row) => {
    urgencyCounts[row.urgency] = (urgencyCounts[row.urgency] ?? 0) + 1
    const value = row.line_cost_eur ?? 0
    totalValue += value
    if (row.urgency === 'critical' || row.urgency === 'high') {
      valueAtRisk += value
    }
    if (row.urgency === 'critical') {
      criticalCount += 1
    }
    const cover = row.days_of_cover
    if (cover <= 0) {
      coverBuckets['<0'] += 1
    } else if (cover <= 7) {
      coverBuckets['0-7'] += 1
    } else if (cover <= 30) {
      coverBuckets['8-30'] += 1
    } else if (cover <= 90) {
      coverBuckets['31-90'] += 1
    } else {
      coverBuckets['90+'] += 1
    }
    const producer = row.producer_name || `#${row.producer_id}`
    producerTotals.set(producer, (producerTotals.get(producer) ?? 0) + value)
  })

  const urgencyDonut = (['critical', 'high', 'normal', 'none'] as ProcurementUrgency[])
    .filter((urgency) => urgencyCounts[urgency])
    .map((urgency) => ({
      name: URGENCY_META[urgency].label,
      value: urgencyCounts[urgency],
      color: `${URGENCY_META[urgency].color}.5`,
    }))

  const producerValue = [...producerTotals.entries()]
    .map(([producer, value]) => ({ producer, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return {
    count: rows.length,
    criticalCount,
    totalValue,
    valueAtRisk,
    urgencyDonut,
    coverHist: Object.entries(coverBuckets).map(([bucket, count]) => ({ bucket, count })),
    producerValue,
  }
}

function OverviewCharts({ overview, t }: { overview: Overview; t: (key: string) => string }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing={10}>
      <Card padding="sm" radius="md" withBorder>
        <Text c="dimmed" mb={6} size="xs">
          {t('Терміновість позицій')}
        </Text>
        {overview.urgencyDonut.length > 0 ? (
          <Group justify="center">
            <DonutChart
              chartLabel={String(overview.count)}
              data={overview.urgencyDonut}
              size={140}
              thickness={20}
              withTooltip
            />
          </Group>
        ) : null}
      </Card>

      <Card padding="sm" radius="md" withBorder>
        <Text c="dimmed" mb={6} size="xs">
          {t('Потреба €, топ виробників')}
        </Text>
        <BarChart
          data={overview.producerValue}
          dataKey="producer"
          h={150}
          series={[{ color: 'orange.6', name: 'value', label: t('EUR') }]}
          tickLine="none"
          valueFormatter={(value) => amount.format(value)}
          withXAxis={false}
        />
      </Card>

      <Card padding="sm" radius="md" withBorder>
        <Text c="dimmed" mb={6} size="xs">
          {t('Розподіл днів покриття')}
        </Text>
        <BarChart
          data={overview.coverHist}
          dataKey="bucket"
          h={150}
          series={[{ color: 'blue.5', name: 'count', label: t('Позицій') }]}
          tickLine="y"
        />
      </Card>
    </SimpleGrid>
  )
}

// Project the stock position declining at forecast demand to show WHEN it runs out
// and WHEN it crosses the reorder point — the visual proof that an order is due now.
function DepletionChart({
  decision,
  row,
  t,
}: {
  decision: ProcurementDecision
  row: ReorderSuggestion
  t: (key: string) => string
}) {
  const meanDaily = row.forecast.mean_daily
  if (meanDaily <= 0) {
    return (
      <p className="procure-proof__empty">
        {t('Недостатньо історії продажів, щоб спрогнозувати дату дефіциту.')}
      </p>
    )
  }

  const leadTimeDays = decision.leadTimeDays ?? 0
  const stockoutDay = decision.stockoutDays ?? 0
  const horizon = Math.max(stockoutDay + leadTimeDays + 7, 30)
  const step = Math.max(1, Math.round(horizon / 30))

  const data: Array<{ day: number; stock: number; reorder: number }> = []
  for (let day = 0; day <= horizon; day += step) {
    data.push({
      day,
      stock: Math.max(0, Math.round(row.inventory.position - meanDaily * day)),
      reorder: Math.round(row.reorder_point),
    })
  }

  return (
    <div className="procure-proof__depletion">
      <LineChart
        data={data}
        dataKey="day"
        h={168}
        series={[
          { color: 'blue.6', name: 'stock', label: t('Запас') },
          { color: 'orange.5', name: 'reorder', label: t('Точка замовлення') },
        ]}
        valueFormatter={(value) => qty.format(value)}
        withDots={false}
        xAxisLabel={t('дні')}
      />
      <div className={`procure-proof__risk-note${decision.isArrivalRisk ? ' is-danger' : ''}`}>
        <strong>
          {t('Запасу приблизно на')} {qty.format(stockoutDay)} {t('дн.')}
        </strong>
        <span>
          {t('Орієнтовний строк поставки')} — {qty.format(leadTimeDays)} {t('дн.')} ·{' '}
          {decision.isArrivalRisk
            ? t('партія може прибути після вичерпання запасу')
            : t('запас має покрити строк поставки')}
        </span>
      </div>
    </div>
  )
}
