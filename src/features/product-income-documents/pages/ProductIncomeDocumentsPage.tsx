import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import { TableChip, type TableChipTone } from '../../../shared/ui/TableChip'
import {
  Alert,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CalendarDays, Check, ChevronRight, CircleAlert, Download, ExternalLink, Eye, Layers, RotateCcw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatLocalDate, toDateTimeQuery } from '../../../shared/date/dateTime'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  DocumentDetailChip,
  DocumentDetailLayout,
  DocumentDetailRow,
  DocumentDetailSection,
  DocumentDetailSummary,
} from '../../../shared/ui/document-detail/DocumentDetail'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DocumentExportModal } from '../../../shared/ui/document-export-modal/DocumentExportModal'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  ProductMovementHistoryDrawer,
  ProductStorageLocationHistoryDrawer,
  type MovementHistoryProduct,
} from '../../../shared/ui/product-movement-history/ProductMovementHistoryDrawers'
import { assortmentMovementRequestPaths } from '../../../shared/ui/product-movement-history/productMovementHistoryRequestPaths'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { usePermissions } from '../../auth/usePermissions'
import { getProductCapitalizationForIncomeDocuments } from '../../product-capitalizations/api/productCapitalizationsApi'
import type { ProductCapitalization } from '../../product-capitalizations/types'
import {
  exportProductIncomeDocument,
  getProductIncomeDocuments,
  getProductIncomeInfo,
  getProductIncomeInfoForRemainings,
  getProductIncomeRemainings,
} from '../api/productIncomeDocumentsApi'
import { getProductIncomeDocumentSourceLink } from '../productIncomeDocumentSourceLink'
import {
  getIncomeItemProduct,
  getIncomeReturnTotals,
  getItemProductCode,
  getItemProductName,
  getOverviewKind,
  mapDocumentRow,
  type DocumentRow,
} from '../productIncomeDocumentRows'
import { getActiveProductIncomeItems } from '../productIncomeDocumentItems'
import type {
  NamedEntity,
  ProductIncomeDocument,
  ProductIncomeDocumentsExportDocument,
  ProductIncomeInfo,
  ProductIncomeItem,
  RemainingConsignment,
} from '../types'
import './product-income-documents-page.css'
import './product-income-document-detail.css'

const FILTER_STORAGE_KEY = 'documentsFilters'
const PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE

const DOCUMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'number', 'type'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'productName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const REMAININGS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['storage', 'productCode', 'productName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type DocumentsListState = {
  documents: ProductIncomeDocument[]
  isLoading: boolean
  total?: number
}

