import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconEye,
  IconFileTypePdf,
  IconFileTypeXls,
  IconPlus,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  exportProductCapitalization,
  getProductCapitalization,
  getProductCapitalizations,
} from '../api/productCapitalizationsApi'
import { NewProductCapitalizationPanel } from '../components/NewProductCapitalizationPanel'
import type {
  ProductCapitalization,
  ProductCapitalizationItem,
  ProductCapitalizationsExportDocument,
} from '../types'

type FilterDraft = {
  from: string
  to: string
}

type ProductCapitalizationsListState = {
  capitalizations: ProductCapitalization[]
  hasNextPage: boolean
  isLoading: boolean
  total: number
}

type ProductCapitalizationsListAction =
  | { type: 'blocked' }
  | { type: 'failed' }
  | { type: 'loaded'; items: ProductCapitalization[]; pageSize: number; total: number }
  | { type: 'loading' }

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100']

const PRODUCT_CAPITALIZATIONS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'fromDate', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PRODUCT_CAPITALIZATION_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const initialListState: ProductCapitalizationsListState = {
  capitalizations: [],
  hasNextPage: false,
  isLoading: false,
  total: 0,
}

function productCapitalizationsListReducer(
  state: ProductCapitalizationsListState,
  action: ProductCapitalizationsListAction,
): ProductCapitalizationsListState {
  switch (action.type) {
    case 'blocked':
    case 'failed':
      return initialListState
    case 'loaded':
      return {
        capitalizations: action.items,
        hasNextPage: action.items.length === action.pageSize,
        isLoading: false,
        total: action.total,
      }
    case 'loading':
      return {
        ...state,
        isLoading: true,
      }
  }
}

function useProductCapitalizationsPageModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: getDateShiftedByDays(-7),
      to: formatLocalDate(new Date()),
    }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [listState, dispatchListState] = useReducer(productCapitalizationsListReducer, initialListState)
  const [selectedCapitalization, setSelectedCapitalization] = useValueState<ProductCapitalization | null>(null)
  const [detailError, setDetailError] = useValueState<string | null>(null)
  const [isDetailLoading, setDetailLoading] = useValueState(false)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [error, setError] = useValueState<string | null>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ProductCapitalizationsExportDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [exportingNetId, setExportingNetId] = useValueState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [createPanelOpened, setCreatePanelOpened] = useValueState(false)
  const detailRequestRef = useRef(0)
  const { capitalizations, hasNextPage, isLoading, total } = listState
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const openDetail = useCallback(async (capitalization: ProductCapitalization) => {
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setSelectedCapitalization(capitalization)
    setDetailError(null)

    if (!capitalization.NetUid) {
      return
    }

    setDetailLoading(true)

    try {
      const detailedCapitalization = await getProductCapitalization(capitalization.NetUid)

      if (detailRequestRef.current === requestId && detailedCapitalization) {
        setSelectedCapitalization(detailedCapitalization)
      }
    } catch (loadError) {
      if (detailRequestRef.current === requestId) {
        setDetailError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі оприбуткування'))
      }
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false)
      }
    }
  }, [setDetailError, setDetailLoading, setSelectedCapitalization, t])
  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1
    setSelectedCapitalization(null)
    setDetailError(null)
    setDetailLoading(false)
  }, [setDetailError, setDetailLoading, setSelectedCapitalization])
  const handleExport = useCallback(async (capitalization: ProductCapitalization) => {
    if (!capitalization.NetUid) {
      return
    }

    setExportingNetId(capitalization.NetUid)
    setError(null)
    setDetailError(null)

    try {
      const document = await exportProductCapitalization(capitalization.NetUid)

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : t('Не вдалося сформувати експорт оприбуткування')

      if (selectedCapitalization?.NetUid === capitalization.NetUid) {
        setDetailError(message)
      } else {
        setError(message)
      }
    } finally {
      setExportingNetId(null)
    }
  }, [selectedCapitalization?.NetUid, setDetailError, setDownloadDocument, setDownloadModalOpened, setError, setExportingNetId, t])
  const columns = useProductCapitalizationColumns(capitalizations, openDetail, handleExport, exportingNetId)
  const detailItems = useMemo(
    () => selectedCapitalization?.ProductCapitalizationItems || [],
    [selectedCapitalization?.ProductCapitalizationItems],
  )
  const itemColumns = useProductCapitalizationItemColumns(detailItems)
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {capitalizations.length}
        {total ? ` ${t('з')} ${total}` : hasNextPage ? '+' : ''}
      </Text>
    ),
    [capitalizations.length, hasNextPage, t, total],
  )
  const canMoveBack = page > 1
  const canMoveForward = total ? page * pageSize < total : hasNextPage

  useEffect(() => {
    if (filterError) {
      dispatchListState({ type: 'blocked' })
      return
    }

    let cancelled = false

    async function loadCapitalizations() {
      dispatchListState({ type: 'loading' })
      setError(null)

      try {
        const response = await getProductCapitalizations({
          from: toDateTimeQuery(activeFilters.from, 'start'),
          limit: pageSize,
          offset,
          to: toDateTimeQuery(activeFilters.to, 'end'),
        })

        if (!cancelled) {
          dispatchListState({
            type: 'loaded',
            items: response.Items,
            pageSize,
            total: response.Total,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchListState({ type: 'failed' })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити оприбуткування товарів'))
        }
      }
    }

    void loadCapitalizations()

    return () => {
      cancelled = true
    }
  }, [activeFilters.from, activeFilters.to, filterError, offset, pageSize, reloadKey, setError, t])

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setActiveFilters(filterDraft)
  }

  function resetFilters() {
    setPage(1)
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  return {
    activeFilters,
    canMoveBack,
    canMoveForward,
    capitalizations,
    columns,
    createPanelOpened,
    detailError,
    downloadDocument,
    downloadModalOpened,
    error,
    exportingNetId,
    filterDraft,
    filterError,
    isDetailLoading,
    isLoading,
    itemColumns,
    page,
    pageSize,
    selectedCapitalization,
    toolbarLeft,
    total,
    handleExport,
    closeDetail,
    openDetail,
    reload,
    resetFilters,
    setCreatePanelOpened,
    setDownloadModalOpened,
    setFilterDraft,
    setPage,
    setPageSize,
    submitFilters,
  }
}

export function ProductCapitalizationsPage() {
  const model = useProductCapitalizationsPageModel()

  return <ProductCapitalizationsPageView model={model} />
}

function ProductCapitalizationsPageView({ model }: { model: ReturnType<typeof useProductCapitalizationsPageModel> }) {
  const { t } = useI18n()
  const {
    canMoveBack,
    canMoveForward,
    capitalizations,
    columns,
    createPanelOpened,
    detailError,
    downloadDocument,
    downloadModalOpened,
    error,
    exportingNetId,
    filterDraft,
    filterError,
    isDetailLoading,
    isLoading,
    itemColumns,
    page,
    pageSize,
    selectedCapitalization,
    toolbarLeft,
    total,
    closeDetail,
    handleExport,
    openDetail,
    reload,
    resetFilters,
    setCreatePanelOpened,
    setDownloadModalOpened,
    setFilterDraft,
    setPage,
    setPageSize,
    submitFilters,
  } = model

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Button color="violet" leftSection={<IconPlus size={16} />} onClick={() => setCreatePanelOpened(true)}>
          {t('Нове оприбуткування')}
        </Button>
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size={38}
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <form onSubmit={submitFilters}>
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <TextInput
                label={t('З')}
                type="date"
                value={filterDraft.from}
                w={150}
                onChange={(event) => setFilterDraft((current) => ({ ...current, from: event.currentTarget.value }))}
              />
              <TextInput
                label={t('По')}
                type="date"
                value={filterDraft.to}
                w={150}
                onChange={(event) => setFilterDraft((current) => ({ ...current, to: event.currentTarget.value }))}
              />
              <Button color="violet" type="submit">
                {t('Застосувати')}
              </Button>
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </form>

          {(error || filterError) && (
            <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {filterError || error}
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
                data={PAGE_SIZE_OPTIONS}
                value={String(pageSize)}
                w={84}
                onChange={(value) => {
                  setPage(1)
                  setPageSize(Number(value || DEFAULT_PAGE_SIZE))
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
            data={capitalizations}
            defaultLayout={PRODUCT_CAPITALIZATIONS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Оприбуткувань не знайдено')}
            getRowId={(capitalization, index) => String(capitalization.NetUid || capitalization.Id || index)}
            isLoading={isLoading}
            layoutVersion="product-capitalizations-table-1"
            loadingText={t('Завантаження оприбуткувань')}
            maxHeight="calc(100vh - 310px)"
            minWidth={1280}
            tableId="product-capitalizations"
            toolbarLeft={toolbarLeft}
            onRowClick={openDetail}
          />
        </Stack>
      </Card>

      <NewProductCapitalizationPanel
        opened={createPanelOpened}
        onClose={() => setCreatePanelOpened(false)}
        onCreated={() => {
          setPage(1)
          reload()
        }}
      />

      <ProductCapitalizationDetailDrawer
        capitalization={selectedCapitalization}
        detailError={detailError}
        exportingNetId={exportingNetId}
        isLoading={isDetailLoading}
        itemColumns={itemColumns}
        onClose={closeDetail}
        onExport={handleExport}
      />

      <AppModal
        centered
        opened={downloadModalOpened}
        title={t('Експорт оприбуткування')}
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

function ProductCapitalizationDetailDrawer({
  capitalization,
  detailError,
  exportingNetId,
  isLoading,
  itemColumns,
  onClose,
  onExport,
}: {
  capitalization: ProductCapitalization | null
  detailError: string | null
  exportingNetId: string | null
  isLoading: boolean
  itemColumns: DataTableColumn<ProductCapitalizationItem>[]
  onClose: () => void
  onExport: (capitalization: ProductCapitalization) => void
}) {
  const { t } = useI18n()
  const items = useMemo(
    () => capitalization?.ProductCapitalizationItems || [],
    [capitalization?.ProductCapitalizationItems],
  )
  const totals = useMemo(() => calculateItemTotals(items), [items])

  return (
    <AppDrawer
      opened={Boolean(capitalization)}
      padding="lg"
      position="right"
      size="78rem"
      title={capitalization?.Number ? `${t('Оприбуткування')} ${capitalization.Number}` : t('Оприбуткування')}
      onClose={onClose}
    >
      {capitalization && (
        <Stack gap="md">
          <Group justify="space-between" gap="sm">
            <Text c="dimmed" size="sm">
              {formatDateTime(capitalization.FromDate)}
            </Text>
            <Button
              color="gray"
              disabled={!capitalization.NetUid}
              leftSection={<IconDownload size={16} />}
              loading={exportingNetId === capitalization.NetUid}
              variant="light"
              onClick={() => onExport(capitalization)}
            >
              {t('Експорт')}
            </Button>
          </Group>

          {detailError && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {detailError}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <DetailValue label={t('Склад')} value={capitalization.Storage?.Name} />
            <DetailValue label={t('Організація')} value={capitalization.Organization?.Name} />
            <DetailValue label={t('Відповідальний')} value={getResponsibleName(capitalization)} />
            <DetailValue label={t('Сума')} value={formatMoney(capitalization.TotalAmount)} />
          </SimpleGrid>

          {capitalization.Comment && (
            <Box>
              <Text size="xs" c="dimmed" mb={4}>
                {t('Коментар')}
              </Text>
              <Text size="sm">{capitalization.Comment}</Text>
            </Box>
          )}

          <Divider />

          <Group gap="lg">
            <TotalValue label={t('Кількість')} value={formatAmount(totals.qty)} />
            <TotalValue label={t('Сума')} value={formatMoney(totals.amount)} />
            <TotalValue label={t('Вага')} value={formatAmount(totals.weight)} />
          </Group>

          <DataTable
            columns={itemColumns}
            data={items}
            defaultLayout={PRODUCT_CAPITALIZATION_ITEMS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Позицій не знайдено')}
            getRowId={(item, index) => String(item.NetUid || item.Id || `${getItemVendorCode(item)}-${index}`)}
            isLoading={isLoading}
            layoutVersion="product-capitalization-items-table-1"
            loadingText={t('Завантаження позицій оприбуткування')}
            maxHeight="calc(100vh - 420px)"
            minWidth={920}
            tableId="product-capitalization-items"
          />
        </Stack>
      )}
    </AppDrawer>
  )
}

function DetailValue({ label, value }: { label: string; value: unknown }) {
  return (
    <Box>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} lineClamp={2}>
        {displayValue(value)}
      </Text>
    </Box>
  )
}

function TotalValue({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="lg" fw={700}>
        {value}
      </Text>
    </Box>
  )
}

function useProductCapitalizationColumns(
  capitalizations: ProductCapitalization[],
  onOpenDetail: (capitalization: ProductCapitalization) => void,
  onExport: (capitalization: ProductCapitalization) => void,
  exportingNetId: string | null,
): DataTableColumn<ProductCapitalization>[] {
  return useMemo<DataTableColumn<ProductCapitalization>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (capitalization) => String(capitalizations.indexOf(capitalization) + 1),
      },
      {
        id: 'fromDate',
        header: 'Дата',
        width: 168,
        minWidth: 148,
        accessor: (capitalization) => capitalization.FromDate,
        cell: (capitalization) => formatDateTime(capitalization.FromDate),
      },
      {
        id: 'number',
        header: 'Номер',
        width: 180,
        minWidth: 150,
        accessor: (capitalization) => capitalization.Number,
        cell: (capitalization) => <Text fw={700}>{displayValue(capitalization.Number)}</Text>,
      },
      {
        id: 'amount',
        header: 'Сума',
        width: 128,
        minWidth: 112,
        align: 'right',
        accessor: (capitalization) => capitalization.TotalAmount,
        cell: (capitalization) => formatMoney(capitalization.TotalAmount),
      },
      {
        id: 'currency',
        header: 'Валюта',
        width: 92,
        minWidth: 84,
        cell: () => 'EUR',
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 220,
        minWidth: 170,
        accessor: (capitalization) => capitalization.Storage?.Name,
        cell: (capitalization) => displayValue(capitalization.Storage?.Name),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 260,
        minWidth: 190,
        accessor: (capitalization) => capitalization.Organization?.Name,
        cell: (capitalization) => displayValue(capitalization.Organization?.Name),
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 190,
        minWidth: 150,
        accessor: getResponsibleName,
        cell: (capitalization) => displayValue(getResponsibleName(capitalization)),
      },
      {
        id: 'comment',
        header: 'Коментар',
        width: 300,
        minWidth: 200,
        accessor: (capitalization) => capitalization.Comment,
        cell: (capitalization) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(capitalization.Comment)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 96,
        minWidth: 84,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        cell: (capitalization) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Group gap={4} justify="center" wrap="nowrap">
              <Tooltip label="Деталі">
                <ActionIcon
                  aria-label="Деталі"
                  color="gray"
                  size="sm"
                  variant="subtle"
                  onClick={() => onOpenDetail(capitalization)}
                >
                  <IconEye size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Експорт">
                <ActionIcon
                  aria-label="Експорт"
                  color="gray"
                  disabled={!capitalization.NetUid}
                  loading={exportingNetId === capitalization.NetUid}
                  size="sm"
                  variant="subtle"
                  onClick={() => onExport(capitalization)}
                >
                  <IconDownload size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>
        ),
      },
    ],
    [capitalizations, exportingNetId, onExport, onOpenDetail],
  )
}

function useProductCapitalizationItemColumns(
  items: ProductCapitalizationItem[],
): DataTableColumn<ProductCapitalizationItem>[] {
  return useMemo<DataTableColumn<ProductCapitalizationItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        cell: (item) => String(items.indexOf(item) + 1),
      },
      {
        id: 'vendorCode',
        header: 'Код товару',
        width: 150,
        minWidth: 124,
        accessor: getItemVendorCode,
        cell: (item) => <Text fw={700}>{displayValue(getItemVendorCode(item))}</Text>,
      },
      {
        id: 'productName',
        header: 'Товар',
        width: 320,
        minWidth: 240,
        accessor: getItemProductName,
        cell: (item) => (
          <Text fw={600} lineClamp={2}>
            {displayValue(getItemProductName(item))}
          </Text>
        ),
      },
      {
        id: 'weight',
        header: 'Вага',
        width: 108,
        minWidth: 96,
        align: 'right',
        accessor: (item) => item.Weight,
        cell: (item) => formatAmount(item.Weight),
      },
      {
        id: 'unitPrice',
        header: 'Ціна',
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.UnitPrice,
        cell: (item) => formatMoney(item.UnitPrice),
      },
      {
        id: 'qty',
        header: 'Кількість',
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => formatAmount(item.Qty),
      },
      {
        id: 'amount',
        header: 'Сума',
        width: 124,
        minWidth: 108,
        align: 'right',
        accessor: (item) => item.TotalAmount,
        cell: (item) => formatMoney(item.TotalAmount),
      },
      {
        id: 'remainingQty',
        header: 'Залишок',
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (item) => item.RemainingQty,
        cell: (item) => formatAmount(item.RemainingQty),
      },
    ],
    [items],
  )
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return 'Заповніть період'
  }

  if (from > to) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function toDateTimeQuery(dateValue: string, boundary: 'start' | 'end'): string {
  const time = boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999'

  return new Date(`${dateValue}${time}`).toISOString()
}

function getResponsibleName(capitalization: ProductCapitalization): string | undefined {
  const responsible = capitalization.Responsible

  if (!responsible) {
    return undefined
  }

  return [responsible.LastName, responsible.FirstName, responsible.MiddleName].filter(Boolean).join(' ') || responsible.Name
}

function getItemVendorCode(item: ProductCapitalizationItem): string | undefined {
  return item.Product?.VendorCode || item.ProductVendorCode
}

function getItemProductName(item: ProductCapitalizationItem): string | undefined {
  return item.Product?.Name || item.ProductName
}

function calculateItemTotals(items: ProductCapitalizationItem[]) {
  return items.reduce(
    (totals, item) => ({
      amount: totals.amount + readFiniteNumber(item.TotalAmount),
      qty: totals.qty + readFiniteNumber(item.Qty),
      weight: totals.weight + readFiniteNumber(item.Weight) * readFiniteNumber(item.Qty),
    }),
    { amount: 0, qty: 0, weight: 0 },
  )
}

function readFiniteNumber(value?: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return amountFormatter.format(value)
}

function formatMoney(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return moneyFormatter.format(value)
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
