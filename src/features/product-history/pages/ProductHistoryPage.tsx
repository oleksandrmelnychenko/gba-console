import {
  ActionIcon,
  Alert,
  Anchor,
  Card,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeXls,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { exportProductHistory, getProductHistory, getProductHistoryStorages } from '../api/productHistoryApi'
import type {
  ProductAvailabilityDataHistory,
  ProductHistoryExportDocument,
  ProductHistoryItem,
  ProductHistoryPlacement,
  ProductHistoryStorage,
} from '../types'

const PRODUCT_HISTORY_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created', 'vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const pageSizeOptions = ['20', '40', '60', '100']
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

function useProductHistoryPageModel() {
  const { t } = useI18n()
  const [historyItems, setHistoryItems] = useValueState<ProductHistoryItem[]>([])
  const [storages, setStorages] = useValueState<ProductHistoryStorage[]>([])
  const [selectedStorageIds, setSelectedStorageIds] = useValueState<string[]>([])
  const [dateTo, setDateTo] = useValueState(getDefaultDateTo)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [total, setTotal] = useValueState<number | undefined>(undefined)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(20)
  const [error, setError] = useValueState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductHistoryExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateTo, selectedStorageIds)
  const selectedStorageIdNumbers = useMemo(() => parseStorageIds(selectedStorageIds), [selectedStorageIds])
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const canMoveBack = page > 1
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : historyItems.length === pageSize
  const columns = useProductHistoryColumns(selectedStorageIdNumbers)
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {historyItems.length}
        {typeof total === 'number' ? ` ${t('з')} ${total}` : ''}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [historyItems.length, searchValue, t, total],
  )

  const resetHistory = useCallback(() => {
    setHistoryItems([])
    setTotal(undefined)
    setLoading(false)
  }, [setHistoryItems, setLoading, setTotal])

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setError(null)

      try {
        const nextStorages = await getProductHistoryStorages()

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
      resetHistory()
      return
    }

    let cancelled = false

    async function loadHistory() {
      setLoading(true)
      setError(null)

      try {
        const response = await getProductHistory({
          limit: pageSize,
          offset,
          storageIds: selectedStorageIdNumbers,
          to: toEndOfDayIso(dateTo),
          value: searchValue,
        })

        if (!cancelled) {
          setHistoryItems(response.Items)
          setTotal(response.Total)
        }
      } catch (loadError) {
        if (!cancelled) {
          setHistoryItems([])
          setTotal(undefined)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити історію товарів'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [
    dateTo,
    filterError,
    offset,
    pageSize,
    reloadKey,
    resetHistory,
    searchValue,
    selectedStorageIdNumbers,
    setError,
    setHistoryItems,
    setLoading,
    setTotal,
    t,
  ])

  function updateSearch(nextSearchValue: string) {
    setPage(1)
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetFilters() {
    setPage(1)
    setDateTo(getDefaultDateTo())
    setSearchDraft('')
    setSearchValue('')
    setSelectedStorageIds(storageOptions.map((option) => option.value))
  }

  async function handleExport() {
    if (filterError) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const document = await exportProductHistory({
        limit: pageSize,
        offset,
        storageIds: selectedStorageIdNumbers,
        to: toEndOfDayIso(dateTo),
        value: searchValue,
      })

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт історії товарів'))
    } finally {
      setExporting(false)
    }
  }

  return {
    canMoveBack,
    canMoveForward,
    columns,
    dateTo,
    downloadDocument,
    downloadModalOpened,
    error,
    filterError,
    historyItems,
    isExporting,
    isLoading,
    isLoadingStorages,
    page,
    pageSize,
    searchDraft,
    selectedStorageIds,
    storageOptions,
    toolbarLeft,
    total,
    handleExport,
    reload,
    resetFilters,
    setDateTo,
    setDownloadModalOpened,
    setPage,
    setPageSize,
    setSelectedStorageIds,
    updateSearch,
  }
}

export function ProductHistoryPage() {
  const model = useProductHistoryPageModel()

  return <ProductHistoryPageView model={model} />
}

