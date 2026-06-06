import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { IconAlertCircle, IconDownload, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  exportDocumentVerification,
  getDocumentVerification,
  getDocumentVerificationStorages,
} from '../api/documentVerificationApi'
import type { DocumentVerificationItem, WarehouseUkraineExportDocument, WarehouseUkraineStorage } from '../types'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { displayValue, getDateShiftedByDays, toDateString } from './dateHelpers'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '150']
const DEFAULT_STORAGE_NAMES = ['СКЛАД -1', 'СКЛАД - 1', 'СКЛАД -3', 'СКЛАД - 3']

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
  isLoadingMore: boolean
  pageSize: number
  hasMore: boolean
  downloadOpened: boolean
  downloadDocument: WarehouseUkraineExportDocument | null
  downloadError: string | null
  isDownloading: boolean
}

type DocumentVerificationAction =
  | { type: 'applyFilters'; filters: FilterDraft }
  | { type: 'resetFilters'; filters: FilterDraft }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'setSelectedStorageIds'; selectedStorageIds: string[] }
  | { type: 'storagesLoadStarted' }
  | { type: 'storagesLoadSucceeded'; storages: WarehouseUkraineStorage[]; selectedStorageIds: string[] }
  | { type: 'storagesLoadFailed'; error: string }
  | { type: 'invalidFilters' }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; items: DocumentVerificationItem[]; totalQty: number; hasMore: boolean }
  | { type: 'loadFailed'; error: string }
  | { type: 'loadMoreStarted' }
  | {
      type: 'loadMoreSucceeded'
      items: DocumentVerificationItem[]
      totalQty: number
      hasMore: boolean
      requestOffset: number
    }
  | { type: 'loadMoreFailed'; error: string }
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
    isLoadingMore: false,
    pageSize: DEFAULT_PAGE_SIZE,
    hasMore: false,
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
      return { ...state, filterDraft: action.filters, activeFilters: action.filters }
    case 'resetFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters }
    case 'setPageSize':
      return { ...state, pageSize: action.pageSize }
    case 'setSelectedStorageIds':
      return { ...state, selectedStorageIds: action.selectedStorageIds }
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
      return { ...state, items: [], totalQty: 0, hasMore: false, isLoading: false }
    case 'loadStarted':
      return { ...state, isLoading: true, error: null }
    case 'loadSucceeded':
      return {
        ...state,
        items: action.items,
        totalQty: action.totalQty,
        hasMore: action.hasMore,
        isLoading: false,
      }
    case 'loadFailed':
      return {
        ...state,
        items: [],
        totalQty: 0,
        hasMore: false,
        error: action.error,
        isLoading: false,
      }
    case 'loadMoreStarted':
      return { ...state, isLoadingMore: true, error: null }
    case 'loadMoreSucceeded':
      return {
        ...state,
        items: state.items.length === action.requestOffset ? [...state.items, ...action.items] : state.items,
        totalQty: action.totalQty,
        hasMore: action.hasMore,
        isLoadingMore: false,
      }
    case 'loadMoreFailed':
      return { ...state, error: action.error, isLoadingMore: false }
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
  const { activeFilters, items, pageSize, selectedStorageIds, storages, storagesReady } = state
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const storageIds = useMemo(() => toFiniteNumbers(selectedStorageIds), [selectedStorageIds])
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${selectedStorageIds.join(',')}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const itemIndexMap = useMemo(() => buildIndexMap(items), [items])

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      dispatchState({ type: 'storagesLoadStarted' })

      try {
        const nextStorages = await getDocumentVerificationStorages()

        if (cancelled) {
          return
        }

        const defaults = nextStorages.reduce<string[]>((selectedIds, storage) => {
          if (DEFAULT_STORAGE_NAMES.includes(storage.Name || '')) {
            selectedIds.push(String(storage.Id))
          }

          return selectedIds
        }, [])
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
    if (!storagesReady || filterError) {
      if (filterError) {
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
          offset: 0,
          storageIds,
        })

        if (!cancelled) {
          dispatchState({
            type: 'loadSucceeded',
            items: result.items,
            totalQty: result.totalQty,
            hasMore: result.items.length < result.totalQty && result.items.length > 0,
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
    pageSize,
    reloadKey,
    storageIds,
    storagesReady,
    t,
  ])

  async function loadMoreItems() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = items.length
    dispatchState({ type: 'loadMoreStarted' })

    try {
      const result = await getDocumentVerification({
        from: toDateString(activeFilters.from),
        to: toDateString(activeFilters.to),
        limit: pageSize,
        offset: requestOffset,
        storageIds,
      })

      if (listRequestKeyRef.current === requestKey) {
        dispatchState({
          type: 'loadMoreSucceeded',
          items: result.items,
          totalQty: result.totalQty,
          hasMore: requestOffset + result.items.length < result.totalQty && result.items.length > 0,
          requestOffset,
        })
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        dispatchState({
          type: 'loadMoreFailed',
          error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити звірку'),
        })
      }
    }
  }

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    dispatchState({ type: 'downloadClosed' })
  }, [])

  async function exportDocument() {
    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    dispatchState({ type: 'downloadStarted' })

    try {
      const document = await exportDocumentVerification({
        from: toDateString(activeFilters.from),
        to: toDateString(activeFilters.to),
        limit: pageSize,
        offset: 0,
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
    filterError,
    loadMoreItems,
    reload,
    resetFilters,
    setPageSize,
    setSelectedStorageIds,
    storageOptions,
  }
}

export function DocumentVerificationTab() {
  const model = useDocumentVerificationModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Group justify="flex-end" align="center">
        <Group gap="xs">
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={model.isLoading}
              size={38}
              variant="light"
              onClick={() => model.reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            color="gray"
            leftSection={<IconDownload size={16} />}
            loading={model.isDownloading}
            variant="light"
            onClick={model.exportDocument}
          >
            {t('Роздрукувати')}
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <CheckboxMultiSelect
              data={model.storageOptions}
              label={t('Організація')}
              value={model.selectedStorageIds}
              w={320}
              onChange={model.setSelectedStorageIds}
            />
            <TextInput
              label={t('Початкова дата')}
              max={model.filterDraft.to || undefined}
              type="date"
              value={model.filterDraft.from}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              label={t('Кінцева дата')}
              min={model.filterDraft.from || undefined}
              type="date"
              value={model.filterDraft.to}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, to: event.currentTarget.value })}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={model.resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(model.error || model.filterError || model.storagesError) && (
            <Alert
              color={model.filterError ? 'yellow' : 'red'}
              icon={<IconAlertCircle size={18} />}
              variant="light"
            >
              {model.filterError || model.error || model.storagesError}
            </Alert>
          )}

          <Group justify="flex-end" gap="xs">
            <Select
              aria-label={t('Кількість рядків')}
              data={PAGE_SIZE_OPTIONS}
              size="xs"
              value={String(model.pageSize)}
              w={88}
              onChange={(value) => model.setPageSize(Number(value || DEFAULT_PAGE_SIZE))}
            />
          </Group>

          <DataTable
            columns={model.columns}
            data={model.items}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Даних не знайдено')}
            getRowId={(item, index) => String(item.NetUid || item.Id || index)}
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-verification-1"
            maxHeight="calc(100vh - 440px)"
            minWidth={1080}
            tableId="warehouse-ukraine-verification"
          />

          {model.hasMore && (
            <Group justify="center">
              <Button color="gray" loading={model.isLoadingMore} variant="light" onClick={model.loadMoreItems}>
                {t('Завантажити ще')}
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

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
        enableSorting: false,
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
          <Text size="sm" lineClamp={2}>
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

function buildIndexMap(items: DocumentVerificationItem[]): Map<DocumentVerificationItem, number> {
  return items.reduce((indexMap, item, index) => {
    indexMap.set(item, index + 1)

    return indexMap
  }, new Map<DocumentVerificationItem, number>())
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
