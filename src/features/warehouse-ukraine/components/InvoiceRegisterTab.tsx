import { ActionIcon, Alert, Badge, Button, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconDownload, IconRestore } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { getInvoiceRegister, getInvoiceRegisterPrintDocument } from '../api/invoiceRegisterApi'
import { getInvoicePrintStatus } from '../invoicePrintStatus'
import type { Sale, WarehouseUkraineExportDocument } from '../types'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { displayValue, getDateShiftedByDays } from './dateHelpers'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '150']
const SEARCH_DEBOUNCE_MS = 200

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['index', 'invoiceNumber'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

type FilterDraft = {
  date: string
  value: string
}

type InvoiceRegisterState = {
  filterDraft: FilterDraft
  activeFilters: FilterDraft
  invoices: Sale[]
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

type InvoiceRegisterAction =
  | { type: 'setFilterDraft'; filters: FilterDraft }
  | { type: 'applyActiveFilters'; filters: FilterDraft }
  | { type: 'applyFilters'; filters: FilterDraft }
  | { type: 'resetFilters'; filters: FilterDraft }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'setPage'; page: number }
  | { type: 'invalidFilters' }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; invoices: Sale[]; totalQty: number }
  | { type: 'loadFailed'; error: string }
  | { type: 'downloadStarted' }
  | { type: 'downloadSucceeded'; document: WarehouseUkraineExportDocument }
  | { type: 'downloadFailed'; error: string }
  | { type: 'downloadClosed' }