function useProductIncomeDocumentsPageModel({
  canExportDocument,
  canExportMovement,
  canOpenDetails,
  canOpenMovement,
  canOpenRemainings,
  canOpenStorageHistory,
}: {
  canExportDocument: boolean
  canExportMovement: boolean
  canOpenDetails: boolean
  canOpenMovement: boolean
  canOpenRemainings: boolean
  canOpenStorageHistory: boolean
}) {
  const { t } = useI18n()
  const restoredFilters = useMemo(() => readStoredFilters(), [])
  const [documentsState, setDocumentsState] = useValueState<DocumentsListState>({
    documents: [],
    isLoading: false,
    total: undefined,
  })
  const [dateFrom, setDateFrom] = useValueState(restoredFilters.from)
  const [dateTo, setDateTo] = useValueState(restoredFilters.to)
  const [searchDraft, setSearchDraft] = useValueState(restoredFilters.value)
  const [searchValue, setSearchValue] = useValueState(restoredFilters.value)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [error, setError] = useValueState<string | null>(null)
  const [optionsDocument, setOptionsDocument] = useValueState<ProductIncomeDocument | null>(null)
  const [selectedDocument, setSelectedDocument] = useValueState<ProductIncomeDocument | null>(null)
  const [movementHistoryProduct, setMovementHistoryProduct] = useValueState<MovementHistoryProduct | null>(null)
  const [storageLocationHistoryProduct, setStorageLocationHistoryProduct] = useValueState<MovementHistoryProduct | null>(null)
  const [documentInfoError, setDocumentInfoError] = useValueState<string | null>(null)
  const [detailMode, setDetailMode] = useValueState<'view' | 'remainings'>('view')
  const [isLoadingDocumentInfo, setLoadingDocumentInfo] = useValueState(false)
  const [capitalization, setCapitalization] = useValueState<ProductCapitalization | null>(null)
  const [isLoadingCapitalization, setLoadingCapitalization] = useValueState(false)
  const [capitalizationError, setCapitalizationError] = useValueState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductIncomeDocumentsExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [exportingNetId, setExportingNetId] = useValueState<string | null>(null)
  const [remainings, setRemainings] = useValueState<RemainingConsignment[]>([])
  const [remainingsError, setRemainingsError] = useValueState<string | null>(null)
  const [isLoadingRemainings, setLoadingRemainings] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const remainingsRequestRef = useRef(0)
  const capitalizationRequestRef = useRef(0)
  const infoRequestRef = useRef(0)
  const exportRequestRef = useRef(0)
  const { documents, isLoading, total } = documentsState
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateFrom, dateTo)
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : documents.length === pageSize
  const totalPages =
    typeof total === 'number' && total > 0
      ? Math.max(1, Math.ceil(total / pageSize))
      : page + (canMoveForward ? 1 : 0)
  const openOptions = useCallback(
    (document: ProductIncomeDocument) => {
      setOptionsDocument(document)
    },
    [setOptionsDocument],
  )
  const loadCapitalization = useCallback(
    (capitalizationNetUid: string) => {
      const requestId = capitalizationRequestRef.current + 1
      capitalizationRequestRef.current = requestId
      setCapitalization(null)
      setCapitalizationError(null)
      setLoadingCapitalization(true)

      async function run() {
        try {
          const detail = await getProductCapitalizationForIncomeDocuments(capitalizationNetUid)

          if (capitalizationRequestRef.current === requestId) {
            setCapitalization(detail)
          }
        } catch (loadError) {
          if (capitalizationRequestRef.current === requestId) {
            setCapitalizationError(
              loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі оприбуткування'),
            )
          }
        } finally {
          if (capitalizationRequestRef.current === requestId) {
            setLoadingCapitalization(false)
          }
        }
      }

      void run()
    },
    [setCapitalization, setCapitalizationError, setLoadingCapitalization, t],
  )
  const loadDocumentInfo = useCallback(
    (document: ProductIncomeDocument, options: { loadCapitalizationDetail: boolean; scope: 'details' | 'remainings' }) => {
      const requestId = infoRequestRef.current + 1
      infoRequestRef.current = requestId
      const isCurrentInfoRequest = () => infoRequestRef.current === requestId
      setDocumentInfoError(null)

      if (!document.NetUid) {
        setLoadingDocumentInfo(false)
        return
      }

      setLoadingDocumentInfo(true)

      async function run(netUid: string) {
        try {
          const info = options.scope === 'remainings'
            ? await getProductIncomeInfoForRemainings(netUid)
            : await getProductIncomeInfo(netUid)

          if (isCurrentInfoRequest()) {
            const detailedDocument = mergeProductIncomeInfo(document, info)

            setSelectedDocument((current) =>
              current && current.NetUid === netUid ? mergeProductIncomeInfo(current, info) : current,
            )

            if (options.loadCapitalizationDetail) {
              const capitalizationNetUid = getCapitalizationNetUid(detailedDocument)

              if (capitalizationNetUid) {
                loadCapitalization(capitalizationNetUid)
              }
            }
          }
        } catch (loadError) {
          if (isCurrentInfoRequest()) {
            setDocumentInfoError(
              loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі документа приходу'),
            )
          }
        } finally {
          if (isCurrentInfoRequest()) {
            setLoadingDocumentInfo(false)
          }
        }
      }

      void run(document.NetUid)
    },
    [loadCapitalization, setDocumentInfoError, setLoadingDocumentInfo, setSelectedDocument, t],
  )
  const openOverview = useCallback(
    (document: ProductIncomeDocument) => {
      if (!canOpenDetails) {
        return
      }
      remainingsRequestRef.current += 1
      capitalizationRequestRef.current += 1
      setOptionsDocument(null)
      setDetailMode('view')
      setSelectedDocument(document)
      setRemainings([])
      setRemainingsError(null)
      setDocumentInfoError(null)
      setCapitalization(null)
      setCapitalizationError(null)

      const capitalizationNetUid = getCapitalizationNetUid(document)

      if (capitalizationNetUid) {
        loadCapitalization(capitalizationNetUid)
      }

      loadDocumentInfo(document, { loadCapitalizationDetail: !capitalizationNetUid, scope: 'details' })
    },
    [
      canOpenDetails,
      loadCapitalization,
      loadDocumentInfo,
      setCapitalization,
      setCapitalizationError,
      setDetailMode,
      setDocumentInfoError,
      setOptionsDocument,
      setRemainings,
      setRemainingsError,
      setSelectedDocument,
    ],
  )
  const fetchRemainings = useCallback(
    (document: ProductIncomeDocument) => {
      if (!document.NetUid) {
        setRemainings([])
        setRemainingsError(t('Документ приходу не має NetUid для завантаження залишків по партіях'))
        return
      }

      const requestId = remainingsRequestRef.current + 1
      remainingsRequestRef.current = requestId
      setLoadingRemainings(true)
      setRemainingsError(null)

      async function run(netUid: string) {
        try {
          const nextRemainings = await getProductIncomeRemainings(netUid)

          if (remainingsRequestRef.current === requestId) {
            setRemainings(nextRemainings)
          }
        } catch (loadError) {
          if (remainingsRequestRef.current === requestId) {
            setRemainings([])
            setRemainingsError(
              loadError instanceof Error ? loadError.message : t('Не вдалося завантажити залишки по партіях'),
            )
          }
        } finally {
          if (remainingsRequestRef.current === requestId) {
            setLoadingRemainings(false)
          }
        }
      }

      void run(document.NetUid)
    },
    [setLoadingRemainings, setRemainings, setRemainingsError, t],
  )
  const openRemainings = useCallback(
    (document: ProductIncomeDocument) => {
      if (!canOpenRemainings) {
        return
      }
      capitalizationRequestRef.current += 1
      setOptionsDocument(null)
      setDetailMode('remainings')
      setSelectedDocument(document)
      setRemainings([])
      setRemainingsError(null)
      setDocumentInfoError(null)
      setCapitalization(null)
      setCapitalizationError(null)
      loadDocumentInfo(document, { loadCapitalizationDetail: false, scope: 'remainings' })
      fetchRemainings(document)
    },
    [
      canOpenRemainings,
      fetchRemainings,
      loadDocumentInfo,
      setCapitalization,
      setCapitalizationError,
      setDetailMode,
      setDocumentInfoError,
      setOptionsDocument,
      setRemainings,
      setRemainingsError,
      setSelectedDocument,
    ],
  )
  const rows = useMemo(() => documents.map(mapDocumentRow), [documents])
  const columns = useProductIncomeDocumentColumns({
    canExport: canExportDocument,
    exportingNetId,
    onExport: handleExport,
    onOpen: openOptions,
  })
  const itemColumns = useProductIncomeItemColumns({
    canOpenMovement,
    canOpenStorageHistory,
    onOpenMovementHistory: setMovementHistoryProduct,
    onOpenStorageLocationHistory: setStorageLocationHistoryProduct,
  })
  const remainingColumns = useRemainingConsignmentColumns({
    canOpenMovement,
    canOpenStorageHistory,
    onOpenMovementHistory: setMovementHistoryProduct,
    onOpenStorageLocationHistory: setStorageLocationHistoryProduct,
  })
  const capitalizationItemColumns = useCapitalizationOverviewColumns()

  useEffect(() => {
    writeStoredFilters({
      from: dateFrom,
      to: dateTo,
      value: searchValue,
    })
  }, [dateFrom, dateTo, searchValue])

  useEffect(() => {
    if (filterError) {
      setDocumentsState({
        documents: [],
        isLoading: false,
        total: undefined,
      })
      return
    }

    let cancelled = false

    async function loadDocuments() {
      setDocumentsState((currentState) => ({
        ...currentState,
        isLoading: true,
      }))
      setError(null)

      try {
        const response = await getProductIncomeDocuments({
          from: toDateTimeQuery(dateFrom, 'start'),
          limit: pageSize,
          offset,
          to: toDateTimeQuery(dateTo, 'end'),
          value: searchValue,
        })

        if (!cancelled) {
          setDocumentsState({
            documents: response.Items,
            isLoading: false,
            total: response.Total,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setDocumentsState({
            documents: [],
            isLoading: false,
            total: undefined,
          })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити документи приходу'))
        }
      }
    }

    void loadDocuments()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, filterError, offset, pageSize, reloadKey, searchValue, setDocumentsState, setError, t])

  async function handleExport(document: ProductIncomeDocument) {
    if (!canExportDocument || !document.NetUid) {
      return
    }

    const requestId = exportRequestRef.current + 1
    exportRequestRef.current = requestId
    const isDrawerDocument = selectedDocument?.NetUid === document.NetUid
    setExportingNetId(document.NetUid)
    if (isDrawerDocument) {
      setDocumentInfoError(null)
    } else {
      setError(null)
    }

    try {
      const nextDocument = await exportProductIncomeDocument(document.NetUid)

      if (exportRequestRef.current === requestId) {
        setDownloadDocument(nextDocument)
        setDownloadModalOpened(true)
      }
    } catch (exportError) {
      if (exportRequestRef.current === requestId) {
        const message = exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ')

        if (isDrawerDocument) {
          setDocumentInfoError(message)
        } else {
          setError(message)
        }
      }
    } finally {
      if (exportRequestRef.current === requestId) {
        setExportingNetId(null)
      }
    }
  }

  function clearTransientSelection() {
    exportRequestRef.current += 1
    setExportingNetId(null)
    setDownloadModalOpened(false)
    setOptionsDocument(null)
    setMovementHistoryProduct(null)
    setStorageLocationHistoryProduct(null)
    closeDetails()
  }

  function updateSearch(nextSearchValue: string) {
    clearTransientSelection()
    setPage(1)
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetFilters() {
    const defaults = getDefaultFilters()

    clearTransientSelection()
    setDateFrom(defaults.from)
    setDateTo(defaults.to)
    setSearchDraft('')
    setSearchValue('')
    setPage(1)
    window.localStorage.removeItem(FILTER_STORAGE_KEY)
  }

  function closeDetails() {
    remainingsRequestRef.current += 1
    capitalizationRequestRef.current += 1
    infoRequestRef.current += 1
    setDetailMode('view')
    setSelectedDocument(null)
    setDocumentInfoError(null)
    setLoadingDocumentInfo(false)
    setRemainings([])
    setRemainingsError(null)
    setLoadingRemainings(false)
    setCapitalization(null)
    setCapitalizationError(null)
    setLoadingCapitalization(false)
  }

  return {
    capitalization,
    capitalizationError,
    capitalizationItemColumns,
    canExportDocument,
    canExportMovement,
    canOpenDetails,
    canOpenRemainings,
    columns,
    dateFrom,
    dateTo,
    detailMode,
    documentInfoError,
    downloadDocument,
    downloadModalOpened,
    error,
    exportingNetId,
    filterError,
    isLoading,
    isLoadingCapitalization,
    isLoadingDocumentInfo,
    isLoadingRemainings,
    itemColumns,
    movementHistoryProduct,
    optionsDocument,
    page,
    pageSize,
    remainingColumns,
    remainings,
    remainingsError,
    rows,
    searchDraft,
    selectedDocument,
    storageLocationHistoryProduct,
    totalPages,
    clearTransientSelection,
    closeDetails,
    handleExport,
    openOptions,
    openOverview,
    openRemainings,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setDownloadModalOpened,
    setMovementHistoryProduct,
    setOptionsDocument,
    setPage,
    setPageSize,
    setStorageLocationHistoryProduct,
    updateSearch,
  }
}

export function ProductIncomeDocumentsPage() {
  const { t } = useI18n()
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return <Text c="dimmed">{t('Завантаження')}</Text>
  }

  if (!can(PermissionKeys.ProductIncomeDocuments.Page.View)) {
    return (
      <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
        {t('Недостатньо прав для перегляду прихідних накладних')}
      </Alert>
    )
  }

  return <ProductIncomeDocumentsPageContent />
}

function ProductIncomeDocumentsPageContent() {
  const { can } = usePermissions()
  const model = useProductIncomeDocumentsPageModel({
    canExportDocument: can(PermissionKeys.ProductIncomeDocuments.Document.Export),
    canExportMovement: can(PermissionKeys.ProductsAssortment.Movement.Export),
    canOpenDetails: can(PermissionKeys.ProductIncomeDocuments.Document.OpenDetails),
    canOpenMovement: can(PermissionKeys.ProductsAssortment.Movement.Open),
    canOpenRemainings: can(PermissionKeys.ProductIncomeDocuments.Document.OpenRemainings),
    canOpenStorageHistory: can(PermissionKeys.ProductsAssortment.StorageHistory.Open),
  })

  return <ProductIncomeDocumentsPageView model={model} />
}

function ProductIncomeDocumentsPageView({ model }: { model: ReturnType<typeof useProductIncomeDocumentsPageModel> }) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const {
    capitalization,
    capitalizationError,
    capitalizationItemColumns,
    canExportDocument,
    canExportMovement,
    canOpenDetails,
    canOpenRemainings,
    columns,
    dateFrom,
    dateTo,
    detailMode,
    documentInfoError,
    downloadDocument,
    downloadModalOpened,
    error,
    exportingNetId,
    filterError,
    isLoading,
    isLoadingCapitalization,
    isLoadingDocumentInfo,
    isLoadingRemainings,
    itemColumns,
    movementHistoryProduct,
    optionsDocument,
    page,
    pageSize,
    remainingColumns,
    remainings,
    remainingsError,
    rows,
    searchDraft,
    selectedDocument,
    storageLocationHistoryProduct,
    totalPages,
    clearTransientSelection,
    closeDetails,
    handleExport,
    openOptions,
    openOverview,
    openRemainings,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setDownloadModalOpened,
    setMovementHistoryProduct,
    setOptionsDocument,
    setPage,
    setPageSize,
    setStorageLocationHistoryProduct,
    updateSearch,
  } = model

  return (
    <Stack className="product-income-documents-page" gap={6}>
      <Card className="app-data-card product-income-documents-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-income-documents-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="app-filter-fields product-income-documents-filter-row">
            <ToolbarDateRangeFilter from={dateFrom} to={dateTo} onChange={({ from, to }) => { clearTransientSelection(); setPage(1); setDateFrom(from); setDateTo(to) }} />
            <TextInput
              size="sm"
              leftSection={<Search size={16} />}
              label={t('Пошук')}
              placeholder={t('Номер, постачальник або коментар')}
              value={searchDraft}
              className="product-income-documents-search-filter"
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <Button variant="default" size="sm" leftSection={<RotateCcw size={16} />} onClick={resetFilters}>
                  {t('Скинути')}
                </Button>
              </Tooltip>
              <Paginator
                isLoading={isLoading}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                onPageChange={(nextPage) => {
                  clearTransientSelection()
                  setPage(nextPage)
                }}
                onPageSizeChange={(nextPageSize) => {
                  clearTransientSelection()
                  setPage(1)
                  setPageSize(nextPageSize)
                }}
                onRefresh={() => {
                  clearTransientSelection()
                  reload()
                }}
              />
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
          </Group>
        </div>

        {(error || filterError) && (
          <Alert
            className="product-income-documents-page__alert"
            color={filterError ? 'yellow' : 'red'}
            icon={<CircleAlert size={18} />}
            variant="light"
          >
            {filterError || error}
          </Alert>
        )}

        <div className="product-income-documents-page__table">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={DOCUMENTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Документів не знайдено')}
            getRowId={(row, index) => String(row.document.NetUid || row.document.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="product-income-documents-table-2"
            loadingText={t('Завантаження документів')}
            minWidth={1440}
            showLayoutControls
            tableId="product-income-documents"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={(row) => openOptions(row.document)}
          />
        </div>
      </Card>

      <ProductIncomeOptionsModal
        canOpenDetails={canOpenDetails}
        canOpenRemainings={canOpenRemainings}
        document={optionsDocument}
        onClose={() => setOptionsDocument(null)}
        onOverview={openOverview}
        onRemainings={openRemainings}
      />

      <ProductIncomeDocumentDrawer
        canExport={canExportDocument}
        canOpenRemainings={canOpenRemainings}
        capitalization={capitalization}
        capitalizationError={capitalizationError}
        capitalizationItemColumns={capitalizationItemColumns}
        detailMode={detailMode}
        documentInfoError={documentInfoError}
        document={selectedDocument}
        exportingNetId={exportingNetId}
        isLoadingCapitalization={isLoadingCapitalization}
        isLoadingDocumentInfo={isLoadingDocumentInfo}
        isLoadingRemainings={isLoadingRemainings}
        itemColumns={itemColumns}
        remainingColumns={remainingColumns}
        remainings={remainings}
        remainingsError={remainingsError}
        onClose={closeDetails}
        onExport={handleExport}
        onLoadRemainings={openRemainings}
      />

      <ProductMovementHistoryDrawer
        canExport={canExportMovement}
        opened={Boolean(movementHistoryProduct)}
        product={movementHistoryProduct}
        requestPaths={assortmentMovementRequestPaths}
        onClose={() => setMovementHistoryProduct(null)}
      />

      <ProductStorageLocationHistoryDrawer
        opened={Boolean(storageLocationHistoryProduct)}
        product={storageLocationHistoryProduct}
        requestPath="/products/placements/history/assortment/all/filtered"
        onClose={() => setStorageLocationHistoryProduct(null)}
      />

      <DocumentExportModal
        document={downloadDocument}
        opened={downloadModalOpened}
        title={t('Документ приходу')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

function ProductIncomeOptionsModal({
  canOpenDetails,
  canOpenRemainings,
  document,
  onClose,
  onOverview,
  onRemainings,
}: {
  canOpenDetails: boolean
  canOpenRemainings: boolean
  document: ProductIncomeDocument | null
  onClose: () => void
  onOverview: (document: ProductIncomeDocument) => void
  onRemainings: (document: ProductIncomeDocument) => void
}) {
  const { t } = useI18n()
  const row = document ? mapDocumentRow(document) : null
  const primarySourceLink = document ? getPrimaryProductIncomeSourceLink(document) : null

  return (
    <AppModal
      centered
      className="app-modal--actions"
      opened={Boolean(document)}
      size={496}
      title={document ? (
        <div className="app-modal-action-title">
          <span>{displayValue(row?.type)}</span>
          <TableChip tone="document" value={`№ ${displayValue(document.Number)}`} />
        </div>
      ) : t('Виберіть опцію')}
      onClose={onClose}
    >
      {document && (
        <Stack className="app-modal-actions" gap="xs">
          {primarySourceLink && (
            <Button
              component={Link}
              fullWidth
              justify="flex-start"
              color="dark"
              size="md"
              leftSection={
                <span className="app-action-icon">
                  <ExternalLink size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              to={primarySourceLink}
              rightSection={<ChevronRight size={16} />}
              variant="subtle"
            >
              {t('Відкрити джерело')}
            </Button>
          )}
          {canOpenDetails ? (
            <Button
              fullWidth
              justify="flex-start"
              color="dark"
              size="md"
              leftSection={
                <span className="app-action-icon">
                  <Eye size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              variant="subtle"
              onClick={() => onOverview(document)}
              rightSection={<ChevronRight size={16} />}
            >
              {t('Деталі документа')}
            </Button>
          ) : null}
          {canOpenRemainings ? (
            <Button
              disabled={!document.NetUid}
              fullWidth
              justify="flex-start"
              color="dark"
              size="md"
              leftSection={
                <span className="app-action-icon">
                  <Layers size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              variant="subtle"
              onClick={() => onRemainings(document)}
              rightSection={<ChevronRight size={16} />}
            >
              {t('Залишки за партіями')}
            </Button>
          ) : null}
        </Stack>
      )}
    </AppModal>
  )
}

function getPrimaryProductIncomeSourceLink(document: ProductIncomeDocument): string | null {
  const sourceLink = getProductIncomeDocumentSourceLink(document)

  return sourceLink && sourceLink !== '/sales/return/client' ? sourceLink : null
}

function IncomeMetadataChip({ label, value, tone }: { label: string; value?: string | null; tone: TableChipTone }) {
  return (
    <div className="document-detail-row">
      <span className="document-detail-row__label">{label}</span>
      <span className="document-detail-row__value"><TableChip tone={tone} value={value || '—'} /></span>
    </div>
  )
}

export function ProductIncomeDocumentDrawer({
  canExport,
  canOpenRemainings,
  capitalization,
  capitalizationError,
  capitalizationItemColumns,
  detailMode,
  documentInfoError,
  document,
  exportingNetId,
  isLoadingCapitalization,
  isLoadingDocumentInfo,
  isLoadingRemainings,
  itemColumns,
  remainingColumns,
  remainings,
  remainingsError,
  onClose,
  onExport,
  onLoadRemainings,
}: {
  canExport: boolean
  canOpenRemainings: boolean
  capitalization: ProductCapitalization | null
  capitalizationError: string | null
  capitalizationItemColumns: DataTableColumn<CapitalizationOverviewItem>[]
  detailMode: 'view' | 'remainings'
  documentInfoError: string | null
  document: ProductIncomeDocument | null
  exportingNetId: string | null
  isLoadingCapitalization: boolean
  isLoadingDocumentInfo: boolean
  isLoadingRemainings: boolean
  itemColumns: DataTableColumn<ProductIncomeItem>[]
  remainingColumns: DataTableColumn<RemainingConsignment>[]
  remainings: RemainingConsignment[]
  remainingsError: string | null
  onClose: () => void
  onExport: (document: ProductIncomeDocument) => void
  onLoadRemainings: (document: ProductIncomeDocument) => void
}) {
  const { t } = useI18n()
  const row = document ? mapDocumentRow(document) : null
  const sourceLink = document ? getPrimaryProductIncomeSourceLink(document) : null
  const overviewKind = document ? getOverviewKind(document) : 'document'
  const deferredOverviewNote = document ? getDeferredOverviewNote(document, t) : null
  const returnAgreement = document
    ? getActiveProductIncomeItems(document).find((item) => item.SaleReturnItem)?.SaleReturnItem?.OrderItem?.Order?.Sale?.ClientAgreement?.Agreement
    : null

  return (
    <AppDrawer
      opened={Boolean(document)}
      position="right"
      size="wide"
      title={<span className="product-income-document-title">{t('Документ приходу')}</span>}
      onClose={onClose}
    >
      {document && row && (
        <div className="product-income-document-detail">
        <DocumentDetailLayout
          variant="inventory"
          summary={
            <DocumentDetailSummary
              variant="inventory"
              eyebrow={t('Документ')}
              title={document.Number ? `№ ${document.Number}` : displayValue(document.Number)}
              status={row.docState ? <DocumentDetailChip tone={row.docState === t('Виконано') ? 'success' : 'danger'}
                icon={row.docState === t('Виконано') ? <Check size={13} /> : <X size={13} />}>{row.docState}</DocumentDetailChip> : null}
              meta={<>
                {document.FromDate ? <span className="income-document-date"><CalendarDays size={13} />{formatDateTime(document.FromDate)}</span> : null}
                {row.type ? <span className="income-document-kind">{row.type}</span> : null}
                {overviewKind !== 'saleReturn' && <DocumentDetailChip>{t('Кількість')}: {formatAmount(row.qty)}</DocumentDetailChip>}
              </>}
              metrics={
                <>
                  <div className="document-detail-metric">
                    <span>{t(overviewKind === 'saleReturn' ? 'Сума повернення' : 'Сума документа')}</span>
                    <strong>{row.amount == null ? '—' : formatMoney(row.amount)} <TableChip tone="source" value={row.currency} /></strong>
                  </div>
                </>
              }
            />
          }
          actions={
            <Group justify="flex-end" gap="xs">
              {sourceLink && (
                <Button
                  component={Link}
                  leftSection={<ExternalLink size={16} />}
                  to={sourceLink}
                  variant="default"
                  className="document-detail-secondary-action"
                >
                  {t('Джерело')}
                </Button>
              )}
              {canExport ? (
                <Button
                  disabled={!document.NetUid}
                  leftSection={<Download size={16} />}
                  loading={exportingNetId === document.NetUid}
                  variant="default"
                  className="document-detail-secondary-action"
                  onClick={() => onExport(document)}
                >
                  {t('Експорт')}
                </Button>
              ) : null}
              {canOpenRemainings ? (
                <Button
                  disabled={!document.NetUid || isLoadingRemainings}
                  loading={isLoadingRemainings}
                  variant="default"
                  className="document-detail-secondary-action"
                  leftSection={<Layers size={16} />}
                  onClick={() => onLoadRemainings(document)}
                >
                  {t('Залишки за партіями')}
                </Button>
              ) : null}
            </Group>
          }
        >
          {overviewKind === 'saleReturn' ? (
            <DocumentDetailSection title={t('Реквізити документа')} stacked>
              <div className="income-return-metadata">
              <DocumentDetailRow label={t('Клієнт')} value={row.client} wide />
              <IncomeMetadataChip label={t('Організація')} tone="product" value={row.organization} />
              <IncomeMetadataChip label={t('Склад')} tone="storage" value={document.Storage?.Name} />
              <IncomeMetadataChip label={t('Відповідальний')} tone="warning" value={getEntityName(document.User)} />
              <IncomeMetadataChip label={t('Повернення')} tone="document" value={row.invNumber} />
              <DocumentDetailRow label={t('Дата повернення')} mono value={formatDateTime(row.invDate)} />
              <DocumentDetailRow label={t('Угода')} value={returnAgreement?.Name} />
              {row.comment || document.Comment ? <DocumentDetailRow label={t('Коментар')} value={row.comment || document.Comment} wide /> : null}
              </div>
            </DocumentDetailSection>
          ) : (
            <div className="document-detail-columns">
              <DocumentDetailSection title={t('Документ')}>
                <IncomeMetadataChip label={t('Номер інвойсу')} tone="document" value={row.invNumber} />
                <DocumentDetailRow label={t('Дата інвойсу')} mono value={formatDateTime(row.invDate)} />
                <DocumentDetailRow label={t('Дата МД')} mono value={formatDateTime(row.specificationDate)} />
                {row.comment || document.Comment ? <DocumentDetailRow label={t('Коментар')} value={row.comment || document.Comment} wide /> : null}
              </DocumentDetailSection>

              <DocumentDetailSection title={t('Учасники та склад')}>
                <IncomeMetadataChip label={t('Постачальник / клієнт')} tone="document" value={row.client} />
                <IncomeMetadataChip label={t('Організація')} tone="product" value={row.organization} />
                <IncomeMetadataChip label={t('Склад')} tone="storage" value={document.Storage?.Name} />
                <IncomeMetadataChip label={t('Відповідальний')} tone="warning" value={getEntityName(document.User)} />
              </DocumentDetailSection>
            </div>

          )}

          {detailMode === 'view' && deferredOverviewNote && (
            <Alert color={CREATE_ACTION_COLOR} icon={<CircleAlert size={18} />} variant="light">
              {deferredOverviewNote}
            </Alert>
          )}

          {detailMode === 'view' && overviewKind === 'capitalization' && (
            <CapitalizationOverview
              capitalization={capitalization}
              error={capitalizationError}
              isLoading={isLoadingCapitalization}
              itemColumns={capitalizationItemColumns}
            />
          )}

          {detailMode === 'view' && overviewKind === 'actReconciliation' && (
            <ActReconciliationOverview document={document} isLoading={isLoadingDocumentInfo} />
          )}

          {detailMode === 'view' && overviewKind === 'saleReturn' && <SaleReturnOverview document={document} />}

          {detailMode === 'view' && (
            <details className="income-warehouse-details" open={overviewKind !== 'saleReturn'}>
              <summary hidden={overviewKind !== 'saleReturn'}>{t('Позиції складського обліку')} · {getActiveProductIncomeItems(document).length}</summary>
              <DocumentDetailSection stacked subtitle={String(getActiveProductIncomeItems(document).length)} title={t('Позиції документа')}>
                {documentInfoError && (
                  <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                    {documentInfoError}
                  </Alert>
                )}
                <DataTable
                  columns={itemColumns}
                  data={getActiveProductIncomeItems(document)}
                  defaultLayout={ITEMS_TABLE_DEFAULT_LAYOUT}
                  emptyText={t('Позицій не знайдено')}
                  getRowId={(item, index) => String(item.NetUid || item.Id || index)}
                  isLoading={isLoadingDocumentInfo}
                  layoutVersion="product-income-document-items-2"
                  loadingText={t('Завантаження позицій документа')}
                  maxHeight={320}
                  minWidth={720}
                  showToolbar={false}
                  tableId="product-income-document-items"
                />
              </DocumentDetailSection>
            </details>
          )}

          {detailMode === 'remainings' && (
            <DocumentDetailSection stacked subtitle={String(remainings.length)} title={t('Залишки за партіями')}>
              {documentInfoError && (
                <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                  {documentInfoError}
                </Alert>
              )}
              {remainingsError && (
                <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                  {remainingsError}
                </Alert>
              )}
              <DataTable
                columns={remainingColumns}
                data={remainings}
                defaultLayout={REMAININGS_TABLE_DEFAULT_LAYOUT}
                emptyText={t('Залишків по партіях не знайдено')}
                getRowId={(remaining, index) =>
                  String(remaining.NetUid || `${remaining.Product?.VendorCode || ''}-${remaining.StorageName || ''}-${index}`)
                }
                isLoading={isLoadingRemainings}
                layoutVersion="product-income-document-remainings-2"
                loadingText={t('Завантаження залишків')}
                maxHeight={360}
                minWidth={1180}
                showToolbar={false}
                tableId="product-income-document-remainings"
              />
            </DocumentDetailSection>
          )}
        </DocumentDetailLayout>
        </div>
      )}
    </AppDrawer>
  )
}

type CapitalizationOverviewItem = NonNullable<ProductCapitalization['ProductCapitalizationItems']>[number]

function CapitalizationOverview({
  capitalization,
  error,
  isLoading,
  itemColumns,
}: {
  capitalization: ProductCapitalization | null
  error: string | null
  isLoading: boolean
  itemColumns: DataTableColumn<CapitalizationOverviewItem>[]
}) {
  const { t } = useI18n()
  const items = capitalization?.ProductCapitalizationItems || []

  return (
    <DocumentDetailSection
      stacked
      subtitle={<>{displayValue(capitalization?.Number)} · <span className="app-money app-money-meta">{formatMoney(capitalization?.TotalAmount)}</span></>}
      title={t('Прихідна накладна (Оприходування)')}
    >
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}
      <DataTable
        columns={itemColumns}
        data={items}
        emptyText={t('Позицій не знайдено')}
        getRowId={(item, index) => String(item.NetUid || item.Id || index)}
        isLoading={isLoading}
        layoutVersion="product-income-capitalization-overview-1"
        loadingText={t('Завантаження позицій оприбуткування')}
        maxHeight={320}
        minWidth={760}
        showToolbar={false}
        tableId="product-income-capitalization-overview"
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <DocumentDetailRow label={t('Вся кількість')} mono value={formatAmount(sumRows(items, (item) => item.Qty))} />
        <DocumentDetailRow label={t('Загальна сума')} mono value={formatMoney(sumRows(items, (item) => item.TotalAmount))} />
        <DocumentDetailRow label={t('Загальна вага')} mono value={formatAmount(sumRows(items, (item) => (item.Weight || 0) * (item.Qty || 0)))} />
      </SimpleGrid>
    </DocumentDetailSection>
  )
}

function useCapitalizationOverviewColumns(): DataTableColumn<CapitalizationOverviewItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<CapitalizationOverviewItem>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код'),
        width: 140,
        minWidth: 120,
        accessor: (item) => item.Product?.VendorCode || item.ProductVendorCode,
        cell: (item) => <TableChip tone="product" value={displayValue(item.Product?.VendorCode || item.ProductVendorCode)} />,
      },
      {
        id: 'productName',
        header: t('Назва'),
        width: 300,
        minWidth: 220,
        accessor: (item) => item.Product?.Name || item.ProductName,
        cell: (item) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(item.Product?.Name || item.ProductName)}
          </Text>
        ),
      },
      {
        id: 'weight',
        header: t('Вага'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.Weight,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatAmount(item.Weight)}</Text>,
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatAmount(item.Qty)}</Text>,
      },
      {
        id: 'unitPrice',
        header: t('Ціна'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.UnitPrice,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatMoney(item.UnitPrice)}</Text>,
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (item) => item.TotalAmount,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatMoney(item.TotalAmount)}</Text>,
      },
      {
        id: 'remainingQty',
        header: t('Залишок'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.RemainingQty,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatAmount(item.RemainingQty)}</Text>,
      },
    ],
    [t],
  )
}

