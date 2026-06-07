import { ActionIcon, Alert, Button, Card, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { getSupplyUkraineOrderDisplayNumber } from '../../../shared/supplyUkraineOrderNumbers'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getWarehouseUkraineOrders } from '../api/ordersApi'
import type { SupplyOrderUkraine } from '../types'
import { displayValue, formatDateTime, getDateShiftedByDays, toIsoString } from './dateHelpers'

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

type OrdersTabState = {
  filterDraft: FilterDraft
  activeFilters: FilterDraft
  orders: SupplyOrderUkraine[]
  totalQty: number
  error: string | null
  isLoading: boolean
  isLoadingMore: boolean
  pageSize: number
  hasMore: boolean
}

type OrdersTabAction =
  | { type: 'applyFilters'; filters: FilterDraft }
  | { type: 'resetFilters'; filters: FilterDraft }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'invalidFilters' }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; orders: SupplyOrderUkraine[]; totalQty: number; hasMore: boolean }
  | { type: 'loadFailed'; error: string }
  | { type: 'loadMoreStarted' }
  | { type: 'loadMoreSucceeded'; orders: SupplyOrderUkraine[]; totalQty: number; hasMore: boolean; requestOffset: number }
  | { type: 'loadMoreFailed'; error: string }

function createInitialOrdersState(initialFilters: FilterDraft): OrdersTabState {
  return {
    filterDraft: initialFilters,
    activeFilters: initialFilters,
    orders: [],
    totalQty: 0,
    error: null,
    isLoading: true,
    isLoadingMore: false,
    pageSize: DEFAULT_PAGE_SIZE,
    hasMore: false,
  }
}

function ordersTabReducer(state: OrdersTabState, action: OrdersTabAction): OrdersTabState {
  switch (action.type) {
    case 'applyFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters }
    case 'resetFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters }
    case 'setPageSize':
      return { ...state, pageSize: action.pageSize }
    case 'invalidFilters':
      return { ...state, orders: [], totalQty: 0, hasMore: false, isLoading: false }
    case 'loadStarted':
      return { ...state, isLoading: true, error: null }
    case 'loadSucceeded':
      return {
        ...state,
        orders: action.orders,
        totalQty: action.totalQty,
        hasMore: action.hasMore,
        isLoading: false,
      }
    case 'loadFailed':
      return {
        ...state,
        orders: [],
        totalQty: 0,
        hasMore: false,
        error: action.error,
        isLoading: false,
      }
    case 'loadMoreStarted':
      return { ...state, isLoadingMore: true, error: null }
    case 'loadMoreSucceeded':
      return {
        ...state,
        orders:
          state.orders.length === action.requestOffset ? [...state.orders, ...action.orders] : state.orders,
        totalQty: action.totalQty,
        hasMore: action.hasMore,
        isLoadingMore: false,
      }
    case 'loadMoreFailed':
      return { ...state, error: action.error, isLoadingMore: false }
  }
}

function useOrdersTabModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0), placed: false }),
    [],
  )
  const initialState = useMemo(() => createInitialOrdersState(initialFilters), [initialFilters])
  const [state, dispatchState] = useReducer(ordersTabReducer, initialState)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, toggleDensity } = useDataTableDensity('warehouse-ukraine-orders', TABLE_DEFAULT_LAYOUT.density)
  const { activeFilters, orders, pageSize } = state
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${activeFilters.placed}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const orderIndexMap = useMemo(() => buildIndexMap(orders), [orders])
  const reloadFromRealtime = useCallback(() => {
    reload()
  }, [])

  useRealtimeEvent(realtimeEvents.supplyOrderAdded, reloadFromRealtime)
  useRealtimeEvent(realtimeEvents.supplyOrderNotification, reloadFromRealtime)

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

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
          to: toIsoString(activeFilters.to),
          limit: pageSize,
          offset: 0,
          placed: activeFilters.placed,
        })

        if (!cancelled) {
          dispatchState({
            type: 'loadSucceeded',
            orders: result.items,
            totalQty: result.totalQty,
            hasMore: getOrdersHasMore({
              offset: 0,
              itemsLength: result.items.length,
              pageSize,
              totalQty: result.totalQty,
            }),
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
  }, [activeFilters, filterError, pageSize, reloadKey, t])

  async function loadMoreOrders() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = orders.length
    dispatchState({ type: 'loadMoreStarted' })

    try {
      const result = await getWarehouseUkraineOrders({
        from: toIsoString(activeFilters.from),
        to: toIsoString(activeFilters.to),
        limit: pageSize,
        offset: requestOffset,
        placed: activeFilters.placed,
      })

      if (listRequestKeyRef.current === requestKey) {
        dispatchState({
          type: 'loadMoreSucceeded',
          orders: result.items,
          totalQty: result.totalQty,
          hasMore: getOrdersHasMore({
            offset: requestOffset,
            itemsLength: result.items.length,
            pageSize,
            totalQty: result.totalQty,
          }),
          requestOffset,
        })
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        dispatchState({
          type: 'loadMoreFailed',
          error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'),
        })
      }
    }
  }

  function applyFilters(nextFilters: FilterDraft) {
    dispatchState({ type: 'applyFilters', filters: nextFilters })
  }

  function resetFilters() {
    dispatchState({ type: 'resetFilters', filters: initialFilters })
  }

  function setPageSize(pageSize: number) {
    dispatchState({ type: 'setPageSize', pageSize })
  }

  function openOrder(order: SupplyOrderUkraine) {
    if (order.NetUid) {
      navigate(`/warehouse/ukraine/orders/${order.NetUid}/placements`)
    }
  }

  const columns = useOrdersColumns(orderIndexMap)

  return {
    ...state,
    applyFilters,
    columns,
    density,
    filterError,
    loadMoreOrders,
    openOrder,
    reload,
    resetFilters,
    setPageSize,
    toggleDensity,
  }
}

export function OrdersTab() {
  const model = useOrdersTabModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <PageHeaderActions>
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={model.isLoading}
            size={38}
            variant="light"
            onClick={() => model.reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </PageHeaderActions>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <TextInput
              label={t('Початкова дата')}
              max={model.filterDraft.to || undefined}
              type="date"
              value={model.filterDraft.from}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              label={t('Кінцева дата')}
              min={model.filterDraft.from || undefined}
              type="date"
              value={model.filterDraft.to}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, to: event.currentTarget.value })}
            />
            <Select
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
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={model.resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
            <DataTableDensityToggle density={model.density} onToggle={model.toggleDensity} size={36} />
          </Group>

          {(model.error || model.filterError) && (
            <Alert color={model.filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <Group justify="flex-end" gap="xs">
            <Select
              aria-label={t('Кількість рядків')}
              data={PAGE_SIZE_OPTIONS}
              size="xs"
              value={String(model.pageSize)}
              w={88}
              onChange={(value) => model.setPageSize(Number(value || DEFAULT_PAGE_SIZE))}
            />
          </Group>

          <DataTable
            columns={model.columns}
            data={model.orders}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            density={model.density}
            emptyText={t('Замовлень не знайдено')}
            getRowId={(order, index) => String(order.NetUid || order.Id || index)}
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-orders-1"
            maxHeight="calc(100vh - 420px)"
            minWidth={1200}
            tableId="warehouse-ukraine-orders"
            onRowClick={model.openOrder}
          />

          {model.hasMore && (
            <Group justify="center">
              <Button color="gray" loading={model.isLoadingMore} variant="light" onClick={model.loadMoreOrders}>
                {t('Завантажити ще')}
              </Button>
            </Group>
          )}
        </Stack>
      </Card>
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

function buildIndexMap(orders: SupplyOrderUkraine[]): Map<SupplyOrderUkraine, number> {
  return orders.reduce((indexMap, order, index) => {
    indexMap.set(order, index + 1)

    return indexMap
  }, new Map<SupplyOrderUkraine, number>())
}

function getOrdersHasMore({
  offset,
  itemsLength,
  pageSize,
  totalQty,
}: {
  offset: number
  itemsLength: number
  pageSize: number
  totalQty?: number | null
}): boolean {
  if (typeof totalQty === 'number' && Number.isFinite(totalQty)) {
    return offset + itemsLength < totalQty && itemsLength > 0
  }

  return itemsLength === pageSize
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
