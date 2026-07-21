import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Eye, Plus, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { UserRoleType } from '../../../shared/auth/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
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
import './depreciated-orders-page.css'

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
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [totalQty, setTotalQty] = useValueState(0)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const detailRequestRef = useRef(0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const orderIndexMap = useMemo(() => buildOrderIndexMap(orders, (page - 1) * pageSize), [orders, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(totalQty / pageSize))

  const resetOrders = useCallback(() => {
    setOrders([])
    setTotalQty(0)
    setLoading(false)
    setSelectedOrder(null)
  }, [setLoading, setOrders, setSelectedOrder, setTotalQty])

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

  useDepreciatedOrderStoragesLoader({ reloadKey, setLoadingStorages, setStorageError, setStorages })

  useDepreciatedOrdersLoader({
    activeFilters,
    filterError,
    page,
    pageSize,
    reloadKey,
    resetOrders,
    setError,
    setLoading,
    setTotalQty,
    setOrders,
  })

  function applyFilters(nextFilters: FilterDraft) {
    setPage(1)
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setPage(1)
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
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
    filterDraft, filterError, isAdmin, isCreateModalOpen, isCreating, isDetailLoading, isDownloading,
    isLoading, isLoadingStorages, orders, page, pageSize, selectedOrder, storageError, storages, totalPages,
    applyFilters, closeCreateModal, closeDetail, closeDownload, handleCreate,
    openCreateModal, openDetail, openDownload, reload, resetFilters, setExceptionMessages, setPage, setPageSize,
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
  page,
  pageSize,
  reloadKey,
  resetOrders,
  setError,
  setLoading,
  setTotalQty,
  setOrders,
}: {
  activeFilters: FilterDraft
  filterError: string | null
  page: number
  pageSize: number
  reloadKey: number
  resetOrders: () => void
  setError: (value: string | null) => void
  setLoading: (value: boolean) => void
  setTotalQty: (value: number) => void
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
        const result = await getDepreciatedOrders({
          from: activeFilters.from,
          limit: pageSize,
          offset: (page - 1) * pageSize,
          to: activeFilters.to,
        })

        if (!cancelled) {
          setOrders(result.items)
          setTotalQty(result.totalQty)
        }
      } catch (loadError) {
        if (!cancelled) {
          setOrders([])
          setTotalQty(0)
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
  }, [
    activeFilters,
    filterError,
    page,
    pageSize,
    reloadKey,
    resetOrders,
    setError,
    setLoading,
    setOrders,
    setTotalQty,
    t,
  ])
}

export function DepreciatedOrdersPage() {
  const model = useDepreciatedOrdersPageModel()

  return <DepreciatedOrdersPageView model={model} />
}

function DepreciatedOrdersPageView({ model }: { model: ReturnType<typeof useDepreciatedOrdersPageModel> }) {
  return (
    <Stack className="depreciated-orders-page" gap={6}>
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

function DepreciatedOrdersTableCard({ model }: { model: ReturnType<typeof useDepreciatedOrdersPageModel> }) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const {
    columns, error, filterDraft, filterError, isLoading, isLoadingStorages, openDetail, orders, page, pageSize,
    reload, resetFilters, applyFilters, setPage, setPageSize, storageError, totalPages,
  } = model

  return (
    <Card className="app-data-card depreciated-orders-card" withBorder radius="md" padding={0}>
      <div className="app-filter-bar depreciated-orders-filter-bar">
        <div className="app-filter-date-range">
          <TextInput
            label={t('Від')}
            max={filterDraft.to || undefined}
            type="date"
            value={filterDraft.from}
            onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
          />
          <TextInput
            label={t('До')}
            min={filterDraft.from || undefined}
            type="date"
            value={filterDraft.to}
            onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
          />
        </div>
        <div className="app-filter-actions depreciated-orders-filter-actions">
          <Tooltip label={t('Скинути')}>
            <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
              <RotateCcw size={17} />
            </ActionIcon>
          </Tooltip>
          <Paginator
            isLoading={isLoading || isLoadingStorages}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPage(1)
              setPageSize(nextPageSize)
            }}
            onRefresh={() => reload()}
          />
        </div>
        <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={!model.isLoadingStorages && model.storages.length === 0}
          leftSection={<Plus size={16} />}
          loading={model.isLoadingStorages}
          size="sm"
          styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
          onClick={model.openCreateModal}
        >
          {t('Створити акт списання')}
        </Button>
      </div>

      {(error || filterError || storageError) && (
        <Alert className="depreciated-orders-alert" color={filterError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
          {filterError || error || storageError}
        </Alert>
      )}

      <div className="depreciated-orders-table">
        <DataTable
          columns={columns}
          data={orders}
          defaultLayout={DEPRECIATED_ORDERS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Актів списання не знайдено')}
          getRowId={(order, index) => String(order.NetUid || order.Id || index)}
          height="100%"
          isLoading={isLoading}
          layoutVersion="depreciated-orders-table-1"
          loadingText={t('Завантаження актів списання')}
          minWidth={1320}
          showLayoutControls
          tableId="depreciated-orders"
          toolbarPortalTarget={tableToolbarSlot}
          onRowClick={openDetail}
        />
      </div>
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
            <Badge className="app-role-pill" variant="light">
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
          <Text size="sm" title={displayValue(order.Comment)}>
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
                <Eye size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [indexMap, onOpenDetail, t],
  )
}

function buildOrderIndexMap(orders: DepreciatedOrder[], offset = 0): Map<DepreciatedOrder, number> {
  return orders.reduce((indexMap, order, index) => {
    indexMap.set(order, offset + index + 1)

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
