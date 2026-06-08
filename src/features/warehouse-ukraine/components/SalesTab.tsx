import { ActionIcon, Alert, Anchor, Badge, Card, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileText,
  IconPrinter,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  getSaleActProtocolEditDocument,
  getSalePrintDocument,
  getWarehouseUkraineSales,
  updateWarehouseUkraineSale,
} from '../api/salesApi'
import type { Sale, WarehouseUkraineExportDocument } from '../types'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { displayValue, formatDateTime, getDateShiftedByDays, toDateString } from './dateHelpers'
import { SaleCarrierDrawer } from './SaleCarrierDrawer'

const DEFAULT_LIMIT = 500
const PAGE_SIZE_OPTIONS = ['100', '200', '500', '1000']

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['index', 'fromDate'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

type FilterDraft = {
  from: string
  to: string
  value: string
}

type SalesListState = {
  error: string | null
  isLoading: boolean
  sales: Sale[]
  totalQty: number
}

type SalesListAction =
  | { type: 'empty' }
  | { type: 'error'; error: string }
  | { type: 'errorMessage'; error: string }
  | { type: 'loaded'; sales: Sale[]; totalQty: number }
  | { type: 'loading' }
  | { type: 'replaceSale'; targetSale: Sale; nextSale: Sale }

const INITIAL_SALES_STATE: SalesListState = {
  error: null,
  isLoading: true,
  sales: [],
  totalQty: 0,
}

function useSalesTabModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0), value: '' }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [salesState, dispatchSalesState] = useReducer(salesListReducer, INITIAL_SALES_STATE)
  const [pageSize, setPageSize] = useValueState(DEFAULT_LIMIT)
  const [page, setPage] = useValueState(1)
  const [carrierSale, setCarrierSale] = useValueState<Sale | null>(null)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<WarehouseUkraineExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, toggleDensity } = useDataTableDensity('warehouse-ukraine-sales', TABLE_DEFAULT_LAYOUT.density)
  const downloadRequestRef = useRef(0)
  const realtimeReloadRef = useRef<number | null>(null)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const orderedSales = useMemo(() => orderWarehouseSales(salesState.sales), [salesState.sales])
  const saleIndexMap = useMemo(() => buildIndexMap(orderedSales), [orderedSales])

  const replaceSale = useCallback(
    (targetSale: Sale, nextSale: Sale) => {
      dispatchSalesState({ type: 'replaceSale', targetSale, nextSale })
    },
    [],
  )

  const scheduleRealtimeReload = useCallback(() => {
    if (realtimeReloadRef.current !== null) {
      window.clearTimeout(realtimeReloadRef.current)
    }

    realtimeReloadRef.current = window.setTimeout(() => {
      realtimeReloadRef.current = null
      reload()
    }, 800)
  }, [reload])

  useEffect(
    () => () => {
      if (realtimeReloadRef.current !== null) {
        window.clearTimeout(realtimeReloadRef.current)
      }
    },
    [],
  )

  useRealtimeEvent(realtimeEvents.saleAdded, scheduleRealtimeReload)
  useRealtimeEvent(realtimeEvents.saleUpdated, scheduleRealtimeReload)

  useEffect(() => {
    if (filterError) {
      dispatchSalesState({ type: 'empty' })
      return
    }

    let cancelled = false

    async function loadSales() {
      dispatchSalesState({ type: 'loading' })

      try {
        const result = await getWarehouseUkraineSales({
          from: toDateString(activeFilters.from),
          to: toDateString(activeFilters.to),
          value: activeFilters.value,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        })

        if (!cancelled) {
          dispatchSalesState({ type: 'loaded', sales: result.items, totalQty: result.totalQty })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchSalesState({
            type: 'error',
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити документи'),
          })
        }
      }
    }

    void loadSales()

    return () => {
      cancelled = true
    }
  }, [activeFilters, filterError, page, pageSize, reloadKey, t])

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  const runDownload = useCallback(
    async (loader: () => Promise<WarehouseUkraineExportDocument>) => {
      const requestId = downloadRequestRef.current + 1
      downloadRequestRef.current = requestId
      setDownloadOpened(true)
      setDownloadDocument(null)
      setDownloadError(null)
      setDownloading(true)

      try {
        const document = await loader()

        if (downloadRequestRef.current === requestId) {
          setDownloadDocument(document)
        }
      } catch (exportError) {
        if (downloadRequestRef.current === requestId) {
          setDownloadError(
            exportError instanceof Error ? exportError.message : t('Немає документів для завантаження'),
          )
        }
      } finally {
        if (downloadRequestRef.current === requestId) {
          setDownloading(false)
        }
      }
    },
    [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading, t],
  )

  const markSaleBeforePrint = useCallback(
    async (sale: Sale, patch: Pick<Sale, 'IsPrinted' | 'IsPrintedActProtocolEdit'>) => {
      const optimisticSale = {
        ...sale,
        ...patch,
        IsInvoice: true,
      }

      replaceSale(sale, optimisticSale)

      try {
        const savedSale = await updateWarehouseUkraineSale(optimisticSale)
        replaceSale(sale, { ...optimisticSale, ...savedSale })
        reload()
      } catch (updateError) {
        replaceSale(sale, sale)
        dispatchSalesState({
          type: 'errorMessage',
          error: updateError instanceof Error ? updateError.message : t('Не вдалося оновити статус друку'),
        })
      }
    },
    [reload, replaceSale, t],
  )

  const printSale = useCallback(
    (sale: Sale) => {
      if (sale.NetUid) {
        if (!sale.IsPrinted || hasApprovedInvoiceEdits(sale)) {
          void markSaleBeforePrint(sale, { IsPrinted: true })
        }

        void runDownload(() => getSalePrintDocument(sale.NetUid as string))
      }
    },
    [markSaleBeforePrint, runDownload],
  )

  const printActProtocolEdit = useCallback(
    (sale: Sale) => {
      if (sale.NetUid) {
        if (!sale.IsPrintedActProtocolEdit) {
          void markSaleBeforePrint(sale, { IsPrintedActProtocolEdit: true })
        }

        void runDownload(() => getSaleActProtocolEditDocument(sale.NetUid as string, true))
      }
    },
    [markSaleBeforePrint, runDownload],
  )

  function applyFilters(nextFilters: FilterDraft) {
    setPage(1)
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setPage(1)
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  function changePageSize(nextValue: string | null) {
    setPage(1)
    setPageSize(Number(nextValue || DEFAULT_LIMIT))
  }

  const canMoveBack = page > 1
  const canMoveForward = salesState.totalQty > 0
    ? page * pageSize < salesState.totalQty
    : salesState.sales.length === pageSize

  const columns = useSalesColumns({ indexMap: saleIndexMap, onPrint: printSale, onPrintActProtocolEdit: printActProtocolEdit, onOpenCarrier: setCarrierSale })

  return {
    activeFilters, applyFilters, canMoveBack, canMoveForward, carrierSale, changePageSize, closeDownload, columns,
    density, downloadDocument, downloadError, downloadOpened, error: salesState.error, filterDraft, filterError,
    isDownloading, isLoading: salesState.isLoading, page, pageSize, reload, resetFilters, sales: orderedSales,
    setCarrierSale, setPage, toggleDensity, totalQty: salesState.totalQty,
  }
}

