import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Card,
  Group,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { CircleAlert, FileDown, FileText, RotateCcw, Search } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useDebouncedValue } from '@mantine/hooks'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import {
  closePendingExportDocumentWindow,
  openExportDocumentInWindow,
  openPendingExportDocumentWindow,
} from '../../../shared/documents/openExportDocument'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { toDateTimeQuery } from '../../../shared/date/dateTime'
import { exportProductHistory, getProductHistory, getProductHistoryStorages } from '../api/productHistoryApi'
import type {
  ProductAvailabilityDataHistory,
  ProductHistoryExportDocument,
  ProductHistoryItem,
  ProductHistoryPlacement,
  ProductHistoryStorage,
} from '../types'
import './product-history-page.css'

const PRODUCT_HISTORY_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'created', 'vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SEARCH_DEBOUNCE_MS = 200
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
  const [debouncedSearchDraft] = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)
  const searchValue = debouncedSearchDraft.trim()
  const [total, setTotal] = useValueState<number | undefined>(undefined)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
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
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : historyItems.length === pageSize
  const columns = useProductHistoryColumns(selectedStorageIdNumbers, historyItems, offset)
  const toolbarLeft = useMemo(
    () =>
      searchValue ? (
        <Text size="xs" c="dimmed">
          {t('пошук')}: {searchValue}
        </Text>
      ) : null,
    [searchValue, t],
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
    const controller = new AbortController()

    async function loadHistory() {
      setLoading(true)
      setError(null)

      try {
        const response = await getProductHistory(
          {
            from: toStartOfDayQuery(dateTo),
            limit: pageSize,
            offset,
            storageIds: selectedStorageIdNumbers,
            to: toEndOfDayQuery(dateTo),
            value: searchValue,
          },
          controller.signal,
        )

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
      controller.abort()
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
  }

  function resetFilters() {
    setPage(1)
    setDateTo(getDefaultDateTo())
    setSearchDraft('')
    setSelectedStorageIds(storageOptions.map((option) => option.value))
  }

  async function handleExport() {
    if (filterError) {
      return
    }

    setExporting(true)
    setError(null)

    const pendingWindow = openPendingExportDocumentWindow(t('Друк PDF'))

    try {
      const document = await exportProductHistory({
        from: toStartOfDayQuery(dateTo),
        limit: pageSize,
        offset,
        storageIds: selectedStorageIdNumbers,
        to: toEndOfDayQuery(dateTo),
        value: searchValue,
      })

      if (document.PdfDocumentURL && openExportDocumentInWindow(pendingWindow, document.PdfDocumentURL)) {
        setDownloadDocument(null)
        setDownloadModalOpened(false)
        return
      }

      closePendingExportDocumentWindow(pendingWindow)
      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      closePendingExportDocumentWindow(pendingWindow)
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт історії товарів'))
    } finally {
      setExporting(false)
    }
  }

  return {
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
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const {
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
    <Stack className="product-history-page" gap={6}>
      <Card className="app-data-card product-history-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar product-history-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="product-history-filter-row">
            <TextInput
              label={t('Дата')}
              type="date"
              value={dateTo}
              w={150}
              onChange={(event) => {
                setPage(1)
                setDateTo(event.currentTarget.value)
              }}
            />
            <CheckboxMultiSelect
              searchable
              data={storageOptions}
              disabled={isLoadingStorages || storageOptions.length === 0}
              label={t('Склади')}
              maxDropdownHeight={320}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склади')}
              value={selectedStorageIds}
              onChange={(value) => {
                setPage(1)
                setSelectedStorageIds(value)
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
              <Tooltip label={t('Друк PDF')}>
                <ActionIcon
                  aria-label={t('Друк PDF')}
                  color={CREATE_ACTION_COLOR}
                  variant="light"
                  size={34}
                  disabled={Boolean(filterError)}
                  loading={isExporting}
                  onClick={() => void handleExport()}
                >
                  <FileDown size={18} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                isLoading={isLoading || isLoadingStorages}
                page={page}
                pageSize={pageSize}
                hasNext={canMoveForward}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPage(1)
                  setPageSize(nextPageSize)
                }}
                onRefresh={() => reload()}
              />
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
          </Group>
        </div>

        {(error || filterError || noStorages) && (
          <Alert
            className="product-history-page__alert"
            color={filterError && !noStorages ? 'yellow' : 'red'}
            icon={<CircleAlert size={18} />}
            variant="light"
          >
            {noStorages ? t('Складів не знайдено') : filterError || error}
          </Alert>
        )}

        <div className="product-history-page__table">
          <DataTable
            columns={columns}
            data={historyItems}
            defaultLayout={PRODUCT_HISTORY_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Історію товарів не знайдено')}
            getRowId={(historyItem, index) =>
              String(historyItem.NetUid || historyItem.Id || `${historyItem.Product?.VendorCode || 'product'}-${index}`)
            }
            height="100%"
            isLoading={isLoading || isLoadingStorages}
            layoutVersion="product-history-table-2"
            loadingText={t('Завантаження історії товарів')}
            minWidth={1420}
            showLayoutControls
            tableId="product-history"
            toolbarLeft={toolbarLeft}
            toolbarPortalTarget={tableToolbarSlot}
          />
        </div>
      </Card>

      <AppModal
        centered
        opened={downloadModalOpened}
        title={t('Друк PDF')}
        onClose={() => setDownloadModalOpened(false)}
      >
        <Stack gap="sm">
          {downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
            <>
              {downloadDocument.PdfDocumentURL && (
                <Anchor href={getDocumentHref(downloadDocument.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-pdf">
                    <FileText size={22} strokeWidth={1.8} />
                  </span>
                  <span>{t('PDF документ')}</span>
                </Anchor>
              )}
              {downloadDocument.DocumentURL && (
                <Anchor href={getDocumentHref(downloadDocument.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                  <span className="document-link-badge document-link-badge-excel">
                    <ExcelIcon size={22} />
                  </span>
                  <span>{t('Excel документ')}</span>
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

type PlacementGroup = {
  cellNumber?: string
  items: ProductHistoryPlacement[]
  quantity: number
  rowNumber?: string
  storageNumber?: number | string
}

function StorageAvailabilityHistory({
  availability,
  t,
}: {
  availability: ProductAvailabilityDataHistory
  t: (key: string) => string
}) {
  const [opened, setOpened] = useState(false)
  const placementGroups = useMemo(
    () => groupAvailabilityPlacements(availability.ProductPlacementDataHistory || []),
    [availability.ProductPlacementDataHistory],
  )
  const storageName = availability.Storage?.Name || t('Склад')
  const totalQuantity = formatAmount(availability.Amount)

  return (
    <Popover
      withArrow
      withinPortal
      classNames={{ dropdown: 'product-history-placement-popover' }}
      opened={opened}
      position="bottom-end"
      shadow="lg"
      width={560}
      onChange={setOpened}
    >
      <Popover.Target>
        <Badge
          className="app-role-pill product-history-placement-trigger"
          variant="light"
          onClick={() => setOpened((current) => !current)}
        >
          {`${storageName}: ${totalQuantity}`}
        </Badge>
      </Popover.Target>
      <Popover.Dropdown>
        <div className="product-history-placement-popover__header">
          <div className="product-history-placement-popover__title">
            <span>{storageName}</span>
            <small>{t('Розміщення товару')}</small>
          </div>
          <div className="product-history-placement-popover__total">
            <span>{totalQuantity}</span>
            <small>{t('К-сть')}</small>
          </div>
        </div>

        <ScrollArea.Autosize mah={360} type="auto" className="product-history-placement-popover__scroll">
          <div className="product-history-placement-list">
            {placementGroups.length === 0 ? (
              <Text className="product-history-placement-empty">{t('Позицій не знайдено')}</Text>
            ) : (
              placementGroups.map((group, groupIndex) => (
                <PlacementGroupRows key={`${group.storageNumber}-${group.rowNumber}-${group.cellNumber}-${groupIndex}`} group={group} t={t} />
              ))
            )}
          </div>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  )
}

function PlacementGroupRows({ group, t }: { group: PlacementGroup; t: (key: string) => string }) {
  return (
    <section className="product-history-placement-group">
      <div className="product-history-placement-group__head">
        <div className="product-history-placement-address">
          <span>{t('Склад')}</span>
          <strong>{displayValue(group.storageNumber)}</strong>
        </div>
        <div className="product-history-placement-address">
          <span>{t('Ряд')}</span>
          <strong>{displayValue(group.rowNumber)}</strong>
        </div>
        <div className="product-history-placement-address">
          <span>{t('Полиця')}</span>
          <strong>{displayValue(group.cellNumber)}</strong>
        </div>
        <div className="product-history-placement-group__qty">
          <strong>{Number.isNaN(group.quantity) ? '' : formatAmount(group.quantity)}</strong>
          <span>{t('К-сть')}</span>
        </div>
      </div>
      <div className="product-history-placement-rows">
        <div className="product-history-placement-row is-header">
          <span>{t('Прихід')}</span>
          <span>{t('К-сть')}</span>
        </div>
        {group.items.map((placement, itemIndex) => (
          <div
            className="product-history-placement-row"
            key={placement.NetUid || `${placement.StorageNumber}-${placement.RowNumber}-${placement.CellNumber}-${itemIndex}`}
          >
            <span>{getPlacementIncomeNumber(placement, t)}</span>
            <strong>{formatAmount(placement.Qty)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function groupAvailabilityPlacements(placements: ProductHistoryPlacement[]): PlacementGroup[] {
  const groups: PlacementGroup[] = []
  const groupMap = new Map<string, PlacementGroup>()

  for (const placement of placements) {
    const key = `${placement.StorageNumber ?? ''}\u0000${placement.RowNumber ?? ''}\u0000${placement.CellNumber ?? ''}`
    const existingGroup = groupMap.get(key)
    const quantity = toFiniteNumber(placement.Qty) ?? 0

    if (existingGroup) {
      existingGroup.items.push(placement)
      existingGroup.quantity += quantity
    } else {
      const group = {
        cellNumber: placement.CellNumber,
        items: [placement],
        quantity,
        rowNumber: placement.RowNumber,
        storageNumber: placement.StorageNumber,
      }
      groupMap.set(key, group)
      groups.push(group)
    }
  }

  return groups
}

function getPlacementIncomeNumber(placement: ProductHistoryPlacement, t: (key: string) => string): string {
  const incomeNumber = placement.ConsignmentItem?.Consignment?.ProductIncome?.Number

  if (incomeNumber) {
    return incomeNumber
  }

  if (typeof placement.Id === 'number' && placement.Id > 0) {
    return t('Відсутній № приходу')
  }

  return ''
}

function useProductHistoryColumns(
  selectedStorageIds: number[],
  historyItems: ProductHistoryItem[],
  offset: number,
): DataTableColumn<ProductHistoryItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ProductHistoryItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (historyItem) => String(offset + historyItems.indexOf(historyItem) + 1),
      },
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
        header: 'В рахунках в Україні',
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
        enableSorting: false,
        accessor: (historyItem) => formatAvailabilityHistory(historyItem.ProductAvailabilityDataHistory || [], selectedStorageIds),
        cell: (historyItem) => {
          const selectedStorageIdSet = new Set(selectedStorageIds)
          const availabilities = (historyItem.ProductAvailabilityDataHistory || []).filter((availability) =>
            selectedStorageIdSet.has(Number(availability.StorageId)),
          )

          if (availabilities.length === 0) {
            return <Text size="sm" c="dimmed">-</Text>
          }

          return (
            <Group gap={6} wrap="wrap">
              {availabilities.map((availability) => (
                <StorageAvailabilityHistory key={availability.NetUid || availability.StorageId} availability={availability} t={t} />
              ))}
            </Group>
          )
        },
      },
    ],
    [historyItems, offset, selectedStorageIds, t],
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

function toStartOfDayQuery(dateValue: string): string {
  return toDateTimeQuery(dateValue, 'start')
}

function toEndOfDayQuery(dateValue: string): string {
  return toDateTimeQuery(dateValue, 'end')
}

function getFilterError(dateTo: string, selectedStorageIds: string[]): string | null {
  if (!dateTo) {
    return translate('Вкажіть дату')
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
