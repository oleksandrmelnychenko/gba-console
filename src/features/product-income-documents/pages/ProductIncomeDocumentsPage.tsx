import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFileTypePdf,
  IconHistory,
  IconRestore,
  IconSearch,
  IconStack2,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatLocalDate, toDateTimeQuery } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  ProductMovementHistoryDrawer,
  ProductStorageLocationHistoryDrawer,
  type MovementHistoryProduct,
} from '../../../shared/ui/product-movement-history/ProductMovementHistoryDrawers'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import { getProductCapitalization } from '../../product-capitalizations/api/productCapitalizationsApi'
import type { ProductCapitalization } from '../../product-capitalizations/types'
import {
  exportProductIncomeDocument,
  getProductIncomeDocuments,
  getProductIncomeInfo,
  getProductIncomeRemainings,
} from '../api/productIncomeDocumentsApi'
import { getProductIncomeDocumentSourceLink } from '../productIncomeDocumentSourceLink'
import {
  getIncomeItemProduct,
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

const FILTER_STORAGE_KEY = 'documentsFilters'
const PRODUCT_MOVEMENT_PERMISSION = 'Product_Entire_Assortment_Product_Movement_Btn_PKEY'
const PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE

const DOCUMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'number', 'type'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'productName'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const REMAININGS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['storage', 'productCode', 'productName'],
    right: ['actions'],
  },
  density: 'compact',
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