function SaleReturnOverview({ document }: { document: ProductIncomeDocument }) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const items = getActiveProductIncomeItems(document).filter((item) => item.SaleReturnItem)
  const firstItem = items[0]?.SaleReturnItem
  const agreement = firstItem?.OrderItem?.Order?.Sale?.ClientAgreement?.Agreement
  const totals = getIncomeReturnTotals(document)
  const currencyCode = totals.currency
  const isVat = Boolean(agreement?.WithVATAccounting)
  const totalAmount = totals.amount
  const vatAmounts = items.map((item) => item.SaleReturnItem?.VatAmount)
  const totalVat = vatAmounts.length > 0 && vatAmounts.every(isFiniteNumber)
    ? vatAmounts.reduce((total, amount) => total + amount, 0)
    : undefined
  const columns = getSaleReturnOverviewColumns(t, isVat, items)

  return (
    <DocumentDetailSection
      actions={<div className="income-document-table-tools" ref={setTableToolbarSlot} />}
      stacked
      title={t('Товари повернення')}
    >
      {items.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Позицій не знайдено')}
        </Text>
      ) : (
        <DataTable
          toolbarPortalTarget={tableToolbarSlot}
          columns={columns}
          data={items}
          defaultLayout={{ density: 'normal' }}
          emptyText={t('Позицій не знайдено')}
          getRowId={(item) => getSaleReturnIncomeItemKey(item)}
          layoutVersion="product-income-sale-return-items-2"
          maxHeight={420}
          minWidth={isVat ? 880 : 744}
          tableId="product-income-sale-return-items"
        />
      )}

      <SimpleGrid className="income-return-totals" cols={{ base: 1, sm: 2, md: 4 }} spacing={12} verticalSpacing={10}>
        <DocumentDetailRow label={t('Всього позицій')} mono value={String(items.length)} />
        <DocumentDetailRow label={t('Вся кількість')} mono value={totals.qty == null ? '—' : formatAmount(totals.qty)} />
        <DocumentDetailRow label={t('Загальна сума')} mono value={<Group component="span" gap={6}><span>{totalAmount == null ? '—' : formatMoney(totalAmount)}</span><TableChip tone="source" value={currencyCode} /></Group>} />
        {isVat && <DocumentDetailRow label={t('ПДВ')} mono value={totalVat == null ? '—' : formatMoney(totalVat)} />}
      </SimpleGrid>
    </DocumentDetailSection>
  )
}

