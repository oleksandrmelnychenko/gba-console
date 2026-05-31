import { ActionIcon, Alert, Button, Card, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
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
}

function useOrdersTabModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0) }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [orders, setOrders] = useValueState<SupplyOrderUkraine[]>([])
  const [totalQty, setTotalQty] = useValueState(0)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [hasMore, setHasMore] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const orderIndexMap = useMemo(() => buildIndexMap(orders), [orders])

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    if (filterError) {
      setOrders([])
      setTotalQty(0)
      setHasMore(false)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadOrders() {
      setLoading(true)
      setError(null)

      try {
        const result = await getWarehouseUkraineOrders({
          from: toIsoString(activeFilters.from),
          to: toIsoString(activeFilters.to),
          limit: pageSize,
          offset: 0,
        })

        if (!cancelled) {
          setOrders(result.items)
          setTotalQty(result.totalQty)
          setHasMore(result.items.length === pageSize)
        }
      } catch (loadError) {
        if (!cancelled) {
          setOrders([])
          setTotalQty(0)
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      cancelled = true
    }
  }, [activeFilters, filterError, pageSize, reloadKey, setError, setHasMore, setLoading, setOrders, setTotalQty, t])

  async function loadMoreOrders() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = orders.length
    setLoadingMore(true)
    setError(null)

    try {
      const result = await getWarehouseUkraineOrders({
        from: toIsoString(activeFilters.from),
        to: toIsoString(activeFilters.to),
        limit: pageSize,
        offset: requestOffset,
      })

      if (listRequestKeyRef.current === requestKey) {
        setOrders((current) => (current.length === requestOffset ? [...current, ...result.items] : current))
        setTotalQty(result.totalQty)
        setHasMore(result.items.length === pageSize)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  function openOrder(order: SupplyOrderUkraine) {
    if (order.NetUid) {
      navigate(`/warehouse/ukraine/orders/${order.NetUid}/placements`)
    }
  }

  const columns = useOrdersColumns(orderIndexMap)

  return {
    activeFilters, applyFilters, columns, error, filterDraft, filterError, hasMore, isLoading, isLoadingMore,
    loadMoreOrders, openOrder, orders, pageSize, reload, resetFilters, setPageSize, totalQty,
  }
}

export function OrdersTab() {
  const model = useOrdersTabModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Замовлення на Україну')}
        </Text>
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
      </Group>

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
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={model.resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(model.error || model.filterError) && (
            <Alert color={model.filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <Group justify="space-between" gap="xs">
            <Text c="dimmed" size="xs">
              {t('Показано')} {model.orders.length} / {model.totalQty}
            </Text>
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
        accessor: (order) => order.Number,
        cell: (order) => <Text fw={700}>{displayValue(order.Number)}</Text>,
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

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}
