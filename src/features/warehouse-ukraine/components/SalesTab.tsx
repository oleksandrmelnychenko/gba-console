import { ActionIcon, Alert, Anchor, Badge, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import {
  IconAlertCircle,
  IconDownload,
  IconFileText,
  IconPrinter,
  IconRestore,
} from '@tabler/icons-react'
import { Truck as TruckIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import {
  getSaleActProtocolEditDocument,
  getSalePrintDocument,
  getWarehouseUkraineSales,
  updateWarehouseUkraineSale,
} from '../api/salesApi'
import { getInvoicePrintStatus, hasApprovedInvoiceEdits } from '../invoicePrintStatus'
import type { Sale, WarehouseUkraineExportDocument } from '../types'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { displayValue, formatDateTime, getDateShiftedByDays, toDateString } from './dateHelpers'
import {
  closePendingWarehouseDocumentWindow,
  getPreferredWarehousePrintUrl,
  hasWarehouseDocumentUrl,
  openPendingWarehouseDocumentWindow,
  openWarehouseDocumentInWindow,
} from './openWarehouseDocument'
import { SaleCarrierDrawer } from './SaleCarrierDrawer'

const DEFAULT_LIMIT = 500
const TRANSPORTER_LOGO_STYLE = {
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'contain',
  display: 'block',
  flex: '0 0 auto',
  height: 18,
  width: 24,
} as const

const salesMoneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

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
  const downloadRequestRef = useRef(0)
  const realtimeReloadRef = useRef<number | null>(null)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const orderedSales = useMemo(() => orderWarehouseSales(salesState.sales), [salesState.sales])

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

  const runPrintDocument = useCallback(
    async (loader: () => Promise<WarehouseUkraineExportDocument>) => {
      const requestId = downloadRequestRef.current + 1
      downloadRequestRef.current = requestId
      const pendingWindow = openPendingWarehouseDocumentWindow()
      setDownloadOpened(true)
      setDownloadDocument(null)
      setDownloadError(null)
      setDownloading(true)

      try {
        const document = await loader()

        if (downloadRequestRef.current === requestId) {
          const documentUrl = getPreferredWarehousePrintUrl(document)

          if (documentUrl && openWarehouseDocumentInWindow(pendingWindow, documentUrl)) {
            setDownloadOpened(false)
            setDownloadDocument(null)
            setDownloadError(null)
          } else {
            closePendingWarehouseDocumentWindow(pendingWindow)
            setDownloadDocument(hasWarehouseDocumentUrl(document) ? document : null)
            setDownloadError(hasWarehouseDocumentUrl(document) ? null : t('Немає документів для завантаження'))
          }
        }
      } catch (exportError) {
        if (downloadRequestRef.current === requestId) {
          closePendingWarehouseDocumentWindow(pendingWindow)
          setDownloadError(
            exportError instanceof Error ? exportError.message : t('Немає документів для завантаження'),
          )
        } else {
          closePendingWarehouseDocumentWindow(pendingWindow)
        }
      } finally {
        if (downloadRequestRef.current === requestId) {
          setDownloading(false)
        } else {
          closePendingWarehouseDocumentWindow(pendingWindow)
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

        void runPrintDocument(() => getSalePrintDocument(sale.NetUid as string))
      }
    },
    [markSaleBeforePrint, runPrintDocument],
  )

  const printActProtocolEdit = useCallback(
    (sale: Sale) => {
      if (sale.NetUid) {
        if (!sale.IsPrintedActProtocolEdit) {
          void markSaleBeforePrint(sale, { IsPrintedActProtocolEdit: true })
        }

        void runPrintDocument(() => getSaleActProtocolEditDocument(sale.NetUid as string, true))
      }
    },
    [markSaleBeforePrint, runPrintDocument],
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

  function changePageSize(nextPageSize: number) {
    setPage(1)
    setPageSize(nextPageSize || DEFAULT_LIMIT)
  }

  const canMoveForward = salesState.totalQty > 0
    ? page * pageSize < salesState.totalQty
    : salesState.sales.length === pageSize

  const columns = useSalesColumns({ onPrint: printSale, onPrintActProtocolEdit: printActProtocolEdit, onOpenCarrier: setCarrierSale })

  return {
    activeFilters, applyFilters, canMoveForward, carrierSale, changePageSize, closeDownload, columns,
    downloadDocument, downloadError, downloadOpened, error: salesState.error, filterDraft, filterError,
    isDownloading, isLoading: salesState.isLoading, page, pageSize, reload, resetFilters, sales: orderedSales,
    setCarrierSale, setPage, totalQty: salesState.totalQty,
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
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="app-filter-bar warehouse-ukraine-filter-bar is-sales">
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Пошук по товару')}
              value={model.filterDraft.value}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, value: event.currentTarget.value })}
            />
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Початкова дата')}
              max={model.filterDraft.to || undefined}
              type="date"
              value={model.filterDraft.from}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Кінцева дата')}
              min={model.filterDraft.from || undefined}
              type="date"
              value={model.filterDraft.to}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, to: event.currentTarget.value })}
            />
            <div className="app-filter-actions warehouse-ukraine-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={model.resetFilters}>
                  <IconRestore size={17} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                hasNext={model.canMoveForward}
                isLoading={model.isLoading}
                page={model.page}
                pageSize={model.pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={model.setPage}
                onPageSizeChange={model.changePageSize}
                onRefresh={() => model.reload()}
              />
            </div>
            <div ref={setTableToolbarSlot} className="warehouse-ukraine-table-toolbar-slot" />
          </div>

          {(model.error || model.filterError) && (
            <Alert className="console-table-alert" color={model.filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <div className="warehouse-ukraine-table console-table-body">
          <DataTable
            columns={model.columns}
            data={model.sales}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Документів не знайдено')}
            getRowId={(sale, index) => String(sale.NetUid || sale.Id || index)}
            height="100%"
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-sales-2"
            minWidth={1480}
            showLayoutControls
            tableId="warehouse-ukraine-sales"
            toolbarPortalTarget={tableToolbarSlot}
          />
          </div>
      </div>

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
  onOpenCarrier,
  onPrint,
  onPrintActProtocolEdit,
}: {
  onOpenCarrier: (sale: Sale) => void
  onPrint: (sale: Sale) => void
  onPrintActProtocolEdit: (sale: Sale) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Sale>[]>(
    () => [
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 150,
        minWidth: 130,
        accessor: (sale) => sale.ChangedToInvoice,
        cell: (sale) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatDateTime(sale.ChangedToInvoice)}</Text>,
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
        accessor: (sale) => getInvoicePrintStatus(sale)?.label || '',
        cell: (sale) => {
          const status = getInvoicePrintStatus(sale)

          if (!status) {
            return ''
          }

          return (
            <Badge className={status.key === 'printed' ? 'app-role-pill is-green' : 'app-role-pill is-orange'} variant="light">
              {status.label}
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
        cell: (sale) => {
          const saleNumber = displayValue(sale.SaleNumber?.Value)

          if (!saleNumber) {
            return ''
          }

          return (
            <Badge className="app-role-pill is-yellow" variant="light">
              {saleNumber}
            </Badge>
          )
        },
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
        cell: (sale) => (
          <span className="app-money">
            {typeof sale.TotalAmountLocal === 'number' ? salesMoneyFormatter.format(sale.TotalAmountLocal) : displayValue(sale.TotalAmountLocal)}
          </span>
        ),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 90,
        minWidth: 80,
        accessor: (sale) => sale.ClientAgreement?.Agreement?.Currency?.Code,
        cell: (sale) => {
          const currencyCode = displayValue(sale.ClientAgreement?.Agreement?.Currency?.Code)

          if (!currencyCode) {
            return ''
          }

          return (
            <Badge className="app-role-pill is-green" variant="light">
              {currencyCode}
            </Badge>
          )
        },
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
            return ''
          }

          const transporterLogoUrl = sale.Transporter.ImageUrl?.trim()

          return (
            <Group gap={6} wrap="nowrap">
              {transporterLogoUrl ? (
                <span aria-hidden style={{ ...TRANSPORTER_LOGO_STYLE, backgroundImage: `url(${upgradeHttpToHttps(transporterLogoUrl)})` }} />
              ) : (
                <TruckIcon size={15} style={{ color: 'var(--mantine-color-gray-6)', flex: '0 0 auto' }} />
              )}
              <Anchor c="dark.6" component="button" fw={600} size="sm" type="button" underline="always" onClick={() => onOpenCarrier(sale)}>
                {sale.Transporter.Name}
              </Anchor>
            </Group>
          )
        },
      },
    ],
    [onOpenCarrier, onPrint, onPrintActProtocolEdit, t],
  )
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


function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}
