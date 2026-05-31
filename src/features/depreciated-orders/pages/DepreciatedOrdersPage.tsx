import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconEye,
  IconPlus,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { UserRoleType } from '../../../shared/auth/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  createDepreciatedOrderFromFile,
  exportDepreciatedOrderDocument,
  getDepreciatedOrderByNetId,
  getDepreciatedOrderStorages,
  getDepreciatedOrders,
} from '../api/depreciatedOrdersApi'
import { DepreciatedOrderCreateModal } from '../components/DepreciatedOrderCreateModal'
import { DepreciatedOrderDetailDrawer } from '../components/DepreciatedOrderDetailDrawer'
import { DepreciatedOrderExceptionsModal } from '../components/DepreciatedOrderExceptionsModal'
import type {
  DepreciatedOrder,
  DepreciatedOrderCreateFromFilePayload,
  DepreciatedOrderExportDocument,
  DepreciatedOrderStorage,
} from '../types'

type FilterDraft = {
  from: string
  to: string
}

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100']

const DEPRECIATED_ORDERS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'fromDate', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function useDepreciatedOrdersPageModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: getDateShiftedByDays(-7),
      to: formatLocalDate(new Date()),
    }),
    [],
  )
  const { user } = useAuth()
  const isAdmin =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [orders, setOrders] = useValueState<DepreciatedOrder[]>([])
  const [storages, setStorages] = useValueState<DepreciatedOrderStorage[]>([])
  const [selectedOrder, setSelectedOrder] = useValueState<DepreciatedOrder | null>(null)
  const [detailError, setDetailError] = useValueState<string | null>(null)
  const [isDetailLoading, setDetailLoading] = useValueState(false)
  const [isCreateModalOpen, setCreateModalOpen] = useValueState(false)
  const [createError, setCreateError] = useValueState<string | null>(null)
  const [exceptionMessages, setExceptionMessages] = useValueState<string[]>([])
  const [isCreating, setCreating] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [storageError, setStorageError] = useValueState<string | null>(null)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<DepreciatedOrderExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [hasMore, setHasMore] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const detailRequestRef = useRef(0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const orderIndexMap = useMemo(() => buildOrderIndexMap(orders), [orders])

  const resetOrders = useCallback(() => {
    setOrders([])
    setHasMore(false)
    setLoading(false)
    setSelectedOrder(null)
  }, [setHasMore, setLoading, setOrders, setSelectedOrder])

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  const openDetail = useCallback(
    async (order: DepreciatedOrder) => {
      const requestId = detailRequestRef.current + 1
      detailRequestRef.current = requestId
      setSelectedOrder(order)
      setDetailError(null)

      if (!order.NetUid) {
        return
      }

      setDetailLoading(true)

      try {
        const detailedOrder = await getDepreciatedOrderByNetId(order.NetUid)

        if (detailRequestRef.current === requestId && detailedOrder) {
          setSelectedOrder(detailedOrder)
        }
      } catch (loadError) {
        if (detailRequestRef.current === requestId) {
          setDetailError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі акту списання'))
        }
      } finally {
        if (detailRequestRef.current === requestId) {
          setDetailLoading(false)
        }
      }
    },
    [setDetailError, setDetailLoading, setSelectedOrder, t],
  )

  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1
    setSelectedOrder(null)
    setDetailError(null)
    setDetailLoading(false)
    closeDownload()
  }, [closeDownload, setDetailError, setDetailLoading, setSelectedOrder])

  const openDownload = useCallback(
    async (order: DepreciatedOrder) => {
      if (!order.NetUid) {
        return
      }

      const requestId = downloadRequestRef.current + 1
      downloadRequestRef.current = requestId
      setDownloadOpened(true)
      setDownloadDocument(null)
      setDownloadError(null)
      setDownloading(true)

      try {
        const document = await exportDepreciatedOrderDocument(order.NetUid)

        if (downloadRequestRef.current === requestId) {
          setDownloadDocument(document)
        }
      } catch (exportError) {
        if (downloadRequestRef.current === requestId) {
          setDownloadError(
            exportError instanceof Error ? exportError.message : t('Документ недоступний для завантаження'),
          )
        }
      } finally {
        if (downloadRequestRef.current === requestId) {
          setDownloading(false)
        }
      }
    },
    [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading, t],
  )

  const columns = useDepreciatedOrderColumns(openDetail, orderIndexMap)

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {orders.length}
        {hasMore ? '+' : ''}
      </Text>
    ),
    [hasMore, orders.length, t],
  )

  useDepreciatedOrderStoragesLoader({ reloadKey, setLoadingStorages, setStorageError, setStorages })

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useDepreciatedOrdersLoader({
    activeFilters,
    filterError,
    pageSize,
    reloadKey,
    resetOrders,
    setError,
    setHasMore,
    setLoading,
    setOrders,
  })

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  async function loadMoreOrders() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = orders.length
    setLoadingMore(true)
    setError(null)

    try {
      const nextOrders = await getDepreciatedOrders({
        from: activeFilters.from,
        limit: pageSize,
        offset: requestOffset,
        to: activeFilters.to,
      })

      if (listRequestKeyRef.current === requestKey) {
        setOrders((current) => (current.length === requestOffset ? [...current, ...nextOrders] : current))
        setHasMore(nextOrders.length === pageSize)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити наступні акти списання'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  function openCreateModal() {
    setCreateError(null)
    setCreateModalOpen(true)
  }

  function closeCreateModal() {
    if (!isCreating) {
      setCreateModalOpen(false)
      setCreateError(null)
    }
  }

  async function handleCreate(payload: DepreciatedOrderCreateFromFilePayload) {
    setCreateError(null)
    setCreating(true)

    try {
      const result = await createDepreciatedOrderFromFile(payload)

      setCreateModalOpen(false)
      reload()

      if (result.exceptions.length > 0) {
        setExceptionMessages(result.exceptions)
      }

      notifications.show({
        color: result.exceptions.length > 0 ? 'yellow' : 'green',
        message: result.exceptions.length > 0 ? t('Акт списання створено з попередженнями') : t('Акт списання створено'),
      })
    } catch (createErrorValue) {
      setCreateError(
        createErrorValue instanceof Error ? createErrorValue.message : t('Не вдалося створити акт списання з файлу'),
      )
    } finally {
      setCreating(false)
    }
  }

  return {
    columns, createError, detailError, downloadDocument, downloadError, downloadOpened, error, exceptionMessages,
    filterDraft, filterError, hasMore, isAdmin, isCreateModalOpen, isCreating, isDetailLoading, isDownloading,
    isLoading, isLoadingMore, isLoadingStorages, orders, pageSize, selectedOrder, storageError, storages,
    toolbarLeft, applyFilters, closeCreateModal, closeDetail, closeDownload, handleCreate, loadMoreOrders,
    openCreateModal, openDetail, openDownload, reload, resetFilters, setExceptionMessages, setPageSize,
  }
}

