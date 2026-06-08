import { ActionIcon, Alert, Badge, Button, Card, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconDownload, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getInvoiceRegister, getInvoiceRegisterPrintDocument } from '../api/invoiceRegisterApi'
import type { Sale, WarehouseUkraineExportDocument } from '../types'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { displayValue, getDateShiftedByDays } from './dateHelpers'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '50', '100', '150']

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
  isLoadingMore: boolean
  pageSize: number
  hasMore: boolean
  downloadOpened: boolean
  downloadDocument: WarehouseUkraineExportDocument | null
  downloadError: string | null
  isDownloading: boolean
}

type InvoiceRegisterAction =
  | { type: 'applyFilters'; filters: FilterDraft }
  | { type: 'resetFilters'; filters: FilterDraft }
  | { type: 'setPageSize'; pageSize: number }
  | { type: 'invalidFilters' }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; invoices: Sale[]; totalQty: number; hasMore: boolean }
  | { type: 'loadFailed'; error: string }
  | { type: 'loadMoreStarted' }
  | { type: 'loadMoreSucceeded'; invoices: Sale[]; totalQty: number; hasMore: boolean; requestOffset: number }
  | { type: 'loadMoreFailed'; error: string }
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
    isLoadingMore: false,
    pageSize: DEFAULT_PAGE_SIZE,
    hasMore: false,
    downloadOpened: false,
    downloadDocument: null,
    downloadError: null,
    isDownloading: false,
  }
}

function invoiceRegisterReducer(state: InvoiceRegisterState, action: InvoiceRegisterAction): InvoiceRegisterState {
  switch (action.type) {
    case 'applyFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters }
    case 'resetFilters':
      return { ...state, filterDraft: action.filters, activeFilters: action.filters }
    case 'setPageSize':
      return { ...state, pageSize: action.pageSize }
    case 'invalidFilters':
      return { ...state, invoices: [], totalQty: 0, hasMore: false, isLoading: false }
    case 'loadStarted':
      return { ...state, isLoading: true, error: null }
    case 'loadSucceeded':
      return {
        ...state,
        invoices: action.invoices,
        totalQty: action.totalQty,
        hasMore: action.hasMore,
        isLoading: false,
      }
    case 'loadFailed':
      return {
        ...state,
        invoices: [],
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
        invoices:
          state.invoices.length === action.requestOffset ? [...state.invoices, ...action.invoices] : state.invoices,
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

function useInvoiceRegisterModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(() => ({ date: getDateShiftedByDays(0), value: '' }), [])
  const initialState = useMemo(() => createInitialInvoiceRegisterState(initialFilters), [initialFilters])
  const [state, dispatchState] = useReducer(invoiceRegisterReducer, initialState)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const { activeFilters, invoices, pageSize } = state
  const filterError = activeFilters.date ? null : translate('Вкажіть дату')
  const listRequestKey = `${activeFilters.date}|${activeFilters.value}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const invoiceIndexMap = useMemo(() => buildIndexMap(invoices), [invoices])

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

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
          offset: 0,
        })

        if (!cancelled) {
          dispatchState({
            type: 'loadSucceeded',
            invoices: result.items,
            totalQty: result.totalQty,
            hasMore: result.items.length < result.totalQty && result.items.length > 0,
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
  }, [activeFilters, filterError, pageSize, reloadKey, t])

  async function loadMoreInvoices() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = invoices.length
    dispatchState({ type: 'loadMoreStarted' })

    try {
      const result = await getInvoiceRegister({
        value: activeFilters.value,
        date: activeFilters.date,
        limit: pageSize,
        offset: requestOffset,
      })

      if (listRequestKeyRef.current === requestKey) {
        dispatchState({
          type: 'loadMoreSucceeded',
          invoices: result.items,
          totalQty: result.totalQty,
          hasMore: requestOffset + result.items.length < result.totalQty && result.items.length > 0,
          requestOffset,
        })
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        dispatchState({
          type: 'loadMoreFailed',
          error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити реєстр'),
        })
      }
    }
  }

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
        offset: 0,
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

  const columns = useInvoiceRegisterColumns(invoiceIndexMap)
  const { density, toggleDensity } = useDataTableDensity('warehouse-ukraine-invoice-register', TABLE_DEFAULT_LAYOUT.density)

  return {
    ...state,
    applyFilters,
    closeDownload,
    columns,
    density,
    exportDocument,
    filterError,
    loadMoreInvoices,
    reload,
    resetFilters,
    setPageSize,
    toggleDensity,
  }
}

export function InvoiceRegisterTab() {
  const model = useInvoiceRegisterModel()
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <PageHeaderActions>
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
            disabled={Boolean(model.filterError) || model.isLoading || model.isDownloading}
            variant="light"
            onClick={model.exportDocument}
          >
            {t('Роздрукувати')}
          </Button>
          <DataTableDensityToggle density={model.density} onToggle={model.toggleDensity} size={38} />
        </Group>
      </PageHeaderActions>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <TextInput
              label={t('Значення')}
              value={model.filterDraft.value}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, value: event.currentTarget.value })}
            />
            <TextInput
              label={t('На дату')}
              type="date"
              value={model.filterDraft.date}
              onChange={(event) => model.applyFilters({ ...model.filterDraft, date: event.currentTarget.value })}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={model.resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(model.error || model.filterError) && (
            <Alert color={model.filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {model.filterError || model.error}
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
            data={model.invoices}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            density={model.density}
            emptyText={t('Накладних не знайдено')}
            getRowId={(invoice, index) => String(invoice.NetUid || invoice.Id || index)}
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-invoice-register-2"
            maxHeight="calc(100vh - 420px)"
            minWidth={1000}
            tableId="warehouse-ukraine-invoice-register"
          />

          {model.hasMore && (
            <Group justify="center">
              <Button color="gray" loading={model.isLoadingMore} variant="light" onClick={model.loadMoreInvoices}>
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
        accessor: (invoice) => getPrintedStatusText(invoice),
        cell: (invoice) => {
          const status = getPrintedStatusText(invoice)

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

function buildIndexMap(invoices: Sale[]): Map<Sale, number> {
  return invoices.reduce((indexMap, invoice, index) => {
    indexMap.set(invoice, index + 1)

    return indexMap
  }, new Map<Sale, number>())
}

function getPrintedStatusText(invoice: Sale): string {
  if (hasApprovedInvoiceEdits(invoice)) {
    return 'changed'
  }

  if (invoice.IsPrinted) {
    return translate('Роздруковано')
  }

  return ''
}

function hasApprovedInvoiceEdits(invoice: Sale): boolean {
  return (invoice.HistoryInvoiceEdit || []).some((entry) => entry.ApproveUpdate)
}
