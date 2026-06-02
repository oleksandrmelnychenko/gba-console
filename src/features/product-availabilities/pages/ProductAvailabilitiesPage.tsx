import {
  ActionIcon,
  Alert,
  Anchor,
  Card,
  Group,
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
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  exportProductAvailabilities,
  getProductAvailabilities,
  getProductAvailabilityStorages,
} from '../api/productAvailabilitiesApi'
import type {
  ConsignmentAvailabilityItem,
  ProductAvailabilityExportDocument,
  ProductPlacement,
  Storage,
} from '../types'

const PRODUCT_AVAILABILITIES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const pageSizeOptions = ['20', '40', '60', '100']
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function useProductAvailabilitiesPageModel() {
  const { t } = useI18n()
  const [availabilities, setAvailabilities] = useValueState<ConsignmentAvailabilityItem[]>([])
  const [storages, setStorages] = useValueState<Storage[]>([])
  const [selectedStorageNetId, setSelectedStorageNetId] = useValueState('')
  const [dateFrom, setDateFrom] = useValueState(getDefaultDateFrom)
  const [dateTo, setDateTo] = useValueState(getDefaultDateTo)
  const [searchDraft, setSearchDraft] = useValueState('')
  const [searchValue, setSearchValue] = useValueState('')
  const [total, setTotal] = useValueState(0)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(20)
  const [error, setError] = useValueState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductAvailabilityExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingStorages, setLoadingStorages] = useValueState(true)
  const [isExporting, setExporting] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateFrom, dateTo)
  const storageOptions = useMemo(() => buildStorageOptions(storages), [storages])
  const canMoveBack = page > 1
  const canMoveForward = page * pageSize < total
  const resetAvailabilities = useCallback(() => {
    setAvailabilities([])
    setTotal(0)
    setLoading(false)
  }, [setAvailabilities, setLoading, setTotal])
  const columns = useProductAvailabilityColumns()
  const toolbarLeft = useMemo(
    () =>
      searchValue ? (
        <Text size="xs" c="dimmed">
          {t('код')}: {searchValue}
        </Text>
      ) : null,
    [searchValue, t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setLoadingStorages(true)
      setError(null)

      try {
        const nextStorages = await getProductAvailabilityStorages()

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
    if (!selectedStorageNetId || filterError) {
      resetAvailabilities()
      return
    }

    let cancelled = false

    async function loadAvailabilities() {
      setLoading(true)
      setError(null)

      try {
        const response = await getProductAvailabilities({
          from: dateFrom,
          limit: pageSize,
          offset,
          storageNetId: selectedStorageNetId,
          to: dateTo,
          vendorCode: searchValue,
        })

        if (!cancelled) {
          setAvailabilities(response.Availabilities)
          setTotal(response.Total)
        }
      } catch (loadError) {
        if (!cancelled) {
          setAvailabilities([])
          setTotal(0)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити доступність партій'))
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
  }, [dateFrom, dateTo, filterError, offset, pageSize, reloadKey, resetAvailabilities, searchValue, selectedStorageNetId, setAvailabilities, setError, setLoading, setTotal, t])

  function updateSearch(nextValue: string) {
    setPage(1)
    setSearchDraft(nextValue)
    setSearchValue(nextValue.trim())
  }

  function resetFilters() {
    setPage(1)
    setDateFrom(getDefaultDateFrom())
    setDateTo(getDefaultDateTo())
    setSearchDraft('')
    setSearchValue('')
    setSelectedStorageNetId(storageOptions[0]?.value || '')
  }

  async function handleExport() {
    if (!selectedStorageNetId || filterError) {
      return
    }

    setExporting(true)
    setError(null)

    try {
      const document = await exportProductAvailabilities({
        from: dateFrom,
        storageNetId: selectedStorageNetId,
        to: dateTo,
        vendorCode: searchValue,
      })

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт доступності партій'))
    } finally {
      setExporting(false)
    }
  }

  return {
    availabilities,
    canMoveBack,
    canMoveForward,
    columns,
    dateFrom,
    dateTo,
    downloadDocument,
    downloadModalOpened,
    error,
    filterError,
    isExporting,
    isLoading,
    isLoadingStorages,
    page,
    pageSize,
    searchDraft,
    selectedStorageNetId,
    storageOptions,
    toolbarLeft,
    total,
    handleExport,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setDownloadModalOpened,
    setPage,
    setPageSize,
    setSelectedStorageNetId,
    updateSearch,
  }
}

export function ProductAvailabilitiesPage() {
  const model = useProductAvailabilitiesPageModel()

  return <ProductAvailabilitiesPageView model={model} />
}

function ProductAvailabilitiesPageView({ model }: { model: ReturnType<typeof useProductAvailabilitiesPageModel> }) {
  const { t } = useI18n()
  const {
    availabilities,
    canMoveBack,
    canMoveForward,
    columns,
    dateFrom,
    dateTo,
    downloadDocument,
    downloadModalOpened,
    error,
    filterError,
    isExporting,
    isLoading,
    isLoadingStorages,
    page,
    pageSize,
    searchDraft,
    selectedStorageNetId,
    storageOptions,
    toolbarLeft,
    total,
    handleExport,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setDownloadModalOpened,
    setPage,
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
              disabled={!selectedStorageNetId || Boolean(filterError)}
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
            <Select
              searchable
              allowDeselect={false}
              data={storageOptions}
              disabled={isLoadingStorages || storageOptions.length === 0}
              label={t('Склад')}
              placeholder={isLoadingStorages ? t('Завантаження') : t('Оберіть склад')}
              value={selectedStorageNetId || null}
              w={280}
              onChange={(value) => {
                setPage(1)
                setSelectedStorageNetId(value || '')
              }}
            />
            <TextInput
              label={t('З')}
              type="date"
              value={dateFrom}
              w={150}
              onChange={(event) => {
                setPage(1)
                setDateFrom(event.currentTarget.value)
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
              label={t('Код товару')}
              placeholder={t('Пошук за кодом')}
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

          {(error || filterError || (!isLoadingStorages && storageOptions.length === 0)) && (
            <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {filterError || error || t('Складів не знайдено')}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text size="sm" c="dimmed">
              {t('Сторінка')} {page}
              {total ? `, ${t('усього')}: ${total}` : ''}
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
            data={availabilities}
            defaultLayout={PRODUCT_AVAILABILITIES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Доступність партій не знайдено')}
            getRowId={(availability, index) =>
              String(availability.Id || `${availability.ProductNetId || 'product'}-${availability.StorageNetId || 'storage'}-${index}`)
            }
            isLoading={isLoading || isLoadingStorages}
            layoutVersion="product-availabilities-table-1"
            loadingText={t('Завантаження доступності партій')}
            maxHeight="calc(100vh - 330px)"
            minWidth={1680}
            tableId="product-availabilities"
            toolbarLeft={toolbarLeft}
          />
        </Stack>
      </Card>

      <AppModal
        centered
        opened={downloadModalOpened}
        title={t('Експорт доступності партій')}
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

function toStorageOption(storage: Storage): { label: string; value: string } | null {
  if (!storage.NetUid) {
    return null
  }

  const name = storage.Name || translate('Без назви')

  return {
    label: storage.Organization?.Name ? `${name} (${storage.Organization.Name})` : name,
    value: storage.NetUid,
  }
}

function useProductAvailabilityColumns(): DataTableColumn<ConsignmentAvailabilityItem>[] {
  return useMemo<DataTableColumn<ConsignmentAvailabilityItem>[]>(
    () => [
      {
        id: 'vendorCode',
        header: 'Код товару',
        width: 160,
        minWidth: 132,
        accessor: (availability) => availability.VendorCode,
        cell: (availability) => (
          <Text fw={700}>{displayValue(availability.VendorCode)}</Text>
        ),
      },
      {
        id: 'productName',
        header: 'Товар',
        width: 320,
        minWidth: 240,
        accessor: (availability) => availability.ProductName,
        cell: (availability) => (
          <Text fw={600} lineClamp={2}>
            {displayValue(availability.ProductName)}
          </Text>
        ),
      },
      {
        id: 'netPrice',
        header: 'Ціна net',
        width: 124,
        minWidth: 112,
        align: 'right',
        accessor: (availability) => availability.NetPrice,
        cell: (availability) => formatMoney(availability.NetPrice),
      },
      {
        id: 'unitGrossPrice',
        header: 'Ціна gross',
        width: 132,
        minWidth: 118,
        align: 'right',
        accessor: (availability) => availability.UnitGrossPrice,
        cell: (availability) => formatMoney(availability.UnitGrossPrice),
      },
      {
        id: 'unitAccountingGrossPrice',
        header: 'Облік gross',
        width: 136,
        minWidth: 120,
        align: 'right',
        accessor: (availability) => availability.UnitAccountingGrossPrice,
        cell: (availability) => formatMoney(availability.UnitAccountingGrossPrice),
      },
      {
        id: 'grossPrice',
        header: 'Сума gross',
        width: 132,
        minWidth: 118,
        align: 'right',
        accessor: (availability) => availability.GrossPrice,
        cell: (availability) => formatMoney(availability.GrossPrice),
      },
      {
        id: 'accountingGrossPrice',
        header: 'Сума облік',
        width: 136,
        minWidth: 120,
        align: 'right',
        accessor: (availability) => availability.AccountingGrossPrice,
        cell: (availability) => formatMoney(availability.AccountingGrossPrice),
      },
      {
        id: 'placing',
        header: 'Розміщення',
        width: 300,
        minWidth: 220,
        accessor: (availability) => formatPlacements(availability.Placements || []),
        cell: (availability) => (
          <Text size="sm" lineClamp={3}>
            {displayValue(formatPlacements(availability.Placements || []))}
          </Text>
        ),
      },
      {
        id: 'qty',
        header: 'Кількість',
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (availability) => availability.Qty,
        cell: (availability) => formatAmount(availability.Qty),
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 220,
        minWidth: 170,
        accessor: (availability) => availability.StorageName,
        cell: (availability) => displayValue(availability.StorageName),
      },
    ],
    [],
  )
}

function getDefaultDateFrom(): string {
  const date = new Date()
  date.setDate(date.getDate() - 7)

  return formatDateInputValue(date)
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

function getFilterError(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (dateFrom > dateTo) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}

function buildStorageOptions(storages: Storage[]): { label: string; value: string }[] {
  return storages.reduce<Array<{ label: string; value: string }>>((options, storage) => {
    const option = toStorageOption(storage)

    if (option) {
      options.push(option)
    }

    return options
  }, [])
}

function formatPlacements(placements: ProductPlacement[]): string {
  const formattedPlacements = placements.reduce<string[]>((values, placement) => {
    const value = formatPlacement(placement)

    if (value) {
      values.push(value)
    }

    return values
  }, [])

  return formattedPlacements.join(', ')
}

function formatPlacement(placement: ProductPlacement): string {
  const address = [placement.StorageNumber, placement.RowNumber, placement.CellNumber].filter(Boolean).join('-')
  const qty = formatAmount(placement.Qty)

  if (!address && qty === '—') {
    return ''
  }

  if (!address) {
    return `${translate('Кількість')} ${qty}`
  }

  return `${translate('Позиція')} ${address}. ${translate('Кількість')} ${qty}`
}

function formatAmount(value?: number): string {
  const numberValue = toFiniteNumber(value)

  if (numberValue === null) {
    return '—'
  }

  return amountFormatter.format(numberValue)
}

function formatMoney(value?: number): string {
  const numberValue = toFiniteNumber(value)

  if (numberValue === null) {
    return '—'
  }

  return moneyFormatter.format(numberValue)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  return String(value)
}

function toFiniteNumber(value?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}
