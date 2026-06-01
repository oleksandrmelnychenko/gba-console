import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Select,
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
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFileTypePdf,
  IconHistory,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconStack2,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  ProductMovementHistoryDrawer,
  ProductStorageLocationHistoryDrawer,
  type MovementHistoryProduct,
} from '../../../shared/ui/product-movement-history/ProductMovementHistoryDrawers'
import { useAuth } from '../../auth/useAuth'
import { getProductCapitalization } from '../../product-capitalizations/api/productCapitalizationsApi'
import type { ProductCapitalization } from '../../product-capitalizations/types'
import {
  exportProductIncomeDocument,
  getProductIncomeDocuments,
  getProductIncomeInfo,
  getProductIncomeRemainings,
} from '../api/productIncomeDocumentsApi'
import type {
  NamedEntity,
  ProductIncomeDocument,
  ProductIncomeDocumentsExportDocument,
  ProductIncomeInfo,
  ProductIncomeItem,
  RemainingConsignment,
} from '../types'

const FILTER_STORAGE_KEY = 'documentsFilters'
const PRODUCT_MOVEMENT_PERMISSION = 'Product_Entire_Assortment_Product_Movement_Btn_PKEY'
const PAGE_SIZE = 20
const pageSizeOptions = ['20', '40', '60', '100']

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

