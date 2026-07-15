import { ActionIcon, Alert, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { getSupplyUkraineOrderDisplayNumber } from '../../../shared/supplyUkraineOrderNumbers'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { getWarehouseUkraineOrders } from '../api/ordersApi'
import type { SupplyOrderUkraine } from '../types'
import { displayValue, formatDateTime, getDateShiftedByDays, toDateTimeQuery, toIsoString } from './dateHelpers'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '150']

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['index', 'fromDate', 'number'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

type FilterDraft = {
  from: string
  to: string
  placed: boolean
}

function createDefaultOrderFilters(): FilterDraft {
  return { from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0), placed: false }
}

// Legacy kept the applied orders filter in the in-memory redux store, so it survived the primary
// drill-down (row → placements page → back). Mirror that with a module-scoped last-applied filter
// (lost on hard reload, exactly like legacy).
let lastOrderFilters: FilterDraft | null = null

type OrdersTabState = {
  filterDraft: FilterDraft
  activeFilters: FilterDraft
  orders: SupplyOrderUkraine[]
  totalQty: number
  error: string | null
  isLoading: boolean
  page: number
  pageSize: number
}

type OrdersTabAction =
  | { type: 'applyFilters'; filters: FilterDraft }
  | { type: 'resetFilters'; filters: FilterDraft }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'setPage'; page: number }
  | { type: 'invalidFilters' }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; orders: SupplyOrderUkraine[]; totalQty: number }
  | { type: 'loadFailed'; error: string }

function createInitialOrdersState(initialFilters: FilterDraft): OrdersTabState {
  return {
    filterDraft: initialFilters,
    activeFilters: initialFilters,
    orders: [],
    totalQty: 0,
    error: null,
    isLoading: true,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  }
}

function ordersTabReducer(state: OrdersTabState, action: OrdersTabAction): OrdersTabState {
  switch (action.type) {
    case 'applyFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters, page: 1 }
    case 'resetFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters, page: 1 }
    case 'setPageSize':
      return { ...state, page: 1, pageSize: action.pageSize }
    case 'setPage':
      return { ...state, page: action.page }
    case 'invalidFilters':
      return { ...state, orders: [], totalQty: 0, isLoading: false }
    case 'loadStarted':
      return { ...state, isLoading: true, error: null }
    case 'loadSucceeded':
      return {
        ...state,
        orders: action.orders,
        page: Math.min(state.page, Math.max(1, Math.ceil(action.totalQty / state.pageSize))),
        totalQty: action.totalQty,
        isLoading: false,
      }
    case 'loadFailed':
      return {
        ...state,
        orders: [],
        totalQty: 0,
        error: action.error,
        isLoading: false,
      }
  }
}

function useOrdersTabModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const initialFilters = useMemo<FilterDraft>(() => lastOrderFilters ?? createDefaultOrderFilters(), [])
  const initialState = useMemo(() => createInitialOrdersState(initialFilters), [initialFilters])
  const [state, dispatchState] = useReducer(ordersTabReducer, initialState)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { activeFilters, orders, page, pageSize, totalQty } = state

  useEffect(() => {
    lastOrderFilters = activeFilters
  }, [activeFilters])

  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const pageOffset = (page - 1) * pageSize
  const hasNext = totalQty > 0 ? pageOffset + orders.length < totalQty : orders.length === pageSize
  const totalPages = totalQty > 0 ? Math.ceil(totalQty / pageSize) : undefined
  const orderIndexMap = useMemo(() => buildIndexMap(orders, pageOffset), [orders, pageOffset])
  const reloadFromRealtime = useCallback(() => {
    reload()
  }, [])

  useRealtimeEvent(realtimeEvents.supplyOrderAdded, reloadFromRealtime)
  useRealtimeEvent(realtimeEvents.supplyOrderNotification, reloadFromRealtime)

  useEffect(() => {
    if (filterError) {
      dispatchState({ type: 'invalidFilters' })
      return
    }

    let cancelled = false

    async function loadOrders() {
      dispatchState({ type: 'loadStarted' })

      try {
        const result = await getWarehouseUkraineOrders({
          from: toIsoString(activeFilters.from),
          to: toDateTimeQuery(activeFilters.to, 'end'),
          limit: pageSize,
          offset: pageOffset,
          placed: activeFilters.placed,
        })

        if (!cancelled) {
          dispatchState({
            type: 'loadSucceeded',
            orders: result.items,
            totalQty: result.totalQty,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchState({
            type: 'loadFailed',
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'),
          })
        }
      }
    }

    void loadOrders()

    return () => {
      cancelled = true
    }
  }, [activeFilters, filterError, pageOffset, pageSize, reloadKey, t])

  function applyFilters(nextFilters: FilterDraft) {
    dispatchState({ type: 'applyFilters', filters: nextFilters })
  }

  function resetFilters() {
    dispatchState({ type: 'resetFilters', filters: initialFilters })
  }

  function setPageSize(pageSize: number) {
    dispatchState({ type: 'setPageSize', pageSize })
  }

  function setPage(page: number) {
    dispatchState({ type: 'setPage', page })
  }

  function openOrder(order: SupplyOrderUkraine) {
    if (order.NetUid) {
      navigate(`/warehouse/ukraine/orders/${order.NetUid}/placements`, { state: { backgroundLocation: location } })
    }
  }

  const columns = useOrdersColumns(orderIndexMap)

  return {
    ...state,
    applyFilters,
    columns,
    filterError,
    hasNext,
    openOrder,
    reload,
    resetFilters,
    setPage,
    setPageSize,
    totalPages,
  }
}

export function OrdersTab() {
  const model = useOrdersTabModel()
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="app-filter-bar warehouse-ukraine-filter-bar is-orders">
            <div className="app-filter-date-range">
              <TextInput
                className="warehouse-ukraine-filter-input"
                label={t('Від')}
                max={model.filterDraft.to || undefined}
                type="date"
                value={model.filterDraft.from}
                onChange={(event) => model.applyFilters({ ...model.filterDraft, from: event.currentTarget.value })}
              />
              <TextInput
                className="warehouse-ukraine-filter-input"
                label={t('До')}
                min={model.filterDraft.from || undefined}
                type="date"
                value={model.filterDraft.to}
                onChange={(event) => model.applyFilters({ ...model.filterDraft, to: event.currentTarget.value })}
              />
            </div>
            <Select
              className="warehouse-ukraine-filter-input"
              allowDeselect={false}
              data={[
                { value: 'false', label: t('Не оприбутковані') },
                { value: 'true', label: t('Оприбутковані') },
              ]}
              label={t('Статус')}
              value={String(model.filterDraft.placed)}
              w={190}
              onChange={(value) => model.applyFilters({ ...model.filterDraft, placed: value === 'true' })}
            />
            <div className="app-filter-actions warehouse-ukraine-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={model.resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                hasNext={model.hasNext}
                isLoading={model.isLoading}
                page={model.page}
                pageSize={model.pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                totalPages={model.totalPages}
                onPageChange={model.setPage}
                onPageSizeChange={model.setPageSize}
                onRefresh={() => model.reload()}
              />
            </div>
            <div ref={setTableToolbarSlot} className="warehouse-ukraine-table-toolbar-slot" />
          </div>

          {(model.error || model.filterError) && (
            <Alert className="console-table-alert" color={model.filterError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <div className="warehouse-ukraine-table console-table-body">
          <DataTable
            columns={model.columns}
            data={model.orders}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Замовлень не знайдено')}
            getRowId={(order, index) => String(order.NetUid || order.Id || index)}
            height="100%"
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-orders-2"
            minWidth={1200}
            showLayoutControls
            tableId="warehouse-ukraine-orders"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={model.openOrder}
          />
          </div>
      </div>
    </Stack>
  )
}

function useOrdersColumns(indexMap: Map<SupplyOrderUkraine, number>) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyOrderUkraine>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 52,
        minWidth: 44,
        align: 'right',
        enableSorting: false,
        accessor: (order) => indexMap.get(order) || 0,
        cell: (order) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(order) || ''}
          </Text>
        ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 160,
        minWidth: 140,
        accessor: (order) => order.FromDate,
        cell: (order) => <Text fw={600}>{formatDateTime(order.FromDate)}</Text>,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 200,
        minWidth: 150,
        accessor: (order) => getSupplyUkraineOrderDisplayNumber(order),
        cell: (order) => <Text fw={700}>{displayValue(getSupplyUkraineOrderDisplayNumber(order))}</Text>,
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        minWidth: 220,
        accessor: (order) => order.Supplier?.FullName,
        cell: (order) => displayValue(order.Supplier?.FullName),
      },
      {
        id: 'agreement',
        header: t('Договір'),
        width: 200,
        minWidth: 150,
        accessor: (order) => order.ClientAgreement?.Agreement?.Name,
        cell: (order) => displayValue(order.ClientAgreement?.Agreement?.Name),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 90,
        minWidth: 70,
        align: 'right',
        accessor: (order) => order.SupplyOrderUkraineItems?.length || 0,
        cell: (order) => displayValue(order.SupplyOrderUkraineItems?.length || 0),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 180,
        minWidth: 140,
        accessor: (order) => order.Organization?.Name,
        cell: (order) => displayValue(order.Organization?.Name),
      },
      {
        id: 'isPlaced',
        header: t('Оприходуваний'),
        width: 140,
        minWidth: 110,
        accessor: (order) => order.IsPlaced,
        cell: (order) => (order.IsPlaced ? t('Так') : t('Ні')),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 180,
        minWidth: 140,
        accessor: (order) => order.Responsible?.LastName,
        cell: (order) => displayValue(order.Responsible?.LastName),
      },
    ],
    [indexMap, t],
  )
}

function buildIndexMap(orders: SupplyOrderUkraine[], offset = 0): Map<SupplyOrderUkraine, number> {
  return orders.reduce((indexMap, order, index) => {
    indexMap.set(order, offset + index + 1)

    return indexMap
  }, new Map<SupplyOrderUkraine, number>())
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}
