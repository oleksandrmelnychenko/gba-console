import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import {
  DocumentDetailLayout,
  DocumentDetailMetric,
  DocumentDetailRow,
  DocumentDetailSection,
  DocumentDetailSummary,
} from '../../../shared/ui/document-detail/DocumentDetail'
import { CircleAlert, FileDown, Plus, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { formatLocalDate, toDateTimeQuery } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { usePermissions } from '../../auth/usePermissions'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import {
  exportProductCapitalization,
  getProductCapitalization,
  getProductCapitalizations,
} from '../api/productCapitalizationsApi'
import { NewProductCapitalizationPanel } from '../components/NewProductCapitalizationPanel'
import type {
  ProductCapitalization,
  ProductCapitalizationItem,
  ProductCapitalizationsExportDocument,
} from '../types'
import './product-capitalizations-page.css'

type FilterDraft = {
  from: string
  to: string
}

type ProductCapitalizationsListState = {
  capitalizations: ProductCapitalization[]
  hasNextPage: boolean
  isLoading: boolean
  total: number | null
}

type ProductCapitalizationsListAction =
  | { type: 'blocked' }
  | { type: 'failed' }
  | { type: 'loaded'; items: ProductCapitalization[]; pageSize: number; total: number | null }
  | { type: 'loading' }

const PRODUCT_CAPITALIZATIONS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'fromDate', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PRODUCT_CAPITALIZATION_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const initialListState: ProductCapitalizationsListState = {
  capitalizations: [],
  hasNextPage: false,
  isLoading: false,
  total: null,
}

function productCapitalizationsListReducer(
  state: ProductCapitalizationsListState,
  action: ProductCapitalizationsListAction,
): ProductCapitalizationsListState {
  switch (action.type) {
    case 'blocked':
    case 'failed':
      return initialListState
    case 'loaded':
      return {
        capitalizations: action.items,
        hasNextPage: action.items.length === action.pageSize,
        isLoading: false,
        total: action.total,
      }
    case 'loading':
      return {
        ...state,
        isLoading: true,
      }
  }
}

function useProductCapitalizationsPageModel() {
  const { t } = useI18n()
  const { can } = usePermissions()
  const canCreate = can(PermissionKeys.WarehouseAccounting.Capitalization.Capitalization.Create)
  const canOpenDetails = can(PermissionKeys.WarehouseAccounting.Capitalization.Capitalization.OpenDetails)
  const canExport = can(PermissionKeys.WarehouseAccounting.Capitalization.Document.Export)
  const [searchParams, setSearchParams] = useSearchParams()
  const sourceCapitalizationNetId = searchParams.get('netId') || ''
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: getDateShiftedByDays(-7),
      to: formatLocalDate(new Date()),
    }),
    [],
  )
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [listState, dispatchListState] = useReducer(productCapitalizationsListReducer, initialListState)
  const [selectedCapitalization, setSelectedCapitalization] = useValueState<ProductCapitalization | null>(null)
  const [detailError, setDetailError] = useValueState<string | null>(null)
  const [isDetailLoading, setDetailLoading] = useValueState(false)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [error, setError] = useValueState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductCapitalizationsExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [exportingNetId, setExportingNetId] = useValueState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [createPanelOpened, setCreatePanelOpened] = useValueState(false)
  const detailRequestRef = useRef(0)
  const exportRequestRef = useRef(0)
  const sourceCapitalizationNetIdRef = useRef('')
  const { capitalizations, hasNextPage, isLoading, total } = listState
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const openDetail = useCallback(async (capitalization: ProductCapitalization) => {
    if (!canOpenDetails) {
      return
    }

    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setSelectedCapitalization(capitalization)
    setDetailError(null)

    if (!capitalization.NetUid) {
      return
    }

    setDetailLoading(true)

    try {
      const detailedCapitalization = await getProductCapitalization(capitalization.NetUid)

      if (detailRequestRef.current === requestId) {
        if (detailedCapitalization) {
          setSelectedCapitalization(detailedCapitalization)
        } else {
          setDetailError(t('Оприбуткування не знайдено або видалено'))
        }
      }
    } catch (loadError) {
      if (detailRequestRef.current === requestId) {
        setDetailError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі оприбуткування'))
      }
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false)
      }
    }
  }, [canOpenDetails, setDetailError, setDetailLoading, setSelectedCapitalization, t])
  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1
    sourceCapitalizationNetIdRef.current = ''
    setSelectedCapitalization(null)
    setDetailError(null)
    setDetailLoading(false)
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      nextParams.delete('netId')

      return nextParams
    }, { replace: true })
  }, [setDetailError, setDetailLoading, setSearchParams, setSelectedCapitalization])
  const handleExport = useCallback(async (capitalization: ProductCapitalization) => {
    if (!canExport || !capitalization.NetUid || exportingNetId) {
      return
    }

    const requestId = exportRequestRef.current + 1
    exportRequestRef.current = requestId
    const isCurrentExport = () => exportRequestRef.current === requestId

    setExportingNetId(capitalization.NetUid)
    setError(null)
    setDetailError(null)

    setDownloadDocument(null)
    setDownloadError(null)
    setDownloadModalOpened(true)

    try {
      const document = await exportProductCapitalization(capitalization.NetUid)

      if (isCurrentExport()) {
        setDownloadDocument(document)
      }
    } catch (exportError) {
      if (isCurrentExport()) {
        setDownloadError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт оприбуткування'))
      }
    } finally {
      if (isCurrentExport()) {
        setExportingNetId(null)
      }
    }
  }, [
    canExport,
    exportingNetId,
    setDetailError,
    setDownloadDocument,
    setDownloadError,
    setDownloadModalOpened,
    setError,
    setExportingNetId,
    t,
  ])
  const columns = useProductCapitalizationColumns(
    capitalizations,
    openDetail,
    handleExport,
    exportingNetId,
    canOpenDetails,
    canExport,
  )
  const detailItems = useMemo(
    () => selectedCapitalization?.ProductCapitalizationItems || [],
    [selectedCapitalization?.ProductCapitalizationItems],
  )
  const itemColumns = useProductCapitalizationItemColumns(detailItems)
  const canMoveForward = total !== null ? page * pageSize < total : hasNextPage

  useEffect(() => {
    if (!sourceCapitalizationNetId) {
      sourceCapitalizationNetIdRef.current = ''
      return
    }

    if (sourceCapitalizationNetIdRef.current === sourceCapitalizationNetId) {
      return
    }

    sourceCapitalizationNetIdRef.current = sourceCapitalizationNetId
    void openDetail({ NetUid: sourceCapitalizationNetId })
  }, [openDetail, sourceCapitalizationNetId])

  useEffect(() => {
    if (filterError) {
      dispatchListState({ type: 'blocked' })
      return
    }

    let cancelled = false

    async function loadCapitalizations() {
      dispatchListState({ type: 'loading' })
      setError(null)

      try {
        const response = await getProductCapitalizations({
          from: toDateTimeQuery(activeFilters.from, 'start'),
          limit: pageSize,
          offset,
          to: toDateTimeQuery(activeFilters.to, 'end'),
        })

        if (!cancelled) {
          dispatchListState({
            type: 'loaded',
            items: response.Items,
            pageSize,
            total: response.Total,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchListState({ type: 'failed' })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити оприбуткування товарів'))
        }
      }
    }

    void loadCapitalizations()

    return () => {
      cancelled = true
    }
  }, [activeFilters.from, activeFilters.to, filterError, offset, pageSize, reloadKey, setError, t])

  function updateFilters(patch: Partial<FilterDraft>) {
    setPage(1)
    setActiveFilters((current) => ({ ...current, ...patch }))
  }

  function resetFilters() {
    setPage(1)
    setActiveFilters(initialFilters)
  }

  return {
    activeFilters,
    canCreate,
    canExport,
    canOpenDetails,
    canMoveForward,
    capitalizations,
    columns,
    createPanelOpened,
    detailError,
    downloadDocument,
    downloadError,
    downloadModalOpened,
    error,
    exportingNetId,
    filterError,
    isDetailLoading,
    isLoading,
    itemColumns,
    page,
    pageSize,
    selectedCapitalization,
    handleExport,
    closeDetail,
    openDetail,
    reload,
    resetFilters,
    setCreatePanelOpened,
    setDownloadModalOpened,
    setPage,
    setPageSize,
    updateFilters,
  }
}

export function ProductCapitalizationsPage() {
  const { t } = useI18n()
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return <Text c="dimmed">{t('Завантаження')}</Text>
  }

  if (!can(PermissionKeys.WarehouseAccounting.Capitalization.Page.View)) {
    return (
      <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
        {t('Недостатньо прав для перегляду оприбуткувань товарів')}
      </Alert>
    )
  }

  return <ProductCapitalizationsPageContent />
}