function useDepreciatedOrderStoragesLoader({
  reloadKey,
  setLoadingStorages,
  setStorageError,
  setStorages,
}: {
  reloadKey: number
  setLoadingStorages: (value: boolean) => void
  setStorageError: (value: string | null) => void
  setStorages: (value: DepreciatedOrderStorage[]) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setStorageError(null)

      try {
        const nextStorages = await getDepreciatedOrderStorages()

        if (!cancelled) {
          setStorages(nextStorages)
        }
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setStorageError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!cancelled) {
          setLoadingStorages(false)
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setLoadingStorages, setStorageError, setStorages, t])
}

function useDepreciatedOrdersLoader({
  activeFilters,
  filterError,
  pageSize,
  reloadKey,
  resetOrders,
  setError,
  setHasMore,
  setLoading,
  setOrders,
}: {
  activeFilters: FilterDraft
  filterError: string | null
  pageSize: number
  reloadKey: number
  resetOrders: () => void
  setError: (value: string | null) => void
  setHasMore: (value: boolean) => void
  setLoading: (value: boolean) => void
  setOrders: (value: DepreciatedOrder[]) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError) {
      resetOrders()
      return
    }

    let cancelled = false

    async function loadOrders() {
      setLoading(true)
      setError(null)

      try {
        const nextOrders = await getDepreciatedOrders({
          from: activeFilters.from,
          limit: pageSize,
          offset: 0,
          to: activeFilters.to,
        })

        if (!cancelled) {
          setOrders(nextOrders)
          setHasMore(nextOrders.length === pageSize)
        }
      } catch (loadError) {
        if (!cancelled) {
          setOrders([])
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити акти списання'))
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
  }, [activeFilters, filterError, pageSize, reloadKey, resetOrders, setError, setHasMore, setLoading, setOrders, t])
}

export function DepreciatedOrdersPage() {
  const model = useDepreciatedOrdersPageModel()

  return <DepreciatedOrdersPageView model={model} />
}

function DepreciatedOrdersPageView({ model }: { model: ReturnType<typeof useDepreciatedOrdersPageModel> }) {
  return (
    <Stack gap="lg">
      <DepreciatedOrdersHeader model={model} />
      <DepreciatedOrdersTableCard model={model} />
      <DepreciatedOrderDetailDrawer
        detailError={model.detailError}
        downloadDocument={model.downloadDocument}
        downloadError={model.downloadError}
        downloadOpened={model.downloadOpened}
        isDetailLoading={model.isDetailLoading}
        isDownloading={model.isDownloading}
        order={model.selectedOrder}
        onClose={model.closeDetail}
        onCloseDownload={model.closeDownload}
        onExport={model.openDownload}
      />
      <DepreciatedOrderCreateModal
        createError={model.createError}
        isAdmin={model.isAdmin}
        isCreating={model.isCreating}
        isLoadingStorages={model.isLoadingStorages}
        opened={model.isCreateModalOpen}
        storageError={model.storageError}
        storages={model.storages}
        onClose={model.closeCreateModal}
        onCreate={model.handleCreate}
      />
      <DepreciatedOrderExceptionsModal
        exceptions={model.exceptionMessages}
        onClose={() => model.setExceptionMessages([])}
      />
    </Stack>
  )
}

function DepreciatedOrdersHeader({ model }: { model: ReturnType<typeof useDepreciatedOrdersPageModel> }) {
  const { t } = useI18n()
  const { isLoading, isLoadingStorages, openCreateModal, reload, storages } = model

  return (
    <Group justify="flex-end" align="center">
      <Group gap="xs">
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading || isLoadingStorages}
            size={38}
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('Створити акт списання')}>
          <Button
            color="violet"
            disabled={!isLoadingStorages && storages.length === 0}
            leftSection={<IconPlus size={16} />}
            loading={isLoadingStorages}
            onClick={openCreateModal}
          >
            {t('Створити акт списання')}
          </Button>
        </Tooltip>
      </Group>
    </Group>
  )
}

