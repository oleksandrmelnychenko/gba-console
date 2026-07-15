import {
  ActionIcon,
  Alert,
  Button,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { CircleAlert, Download, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import {
  exportDocumentVerification,
  getDocumentVerification,
  getDocumentVerificationStorages,
} from '../api/documentVerificationApi'
import type { DocumentVerificationItem, WarehouseUkraineExportDocument, WarehouseUkraineStorage } from '../types'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { displayValue, getDateShiftedByDays, toDateString } from './dateHelpers'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '150', '500']

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['index', 'productCode'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

type FilterDraft = {
  from: string
  to: string
}

type DocumentVerificationState = {
  filterDraft: FilterDraft
  activeFilters: FilterDraft
  storages: WarehouseUkraineStorage[]
  storagesError: string | null
  selectedStorageIds: string[]
  storagesReady: boolean
  items: DocumentVerificationItem[]
  totalQty: number
  error: string | null
  isLoading: boolean
  page: number
  pageSize: number
  downloadOpened: boolean
  downloadDocument: WarehouseUkraineExportDocument | null
  downloadError: string | null
  isDownloading: boolean
}

type DocumentVerificationAction =
  | { type: 'applyFilters'; filters: FilterDraft }
  | { type: 'resetFilters'; filters: FilterDraft }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'setPage'; page: number }
  | { type: 'setSelectedStorageIds'; selectedStorageIds: string[] }
  | { type: 'storagesLoadStarted' }
  | { type: 'storagesLoadSucceeded'; storages: WarehouseUkraineStorage[]; selectedStorageIds: string[] }
  | { type: 'storagesLoadFailed'; error: string }
  | { type: 'invalidFilters' }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; items: DocumentVerificationItem[]; totalQty: number }
  | { type: 'loadFailed'; error: string }
  | { type: 'downloadStarted' }
  | { type: 'downloadSucceeded'; document: WarehouseUkraineExportDocument }
  | { type: 'downloadFailed'; error: string }
  | { type: 'downloadClosed' }

function createInitialDocumentVerificationState(initialFilters: FilterDraft): DocumentVerificationState {
  return {
    filterDraft: initialFilters,
    activeFilters: initialFilters,
    storages: [],
    storagesError: null,
    selectedStorageIds: [],
    storagesReady: false,
    items: [],
    totalQty: 0,
    error: null,
    isLoading: true,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    downloadOpened: false,
    downloadDocument: null,
    downloadError: null,
    isDownloading: false,
  }
}

function documentVerificationReducer(
  state: DocumentVerificationState,
  action: DocumentVerificationAction,
): DocumentVerificationState {
  switch (action.type) {
    case 'applyFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters, page: 1 }
    case 'resetFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters, page: 1 }
    case 'setPageSize':
      return { ...state, page: 1, pageSize: action.pageSize }
    case 'setPage':
      return { ...state, page: action.page }
    case 'setSelectedStorageIds':
      return { ...state, selectedStorageIds: action.selectedStorageIds, page: 1 }
    case 'storagesLoadStarted':
      return { ...state, storagesError: null }
    case 'storagesLoadSucceeded':
      return {
        ...state,
        storages: action.storages,
        selectedStorageIds: action.selectedStorageIds,
        storagesReady: true,
      }
    case 'storagesLoadFailed':
      return { ...state, storages: [], storagesReady: true, storagesError: action.error }
    case 'invalidFilters':
      return { ...state, items: [], totalQty: 0, isLoading: false }
    case 'loadStarted':
      return { ...state, isLoading: true, error: null }
    case 'loadSucceeded':
      return {
        ...state,
        items: action.items,
        page: Math.min(state.page, Math.max(1, Math.ceil(action.totalQty / state.pageSize))),
        totalQty: action.totalQty,
        isLoading: false,
      }
    case 'loadFailed':
      return {
        ...state,
        items: [],
        totalQty: 0,
        error: action.error,
        isLoading: false,
      }
    case 'downloadStarted':
      return {
        ...state,
        downloadOpened: true,
        downloadDocument: null,
        downloadError: null,
        isDownloading: true,
      }
    case 'downloadSucceeded':
      return { ...state, downloadDocument: action.document, isDownloading: false }
    case 'downloadFailed':
      return { ...state, downloadError: action.error, isDownloading: false }
    case 'downloadClosed':
      return {
        ...state,
        downloadOpened: false,
        downloadDocument: null,
        downloadError: null,
        isDownloading: false,
      }
  }
}

function useDocumentVerificationModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-1), to: getDateShiftedByDays(0) }),
    [],
  )
  const initialState = useMemo(() => createInitialDocumentVerificationState(initialFilters), [initialFilters])
  const [state, dispatchState] = useReducer(documentVerificationReducer, initialState)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const { activeFilters, items, page, pageSize, selectedStorageIds, storages, storagesReady, totalQty } = state
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const storageIds = useMemo(() => toFiniteNumbers(selectedStorageIds), [selectedStorageIds])
  const storageFilterError = storagesReady && selectedStorageIds.length === 0
    ? t('Виберіть хоча б один склад')
    : null
  const exportError = filterError || storageFilterError
  const pageOffset = (page - 1) * pageSize
  const totalPages = Math.max(1, Math.ceil(totalQty / pageSize))
  const hasNext = page < totalPages
  const itemIndexMap = useMemo(() => buildIndexMap(items, pageOffset), [items, pageOffset])

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      dispatchState({ type: 'storagesLoadStarted' })

      try {
        const nextStorages = await getDocumentVerificationStorages()

        if (cancelled) {
          return
        }

        const defaults = getDefaultSelectedStorageIds(nextStorages)
        dispatchState({ type: 'storagesLoadSucceeded', storages: nextStorages, selectedStorageIds: defaults })
      } catch (loadError) {
        if (!cancelled) {
          dispatchState({
            type: 'storagesLoadFailed',
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'),
          })
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!storagesReady || filterError || storageFilterError) {
      if (filterError || storageFilterError) {
        dispatchState({ type: 'invalidFilters' })
      }
      return
    }

    let cancelled = false

    async function loadItems() {
      dispatchState({ type: 'loadStarted' })

      try {
        const result = await getDocumentVerification({
          from: toDateString(activeFilters.from),
          to: toDateString(activeFilters.to),
          limit: pageSize,
          offset: pageOffset,
          storageIds,
        })

        if (!cancelled) {
          dispatchState({
            type: 'loadSucceeded',
            items: result.items,
            totalQty: result.totalQty,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchState({
            type: 'loadFailed',
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити звірку'),
          })
        }
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [
    activeFilters,
    filterError,
    pageOffset,
    pageSize,
    reloadKey,
    storageIds,
    storageFilterError,
    storagesReady,
    t,
  ])

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    dispatchState({ type: 'downloadClosed' })
  }, [])

  async function exportDocument() {
    if (exportError) {
      dispatchState({ type: 'downloadFailed', error: exportError })
      return
    }

    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    dispatchState({ type: 'downloadStarted' })

    try {
      const document = await exportDocumentVerification({
        from: toDateString(activeFilters.from),
        to: toDateString(activeFilters.to),
        limit: pageSize,
        offset: pageOffset,
        storageIds,
      })

      if (downloadRequestRef.current === requestId) {
        dispatchState({ type: 'downloadSucceeded', document })
      }
    } catch (exportError) {
      if (downloadRequestRef.current === requestId) {
        dispatchState({
          type: 'downloadFailed',
          error: exportError instanceof Error ? exportError.message : t('Немає документів для завантаження'),
        })
      }
    }
  }

  function applyFilters(nextFilters: FilterDraft) {
    dispatchState({ type: 'applyFilters', filters: nextFilters })
  }

  function resetFilters() {
    dispatchState({ type: 'resetFilters', filters: initialFilters })
  }

  function setPageSize(pageSize: number) {
    dispatchState({ type: 'setPageSize', pageSize })
  }

  function setPage(page: number) {
    dispatchState({ type: 'setPage', page })
  }

  function setSelectedStorageIds(selectedStorageIds: string[]) {
    dispatchState({ type: 'setSelectedStorageIds', selectedStorageIds })
  }

  const storageOptions = useMemo(
    () =>
      storages
        .filter((storage) => storage.Id !== undefined)
        .map((storage) => ({
          value: String(storage.Id),
          label: `${storage.Name || ''}${storage.Organization?.Name ? ` (${storage.Organization.Name})` : ''}`,
        })),
    [storages],
  )

  const columns = useVerificationColumns(itemIndexMap)

  return {
    ...state,
    applyFilters,
    closeDownload,
    columns,
    exportDocument,
    exportError,
    filterError,
    hasNext,
    reload,
    resetFilters,
    setPage,
    setPageSize,
    setSelectedStorageIds,
    storageFilterError,
    storageOptions,
    totalPages,
  }
}

export function DocumentVerificationTab() {
  const model = useDocumentVerificationModel()
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="app-filter-bar warehouse-ukraine-filter-bar is-verification">
            <CheckboxMultiSelect
              data={model.storageOptions}
              label={t('Організація')}
              value={model.selectedStorageIds}
              w={320}
              onChange={model.setSelectedStorageIds}
            />
            <div className="app-filter-date-range">
              <TextInput
                className="warehouse-ukraine-filter-input"
                label={t('Від')}
                max={model.filterDraft.to || undefined}
                type="date"
                value={model.filterDraft.from}
                onChange={(event) => model.applyFilters({ ...model.filterDraft, from: event.currentTarget.value })}
              />
              <TextInput
                className="warehouse-ukraine-filter-input"
                label={t('До')}
                min={model.filterDraft.from || undefined}
                type="date"
                value={model.filterDraft.to}
                onChange={(event) => model.applyFilters({ ...model.filterDraft, to: event.currentTarget.value })}
              />
            </div>
            <Text c="dimmed" size="sm">
              {`${t('На дату')} ${new Date().toLocaleDateString('uk-UA')} 6:00`}
            </Text>
            <div className="app-filter-actions warehouse-ukraine-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={model.resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Button
                color="gray"
                leftSection={<Download size={16} />}
                disabled={Boolean(model.exportError) || !model.storagesReady}
                loading={model.isDownloading}
                variant="light"
                onClick={model.exportDocument}
              >
                {t('Роздрукувати')}
              </Button>
              <Paginator
                hasNext={model.hasNext}
                isLoading={model.isLoading}
                page={Math.min(model.page, model.totalPages)}
                pageSize={model.pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                totalPages={model.totalPages}
                onPageChange={model.setPage}
                onPageSizeChange={model.setPageSize}
                onRefresh={() => model.reload()}
              />
            </div>
            <div ref={setTableToolbarSlot} className="warehouse-ukraine-table-toolbar-slot" />
          </div>

          {(model.error || model.filterError || model.storageFilterError || model.storagesError) && (
            <Alert
              className="console-table-alert"
              color={model.filterError || model.storageFilterError ? 'yellow' : 'red'}
              icon={<CircleAlert size={18} />}
              variant="light"
            >
              {model.filterError || model.storageFilterError || model.error || model.storagesError}
            </Alert>
          )}

          <div className="warehouse-ukraine-table console-table-body">
          <DataTable
            columns={model.columns}
            data={model.items}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Даних не знайдено')}
            getRowId={(item, index) => String(item.NetUid || item.Id || index)}
            height="100%"
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-verification-2"
            minWidth={1080}
            showLayoutControls
            tableId="warehouse-ukraine-verification"
            toolbarPortalTarget={tableToolbarSlot}
          />
          </div>
      </div>

      <DownloadDocumentModal
        document={model.downloadDocument}
        error={model.downloadError}
        isLoading={model.isDownloading}
        opened={model.downloadOpened}
        onClose={model.closeDownload}
      />
    </Stack>
  )
}

function useVerificationColumns(indexMap: Map<DocumentVerificationItem, number>) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<DocumentVerificationItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        accessor: (item) => indexMap.get(item) || 0,
        cell: (item) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(item) || ''}
          </Text>
        ),
      },
      {
        id: 'productCode',
        header: t('Код товару'),
        width: 160,
        minWidth: 120,
        accessor: (item) => item.Product?.VendorCode,
        cell: (item) => <Text fw={700}>{displayValue(item.Product?.VendorCode)}</Text>,
      },
      {
        id: 'productStorage',
        header: t('Місце Зберігання'),
        width: 160,
        minWidth: 120,
        accessor: (item) => buildLocation(item),
        cell: (item) => displayValue(buildLocation(item)),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 260,
        minWidth: 180,
        accessor: (item) => item.Storage?.Name,
        cell: (item) => displayValue(item.Storage?.Name),
      },
      {
        id: 'name',
        header: t('Назва'),
        minWidth: 240,
        accessor: (item) => item.Product?.NameUA,
        cell: (item) => (
          <Text size="sm" title={displayValue(item.Product?.NameUA)}>
            {displayValue(item.Product?.NameUA)}
          </Text>
        ),
      },
      {
        id: 'quantity',
        header: t('Кількість'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => displayValue(item.Qty),
      },
    ],
    [indexMap, t],
  )
}