function getSaleReturnOverviewColumns(
  t: (value: string) => string,
  isVat: boolean,
  items: ProductIncomeItem[],
): DataTableColumn<ProductIncomeItem>[] {
  return [
    {
      id: 'index',
      header: '#',
      width: 56,
      minWidth: 52,
      align: 'right',
      accessor: (item) => items.indexOf(item) + 1,
      cell: (item) => String(items.indexOf(item) + 1),
    },
    {
      id: 'vendorCode',
      header: t('Код товару'),
      width: 140,
      minWidth: 120,
      accessor: (item) => item.SaleReturnItem?.OrderItem?.Product?.VendorCode,
      cell: (item) => <TableChip tone="product" value={displayValue(item.SaleReturnItem?.OrderItem?.Product?.VendorCode)} />,
    },
    {
      id: 'name',
      header: t('Назва товару'),
      width: 320,
      minWidth: 240,
      accessor: (item) => item.SaleReturnItem?.OrderItem?.Product?.Name,
      cell: (item) => (
        <Text size="sm" lineClamp={2}>
          {displayValue(item.SaleReturnItem?.OrderItem?.Product?.Name)}
        </Text>
      ),
    },
    {
      id: 'qty',
      header: t('Кількість'),
      width: 110,
      minWidth: 96,
      align: 'right',
      accessor: (item) => item.SaleReturnItem?.Qty ?? item.Qty,
      cell: (item) => <Text className="app-money" size="sm" ta="right">{formatAmount(item.SaleReturnItem?.Qty ?? item.Qty)}</Text>,
    },
    {
      id: 'amount',
      header: t('Сума, EUR'),
      width: 124,
      minWidth: 108,
      align: 'right',
      accessor: (item) => item.SaleReturnItem?.Amount,
      cell: (item) => <Text className="app-money" size="sm" ta="right">{formatMoney(item.SaleReturnItem?.Amount)}</Text>,
    },
    ...(isVat
      ? [
          {
            id: 'vat',
            header: t('ПДВ'),
            width: 124,
            minWidth: 108,
            align: 'right' as const,
            accessor: (item: ProductIncomeItem) => item.SaleReturnItem?.VatAmount,
            cell: (item: ProductIncomeItem) => <Text className="app-money" size="sm" ta="right">{formatMoney(item.SaleReturnItem?.VatAmount)}</Text>,
          },
        ]
      : []),
  ]
}

