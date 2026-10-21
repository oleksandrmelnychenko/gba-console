import { procurementBasketCost, procurementCostSnapshotKey } from '../procurementBasketCost'
import type { ProcurementSessionBasketLine } from '../procurementSessions'
import { formatUnitCost } from '../procurementMoneyFormat'
import { procurementLoadError } from '../procurementLoadError'
import type { ProcurementCostContext } from '../procurementCostTypes'
import { exactDisplayedLineAmount } from '../procurementDecimals'
import { ProcurementCostBadge } from './ProcurementCostProof'
import { BarChart, DonutChart } from '@mantine/charts'
import { MONEY_AXIS_TICK } from '../../../shared/ui/charts/chartTheme'
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Collapse,
  Group,
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
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useState,
} from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { AppBottomSheet } from '../../../shared/ui/AppBottomSheet'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout, DataTableSortingState } from '../../../shared/ui/data-table/types'
import { usePermissions } from '../../auth/usePermissions'
import { getPurchaseCockpitSuppliers } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { Client } from '../../supply-ukraine-orders/types'
import {
  listSessions,
  removeSession,
  saveSession,
  type ProcurementSession,
} from '../procurementSessions'
import {
  createCockpitDraftOrder,
  getPurchaseCockpitWarehousePlan,
  getProducerPlan,
} from '../api/procurementApi'
import {
  filterProcurementRows,
  getProcurementDraftQuantity,
  getProcurementOrderQuantity,
  procurementLineKey,
  type ProcurementDraftQuantities,
} from '../procurementConstructorModel'
import { procurementQuantityFormat as quantity } from '../procurementQuantityFormat'
import type { ProcurementUrgency, ReorderSuggestion } from '../procurementTypes'
import { ProcurementProductCell } from './ProcurementProductCell'
import { ProcurementWorkspaceState } from './ProcurementWorkspaceState'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'
import { clearProductAnalyticsResource } from './productAnalyticsResource'
import { ProcurementItemAnalytics, type ProcurementItemAnalyticsProps } from './ProcurementItemAnalytics'
import './procurement-constructor.css'

const PLAN_PAGE_SIZES = ['20', '50', '100']

type Lens = 'warehouse' | 'producer'

const amount = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const qty = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const URGENCY_META: Record<ProcurementUrgency, { color: string; label: string; order: number }> = {
  critical: { color: 'red', label: 'Критично', order: 0 },
  high: { color: 'orange', label: 'Скоро', order: 1 },
  normal: { color: 'blue', label: 'За планом', order: 2 },
  none: { color: 'gray', label: 'Достатньо', order: 3 },
}

type BasketLine = ProcurementSessionBasketLine

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
    quadrant: false,
    reorderPoint: false,
    reserved: false,
    unitCost: false,
  },
  density: 'normal',
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

function urgencyTone(urgency: ProcurementUrgency): TableChipTone {
  return urgency === 'critical' ? 'danger' : urgency === 'high' ? 'warning' : urgency === 'none' ? 'neutral' : 'document'
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
        [t('Оцінка одиниці, EUR')]: row.unit_cost_eur ?? '',
        [t('Покриття вартості')]: row.cost_provenance.coverage,
        [t('Джерело вартості')]: row.cost_provenance.source,
        [t('Основа вартості')]: row.cost_provenance.basis,
        [t('Придатна для бюджету')]: row.cost_provenance.budget_eligible,
        [t('Причини виключення з бюджету')]: row.cost_provenance.budget_exclusion_reasons.join('; '),
        [t('Оцінка рядка, EUR')]: row.unit_cost_eur === null ? '' : exactDisplayedLineAmount(row.unit_cost_eur, q) ?? '',
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
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return <Text c="dimmed">{t('Завантаження')}</Text>
  }

  if (!can(PermissionKeys.SystemPages.PurchaseCockpit.View)) {
    return (
      <Alert color="red" title={t('Доступ заборонено')} variant="light">
        {t('Недостатньо прав для перегляду панелі закупівель')}
      </Alert>
    )
  }

  return <ProcurementConstructorContent />
}

