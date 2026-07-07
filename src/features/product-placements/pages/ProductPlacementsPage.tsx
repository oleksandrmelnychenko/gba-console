import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  FileInput,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import { CircleAlert, Download, FileInput as FileInputIcon, FileText, RotateCcw, Search, TriangleAlert, Upload } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useDebouncedValue } from '@mantine/hooks'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  exportProductPlacements,
  exportReturnedProductPlacements,
  getProductPlacements,
  getProductPlacementStorages,
  submitReturnedProductPlacements,
  uploadProductPlacementFile,
} from '../api/productPlacementsApi'
import type {
  ProductPlacementParseConfiguration,
  ProductPlacementRow,
  ProductPlacementsExportDocument,
  ProductPlacementStorageLocation,
} from '../types'
import './product-placements-page.css'

const SEARCH_DEBOUNCE_MS = 200

const PLACEMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'created', 'vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const RETURNED_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type PlacementsListState = {
  isLoading: boolean
  placements: ProductPlacementRow[]
  total?: number
}

type PlacementImportForm = ProductPlacementParseConfiguration & {
  file: File | null
  storageId: string
}

function useProductPlacementsPageModel() {
  const { t } = useI18n()
  const [storages, setStorages] = useValueState<ProductPlacementStorageLocation[]>([])
  const [selectedStorageIds, setSelectedStorageIds] = useValueState<string[]>([])
  const [dateTo, setDateTo] = useValueState(getDefaultDateTo)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [debouncedSearchDraft] = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)
  const searchValue = debouncedSearchDraft.trim()
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [listState, setListState] = useValueState<PlacementsListState>({
    isLoading: false,
    placements: [],
    total: undefined,
  })
  const [error, setError] = useValueState<string | null>(null)
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductPlacementsExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const [importModalOpened, setImportModalOpened] = useValueState(false)
  const [importError, setImportError] = useValueState<string | null>(null)
  const [isUploading, setUploading] = useValueState(false)
  const [returnModalOpened, setReturnModalOpened] = useValueState(false)
  const [returnError, setReturnError] = useValueState<string | null>(null)
  const [returnedRows, setReturnedRows] = useValueState<ProductPlacementRow[]>([])
  const [isSubmittingReturned, setSubmittingReturned] = useValueState(false)
  const [productCardNetId, setProductCardNetId] = useValueState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, toggleDensity } = useDataTableDensity('product-placements', PLACEMENTS_TABLE_DEFAULT_LAYOUT.density)
  const { isLoading, placements, total } = listState
  const selectedStorageIdNumbers = useMemo(() => parseStorageIds(selectedStorageIds), [selectedStorageIds])
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateTo, selectedStorageIds)
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : placements.length === pageSize
  const columns = useProductPlacementColumns(placements, offset, setProductCardNetId)
  const returnedColumns = useReturnedProductPlacementColumns({
    onChangePlacement: updateReturnedPlacement,
    onChangeQty: updateReturnedQty,
    onOpenProductCard: setProductCardNetId,
  })
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {searchValue ? `${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [searchValue, t],
  )

  const resetPlacements = useCallback(() => {
    setListState({
      isLoading: false,
      placements: [],
      total: undefined,
    })
  }, [setListState])

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setError(null)

      try {
        const nextStorages = await getProductPlacementStorages()

        if (!cancelled) {
          setStorages(nextStorages)
          setSelectedStorageIds((currentStorageIds) => {
            const nextStorageIds = getStorageIds(nextStorages)

            if (currentStorageIds.length > 0) {
              const availableIds = new Set(nextStorageIds)
              const retainedIds = currentStorageIds.filter((storageId) => availableIds.has(storageId))

              return retainedIds.length > 0 ? retainedIds : nextStorageIds
            }

            return nextStorageIds
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setSelectedStorageIds([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
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
  }, [reloadKey, setError, setLoadingStorages, setSelectedStorageIds, setStorages, t])

  useEffect(() => {
    if (filterError) {
      resetPlacements()
      return
    }

    let cancelled = false

    async function loadPlacements() {
      setListState((currentState) => ({
        ...currentState,
        isLoading: true,
      }))
      setError(null)

      try {
        const response = await getProductPlacements({
          limit: pageSize,
          offset,
          storageIds: selectedStorageIdNumbers,
          to: toEndOfDayIso(dateTo),
          value: searchValue,
        })

        if (!cancelled) {
          setListState({
            isLoading: false,
            placements: response.Items,
            total: response.Total,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setListState({
            isLoading: false,
            placements: [],
            total: undefined,
          })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити розміщення'))
        }
      }
    }

    void loadPlacements()

    return () => {
      cancelled = true
    }
  }, [
    dateTo,
    filterError,
    offset,
    pageSize,
    reloadKey,
    resetPlacements,
    searchValue,
    selectedStorageIdNumbers,
    setError,
    setListState,
    t,
  ])

  async function handleExport() {
    setExporting(true)
    setError(null)

    try {
      const document = await exportProductPlacements()

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт'))
    } finally {
      setExporting(false)
    }
  }

  async function handleImport(form: PlacementImportForm) {
    if (!form.file) {
      setImportError(t('Оберіть файл для імпорту'))
      return
    }

    const storageId = Number(form.storageId)

    if (!Number.isFinite(storageId)) {
      setImportError(t('Оберіть склад для імпорту'))
      return
    }

    if (form.StartRow > form.EndRow) {
      setImportError(t('Кінцевий рядок має бути не меншим за початковий'))
      return
    }

    setUploading(true)
    setImportError(null)

    try {
      const formData = new FormData()
      formData.append('file', form.file)
      formData.append('storageId', JSON.stringify(storageId))
      formData.append(
        'parseConfiguration',
        JSON.stringify({
          ColumnPlacement: form.ColumnPlacement,
          ColumnQty: form.ColumnQty,
          ColumnVendorCode: form.ColumnVendorCode,
          EndRow: form.EndRow,
          StartRow: form.StartRow,
        }),
      )

      const result = await uploadProductPlacementFile(formData)

      setImportModalOpened(false)
      setPage(1)
      reload()

      if (result.ReturnedProducts.length > 0) {
        setReturnedRows(result.ReturnedProducts)
        setReturnModalOpened(true)
      } else {
        notifications.show({
          color: 'green',
          message: t('Файл розміщень завантажено'),
        })
      }
    } catch (uploadError) {
      setImportError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити файл розміщень'))
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmitReturned() {
    if (returnedRows.length === 0) {
      return
    }

    setSubmittingReturned(true)
    setReturnError(null)

    try {
      const result = await submitReturnedProductPlacements({
        productPlacementStorages: returnedRows,
        storageId: returnedRows[0]?.StorageId,
      })

      if (result.ReturnedProducts.length > 0) {
        setReturnedRows(result.ReturnedProducts)
      } else {
        setReturnModalOpened(false)
        setReturnedRows([])
        reload()
        notifications.show({
          color: 'green',
          message: t('Повернені позиції оновлено'),
        })
      }
    } catch (submitError) {
      setReturnError(submitError instanceof Error ? submitError.message : t('Не вдалося оновити повернені позиції'))
    } finally {
      setSubmittingReturned(false)
    }
  }

  async function handleExportReturned() {
    if (returnedRows.length === 0) {
      return
    }

    setExporting(true)
    setReturnError(null)

    try {
      const document = await exportReturnedProductPlacements(returnedRows)

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setReturnError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати імпортний експорт'))
    } finally {
      setExporting(false)
    }
  }

  function updateSearch(nextSearchValue: string) {
    setPage(1)
    setSearchDraft(nextSearchValue)
  }

  function resetFilters() {
    setDateTo(getDefaultDateTo())
    setSearchDraft('')
    setSelectedStorageIds(getStorageIds(storages))
    setPage(1)
  }

  function updateReturnedPlacement(index: number, placement: string) {
    setReturnedRows((currentRows) =>
      currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, Placement: placement } : row)),
    )
  }

  function updateReturnedQty(index: number, qty: number | string) {
    const nextQty = typeof qty === 'number' ? qty : Number(qty)

    setReturnedRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              Qty: Number.isFinite(nextQty) ? nextQty : 0,
            }
          : row,
      ),
    )
  }

  return {
    canMoveForward,
    columns,
    dateTo,
    density,
    downloadDocument,
    downloadModalOpened,
    error,
    filterError,
    importError,
    importModalOpened,
    isExporting,
    isLoading,
    isLoadingStorages,
    isSubmittingReturned,
    isUploading,
    page,
    pageSize,
    placements,
    productCardNetId,
    returnError,
    returnModalOpened,
    returnedColumns,
    returnedRows,
    searchDraft,
    selectedStorageIds,
    storageOptions,
    toolbarLeft,
    handleExport,
    handleExportReturned,
    handleImport,
    handleSubmitReturned,
    reload,
    resetFilters,
    setDateTo,
    setDownloadModalOpened,
    setImportError,
    setImportModalOpened,
    setPage,
    setPageSize,
    setProductCardNetId,
    setReturnError,
    setReturnModalOpened,
    setSelectedStorageIds,
    toggleDensity,
    updateSearch,
  }
}

export function ProductPlacementsPage() {
  const model = useProductPlacementsPageModel()

  return <ProductPlacementsPageView model={model} />
}

function ProductPlacementsPageView({ model }: { model: ReturnType<typeof useProductPlacementsPageModel> }) {
  const { t } = useI18n()
  const {
    canMoveForward,
    columns,
    dateTo,
    density,
    downloadDocument,
    downloadModalOpened,
    error,
    filterError,
    importError,
    importModalOpened,
    isExporting,
    isLoading,
    isLoadingStorages,
    isSubmittingReturned,
    isUploading,
    page,
    pageSize,
    placements,
    productCardNetId,
    returnError,
    returnModalOpened,
    returnedColumns,
    returnedRows,
    searchDraft,
    selectedStorageIds,
    storageOptions,
    toolbarLeft,
    handleExport,
    handleExportReturned,
    handleImport,
    handleSubmitReturned,
    reload,
    resetFilters,
    setDateTo,
    setDownloadModalOpened,
    setImportError,
    setImportModalOpened,
    setPage,
    setPageSize,
    setProductCardNetId,
    setReturnError,
    setReturnModalOpened,
    setSelectedStorageIds,
    toggleDensity,
    updateSearch,
  } = model
  const noStorages = !isLoadingStorages && storageOptions.length === 0

  return (
    <Stack className="product-placements-page" gap={6}>

      <Card className="app-data-card product-placements-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-placements-filter-bar">
          <Group align="end" gap="sm" wrap="nowrap" className="product-placements-filter-row">
            <MultiSelect
              searchable
              data={storageOptions}
              disabled={isLoadingStorages || storageOptions.length === 0}
              label={t('Склади')}
              maxDropdownHeight={320}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склади')}
              value={selectedStorageIds}
              style={{ flex: '1 1 320px', minWidth: 260 }}
              onChange={(value) => {
                setPage(1)
                setSelectedStorageIds(value)
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
              leftSection={<Search size={16} />}
              label={t('Пошук')}
              placeholder={t('Код або назва товару')}
              value={searchDraft}
              style={{ flex: '1 1 220px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon variant="light" color="gray" size={34} aria-label={t('Скинути')} onClick={resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Імпорт')}>
                <ActionIcon
                  aria-label={t('Імпорт')}
                  color="gray"
                  disabled={storageOptions.length === 0}
                  size={34}
                  variant="light"
                  onClick={() => setImportModalOpened(true)}
                >
                  <FileInputIcon size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Експорт')}>
                <ActionIcon
                  aria-label={t('Експорт')}
                  color="gray"
                  loading={isExporting}
                  size={34}
                  variant="light"
                  onClick={handleExport}
                >
                  <Download size={18} />
                </ActionIcon>
              </Tooltip>
              <DataTableDensityToggle density={density} onToggle={toggleDensity} size={34} />
              <Paginator
                hasNext={canMoveForward}
                isLoading={isLoading || isLoadingStorages}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPage(1)
                  setPageSize(nextPageSize)
                }}
                onRefresh={() => reload()}
              />
            </div>
            {returnedRows.length > 0 && (
              <Button
                color="red"
                leftSection={<TriangleAlert size={16} />}
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                variant="light"
                onClick={() => setReturnModalOpened(true)}
              >
                {t('Не пройдені товари')}
              </Button>
            )}
          </Group>
        </div>

        {(error || filterError || noStorages) && (
          <Alert
            className="product-placements-page__alert"
            color={filterError && !noStorages ? 'yellow' : 'red'}
            icon={<CircleAlert size={18} />}
            variant="light"
          >
            {noStorages ? t('Складів не знайдено') : filterError || error}
          </Alert>
        )}

        <div className="product-placements-page__table">
          <DataTable
            columns={columns}
            data={placements}
            defaultLayout={PLACEMENTS_TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText={t('Розміщень не знайдено')}
            getRowId={(placement, index) =>
              String(placement.NetUid || placement.Id || `${placement.VendorCode || ''}-${placement.StorageId || ''}-${index}`)
            }
            height="100%"
            isLoading={isLoading || isLoadingStorages}
            layoutVersion="product-placements-table-2"
            loadingText={t('Завантаження розміщень')}
            minWidth={980}
            tableId="product-placements"
            toolbarLeft={toolbarLeft}
          />
        </div>
      </Card>

      <ProductPlacementImportModal
        error={importError}
        isUploading={isUploading}
        opened={importModalOpened}
        storageOptions={storageOptions}
        onClose={() => {
          setImportModalOpened(false)
          setImportError(null)
        }}
        onSubmit={handleImport}
      />

      <ReturnedProductsModal
        columns={returnedColumns}
        error={returnError}
        isExporting={isExporting}
        isSubmitting={isSubmittingReturned}
        opened={returnModalOpened}
        rows={returnedRows}
        onClose={() => {
          setReturnModalOpened(false)
          setReturnError(null)
        }}
        onExport={handleExportReturned}
        onSubmit={handleSubmitReturned}
      />

      <AppModal
        centered
        opened={downloadModalOpened}
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Документи розміщень')}</span>}
        onClose={() => setDownloadModalOpened(false)}
      >
        <Stack gap="sm">
          {downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.DocumentURL && (
                <Anchor href={getDocumentHref(downloadDocument.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-excel">
                    <ExcelIcon size={22} />
                  </span>
                  <span>{t('Excel документ')}</span>
                </Anchor>
              )}
              {downloadDocument.PdfDocumentURL && (
                <Anchor href={getDocumentHref(downloadDocument.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-pdf">
                    <FileText size={22} strokeWidth={1.8} />
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

      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Stack>
  )
}

function ProductPlacementImportModal({
  error,
  isUploading,
  opened,
  storageOptions,
  onClose,
  onSubmit,
}: {
  error: string | null
  isUploading: boolean
  opened: boolean
  storageOptions: { label: string; value: string }[]
  onClose: () => void
  onSubmit: (form: PlacementImportForm) => void
}) {
  const { t } = useI18n()
  const [form, setForm] = useValueState<PlacementImportForm>(() => ({
    ColumnPlacement: 3,
    ColumnQty: 2,
    ColumnVendorCode: 1,
    EndRow: 1000,
    StartRow: 2,
    file: null,
    storageId: storageOptions[0]?.value || '',
  }))

  useEffect(() => {
    setForm((currentForm) => {
      if (currentForm.storageId && storageOptions.some((option) => option.value === currentForm.storageId)) {
        return currentForm
      }

      return {
        ...currentForm,
        storageId: storageOptions[0]?.value || '',
      }
    })
  }, [setForm, storageOptions])

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <AppModal centered opened={opened} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Імпорт розміщень')}</span>} onClose={onClose}>
      <form onSubmit={submitForm}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}
          <Select
            searchable
            allowDeselect={false}
            data={storageOptions}
            label={t('Склад')}
            placeholder={t('Оберіть склад')}
            value={form.storageId || null}
            onChange={(value) => setForm((currentForm) => ({ ...currentForm, storageId: value || '' }))}
          />
          <FileInput
            clearable
            accept=".xlsx"
            label={t('Файл')}
            leftSection={<Upload size={16} />}
            placeholder={t('Оберіть файл')}
            value={form.file}
            onChange={(file) => setForm((currentForm) => ({ ...currentForm, file }))}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              min={1}
              label={t('Колонка коду товару')}
              value={form.ColumnVendorCode}
              onChange={(value) => setForm((currentForm) => ({ ...currentForm, ColumnVendorCode: toInteger(value, 1) }))}
            />
            <NumberInput
              min={1}
              label={t('Колонка кількості')}
              value={form.ColumnQty}
              onChange={(value) => setForm((currentForm) => ({ ...currentForm, ColumnQty: toInteger(value, 2) }))}
            />
            <NumberInput
              min={1}
              label={t('Колонка розміщення')}
              value={form.ColumnPlacement}
              onChange={(value) => setForm((currentForm) => ({ ...currentForm, ColumnPlacement: toInteger(value, 3) }))}
            />
            <NumberInput
              min={1}
              label={t('Перший рядок')}
              value={form.StartRow}
              onChange={(value) => setForm((currentForm) => ({ ...currentForm, StartRow: toInteger(value, 2) }))}
            />
            <NumberInput
              min={1}
              label={t('Останній рядок')}
              value={form.EndRow}
              onChange={(value) => setForm((currentForm) => ({ ...currentForm, EndRow: toInteger(value, 1000) }))}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button color="gray" disabled={isUploading} variant="light" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button loading={isUploading} type="submit">
              {t('Завантажити')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function ReturnedProductsModal({
  columns,
  error,
  isExporting,
  isSubmitting,
  opened,
  rows,
  onClose,
  onExport,
  onSubmit,
}: {
  columns: DataTableColumn<ProductPlacementRow>[]
  error: string | null
  isExporting: boolean
  isSubmitting: boolean
  opened: boolean
  rows: ProductPlacementRow[]
  onClose: () => void
  onExport: () => void
  onSubmit: () => void
}) {
  const { t } = useI18n()
  const indexedRows = useMemo(
    () => rows.map((row, index) => ({ ...row, __returnedIndex: index })),
    [rows],
  )
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Позицій')} {rows.length}
      </Text>
    ),
    [rows.length, t],
  )

  return (
    <AppModal centered opened={opened} size="min(1100px, 96vw)" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Не пройшли імпорт')}</span>} onClose={onClose}>
      <Stack gap="md">
        <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
          {t('Перевірте кількість або розміщення та відправте позиції повторно.')}
        </Alert>
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}
        <DataTable
          columns={columns}
          data={indexedRows}
          defaultLayout={RETURNED_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Повернених позицій немає')}
          getRowId={(row, index) => String(row.NetUid || row.Id || `${row.VendorCode || ''}-${index}`)}
          layoutVersion="product-placement-returned-table-1"
          maxHeight={460}
          minWidth={900}
          tableId="product-placement-returned"
          toolbarLeft={toolbarLeft}
        />
        <Group justify="flex-end">
          <Button leftSection={<Download size={16} />} loading={isExporting} variant="outline" onClick={onExport}>
            {t('Експорт')}
          </Button>
          <Button loading={isSubmitting} onClick={onSubmit}>
            {t('Оновити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function useProductPlacementColumns(
  placements: ProductPlacementRow[],
  offset: number,
  onOpenProductCard: (productNetId: string) => void,
): DataTableColumn<ProductPlacementRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductPlacementRow>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (placement) => String(offset + placements.indexOf(placement) + 1),
      },
      {
        id: 'created',
        header: t('Створено'),
        width: 150,
        minWidth: 132,
        accessor: (row) => row.Created,
        cell: (row) => <Text size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatDateTime(row.Created)}</Text>,
      },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 150,
        minWidth: 122,
        accessor: getVendorCode,
        cell: (row) => renderVendorCodeCell(row, onOpenProductCard),
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 320,
        minWidth: 240,
        accessor: getProductName,
        cell: (row) => renderProductNameCell(row, onOpenProductCard),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 112,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatAmount(row.Qty)}</Text>,
      },
      {
        id: 'placement',
        header: t('Розміщення'),
        width: 360,
        minWidth: 240,
        accessor: (row) => row.Placement,
        cell: (row) => (
          <Text lineClamp={2} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
            {displayValue(row.Placement)}
          </Text>
        ),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 190,
        minWidth: 150,
        accessor: (row) => row.Storage?.Name,
        cell: (row) => displayValue(row.Storage?.Name),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 170,
        minWidth: 140,
        accessor: getResponsibleName,
        cell: (row) => displayValue(getResponsibleName(row)),
      },
    ],
    [offset, onOpenProductCard, placements, t],
  )
}

function useReturnedProductPlacementColumns({
  onChangePlacement,
  onChangeQty,
  onOpenProductCard,
}: {
  onChangePlacement: (index: number, placement: string) => void
  onChangeQty: (index: number, qty: number | string) => void
  onOpenProductCard: (productNetId: string) => void
}): DataTableColumn<ProductPlacementRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductPlacementRow>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 150,
        minWidth: 122,
        accessor: getVendorCode,
        cell: (row) => renderVendorCodeCell(row, onOpenProductCard),
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 260,
        minWidth: 220,
        accessor: getProductName,
        cell: (row) => renderProductNameCell(row, onOpenProductCard),
      },
      {
        id: 'placement',
        header: t('Розміщення'),
        width: 190,
        minWidth: 160,
        accessor: (row) => row.Placement,
        cell: (row) => (
          <TextInput
            aria-label={t('Розміщення')}
            value={row.Placement || ''}
            onChange={(event) => onChangePlacement(getReturnedRowIndex(row), event.currentTarget.value)}
          />
        ),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 120,
        minWidth: 104,
        accessor: (row) => row.Qty,
        cell: (row) => (
          <NumberInput
            aria-label={t('Кількість')}
            min={0}
            value={row.Qty || 0}
            onChange={(value) => onChangeQty(getReturnedRowIndex(row), value)}
          />
        ),
      },
      {
        id: 'error',
        header: t('Помилка'),
        width: 260,
        minWidth: 200,
        accessor: (row) => row.ErrorMessage,
        cell: (row) => (
          <Text c="red" size="sm" lineClamp={2}>
            {displayValue(row.ErrorMessage)}
          </Text>
        ),
      },
    ],
    [onChangePlacement, onChangeQty, onOpenProductCard, t],
  )
}

function renderVendorCodeCell(row: ProductPlacementRow, onOpenProductCard: (productNetId: string) => void) {
  const netId = row.Product?.NetUid
  const code = displayValue(getVendorCode(row))

  return netId ? (
    <Anchor
      c="dark.6"
      component="button"
      fw={600}
      style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}
      type="button"
      underline="always"
      onClick={(event) => {
        event.stopPropagation()
        onOpenProductCard(netId)
      }}
    >
      {code}
    </Anchor>
  ) : (
    <Text fw={600} style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{code}</Text>
  )
}

function renderProductNameCell(row: ProductPlacementRow, onOpenProductCard: (productNetId: string) => void) {
  const netId = row.Product?.NetUid
  const name = displayValue(getProductName(row))

  return netId ? (
    <Anchor
      c="dark.6"
      component="button"
      lineClamp={2}
      size="sm"
      type="button"
      underline="always"
      onClick={(event) => {
        event.stopPropagation()
        onOpenProductCard(netId)
      }}
    >
      {name}
    </Anchor>
  ) : (
    <Text size="sm" lineClamp={2}>
      {name}
    </Text>
  )
}

function buildStorageOptions(storages: ProductPlacementStorageLocation[]): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (typeof storage.Id === 'number' && Number.isFinite(storage.Id)) {
      options.push({
        label: storage.Name || translate('Без назви'),
        value: String(storage.Id),
      })
    }

    return options
  }, [])
}

function parseStorageIds(storageIds: string[]): number[] {
  const parsedStorageIds: number[] = []

  for (const storageId of storageIds) {
    const parsedStorageId = Number(storageId)

    if (Number.isFinite(parsedStorageId)) {
      parsedStorageIds.push(parsedStorageId)
    }
  }

  return parsedStorageIds
}

function getStorageIds(storages: ProductPlacementStorageLocation[]): string[] {
  const storageIds: string[] = []

  for (const storage of storages) {
    if (typeof storage.Id === 'number' && Number.isFinite(storage.Id)) {
      storageIds.push(String(storage.Id))
    }
  }

  return storageIds
}

function getVendorCode(row: ProductPlacementRow): string | undefined {
  return row.VendorCode || row.Product?.VendorCode
}

function getProductName(row: ProductPlacementRow): string | undefined {
  return row.Product?.NameUA || row.Product?.Name
}

function getResponsibleName(row: ProductPlacementRow): string | undefined {
  return row.Responsible?.FullName || row.Responsible?.Name || row.Responsible?.LastName
}

function getDefaultDateTo(): string {
  return formatLocalDate(new Date())
}

function toEndOfDayIso(dateValue: string): string {
  return new Date(`${dateValue}T23:59:59.999`).toISOString()
}

function getFilterError(dateTo: string, selectedStorageIds: string[]): string | null {
  if (!dateTo) {
    return translate('Вкажіть дату завершення')
  }

  if (selectedStorageIds.length === 0) {
    return translate('Оберіть принаймні один склад')
  }

  return null
}

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }

  return amountFormatter.format(value)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}

function toInteger(value: number | string, fallback: number): number {
  const parsedValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsedValue) ? Math.max(1, Math.trunc(parsedValue)) : fallback
}

function getReturnedRowIndex(row: ProductPlacementRow): number {
  return row.__returnedIndex ?? 0
}