function createInitialInvoiceRegisterState(initialFilters: FilterDraft): InvoiceRegisterState {
  return {
    filterDraft: initialFilters,
    activeFilters: initialFilters,
    invoices: [],
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

function invoiceRegisterReducer(state: InvoiceRegisterState, action: InvoiceRegisterAction): InvoiceRegisterState {
  switch (action.type) {
    case 'setFilterDraft':
      return { ...state, filterDraft: action.filters }
    case 'applyActiveFilters':
      return { ...state, activeFilters: action.filters, page: 1 }
    case 'applyFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters, page: 1 }
    case 'resetFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters, page: 1 }
    case 'setPageSize':
      return { ...state, page: 1, pageSize: action.pageSize }
    case 'setPage':
      return { ...state, page: action.page }
    case 'invalidFilters':
      return { ...state, invoices: [], totalQty: 0, isLoading: false }
    case 'loadStarted':
      return { ...state, isLoading: true, error: null }
    case 'loadSucceeded':
      return {
        ...state,
        invoices: action.invoices,
        totalQty: action.totalQty,
        isLoading: false,
      }
    case 'loadFailed':
      return {
        ...state,
        invoices: [],
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

function useInvoiceRegisterModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(() => ({ date: getDateShiftedByDays(0), value: '' }), [])
  const initialState = useMemo(() => createInitialInvoiceRegisterState(initialFilters), [initialFilters])
  const [state, dispatchState] = useReducer(invoiceRegisterReducer, initialState)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const { activeFilters, invoices, page, pageSize, totalQty } = state
  const [debouncedSearchValue] = useDebouncedValue(state.filterDraft.value, SEARCH_DEBOUNCE_MS)
  const filterError = activeFilters.date ? null : translate('Вкажіть дату')
  const pageOffset = (page - 1) * pageSize
  const totalPages = Math.max(1, Math.ceil(totalQty / pageSize))
  const pageStart = totalQty > 0 ? pageOffset + 1 : 0
  const pageEnd = totalQty > 0 ? Math.min(pageOffset + invoices.length, totalQty) : 0
  const invoiceIndexMap = useMemo(() => buildIndexMap(invoices, pageOffset), [invoices, pageOffset])

  useEffect(() => {
    const nextFilters = {
      date: state.filterDraft.date,
      value: debouncedSearchValue,
    }

    if (activeFilters.date !== nextFilters.date || activeFilters.value !== nextFilters.value) {
      dispatchState({ type: 'applyActiveFilters', filters: nextFilters })
    }
  }, [activeFilters.date, activeFilters.value, debouncedSearchValue, state.filterDraft.date])

  useEffect(() => {
    if (filterError) {
      dispatchState({ type: 'invalidFilters' })
      return
    }

    let cancelled = false

    async function loadInvoices() {
      dispatchState({ type: 'loadStarted' })

      try {
        const result = await getInvoiceRegister({
          value: activeFilters.value,
          date: activeFilters.date,
          limit: pageSize,
          offset: pageOffset,
        })

        if (!cancelled) {
          dispatchState({
            type: 'loadSucceeded',
            invoices: result.items,
            totalQty: result.totalQty,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchState({
            type: 'loadFailed',
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити реєстр'),
          })
        }
      }
    }

    void loadInvoices()

    return () => {
      cancelled = true
    }
  }, [activeFilters, filterError, pageOffset, pageSize, reloadKey, t])

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    dispatchState({ type: 'downloadClosed' })
  }, [])

  async function exportDocument() {
    if (filterError || state.isLoading || state.isDownloading) {
      return
    }

    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    dispatchState({ type: 'downloadStarted' })

    try {
      const document = await getInvoiceRegisterPrintDocument({
        value: activeFilters.value,
        date: activeFilters.date,
        limit: pageSize,
        offset: pageOffset,
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

  function updateFilterDraft(nextFilters: FilterDraft) {
    dispatchState({ type: 'setFilterDraft', filters: nextFilters })
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

  const columns = useInvoiceRegisterColumns(invoiceIndexMap)

  return {
    ...state,
    applyFilters,
    closeDownload,
    columns,
    exportDocument,
    filterError,
    pageEnd,
    pageStart,
    reload,
    resetFilters,
    setPage,
    setPageSize,
    totalPages,
    updateFilterDraft,
  }
}

export function InvoiceRegisterTab() {
  const model = useInvoiceRegisterModel()
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="app-filter-bar warehouse-ukraine-filter-bar is-invoice-register">
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Значення')}
              value={model.filterDraft.value}
              onChange={(event) => model.updateFilterDraft({ ...model.filterDraft, value: event.currentTarget.value })}
            />
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('На дату')}
              type="date"
              value={model.filterDraft.date}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, date: event.currentTarget.value })}
            />
            <div className="app-filter-actions warehouse-ukraine-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={model.resetFilters}>
                  <IconRestore size={17} />
                </ActionIcon>
              </Tooltip>
              <Button
                color="gray"
                leftSection={<IconDownload size={16} />}
                loading={model.isDownloading}
                disabled={Boolean(model.filterError) || model.isLoading || model.isDownloading}
                variant="light"
                onClick={model.exportDocument}
              >
                {t('Роздрукувати')}
              </Button>
              <Paginator
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

          {(model.error || model.filterError) && (
            <Alert className="console-table-alert" color={model.filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <div className="warehouse-ukraine-table console-table-body">
          <DataTable
            columns={model.columns}
            data={model.invoices}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Накладних не знайдено')}
            getRowId={(invoice, index) => String(invoice.NetUid || invoice.Id || index)}
            height="100%"
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-invoice-register-3"
            minWidth={1000}
            showLayoutControls
            tableId="warehouse-ukraine-invoice-register"
            toolbarPortalTarget={tableToolbarSlot}
          />
          </div>

          {model.totalQty > 0 && (
            <div className="console-table-footer warehouse-ukraine-table-footer">
              <Text c="dimmed" size="sm">
                {t('Показано')} {model.pageStart}-{model.pageEnd} {t('з')} {model.totalQty}
              </Text>
            </div>
          )}
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

function useInvoiceRegisterColumns(indexMap: Map<Sale, number>) {
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
        accessor: (invoice) => indexMap.get(invoice) || 0,
        cell: (invoice) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(invoice) || ''}
          </Text>
        ),
      },
      {
        id: 'invoiceNumber',
        header: t('№ Видаткової накладної'),
        width: 220,
        minWidth: 170,
        accessor: (invoice) => invoice.SaleNumber?.Value,
        cell: (invoice) => <Text fw={700}>{displayValue(invoice.SaleNumber?.Value)}</Text>,
      },
      {
        id: 'printedStatus',
        header: t('Роздруковано'),
        width: 132,
        minWidth: 112,
        enableSorting: false,
        accessor: (invoice) => getInvoicePrintStatus(invoice)?.label || '',
        cell: (invoice) => {
          const status = getInvoicePrintStatus(invoice)

          if (!status) {
            return '-'
          }

          return (
            <Badge color={status.color} variant="light">
              {status.label}
            </Badge>
          )
        },
      },
      {
        id: 'actProtocolEditStatus',
        header: t('Акт редагування'),
        width: 144,
        minWidth: 124,
        enableSorting: false,
        accessor: (invoice) => invoice.IsPrintedActProtocolEdit,
        cell: (invoice) =>
          invoice.IsPrintedActProtocolEdit
            ? (
                <Badge color="teal" variant="light">
                  {t('Так')}
                </Badge>
              )
            : '-',
      },
      {
        id: 'clientCode',
        header: t('Код клієнта'),
        width: 200,
        minWidth: 150,
        accessor: (invoice) => invoice.ClientAgreement?.Client?.OriginalRegionCode,
        cell: (invoice) => displayValue(invoice.ClientAgreement?.Client?.OriginalRegionCode),
      },
      {
        id: 'clientName',
        header: t("Повне ім'я"),
        minWidth: 260,
        accessor: (invoice) => invoice.ClientAgreement?.Client?.FullName,
        cell: (invoice) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(invoice.ClientAgreement?.Client?.FullName)}
          </Text>
        ),
      },
    ],
    [indexMap, t],
  )
}

function buildIndexMap(invoices: Sale[], offset = 0): Map<Sale, number> {
  return invoices.reduce((indexMap, invoice, index) => {
    indexMap.set(invoice, offset + index + 1)

    return indexMap
  }, new Map<Sale, number>())
}