function ProcurementConstructorContent() {
  const { t } = useI18n()
  const { can } = usePermissions()
  const canCreateDraft = can(PermissionKeys.PurchaseCockpit.DraftOrder.Create)
  const canExport = can(PermissionKeys.PurchaseCockpit.Document.Export)
  const [initialFocus] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const positiveId = (name: string) => {
      const value = Number(params.get(name))
      return Number.isSafeInteger(value) && value > 0 ? String(value) : null
    }
    return { product: positiveId('productId'), producer: positiveId('producerId') }
  })
  const [lens, setLens] = useState<Lens>(initialFocus.producer ? 'producer' : 'warehouse')
  const [searchQuery, setSearchQuery] = useState(initialFocus.product ?? '')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const [producers, setProducers] = useState<Client[]>([])
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(initialFocus.producer)

  const [rows, setRows] = useState<ReorderSuggestion[]>([])
  const [costContext, setCostContext] = useState<ProcurementCostContext | null>(null)
  const costSnapshotKey = useMemo(() => procurementCostSnapshotKey(costContext), [costContext])
  const currentRowsByKey = useMemo(() => new Map(rows.map(row => [procurementLineKey(row), row])), [rows])
  const [isLoading, setLoading] = useState(true)
  const [hasLoadedPlan, setHasLoadedPlan] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAnalyticsOpen, setAnalyticsOpen] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const basketGroupsId = useId()
  const [collapsedProducers, setCollapsedProducers] = useState<Set<number>>(new Set())
  const [isBasketOpen, setBasketOpen] = useState(false)
  const [basket, setBasket] = useState<Map<string, BasketLine>>(new Map())
  const basketKeys = useMemo(() => JSON.stringify([...basket.keys()].sort()), [basket])
  const deferredBasketKeys = useDeferredValue(basketKeys)
  const basketMembership = useMemo(
    () => new Set<string>(JSON.parse(deferredBasketKeys) as string[]),
    [deferredBasketKeys],
  )
  const [creatingProducer, setCreatingProducer] = useState<number | null>(null)
  // Composite producer_id + product_id keys keep alternatives independent.
  const [draftQty, setDraftQty] = useState<ProcurementDraftQuantities>({})
  const [pageSize, setPageSize] = useState(50)
  const [pageSelection, setPageSelection] = useState<{ rows: ReorderSuggestion[] | null; page: number }>({ rows: null, page: 1 })
  const [planSorting, setPlanSorting] = useState<DataTableSortingState>([])
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
    (row: ReorderSuggestion) => basketMembership.has(procurementLineKey(row)),
    [basketMembership],
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
    setSearchQuery('')
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
    getPurchaseCockpitSuppliers()
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
      setHasLoadedPlan(false)
      setRows([])
      setCostContext(null)
      setError(null)
      const producerId = selectedProducerId ? Number(selectedProducerId) : null

      const plan =
        lens === 'warehouse'
          ? getPurchaseCockpitWarehousePlan({ budgetEur: 0, method: 'greedy' }, signal)
          : producerId
            ? getProducerPlan(producerId, undefined, signal)
            : Promise.resolve(null)

      plan
        .then((loaded) => {
          if (!signal.aborted) {
            setCostContext(loaded)
            setRows((loaded?.items ?? []).filter((item) => item.suggested_qty > 0))
            setHasLoadedPlan(true)
          }
        })
        .catch((loadError) => {
          if (!signal.aborted) {
            setError(procurementLoadError(loadError, t('Не вдалося завантажити план закупівлі'), t))
          }
        })
        .finally(() => {
          if (!signal.aborted) {
            setLoading(false)
          }
        })


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
    () => initialFocus.product && deferredSearchQuery === initialFocus.product
      ? sortedRows.filter((row) => row.product_id === Number(initialFocus.product))
      : filterProcurementRows(sortedRows, deferredSearchQuery),
    [deferredSearchQuery, initialFocus.product, sortedRows],
  )
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const currentPage = pageSelection.rows === visibleRows ? Math.min(pageSelection.page, totalPages) : 1
  const pagination = useMemo(() => ({ pageIndex: currentPage - 1, pageSize }), [currentPage, pageSize])
  const onPlanSortingChange = useCallback((sorting: DataTableSortingState) => {
    setPlanSorting(sorting)
    setPageSelection({ rows: visibleRows, page: 1 })
  }, [visibleRows])
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

  const addToBasket = useCallback((suggestion: ReorderSuggestion, quantity?: number) => {
    setCollapsedProducers((current) => {
      const next = new Set(current)
      next.delete(suggestion.producer_id)
      return next
    })
    setBasketOpen(true)
    setBasket((previous) => {
      const next = new Map(previous)
      const lineKey = procurementLineKey(suggestion)
      next.set(lineKey, {
        suggestion,
        costSnapshotKey: costSnapshotKey ?? undefined,
        qty: quantity ?? previous.get(lineKey)?.qty ?? suggestion.suggested_qty,
      })

      return next
    })
  }, [costSnapshotKey])

  function addAllCritical() {
    setBasket((previous) => {
      const next = new Map(previous)
      urgentRowsToAdd.forEach((row) =>
        next.set(procurementLineKey(row), {
          suggestion: row,
          costSnapshotKey: costSnapshotKey ?? undefined,
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
    const groups = new Map<
      number,
      { name: string; lines: BasketLine[]; total: number; unpricedCount: number }
    >()
    basket.forEach((line) => {
      const pid = line.suggestion.producer_id
      const group = groups.get(pid) ?? {
        name: line.suggestion.producer_name || `#${pid}`,
        lines: [],
        total: 0,
        unpricedCount: 0,
      }
      group.lines.push(line)
      const lineAmount = procurementBasketCost(line, currentRowsByKey.get(procurementLineKey(line.suggestion)), costSnapshotKey).amount
      if (lineAmount === null) group.unpricedCount += 1
      else group.total += lineAmount
      groups.set(pid, group)
    })

    return [...groups.entries()]
      .map(([producerId, group]) => ({
        producerId,
        ...group,
        lines: group.lines.toSorted(
          (a, b) =>
            URGENCY_META[a.suggestion.urgency].order -
              URGENCY_META[b.suggestion.urgency].order ||
            (a.suggestion.product_name || a.suggestion.vendor_code || '').localeCompare(
              b.suggestion.product_name || b.suggestion.vendor_code || '',
              'uk-UA',
            ),
        ),
      }))
      .toSorted((a, b) => a.name.localeCompare(b.name, 'uk-UA'))
  }, [basket, costSnapshotKey, currentRowsByKey])

  const basketTotal = useMemo(
    () => basketByProducer.reduce((total, group) => total + group.total, 0),
    [basketByProducer],
  )
  const basketUnpricedCount = useMemo(
    () => basketByProducer.reduce((count, group) => count + group.unpricedCount, 0),
    [basketByProducer],
  )

  async function createDraft(producerId: number, lines: BasketLine[]) {
    if (!can(PermissionKeys.PurchaseCockpit.DraftOrder.Create)) {
      return
    }

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
  const hasPlanData = hasLoadedPlan && !isLoading && !error && (lens === 'warehouse' || Boolean(selectedProducerId))
  const emptyState = getCockpitEmptyState({
    error,
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
        row={row}
        selectedQty={orderQtyFor(row)}
        refreshKey={reloadKey}
        onQuantityChange={(qty) => setDraftQtyFor(row, qty)}
        onAddToBasket={(qty) => addToBasket(row, qty)}
        t={t}
      />
    ),
    [addToBasket, orderQtyFor, reloadKey, setDraftQtyFor, t],
  )

  // Keep sheet interactions off the large plan grid's render path. Basket marks
  // update at deferred priority so opening the sheet can paint first.
  const planTable = useMemo(() => (
    <DataTable
      columns={planColumns}
      pagination={pagination}
      sorting={planSorting}
      onSortingChange={onPlanSortingChange}
      data={visibleRows}
      defaultLayout={PLAN_TABLE_DEFAULT_LAYOUT}
      emptyText={
        <ProcurementWorkspaceState
          action={error ? { label: t('Повторити'), onClick: reload } : undefined}
          description={emptyState.description}
          tone={error ? 'error' : undefined}
          isLoading={isLoading}
          title={emptyState.title}
        />
      }
      fillAvailableWidth
      getRowId={procurementLineKey}
      height="100%"
      isLoading={isLoading}
      layoutVersion={5}
      loadingText={t('Розрахунок потреби…')}
      minWidth={1150}
      renderExpandedRow={renderProofPanel}
      showLayoutControls
      tableId="procure-cockpit-plan"
      toolbarPortalTarget={tableToolbarSlot}
    />
  ), [
    emptyState.description, emptyState.title, error, isLoading, planColumns,
    renderProofPanel, t, tableToolbarSlot, visibleRows, pagination, planSorting, onPlanSortingChange,
  ])

  return (
    <div className="procure-cockpit">
      <Card className="app-data-card basket-supply-primary-card" padding={0} radius="md" withBorder>
        <div className="app-filter-bar procure-cockpit-bar">
          <div className="procure-cockpit-bar__filters">
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
              className="procure-cockpit-bar__search"
            />
            {lens === 'producer' && (
              <Select
                clearable
                data={producerOptions}
                label={t('Виробник')}
                placeholder={t('Оберіть виробника')}
                searchable
                value={selectedProducerId}
                className="procure-cockpit-bar__producer"
                onChange={setSelectedProducerId}
              />
            )}
          </div>
          <div className="app-filter-command-row">
            <div className="app-filter-actions procure-cockpit-bar__actions">
              <Button
                  aria-label={t('Скинути')}
                  color="gray"
                  variant="default"
                  onClick={() => {
                    setLens('warehouse')
                    setSelectedProducerId(null)
                    setSearchQuery('')
                  }}
                 className="registry-caption-action" title={t('Скинути')} leftSection={<RotateCcw size={17} />}>{t('Скинути')}</Button>
              <Button
                  aria-label={t('Оновити')}
                  color="gray"
                  loading={isLoading}
                  variant="default"
                  onClick={() => { clearProductAnalyticsResource(); reload() }}
                 className="registry-caption-action" title={t('Оновити')} leftSection={<RefreshCw size={17} />}>{t('Оновити')}</Button>
              <Menu position="bottom-end" shadow="md" width={280}>
                <Menu.Target>
                  <Button aria-label={t('Сесії')} title={t('Сесії')} color="gray" variant="default" size="sm" className="procure-cockpit-bar__sessions" leftSection={<Bookmark size={15} />}>
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
              {canExport && (
                <Button
                    aria-label={t('Експорт в Excel')}
                    disabled={visibleRows.length === 0}
                    variant="default"
                    onClick={() => {
                      if (can(PermissionKeys.PurchaseCockpit.Document.Export)) {
                        void exportRowsToXlsx(visibleRows, lens, t, orderQtyFor)
                      }
                    }}
                   color="gray" className="registry-caption-action" title={t('Експорт в Excel')} leftSection={<ExcelIcon size={22} />}>{t('Експорт в Excel')}</Button>
              )}
            </div>
            <Paginator
              page={currentPage}
              pageSize={pageSize}
              pageSizeOptions={PLAN_PAGE_SIZES}
              totalPages={totalPages}
              isLoading={isLoading}
              onPageChange={(page) => setPageSelection({ rows: visibleRows, page })}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPageSelection({ rows: visibleRows, page: 1 })
              }}
            />
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
            <Button
              aria-expanded={isBasketOpen}
              aria-haspopup="dialog"
              color={CREATE_ACTION_COLOR}
              leftSection={<ShoppingCart size={17} />}
              variant="default"
              onClick={() => setBasketOpen(true)}
            >
              {t('Кошик')} · {qty.format(basketCount)}
            </Button>
            <Button
              className="app-filter-primary-action procure-cockpit-bar__submit"
              color={CREATE_ACTION_COLOR}
              disabled={urgentRowsToAdd.length === 0}
              leftSection={<Sparkles size={15} />}
              onClick={addAllCritical}
            >
              {t('Термінові в кошик')} · {qty.format(urgentRowsToAdd.length)}
            </Button>
          </div>
        </div>

        <div className="procure-cockpit__overview">
          <div className="procure-cockpit__metrics">
            <div className="procure-metric">
              <span>{t('Позицій до замовлення')}</span>
              <strong>{hasPlanData ? qty.format(overview.count) : '—'}</strong>
            </div>
            <div className={`procure-metric${overview.criticalCount > 0 ? ' is-critical' : ''}`}>
              <span>{t('Критичних')}</span>
              <strong>{hasPlanData ? qty.format(overview.criticalCount) : '—'}</strong>
            </div>
            <div className="procure-metric">
              <span>{t('Відомі оцінки потреби, EUR')}</span>
              <strong>{hasPlanData && overview.totalValue !== null ? amount.format(overview.totalValue) : '—'}</strong>
            </div>
            <div className="procure-metric">
              <span>{t('Оцінки термінових позицій, EUR')}</span>
              <strong>{hasPlanData && overview.valueAtRisk !== null ? amount.format(overview.valueAtRisk) : '—'}</strong>
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
            <TableChip tone={emptyState.pillClass === 'is-red' ? 'danger' : emptyState.pillClass === 'is-green' ? 'success' : 'neutral'} value={emptyState.status} />
          )}
        </div>

        <Collapse expanded={isAnalyticsOpen && Boolean(hasPlanData)}>
          <div className="procure-cockpit__charts">
            <OverviewCharts overview={overview} t={t} />
          </div>
        </Collapse>

        <div className="procure-cockpit__workspace">
          <div className="procure-cockpit__table">
            {planTable}
          </div>


        </div>
      </Card>
      <AppBottomSheet
        bodyClassName="procure-cart-sheet__body"
        closeLabel={t('Закрити кошик')}
        collapseLabel={t('Згорнути кошик')}
        contentClassName="procure-cart-sheet"
        expandLabel={t('Розгорнути кошик')}
        mediumHeightRatio={0.65}
        opened={isBasketOpen}
        title={t('Кошик замовлень')}
        onClose={() => setBasketOpen(false)}
        headerTools={
          <Group gap={6} wrap="nowrap">
            <TableChip value={`${basketCount} ${t('поз.')}`} />
            <Tooltip label={t('Очистити кошик')}>
              <ActionIcon
                aria-label={t('Очистити кошик')}
                color="red"
                disabled={basketCount === 0}
                size={30}
                variant="subtle"
                onClick={() => setBasket(new Map<string, BasketLine>())}
              >
                <Trash2 size={15} />
              </ActionIcon>
            </Tooltip>
          </Group>
        }
      >
        {basketCount === 0 ? (
          <Text c="dimmed" py="xl" ta="center">{t('Кошик порожній')}</Text>
        ) : (
          <div className="procure-cockpit__basket">
            <div className="procure-cockpit__basket-summary">
              <div>
                <span>{t('Виробників')}</span>
                <strong>{qty.format(basketByProducer.length)}</strong>
              </div>
              <div>
                <span>{basketUnpricedCount > 0 ? t('Відомі оцінки') : t('Сума оцінок')}</span>
                <strong>{basketUnpricedCount === basket.size ? '—' : amount.format(basketTotal)} <TableChip tone="source" value="EUR" /></strong>
                {basketUnpricedCount > 0 && (
                  <small className="procure-cockpit__basket-unpriced">
                    {qty.format(basketUnpricedCount)} {t('без ціни')}
                  </small>
                )}
              </div>
            </div>
            <div className="procure-cockpit__basket-body">
              <Stack gap={10}>
                {basketByProducer.map((group) => (
                  <Box key={group.producerId} className="procure-cockpit__basket-group">
                    <button
                      className="procure-cockpit__basket-group-head procure-cart-sheet__group-toggle"
                      type="button"
                      aria-label={`${collapsedProducers.has(group.producerId) ? t('Розгорнути') : t('Згорнути')} ${group.name}`}
                      aria-expanded={!collapsedProducers.has(group.producerId)}
                      aria-controls={`${basketGroupsId}-${group.producerId}`}
                      onClick={() => setCollapsedProducers((current) => {
                        const next = new Set(current)
                        if (next.has(group.producerId)) next.delete(group.producerId)
                        else next.add(group.producerId)
                        return next
                      })}
                    >
                      {collapsedProducers.has(group.producerId) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      <span className="procure-cart-sheet__producer-chip">
                        <TableChip tone="document" value={group.name} />
                      </span>
                      <TableChip value={`${qty.format(group.lines.length)} ${t('поз.')}`} />
                    </button>
                    <Collapse expanded={!collapsedProducers.has(group.producerId)} id={`${basketGroupsId}-${group.producerId}`}>
                      <Stack className="procure-cockpit__basket-lines" gap={0}>
                        {group.lines.map((line) => {
                          const lineKey = procurementLineKey(line.suggestion)
                          const lineName =
                            line.suggestion.product_name ||
                            line.suggestion.vendor_code ||
                            `#${line.suggestion.product_id}`
                          const cost = procurementBasketCost(line, currentRowsByKey.get(lineKey), costSnapshotKey)
                          const lineTotal = cost.amount

                          return (
                            <article key={lineKey} className="procure-cockpit__basket-line">
                              <ProcurementProductCell row={line.suggestion} t={t} />
                              {!cost.proofCurrent && <Text size="xs" c="orange.9">{t('Джерело оцінки не підтверджено для поточного плану. Кількість збережено без переоцінки.')}</Text>}
                              <div className="procure-cockpit__basket-line-controls">
                                <div className="procure-cockpit__basket-line-total">
                                  <span>{t('Сума')}</span>
                                  {lineTotal === null ? (
                                    <TableChip tone="warning" value={t('Без ціни')} />
                                  ) : (
                                    <strong>{amount.format(lineTotal)} <TableChip tone="source" value="EUR" /></strong>
                                  )}
                                </div>
                                <label className="procure-cockpit__basket-qty">
                                  <span>{t('К-сть')}</span>
                                  <NumberInput
                                    aria-label={`${t('Кількість')} ${lineName}`}
                                    hideControls
                                    min={0}
                                    size="xs"
                                    value={line.qty}
                                    onChange={(value) =>
                                      setBasketQty(lineKey, Number(value) || 0)
                                    }
                                  />
                                </label>
                                <ActionIcon
                                  aria-label={`${t('Видалити')} ${lineName}`}
                                  color="red"
                                  size="sm"
                                  variant="subtle"
                                  onClick={() => setBasketQty(lineKey, 0)}
                                >
                                  <Trash2 size={14} />
                                </ActionIcon>
                              </div>
                            </article>
                          )
                        })}
                      </Stack>
                      <div className="procure-cockpit__basket-group-footer">
                        <div className="procure-cockpit__basket-group-total">
                          <span>{group.unpricedCount > 0 ? t('Відомі оцінки') : t('Разом')}</span>
                          <strong>{group.unpricedCount === group.lines.length ? '—' : amount.format(group.total)} <TableChip tone="source" value="EUR" /></strong>
                        </div>
                        {canCreateDraft && (
                          <Button
                            color={CREATE_ACTION_COLOR}
                            loading={creatingProducer === group.producerId}
                            size="compact-sm"
                            onClick={() => void createDraft(group.producerId, group.lines)}
                          >
                            {t('Створити чернетку')}
                          </Button>
                        )}
                      </div>
                    </Collapse>
                  </Box>
                ))}
              </Stack>
            </div>
          </div>
        )}
      </AppBottomSheet>
    </div>
  )
}

function getCockpitEmptyState({
  error,
  hasSearch,
  isLoading,
  lens,
  selectedProducerId,
  t,
}: {
  error: string | null
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

  if (error) {
    return {
      description: t('Дані про потребу недоступні. Повторіть завантаження, щоб перевірити залишки.'),
      pillClass: 'is-red',
      status: t('Немає даних'),
      title: error,
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
        minWidth: 260,
      },
      {
        id: 'urgency',
        header: t('Терміновість'),
        accessor: (row) => URGENCY_META[row.urgency].order,
        cell: (row) => {
          const meta = URGENCY_META[row.urgency]

          return (
            <TableChip tone={urgencyTone(row.urgency)} value={t(meta.label)} />
          )
        },
        width: 150,
      },
      {
        id: 'quadrant',
        header: t('Квадрант'),
        accessor: (row) => row.quadrant ?? '',
        cell: (row) =>
          row.quadrant ? (
            <TableChip title={quadrantHint(row.quadrant, t)} value={row.quadrant} />
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
              width: 168,
            } satisfies DataTableColumn<ReorderSuggestion>,
          ]
        : []),
      {
        id: 'onHand',
        header: t('На складі'),
        accessor: (row) => row.inventory.on_hand,
        cell: (row) => (
          <ProcurementNumberCell
            metaTitle={t('Доступно')}
            metaValue={row.inventory.available !== row.inventory.on_hand ? quantity.format(row.inventory.available) : undefined}
            title={[
              `${t('На складі')}: ${quantity.format(row.inventory.on_hand)}`,
              `${t('Доступно')}: ${quantity.format(row.inventory.available)}`,
              `${t('У резерві')}: ${quantity.format(row.inventory.reserved)}`,
              `${t('У дорозі')}: ${quantity.format(row.inventory.on_order)}`,
            ].join(' · ')}
            value={quantity.format(row.inventory.on_hand)}
          />
        ),
        align: 'right',
        width: 128,
      },
      {
        id: 'position',
        header: t('Позиція'),
        accessor: (row) => row.inventory.position,
        cell: (row) => <ProcurementNumberCell value={quantity.format(row.inventory.position)} />,
        align: 'right',
        width: 112,
      },
      {
        id: 'reserved',
        header: t('Резерв'),
        accessor: (row) => row.inventory.reserved,
        cell: (row) => <ProcurementNumberCell value={quantity.format(row.inventory.reserved)} />,
        align: 'right',
        width: 104,
      },
      {
        id: 'onOrder',
        header: t('У дорозі'),
        accessor: (row) => row.inventory.on_order,
        cell: (row) => <ProcurementNumberCell value={quantity.format(row.inventory.on_order)} />,
        align: 'right',
        width: 112,
      },
      {
        id: 'cover',
        header: t('Покриття'),
        accessor: (row) => row.days_of_cover,
        cell: (row) => (
          <ProcurementNumberCell
            title={row.days_of_cover >= 9999 ? t('Необмежене покриття') : `${t('Покриття')}: ${qty.format(row.days_of_cover)} ${t('днів')}`}
            value={row.days_of_cover >= 9999 ? '∞' : qty.format(row.days_of_cover)}
          />
        ),
        align: 'right',
        width: 126,
      },
      {
        id: 'reorderPoint',
        header: t('Точка замовлення'),
        accessor: (row) => row.reorder_point,
        cell: (row) => <ProcurementNumberCell value={quantity.format(row.reorder_point)} />,
        align: 'right',
        width: 168,
      },
      {
        id: 'moq',
        header: 'MOQ',
        accessor: (row) => row.moq,
        cell: (row) => row.moq === null ? null : <ProcurementNumberCell value={quantity.format(row.moq)} />,
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
                {t('Рекомендовано')}: {quantity.format(row.suggested_qty)}
              </Text>
            )}
          </Box>
        ),
        align: 'right',
        enableSorting: false,
        width: 128,
      },
      {
        id: 'unitCost',
        header: t('Оцінка одиниці, EUR'),
        accessor: (row) => row.unit_cost_eur,
        cell: (row) => <Stack gap={3}><ProcurementMoneyCell value={row.unit_cost_eur} unit /><ProcurementCostBadge proof={row.cost_provenance} /></Stack>,
        align: 'right',
        width: 128,
      },
      {
        id: 'lineCost',
        header: t('Оцінка, EUR'),
        accessor: (row) => row.unit_cost_eur === null ? null : exactDisplayedLineAmount(row.unit_cost_eur, orderQtyFor(row)),
        cell: (row) => (
          <ProcurementMoneyCell
            value={row.unit_cost_eur === null ? null : exactDisplayedLineAmount(row.unit_cost_eur, orderQtyFor(row))}
          />
        ),
        align: 'right',
        width: 160,
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
    </span>
  )
}

