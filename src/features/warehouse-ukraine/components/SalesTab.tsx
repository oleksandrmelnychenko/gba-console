import { ActionIcon, Alert, Anchor, Badge, Button, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconDownload,
  IconFileText,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconRestore,
} from '@tabler/icons-react'
import { Truck as TruckIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { NewSaleWizard } from '../../sales-ukraine/components/new-sale-wizard/NewSaleWizard'
import { SALES_UKRAINE_EDIT_PERMISSION } from '../../sales-ukraine/permissions'
import { SaleDetailsDrawer } from '../../sales-ukraine/components/SaleDetailsDrawer'
import type { SalesUkraineSale } from '../../sales-ukraine/types'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { toProxiedAssetUrl } from '../../../shared/url/proxiedAssetUrl'
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
  getPreferredWarehousePrintUrl,
  hasWarehouseDocumentUrl,
  openWarehouseDocumentUrl,
} from './openWarehouseDocument'

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
  columnSizing: {
    index: 52,
    actions: 112,
    amount: 118,
    client: 300,
    comment: 260,
    currency: 82,
    fromDate: 150,
    number: 140,
    responsible: 168,
    status: 128,
    transporter: 192,
  },
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
  const [debouncedSearchValue] = useDebouncedValue(filterDraft.value, 350)
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
  const salesIndexMap = useMemo(
    () => orderedSales.reduce((indexMap, sale, index) => indexMap.set(sale, index + 1), new Map<Sale, number>()),
    [orderedSales],
  )

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
    if (debouncedSearchValue === activeFilters.value) {
      return
    }

    setPage(1)
    setActiveFilters((currentFilters) => ({ ...currentFilters, value: debouncedSearchValue }))
  }, [activeFilters.value, debouncedSearchValue, setActiveFilters, setPage])

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
      setDownloadOpened(true)
      setDownloadDocument(null)
      setDownloadError(null)
      setDownloading(true)

      try {
        const document = await loader()

        if (downloadRequestRef.current === requestId) {
          const documentUrl = getPreferredWarehousePrintUrl(document)

          if (documentUrl && openWarehouseDocumentUrl(documentUrl)) {
            setDownloadOpened(false)
            setDownloadDocument(null)
            setDownloadError(null)
          } else {
            setDownloadDocument(hasWarehouseDocumentUrl(document) ? document : null)
            setDownloadError(hasWarehouseDocumentUrl(document) ? null : t('Немає документів для завантаження'))
          }
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

  const columns = useSalesColumns({ indexMap: salesIndexMap, onPrint: printSale, onPrintActProtocolEdit: printActProtocolEdit, onOpenCarrier: setCarrierSale })

  return {
    activeFilters, applyFilters, canMoveForward, carrierSale, changePageSize, closeDownload, columns,
    downloadDocument, downloadError, downloadOpened, error: salesState.error, filterDraft, filterError,
    isDownloading, isLoading: salesState.isLoading, page, pageSize, reload, resetFilters, sales: orderedSales,
    setCarrierSale, setFilterDraft, setPage, totalQty: salesState.totalQty,
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
  const { hasPermission } = useAuth()
  const canCreateSale = hasPermission(SALES_UKRAINE_EDIT_PERMISSION)
  const [isNewSaleOpen, setNewSaleOpen] = useState(false)
  const [wizardEditSale, setWizardEditSale] = useState<SalesUkraineSale | null>(null)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="app-filter-bar warehouse-ukraine-filter-bar is-sales">
          <TextInput
            className="warehouse-ukraine-filter-input"
            label={t('Пошук по товару')}
            value={model.filterDraft.value}
            onChange={(event) => model.setFilterDraft({ ...model.filterDraft, value: event.currentTarget.value })}
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
              totalPages={model.totalQty > 0 ? Math.ceil(model.totalQty / model.pageSize) : undefined}
              onPageChange={model.setPage}
              onPageSizeChange={model.changePageSize}
              onRefresh={() => model.reload()}
            />
          </div>
          <div ref={setTableToolbarSlot} className="warehouse-ukraine-table-toolbar-slot" />
          <div className="warehouse-ukraine-command-actions">
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!canCreateSale}
              leftSection={<IconPlus size={16} />}
              size="sm"
              onClick={() => setNewSaleOpen(true)}
            >
              {t('Утворити')}
            </Button>
          </div>
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
            distributeAvailableWidth
            emptyText={t('Документів не знайдено')}
            getRowId={(sale, index) => String(sale.NetUid || sale.Id || index)}
            height="100%"
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-sales-3"
            minWidth={1480}
            showLayoutControls
            tableId="warehouse-ukraine-sales"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={(sale) => setWizardEditSale(sale as unknown as SalesUkraineSale)}
          />
        </div>
        {model.totalQty > 0 && (
          <div className="console-table-footer warehouse-ukraine-table-footer">
            <Text c="dimmed" size="sm">
              {t('Показано')} {(model.page - 1) * model.pageSize + 1}-{Math.min(model.page * model.pageSize, model.totalQty)} {t('з')}{' '}
              {model.totalQty}
            </Text>
          </div>
        )}
      </div>

      <SaleDetailsDrawer
        sale={model.carrierSale as unknown as SalesUkraineSale | null}
        onClose={() => model.setCarrierSale(null)}
        onSaved={() => {
          model.setCarrierSale(null)
          model.reload()
        }}
      />
      <DownloadDocumentModal
        document={model.downloadDocument}
        error={model.downloadError}
        isLoading={model.isDownloading}
        opened={model.downloadOpened}
        onClose={model.closeDownload}
      />
      <NewSaleWizard
        editSale={wizardEditSale}
        opened={(canCreateSale && isNewSaleOpen) || Boolean(wizardEditSale)}
        onClose={() => {
          setNewSaleOpen(false)
          setWizardEditSale(null)
          model.reload()
        }}
        onCreated={() => {
          setNewSaleOpen(false)
          setWizardEditSale(null)
          model.reload()
        }}
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
        width: 52,
        minWidth: 44,
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
              <ActionIcon
                aria-label={t('Роздрукувати')}
                color="gray"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onPrint(sale)
                }}
              >
                <IconPrinter size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Акт редагування')}>
              <ActionIcon
                aria-label={t('Акт редагування')}
                color={sale.IsPrintedActProtocolEdit ? 'teal' : 'gray'}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onPrintActProtocolEdit(sale)
                }}
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
                  onClick={(event) => event.stopPropagation()}
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
        cell: (sale) => (
          <span className="sales-tab-cell-num">{displayValue(sale.SaleNumber?.Value)}</span>
        ),
      },
      {
        id: 'client',
        header: t("Повне ім'я"),
        width: 300,
        minWidth: 240,
        accessor: (sale) => buildClientName(sale),
        cell: (sale) => (
          <Text size="sm" lineClamp={2} title={displayValue(buildClientName(sale))}>
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
        cell: (sale) => (
          <span className="sales-tab-cell-currency">
            {displayValue(sale.ClientAgreement?.Agreement?.Currency?.Code)}
          </span>
        ),
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
        width: 260,
        minWidth: 200,
        accessor: (sale) => sale.Comment,
        cell: (sale) => (
          <Text size="sm" lineClamp={2} title={displayValue(sale.Comment)}>
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

          const transporterLogoUrl = toProxiedAssetUrl(sale.Transporter.ImageUrl?.trim())
          const carrierEdited = Boolean(sale.UpdateDataCarrier?.length)

          return (
            <Group gap={6} wrap="nowrap">
              {carrierEdited && (
                <Tooltip label={t('Перевізника редаговано')}>
                  <IconPencil size={14} style={{ color: 'var(--mantine-color-orange-6)', flex: '0 0 auto' }} />
                </Tooltip>
              )}
              {transporterLogoUrl ? (
                <span aria-hidden style={{ ...TRANSPORTER_LOGO_STYLE, backgroundImage: `url(${upgradeHttpToHttps(transporterLogoUrl)})` }} />
              ) : (
                <TruckIcon size={15} style={{ color: 'var(--mantine-color-gray-6)', flex: '0 0 auto' }} />
              )}
              <Anchor
                c="dark.6"
                component="button"
                fw={600}
                size="sm"
                type="button"
                underline="always"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenCarrier(sale)
                }}
              >
                {sale.Transporter.Name}
              </Anchor>
            </Group>
          )
        },
      },
    ],
    [indexMap, onOpenCarrier, onPrint, onPrintActProtocolEdit, t],
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