function useProductIncomeDocumentsPageModel() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
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
  const { density, toggleDensity } = useDataTableDensity('product-income-documents', DOCUMENTS_TABLE_DEFAULT_LAYOUT.density)
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
  const canOpenProductMovement = hasPermission(PRODUCT_MOVEMENT_PERMISSION)

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
          const detail = await getProductCapitalization(capitalizationNetUid)

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
    (document: ProductIncomeDocument, options: { loadCapitalizationDetail: boolean }) => {
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
          const info = await getProductIncomeInfo(netUid)

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

      loadDocumentInfo(document, { loadCapitalizationDetail: !capitalizationNetUid })
    },
    [
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
      capitalizationRequestRef.current += 1
      setOptionsDocument(null)
      setDetailMode('remainings')
      setSelectedDocument(document)
      setRemainings([])
      setRemainingsError(null)
      setDocumentInfoError(null)
      setCapitalization(null)
      setCapitalizationError(null)
      loadDocumentInfo(document, { loadCapitalizationDetail: false })
      fetchRemainings(document)
    },
    [
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
    exportingNetId,
    onExport: handleExport,
    onOpen: openOptions,
  })
  const itemColumns = useProductIncomeItemColumns({
    canOpenProductMovement,
    onOpenMovementHistory: setMovementHistoryProduct,
    onOpenStorageLocationHistory: setStorageLocationHistoryProduct,
  })
  const remainingColumns = useRemainingConsignmentColumns({
    canOpenProductMovement,
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
    if (!document.NetUid) {
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
    columns,
    dateFrom,
    dateTo,
    density,
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
    toggleDensity,
    updateSearch,
  }
}

export function ProductIncomeDocumentsPage() {
  const model = useProductIncomeDocumentsPageModel()

  return <ProductIncomeDocumentsPageView model={model} />
}

function ProductIncomeDocumentsPageView({ model }: { model: ReturnType<typeof useProductIncomeDocumentsPageModel> }) {
  const { t } = useI18n()
  const {
    capitalization,
    capitalizationError,
    capitalizationItemColumns,
    columns,
    dateFrom,
    dateTo,
    density,
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
    toggleDensity,
    updateSearch,
  } = model

  return (
    <Stack className="product-income-documents-page" gap={6}>
      <Card className="app-data-card product-income-documents-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-income-documents-filter-bar">
          <Group align="end" gap="sm" wrap="nowrap" className="product-income-documents-filter-row">
            <TextInput
              size="sm"
              label={t('Від')}
              type="date"
              value={dateFrom}
              w={150}
              onChange={(event) => {
                clearTransientSelection()
                setPage(1)
                setDateFrom(event.currentTarget.value)
              }}
            />
            <TextInput
              size="sm"
              label={t('До')}
              type="date"
              value={dateTo}
              w={150}
              onChange={(event) => {
                clearTransientSelection()
                setPage(1)
                setDateTo(event.currentTarget.value)
              }}
            />
            <TextInput
              size="sm"
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Номер, постачальник або коментар')}
              value={searchDraft}
              style={{ flex: '1 1 260px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                  <IconRestore size={17} />
                </ActionIcon>
              </Tooltip>
              <DataTableDensityToggle density={density} onToggle={toggleDensity} size={34} />
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
          </Group>
        </div>

        {(error || filterError) && (
          <Alert
            className="product-income-documents-page__alert"
            color={filterError ? 'yellow' : 'red'}
            icon={<IconAlertCircle size={18} />}
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
            density={density}
            emptyText={t('Документів не знайдено')}
            getRowId={(row, index) => String(row.document.NetUid || row.document.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="product-income-documents-table-2"
            loadingText={t('Завантаження документів')}
            minWidth={1440}
            tableId="product-income-documents"
            onRowClick={(row) => openOptions(row.document)}
          />
        </div>
      </Card>

      <ProductIncomeOptionsModal
        document={optionsDocument}
        onClose={() => setOptionsDocument(null)}
        onOverview={openOverview}
        onRemainings={openRemainings}
      />

      <ProductIncomeDocumentDrawer
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
        opened={Boolean(movementHistoryProduct)}
        product={movementHistoryProduct}
        onClose={() => setMovementHistoryProduct(null)}
      />

      <ProductStorageLocationHistoryDrawer
        opened={Boolean(storageLocationHistoryProduct)}
        product={storageLocationHistoryProduct}
        onClose={() => setStorageLocationHistoryProduct(null)}
      />

      <AppModal
        centered
        opened={downloadModalOpened}
        title={t('Документ приходу')}
        onClose={() => setDownloadModalOpened(false)}
      >
        <Stack gap="sm">
          {downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.DocumentURL && (
                <Anchor
                  href={upgradeHttpToHttps(downloadDocument.DocumentURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
                  <span className="document-link-badge document-link-badge-excel">
                    <ExcelIcon size={22} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor
                  href={upgradeHttpToHttps(downloadDocument.PdfDocumentURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="document-link"
                >
                  <span className="document-link-badge document-link-badge-pdf">
                    <IconFileTypePdf size={22} stroke={1.8} />
                  </span>
                  <span>{t('PDF документ')}</span>
                </Anchor>
              )}
            </>
          ) : (
            <Text c="dimmed" size="sm">
              {t('Документ недоступний для завантаження')}
            </Text>
          )}
        </Stack>
      </AppModal>
    </Stack>
  )
}

function ProductIncomeOptionsModal({
  document,
  onClose,
  onOverview,
  onRemainings,
}: {
  document: ProductIncomeDocument | null
  onClose: () => void
  onOverview: (document: ProductIncomeDocument) => void
  onRemainings: (document: ProductIncomeDocument) => void
}) {
  const { t } = useI18n()
  const row = document ? mapDocumentRow(document) : null
  const title = document ? `${displayValue(row?.type)} ${displayValue(document.Number)}`.trim() : t('Виберіть опцію')
  const primarySourceLink = document ? getPrimaryProductIncomeSourceLink(document) : null

  return (
    <AppModal centered opened={Boolean(document)} title={t('Виберіть опцію')} onClose={onClose}>
      {document && (
        <Stack gap="sm">
          <Text c="dimmed" size="sm">
            {title}
          </Text>
          {primarySourceLink && (
            <Button
              component={Link}
              justify="flex-start"
              leftSection={<IconExternalLink size={18} />}
              to={primarySourceLink}
              variant="light"
            >
              {t('Відкрити джерело')}
            </Button>
          )}
          <Button justify="flex-start" leftSection={<IconEye size={18} />} variant="light" onClick={() => onOverview(document)}>
            {t('Деталі документа')}
          </Button>
          <Button
            disabled={!document.NetUid}
            justify="flex-start"
            leftSection={<IconStack2 size={18} />}
            variant="light"
            onClick={() => onRemainings(document)}
          >
            {t('Залишки по партіям')}
          </Button>
        </Stack>
      )}
    </AppModal>
  )
}

function getPrimaryProductIncomeSourceLink(document: ProductIncomeDocument): string | null {
  const sourceLink = getProductIncomeDocumentSourceLink(document)

  return sourceLink && sourceLink !== '/sales/return/client' ? sourceLink : null
}

function ProductIncomeDocumentDrawer({
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

  return (
    <AppDrawer
      offset={8}
      opened={Boolean(document)}
      padding="lg"
      position="right"
      radius="md"
      size="min(1120px, 96vw)"
      title={document?.Number ? `${t('Документ')} ${document.Number}` : t('Документ приходу')}
      onClose={onClose}
    >
      {document && row && (
        <Stack gap="lg">
          <Group justify="space-between" align="start" gap="sm">
            <Badge color={CREATE_ACTION_COLOR} variant="light">
              {displayValue(row.type)}
            </Badge>
            <Group gap="xs">
              {sourceLink && (
                <Button
                  component={Link}
                  leftSection={<IconExternalLink size={16} />}
                  to={sourceLink}
                  variant="light"
                >
                  {t('Джерело')}
                </Button>
              )}
              <Button
                disabled={!document.NetUid}
                leftSection={<IconDownload size={16} />}
                loading={exportingNetId === document.NetUid}
                variant="light"
                onClick={() => onExport(document)}
              >
                {t('Експорт')}
              </Button>
              <Button
                disabled={!document.NetUid || isLoadingRemainings}
                loading={isLoadingRemainings}
                variant="filled"
                onClick={() => onLoadRemainings(document)}
              >
                {t('Залишки по партіям')}
              </Button>
            </Group>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <DetailValue label={t('Постачальник / клієнт')} value={row.client} />
            <DetailValue label={t('Організація')} value={row.organization} />
            <DetailValue label={t('Склад')} value={document.Storage?.Name} />
            <DetailValue label={t('Відповідальний')} value={getEntityName(document.User)} />
            <DetailValue label={t('Кількість')} value={formatAmount(row.qty)} />
            <DetailValue label={t('Сума')} value={formatMoney(row.amount)} />
            <DetailValue label={t('Валюта')} value={row.currency} />
            <DetailValue label={t('Стан')} value={row.docState} />
            <DetailValue label={t('Номер інвойсу')} value={row.invNumber} />
            <DetailValue label={t('Дата інвойсу')} value={formatDateTime(row.invDate)} />
            <DetailValue label={t('Дата МД')} value={formatDateTime(row.specificationDate)} />
            <DetailValue label={t('Коментар')} value={row.comment || document.Comment} />
          </SimpleGrid>

          {detailMode === 'view' && deferredOverviewNote && (
            <Alert color={CREATE_ACTION_COLOR} icon={<IconAlertCircle size={18} />} variant="light">
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

          <Divider />

          {detailMode === 'view' && (
            <Stack gap="sm">
              <Title order={4}>{t('Позиції документа')}</Title>
              {documentInfoError && (
                <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
                tableId="product-income-document-items"
              />
            </Stack>
          )}

          {detailMode === 'remainings' && (
            <Stack gap="sm">
              <Title order={4}>{t('Залишки по партіям')}</Title>
              {documentInfoError && (
                <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                  {documentInfoError}
                </Alert>
              )}
              {remainingsError && (
                <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
                tableId="product-income-document-remainings"
              />
            </Stack>
          )}
        </Stack>
      )}
    </AppDrawer>
  )
}

function DetailValue({ label, value }: { label: string; value?: string | number }) {
  return (
    <Card withBorder radius="sm" padding="sm">
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={600} size="sm" lineClamp={2}>
        {displayValue(value)}
      </Text>
    </Card>
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
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="start">
          <Title order={4}>{t('Прихідна накладна (Оприходування)')}</Title>
          <Text c="dimmed" size="sm">
            {displayValue(capitalization?.Number)} · {formatMoney(capitalization?.TotalAmount)}
          </Text>
        </Group>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
          tableId="product-income-capitalization-overview"
        />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <DetailValue label={t('Вся кількість')} value={formatAmount(sumRows(items, (item) => item.Qty))} />
          <DetailValue label={t('Загальна сума')} value={formatMoney(sumRows(items, (item) => item.TotalAmount))} />
          <DetailValue label={t('Загальна вага')} value={formatAmount(sumRows(items, (item) => (item.Weight || 0) * (item.Qty || 0)))} />
        </SimpleGrid>
      </Stack>
    </Card>
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
        cell: (item) => <Text fw={700}>{displayValue(item.Product?.VendorCode || item.ProductVendorCode)}</Text>,
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
        cell: (item) => formatAmount(item.Weight),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => formatAmount(item.Qty),
      },
      {
        id: 'unitPrice',
        header: t('Ціна'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.UnitPrice,
        cell: (item) => formatMoney(item.UnitPrice),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (item) => item.TotalAmount,
        cell: (item) => formatMoney(item.TotalAmount),
      },
      {
        id: 'remainingQty',
        header: t('Залишок'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.RemainingQty,
        cell: (item) => formatAmount(item.RemainingQty),
      },
    ],
    [t],
  )
}

function SaleReturnOverview({ document }: { document: ProductIncomeDocument }) {
  const { t } = useI18n()
  const items = getActiveProductIncomeItems(document).filter((item) => item.SaleReturnItem)
  const firstItem = items[0]?.SaleReturnItem
  const agreement = firstItem?.OrderItem?.Order?.Sale?.ClientAgreement?.Agreement
  const currencyCode = agreement?.Currency?.Code || agreement?.Currency?.Name || ''
  const isVat = Boolean(agreement?.WithVATAccounting)
  const totalAmount = document.TotalNetPrice || sumRows(items, (item) => item.SaleReturnItem?.Amount)
  const totalVat = document.TotalVatAmount || sumRows(items, (item) => item.SaleReturnItem?.VatAmount)
  const columns = getSaleReturnOverviewColumns(t, currencyCode, isVat, items)

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="start">
          <Title order={4}>{t('Прихідна накладна (повернення)')}</Title>
          <Text c="dimmed" size="sm">
            {displayValue(firstItem?.SaleReturn?.Number)} · {displayValue(getEntityName(firstItem?.SaleReturn?.Client))}
          </Text>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
          <DetailValue label={t('Угода')} value={agreement?.Name} />
          <DetailValue label={t('Валюта')} value={currencyCode} />
          <DetailValue label={t('Дата інвойсу')} value={formatDateTime(firstItem?.SaleReturn?.FromDate)} />
          <DetailValue label={t('Коментар')} value={firstItem?.Comment || document.Comment} />
        </SimpleGrid>

        {items.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('Позицій не знайдено')}
          </Text>
        ) : (
          <DataTable
            columns={columns}
            data={items}
            defaultLayout={{ density: 'compact' }}
            emptyText={t('Позицій не знайдено')}
            getRowId={(item) => getSaleReturnIncomeItemKey(item)}
            layoutVersion="product-income-sale-return-items-1"
            maxHeight={420}
            minWidth={isVat ? 1010 : 886}
            tableId="product-income-sale-return-items"
          />
        )}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
          <DetailValue label={t('Всього позицій')} value={String(items.length)} />
          <DetailValue label={t('Вся кількість')} value={formatAmount(document.TotalQty || sumRows(items, (item) => item.SaleReturnItem?.Qty ?? item.Qty))} />
          <DetailValue label={t('Загальна сума')} value={formatMoney(totalAmount)} />
          {isVat && <DetailValue label={t('ПДВ')} value={formatMoney(totalVat)} />}
        </SimpleGrid>
      </Stack>
    </Card>
  )
}

function getSaleReturnOverviewColumns(
  t: (value: string) => string,
  currencyCode: string,
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
      cell: (item) => <Text fw={700}>{displayValue(item.SaleReturnItem?.OrderItem?.Product?.VendorCode)}</Text>,
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
      cell: (item) => formatAmount(item.SaleReturnItem?.Qty ?? item.Qty),
    },
    {
      id: 'amount',
      header: t('Сума'),
      width: 124,
      minWidth: 108,
      align: 'right',
      accessor: (item) => item.SaleReturnItem?.Amount,
      cell: (item) => formatMoney(item.SaleReturnItem?.Amount),
    },
    {
      id: 'amountLocal',
      header: currencyCode || t('Сума у валюті'),
      width: 136,
      minWidth: 118,
      align: 'right',
      accessor: (item) => item.SaleReturnItem?.AmountLocal,
      cell: (item) => formatMoney(item.SaleReturnItem?.AmountLocal),
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
            cell: (item: ProductIncomeItem) => formatMoney(item.SaleReturnItem?.VatAmount),
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
  const rows = getActReconciliationOverviewRows(document)
  const columns = useMemo<DataTableColumn<ActReconciliationOverviewRow>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код'),
        width: 140,
        minWidth: 120,
        accessor: (row) => row.vendorCode,
        cell: (row) => <Text fw={700}>{displayValue(row.vendorCode)}</Text>,
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
        cell: (row) => formatAmount(row.qty),
      },
      {
        id: 'unitPrice',
        header: t('Ціна'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.unitPrice,
        cell: (row) => formatMoney(row.unitPrice),
      },
      {
        id: 'netWeight',
        header: t('Вага нетто'),
        width: 120,
        minWidth: 108,
        align: 'right',
        accessor: (row) => row.netWeight,
        cell: (row) => formatAmount(row.netWeight),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => formatMoney(row.amount),
      },
    ],
    [t],
  )

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="start">
          <Title order={4}>{t('Прихідна накладна (акт звірки)')}</Title>
          <Text c="dimmed" size="sm">
            {displayValue(document.Number)} · {formatMoney(document.TotalNetPrice)}
          </Text>
        </Group>

        <DataTable
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

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <DetailValue label={t('Всього товарів')} value={rows.length} />
          <DetailValue label={t('Вся кількість')} value={formatAmount(document.TotalQty)} />
          <DetailValue label={t('Вага нетто')} value={formatAmount(document.TotalNetWeight || sumRows(rows, (row) => row.netWeight))} />
          <DetailValue label={t('Сума')} value={formatMoney(document.TotalNetPrice)} />
        </SimpleGrid>
      </Stack>
    </Card>
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
  exportingNetId,
  onExport,
  onOpen,
}: {
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
        cell: (row) => <Text fw={700}>{displayValue(row.document.Number)}</Text>,
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
        cell: (row) => formatMoney(row.amount),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 96,
        minWidth: 82,
        accessor: (row) => row.currency,
        cell: (row) => displayValue(row.currency),
      },
      {
        id: 'client',
        header: t('Постачальник / клієнт'),
        width: 260,
        minWidth: 200,
        accessor: (row) => row.client,
        cell: (row) => (
          <Text size="sm" lineClamp={2}>
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
        cell: (row) => displayValue(row.document.Storage?.Name),
      },
      {
        id: 'invoiceNumber',
        header: t('Інвойс'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.invNumber,
        cell: (row) => displayValue(row.invNumber),
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
        cell: (row) => displayValue(row.organization),
      },
      {
        id: 'state',
        header: t('Стан'),
        width: 116,
        minWidth: 96,
        accessor: (row) => row.docState,
        cell: (row) => displayValue(row.docState),
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
          <Text size="sm" lineClamp={2}>
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
            <Tooltip label={t('Відкрити')}>
              <ActionIcon
                aria-label={t('Відкрити')}
                color="gray"
                size={30}
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen(row.document)
                }}
              >
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Експорт')}>
              <ActionIcon
                aria-label={t('Експорт')}
                color="gray"
                disabled={!row.document.NetUid}
                loading={exportingNetId === row.document.NetUid}
                size={30}
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onExport(row.document)
                }}
              >
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [exportingNetId, onExport, onOpen, t],
  )
}

function useProductIncomeItemColumns({
  canOpenProductMovement,
  onOpenMovementHistory,
  onOpenStorageLocationHistory,
}: {
  canOpenProductMovement: boolean
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
        cell: (item) => <Text fw={700}>{displayValue(getItemProductCode(item))}</Text>,
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
        cell: (item) => formatAmount(item.Qty ?? item.PackingListPackageOrderItem?.Qty),
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
            canOpenProductMovement={canOpenProductMovement}
            product={getMovementHistoryProductFromNamedEntity(getIncomeItemProduct(item))}
            onOpenMovementHistory={onOpenMovementHistory}
            onOpenStorageLocationHistory={onOpenStorageLocationHistory}
          />
        ),
      },
    ],
    [canOpenProductMovement, onOpenMovementHistory, onOpenStorageLocationHistory, t],
  )
}

function useRemainingConsignmentColumns({
  canOpenProductMovement,
  onOpenMovementHistory,
  onOpenStorageLocationHistory,
}: {
  canOpenProductMovement: boolean
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
        cell: (item) => displayValue(item.StorageName),
      },
      {
        id: 'productCode',
        header: t('Код'),
        width: 120,
        minWidth: 104,
        accessor: (item) => item.Product?.VendorCode,
        cell: (item) => <Text fw={700}>{displayValue(item.Product?.VendorCode)}</Text>,
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
        cell: (item) => displayValue(item.InvoiceNumber),
      },
      {
        id: 'remainingQty',
        header: t('Залишок'),
        width: 108,
        minWidth: 96,
        align: 'right',
        accessor: (item) => item.RemainingQty,
        cell: (item) => formatAmount(item.RemainingQty),
      },
      {
        id: 'netPrice',
        header: t('Ціна нетто'),
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.NetPrice,
        cell: (item) => formatMoney(item.NetPrice),
      },
      {
        id: 'totalNetPrice',
        header: t('Сума нетто (інвойса)'),
        width: 124,
        minWidth: 112,
        align: 'right',
        accessor: (item) => item.TotalNetPrice,
        cell: (item) => formatMoney(item.TotalNetPrice),
      },
      {
        id: 'grossUnitPrice',
        header: t('Сума брутто УО'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (item) => item.GrossPrice,
        cell: (item) => formatMoney(item.GrossPrice),
      },
      {
        id: 'accountingGrossPrice',
        header: t('Сума брутто БО'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (item) => item.AccountingGrossPrice,
        cell: (item) => formatMoney(item.AccountingGrossPrice),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 94,
        minWidth: 82,
        accessor: (item) => item.CurrencyName,
        cell: (item) => displayValue(item.CurrencyName),
      },
      {
        id: 'incomeInvoiceNumber',
        header: t('Номер прихідної накладної'),
        width: 150,
        minWidth: 130,
        accessor: (item) => item.ProductIncomeNumber,
        cell: (item) => displayValue(item.ProductIncomeNumber),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 180,
        minWidth: 150,
        accessor: (item) => item.OrganizationName,
        cell: (item) => displayValue(item.OrganizationName),
      },
      {
        id: 'weight',
        header: t('Вага'),
        width: 94,
        minWidth: 82,
        align: 'right',
        accessor: (item) => item.Weight,
        cell: (item) => formatAmount(item.Weight),
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
            canOpenProductMovement={canOpenProductMovement}
            product={getMovementHistoryProductFromNamedEntity(item.Product)}
            onOpenMovementHistory={onOpenMovementHistory}
            onOpenStorageLocationHistory={onOpenStorageLocationHistory}
          />
        ),
      },
    ],
    [canOpenProductMovement, onOpenMovementHistory, onOpenStorageLocationHistory, t],
  )
}

function ProductHistoryActionButtons({
  canOpenProductMovement,
  product,
  onOpenMovementHistory,
  onOpenStorageLocationHistory,
}: {
  canOpenProductMovement: boolean
  product: MovementHistoryProduct
  onOpenMovementHistory: (product: MovementHistoryProduct) => void
  onOpenStorageLocationHistory: (product: MovementHistoryProduct) => void
}) {
  const { t } = useI18n()
  const hasProductNetUid = Boolean(product.NetUid)
  const missingProductLabel = t('У товару немає NetUid')

  return (
    <Group gap={4} justify="flex-end" wrap="nowrap">
      <Tooltip label={hasProductNetUid ? t('Історія місця зберігання') : missingProductLabel}>
        <ActionIcon
          aria-label={t('Історія місця зберігання')}
          color="gray"
          disabled={!hasProductNetUid}
          size="sm"
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation()
            onOpenStorageLocationHistory(product)
          }}
        >
          <IconHistory size={16} />
        </ActionIcon>
      </Tooltip>
      {canOpenProductMovement ? (
        <Tooltip label={hasProductNetUid ? t('Рух товару') : missingProductLabel}>
          <ActionIcon
            aria-label={t('Рух товару')}
            color="gray"
            disabled={!hasProductNetUid}
            size="sm"
            variant="subtle"
            onClick={(event) => {
              event.stopPropagation()
              onOpenMovementHistory(product)
            }}
          >
            <IconArrowsExchange size={16} />
          </ActionIcon>
        </Tooltip>
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