type DocumentRow = {
  amount?: number
  client?: string
  comment?: string
  currency?: string
  document: ProductIncomeDocument
  docState?: string
  invDate?: string
  invNumber?: string
  organization?: string
  qty?: number
  specificationDate?: string
  type?: string
}

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
  const remainingsRequestRef = useRef(0)
  const capitalizationRequestRef = useRef(0)
  const infoRequestRef = useRef(0)
  const exportRequestRef = useRef(0)
  const { documents, isLoading, total } = documentsState
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateFrom, dateTo)
  const canMoveBackward = page > 1
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : documents.length === pageSize
  const canOpenProductMovement = hasPermission(PRODUCT_MOVEMENT_PERMISSION)
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Сторінка')} {page}
        {typeof total === 'number' ? `, ${t('усього')}: ${total}` : ''}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [page, searchValue, t, total],
  )

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
          from: dateFrom,
          limit: pageSize,
          offset,
          to: dateTo,
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

  function updateSearch(nextSearchValue: string) {
    setPage(1)
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetFilters() {
    const defaults = getDefaultFilters()

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
    canMoveBackward,
    canMoveForward,
    capitalization,
    capitalizationError,
    capitalizationItemColumns,
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
    toolbarLeft,
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
  const model = useProductIncomeDocumentsPageModel()

  return <ProductIncomeDocumentsPageView model={model} />
}

function ProductIncomeDocumentsPageView({ model }: { model: ReturnType<typeof useProductIncomeDocumentsPageModel> }) {
  const { t } = useI18n()
  const {
    canMoveBackward,
    canMoveForward,
    capitalization,
    capitalizationError,
    capitalizationItemColumns,
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
    toolbarLeft,
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
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => reload()}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              label={t('Від')}
              type="date"
              value={dateFrom}
              w={150}
              onChange={(event) => {
                setPage(1)
                setDateFrom(event.currentTarget.value)
              }}
            />
            <TextInput
              label={t('До')}
              type="date"
              value={dateTo}
              w={150}
              onChange={(event) => {
                setPage(1)
                setDateTo(event.currentTarget.value)
              }}
            />
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Номер, постачальник або коментар')}
              value={searchDraft}
              style={{ flex: '1 1 260px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(error || filterError) && (
            <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {filterError || error}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text size="sm" c="dimmed">
              {t('Показано')} {rows.length}
            </Text>
            <Group gap="xs">
              <Select
                aria-label={t('Розмір сторінки')}
                data={pageSizeOptions}
                value={String(pageSize)}
                w={84}
                onChange={(value) => {
                  setPage(1)
                  setPageSize(Number(value || PAGE_SIZE))
                }}
              />
              <ActionIcon
                aria-label={t('Попередня сторінка')}
                color="gray"
                disabled={!canMoveBackward || isLoading}
                size={36}
                variant="light"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text size="sm" w={34} ta="center">
                {page}
              </Text>
              <ActionIcon
                aria-label={t('Наступна сторінка')}
                color="gray"
                disabled={!canMoveForward || isLoading}
                size={36}
                variant="light"
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Group>

          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={DOCUMENTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Документів не знайдено')}
            getRowId={(row, index) => String(row.document.NetUid || row.document.Id || index)}
            isLoading={isLoading}
            layoutVersion="product-income-documents-table-1"
            loadingText={t('Завантаження документів')}
            maxHeight="calc(100vh - 330px)"
            minWidth={1440}
            tableId="product-income-documents"
            toolbarLeft={toolbarLeft}
            onRowClick={(row) => openOptions(row.document)}
          />
        </Stack>
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
                <Anchor href={downloadDocument.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-excel">
                    <ExcelIcon size={22} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor href={downloadDocument.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
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

  return (
    <AppModal centered opened={Boolean(document)} title={t('Виберіть опцію')} onClose={onClose}>
      {document && (
        <Stack gap="sm">
          <Text c="dimmed" size="sm">
            {title}
          </Text>
          <Button justify="flex-start" leftSection={<IconEye size={18} />} variant="light" onClick={() => onOverview(document)}>
            {t('Огляд')}
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
  const sourceLink = document ? getSourceLink(document) : null
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
            <Badge color="violet" variant="light">
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
              <Button disabled={!document.NetUid} variant="filled" onClick={() => onLoadRemainings(document)}>
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
            <Alert color="violet" icon={<IconAlertCircle size={18} />} variant="light">
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
                data={document.ProductIncomeItems || []}
                defaultLayout={ITEMS_TABLE_DEFAULT_LAYOUT}
                emptyText={t('Позицій не знайдено')}
                getRowId={(item, index) => String(item.NetUid || item.Id || index)}
                isLoading={isLoadingDocumentInfo}
                layoutVersion="product-income-document-items-1"
                loadingText={t('Завантаження позицій документа')}
                maxHeight={320}
                minWidth={720}
                tableId="product-income-document-items"
              />
            </Stack>
          )}

          {detailMode === 'remainings' && (
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={4}>{t('Залишки по партіям')}</Title>
                <Text size="sm" c="dimmed">
                  {t('Показано')} {remainings.length}
                </Text>
              </Group>
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
                layoutVersion="product-income-document-remainings-1"
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
    ],
    [t],
  )
}

function SaleReturnOverview({ document }: { document: ProductIncomeDocument }) {
  const { t } = useI18n()
  const items = (document.ProductIncomeItems || []).filter((item) => item.SaleReturnItem)
  const firstItem = items[0]?.SaleReturnItem
  const agreement = firstItem?.OrderItem?.Order?.Sale?.ClientAgreement?.Agreement
  const currencyCode = agreement?.Currency?.Code || agreement?.Currency?.Name || ''
  const isVat = Boolean(agreement?.WithVATAccounting)

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
          <Stack gap="xs">
            {items.map((item) => {
              const saleReturnItem = item.SaleReturnItem

              return (
                <Card key={getSaleReturnIncomeItemKey(item)} withBorder radius="sm" padding="sm">
                  <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
                    <Stack gap={2}>
                      <Group gap={6} align="baseline" wrap="nowrap">
                        <Text c="dimmed" size="xs">
                          {displayValue(saleReturnItem?.OrderItem?.Product?.VendorCode)}
                        </Text>
                        <Text fw={600} size="sm">
                          {displayValue(saleReturnItem?.OrderItem?.Product?.Name)}
                        </Text>
                      </Group>
                    </Stack>
                    <Group gap="lg" align="flex-start" wrap="nowrap">
                      <Stack gap={0} align="flex-end">
                        <Text fw={600} size="sm">
                          {formatMoney(saleReturnItem?.AmountLocal)} {currencyCode}
                        </Text>
                        <Text c="dimmed" size="xs">
                          {t('Сума нетто (інвойса)')}
                        </Text>
                      </Stack>
                      {isVat && (
                        <Stack gap={0} align="flex-end">
                          <Text fw={600} size="sm">
                            {formatMoney(saleReturnItem?.VatAmount)}
                          </Text>
                          <Text c="dimmed" size="xs">
                            {t('ПДВ')}
                          </Text>
                        </Stack>
                      )}
                      <Stack gap={0} align="flex-end">
                        <Text fw={600} size="sm">
                          {formatAmount(saleReturnItem?.Qty ?? item.Qty)}
                        </Text>
                        <Text c="dimmed" size="xs">
                          {t('штук')}
                        </Text>
                      </Stack>
                    </Group>
                  </Group>
                </Card>
              )
            })}
          </Stack>
        )}
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

function getOverviewKind(
  document: ProductIncomeDocument,
): 'capitalization' | 'saleReturn' | 'document' {
  const items = document.ProductIncomeItems || []

  if (items.some((item) => item.ProductCapitalizationItem?.ProductCapitalization)) {
    return 'capitalization'
  }

  if (items.some((item) => item.SaleReturnItem?.SaleReturn)) {
    return 'saleReturn'
  }

  return 'document'
}

function getCapitalizationNetUid(document: ProductIncomeDocument): string | null {
  const items = document.ProductIncomeItems || []
  const capitalization = items
    .map((item) => item.ProductCapitalizationItem?.ProductCapitalization)
    .find((value) => value?.NetUid)

  return capitalization?.NetUid || null
}

function getDeferredOverviewNote(
  document: ProductIncomeDocument,
  t: (key: string) => string,
): string | null {
  const items = document.ProductIncomeItems || []

  if (items.some((item) => item.SupplyOrderUkraineItem?.SupplyOrderUkraine)) {
    return t('Огляд прихідного інвойса в Україну доступний у модулі замовлень')
  }

  if (items.some((item) => item.ActReconciliationItem?.ActReconciliation)) {
    return t('Огляд акта звірки доступний у модулі актів')
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

function getIncomeItemProduct(item: ProductIncomeItem): NamedEntity | null | undefined {
  return item.PackingListPackageOrderItem?.SupplyInvoiceOrderItem?.Product || item.Product
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

function mapDocumentRow(document: ProductIncomeDocument): DocumentRow {
  const items = document.ProductIncomeItems || []
  const amount = getDocumentAmount(document)
  const documentIsActive = !document.Deleted
  const baseRow = {
    amount,
    comment: document.Comment,
    currency: document.Currency?.Code || document.Currency?.Name,
    document,
  }
  const saleReturnItem = items.find((item) => item.SaleReturnItem)?.SaleReturnItem

  if (saleReturnItem?.SaleReturn) {
    return {
      ...baseRow,
      client: getEntityName(saleReturnItem.SaleReturn.Client),
      comment: saleReturnItem.Comment || document.Comment,
      docState: getDocumentState(documentIsActive && !items.some((item) => item.SaleReturnItem?.SaleReturn?.IsCanceled)),
      invDate: saleReturnItem.SaleReturn.FromDate,
      invNumber: saleReturnItem.SaleReturn.Number,
      organization: getEntityName(saleReturnItem.OrderItem?.Order?.Sale?.ClientAgreement?.Agreement?.Organization),
      qty: document.TotalQty,
      specificationDate: saleReturnItem.SaleReturn.FromDate,
      type: translate('Повернення продажу'),
    }
  }

  const packingItem = items.find((item) => item.PackingListPackageOrderItem)?.PackingListPackageOrderItem
  const packingInvoice = packingItem?.PackingList?.SupplyInvoice

  if (packingInvoice) {
    return {
      ...baseRow,
      amount: packingInvoice.SupplyOrder?.Client?.IsNotResident ? document.TotalNetPrice : document.TotalNetWithVat || 0,
      client: getEntityName(packingInvoice.SupplyOrder?.Client),
      comment: packingInvoice.Comment || document.Comment,
      docState: getDocumentState(documentIsActive),
      invDate: packingInvoice.DateFrom,
      invNumber: packingInvoice.Number,
      organization: getEntityName(packingInvoice.SupplyOrder?.Organization),
      qty: sumItems(items, (item) => item.PackingListPackageOrderItem?.Qty),
      specificationDate: packingInvoice.DateCustomDeclaration || packingInvoice.Created,
      type: translate('Інвойс від постачальника'),
    }
  }

  const ukraineItem = items.find((item) => item.SupplyOrderUkraineItem)?.SupplyOrderUkraineItem
  const ukraineOrder = ukraineItem?.SupplyOrderUkraine

  if (ukraineOrder) {
    return {
      ...baseRow,
      client: getEntityName(ukraineOrder.Supplier),
      comment: ukraineOrder.Comment || document.Comment,
      docState: getDocumentState(documentIsActive),
      invDate: ukraineOrder.FromDate,
      invNumber: ukraineOrder.InvNumber,
      organization: getEntityName(ukraineOrder.Organization),
      qty: sumItems(items, (item) => item.Qty),
      specificationDate: ukraineOrder.InvDate,
      type: translate('Прихідний інвойс в Україну'),
    }
  }

  const reconciliationItem = items.find((item) => item.ActReconciliationItem)?.ActReconciliationItem
  const reconciliation = reconciliationItem?.ActReconciliation

  if (reconciliation) {
    const sourceOrder = reconciliation.SupplyOrderUkraine
    const sourceInvoice = reconciliation.SupplyInvoice

    return {
      ...baseRow,
      client: sourceOrder ? getEntityName(sourceOrder.Supplier) : getEntityName(sourceInvoice?.SupplyOrder?.Client),
      comment: reconciliationItem.Comment || document.Comment,
      docState: getDocumentState(documentIsActive),
      invDate: sourceOrder?.FromDate || reconciliation.FromDate,
      invNumber: sourceOrder?.InvNumber || reconciliation.InvNumber,
      organization: sourceOrder
        ? getEntityName(sourceOrder.Organization)
        : getEntityName(sourceInvoice?.SupplyOrder?.Organization),
      qty: sumItems(items, (item) => item.Qty),
      specificationDate: sourceOrder?.InvDate || reconciliation.InvDate,
      type: sourceOrder ? translate('Прихідний інвойс в Україну') : translate('Інвойс від постачальника'),
    }
  }

  const capitalizationItem = items.find((item) => item.ProductCapitalizationItem)?.ProductCapitalizationItem
  const capitalization = capitalizationItem?.ProductCapitalization

  if (capitalization) {
    return {
      ...baseRow,
      client: '',
      comment: capitalization.Comment || document.Comment,
      docState: getDocumentState(documentIsActive),
      invDate: capitalization.FromDate,
      invNumber: capitalization.Number,
      organization: getEntityName(capitalization.Organization),
      qty: sumItems(items, (item) => item.Qty),
      specificationDate: capitalization.FromDate,
      type: translate('Оприбуткування товару'),
    }
  }

  return {
    ...baseRow,
    docState: getDocumentState(documentIsActive),
    qty: document.TotalQty,
    type: translate('Документ приходу'),
  }
}

function getDocumentAmount(document: ProductIncomeDocument): number | undefined {
  if (isFiniteNumber(document.TotalNetPrice) && document.TotalNetPrice !== 0) {
    return document.TotalNetPrice
  }

  if (isFiniteNumber(document.TotalNetWithVat)) {
    return document.TotalNetWithVat
  }

  return undefined
}

function getSourceLink(document: ProductIncomeDocument): string | null {
  const items = document.ProductIncomeItems || []
  const firstItem = items[0]

  if (!document.NetUid || !firstItem) {
    return null
  }

  if (firstItem.PackingListPackageOrderItem) {
    return `/supply-orders/product-placement/${document.NetUid}`
  }

  if (firstItem.SupplyOrderUkraineItem) {
    return `/orders/ukraine/${document.NetUid}/product-income`
  }

  if (firstItem.ActReconciliationItem?.ActReconciliation?.NetUid) {
    return null
  }

  if (firstItem.ProductCapitalizationItem?.ProductCapitalization?.NetUid) {
    return '/products/capitalization'
  }

  if (items.some((item) => item.SaleReturnItem !== null && typeof item.SaleReturnItem !== 'undefined')) {
    return '/sales/return/client'
  }

  return null
}

function getItemProductCode(item: ProductIncomeItem): string | undefined {
  const product = getIncomeItemProduct(item)

  return product?.VendorCode || product?.Code
}

function getItemProductName(item: ProductIncomeItem): string | undefined {
  const product = getIncomeItemProduct(item)

  return product?.NameUA || product?.Name
}

function getItemComment(item: ProductIncomeItem): string | undefined {
  return item.Comment
    || item.SaleReturnItem?.Comment
    || item.ActReconciliationItem?.Comment
    || item.SupplyOrderUkraineItem?.SupplyOrderUkraine?.Comment
    || item.PackingListPackageOrderItem?.PackingList?.SupplyInvoice?.Comment
    || item.ProductCapitalizationItem?.ProductCapitalization?.Comment
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName || entity?.NameUA || entity?.Name || entity?.LastName || entity?.Number || entity?.VendorCode
}

function getDocumentState(isActive: boolean): string {
  return isActive ? translate('Проведено') : translate('Видалено')
}

function sumItems(items: ProductIncomeItem[], getValue: (item: ProductIncomeItem) => number | undefined): number {
  return items.reduce((total, item) => total + readFiniteNumber(getValue(item)), 0)
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

function readFiniteNumber(value: unknown): number {
  return isFiniteNumber(value) ? value : 0
}