type ActReconciliationOverviewRow = {
  amount?: number
  comment?: string
  key: string
  netWeight?: number
  productName?: string
  qty?: number
  unitPrice?: number
  vendorCode?: string
}

function ActReconciliationOverview({
  document,
  isLoading,
}: {
  document: ProductIncomeDocument
  isLoading: boolean
}) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const rows = getActReconciliationOverviewRows(document)
  const columns = useMemo<DataTableColumn<ActReconciliationOverviewRow>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.vendorCode,
        cell: (row) => <TableChip tone="product" value={displayValue(row.vendorCode)} />,
      },
      {
        id: 'productName',
        header: t('Назва'),
        width: 300,
        minWidth: 220,
        accessor: (row) => row.productName,
        cell: (row) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(row.productName)}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.qty,
        cell: (row) => <Text className="app-money" size="sm" ta="right">{formatAmount(row.qty)}</Text>,
      },
      {
        id: 'unitPrice',
        header: t('Ціна'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.unitPrice,
        cell: (row) => <Text className="app-money" size="sm" ta="right">{formatMoney(row.unitPrice)}</Text>,
      },
      {
        id: 'netWeight',
        header: t('Вага нетто'),
        width: 120,
        minWidth: 108,
        align: 'right',
        accessor: (row) => row.netWeight,
        cell: (row) => <Text className="app-money" size="sm" ta="right">{formatAmount(row.netWeight)}</Text>,
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => <Text className="app-money" size="sm" ta="right">{formatMoney(row.amount)}</Text>,
      },
    ],
    [t],
  )

  return (
    <DocumentDetailSection
      actions={<div className="income-document-table-tools" ref={setTableToolbarSlot} />}
      stacked
      subtitle={<>{displayValue(document.Number)} · <span className="app-money app-money-meta">{formatMoney(document.TotalNetPrice)}</span></>}
      title={t('Прихідна накладна (акт звірки)')}
    >

      <DataTable
          toolbarPortalTarget={tableToolbarSlot}
        columns={columns}
        data={rows}
        emptyText={t('Позицій не знайдено')}
        getRowId={(row) => row.key}
        isLoading={isLoading}
        layoutVersion="product-income-act-reconciliation-overview-1"
        loadingText={t('Завантаження позицій акта звірки')}
        maxHeight={320}
        minWidth={820}
        tableId="product-income-act-reconciliation-overview"
      />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <DocumentDetailRow label={t('Всього товарів')} value={rows.length} />
        <DocumentDetailRow label={t('Вся кількість')} mono value={formatAmount(document.TotalQty)} />
        <DocumentDetailRow label={t('Вага нетто')} value={formatAmount(document.TotalNetWeight || sumRows(rows, (row) => row.netWeight))} />
        <DocumentDetailRow label={t('Сума')} mono value={formatMoney(document.TotalNetPrice)} />
      </SimpleGrid>
    </DocumentDetailSection>
  )
}