function ProductCapitalizationsPageContent() {
  const model = useProductCapitalizationsPageModel()

  return <ProductCapitalizationsPageView model={model} />
}

function ProductCapitalizationsPageView({ model }: { model: ReturnType<typeof useProductCapitalizationsPageModel> }) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const {
    activeFilters,
    canCreate,
    canExport,
    canOpenDetails,
    canMoveForward,
    capitalizations,
    columns,
    createPanelOpened,
    detailError,
    downloadDocument,
    downloadError,
    downloadModalOpened,
    error,
    exportingNetId,
    filterError,
    isDetailLoading,
    isLoading,
    itemColumns,
    page,
    pageSize,
    selectedCapitalization,
    closeDetail,
    handleExport,
    openDetail,
    reload,
    resetFilters,
    setCreatePanelOpened,
    setDownloadModalOpened,
    setPage,
    setPageSize,
    updateFilters,
  } = model

  return (
    <Stack className="product-capitalizations-page" gap={6}>
      <Card className="app-data-card product-capitalizations-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-capitalizations-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="product-capitalizations-filter-row">
            <div className="app-filter-date-range">
              <TextInput
                label={t('Від')}
                type="date"
                value={activeFilters.from}
                onChange={(event) => updateFilters({ from: event.currentTarget.value })}
              />
              <TextInput
                label={t('До')}
                type="date"
                value={activeFilters.to}
                onChange={(event) => updateFilters({ to: event.currentTarget.value })}
              />
            </div>
            <div className="product-capitalizations-filter-spacer" />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                hasNext={canMoveForward}
                isLoading={isLoading}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPage(1)
                  setPageSize(nextPageSize)
                }}
                onRefresh={reload}
              />
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
            {canCreate && (
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Plus size={16} />}
                size="sm"
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                onClick={() => setCreatePanelOpened(true)}
              >
                {t('Нове оприбуткування')}
              </Button>
            )}
          </Group>
        </div>

        {(error || filterError) && (
          <Alert
            className="product-capitalizations-page__alert"
            color={filterError ? 'yellow' : 'red'}
            icon={<CircleAlert size={18} />}
            variant="light"
          >
            {filterError || error}
          </Alert>
        )}

        <div className="product-capitalizations-page__table">
          <DataTable
            columns={columns}
            data={capitalizations}
            defaultLayout={PRODUCT_CAPITALIZATIONS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Оприбуткувань не знайдено')}
            getRowId={(capitalization, index) => String(capitalization.NetUid || capitalization.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="product-capitalizations-table-1"
            loadingText={t('Завантаження оприбуткувань')}
            minWidth={1280}
            showLayoutControls
            tableId="product-capitalizations"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={canOpenDetails ? openDetail : undefined}
          />
        </div>
      </Card>

      {createPanelOpened && canCreate && (
        <NewProductCapitalizationPanel
          canCreate={canCreate}
          opened={createPanelOpened}
          onClose={() => setCreatePanelOpened(false)}
          onCreated={() => {
            setPage(1)
            reload()
          }}
        />
      )}

      <ProductCapitalizationDetailDrawer
        capitalization={selectedCapitalization}
        detailError={detailError}
        exportingNetId={exportingNetId}
        isLoading={isDetailLoading}
        itemColumns={itemColumns}
        onClose={closeDetail}
        onExport={canExport ? handleExport : undefined}
      />

      <DocumentExportModal
        document={downloadDocument}
        error={downloadError}
        isLoading={Boolean(exportingNetId)}
        opened={downloadModalOpened}
        title={t('Друк PDF')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

export function ProductCapitalizationDetailDrawer({
  capitalization,
  detailError,
  exportingNetId,
  isLoading,
  itemColumns,
  onClose,
  onExport,
}: {
  capitalization: ProductCapitalization | null
  detailError: string | null
  exportingNetId: string | null
  isLoading: boolean
  itemColumns: DataTableColumn<ProductCapitalizationItem>[]
  onClose: () => void
  onExport?: (capitalization: ProductCapitalization) => void
}) {
  const { t } = useI18n()
  const items = useMemo(
    () => capitalization?.ProductCapitalizationItems || [],
    [capitalization?.ProductCapitalizationItems],
  )
  const totals = useMemo(() => calculateItemTotals(items), [items])

  return (
    <AppDrawer
      opened={Boolean(capitalization)}
      position="right"
      size="wide"
      title={t('Оприбуткування')}
      onClose={onClose}
    >
      {capitalization && (
        <DocumentDetailLayout
          summary={
            <DocumentDetailSummary
              eyebrow={t('Оприбуткування')}
              title={displayValue(capitalization.Number)}
              meta={formatDateTime(capitalization.FromDate)}
              metrics={
                <>
                  <DocumentDetailMetric label={t('Кількість')} value={formatAmount(totals.qty)} />
                  <DocumentDetailMetric label={t('Сума')} value={formatMoney(totals.amount)} />
                  <DocumentDetailMetric label={t('Вага')} value={formatAmount(totals.weight)} />
                </>
              }
            />
          }
          actions={
            <Group justify="flex-end">
              {onExport && (
                <Button
                  color={CREATE_ACTION_COLOR}
                  disabled={!capitalization.NetUid || Boolean(exportingNetId)}
                  leftSection={<FileDown size={16} />}
                  loading={exportingNetId === capitalization.NetUid}
                  onClick={() => onExport(capitalization)}
                >
                  {t('Друк PDF')}
                </Button>
              )}
            </Group>
          }
        >
          <DocumentDetailSection subtitle={displayValue(capitalization.Number)} title={t('Документ')}>
            <DocumentDetailRow label={t('Дата')} mono value={formatDateTime(capitalization.FromDate)} />
            <DocumentDetailRow label={t('Номер')} mono value={capitalization.Number} />
            <DocumentDetailRow label={t('Сума')} mono value={formatMoney(capitalization.TotalAmount)} />
            {capitalization.Comment && (
              <DocumentDetailRow label={t('Коментар')} value={capitalization.Comment} wide />
            )}
          </DocumentDetailSection>

          <DocumentDetailSection title={t('Учасники та склад')}>
            <DocumentDetailRow label={t('Організація')} value={capitalization.Organization?.Name} wide />
            <DocumentDetailRow label={t('Склад')} value={capitalization.Storage?.Name} />
            <DocumentDetailRow label={t('Відповідальний')} value={getResponsibleName(capitalization)} />
          </DocumentDetailSection>

          <DocumentDetailSection stacked subtitle={String(items.length)} title={t('Позиції')}>
            {detailError && (
              <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                {detailError}
              </Alert>
            )}
            <DataTable
              columns={itemColumns}
              data={items}
              defaultLayout={PRODUCT_CAPITALIZATION_ITEMS_TABLE_DEFAULT_LAYOUT}
              emptyText={t('Позицій не знайдено')}
              getRowId={(item, index) => String(item.NetUid || item.Id || `${getItemVendorCode(item)}-${index}`)}
              isLoading={isLoading}
              layoutVersion="product-capitalization-items-table-1"
              loadingText={t('Завантаження позицій оприбуткування')}
              maxHeight="calc(100vh - 420px)"
              minWidth={920}
              showToolbar={false}
              tableId="product-capitalization-items"
            />
          </DocumentDetailSection>
        </DocumentDetailLayout>
      )}
    </AppDrawer>
  )
}

function useProductCapitalizationColumns(
  capitalizations: ProductCapitalization[],
  onOpenDetail: (capitalization: ProductCapitalization) => void,
  onExport: (capitalization: ProductCapitalization) => void,
  exportingNetId: string | null,
  canOpenDetails: boolean,
  canExport: boolean,
): DataTableColumn<ProductCapitalization>[] {
  return useMemo<DataTableColumn<ProductCapitalization>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (capitalization) => String(capitalizations.indexOf(capitalization) + 1),
      },
      {
        id: 'fromDate',
        header: 'Дата',
        width: 168,
        minWidth: 148,
        accessor: (capitalization) => capitalization.FromDate,
        cell: (capitalization) => formatDateTime(capitalization.FromDate),
      },
      {
        id: 'number',
        header: 'Номер',
        width: 180,
        minWidth: 150,
        accessor: (capitalization) => capitalization.Number,
        cell: (capitalization) => <Text fw={700}>{displayValue(capitalization.Number)}</Text>,
      },
      {
        id: 'amount',
        header: 'Сума',
        width: 128,
        minWidth: 112,
        align: 'right',
        accessor: (capitalization) => capitalization.TotalAmount,
        cell: (capitalization) => formatMoney(capitalization.TotalAmount),
      },
      {
        id: 'currency',
        header: 'Валюта',
        width: 92,
        minWidth: 84,
        cell: () => 'EUR',
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 220,
        minWidth: 170,
        accessor: (capitalization) => capitalization.Storage?.Name,
        cell: (capitalization) => displayValue(capitalization.Storage?.Name),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 260,
        minWidth: 190,
        accessor: (capitalization) => capitalization.Organization?.Name,
        cell: (capitalization) => displayValue(capitalization.Organization?.Name),
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 190,
        minWidth: 150,
        accessor: getResponsibleName,
        cell: (capitalization) => displayValue(getResponsibleName(capitalization)),
      },
      {
        id: 'comment',
        header: 'Коментар',
        width: 300,
        minWidth: 200,
        accessor: (capitalization) => capitalization.Comment,
        cell: (capitalization) => (
          <Text size="sm" title={displayValue(capitalization.Comment)}>
            {displayValue(capitalization.Comment)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 96,
        minWidth: 84,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        cell: (capitalization) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Group gap={4} justify="center" wrap="nowrap">
              {canOpenDetails && (
                <TableRowAction action="details" label="Деталі" onClick={() => onOpenDetail(capitalization)} />
              )}
              {canExport && (
                <TableRowAction
                  action="print"
                  disabled={!capitalization.NetUid || Boolean(exportingNetId)}
                  label="Друк PDF"
                  loading={exportingNetId === capitalization.NetUid}
                  tone="brand"
                  onClick={() => onExport(capitalization)}
                />
              )}
            </Group>
          </Box>
        ),
      },
    ],
    [canExport, canOpenDetails, capitalizations, exportingNetId, onExport, onOpenDetail],
  )
}

function useProductCapitalizationItemColumns(
  items: ProductCapitalizationItem[],
): DataTableColumn<ProductCapitalizationItem>[] {
  return useMemo<DataTableColumn<ProductCapitalizationItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (item) => String(items.indexOf(item) + 1),
      },
      {
        id: 'vendorCode',
        header: 'Код товару',
        width: 150,
        minWidth: 124,
        accessor: getItemVendorCode,
        cell: (item) => <Text fw={700}>{displayValue(getItemVendorCode(item))}</Text>,
      },
      {
        id: 'productName',
        header: 'Товар',
        width: 320,
        minWidth: 240,
        accessor: getItemProductName,
        cell: (item) => (
          <Text fw={600} lineClamp={2}>
            {displayValue(getItemProductName(item))}
          </Text>
        ),
      },
      {
        id: 'weight',
        header: 'Вага',
        width: 108,
        minWidth: 96,
        align: 'right',
        accessor: (item) => item.Weight,
        cell: (item) => formatAmount(item.Weight),
      },
      {
        id: 'unitPrice',
        header: 'Ціна',
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.UnitPrice,
        cell: (item) => formatMoney(item.UnitPrice),
      },
      {
        id: 'qty',
        header: 'Кількість',
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => formatAmount(item.Qty),
      },
      {
        id: 'amount',
        header: 'Сума',
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (item) => item.TotalAmount,
        cell: (item) => formatMoney(item.TotalAmount),
      },
      {
        id: 'remainingQty',
        header: 'Залишок',
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.RemainingQty,
        cell: (item) => formatAmount(item.RemainingQty),
      },
    ],
    [items],
  )
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return 'Заповніть період'
  }

  if (from > to) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function getResponsibleName(capitalization: ProductCapitalization): string | undefined {
  const responsible = capitalization.Responsible

  if (!responsible) {
    return undefined
  }

  return [responsible.LastName, responsible.FirstName, responsible.MiddleName].filter(Boolean).join(' ') || responsible.Name
}

function getItemVendorCode(item: ProductCapitalizationItem): string | undefined {
  return item.Product?.VendorCode || item.ProductVendorCode
}

function getItemProductName(item: ProductCapitalizationItem): string | undefined {
  return item.Product?.Name || item.ProductName
}

function calculateItemTotals(items: ProductCapitalizationItem[]) {
  return items.reduce(
    (totals, item) => ({
      amount: totals.amount + readFiniteNumber(item.TotalAmount),
      qty: totals.qty + readFiniteNumber(item.Qty),
      weight: totals.weight + readFiniteNumber(item.Weight) * readFiniteNumber(item.Qty),
    }),
    { amount: 0, qty: 0, weight: 0 },
  )
}

function readFiniteNumber(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return amountFormatter.format(value)
}

function formatMoney(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return moneyFormatter.format(value)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
