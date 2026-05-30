import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconDownload, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
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

function useDocumentVerificationModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-1), to: getDateShiftedByDays(0) }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [storages, setStorages] = useValueState<WarehouseUkraineStorage[]>([])
  const [storagesError, setStoragesError] = useValueState<string | null>(null)
  const [selectedStorageIds, setSelectedStorageIds] = useValueState<string[]>([])
  const [storagesReady, setStoragesReady] = useValueState(false)
  const [items, setItems] = useValueState<DocumentVerificationItem[]>([])
  const [totalQty, setTotalQty] = useValueState(0)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [hasMore, setHasMore] = useValueState(false)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<WarehouseUkraineExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const storageIds = useMemo(() => selectedStorageIds.map(Number).filter(Number.isFinite), [selectedStorageIds])
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${selectedStorageIds.join(',')}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const itemIndexMap = useMemo(() => buildIndexMap(items), [items])

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setStoragesError(null)

      try {
        const nextStorages = await getDocumentVerificationStorages()

        if (cancelled) {
          return
        }

        setStorages(nextStorages)
        const defaults = nextStorages
          .filter((storage) => DEFAULT_STORAGE_NAMES.includes(storage.Name || ''))
          .map((storage) => String(storage.Id))
        setSelectedStorageIds(defaults)
        setStoragesReady(true)
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setStoragesReady(true)
          setStoragesError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [setSelectedStorageIds, setStorages, setStoragesError, setStoragesReady, t])

  useEffect(() => {
    if (!storagesReady || filterError) {
      if (filterError) {
        setItems([])
        setTotalQty(0)
        setHasMore(false)
        setLoading(false)
      }
      return
    }

    let cancelled = false

    async function loadItems() {
      setLoading(true)
      setError(null)

      try {
        const result = await getDocumentVerification({
          from: toDateString(activeFilters.from),
          to: toDateString(activeFilters.to),
          limit: pageSize,
          offset: 0,
          storageIds,
        })

        if (!cancelled) {
          setItems(result.items)
          setTotalQty(result.totalQty)
          setHasMore(result.items.length < result.totalQty && result.items.length > 0)
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setTotalQty(0)
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити звірку'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
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
    setError,
    setHasMore,
    setItems,
    setLoading,
    setTotalQty,
    storageIds,
    storagesReady,
    t,
  ])

  async function loadMoreItems() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = items.length
    setLoadingMore(true)
    setError(null)

    try {
      const result = await getDocumentVerification({
        from: toDateString(activeFilters.from),
        to: toDateString(activeFilters.to),
        limit: pageSize,
        offset: requestOffset,
        storageIds,
      })

      if (listRequestKeyRef.current === requestKey) {
        setItems((current) => (current.length === requestOffset ? [...current, ...result.items] : current))
        setTotalQty(result.totalQty)
        setHasMore(requestOffset + result.items.length < result.totalQty && result.items.length > 0)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити звірку'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  async function exportDocument() {
    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    setDownloadOpened(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await exportDocumentVerification({
        from: toDateString(activeFilters.from),
        to: toDateString(activeFilters.to),
        limit: pageSize,
        offset: 0,
        storageIds,
      })

      if (downloadRequestRef.current === requestId) {
        setDownloadDocument(document)
      }
    } catch (exportError) {
      if (downloadRequestRef.current === requestId) {
        setDownloadError(exportError instanceof Error ? exportError.message : t('Немає документів для завантаження'))
      }
    } finally {
      if (downloadRequestRef.current === requestId) {
        setDownloading(false)
      }
    }
  }

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
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
    applyFilters, closeDownload, columns, downloadDocument, downloadError, downloadOpened, error, exportDocument,
    filterDraft, filterError, hasMore, isDownloading, isLoading, isLoadingMore, items, loadMoreItems, pageSize,
    reload, resetFilters, selectedStorageIds, setPageSize, setSelectedStorageIds, storageOptions, storagesError,
    totalQty,
  }
}

export function DocumentVerificationTab() {
  const model = useDocumentVerificationModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Звірка')}
        </Text>
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
            <MultiSelect
              clearable
              data={model.storageOptions}
              label={t('Організація')}
              searchable
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

          <Group justify="space-between" gap="xs">
            <Text c="dimmed" size="xs">
              {t('Показано')} {model.items.length} / {model.totalQty}
            </Text>
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

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}