function mergeProductIncomeInfo(
  document: ProductIncomeDocument,
  info: ProductIncomeInfo | null,
): ProductIncomeDocument {
  if (!info) {
    return document
  }

  return {
    ...document,
    ...info,
    ProductIncomeItems: info.ProductIncomeItems?.length ? info.ProductIncomeItems : document.ProductIncomeItems,
  }
}

function getCapitalizationNetUid(document: ProductIncomeDocument): string | null {
  const items = getActiveProductIncomeItems(document)
  const capitalization = items
    .map((item) => item.ProductCapitalizationItem?.ProductCapitalization)
    .find((value) => value?.NetUid)

  return capitalization?.NetUid || null
}

function getDeferredOverviewNote(
  document: ProductIncomeDocument,
  t: (key: string) => string,
): string | null {
  const items = getActiveProductIncomeItems(document)

  if (items.some((item) => item.SupplyOrderUkraineItem?.SupplyOrderUkraine)) {
    return t('Огляд прихідного інвойса в Україну доступний у модулі замовлень')
  }

  return null
}

function useProductIncomeDocumentColumns({
  canExport,
  exportingNetId,
  onExport,
  onOpen,
}: {
  canExport: boolean
  exportingNetId: string | null
  onExport: (document: ProductIncomeDocument) => void
  onOpen: (document: ProductIncomeDocument) => void
}): DataTableColumn<DocumentRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<DocumentRow>[]>(
    () => [
      {
        id: 'fromDate',
        header: t('Дата'),
        width: 150,
        minWidth: 132,
        accessor: (row) => row.document.FromDate,
        cell: (row) => formatDateTime(row.document.FromDate),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 132,
        minWidth: 112,
        accessor: (row) => row.document.Number,
        cell: (row) => <TableChip tone="document" value={displayValue(row.document.Number)} />,
      },
      {
        id: 'type',
        header: t('Тип'),
        width: 240,
        minWidth: 180,
        accessor: (row) => row.type,
        cell: (row) => displayValue(row.type),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => <Text className="app-money" size="sm" ta="right">{formatMoney(row.amount)}</Text>,
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 96,
        minWidth: 82,
        accessor: (row) => row.currency,
        cell: (row) => <TableChip tone="source" value={displayValue(row.currency)} />,
      },
      {
        id: 'client',
        header: t('Постачальник / клієнт'),
        width: 260,
        minWidth: 200,
        accessor: (row) => row.client,
        cell: (row) => (
          <Text size="sm" title={displayValue(row.client)}>
            {displayValue(row.client)}
          </Text>
        ),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.document.Storage?.Name,
        cell: (row) => <TableChip tone="storage" value={displayValue(row.document.Storage?.Name)} />,
      },
      {
        id: 'invoiceNumber',
        header: t('Інвойс'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.invNumber,
        cell: (row) => <TableChip tone="document" value={displayValue(row.invNumber)} />,
      },
      {
        id: 'invoiceDate',
        header: t('Дата інвойсу'),
        width: 150,
        minWidth: 132,
        accessor: (row) => row.invDate,
        cell: (row) => formatDateTime(row.invDate),
      },
      {
        id: 'specificationDate',
        header: t('Дата МД'),
        width: 150,
        minWidth: 132,
        accessor: (row) => row.specificationDate,
        cell: (row) => formatDateTime(row.specificationDate),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 220,
        minWidth: 180,
        accessor: (row) => row.organization,
        cell: (row) => <TableChip tone="product" value={row.organization} />,
      },
      {
        id: 'state',
        header: t('Стан'),
        width: 116,
        minWidth: 96,
        accessor: (row) => row.docState,
        cell: (row) => <TableChip tone={row.docState === t('Виконано') ? 'success' : 'danger'} value={row.docState} />,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 160,
        minWidth: 132,
        accessor: (row) => getEntityName(row.document.User),
        cell: (row) => displayValue(getEntityName(row.document.User)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 240,
        minWidth: 180,
        accessor: (row) => row.comment || row.document.Comment,
        cell: (row) => (
          <Text size="sm" title={displayValue(row.comment || row.document.Comment)}>
            {displayValue(row.comment || row.document.Comment)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 96,
        minWidth: 88,
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <TableRowAction action="open" label={t('Відкрити')} onClick={() => onOpen(row.document)} />
            {canExport ? (
              <TableRowAction
                action="download"
                disabled={!row.document.NetUid}
                label={t('Експорт')}
                loading={exportingNetId === row.document.NetUid}
                onClick={() => onExport(row.document)}
              />
            ) : null}
          </Group>
        ),
      },
    ],
    [canExport, exportingNetId, onExport, onOpen, t],
  )
}

function useProductIncomeItemColumns({
  canOpenMovement,
  canOpenStorageHistory,
  onOpenMovementHistory,
  onOpenStorageLocationHistory,
}: {
  canOpenMovement: boolean
  canOpenStorageHistory: boolean
  onOpenMovementHistory: (product: MovementHistoryProduct) => void
  onOpenStorageLocationHistory: (product: MovementHistoryProduct) => void
}): DataTableColumn<ProductIncomeItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductIncomeItem>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 140,
        minWidth: 120,
        accessor: getItemProductCode,
        cell: (item) => <TableChip tone="document" value={displayValue(getItemProductCode(item))} />,
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 280,
        minWidth: 220,
        accessor: getItemProductName,
        cell: (item) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(getItemProductName(item))}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (item) => item.Qty ?? item.PackingListPackageOrderItem?.Qty,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatAmount(item.Qty ?? item.PackingListPackageOrderItem?.Qty)}</Text>,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 220,
        minWidth: 160,
        accessor: getItemComment,
        cell: (item) => displayValue(getItemComment(item)),
      },
      {
        id: 'actions',
        header: '',
        width: 96,
        minWidth: 88,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (item) => (
          <ProductHistoryActionButtons
            canOpenMovement={canOpenMovement}
            canOpenStorageHistory={canOpenStorageHistory}
            product={getMovementHistoryProductFromNamedEntity(getIncomeItemProduct(item))}
            onOpenMovementHistory={onOpenMovementHistory}
            onOpenStorageLocationHistory={onOpenStorageLocationHistory}
          />
        ),
      },
    ],
    [canOpenMovement, canOpenStorageHistory, onOpenMovementHistory, onOpenStorageLocationHistory, t],
  )
}