function ProcurementNumberCell({
  value,
  metaTitle,
  metaValue,
  title,
}: {
  value: string
  metaTitle?: string
  metaValue?: string
  title?: string
}) {
  return (
    <span className="procure-table-value" title={title}>
      <TableChip value={value} title={title} />
      {metaValue !== undefined && <TableChip tone="storage" value={metaValue} title={`${metaTitle}: ${metaValue}`} />}
    </span>
  )
}

function ProcurementMoneyCell({ value, unit = false }: { value: number | null; unit?: boolean }) {
  if (value === null) {
    return null
  }

  return (
    <span className="procure-table-money">
      <span className="app-money">{unit ? formatUnitCost(value) : amount.format(value)}</span>
      <TableChip tone="source" value="EUR" />
    </span>
  )
}

export function ProcurementProofPanel(props: ProcurementItemAnalyticsProps) {
  return <ProcurementItemAnalytics {...props} />
}

type Overview = {
  count: number
  criticalCount: number
  totalValue: number | null
  valueAtRisk: number | null
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
  let knownCount = 0
  let urgentCount = 0
  let knownUrgentCount = 0

  rows.forEach((row) => {
    urgencyCounts[row.urgency] = (urgencyCounts[row.urgency] ?? 0) + 1
    const value = row.line_cost_eur
    if (value !== null) { totalValue += value; knownCount += 1 }
    if (row.urgency === 'critical' || row.urgency === 'high') {
      urgentCount += 1
      if (value !== null) { valueAtRisk += value; knownUrgentCount += 1 }
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
    if (value !== null) producerTotals.set(producer, (producerTotals.get(producer) ?? 0) + value)
  })

  const urgencyDonut = (['critical', 'high', 'normal', 'none'] as ProcurementUrgency[])
    .filter((urgency) => urgencyCounts[urgency])
    .map((urgency) => ({
      name: URGENCY_META[urgency].label,
      value: urgencyCounts[urgency],
      color: `${URGENCY_META[urgency].color}.5`,
    }))

  const producerValue = [...producerTotals.entries()]
    .map(([producer, value]) => ({ producer, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  return {
    count: rows.length,
    criticalCount,
    totalValue: rows.length && !knownCount ? null : totalValue,
    valueAtRisk: urgentCount && !knownUrgentCount ? null : valueAtRisk,
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
          {t('Відомі оцінки, EUR · топ виробників')}
        </Text>
        <BarChart
          classNames={{ tooltipItemData: 'app-money' }}
          data={overview.producerValue}
          dataKey="producer"
          h={150}
          series={[{ color: 'orange.6', name: 'value', label: t('EUR') }]}
          tickLine="none"
          valueFormatter={(value) => amount.format(value)}
          withXAxis={false}
          yAxisProps={{ tick: MONEY_AXIS_TICK }}
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