function buildLocation(item: DocumentVerificationItem): string {
  return `${item.StorageNumber ?? ''}-${item.RowNumber ?? ''}-${item.CellNumber ?? ''}`
}

function buildIndexMap(items: DocumentVerificationItem[], offset = 0): Map<DocumentVerificationItem, number> {
  return items.reduce((indexMap, item, index) => {
    indexMap.set(item, offset + index + 1)

    return indexMap
  }, new Map<DocumentVerificationItem, number>())
}

function getDefaultSelectedStorageIds(storages: WarehouseUkraineStorage[]): string[] {
  const validStorageIds: string[] = []
  const preferredStorageIds: string[] = []

  storages.forEach((storage) => {
    const storageId = getValidStorageId(storage)

    if (!storageId) {
      return
    }

    validStorageIds.push(storageId)

    if (isDefaultDocumentVerificationStorage(storage)) {
      preferredStorageIds.push(storageId)
    }
  })

  return preferredStorageIds.length > 0 ? preferredStorageIds : validStorageIds
}

function getValidStorageId(storage: WarehouseUkraineStorage): string | null {
  if (typeof storage.Id !== 'number' || !Number.isFinite(storage.Id)) {
    return null
  }

  return String(storage.Id)
}

function isDefaultDocumentVerificationStorage(storage: WarehouseUkraineStorage): boolean {
  const normalizedName = storage.Name?.trim().toLowerCase().replace(/\s+/g, ' ')

  return Boolean(normalizedName && /^(?:склад|warehouse)[\s_-]*(?:1|3)$/.test(normalizedName))
}

function toFiniteNumbers(values: string[]): number[] {
  return values.reduce<number[]>((numbers, value) => {
    const numberValue = Number(value)

    if (Number.isFinite(numberValue)) {
      numbers.push(numberValue)
    }

    return numbers
  }, [])
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