function useRemainingConsignmentColumns({
  canOpenMovement,
  canOpenStorageHistory,
  onOpenMovementHistory,
  onOpenStorageLocationHistory,
}: {
  canOpenMovement: boolean
  canOpenStorageHistory: boolean
  onOpenMovementHistory: (product: MovementHistoryProduct) => void
  onOpenStorageLocationHistory: (product: MovementHistoryProduct) => void
}): DataTableColumn<RemainingConsignment>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<RemainingConsignment>[]>(
    () => [
      {
        id: 'storage',
        header: t('Склад'),
        width: 150,
        minWidth: 120,
        accessor: (item) => item.StorageName,
        cell: (item) => <TableChip tone="storage" value={displayValue(item.StorageName)} />,
      },
      {
        id: 'productCode',
        header: t('Код'),
        width: 120,
        minWidth: 104,
        accessor: (item) => item.Product?.VendorCode,
        cell: (item) => <TableChip tone="product" value={displayValue(item.Product?.VendorCode)} />,
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 240,
        minWidth: 200,
        accessor: (item) => getEntityName(item.Product),
        cell: (item) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(getEntityName(item.Product))}
          </Text>
        ),
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        width: 220,
        minWidth: 180,
        accessor: (item) => item.SupplierName,
        cell: (item) => displayValue(item.SupplierName),
      },
      {
        id: 'fromDate',
        header: t('Дата'),
        width: 144,
        minWidth: 124,
        accessor: (item) => item.FromDate,
        cell: (item) => formatDateTime(item.FromDate),
      },
      {
        id: 'invoiceNumber',
        header: t('Інвойс'),
        width: 150,
        minWidth: 120,
        accessor: (item) => item.InvoiceNumber,
        cell: (item) => <TableChip tone="document" value={displayValue(item.InvoiceNumber)} />,
      },
      {
        id: 'remainingQty',
        header: t('Залишок'),
        width: 108,
        minWidth: 96,
        align: 'right',
        accessor: (item) => item.RemainingQty,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatAmount(item.RemainingQty)}</Text>,
      },
      {
        id: 'netPrice',
        header: t('Ціна нетто'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.NetPrice,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatMoney(item.NetPrice)}</Text>,
      },
      {
        id: 'totalNetPrice',
        header: t('Сума нетто (інвойса)'),
        width: 124,
        minWidth: 112,
        align: 'right',
        accessor: (item) => item.TotalNetPrice,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatMoney(item.TotalNetPrice)}</Text>,
      },
      {
        id: 'grossUnitPrice',
        header: t('Сума брутто УО'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (item) => item.GrossPrice,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatMoney(item.GrossPrice)}</Text>,
      },
      {
        id: 'accountingGrossPrice',
        header: t('Сума брутто БО'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (item) => item.AccountingGrossPrice,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatMoney(item.AccountingGrossPrice)}</Text>,
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 94,
        minWidth: 82,
        accessor: (item) => item.CurrencyName,
        cell: (item) => <TableChip tone="neutral" value={displayValue(item.CurrencyName)} />,
      },
      {
        id: 'incomeInvoiceNumber',
        header: t('Номер прихідної накладної'),
        width: 150,
        minWidth: 130,
        accessor: (item) => item.ProductIncomeNumber,
        cell: (item) => <TableChip tone="document" value={displayValue(item.ProductIncomeNumber)} />,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 180,
        minWidth: 150,
        accessor: (item) => item.OrganizationName,
        cell: (item) => <TableChip tone="product" value={item.OrganizationName} />,
      },
      {
        id: 'weight',
        header: t('Вага'),
        width: 94,
        minWidth: 82,
        align: 'right',
        accessor: (item) => item.Weight,
        cell: (item) => <Text className="app-money" size="sm" ta="right">{formatAmount(item.Weight)}</Text>,
      },
      {
        id: 'actions',
        header: '',
        width: 96,
        minWidth: 88,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (item) => (
          <ProductHistoryActionButtons
            canOpenMovement={canOpenMovement}
            canOpenStorageHistory={canOpenStorageHistory}
            product={getMovementHistoryProductFromNamedEntity(item.Product)}
            onOpenMovementHistory={onOpenMovementHistory}
            onOpenStorageLocationHistory={onOpenStorageLocationHistory}
          />
        ),
      },
    ],
    [canOpenMovement, canOpenStorageHistory, onOpenMovementHistory, onOpenStorageLocationHistory, t],
  )
}

