import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconDownload,
  IconFileTypePdf,
  IconFileTypeXls,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  exportProductStorageAvailability,
  getAvailableProductsByStorage,
  getProductStorageStorages,
} from '../api/productStoragesApi'
import type {
  ProductStorageAvailability,
  ProductStoragePlacement,
  ProductStorageStorage,
  ProductStoragesExportDocument,
} from '../types'

const PRODUCT_STORAGES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const pageSizeOptions = ['50', '100', '150']
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

function useProductStoragesPageModel() {
  const { t } = useI18n()
  const [availabilities, setAvailabilities] = useValueState<ProductStorageAvailability[]>([])
  const [storages, setStorages] = useValueState<ProductStorageStorage[]>([])
  const [selectedStorageNetId, setSelectedStorageNetId] = useValueState('')
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [pageSize, setPageSize] = useValueState(50)
  const [hasMore, setHasMore] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductStoragesExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [isExporting, setExporting] = useValueState(false)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const listRequestKey = `${selectedStorageNetId}|${searchValue}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const columns = useProductStoragesColumns()
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Завантажено')} {availabilities.length}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [availabilities.length, searchValue, t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setError(null)

      try {
        const nextStorages = await getProductStorageStorages()

        if (!cancelled) {
          setStorages(nextStorages)
          setSelectedStorageNetId((currentStorageNetId) => {
            if (currentStorageNetId && nextStorages.some((storage) => storage.NetUid === currentStorageNetId)) {
              return currentStorageNetId
            }

            return nextStorages.find((storage) => storage.NetUid)?.NetUid || ''
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setStorages([])
          setSelectedStorageNetId('')
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
  }, [reloadKey, setError, setLoadingStorages, setSelectedStorageNetId, setStorages, t])

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    if (!selectedStorageNetId) {
      setAvailabilities([])
      setHasMore(false)
      return
    }

    let cancelled = false

    async function loadAvailabilities() {
      setLoading(true)
      setError(null)

      try {
        const nextAvailabilities = await getAvailableProductsByStorage({
          limit: pageSize,
          offset: 0,
          storageNetId: selectedStorageNetId,
          value: searchValue,
        })

        if (!cancelled) {
          setAvailabilities(nextAvailabilities)
          setHasMore(nextAvailabilities.length === pageSize)
        }
      } catch (loadError) {
        if (!cancelled) {
          setAvailabilities([])
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товари складу'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAvailabilities()

    return () => {
      cancelled = true
    }
  }, [pageSize, reloadKey, searchValue, selectedStorageNetId, setAvailabilities, setError, setHasMore, setLoading, t])

  function updateSearch(nextValue: string) {
    setAvailabilities([])
    setHasMore(false)
    setSearchDraft(nextValue)
    setSearchValue(nextValue.trim())
  }

  function resetFilters() {
    setSearchDraft('')
    setSearchValue('')
    setSelectedStorageNetId(storageOptions[0]?.value || '')
  }

  async function loadMore() {
    if (!selectedStorageNetId || isLoadingMore) {
      return
    }

    const requestKey = listRequestKeyRef.current
    const requestOffset = availabilities.length
    setLoadingMore(true)
    setError(null)

    try {
      const nextAvailabilities = await getAvailableProductsByStorage({
        limit: pageSize,
        offset: requestOffset,
        storageNetId: selectedStorageNetId,
        value: searchValue,
      })

      if (listRequestKeyRef.current === requestKey) {
        setAvailabilities((currentAvailabilities) =>
          currentAvailabilities.length === requestOffset ? [...currentAvailabilities, ...nextAvailabilities] : currentAvailabilities,
        )
        setHasMore(nextAvailabilities.length === pageSize)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити наступні товари'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  async function handleExport() {
    if (!selectedStorageNetId) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const document = await exportProductStorageAvailability(selectedStorageNetId)

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт складу'))
    } finally {
      setExporting(false)
    }
  }

  return {
    availabilities,
    columns,
    downloadDocument,
    downloadModalOpened,
    error,
    hasMore,
    isExporting,
    isLoading,
    isLoadingMore,
    isLoadingStorages,
    pageSize,
    searchDraft,
    selectedStorageNetId,
    storageOptions,
    toolbarLeft,
    handleExport,
    loadMore,
    reload,
    resetFilters,
    setDownloadModalOpened,
    setPageSize,
    setSelectedStorageNetId,
    updateSearch,
  }
}

export function ProductStoragesPage() {
  const model = useProductStoragesPageModel()

  return <ProductStoragesPageView model={model} />
}

function ProductStoragesPageView({ model }: { model: ReturnType<typeof useProductStoragesPageModel> }) {
  const { t } = useI18n()
  const {
    availabilities,
    columns,
    downloadDocument,
    downloadModalOpened,
    error,
    hasMore,
    isExporting,
    isLoading,
    isLoadingMore,
    isLoadingStorages,
    pageSize,
    searchDraft,
    selectedStorageNetId,
    storageOptions,
    toolbarLeft,
    handleExport,
    loadMore,
    reload,
    resetFilters,
    setDownloadModalOpened,
    setPageSize,
    setSelectedStorageNetId,
    updateSearch,
  } = model

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Group gap="xs">
          <Tooltip label={t('Експорт')}>
            <ActionIcon
              aria-label={t('Експорт')}
              color="gray"
              disabled={!selectedStorageNetId}
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
          <Group align="end" gap="sm" wrap="wrap">
            <Select
              searchable
              allowDeselect={false}
              data={storageOptions}
              disabled={isLoadingStorages || storageOptions.length === 0}
              label={t('Склад')}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
              value={selectedStorageNetId || null}
              w={300}
              onChange={(value) => setSelectedStorageNetId(value || '')}
            />
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Код або назва товару')}
              value={searchDraft}
              style={{ flex: '1 1 240px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(error || (!isLoadingStorages && storageOptions.length === 0)) && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error || t('Складів не знайдено')}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text size="sm" c="dimmed">
              {t('Завантажено')} {availabilities.length}
            </Text>
            <Group gap="xs">
              <Select
                aria-label={t('Розмір сторінки')}
                data={pageSizeOptions}
                value={String(pageSize)}
                w={88}
                onChange={(value) => setPageSize(Number(value || 50))}
              />
              <Button
                color="gray"
                disabled={!hasMore || isLoading || isLoadingMore}
                loading={isLoadingMore}
                variant="light"
                onClick={loadMore}
              >
                {t('Завантажити ще')}
              </Button>
            </Group>
          </Group>

          <DataTable
            columns={columns}
            data={availabilities}
            defaultLayout={PRODUCT_STORAGES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Товарів на складі не знайдено')}
            getRowId={(availability, index) =>
              String(availability.NetUid || `${getProductCode(availability)}-${getStorageName(availability)}-${index}`)
            }
            isLoading={isLoading || isLoadingStorages}
            layoutVersion="product-storages-table-1"
            loadingText={t('Завантаження товарів складу')}
            maxHeight="calc(100vh - 320px)"
            minWidth={1040}
            tableId="product-storages"
            toolbarLeft={toolbarLeft}
          />
        </Stack>
      </Card>

      <Modal
        centered
        opened={downloadModalOpened}
        title={t('Експорт складу')}
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
      </Modal>
    </Stack>
  )
}

function useProductStoragesColumns(): DataTableColumn<ProductStorageAvailability>[] {
  return useMemo<DataTableColumn<ProductStorageAvailability>[]>(
    () => [
      {
        id: 'vendorCode',
        header: 'Код товару',
        width: 160,
        minWidth: 132,
        accessor: getProductCode,
        cell: (availability) => <Text fw={700}>{displayValue(getProductCode(availability))}</Text>,
      },
      {
        id: 'productName',
        header: 'Товар',
        width: 360,
        minWidth: 260,
        accessor: getProductName,
        cell: (availability) => (
          <Text fw={600} lineClamp={2}>
            {displayValue(getProductName(availability))}
          </Text>
        ),
      },
      {
        id: 'placing',
        header: 'Розміщення',
        width: 320,
        minWidth: 220,
        accessor: (availability) => formatPlacements(getPlacements(availability)),
        cell: (availability) => (
          <Text size="sm" lineClamp={3}>
            {displayValue(formatPlacements(getPlacements(availability)))}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: 'Кількість',
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: getQuantity,
        cell: (availability) => formatAmount(getQuantity(availability)),
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 240,
        minWidth: 180,
        accessor: getStorageName,
        cell: (availability) => displayValue(getStorageName(availability)),
      },
    ],
    [],
  )
}

function buildStorageOptions(storages: ProductStorageStorage[]): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    if (storage.NetUid) {
      options.push({
        label: storage.Name || translate('Без назви'),
        value: storage.NetUid,
      })
    }

    return options
  }, [])
}

function getProductCode(availability: ProductStorageAvailability): string | undefined {
  return availability.Product?.VendorCode || availability.VendorCode
}

function getProductName(availability: ProductStorageAvailability): string | undefined {
  return availability.Product?.Name || availability.ProductName
}

function getStorageName(availability: ProductStorageAvailability): string | undefined {
  return availability.Storage?.Name || availability.StorageName
}

function getQuantity(availability: ProductStorageAvailability): number | undefined {
  return availability.Amount ?? availability.Qty
}

function getPlacements(availability: ProductStorageAvailability): ProductStoragePlacement[] {
  return availability.Product?.ProductPlacements?.length
    ? availability.Product.ProductPlacements
    : availability.Placements || []
}

function formatPlacements(placements: ProductStoragePlacement[]): string {
  const formattedPlacements = placements.reduce<string[]>((values, placement) => {
    const value = formatPlacement(placement)

    if (value) {
      values.push(value)
    }

    return values
  }, [])

  return formattedPlacements.join(', ')
}

function formatPlacement(placement: ProductStoragePlacement): string {
  const address = [placement.StorageNumber, placement.RowNumber, placement.CellNumber].filter(Boolean).join('-')
  const qty = formatAmount(placement.Qty)

  if (!address && qty === '-') {
    return ''
  }

  if (!address) {
    return `${translate('Кількість')} ${qty}`
  }

  return `${translate('Позиція')} ${address}. ${translate('Кількість')} ${qty}`
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return amountFormatter.format(value)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