function salesListReducer(state: SalesListState, action: SalesListAction): SalesListState {
  switch (action.type) {
    case 'empty':
      return { error: null, isLoading: false, sales: [], totalQty: 0 }
    case 'error':
      return { ...state, error: action.error, isLoading: false, sales: [], totalQty: 0 }
    case 'errorMessage':
      return { ...state, error: action.error }
    case 'loaded':
      return { error: null, isLoading: false, sales: action.sales, totalQty: action.totalQty }
    case 'loading':
      return { ...state, error: null, isLoading: true }
    case 'replaceSale':
      return {
        ...state,
        sales: state.sales.map((sale) => (sameSale(sale, action.targetSale) ? action.nextSale : sale)),
      }
    default:
      return state
  }
}

export function SalesTab() {
  const model = useSalesTabModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <PageHeaderActions>
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
      </PageHeaderActions>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap">
            <TextInput
              label={t('Пошук по товару')}
              value={model.filterDraft.value}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, value: event.currentTarget.value })}
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
            <DataTableDensityToggle density={model.density} onToggle={model.toggleDensity} size={36} />
            <Group gap={4} wrap="nowrap" style={{ marginLeft: 'auto' }}>
              <Select
                aria-label={t('Кількість рядків')}
                data={PAGE_SIZE_OPTIONS}
                disabled={model.isLoading}
                size="xs"
                value={String(model.pageSize)}
                w={96}
                onChange={model.changePageSize}
              />
              <Text c="dark" fw={700} size="xs" style={{ whiteSpace: 'nowrap' }}>
                {t('стор.')} {model.page}
              </Text>
              <ActionIcon
                aria-label={t('Попередня сторінка')}
                color="gray"
                disabled={!model.canMoveBack || model.isLoading}
                size="sm"
                variant="subtle"
                onClick={() => model.setPage((current) => Math.max(1, current - 1))}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon
                aria-label={t('Наступна сторінка')}
                color="gray"
                disabled={!model.canMoveForward || model.isLoading}
                size="sm"
                variant="subtle"
                onClick={() => model.setPage((current) => current + 1)}
              >
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {(model.error || model.filterError) && (
            <Alert color={model.filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <DataTable
            columns={model.columns}
            data={model.sales}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            density={model.density}
            emptyText={t('Документів не знайдено')}
            getRowId={(sale, index) => String(sale.NetUid || sale.Id || index)}
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-sales-1"
            maxHeight="calc(100vh - 420px)"
            minWidth={1480}
            tableId="warehouse-ukraine-sales"
          />
        </Stack>
      </Card>

      <SaleCarrierDrawer sale={model.carrierSale} onClose={() => model.setCarrierSale(null)} />
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

function useSalesColumns({
  indexMap,
  onOpenCarrier,
  onPrint,
  onPrintActProtocolEdit,
}: {
  indexMap: Map<Sale, number>
  onOpenCarrier: (sale: Sale) => void
  onPrint: (sale: Sale) => void
  onPrintActProtocolEdit: (sale: Sale) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Sale>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        accessor: (sale) => indexMap.get(sale) || 0,
        cell: (sale) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(sale) || ''}
          </Text>
        ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 150,
        minWidth: 130,
        accessor: (sale) => sale.ChangedToInvoice,
        cell: (sale) => <Text fw={600}>{formatDateTime(sale.ChangedToInvoice)}</Text>,
      },
      {
        id: 'actions',
        header: t('Роздрукувати'),
        width: 120,
        minWidth: 110,
        enableSorting: false,
        cell: (sale) => (
          <Group gap={4} wrap="nowrap">
            <Tooltip label={t('Підтвердження на друк і Друк пакета документів')}>
              <ActionIcon aria-label={t('Роздрукувати')} color="gray" size="sm" variant="subtle" onClick={() => onPrint(sale)}>
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Акт редагування')}>
              <ActionIcon
                aria-label={t('Акт редагування')}
                color={sale.IsPrintedActProtocolEdit ? 'teal' : 'gray'}
                size="sm"
                variant="subtle"
                onClick={() => onPrintActProtocolEdit(sale)}
              >
                <IconFileText size={16} />
              </ActionIcon>
            </Tooltip>
            {sale.CustomersOwnTtn?.TtnPDFPath && (
              <Tooltip label={t('Завантажити ТТН')}>
                <Anchor
                  href={upgradeHttpToHttps(sale.CustomersOwnTtn.TtnPDFPath)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconDownload size={16} />
                </Anchor>
              </Tooltip>
            )}
          </Group>
        ),
      },
      {
        id: 'status',
        header: t('Роздруковано'),
        width: 120,
        minWidth: 100,
        enableSorting: false,
        accessor: (sale) => getPrintedStatusText(sale),
        cell: (sale) => {
          const status = getPrintedStatusText(sale)

          if (!status) {
            return '-'
          }

          return (
            <Badge color={status === 'changed' ? 'orange' : 'teal'} variant="light">
              {status}
            </Badge>
          )
        },
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        accessor: (sale) => sale.SaleNumber?.Value,
        cell: (sale) => <Text fw={700}>{displayValue(sale.SaleNumber?.Value)}</Text>,
      },
      {
        id: 'client',
        header: t("Повне ім'я"),
        minWidth: 240,
        accessor: (sale) => buildClientName(sale),
        cell: (sale) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(buildClientName(sale))}
          </Text>
        ),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (sale) => sale.TotalAmountLocal,
        cell: (sale) => displayValue(sale.TotalAmountLocal),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 90,
        minWidth: 80,
        accessor: (sale) => sale.ClientAgreement?.Agreement?.Currency?.Code,
        cell: (sale) => displayValue(sale.ClientAgreement?.Agreement?.Currency?.Code),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 180,
        minWidth: 140,
        accessor: (sale) => getResponsible(sale),
        cell: (sale) => displayValue(getResponsible(sale)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 200,
        accessor: (sale) => sale.Comment,
        cell: (sale) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(sale.Comment)}
          </Text>
        ),
      },
      {
        id: 'transporter',
        header: t('Перевізник'),
        width: 180,
        minWidth: 150,
        accessor: (sale) => sale.Transporter?.Name,
        cell: (sale) => {
          if (!sale.Transporter?.Name) {
            return '-'
          }

          return (
            <Anchor component="button" type="button" size="sm" onClick={() => onOpenCarrier(sale)}>
              {sale.Transporter.Name}
            </Anchor>
          )
        },
      },
    ],
    [indexMap, onOpenCarrier, onPrint, onPrintActProtocolEdit, t],
  )
}