function ProductHistoryActionButtons({
  canOpenMovement,
  canOpenStorageHistory,
  product,
  onOpenMovementHistory,
  onOpenStorageLocationHistory,
}: {
  canOpenMovement: boolean
  canOpenStorageHistory: boolean
  product: MovementHistoryProduct
  onOpenMovementHistory: (product: MovementHistoryProduct) => void
  onOpenStorageLocationHistory: (product: MovementHistoryProduct) => void
}) {
  const { t } = useI18n()
  const hasProductNetUid = Boolean(product.NetUid)
  const missingProductLabel = t('У товару немає NetUid')

  return (
    <Group gap={4} justify="flex-end" wrap="nowrap">
      {canOpenStorageHistory ? (
        <TableRowAction
          action="history"
          disabled={!hasProductNetUid}
          hint={hasProductNetUid ? undefined : missingProductLabel}
          label={t('Історія місця зберігання')}
          onClick={() => onOpenStorageLocationHistory(product)}
        />
      ) : null}
      {canOpenMovement ? (
        <TableRowAction
          action="transfer"
          disabled={!hasProductNetUid}
          hint={hasProductNetUid ? undefined : missingProductLabel}
          label={t('Рух товару')}
          onClick={() => onOpenMovementHistory(product)}
        />
      ) : null}
    </Group>
  )
}

function getMovementHistoryProductFromNamedEntity(entity?: NamedEntity | null): MovementHistoryProduct {
  return {
    Name: entity?.Name,
    NameUA: entity?.NameUA,
    NetUid: entity?.NetUid,
    VendorCode: entity?.VendorCode || entity?.Code,
  }
}

function getSaleReturnIncomeItemKey(item: ProductIncomeItem): string {
  const saleReturnItem = item.SaleReturnItem

  return String(
    item.NetUid ||
      item.Id ||
      saleReturnItem?.SaleReturn?.NetUid ||
      saleReturnItem?.OrderItem?.Product?.NetUid ||
      saleReturnItem?.OrderItem?.Product?.VendorCode ||
      getItemProductCode(item) ||
      getItemProductName(item) ||
      saleReturnItem?.Comment ||
      '',
  )
}

function getActReconciliationOverviewRows(document: ProductIncomeDocument): ActReconciliationOverviewRow[] {
  return getActiveProductIncomeItems(document).reduce<ActReconciliationOverviewRow[]>((rows, item, index) => {
    const reconciliationItem = item.ActReconciliationItem

    if (!reconciliationItem) {
      return rows
    }

    const product = reconciliationItem.Product || item.Product

    rows.push({
      amount: reconciliationItem.TotalAmount,
      comment: reconciliationItem.Comment || item.Comment,
      key: getActReconciliationIncomeItemKey(item, index),
      netWeight: reconciliationItem.NetWeight,
      productName: product?.NameUA || product?.Name,
      qty: item.Qty,
      unitPrice: reconciliationItem.UnitPrice,
      vendorCode: product?.VendorCode || product?.Code,
    })

    return rows
  }, [])
}

function getActReconciliationIncomeItemKey(item: ProductIncomeItem, index: number): string {
  const reconciliationItem = item.ActReconciliationItem

  return String(
    item.NetUid ||
      item.Id ||
      reconciliationItem?.Product?.NetUid ||
      reconciliationItem?.Product?.VendorCode ||
      item.Product?.NetUid ||
      item.Product?.VendorCode ||
      index,
  )
}

function getItemComment(item: ProductIncomeItem): string | undefined {
  return item.Comment
    || item.SaleReturnItem?.Comment
    || item.ActReconciliationItem?.Comment
    || item.SupplyOrderUkraineItem?.SupplyOrderUkraine?.Comment
    || item.PackingListPackageOrderItem?.PackingList?.SupplyInvoice?.Comment
    || item.ProductCapitalizationItem?.ProductCapitalization?.Comment
}

function sumRows<TItem>(items: TItem[], selector: (item: TItem) => number | undefined): number | undefined {
  const total = items.reduce((sum, item) => sum + (selector(item) || 0), 0)

  return total || undefined
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName || entity?.NameUA || entity?.Name || entity?.LastName || entity?.Number || entity?.VendorCode
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (!isFiniteNumber(value)) {
    return '—'
  }

  return amountFormatter.format(value)
}

function formatMoney(value?: number): string {
  if (!isFiniteNumber(value)) {
    return '—'
  }

  return moneyFormatter.format(value)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}

function getFilterError(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) {
    return translate('Оберіть діапазон дат')
  }

  if (dateFrom > dateTo) {
    return translate('Дата “Від” не може бути більшою за дату “До”')
  }

  return null
}

function readStoredFilters(): { from: string; to: string; value: string } {
  if (typeof window === 'undefined') {
    return getDefaultFilters()
  }

  const defaults = getDefaultFilters()
  const storedValue = window.localStorage.getItem(FILTER_STORAGE_KEY)

  if (!storedValue) {
    return defaults
  }

  try {
    const payload = JSON.parse(storedValue) as { From?: string; To?: string; filterValue?: string }

    return {
      from: normalizeStoredDate(payload.From) || defaults.from,
      to: normalizeStoredDate(payload.To) || defaults.to,
      value: payload.filterValue || '',
    }
  } catch {
    return defaults
  }
}

function writeStoredFilters(filters: { from: string; to: string; value: string }) {
  window.localStorage.setItem(
    FILTER_STORAGE_KEY,
    JSON.stringify({
      From: filters.from,
      To: filters.to,
      filterValue: filters.value,
    }),
  )
}

function normalizeStoredDate(value?: string): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
  }

  return formatLocalDate(date)
}

function getDefaultFilters(): { from: string; to: string; value: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 14)

  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
    value: '',
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
