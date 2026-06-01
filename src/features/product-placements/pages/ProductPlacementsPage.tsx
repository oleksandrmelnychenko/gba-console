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
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileImport,
  IconFileTypePdf,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconUpload,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useDebouncedValue } from '@mantine/hooks'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
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

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 200
const pageSizeOptions = ['20', '40', '60', '100']

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
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
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
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { isLoading, placements, total } = listState
  const selectedStorageIdNumbers = useMemo(() => parseStorageIds(selectedStorageIds), [selectedStorageIds])
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateTo, selectedStorageIds)
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const canMoveBackward = page > 1
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : placements.length === pageSize
  const columns = useProductPlacementColumns(placements, offset)
  const returnedColumns = useReturnedProductPlacementColumns({
    onChangePlacement: updateReturnedPlacement,
    onChangeQty: updateReturnedQty,
  })
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {placements.length}
        {typeof total === 'number' ? ` ${t('з')} ${total}` : ''}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [placements.length, searchValue, t, total],
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
    canMoveBackward,
    canMoveForward,
    columns,
    dateTo,
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
    setReturnError,
    setReturnModalOpened,
    setSelectedStorageIds,
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
    canMoveBackward,
    canMoveForward,
    columns,
    dateTo,
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
    setReturnError,
    setReturnModalOpened,
    setSelectedStorageIds,
    updateSearch,
  } = model
  const noStorages = !isLoadingStorages && storageOptions.length === 0

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Group gap="xs">
          {returnedRows.length > 0 && (
            <Button
              color="red"
              leftSection={<IconAlertTriangle size={16} />}
              variant="light"
              onClick={() => setReturnModalOpened(true)}
            >
              {t('Не пройдені товари')}
            </Button>
          )}
          <Tooltip label={t('Імпорт')}>
            <ActionIcon
              aria-label={t('Імпорт')}
              color="gray"
              disabled={storageOptions.length === 0}
              size={38}
              variant="light"
              onClick={() => setImportModalOpened(true)}
            >
              <IconFileImport size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Експорт')}>
            <ActionIcon
              aria-label={t('Експорт')}
              color="gray"
              loading={isExporting}
              size={38}
              variant="light"
              onClick={handleExport}
            >
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>
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
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
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
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Код або назва товару')}
              value={searchDraft}
              style={{ flex: '1 1 220px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(error || filterError || noStorages) && (
            <Alert color={filterError && !noStorages ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {noStorages ? t('Складів не знайдено') : filterError || error}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text size="sm" c="dimmed">
              {t('Показано')} {placements.length}
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
            data={placements}
            defaultLayout={PLACEMENTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Розміщень не знайдено')}
            getRowId={(placement, index) =>
              String(placement.NetUid || placement.Id || `${placement.VendorCode || ''}-${placement.StorageId || ''}-${index}`)
            }
            isLoading={isLoading || isLoadingStorages}
            layoutVersion="product-placements-table-2"
            loadingText={t('Завантаження розміщень')}
            maxHeight="calc(100vh - 330px)"
            minWidth={980}
            tableId="product-placements"
            toolbarLeft={toolbarLeft}
          />
        </Stack>
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
        title={t('Документи розміщень')}
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
    <AppModal centered opened={opened} size="lg" title={t('Імпорт розміщень')} onClose={onClose}>
      <form onSubmit={submitForm}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
            leftSection={<IconUpload size={16} />}
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
    <AppModal centered opened={opened} size="min(1100px, 96vw)" title={t('Не пройшли імпорт')} onClose={onClose}>
      <Stack gap="md">
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {t('Перевірте кількість або розміщення та відправте позиції повторно.')}
        </Alert>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
          <Button leftSection={<IconDownload size={16} />} loading={isExporting} variant="light" onClick={onExport}>
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
        cell: (row) => formatDateTime(row.Created),
      },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 150,
        minWidth: 122,
        accessor: getVendorCode,
        cell: (row) => <Text fw={700}>{displayValue(getVendorCode(row))}</Text>,
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 320,
        minWidth: 240,
        accessor: getProductName,
        cell: (row) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(getProductName(row))}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 112,
        minWidth: 96,
        align: 'right',
        accessor: (row) => row.Qty,
        cell: (row) => formatAmount(row.Qty),
      },
      {
        id: 'placement',
        header: t('Розміщення'),
        width: 360,
        minWidth: 240,
        accessor: (row) => row.Placement,
        cell: (row) => (
          <Text size="sm" lineClamp={2}>
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
    [offset, placements, t],
  )
}

function useReturnedProductPlacementColumns({
  onChangePlacement,
  onChangeQty,
}: {
  onChangePlacement: (index: number, placement: string) => void
  onChangeQty: (index: number, qty: number | string) => void
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
        cell: (row) => <Text fw={700}>{displayValue(getVendorCode(row))}</Text>,
      },
      {
        id: 'productName',
        header: t('Товар'),
        width: 260,
        minWidth: 220,
        accessor: getProductName,
        cell: (row) => displayValue(getProductName(row)),
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
            defaultValue={row.Placement || ''}
            onBlur={(event) => onChangePlacement(getReturnedRowIndex(row), event.currentTarget.value)}
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
    [onChangePlacement, onChangeQty, t],
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
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return amountFormatter.format(value)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}

function toInteger(value: number | string, fallback: number): number {
  const parsedValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(parsedValue) ? Math.max(1, Math.trunc(parsedValue)) : fallback
}

function getReturnedRowIndex(row: ProductPlacementRow): number {
  return row.__returnedIndex ?? 0
}