function DepreciatedOrdersTableCard({ model }: { model: ReturnType<typeof useDepreciatedOrdersPageModel> }) {
  const { t } = useI18n()
  const {
    columns, error, filterDraft, filterError, hasMore, isLoading, isLoadingMore, loadMoreOrders, openDetail, orders,
    pageSize, reload, resetFilters, applyFilters, setPageSize, storageError, toolbarLeft,
  } = model

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            label={t('Від якої дати')}
            max={filterDraft.to || undefined}
            type="date"
            value={filterDraft.from}
            onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
          />
          <TextInput
            label={t('До якої дати')}
            min={filterDraft.from || undefined}
            type="date"
            value={filterDraft.to}
            onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {(error || filterError || storageError) && (
          <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
            {filterError || error || storageError}
          </Alert>
        )}

        <Group justify="flex-end" gap="xs">
          <Select
            aria-label={t('Кількість рядків')}
            data={PAGE_SIZE_OPTIONS}
            size="xs"
            value={String(pageSize)}
            w={88}
            onChange={(value) => {
              setPageSize(Number(value || DEFAULT_PAGE_SIZE))
              reload()
            }}
          />
        </Group>

        <DataTable
          columns={columns}
          data={orders}
          defaultLayout={DEPRECIATED_ORDERS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Актів списання не знайдено')}
          getRowId={(order, index) => String(order.NetUid || order.Id || index)}
          isLoading={isLoading}
          layoutVersion="depreciated-orders-table-1"
          loadingText={t('Завантаження актів списання')}
          maxHeight="calc(100vh - 340px)"
          minWidth={1320}
          tableId="depreciated-orders"
          toolbarLeft={toolbarLeft}
          onRowClick={openDetail}
        />

        {hasMore && (
          <Group justify="center">
            <Button color="gray" loading={isLoadingMore} variant="light" onClick={loadMoreOrders}>
              {t('Завантажити ще')}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  )
}

function useDepreciatedOrderColumns(
  onOpenDetail: (order: DepreciatedOrder) => void,
  indexMap: Map<DepreciatedOrder, number>,
) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<DepreciatedOrder>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        accessor: (order) => indexMap.get(order) || 0,
        cell: (order) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(order) || ''}
          </Text>
        ),
      },
      {
        id: 'management',
        header: t('Управ.'),
        width: 80,
        minWidth: 68,
        align: 'center',
        accessor: (order) => Boolean(order.IsManagement),
        cell: (order) =>
          order.IsManagement ? (
            <Badge color="blue" variant="light">
              {t('Так')}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              {t('Ні')}
            </Text>
          ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 168,
        minWidth: 148,
        accessor: (order) => getDateTime(order.FromDate),
        cell: (order) => <Text fw={600}>{formatDateTime(order.FromDate)}</Text>,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 168,
        minWidth: 140,
        accessor: (order) => order.Number || order.NetUid,
        cell: (order) => <Text fw={700}>{displayValue(order.Number)}</Text>,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 300,
        minWidth: 200,
        accessor: (order) => order.Organization?.Name,
        cell: (order) => displayValue(order.Organization?.Name),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 300,
        minWidth: 200,
        accessor: (order) => order.Storage?.Name,
        cell: (order) => displayValue(order.Storage?.Name),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 240,
        minWidth: 180,
        enableSorting: false,
        accessor: getResponsibleName,
        cell: (order) => displayValue(getResponsibleName(order)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 220,
        accessor: (order) => order.Comment,
        cell: (order) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(order.Comment)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (order) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Деталі')}>
              <ActionIcon aria-label={t('Деталі')} color="gray" variant="subtle" onClick={() => onOpenDetail(order)}>
                <IconEye size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [indexMap, onOpenDetail, t],
  )
}

function buildOrderIndexMap(orders: DepreciatedOrder[]): Map<DepreciatedOrder, number> {
  return orders.reduce((indexMap, order, index) => {
    indexMap.set(order, index + 1)

    return indexMap
  }, new Map<DepreciatedOrder, number>())
}

function getResponsibleName(order: DepreciatedOrder): string {
  const responsible = order.Responsible

  return (
    responsible?.LastName?.trim()
    || responsible?.FullName?.trim()
    || responsible?.Name?.trim()
    || [responsible?.LastName, responsible?.FirstName, responsible?.MiddleName].filter(Boolean).join(' ').trim()
    || ''
  )
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

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getDateTime(value: unknown): number {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime()
  }

  if (typeof value !== 'string' || !value) {
    return 0
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
