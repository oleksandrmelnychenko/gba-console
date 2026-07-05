import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCash,
  IconChevronRight,
  IconEye,
  IconPrinter,
  IconRestore,
  IconSearch,
  IconTimeline,
  IconTruckDelivery,
} from '@tabler/icons-react'
import { type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react'
import { formatLocalDate, SYNC_DATA_RANGE_START } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DocumentOutcomePaymentModal } from '../../document-outcome-payment/components/DocumentOutcomePaymentModal'
import type { DocumentOutcomePaymentSource } from '../../document-outcome-payment/types'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  getTaxFreeCarrier,
  getTaxFreeDocuments,
  printTaxFreeDocument,
  searchTaxFreeCarriers,
  updateTaxFreeDocument,
} from '../api/taxFreeDocumentsApi'
import {
  TaxFreePaymentFromTaxFreeModal,
  type TaxFreePaymentAction,
} from '../components/TaxFreePaymentFromTaxFreeModal'
import type { Statham, StathamPassport, TaxFreeDocument, TaxFreeItem } from '../types'
import { TaxFreeStatus } from '../types'
import {
  formatTaxFreeAmountPl,
  getPersonName,
  getTaxFreeClient,
  getTaxFreeItemProduct,
  getTaxFreeResponsible,
  getTaxFreeStatusLabel,
  getTaxFreeStatusOptions,
} from '../utils'
import './tax-free-documents-page.css'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

const FILTER_STORAGE_KEY = 'taxFreeDocumentFilters:v2'

const EMPTY_TAX_FREE_ITEMS: TaxFreeItem[] = []

const DOCUMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['packListNumber', 'number'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const TAX_FREE_TABLE_CELL_STYLE = {
  display: 'block',
  lineHeight: '18px',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

/* §5.1: numbers/codes/dates/sums render in mono 600. */
const TAX_FREE_TABLE_CELL_MONO_STYLE = {
  ...TAX_FREE_TABLE_CELL_STYLE,
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  letterSpacing: 0,
} as const

const ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'vendorCode', 'productName'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type TaxFreeDocumentRow = {
  carrier?: string
  client?: string
  document: TaxFreeDocument
  packListNumber?: string
  responsible?: string
  status?: string
}

type DocumentsListState = {
  documents: TaxFreeDocument[]
  isLoading: boolean
  total?: number
}

type StoredFilters = {
  carrierNetId: string
  from: string
  status: string
  to: string
  value: string
}

type TaxFreeStatusDateField = 'ClosedDate' | 'DateOfIssue' | 'DateOfPrint' | 'DateOfTabulation' | 'FormedDate' | 'ReturnedDate'
type TaxFreeAccountingAction = TaxFreePaymentAction | 'outcome'
type TaxFreeDocumentDrawerTab = 'details' | 'status' | 'items'
type TaxFreeDocumentDetailsCarrierState = {
  carrierError: string | null
  isLoadingCarrier: boolean
  selectedCarrier: Statham | null
  selectedPassportId: string
}

function useTaxFreeDocumentsPageModel() {
  const { t } = useI18n()
  const restoredFilters = useMemo(() => readStoredFilters(), [])
  const statusOptions = useMemo(() => getTaxFreeStatusOptions(), [])
  const [documentsState, setDocumentsState] = useValueState<DocumentsListState>({
    documents: [],
    isLoading: false,
    total: undefined,
  })
  const [dateFrom, setDateFrom] = useValueState(restoredFilters.from)
  const [dateTo, setDateTo] = useValueState(restoredFilters.to)
  const [statusValue, setStatusValue] = useValueState(restoredFilters.status)
  const [searchDraft, setSearchDraft] = useValueState(restoredFilters.value)
  const [searchValue, setSearchValue] = useValueState(restoredFilters.value)
  const [carrierSearch, setCarrierSearch] = useValueState('')
  const [carrierOptions, setCarrierOptions] = useValueState<Statham[]>([])
  const [selectedCarrierNetId, setSelectedCarrierNetId] = useValueState(restoredFilters.carrierNetId)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [error, setError] = useValueState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useValueState<TaxFreeDocument | null>(null)
  const [previewDocument, setPreviewDocument] = useValueState<TaxFreeDocument | null>(null)
  const [accountingDocument, setAccountingDocument] = useValueState<TaxFreeDocument | null>(null)
  const [paymentAction, setPaymentAction] = useValueState<{ action: TaxFreePaymentAction; document: TaxFreeDocument } | null>(null)
  const [outcomeSource, setOutcomeSource] = useValueState<DocumentOutcomePaymentSource | null>(null)
  const [printingId, setPrintingId] = useValueState<string | number | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { documents, isLoading, total } = documentsState
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateFrom, dateTo)
  const selectedStatus = statusOptions.find((option) => option.value === statusValue)?.status ?? ''
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : documents.length === pageSize
  const rows = useMemo(() => documents.map(mapTaxFreeDocumentRow), [documents])
  const openDocument = useCallback(
    (document: TaxFreeDocument) => {
      setSelectedDocument(document)
    },
    [setSelectedDocument],
  )
  const openAccounting = useCallback(
    (document: TaxFreeDocument) => {
      setAccountingDocument(document)
    },
    [setAccountingDocument],
  )
  const handleAccountingActionSelected = useCallback(
    (action: TaxFreeAccountingAction) => {
      if (!accountingDocument) {
        return
      }

      if (action === 'outcome') {
        setOutcomeSource(buildTaxFreeOutcomeSource(accountingDocument))
      } else {
        setPaymentAction({ action, document: accountingDocument })
      }

      setAccountingDocument(null)
    },
    [accountingDocument, setAccountingDocument, setOutcomeSource, setPaymentAction],
  )
  const itemColumns = useTaxFreeItemColumns(selectedDocument?.TaxFreeItems ?? EMPTY_TAX_FREE_ITEMS)
  const columns = useTaxFreeDocumentColumns({
    onOpenCarrier: openDocument,
    onOpenAccounting: openAccounting,
    onOpenPreview: setPreviewDocument,
    onOpenStatus: openDocument,
    onOpenView: openDocument,
  })
  const carrierSelectOptions = useMemo(() => buildCarrierOptions(carrierOptions, selectedCarrierNetId), [
    carrierOptions,
    selectedCarrierNetId,
  ])
  useEffect(() => {
    writeStoredFilters({
      carrierNetId: selectedCarrierNetId,
      from: dateFrom,
      status: statusValue,
      to: dateTo,
      value: searchValue,
    })
  }, [dateFrom, dateTo, searchValue, selectedCarrierNetId, statusValue])

  useEffect(() => {
    let cancelled = false

    async function loadCarriers() {
      try {
        const nextCarriers = await searchTaxFreeCarriers(carrierSearch)

        if (!cancelled) {
          setCarrierOptions((currentCarriers) => mergeCarriers(currentCarriers, nextCarriers))
        }
      } catch {
        if (!cancelled) {
          setCarrierOptions([])
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void loadCarriers()
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [carrierSearch, setCarrierOptions])

  useEffect(() => {
    if (filterError) {
      setDocumentsState({
        documents: [],
        isLoading: false,
        total: undefined,
      })
      return
    }

    let cancelled = false

    async function loadDocuments() {
      setDocumentsState((currentState) => ({
        ...currentState,
        isLoading: true,
      }))
      setError(null)

      try {
        const response = await getTaxFreeDocuments({
          from: dateFrom,
          limit: pageSize,
          offset,
          status: selectedStatus,
          stathamNetId: selectedCarrierNetId,
          to: dateTo,
          value: searchValue,
        })

        if (!cancelled) {
          setDocumentsState({
            documents: response.Items,
            isLoading: false,
            total: response.Total,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setDocumentsState({
            documents: [],
            isLoading: false,
            total: undefined,
          })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити Tax Free'))
        }
      }
    }

    void loadDocuments()

    return () => {
      cancelled = true
    }
  }, [
    dateFrom,
    dateTo,
    filterError,
    offset,
    pageSize,
    reloadKey,
    searchValue,
    selectedCarrierNetId,
    selectedStatus,
    setDocumentsState,
    setError,
    t,
  ])

  function updateSearch(nextSearchValue: string) {
    setPage(1)
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetFilters() {
    const defaults = getDefaultFilters()

    setDateFrom(defaults.from)
    setDateTo(defaults.to)
    setStatusValue(defaults.status)
    setSearchDraft('')
    setSearchValue('')
    setSelectedCarrierNetId('')
    setPage(1)
    window.localStorage.removeItem(FILTER_STORAGE_KEY)
  }

  async function saveDocument(document: TaxFreeDocument) {
    setSaving(true)
    setError(null)

    try {
      const updatedDocument = await updateTaxFreeDocument(document)

      setDocumentsState((currentState) => ({
        ...currentState,
        documents: currentState.documents.map((currentDocument) =>
          getDocumentKey(currentDocument) === getDocumentKey(updatedDocument) ? updatedDocument : currentDocument,
        ),
      }))
      setSelectedDocument(updatedDocument)
      notifications.show({ color: 'green', message: t('Tax Free оновлено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося оновити Tax Free'))
    } finally {
      setSaving(false)
    }
  }

  async function printDocument(document: TaxFreeDocument) {
    const documentId = document.NetUid || document.Id

    if (!documentId) {
      return
    }

    setPrintingId(documentId)
    setError(null)

    try {
      const response = await printTaxFreeDocument(document)

      notifications.show({ color: 'green', message: response.Message || t('Tax Free відправлено на друк') })
      setPreviewDocument(null)
      reload()
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : t('Не вдалося надрукувати Tax Free'))
    } finally {
      setPrintingId(null)
    }
  }

  return {
    canMoveForward,
    accountingDocument,
    carrierSearch,
    carrierSelectOptions,
    columns,
    dateFrom,
    dateTo,
    error,
    filterError,
    isLoading,
    isSaving,
    itemColumns,
    outcomeSource,
    page,
    pageSize,
    paymentAction,
    previewDocument,
    printingId,
    rows,
    searchDraft,
    selectedCarrierNetId,
    selectedDocument,
    statusOptions,
    statusValue,
    closeDetails: () => setSelectedDocument(null),
    closeAccounting: () => setAccountingDocument(null),
    closeOutcome: () => setOutcomeSource(null),
    closePaymentAction: () => setPaymentAction(null),
    handleAccountingActionSelected,
    printDocument,
    reload,
    resetFilters,
    saveDocument,
    openDocument,
    setCarrierSearch,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
    setPreviewDocument,
    setSelectedCarrierNetId,
    setStatusValue,
    updateSearch,
  }
}

export function TaxFreeDocumentsPage() {
  const model = useTaxFreeDocumentsPageModel()

  return <TaxFreeDocumentsPageView model={model} />
}

function TaxFreeDocumentsPageView({ model }: { model: ReturnType<typeof useTaxFreeDocumentsPageModel> }) {
  const { t } = useI18n()
  const {
    accountingDocument,
    canMoveForward,
    carrierSearch,
    carrierSelectOptions,
    columns,
    dateFrom,
    dateTo,
    error,
    filterError,
    isLoading,
    isSaving,
    itemColumns,
    outcomeSource,
    page,
    pageSize,
    paymentAction,
    previewDocument,
    printingId,
    rows,
    searchDraft,
    selectedCarrierNetId,
    selectedDocument,
    statusOptions,
    statusValue,
    closeAccounting,
    closeDetails,
    closeOutcome,
    closePaymentAction,
    handleAccountingActionSelected,
    printDocument,
    reload,
    resetFilters,
    saveDocument,
    openDocument,
    setCarrierSearch,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
    setPreviewDocument,
    setSelectedCarrierNetId,
    setStatusValue,
    updateSearch,
  } = model

  return (
    <Stack className="tax-free-documents-page" gap={6}>
      <Card className="app-data-card tax-free-documents-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar tax-free-documents-filter-bar">
          <Group align="flex-end" gap="xs" wrap="nowrap" className="tax-free-documents-filter-row">
            <TextInput
              label={t('Від')}
              type="date"
              value={dateFrom}
              w={150}
              onChange={(event) => {
                setPage(1)
                setDateFrom(event.currentTarget.value)
              }}
            />
            <TextInput
              label={t('До')}
              type="date"
              value={dateTo}
              w={150}
              onChange={(event) => {
                setPage(1)
                setDateTo(event.currentTarget.value)
              }}
            />
            <Select
              clearable={false}
              data={statusOptions}
              label={t('Статус')}
              value={statusValue}
              w={180}
              onChange={(value) => {
                setPage(1)
                setStatusValue(value || 'all')
              }}
            />
            <Select
              clearable
              data={carrierSelectOptions}
              label={t('Перевізник')}
              placeholder={t('Пошук перевізника')}
              searchable
              searchValue={carrierSearch}
              value={selectedCarrierNetId}
              style={{ flex: '1 1 220px' }}
              onChange={(value) => {
                setPage(1)
                setSelectedCarrierNetId(value || '')
              }}
              onSearchChange={setCarrierSearch}
            />
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Номер Tax Free')}
              placeholder={t('Введіть номер')}
              value={searchDraft}
              style={{ flex: '1 1 220px' }}
              onChange={(event) => updateSearch(event.currentTarget.value)}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon variant="light" color="gray" size={34} aria-label={t('Скинути')} onClick={resetFilters}>
                  <IconRestore size={17} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                isLoading={isLoading}
                page={page}
                pageSize={pageSize}
                hasNext={canMoveForward}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPage(1)
                  setPageSize(nextPageSize)
                }}
                onRefresh={reload}
              />
            </div>
          </Group>
        </div>

        {(error || filterError) && (
          <Alert
            className="tax-free-documents-page__alert"
            color={filterError ? 'yellow' : 'red'}
            icon={<IconAlertCircle size={18} />}
            variant="light"
          >
            {filterError || error}
          </Alert>
        )}

        <div className="tax-free-documents-page__table">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={DOCUMENTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Tax Free не знайдено')}
            getRowId={(row, index) => String(row.document.NetUid || row.document.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="tax-free-documents-table-2"
            loadingText={t('Завантаження Tax Free')}
            minWidth={1540}
            showLayoutControls={false}
            showDensityToggle={false}
            tableId="tax-free-documents"
            onRowClick={(row) => openDocument(row.document)}
          />
        </div>
      </Card>

      <TaxFreeDocumentDrawer
        carrierOptions={carrierSelectOptions}
        document={selectedDocument}
        isSaving={isSaving}
        itemColumns={itemColumns}
        onCarrierSearch={setCarrierSearch}
        onClose={closeDetails}
        onPreview={setPreviewDocument}
        onSave={saveDocument}
      />

      <TaxFreePrintPreviewModal
        document={previewDocument}
        isPrinting={Boolean(printingId)}
        onClose={() => setPreviewDocument(null)}
        onPrint={printDocument}
      />

      <TaxFreeAccountingActionModal
        document={accountingDocument}
        opened={Boolean(accountingDocument)}
        onClose={closeAccounting}
        onSelect={handleAccountingActionSelected}
      />

      <TaxFreePaymentFromTaxFreeModal
        action={paymentAction?.action || null}
        document={paymentAction?.document || null}
        opened={Boolean(paymentAction)}
        onClose={closePaymentAction}
        onCreated={() => reload()}
      />

      <DocumentOutcomePaymentModal
        opened={Boolean(outcomeSource)}
        source={outcomeSource}
        onClose={closeOutcome}
        onCreated={() => reload()}
      />
    </Stack>
  )
}

function TaxFreeAccountingActionModal({
  document,
  opened,
  onClose,
  onSelect,
}: {
  document: TaxFreeDocument | null
  opened: boolean
  onClose: () => void
  onSelect: (action: TaxFreeAccountingAction) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Бухгалтерська дія')}</span>} onClose={onClose}>
      <Stack gap="md">
        {document ? (
          <Stack gap={2}>
            <Text size="sm">
              {t('Клієнт')}: {getTaxFreeClient(document)}
            </Text>
            <Text size="sm" c="dimmed">
              {t('Tax Free')}: {document.Number || document.NetUid}
            </Text>
            <Text size="sm">
              {t('Сума')}: {formatTaxFreeAmountPl(document.VatAmountPl)}
            </Text>
          </Stack>
        ) : null}

        <Stack gap="xs">
          <Button
            color={CREATE_ACTION_COLOR}
            justify="space-between"
            leftSection={<IconCash size={17} />}
            rightSection={<IconChevronRight size={16} />}
            variant="light"
            onClick={() => onSelect('advance')}
          >
            {t('Авансовий платіж')}
          </Button>
          <Button
            color="green"
            justify="space-between"
            leftSection={<IconCash size={17} />}
            rightSection={<IconChevronRight size={16} />}
            variant="light"
            onClick={() => onSelect('income')}
          >
            {t('Прибутковий касовий ордер')}
          </Button>
          <Button
            color="red"
            justify="space-between"
            leftSection={<IconCash size={17} />}
            rightSection={<IconChevronRight size={16} />}
            variant="light"
            onClick={() => onSelect('outcome')}
          >
            {t('Видатковий касовий ордер')}
          </Button>
        </Stack>
      </Stack>
    </AppModal>
  )
}

function useTaxFreeDocumentColumns({
  onOpenCarrier,
  onOpenAccounting,
  onOpenPreview,
  onOpenStatus,
  onOpenView,
}: {
  onOpenCarrier: (document: TaxFreeDocument) => void
  onOpenAccounting: (document: TaxFreeDocument) => void
  onOpenPreview: (document: TaxFreeDocument) => void
  onOpenStatus: (document: TaxFreeDocument) => void
  onOpenView: (document: TaxFreeDocument) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<TaxFreeDocumentRow>[]>(
    () => [
      {
        accessor: (row) => row.packListNumber,
        cell: (row) => <TaxFreeTableValue mono value={displayValue(row.packListNumber)} />,
        header: t('Номер пакувального'),
        id: 'packListNumber',
        width: 150,
      },
      {
        accessor: (row) => row.document.Number,
        cell: (row) => <TaxFreeTableValue mono value={displayValue(row.document.Number)} />,
        header: t('Номер Tax Free'),
        id: 'number',
        width: 150,
      },
      {
        accessor: (row) => row.document.DateOfPrint,
        cell: (row) => <TaxFreeTableValue mono value={formatDateTime(row.document.DateOfPrint)} />,
        header: t('Дата Tax Free'),
        id: 'dateOfPrint',
        width: 150,
      },
      {
        accessor: (row) => row.document.TotalWithVatPl,
        align: 'right',
        cell: (row) => <TaxFreeTableValue mono value={formatMoney(row.document.TotalWithVatPl)} />,
        header: t('Сума з ПДВ, місцева валюта'),
        id: 'amountPln',
        width: 130,
      },
      {
        accessor: (row) => row.document.VatAmountPl,
        align: 'right',
        cell: (row) => <TaxFreeTableValue mono value={formatMoney(row.document.VatAmountPl)} />,
        header: t('ПДВ, місцева валюта'),
        id: 'vatPln',
        width: 120,
      },
      {
        accessor: (row) => row.document.TotalWithVat,
        align: 'right',
        cell: (row) => <TaxFreeTableValue mono value={formatMoney(row.document.TotalWithVat)} />,
        header: t('Сума з ПДВ EUR'),
        id: 'amountEur',
        width: 130,
      },
      {
        accessor: (row) => row.document.TotalNetWeight,
        align: 'right',
        cell: (row) => <TaxFreeTableValue mono value={formatAmount(row.document.TotalNetWeight)} />,
        header: t('Вага'),
        id: 'weight',
        width: 95,
      },
      {
        accessor: (row) => row.client,
        cell: (row) => <TaxFreeTableValue value={displayValue(row.client)} />,
        header: t('Клієнт'),
        id: 'client',
        width: 160,
      },
      {
        accessor: (row) => row.carrier,
        cell: (row) => <TaxFreeTableValue value={displayValue(row.carrier)} />,
        header: t('Перевізник'),
        id: 'carrier',
        width: 170,
      },
      {
        cell: (row) => (
          <TaxFreeRowAction
            disabled={!row.document.Statham}
            icon={<IconTruckDelivery size={17} />}
            label={t('Переглянути перевізника')}
            onClick={() => onOpenCarrier(row.document)}
          />
        ),
        enableSorting: false,
        header: '',
        id: 'carrierAction',
        width: 54,
      },
      {
        accessor: (row) => row.responsible,
        cell: (row) => <TaxFreeTableValue value={displayValue(row.responsible)} />,
        header: t('Відповідальний'),
        id: 'responsible',
        width: 150,
      },
      {
        accessor: (row) => row.status,
        cell: (row) => (
          <Badge className={`app-role-pill ${getStatusPillClass(row.document.TaxFreeStatus)}`} variant="light">
            {row.status || t('Невідомо')}
          </Badge>
        ),
        header: t('Статус'),
        id: 'status',
        width: 150,
      },
      {
        cell: (row) => (
          <TaxFreeRowAction
            disabled={(row.document.TaxFreeStatus ?? TaxFreeStatus.NotFormed) < TaxFreeStatus.Printed}
            icon={<IconTimeline size={17} />}
            label={t('Панель статусів')}
            onClick={() => onOpenStatus(row.document)}
          />
        ),
        enableSorting: false,
        header: '',
        id: 'statusAction',
        width: 54,
      },
      {
        cell: (row) => {
          const availability = getTaxFreeAccountingAvailability(row.document, t)

          return (
            <TaxFreeRowAction
              disabled={!availability.canOpen}
              icon={<IconCash size={17} />}
              label={availability.label}
              onClick={() => onOpenAccounting(row.document)}
            />
          )
        },
        enableSorting: false,
        header: '',
        id: 'accountingAction',
        width: 54,
      },
      {
        accessor: (row) => row.document.ClosedDate,
        cell: (row) => <TaxFreeTableValue mono value={formatDateTime(row.document.ClosedDate)} />,
        header: t('Дата закриття TF'),
        id: 'closedDate',
        width: 150,
      },
      {
        cell: (row) => (
          <TaxFreeRowAction
            disabled={row.document.TaxFreeStatus !== TaxFreeStatus.Formed}
            icon={<IconPrinter size={17} />}
            label={t('Попередній перегляд друку')}
            onClick={() => onOpenPreview(row.document)}
          />
        ),
        enableSorting: false,
        header: '',
        id: 'printAction',
        width: 54,
      },
      {
        cell: (row) => (
          <TaxFreeRowAction icon={<IconEye size={17} />} label={t('Деталі')} onClick={() => onOpenView(row.document)} />
        ),
        enableSorting: false,
        header: '',
        id: 'viewAction',
        width: 54,
      },
    ],
    [onOpenAccounting, onOpenCarrier, onOpenPreview, onOpenStatus, onOpenView, t],
  )
}

function useTaxFreeItemColumns(items: TaxFreeItem[]) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<TaxFreeItem>[]>(
    () => [
      {
        cell: (row) => items.indexOf(row) + 1,
        header: '',
        id: 'index',
        width: 48,
      },
      {
        accessor: (row) => getTaxFreeItemProduct(row)?.VendorCode,
        header: t('Артикул'),
        id: 'vendorCode',
        width: 140,
      },
      {
        accessor: (row) => getTaxFreeItemProduct(row)?.Name,
        header: t('Товар'),
        id: 'productName',
        minWidth: 260,
      },
      {
        accessor: (row) => row.Qty,
        align: 'right',
        cell: (row) => formatAmount(row.Qty),
        header: t('Кількість'),
        id: 'qty',
        width: 120,
      },
      {
        accessor: (row) => row.TotalNetWeight,
        align: 'right',
        cell: (row) => formatAmount(row.TotalNetWeight),
        header: t('Вага'),
        id: 'weight',
        width: 100,
      },
      {
        accessor: (row) => row.UnitPriceWithVat,
        align: 'right',
        cell: (row) => formatMoney(row.UnitPriceWithVat),
        header: t('Ціна з ПДВ'),
        id: 'unitPriceWithVat',
        width: 130,
      },
      {
        accessor: (row) => row.TotalWithVat,
        align: 'right',
        cell: (row) => formatMoney(row.TotalWithVat),
        header: t('Разом EUR'),
        id: 'totalWithVat',
        width: 130,
      },
      {
        accessor: (row) => row.VatAmountPl,
        align: 'right',
        cell: (row) => formatMoney(row.VatAmountPl),
        header: t('ПДВ, місцева валюта'),
        id: 'vatAmountPl',
        width: 130,
      },
      {
        accessor: (row) => row.TotalWithVatPl,
        align: 'right',
        cell: (row) => formatMoney(row.TotalWithVatPl),
        header: t('Разом, місцева валюта'),
        id: 'totalWithVatPl',
        width: 130,
      },
    ],
    [items, t],
  )
}

/* Native title (§5: no per-cell Mantine <Tooltip>). */
function TaxFreeTableValue({ fw, mono, value }: { fw?: number; mono?: boolean; value: string }) {
  return (
    <Text
      component="span"
      fw={mono ? undefined : fw}
      style={mono ? TAX_FREE_TABLE_CELL_MONO_STYLE : TAX_FREE_TABLE_CELL_STYLE}
      title={value || undefined}
    >
      {value}
    </Text>
  )
}

/* Empty values render blank (§5), never a dash. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return String(value)
}

function TaxFreeDocumentDrawer({
  carrierOptions,
  document,
  isSaving,
  itemColumns,
  onCarrierSearch,
  onClose,
  onPreview,
  onSave,
}: {
  carrierOptions: { label: string; value: string }[]
  document: TaxFreeDocument | null
  isSaving: boolean
  itemColumns: DataTableColumn<TaxFreeItem>[]
  onCarrierSearch: (value: string) => void
  onClose: () => void
  onPreview: (document: TaxFreeDocument) => void
  onSave: (document: TaxFreeDocument) => void
}) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useValueState<TaxFreeDocumentDrawerTab>('details')

  return (
    <AppDrawer opened={Boolean(document)} position="right" size="min(1100px, 100vw)" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{getDrawerTitle(document, t)}</span>} onClose={onClose}>
      {document && (
        <div>
          <div className="pill-tabs" style={{ width: 'fit-content' }}>
            {([
              { value: 'details', label: t('Деталі') },
              { value: 'status', label: t('Статуси') },
              { value: 'items', label: t('Товари') },
            ] as const).map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`pill-tab${activeTab === tab.value ? ' is-active' : ''}`}
                aria-pressed={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <TaxFreeDocumentDetailsTab
              key={getTaxFreeDocumentDetailsKey(document)}
              carrierOptions={carrierOptions}
              document={document}
              isSaving={isSaving}
              onCarrierSearch={onCarrierSearch}
              onClose={onClose}
              onPreview={onPreview}
              onSave={onSave}
            />
          )}

          {activeTab === 'status' && (
          <Box pt="md">
            <TaxFreeStatusPanel document={document} isSaving={isSaving} onSave={onSave} />
          </Box>
          )}

          {activeTab === 'items' && (
          <Box pt="md">
            <DataTable
              columns={itemColumns}
              data={document.TaxFreeItems || []}
              defaultLayout={ITEMS_TABLE_DEFAULT_LAYOUT}
              emptyText={t('Товарів не знайдено')}
              getRowId={(row, index) => String(row.NetUid || row.Id || index)}
              layoutVersion="tax-free-items-table-1"
              maxHeight="calc(100vh - 260px)"
              minWidth={1120}
              tableId="tax-free-document-items"
            />
          </Box>
          )}
        </div>
      )}
    </AppDrawer>
  )
}

function TaxFreeDocumentDetailsTab({
  carrierOptions,
  document,
  isSaving,
  onCarrierSearch,
  onClose,
  onPreview,
  onSave,
}: {
  carrierOptions: { label: string; value: string }[]
  document: TaxFreeDocument
  isSaving: boolean
  onCarrierSearch: (value: string) => void
  onClose: () => void
  onPreview: (document: TaxFreeDocument) => void
  onSave: (document: TaxFreeDocument) => void
}) {
  const { t } = useI18n()
  const documentCarrierNetId = document.Statham?.NetUid || ''
  const documentPassportId = getTaxFreeDocumentPassportId(document)
  const [customCode, setCustomCode] = useValueState(document.CustomCode || '')
  const [amountPayedStatham, setAmountPayedStatham] = useValueState(getTaxFreeDocumentAmountPayedStatham(document))
  const [carrierState, setCarrierState] = useValueState<TaxFreeDocumentDetailsCarrierState>({
    carrierError: null,
    isLoadingCarrier: Boolean(documentCarrierNetId),
    selectedCarrier: document.Statham || null,
    selectedPassportId: documentPassportId,
  })
  const { carrierError, isLoadingCarrier, selectedCarrier, selectedPassportId } = carrierState
  const carrierNetId = selectedCarrier?.NetUid || ''
  const drawerCarrierOptions = useMemo(() => mergeCarrierSelectOption(carrierOptions, selectedCarrier), [
    carrierOptions,
    selectedCarrier,
  ])
  const passportOptions = useMemo(() => buildPassportOptions(selectedCarrier?.StathamPassports), [selectedCarrier])

  useEffect(() => {
    if (!documentCarrierNetId) {
      return
    }

    let cancelled = false
    const carrierNetId = documentCarrierNetId
    const carrierPassportId = documentPassportId

    async function loadCarrier() {
      try {
        const carrier = await getTaxFreeCarrier(carrierNetId)

        if (!cancelled) {
          setCarrierState((currentState) => {
            if (!carrier) {
              return {
                ...currentState,
                isLoadingCarrier: false,
              }
            }

            return {
              ...currentState,
              isLoadingCarrier: false,
              selectedCarrier: carrier,
              selectedPassportId: String(carrierPassportId || carrier.StathamPassports?.[0]?.Id || ''),
            }
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setCarrierState((currentState) => ({
            ...currentState,
            carrierError: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити паспортні дані перевізника'),
            isLoadingCarrier: false,
          }))
        }
      }
    }

    void loadCarrier()

    return () => {
      cancelled = true
    }
  }, [documentCarrierNetId, documentPassportId, setCarrierState, t])

  async function handleCarrierChange(netId: string | null) {
    if (!netId) {
      setCarrierState((currentState) => ({
        ...currentState,
        selectedCarrier: null,
        selectedPassportId: '',
      }))
      return
    }

    setCarrierState((currentState) => ({
      ...currentState,
      carrierError: null,
      isLoadingCarrier: true,
    }))

    try {
      const carrier = await getTaxFreeCarrier(netId)

      setCarrierState((currentState) => ({
        ...currentState,
        isLoadingCarrier: false,
        selectedCarrier: carrier,
        selectedPassportId: String(carrier?.StathamPassports?.[0]?.Id || ''),
      }))
    } catch (loadError) {
      setCarrierState((currentState) => ({
        ...currentState,
        carrierError: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити перевізника'),
        isLoadingCarrier: false,
      }))
    }
  }

  function handleSave() {
    const selectedPassport = selectedCarrier?.StathamPassports?.find((passport) => String(passport.Id) === selectedPassportId) || null
    const parsedAmount = Number(amountPayedStatham)

    onSave({
      ...document,
      AmountPayedStatham: Number.isFinite(parsedAmount) ? parsedAmount : document.AmountPayedStatham,
      CustomCode: customCode.trim(),
      Statham: selectedCarrier,
      StathamPassport: selectedPassport,
      StathamPassportId: selectedPassport?.Id || undefined,
    })
  }

  return (
    <Box pt="md">
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <ReadOnlyField label={t('Статус')} value={getTaxFreeStatusLabel(document.TaxFreeStatus)} />
          <ReadOnlyField label={t('Дата підбиття')} value={formatDateTime(document.DateOfTabulation)} />
          <ReadOnlyField label={t('Пакувальний лист')} value={document.TaxFreePackList?.Number} />
          <ReadOnlyField label={t('Відповідальний')} value={getTaxFreeResponsible(document)} />
          <TextInput label={t('Код')} value={customCode} onChange={(event) => setCustomCode(event.currentTarget.value)} />
          <TextInput
            label={t('Сума відправлення')}
            type="number"
            value={amountPayedStatham}
            onChange={(event) => setAmountPayedStatham(event.currentTarget.value)}
          />
          <Select
            clearable
            data={drawerCarrierOptions}
            label={t('Перевізник')}
            loading={isLoadingCarrier}
            searchable
            value={carrierNetId}
            onChange={handleCarrierChange}
            onSearchChange={onCarrierSearch}
          />
          <Select
            clearable
            data={passportOptions}
            disabled={!passportOptions.length}
            label={t('Паспорт перевізника')}
            value={selectedPassportId}
            onChange={(value) =>
              setCarrierState((currentState) => ({
                ...currentState,
                selectedPassportId: value || '',
              }))
            }
          />
        </SimpleGrid>

        {carrierError && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {carrierError}
          </Alert>
        )}

        <Divider />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <ReadOnlyField label={t('Клієнт')} value={getTaxFreeClient(document)} />
          <ReadOnlyField label={t('Сума EUR')} value={formatMoney(document.TotalWithVat)} />
          <ReadOnlyField label={t('Сума, місцева валюта')} value={formatMoney(document.TotalWithVatPl)} />
          <ReadOnlyField label={t('ПДВ, місцева валюта')} value={formatMoney(document.VatAmountPl)} />
          <ReadOnlyField label={t('Вага')} value={formatAmount(document.TotalNetWeight)} />
          <ReadOnlyField label={t('Ставка ПДВ')} value={document.VatPercent ? `${document.VatPercent}%` : ''} />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            disabled={document.TaxFreeStatus !== TaxFreeStatus.Formed}
            leftSection={<IconPrinter size={17} />}
            variant="default"
            onClick={() => onPreview(document)}
          >
            {t('Друк')}
          </Button>
          <Button loading={isSaving} onClick={handleSave}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </Box>
  )
}

function TaxFreeStatusPanel({
  document,
  isSaving,
  onSave,
}: {
  document: TaxFreeDocument
  isSaving: boolean
  onSave: (document: TaxFreeDocument) => void
}) {
  const { t } = useI18n()
  const [dateValue, setDateValue] = useValueState(toDateTimeInputValue(new Date()))
  const nextStatus = getNextStatus(document.TaxFreeStatus)
  const nextStatusField = getStatusDateField(nextStatus)
  const canAdvanceStatus = (document.TaxFreeStatus ?? TaxFreeStatus.NotFormed) >= TaxFreeStatus.Printed

  function handleSave() {
    onSave({
      ...document,
      TaxFreeStatus: nextStatus,
      [nextStatusField]: new Date(dateValue).toISOString(),
    })
  }

  return (
    <Stack gap="md">
      {canAdvanceStatus ? (
        <Card withBorder radius="sm" padding="md">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <ReadOnlyField label={t('Наступний статус')} value={getTaxFreeStatusLabel(nextStatus)} />
              <TextInput
                label={t('Дата')}
                type="datetime-local"
                value={dateValue}
                onChange={(event) => setDateValue(event.currentTarget.value)}
              />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button loading={isSaving} onClick={handleSave}>
                {t('Зберегти статус')}
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <Alert color="gray" variant="light">
          {t('Зміна статусу доступна після друку документа')}
        </Alert>
      )}

      <Stack gap="xs">
        {getStatusTimeline(document).map((item) => (
          <Group key={item.status} justify="space-between" p="sm" bg={item.active ? 'orange-0' : 'gray.0'} style={{ borderRadius: 6 }}>
            <Text fw={item.active ? 700 : 500}>{getTaxFreeStatusLabel(item.status)}</Text>
            <Text size="sm" c="dimmed">
              {formatDateTime(item.date) || '---'}
            </Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  )
}

function TaxFreePrintPreviewModal({
  document,
  isPrinting,
  onClose,
  onPrint,
}: {
  document: TaxFreeDocument | null
  isPrinting: boolean
  onClose: () => void
  onPrint: (document: TaxFreeDocument) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(document)} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{`${t('Попередній перегляд')} ${document?.Number || ''}`}</span>} onClose={onClose}>
      {document && (
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>{t('Ставка ПДВ')} 23%</Text>
            <Badge className={`app-role-pill ${getStatusPillClass(document.TaxFreeStatus)}`} variant="light">
              {getTaxFreeStatusLabel(document.TaxFreeStatus)}
            </Badge>
          </Group>

          <Table.ScrollContainer minWidth={620} mah={420}>
            <Table striped highlightOnHover withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Назва')}</Table.Th>
                  <Table.Th ta="right">{t('Кількість')}</Table.Th>
                  <Table.Th ta="right">{t('Ціна')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(document.TaxFreeItems || []).map((item, index) => (
                  <Table.Tr key={item.NetUid || item.Id || index}>
                    <Table.Td>{getTaxFreeItemProduct(item)?.NamePL || getTaxFreeItemProduct(item)?.Name || ''}</Table.Td>
                    <Table.Td ta="right">{formatAmount(item.Qty)}</Table.Td>
                    <Table.Td ta="right">{formatMoney(item.UnitPriceWithVat)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button leftSection={<IconPrinter size={17} />} loading={isPrinting} onClick={() => onPrint(document)}>
              {t('Друк')}
            </Button>
          </Group>
        </Stack>
      )}
    </AppModal>
  )
}

function TaxFreeRowAction({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Tooltip label={label}>
      <span>
        <ActionIcon
          aria-label={label}
          color="gray"
          disabled={disabled}
          size={30}
          style={disabled ? { pointerEvents: 'none' } : undefined}
          variant="subtle"
          onClick={(event) => {
            event.stopPropagation()
            onClick()
          }}
        >
          {icon}
        </ActionIcon>
      </span>
    </Tooltip>
  )
}

function ReadOnlyField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <Stack gap={3}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm">{value || '---'}</Text>
    </Stack>
  )
}

function buildTaxFreeOutcomeSource(document: TaxFreeDocument): DocumentOutcomePaymentSource {
  const client = document.TaxFreePackList?.Client

  return {
    amount: document.VatAmountPl || 0,
    clientName: getTaxFreeClient(document),
    clientNetId: client?.NetUid || '',
    created: document.Created,
    documentNetId: document.NetUid || '',
    type: 'taxfree',
  }
}

function getTaxFreeAccountingAvailability(document: TaxFreeDocument, t: (key: string) => string) {
  const packList = document.TaxFreePackList

  if (!document.NetUid) {
    return {
      canOpen: false,
      label: t('Немає NetUid Tax Free'),
    }
  }

  if (!packList) {
    return {
      canOpen: false,
      label: t('Немає пакувального листа'),
    }
  }

  if (!packList.IsSent) {
    return {
      canOpen: false,
      label: t('Пакувальний лист не відправлено'),
    }
  }

  if (!packList.ClientId && !packList.Client?.Id && !packList.Client?.NetUid) {
    return {
      canOpen: false,
      label: t('Немає клієнта'),
    }
  }

  if (!packList.ClientAgreementId) {
    return {
      canOpen: false,
      label: t('Немає договору'),
    }
  }

  return {
    canOpen: true,
    label: t('Створити бухгалтерський документ'),
  }
}

function mapTaxFreeDocumentRow(document: TaxFreeDocument): TaxFreeDocumentRow {
  return {
    carrier: getPersonName(document.Statham),
    client: getTaxFreeClient(document),
    document,
    packListNumber: document.TaxFreePackList?.Number,
    responsible: getTaxFreeResponsible(document),
    status: getTaxFreeStatusLabel(document.TaxFreeStatus),
  }
}

function getDefaultFilters(): StoredFilters {
  const to = new Date()

  return {
    carrierNetId: '',
    from: SYNC_DATA_RANGE_START,
    status: 'all',
    to: formatLocalDate(to),
    value: '',
  }
}

function readStoredFilters(): StoredFilters {
  const defaults = getDefaultFilters()

  try {
    const parsedFilters = JSON.parse(window.localStorage.getItem(FILTER_STORAGE_KEY) || 'null') as Partial<StoredFilters> | null

    return {
      carrierNetId: parsedFilters?.carrierNetId || defaults.carrierNetId,
      from: parsedFilters?.from || defaults.from,
      status: parsedFilters?.status || defaults.status,
      to: parsedFilters?.to || defaults.to,
      value: parsedFilters?.value || defaults.value,
    }
  } catch {
    return defaults
  }
}

function writeStoredFilters(filters: StoredFilters) {
  window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
}

function getFilterError(from: string, to: string) {
  if (!from || !to) {
    return 'Оберіть початкову та кінцеву дату'
  }

  if (from > to) {
    return 'Початкова дата має бути не пізніше кінцевої'
  }

  return null
}

function buildCarrierOptions(carriers: Statham[], selectedCarrierNetId: string) {
  const options: Array<{ label: string; value: string }> = []

  for (const carrier of carriers) {
    if (!carrier.NetUid) {
      continue
    }

    options.push({
      label: getPersonName(carrier) || carrier.NetUid || '',
      value: carrier.NetUid || '',
    })
  }

  if (selectedCarrierNetId && !options.some((option) => option.value === selectedCarrierNetId)) {
    options.push({
      label: selectedCarrierNetId,
      value: selectedCarrierNetId,
    })
  }

  return options
}

function mergeCarrierSelectOption(options: { label: string; value: string }[], carrier?: Statham | null) {
  if (!carrier?.NetUid || options.some((option) => option.value === carrier.NetUid)) {
    return options
  }

  return [
    ...options,
    {
      label: getPersonName(carrier) || carrier.NetUid,
      value: carrier.NetUid,
    },
  ]
}

function buildPassportOptions(passports?: StathamPassport[]) {
  const options: Array<{ label: string; value: string }> = []

  for (const passport of passports || []) {
    if (!passport.Id) {
      continue
    }

    options.push({
      label: [passport.PassportSeria, passport.PassportNumber].filter(Boolean).join(' ') || String(passport.Id),
      value: String(passport.Id),
    })
  }

  return options
}

function mergeCarriers(currentCarriers: Statham[], nextCarriers: Statham[]) {
  const carriersById = new Map<string, Statham>()

  currentCarriers.forEach((carrier) => {
    if (carrier.NetUid) {
      carriersById.set(carrier.NetUid, carrier)
    }
  })
  nextCarriers.forEach((carrier) => {
    if (carrier.NetUid) {
      carriersById.set(carrier.NetUid, carrier)
    }
  })

  return [...carriersById.values()]
}

/* §4 status pill: green success, orange attention, gray neutral (no blue/cyan). */
function getStatusPillClass(status?: TaxFreeStatus): string {
  switch (status) {
    case TaxFreeStatus.Closed:
      return 'is-green'
    case TaxFreeStatus.Returned:
    case TaxFreeStatus.Formed:
      return 'is-orange'
    case TaxFreeStatus.Tabulated:
    case TaxFreeStatus.Printed:
    case TaxFreeStatus.NotFormed:
    default:
      return 'is-gray'
  }
}

function getNextStatus(status?: TaxFreeStatus): TaxFreeStatus {
  const currentStatus = typeof status === 'number' ? status : TaxFreeStatus.NotFormed
  const nextStatus = currentStatus + 1

  return isTaxFreeStatus(nextStatus) ? nextStatus : TaxFreeStatus.Closed
}

function isTaxFreeStatus(status: number): status is TaxFreeStatus {
  return Object.values(TaxFreeStatus).includes(status as TaxFreeStatus)
}

function getStatusDateField(status: TaxFreeStatus): TaxFreeStatusDateField {
  switch (status) {
    case TaxFreeStatus.Formed:
      return 'DateOfIssue'
    case TaxFreeStatus.Printed:
      return 'DateOfPrint'
    case TaxFreeStatus.Tabulated:
      return 'DateOfTabulation'
    case TaxFreeStatus.Returned:
      return 'ReturnedDate'
    case TaxFreeStatus.Closed:
      return 'ClosedDate'
    case TaxFreeStatus.NotFormed:
    default:
      return 'FormedDate'
  }
}

function getStatusTimeline(document: TaxFreeDocument) {
  const statuses = [
    TaxFreeStatus.Formed,
    TaxFreeStatus.Printed,
    TaxFreeStatus.Tabulated,
    TaxFreeStatus.Returned,
    TaxFreeStatus.Closed,
  ]

  return statuses.map((status) => ({
    active: document.TaxFreeStatus === status,
    date: document[getStatusDateField(status)],
    status,
  }))
}

function getDocumentKey(document: TaxFreeDocument) {
  return document.NetUid || document.Id || document.Number
}

function getTaxFreeDocumentDetailsKey(document: TaxFreeDocument) {
  return [
    getDocumentKey(document) || '',
    document.Updated || '',
    document.CustomCode || '',
    getTaxFreeDocumentAmountPayedStatham(document),
    document.Statham?.NetUid || '',
    document.Statham?.Updated || '',
    getTaxFreeDocumentPassportId(document),
    document.StathamPassport?.Updated || '',
  ].join('|')
}

function getTaxFreeDocumentAmountPayedStatham(document: TaxFreeDocument) {
  return typeof document.AmountPayedStatham === 'number' ? String(document.AmountPayedStatham) : ''
}

function getTaxFreeDocumentPassportId(document: TaxFreeDocument) {
  return String(document.StathamPassportId || document.StathamPassport?.Id || '')
}

function getDrawerTitle(document: TaxFreeDocument | null, t: (key: string) => string) {
  if (!document) {
    return t('Tax Free')
  }

  return `${t('Tax Free')}: ${document.Number || ''}`
}

function formatDateTime(value?: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatAmount(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : ''
}

function formatMoney(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}

function toDateTimeInputValue(date: Date) {
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)

  return localDate.toISOString().slice(0, 16)
}