function ProductHistoryPageView({ model }: { model: ReturnType<typeof useProductHistoryPageModel> }) {
  const { t } = useI18n()
  const {
    canMoveBack,
    canMoveForward,
    columns,
    dateTo,
    downloadDocument,
    downloadModalOpened,
    error,
    filterError,
    historyItems,
    isExporting,
    isLoading,
    isLoadingStorages,
    page,
    pageSize,
    searchDraft,
    selectedStorageIds,
    storageOptions,
    toolbarLeft,
    total,
    handleExport,
    reload,
    resetFilters,
    setDateTo,
    setDownloadModalOpened,
    setPage,
    setPageSize,
    setSelectedStorageIds,
    updateSearch,
  } = model
  const noStorages = !isLoadingStorages && storageOptions.length === 0

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Group gap="xs">
          <Tooltip label={t('Експорт')}>
            <ActionIcon
              aria-label={t('Експорт')}
              color="gray"
              disabled={Boolean(filterError)}
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
              clearable
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
              label={t('По')}
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
              {t('Сторінка')} {page}
              {typeof total === 'number' ? `, ${t('усього')}: ${total}` : ''}
            </Text>
            <Group gap="xs">
              <Select
                aria-label={t('Розмір сторінки')}
                data={pageSizeOptions}
                value={String(pageSize)}
                w={84}
                onChange={(value) => {
                  setPage(1)
                  setPageSize(Number(value || 20))
                }}
              />
              <ActionIcon
                aria-label={t('Попередня сторінка')}
                color="gray"
                disabled={!canMoveBack || isLoading}
                variant="light"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <ActionIcon
                aria-label={t('Наступна сторінка')}
                color="gray"
                disabled={!canMoveForward || isLoading}
                variant="light"
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Group>

          <DataTable
            columns={columns}
            data={historyItems}
            defaultLayout={PRODUCT_HISTORY_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Історію товарів не знайдено')}
            getRowId={(historyItem, index) =>
              String(historyItem.NetUid || historyItem.Id || `${historyItem.Product?.VendorCode || 'product'}-${index}`)
            }
            isLoading={isLoading || isLoadingStorages}
            layoutVersion="product-history-table-1"
            loadingText={t('Завантаження історії товарів')}
            maxHeight="calc(100vh - 330px)"
            minWidth={1420}
            tableId="product-history"
            toolbarLeft={toolbarLeft}
          />
        </Stack>
      </Card>

      <AppModal
        centered
        opened={downloadModalOpened}
        title={t('Експорт історії товарів')}
        onClose={() => setDownloadModalOpened(false)}
      >
        <Stack gap="sm">
          {downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.DocumentURL && (
                <Anchor href={downloadDocument.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-excel">
                    <IconFileTypeXls size={22} stroke={1.8} />
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

function useProductHistoryColumns(selectedStorageIds: number[]): DataTableColumn<ProductHistoryItem>[] {
  return useMemo<DataTableColumn<ProductHistoryItem>[]>(
    () => [
      {
        id: 'created',
        header: 'Створено',
        width: 156,
        minWidth: 140,
        accessor: (historyItem) => historyItem.Created,
        cell: (historyItem) => formatDateTime(historyItem.Created),
      },
      {
        id: 'vendorCode',
        header: 'Код товару',
        width: 160,
        minWidth: 132,
        accessor: (historyItem) => historyItem.Product?.VendorCode,
        cell: (historyItem) => <Text fw={700}>{displayValue(historyItem.Product?.VendorCode)}</Text>,
      },
      {
        id: 'productName',
        header: 'Товар',
        width: 340,
        minWidth: 250,
        accessor: getProductName,
        cell: (historyItem) => (
          <Text fw={600} lineClamp={2}>
            {displayValue(getProductName(historyItem))}
          </Text>
        ),
      },
      {
        id: 'reserved',
        header: 'Продаж Україна',
        width: 148,
        minWidth: 126,
        align: 'right',
        accessor: (historyItem) => historyItem.TotalReservedUK,
        cell: (historyItem) => formatAmount(historyItem.TotalReservedUK),
      },
      {
        id: 'cartReserved',
        header: 'Резерв кошика',
        width: 148,
        minWidth: 126,
        align: 'right',
        accessor: (historyItem) => historyItem.TotalCartReservedUK,
        cell: (historyItem) => formatAmount(historyItem.TotalCartReservedUK),
      },
      {
        id: 'qtyTotal',
        header: 'Усього',
        width: 112,
        minWidth: 96,
        align: 'right',
        accessor: (historyItem) => getTotalAmount(historyItem.ProductAvailabilityDataHistory || [], selectedStorageIds),
        cell: (historyItem) => formatAmount(getTotalAmount(historyItem.ProductAvailabilityDataHistory || [], selectedStorageIds)),
      },
      {
        id: 'placements',
        header: 'Розміщення',
        width: 420,
        minWidth: 300,
        accessor: (historyItem) => formatAvailabilityHistory(historyItem.ProductAvailabilityDataHistory || [], selectedStorageIds),
        cell: (historyItem) => (
          <Text size="sm" lineClamp={4}>
            {displayValue(formatAvailabilityHistory(historyItem.ProductAvailabilityDataHistory || [], selectedStorageIds))}
          </Text>
        ),
      },
    ],
    [selectedStorageIds],
  )
}

function buildStorageOptions(storages: ProductHistoryStorage[]): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (isNumber(storage.Id)) {
      options.push({
        label: [storage.Name || translate('Без назви'), storage.Organization?.Name].filter(Boolean).join(' · '),
        value: String(storage.Id),
      })
    }

    return options
  }, [])
}

function getDefaultDateTo(): string {
  return formatDateInputValue(new Date())
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
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

function getProductName(historyItem: ProductHistoryItem): string | undefined {
  return historyItem.Product?.NameUA || historyItem.Product?.Name
}

function getTotalAmount(availabilityHistory: ProductAvailabilityDataHistory[], selectedStorageIds: number[]): number | undefined {
  const selectedStorageIdSet = new Set(selectedStorageIds)
  let total = 0

  for (const availability of availabilityHistory) {
    if (selectedStorageIdSet.has(Number(availability.StorageId))) {
      total += toFiniteNumber(availability.Amount) ?? 0
    }
  }

  return Number.isFinite(total) ? total : undefined
}

function formatAvailabilityHistory(
  availabilityHistory: ProductAvailabilityDataHistory[],
  selectedStorageIds: number[],
): string {
  const selectedStorageIdSet = new Set(selectedStorageIds)
  const availabilityLabels: string[] = []

  for (const availability of availabilityHistory) {
    if (selectedStorageIdSet.has(Number(availability.StorageId))) {
      availabilityLabels.push(formatAvailability(availability))
    }
  }

  return availabilityLabels.join('; ')
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

function getStorageIds(storages: ProductHistoryStorage[]): string[] {
  const storageIds: string[] = []

  for (const storage of storages) {
    if (isNumber(storage.Id)) {
      storageIds.push(String(storage.Id))
    }
  }

  return storageIds
}

function formatAvailability(availability: ProductAvailabilityDataHistory): string {
  const storageName = availability.Storage?.Name || translate('Склад')
  const amount = formatAmount(availability.Amount)
  const placements = formatGroupedPlacements(availability.ProductPlacementDataHistory || [])

  if (!placements) {
    return `${storageName}: ${amount}`
  }

  return `${storageName}: ${amount} (${placements})`
}

function formatGroupedPlacements(placements: ProductHistoryPlacement[]): string {
  const placementGroups = new Map<string, { address: string; qty: number }>()

  placements.forEach((placement) => {
    const address = [placement.StorageNumber, placement.RowNumber, placement.CellNumber].filter(Boolean).join('-')
    const key = address || translate('Без позиції')
    const currentGroup = placementGroups.get(key)
    const qty = toFiniteNumber(placement.Qty) ?? 0

    placementGroups.set(key, {
      address: key,
      qty: (currentGroup?.qty || 0) + qty,
    })
  })

  return Array.from(placementGroups.values())
    .map((placement) => `${placement.address}: ${formatAmount(placement.qty)}`)
    .join(', ')
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
  const numberValue = toFiniteNumber(value)

  if (numberValue === null) {
    return '—'
  }

  return amountFormatter.format(numberValue)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function toFiniteNumber(value?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}