function getPrintedStatusText(sale: Sale): string {
  if (hasApprovedInvoiceEdits(sale)) {
    return 'changed'
  }

  if (sale.IsPrinted) {
    return translate('Роздруковано')
  }

  return ''
}

function hasApprovedInvoiceEdits(sale: Sale): boolean {
  return (sale.HistoryInvoiceEdit || []).some((entry) => entry.ApproveUpdate)
}

function hasUnprintedInvoiceEdits(sale: Sale): boolean {
  return Boolean(sale.HistoryInvoiceEdit?.length && !sale.IsPrinted)
}

function hasUpdatedApprovedInvoiceEdits(sale: Sale): boolean {
  return Boolean(sale.Updated && hasApprovedInvoiceEdits(sale))
}

function compareBooleanPriority(left: boolean, right: boolean): number {
  return Number(right) - Number(left)
}

function orderWarehouseSales(sales: Sale[]): Sale[] {
  return sales
    .map((sale, index) => ({ index, sale }))
    .sort((left, right) => {
      const updatedApprovedCompare = compareBooleanPriority(
        hasUpdatedApprovedInvoiceEdits(left.sale),
        hasUpdatedApprovedInvoiceEdits(right.sale),
      )

      if (updatedApprovedCompare !== 0) {
        return updatedApprovedCompare
      }

      const unprintedEditCompare = compareBooleanPriority(
        hasUnprintedInvoiceEdits(left.sale),
        hasUnprintedInvoiceEdits(right.sale),
      )

      if (unprintedEditCompare !== 0) {
        return unprintedEditCompare
      }

      return left.index - right.index
    })
    .map((entry) => entry.sale)
}

function sameSale(left: Sale, right: Sale): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  return Boolean(left.Id && right.Id && left.Id === right.Id)
}

function buildClientName(sale: Sale): string {
  const client = sale.ClientAgreement?.Client
  const region = client?.RegionCode?.Value ? `${client.RegionCode.Value} ` : ''
  const retail =
    sale.RetailClient && (sale.RetailClient.Id || 0) > 0
      ? ` (${sale.RetailClient.Name || ''} ${sale.RetailClient.PhoneNumber || ''})`
      : ''

  return `${region}${client?.FullName || ''}${retail}`.trim()
}

function getResponsible(sale: Sale): string {
  if (sale.UpdateUser && (sale.UpdateUser.Id || 0) > 0) {
    return sale.UpdateUser.LastName || ''
  }

  if (sale.User && (sale.User.Id || 0) > 0) {
    return sale.User.LastName || ''
  }

  return ''
}

function upgradeHttpToHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://')
}

function buildIndexMap(sales: Sale[]): Map<Sale, number> {
  return sales.reduce((indexMap, sale, index) => {
    indexMap.set(sale, index + 1)

    return indexMap
  }, new Map<Sale, number>())
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
