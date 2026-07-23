import {
  ActionIcon,
  Alert,
  Autocomplete,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { Banknote, ChevronDown, CircleAlert, Landmark, Plus, RotateCcw, Search, Share2, Store, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { getAccountingCashFlowRecordPaymentStatus } from '../../accounting-cash-flow/accountingCashFlowPaymentStatus'
import { calculateAdvanceReportOrder } from '../../outgoing-cashflows/api/advanceReportApi'
import {
  cancelIncomeCashflow,
  getIncomeCashflowByNetId,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowCurrencies,
  getIncomeCashflowOrganizations,
  getIncomeCashflows,
  searchIncomeCashflowClientPayers,
  searchIncomeCashflowPaymentRegisters,
  updateIncomeCashflowClient,
} from '../api/incomeCashflowsApi'
import { IncomePaymentOperationType, PaymentRegisterType } from '../types'
import '../../../shared/ui/console-table-page.css'
import './income-cashflows-page.css'
import type {
  AssignedPaymentOrder,
  Client,
  ClientAgreement,
  Currency,
  IncomeCashflowRow,
  IncomePaymentOrder,
  IncomePaymentOrderSale,
  NamedEntity,
  Organization,
  OutcomePaymentOrder,
  PaymentRegister,
} from '../types'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350
const MAX_ORGANIZATION_QUERY_FILTER_IDS = 1800

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'number'],
    right: ['reassign', 'cancel', 'actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

type SelectOption = {
  label: string
  value: string
}

type IncomeDocumentStructureCalculationState = {
  calculatedOutcome: OutcomePaymentOrder | null
  error: string | null
  isCalculating: boolean
}

type IncomeDocumentStructureCalculationAction =
  | { type: 'error'; error: string }
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'success'; calculatedOutcome: OutcomePaymentOrder | null }

const INCOME_DOCUMENT_STRUCTURE_CALCULATION_IDLE: IncomeDocumentStructureCalculationState = {
  calculatedOutcome: null,
  error: null,
  isCalculating: false,
}

function useIncomeCashflowsPageModel(): IncomeCashflowsPageModel {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const focusedOrderNetId = searchParams.get('orderNetId') || searchParams.get('netId') || ''
  const [incomeOrders, setIncomeOrders] = useValueState<IncomePaymentOrder[]>([])
  const [currencies, setCurrencies] = useValueState<Currency[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useValueState<string[]>([])
  const [fromDate, setFromDate] = useValueState(() => readDateSearchParam(searchParams.get('from'), shiftDate(-7)))
  const [toDate, setToDate] = useValueState(() => readDateSearchParam(searchParams.get('to'), formatLocalDate(new Date())))
  const [searchValue, setSearchValue] = useValueState('')
  const [currencyNetId, setCurrencyNetId] = useValueState(() => searchParams.get('currencyNetId') || '')
  const [paymentRegisterNetId, setPaymentRegisterNetId] = useValueState(() => searchParams.get('registerNetId') || '')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingLookups, setLoadingLookups] = useValueState(false)
  const [hasMore, setHasMore] = useValueState(false)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [totalRowsQty, setTotalRowsQty] = useValueState<number | null>(null)
  const [selectedRow, setSelectedRow] = useValueState<IncomeCashflowRow | null>(null)
  const [selectedStructureCalculationState, dispatchSelectedStructureCalculation] = useReducer(
    incomeDocumentStructureCalculationReducer,
    INCOME_DOCUMENT_STRUCTURE_CALCULATION_IDLE,
  )
  const [cancelRow, setCancelRow] = useValueState<IncomeCashflowRow | null>(null)
  const [isCanceling, setCanceling] = useValueState(false)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const dateRangeError = getDateRangeError(fromDate, toDate)
  const requestRef = useRef(0)
  const structureCalculationRequestRef = useRef(0)
  const didInitOrganizationsRef = useRef(false)
  const dismissedFocusedOrderNetIdRef = useRef('')
  const focusedOrderRequestRef = useRef('')

  const organizationOptions = useMemo(
    () =>
      organizations
        .filter((organization) => organization.Id != null)
        .map((organization) => ({
          label: organization.Name || organization.FullName || String(organization.Id),
          value: String(organization.Id),
        })),
    [organizations],
  )
  const selectedOrganizationFilterIds = useMemo(
    () => getSelectedOrganizationFilterIds(selectedOrganizationIds, organizationOptions),
    [organizationOptions, selectedOrganizationIds],
  )
  const filterError = dateRangeError || getOrganizationFilterError(selectedOrganizationFilterIds.length, t)
  const [reassignRow, setReassignRow] = useValueState<IncomeCashflowRow | null>(null)

  const openIncomeDetails = useCallback(
    (row: IncomeCashflowRow) => {
      const outcomeToCalculate = getIncomeDocumentStructureOutcomeToCalculate(row.income)
      const requestId = structureCalculationRequestRef.current + 1
      structureCalculationRequestRef.current = requestId

      setSelectedRow(row)

      if (!outcomeToCalculate) {
        dispatchSelectedStructureCalculation({ type: 'idle' })
        return
      }

      dispatchSelectedStructureCalculation({ type: 'loading' })
      void calculateAdvanceReportOrder(outcomeToCalculate)
        .then((calculatedOrder) => {
          if (structureCalculationRequestRef.current === requestId) {
            dispatchSelectedStructureCalculation({ calculatedOutcome: calculatedOrder, type: 'success' })
          }
        })
        .catch((calculationLoadError: unknown) => {
          if (structureCalculationRequestRef.current === requestId) {
            dispatchSelectedStructureCalculation({
              error: calculationLoadError instanceof Error
                ? calculationLoadError.message
                : t('Не вдалося перерахувати структуру документів'),
              type: 'error',
            })
          }
        })
    },
    [setSelectedRow, t],
  )

  const rows = useMemo(() => buildIncomeCashflowRows(incomeOrders), [incomeOrders])
  const totalQty = totalRowsQty ?? incomeOrders.length

  const closeIncomeDetails = useCallback(() => {
    if (focusedOrderNetId && selectedRow?.income.NetUid === focusedOrderNetId) {
      dismissedFocusedOrderNetIdRef.current = focusedOrderNetId
    }

    structureCalculationRequestRef.current += 1
    setSelectedRow(null)
    dispatchSelectedStructureCalculation({ type: 'idle' })
  }, [focusedOrderNetId, selectedRow?.income.NetUid, setSelectedRow])

  const columns = useIncomeCashflowColumns({
    onCancel: setCancelRow,
    onOpen: openIncomeDetails,
    onReassign: setReassignRow,
  })
  const isTableBusy = isLoading || isSearchSettling

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true)

    try {
      const [nextCurrencies, nextRegisters, nextOrganizations] = await Promise.all([
        getIncomeCashflowCurrencies(),
        searchIncomeCashflowPaymentRegisters(''),
        getIncomeCashflowOrganizations(),
      ])

      setCurrencies(nextCurrencies)
      setPaymentRegisters(nextRegisters)
      setOrganizations(nextOrganizations)

      if (!didInitOrganizationsRef.current) {
        didInitOrganizationsRef.current = true
        setSelectedOrganizationIds(
          nextOrganizations.filter((organization) => organization.Id != null).map((organization) => String(organization.Id)),
        )
      }
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : t('Не вдалося завантажити довідники'))
    } finally {
      setLoadingLookups(false)
    }
  }, [setCurrencies, setError, setLoadingLookups, setOrganizations, setPaymentRegisters, setSelectedOrganizationIds, t])

  const loadIncomeOrders = useCallback(async (nextPage: number) => {
    if (filterError) {
      requestRef.current += 1
      setIncomeOrders([])
      setError(null)
      setHasMore(false)
      setTotalRowsQty(null)
      setLoading(false)
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    const offset = (nextPage - 1) * pageSize

    setLoading(true)
    setError(null)

    try {
      const nextOrders = await getIncomeCashflows({
        currencyNetId,
        from: fromDate,
        limit: pageSize,
        offset,
        organizationIds: selectedOrganizationFilterIds,
        registerNetId: paymentRegisterNetId,
        to: toDate,
        value: normalizedSearchValue,
      })

      if (requestRef.current === requestId) {
        setIncomeOrders(nextOrders)
        const responseTotalQty = nextOrders[0]?.TotalQty
        const nextTotalQty =
          typeof responseTotalQty === 'number' && Number.isFinite(responseTotalQty)
            ? responseTotalQty
            : null
        setTotalRowsQty(nextTotalQty)
        setHasMore(
          nextOrders.length === pageSize
          && (nextTotalQty === null || offset + nextOrders.length < nextTotalQty),
        )
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setIncomeOrders([])
        setHasMore(false)
        setTotalRowsQty(null)
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити прибуткові ордери'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [
    currencyNetId,
    filterError,
    fromDate,
    normalizedSearchValue,
    pageSize,
    paymentRegisterNetId,
    selectedOrganizationFilterIds,
    setError,
    setHasMore,
    setIncomeOrders,
    setLoading,
    setTotalRowsQty,
    t,
    toDate,
  ])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    setPage(1)
  }, [currencyNetId, fromDate, normalizedSearchValue, paymentRegisterNetId, selectedOrganizationFilterIds, setPage, toDate])

  useEffect(() => {
    void loadIncomeOrders(page)
  }, [loadIncomeOrders, page])

  useEffect(() => {
    if (
      !focusedOrderNetId ||
      isLoading ||
      dismissedFocusedOrderNetIdRef.current === focusedOrderNetId ||
      selectedRow?.income.NetUid === focusedOrderNetId
    ) {
      return
    }

    const focusedRow = rows.find((row) => row.income.NetUid === focusedOrderNetId)

    if (focusedRow) {
      openIncomeDetails(focusedRow)
      return
    }

    if (isLoading || focusedOrderRequestRef.current === focusedOrderNetId) {
      return
    }

    focusedOrderRequestRef.current = focusedOrderNetId
    const controller = new AbortController()

    void getIncomeCashflowByNetId(focusedOrderNetId, controller.signal)
      .then((incomeOrder) => {
        if (controller.signal.aborted || !incomeOrder || dismissedFocusedOrderNetIdRef.current === focusedOrderNetId) {
          return
        }

        const focusedLoadedRow = buildIncomeCashflowRows([incomeOrder])[0]

        if (focusedLoadedRow) {
          openIncomeDetails(focusedLoadedRow)
        }
      })
      .catch((focusLoadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(focusLoadError instanceof Error ? focusLoadError.message : t('Не вдалося завантажити прибутковий ордер'))
        }
      })

    return () => {
      controller.abort()
    }
  }, [focusedOrderNetId, isLoading, openIncomeDetails, rows, selectedRow?.income.NetUid, setError, t])

  const resetFilters = useCallback(() => {
    setFromDate(shiftDate(-7))
    setToDate(formatLocalDate(new Date()))
    setSearchValue('')
    setCurrencyNetId('')
    setPaymentRegisterNetId('')
    setSelectedOrganizationIds(organizationOptions.map((option) => option.value))
  }, [
    organizationOptions,
    setCurrencyNetId,
    setFromDate,
    setPaymentRegisterNetId,
    setSearchValue,
    setSelectedOrganizationIds,
    setToDate,
  ])

  const handleCancel = useCallback(async () => {
    if (!cancelRow?.income.NetUid) {
      return
    }

    setCanceling(true)
    setError(null)

    try {
      await cancelIncomeCashflow(cancelRow.income.NetUid)
      setCancelRow(null)
      void loadIncomeOrders(page)
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати прибутковий ордер'))
    } finally {
      setCanceling(false)
    }
  }, [cancelRow, loadIncomeOrders, page, setCancelRow, setCanceling, setError, t])

  return {
    cancelRow,
    columns,
    currencies,
    currencyNetId,
    error,
    filterError,
    fromDate,
    hasMore,
    incomeOrders,
    isCanceling,
    isLoading,
    isLoadingLookups,
    isTableBusy,
    organizationOptions,
    page,
    pageSize,
    paymentRegisterNetId,
    paymentRegisters,
    reassignRow,
    rows,
    searchValue,
    selectedOrganizationIds,
    selectedRow,
    selectedStructureCalculationState,
    toDate,
    totalQty,
    totalRowsQty,
    onCancel: handleCancel,
    onCloseCancel: () => setCancelRow(null),
    onCloseDetails: closeIncomeDetails,
    onCloseReassign: () => setReassignRow(null),
    onLoadIncomeOrders: loadIncomeOrders,
    onLoadLookups: loadLookups,
    onOpenDetails: openIncomeDetails,
    onReassignFromDetails: (row) => {
      closeIncomeDetails()
      setReassignRow(row)
    },
    onReassignSaved: () => {
      setReassignRow(null)
      void loadIncomeOrders(page)
    },
    onResetFilters: resetFilters,
    onSetCurrencyNetId: setCurrencyNetId,
    onSetFromDate: setFromDate,
    onSetPage: setPage,
    onSetPageSize: setPageSize,
    onSetPaymentRegisterNetId: setPaymentRegisterNetId,
    onSetSearchValue: setSearchValue,
    onSetSelectedOrganizationIds: setSelectedOrganizationIds,
    onSetToDate: setToDate,
  }
}

export function IncomeCashflowsPage() {
  const model = useIncomeCashflowsPageModel()

  return <IncomeCashflowsContent model={model} />
}

type IncomeCashflowsPageModel = {
  cancelRow: IncomeCashflowRow | null
  columns: DataTableColumn<IncomeCashflowRow>[]
  currencies: Currency[]
  currencyNetId: string
  error: string | null
  filterError: string | null
  fromDate: string
  hasMore: boolean
  incomeOrders: IncomePaymentOrder[]
  isCanceling: boolean
  isLoading: boolean
  isLoadingLookups: boolean
  isTableBusy: boolean
  organizationOptions: SelectOption[]
  page: number
  pageSize: number
  paymentRegisterNetId: string
  paymentRegisters: PaymentRegister[]
  reassignRow: IncomeCashflowRow | null
  rows: IncomeCashflowRow[]
  searchValue: string
  selectedOrganizationIds: string[]
  selectedRow: IncomeCashflowRow | null
  selectedStructureCalculationState: IncomeDocumentStructureCalculationState
  toDate: string
  totalQty: number
  totalRowsQty: number | null
  onCancel: () => void
  onCloseCancel: () => void
  onCloseDetails: () => void
  onCloseReassign: () => void
  onLoadIncomeOrders: (page: number) => Promise<void>
  onLoadLookups: () => Promise<void>
  onOpenDetails: (row: IncomeCashflowRow) => void
  onReassignFromDetails: (row: IncomeCashflowRow) => void
  onReassignSaved: () => void
  onResetFilters: () => void
  onSetCurrencyNetId: (value: string) => void
  onSetFromDate: (value: string) => void
  onSetPage: (page: number) => void
  onSetPageSize: (pageSize: number) => void
  onSetPaymentRegisterNetId: (value: string) => void
  onSetSearchValue: (value: string) => void
  onSetSelectedOrganizationIds: (value: string[]) => void
  onSetToDate: (value: string) => void
}

function IncomeCashflowsContent({ model }: { model: IncomeCashflowsPageModel }) {
  const {
    cancelRow,
    columns,
    currencies,
    currencyNetId,
    error,
    filterError,
    fromDate,
    hasMore,
    incomeOrders,
    isCanceling,
    isLoading,
    isLoadingLookups,
    isTableBusy,
    organizationOptions,
    page,
    pageSize,
    paymentRegisterNetId,
    paymentRegisters,
    reassignRow,
    rows,
    searchValue,
    selectedOrganizationIds,
    selectedRow,
    selectedStructureCalculationState,
    toDate,
    totalQty,
    totalRowsQty,
    onCancel,
    onCloseCancel,
    onCloseDetails,
    onCloseReassign,
    onLoadIncomeOrders,
    onLoadLookups,
    onOpenDetails,
    onReassignFromDetails,
    onReassignSaved,
    onResetFilters,
    onSetCurrencyNetId,
    onSetFromDate,
    onSetPage,
    onSetPageSize,
    onSetPaymentRegisterNetId,
    onSetSearchValue,
    onSetSelectedOrganizationIds,
    onSetToDate,
  } = model
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  return (
    <Stack className="income-cashflows-page console-table-page" gap={6}>
      <div className="console-table-shell income-cashflows-card">
        <div className="app-filter-bar income-cashflows-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="income-cashflows-filter-row">
            <div className="app-filter-date-range">
              <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => onSetFromDate(event.currentTarget.value)} />
              <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => onSetToDate(event.currentTarget.value)} />
            </div>
            <TextInput
              leftSection={<Search size={16} />}
              label={t('Пошук')}
              placeholder={t('Номер, платник, рахунок або коментар')}
              value={searchValue}
              w={170}
              onChange={(event) => onSetSearchValue(event.currentTarget.value)}
            />
            <Select
              clearable
              searchable
              data={toSelectOptions(currencies, (currency) => currency.Name || currency.Code)}
              label={t('Валюта')}
              placeholder={t('Усі')}
              value={currencyNetId || null}
              w={190}
              onChange={(value) => onSetCurrencyNetId(value || '')}
            />
            <Select
              clearable
              searchable
              data={toSelectOptions(paymentRegisters, (register) => register.Name)}
              label={t('Рахунок')}
              placeholder={t('Усі')}
              value={paymentRegisterNetId || null}
              w={220}
              onChange={(value) => onSetPaymentRegisterNetId(value || '')}
            />
            <CheckboxMultiSelect
              className="income-cashflows-organization-filter"
              data={organizationOptions}
              label={t('Організації')}
              placeholder={t('Без фільтра')}
              value={selectedOrganizationIds}
              onChange={onSetSelectedOrganizationIds}
            />

            <div className="app-filter-actions income-cashflows-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={onResetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                hasNext={hasMore}
                isLoading={isLoading || isLoadingLookups}
                page={page}
                pageSize={pageSize}
                totalPages={typeof totalRowsQty === 'number' ? Math.max(1, Math.ceil(totalRowsQty / pageSize)) : undefined}
                onPageChange={onSetPage}
                onPageSizeChange={(nextPageSize) => {
                  onSetPage(1)
                  onSetPageSize(nextPageSize)
                }}
                onRefresh={() => {
                  void onLoadLookups()
                  void onLoadIncomeOrders(page)
                }}
              />
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
            <div className="income-cashflows-create-actions">
              <Menu classNames={{ dropdown: 'income-cashflows-create-menu' }} position="bottom-end" shadow="md" width={300} withinPortal>
                <Menu.Target>
                  <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<Plus size={16} />} rightSection={<ChevronDown size={14} />} styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}>
                    {t('Новий')}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('Каса')}</Menu.Label>
                  <Menu.Item leftSection={<Banknote size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/conversion?type=0', { state: { backgroundLocation: location } })}>
                    {t('Інший касовий прихід')}
                  </Menu.Item>
                  <Menu.Item leftSection={<Banknote size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/client?type=0&operationType=0', { state: { backgroundLocation: location } })}>
                    {t('Оплата покупця')}
                  </Menu.Item>
                  <Menu.Item leftSection={<Banknote size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/client?type=0&operationType=1', { state: { backgroundLocation: location } })}>
                    {t('Повернення постачальника')}
                  </Menu.Item>
                  <Menu.Item leftSection={<Banknote size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/client?type=0&operationType=2', { state: { backgroundLocation: location } })}>
                    {t('Інші з контрагентами')}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Label>{t('Банк')}</Menu.Label>
                  <Menu.Item leftSection={<Landmark size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/conversion?type=2', { state: { backgroundLocation: location } })}>
                    {t('Інші надходження на рахунок')}
                  </Menu.Item>
                  <Menu.Item leftSection={<Landmark size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/client?type=2&operationType=0', { state: { backgroundLocation: location } })}>
                    {t('Оплата покупця')}
                  </Menu.Item>
                  <Menu.Item leftSection={<Landmark size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/client?type=2&operationType=1', { state: { backgroundLocation: location } })}>
                    {t('Повернення постачальника')}
                  </Menu.Item>
                  <Menu.Item leftSection={<Landmark size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/client?type=2&operationType=2', { state: { backgroundLocation: location } })}>
                    {t('Інші з контрагентами')}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Label>{t('Колеги')}</Menu.Label>
                  <Menu.Item leftSection={<Users size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/user', { state: { backgroundLocation: location } })}>
                    {t('Повернення від колеги')}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Label>{t('Магазин')}</Menu.Label>
                  <Menu.Item leftSection={<Store size={15} />} onClick={() => navigate('/accounting/income-cashflows/new/shop', { state: { backgroundLocation: location } })}>
                    {t('Оплата магазину')}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
          </Group>
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {filterError && (
          <Alert className="console-table-alert" color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {filterError}
          </Alert>
        )}

        <div className="income-cashflows-page__table console-table-body">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Прибуткових ордерів не знайдено')}
            getRowId={(row) => row.id}
            isLoading={isTableBusy}
            layoutVersion="income-cashflows-1"
            minWidth={1680}
            showLayoutControls
            tableId="income-cashflows"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={onOpenDetails}
          />
        </div>

        <IncomeCashflowsSummary
          canceledQty={incomeOrders.filter((order) => order.IsCanceled).length}
          loadedQty={incomeOrders.length}
          totalQty={totalQty}
        />
      </div>

      <IncomeCashflowDetailDrawer
        row={selectedRow}
        structureCalculation={selectedStructureCalculationState}
        onClose={onCloseDetails}
        onReassign={onReassignFromDetails}
      />
      <CancelIncomeCashflowModal
        isSaving={isCanceling}
        row={cancelRow}
        onCancel={onCancel}
        onClose={onCloseCancel}
      />
      <ReassignIncomeClientModal
        row={reassignRow}
        onClose={onCloseReassign}
        onSaved={onReassignSaved}
      />
    </Stack>
  )
}

function IncomeCashflowsSummary({
  canceledQty,
  loadedQty,
  totalQty,
}: {
  canceledQty: number
  loadedQty: number
  totalQty: number
}) {
  const { t } = useI18n()

  return (
    <Group className="income-cashflows-summary" gap="xs" justify="flex-end" wrap="nowrap">
      <Badge className="app-role-pill is-gray" variant="light">
        {t('Завантажено')}: {loadedQty}
      </Badge>
      <Badge className="app-role-pill is-gray" variant="light">
        {t('Всього')}: {totalQty}
      </Badge>
      <Badge className={`app-role-pill ${canceledQty > 0 ? 'is-red' : 'is-gray'}`} variant="light">
        {t('Скасовано')}: {canceledQty}
      </Badge>
    </Group>
  )
}

function useIncomeCashflowColumns({
  onCancel,
  onOpen,
  onReassign,
}: {
  onCancel: (row: IncomeCashflowRow) => void
  onOpen: (row: IncomeCashflowRow) => void
  onReassign: (row: IncomeCashflowRow) => void
}): DataTableColumn<IncomeCashflowRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<IncomeCashflowRow>[]>(
    () => [
      {
        id: 'accounting',
        header: t('Бух.'),
        width: 74,
        minWidth: 70,
        align: 'center',
        accessor: (row) => row.isAccounting,
        cell: (row) => <StatusFlag active={row.isAccounting} />,
      },
      {
        id: 'management',
        header: t('Упр.'),
        width: 74,
        minWidth: 70,
        align: 'center',
        accessor: (row) => row.isManagementAccounting,
        cell: (row) => <StatusFlag active={row.isManagementAccounting} />,
      },
      {
        id: 'fromDate',
        header: t('Дата'),
        width: 145,
        minWidth: 130,
        accessor: (row) => row.fromDate,
        cell: (row) => (
          <Text size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
            {formatDateTime(row.fromDate)}
          </Text>
        ),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 135,
        minWidth: 115,
        accessor: (row) => row.number,
        cell: (row) => (
          <Group gap={6} wrap="nowrap">
            <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0, textTransform: 'uppercase' }}>
              {displayValue(row.number)}
            </Text>
            {row.isCanceled && (
              <Badge className="app-role-pill is-red" size="xs" variant="light">
                {t('Скасовано')}
              </Badge>
            )}
          </Group>
        ),
      },
      {
        id: 'payer',
        header: t('Платник'),
        width: 300,
        minWidth: 220,
        accessor: (row) => row.payer,
        cell: (row) => <PayerCell row={row} />,
      },
      {
        id: 'operationType',
        header: t('Тип операції'),
        width: 210,
        minWidth: 160,
        accessor: (row) => row.operationType,
        cell: (row) => displayValue(row.operationType),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => (
          <Text className="app-money" size="sm" ta="right">
            {formatMoney(row.amount)}
          </Text>
        ),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 90,
        minWidth: 80,
        accessor: (row) => row.currency,
        cell: (row) => displayValue(row.currency),
      },
      {
        id: 'paymentMovement',
        header: t('Стаття руху'),
        width: 230,
        minWidth: 170,
        accessor: (row) => row.paymentMovement,
        cell: (row) => displayValue(row.paymentMovement),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 190,
        minWidth: 150,
        accessor: (row) => row.organization,
        cell: (row) => displayValue(row.organization),
      },
      {
        id: 'paymentRegister',
        header: t('Рахунок'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.paymentRegister,
        cell: (row) => displayValue(row.paymentRegister),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 160,
        minWidth: 130,
        accessor: (row) => row.responsible,
        cell: (row) => displayValue(row.responsible),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 240,
        minWidth: 180,
        accessor: (row) => row.comment,
        cell: (row) => displayValue(row.comment),
      },
      {
        id: 'reassign',
        header: '',
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) =>
          isClientPaymentReassignable(row.income) ? (
            <TableRowAction
              action="reassign"
              label={t('Переназначити клієнта')}
              onClick={(event) => {
                event.stopPropagation()
                onReassign(row)
              }}
            />
          ) : null,
      },
      {
        id: 'cancel',
        header: '',
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => {
          const cancelUnavailableReason = getIncomeCancelUnavailableReason(row.income, t)

          return (
          <TableRowAction
            action="cancel"
            disabled={Boolean(cancelUnavailableReason)}
            hint={cancelUnavailableReason || undefined}
            label={t('Скасувати')}
            onClick={(event) => {
              event.stopPropagation()
              onCancel(row)
            }}
          />
          )
        },
      },
      {
        id: 'actions',
        header: '',
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <TableRowAction
            action="details"
            label={t('Деталі')}
            onClick={(event) => {
              event.stopPropagation()
              onOpen(row)
            }}
          />
        ),
      },
    ],
    [onCancel, onOpen, onReassign, t],
  )
}

function IncomeCashflowDetailDrawer({
  row,
  structureCalculation,
  onClose,
  onReassign,
}: {
  row: IncomeCashflowRow | null
  structureCalculation: IncomeDocumentStructureCalculationState
  onClose: () => void
  onReassign: (row: IncomeCashflowRow) => void
}) {
  const { t } = useI18n()
  const income = row?.income
  const orderSales = income?.IncomePaymentOrderSales || []

  return (
    <AppDrawer
      opened={Boolean(row)}
      padding="md"
      size="xl"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{getIncomePaymentOrderTitle(income, t)}</span>}
      onClose={onClose}
    >
      {row && income && (
        <Stack gap="md">
          {isClientPaymentReassignable(income) && (
            <Group justify="flex-end">
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Share2 size={16} />}
                variant="outline"
                onClick={() => onReassign(row)}
              >
                {t('Переназначити клієнта')}
              </Button>
            </Group>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Дата')} mono value={formatDateTime(income.FromDate)} />
            <DetailItem label={t('Номер')} mono value={displayValue(income.Number)} />
            <DetailItem
              label={t('Платник')}
              value={displayValue(
                income.Colleague && (income.AssignedPaymentOrders?.length || 0) > 0
                  ? joinTruthyParts(row.payer, t('Повернення'))
                  : row.payer,
              )}
            />
            <DetailItem label={t('Тип операції')} value={displayValue(row.operationType)} />
            <DetailItem label={t('Сума')} mono value={formatMoney(income.Amount)} />
            <DetailItem label={t('Валюта')} value={displayValue(income.Currency?.Code || income.Currency?.Name)} />
            <DetailItem label={t('Стаття руху')} value={displayValue(row.paymentMovement)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Рахунок')} value={displayValue(row.paymentRegister)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Курс')} mono value={displayValue(income.ExchangeRate)} />
            <DetailItem label={t('Сума в EUR')} mono value={hasNumber(income.EuroAmount) ? formatMoney(income.EuroAmount) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ %')} mono value={hasNumber(income.VatPercent) ? displayValue(income.VatPercent) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ')} mono value={hasNumber(income.VAT) ? formatMoney(income.VAT) : displayValue(undefined)} />
            <DetailItem label={t('Бухгалтерський')} value={income.IsAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Управлінський')} value={income.IsManagementAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Скасовано')} value={income.IsCanceled ? t('Так') : t('Ні')} />
            <DetailItem label={t('Призначення платежу')} value={displayValue(income.PaymentPurpose)} />
            <DetailItem label={t('Вхідний номер')} value={displayValue(income.ArrivalNumber)} />
            <DetailItem label={t('Договір')} value={displayValue(getIncomeAgreementName(income))} />
            <DetailItem
              label={t('Сума у валюті договору')}
              mono
              value={hasNumber(income.AgreementExchangedAmount) ? formatMoney(income.AgreementExchangedAmount) : displayValue(undefined)}
            />
          </SimpleGrid>

          <Stack gap={2}>
            <Text c="dimmed" size="xs" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{displayValue(income.Comment)}</Text>
          </Stack>

          {orderSales.length > 0 && (
            <>
              <Divider />
              <IncomeOrderSalesSection currency={income.Currency?.Code || income.Currency?.Name} sales={orderSales} />
            </>
          )}

          {hasIncomeDocumentStructure(income) && (
            <>
              <Divider />
              <IncomeDocumentStructure income={income} structureCalculation={structureCalculation} />
            </>
          )}
        </Stack>
      )}
    </AppDrawer>
  )
}

function IncomeOrderSalesSection({
  currency,
  sales,
}: {
  currency?: string
  sales: IncomePaymentOrderSale[]
}) {
  const { t } = useI18n()

  return (
    <Stack gap="xs">
      <Text className="app-section-title" fw={600} size="sm">{t('Рахунки та продажі')}</Text>
      {sales.map((sale, index) => (
        <IncomeOrderSaleBlock
          key={getIncomeOrderSaleKey(sale, index)}
          currency={currency}
          sale={sale}
        />
      ))}
    </Stack>
  )
}

function IncomeOrderSaleBlock({
  currency,
  sale,
}: {
  currency?: string
  sale: IncomePaymentOrderSale
}) {
  const { t } = useI18n()
  const saleDocument = sale.Sale || sale.ReSale || null
  const amount = firstNumber(sale.Amount, saleDocument?.TotalAmount, saleDocument?.TotalAmountLocal)

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <DetailItem label={t('Тип')} value={sale.ReSale ? t('Ресейл') : t('Продаж')} />
      <DetailItem label={t('Дата')} mono value={formatDateTime(sale.Created || saleDocument?.Created)} />
      <DetailItem label={t('Номер рахунку')} mono value={displayValue(saleDocument?.SaleNumber?.Value)} />
      <DetailItem label={t('Сума')} mono value={formatMoneyWithCurrency(amount, currency)} />
      <Stack gap={2}>
        <Text c="dimmed" size="xs" tt="uppercase">
          {t('Оплата')}
        </Text>
        <IncomePaymentStatusBadge value={saleDocument} />
      </Stack>
    </SimpleGrid>
  )
}

function IncomePaymentStatusBadge({ value }: { value: unknown }) {
  const { t } = useI18n()
  const status = getAccountingCashFlowRecordPaymentStatus(value)

  if (!status) {
    return (
      <Text c="dimmed" size="sm">
        {displayValue(undefined)}
      </Text>
    )
  }

  const pillClass =
    status.kind === 'paid' ? 'is-green'
    : status.kind === 'unpaid' ? 'is-red'
    : status.kind === 'partial' ? 'is-yellow'
    : 'is-gray'

  return (
    <Badge className={`app-role-pill ${pillClass}`} size="sm" variant="light">
      {t(status.label)}
    </Badge>
  )
}

function incomeDocumentStructureCalculationReducer(
  _state: IncomeDocumentStructureCalculationState,
  action: IncomeDocumentStructureCalculationAction,
): IncomeDocumentStructureCalculationState {
  switch (action.type) {
    case 'error':
      return {
        calculatedOutcome: null,
        error: action.error,
        isCalculating: false,
      }
    case 'loading':
      return {
        calculatedOutcome: null,
        error: null,
        isCalculating: true,
      }
    case 'success':
      return {
        calculatedOutcome: action.calculatedOutcome,
        error: null,
        isCalculating: false,
      }
    case 'idle':
    default:
      return INCOME_DOCUMENT_STRUCTURE_CALCULATION_IDLE
  }
}

function IncomeDocumentStructure({
  income,
  structureCalculation,
}: {
  income: IncomePaymentOrder
  structureCalculation: IncomeDocumentStructureCalculationState
}) {
  const { t } = useI18n()
  const rootAssignedOrder = income.RootAssignedPaymentOrder && !income.RootAssignedPaymentOrder.Deleted
    ? income.RootAssignedPaymentOrder
    : null
  const assignedOrders = getActiveIncomeAssignedPaymentOrders(income.AssignedPaymentOrders)
  const outcomeToCalculate = getIncomeDocumentStructureOutcomeToCalculate(income)
  const calculatedOutcomeKey = getOutcomeOrderKey(outcomeToCalculate)
  const calculatedTotal = structureCalculation.calculatedOutcome?.Amount
  const getCalculatedTotalForAssignedOrder = (assignedOrder: AssignedPaymentOrder): number | undefined =>
    calculatedOutcomeKey && getOutcomeOrderKey(getIncomeAssignedOutcome(assignedOrder)) === calculatedOutcomeKey
      ? calculatedTotal
      : undefined

  return (
    <Stack gap="sm">
      <Text className="app-section-title" fw={600} size="sm">{t('Структура документів')}</Text>

      {structureCalculation.isCalculating && (
        <Alert color="gray" variant="light">
          {t('Перерахунок структури документів...')}
        </Alert>
      )}

      {structureCalculation.error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {structureCalculation.error}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DetailItem label={t('Прибутковий ордер')} value={displayValue(income.Number)} />
        <DetailItem label={t('Дата')} mono value={formatDateTime(income.FromDate)} />
        <DetailItem label={t('Сума')} value={formatMoneyWithCurrency(income.Amount, income.Currency?.Code || income.Currency?.Name)} />
        <DetailItem
          label={t('Перерахована сума')}
          value={hasNumber(calculatedTotal) ? formatMoneyWithCurrency(calculatedTotal, getOutcomeCurrency(outcomeToCalculate)) : displayValue(undefined)}
        />
        <DetailItem label={t('Платник')} value={displayValue(getIncomePayerName(income))} />
      </SimpleGrid>

      {rootAssignedOrder && (
        <IncomeAssignedPaymentOrderBlock
          assignedOrder={rootAssignedOrder}
          calculatedTotal={getCalculatedTotalForAssignedOrder(rootAssignedOrder)}
          title={t('Кореневий документ')}
        />
      )}

      {assignedOrders.length > 0 ? (
        assignedOrders.map((assignedOrder, index) => (
          <IncomeAssignedPaymentOrderBlock
            key={getAssignedKey(assignedOrder, index)}
            assignedOrder={assignedOrder}
            calculatedTotal={getCalculatedTotalForAssignedOrder(assignedOrder)}
            title={`${t('Пов’язаний документ')} ${index + 1}`}
          />
        ))
      ) : !rootAssignedOrder ? (
        <Text c="dimmed" size="sm">
          {t('Структура документів відсутня')}
        </Text>
      ) : null}
    </Stack>
  )
}

function IncomeAssignedPaymentOrderBlock({
  assignedOrder,
  calculatedTotal,
  title,
}: {
  assignedOrder: AssignedPaymentOrder
  calculatedTotal?: number
  title: string
}) {
  const { t } = useI18n()
  const outcome = getIncomeAssignedOutcome(assignedOrder)

  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">{title}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DetailItem label={t('Номер зв’язки')} value={displayValue(assignedOrder.Number)} />
        <DetailItem label={t('Сума зв’язки')} value={formatMoney(assignedOrder.Amount)} />
        <DetailItem
          label={t('Сума авансового звіту')}
          value={hasNumber(calculatedTotal) ? formatMoneyWithCurrency(calculatedTotal, getOutcomeCurrency(outcome)) : displayValue(undefined)}
        />
      </SimpleGrid>

      {outcome ? (
        <IncomeAssignedOutcomeOrderView order={outcome} />
      ) : (
        <Text c="dimmed" size="sm">
          {t('Пов’язаний видатковий документ не завантажено')}
        </Text>
      )}
    </Stack>
  )
}

function IncomeAssignedOutcomeOrderView({ order }: { order: OutcomePaymentOrder }) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <DetailItem label={t('Документ')} value={getOutcomePaymentOrderTypeLabel(order, t)} />
      <DetailItem label={t('Номер')} value={displayValue(order.Number || order.CustomNumber || order.AdvanceNumber)} />
      <DetailItem label={t('Авансовий звіт')} value={displayValue(order.AdvanceNumber)} />
      <DetailItem label={t('Дата')} value={formatDateTime(order.FromDate)} />
      <DetailItem label={t('Сума')} value={formatMoneyWithCurrency(order.Amount, getOutcomeCurrency(order))} />
      <DetailItem label={t('Отримувач')} value={displayValue(getOutcomePayedTo(order))} />
    </SimpleGrid>
  )
}

function CancelIncomeCashflowModal({
  isSaving,
  row,
  onCancel,
  onClose,
}: {
  isSaving: boolean
  row: IncomeCashflowRow | null
  onCancel: () => void
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(row)} title={t('Скасувати прибутковий ордер')} onClose={onClose}>
      <Stack gap="md">
        <Text>
          {t('Скасувати ордер')} <Text span fw={600}>{row?.number || t('Без номера')}</Text>?
        </Text>
        <Group justify="flex-end">
          <Button disabled={isSaving} variant="default" onClick={onClose}>
            {t('Ні')}
          </Button>
          <Button color="red" leftSection={<X size={16} />} loading={isSaving} onClick={onCancel}>
            {t('Скасувати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function ReassignIncomeClientModal({
  row,
  onClose,
  onSaved,
}: {
  row: IncomeCashflowRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useI18n()
  const [searchValue, setSearchValue] = useValueState('')
  const [clients, setClients] = useValueState<Client[]>([])
  const [selectedClientValue, setSelectedClientValue] = useValueState('')
  const [clientAgreements, setClientAgreements] = useValueState<ClientAgreement[]>([])
  const [selectedAgreementValue, setSelectedAgreementValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const [debouncedSearch] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)

  const opened = Boolean(row)

  const counterpartyOptions = useMemo(() => toSelectOptions(clients, getEntityName), [clients])

  const agreementOptions = useMemo(
    () => toClientAgreementOptions(clientAgreements),
    [clientAgreements],
  )

  const resetReassignForm = useCallback(() => {
    setSearchValue('')
    setClients([])
    setSelectedClientValue('')
    setClientAgreements([])
    setSelectedAgreementValue('')
    setError(null)
  }, [
    setClientAgreements,
    setClients,
    setError,
    setSearchValue,
    setSelectedAgreementValue,
    setSelectedClientValue,
  ])

  const handleClose = useCallback(() => {
    resetReassignForm()
    onClose()
  }, [onClose, resetReassignForm])

  const handleSaved = useCallback(() => {
    resetReassignForm()
    onSaved()
  }, [onSaved, resetReassignForm])

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadCounterparties = async () => {
      const value = debouncedSearch.trim()

      if (!value) {
        if (!cancelled) {
          setClients([])
        }
        return
      }

      const result = await searchIncomeCashflowClientPayers(value, controller.signal).catch((searchError) => {
        if (!cancelled) {
          setError(searchError instanceof Error ? searchError.message : 'Не вдалося завантажити клієнтів')
        }

        return []
      })
      if (!cancelled) {
        setClients(result)
      }
    }

    void loadCounterparties()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedSearch, opened, setClients, setError])

  useEffect(() => {
    let cancelled = false

    const loadAgreements = async () => {
      if (!selectedClientValue) {
        if (!cancelled) {
          setClientAgreements([])
          setSelectedAgreementValue('')
        }
        return
      }

      const result = await getIncomeCashflowClientAgreements(selectedClientValue).catch((agreementsError) => {
        if (!cancelled) {
          setError(agreementsError instanceof Error ? agreementsError.message : 'Не вдалося завантажити договори')
        }

        return []
      })
      if (!cancelled) {
        setClientAgreements(result)
      }
    }

    void loadAgreements()

    return () => {
      cancelled = true
    }
  }, [selectedClientValue, setClientAgreements, setSelectedAgreementValue, setError])

  const handleSubmit = useCallback(async () => {
    const incomeNetId = row?.income.NetUid

    if (!incomeNetId || !selectedClientValue || !selectedAgreementValue) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateIncomeCashflowClient({
        clientAgreementNetId: selectedAgreementValue,
        clientNetId: selectedClientValue,
        incomeNetId,
      })
      handleSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося переназначити клієнта'))
    } finally {
      setSaving(false)
    }
  }, [handleSaved, row, selectedAgreementValue, selectedClientValue, setError, setSaving, t])

  return (
    <AppModal
      centered
      opened={opened}
      title={
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {row?.number ? `${t('Переназначити клієнта')} — ${row.number}` : t('Переназначити клієнта')}
        </span>
      }
      onClose={handleClose}
    >
      <Stack gap="md">

        <Autocomplete
          data={counterpartyOptions.map((option) => option.label)}
          disabled={isSaving}
          label={t('Клієнт')}
          placeholder={t('Почніть вводити назву')}
          value={searchValue}
          onChange={setSearchValue}
          onOptionSubmit={(label) => {
            const option = counterpartyOptions.find((item) => item.label === label)
            if (option) {
              setSelectedClientValue(option.value)
              setSelectedAgreementValue('')
            }
          }}
        />

        <Select
          data={agreementOptions}
          disabled={!agreementOptions.length || isSaving}
          label={t('Договір')}
          placeholder={t('Оберіть договір')}
          searchable
          value={selectedAgreementValue || null}
          onChange={(value) => setSelectedAgreementValue(value || '')}
        />

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="light" onClick={handleClose}>
            {t('Скасувати')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={!selectedClientValue || !selectedAgreementValue}
            leftSection={<Share2 size={16} />}
            loading={isSaving}
            onClick={() => void handleSubmit()}
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function isClientPaymentReassignable(income: IncomePaymentOrder): boolean {
  return Number(income.OperationType) === IncomePaymentOperationType.ClientPayment && !income.IsCanceled && Boolean(income.NetUid)
}

function StatusFlag({ active }: { active?: boolean }) {
  return active ? (
    <Badge className="app-role-pill is-green" size="xs" variant="light">
      Так
    </Badge>
  ) : (
    <Text c="dimmed" size="sm">
      -
    </Text>
  )
}

function PayerCell({ row }: { row: IncomeCashflowRow }) {
  const { t } = useI18n()

  return (
    <Group gap={6} wrap="nowrap">
      <Text size="sm">{displayValue(row.payer)}</Text>
      {row.rootAssigned && (
        <Badge className="app-role-pill" size="xs" variant="light">
          {t('Повернення')}
        </Badge>
      )}
    </Group>
  )
}

/* §5.1: dates, numbers and money render mono — pass `mono` for those values. */
function DetailItem({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={mono ? 600 : undefined} size="sm" style={mono ? { fontFamily: 'var(--font-mono)', letterSpacing: 0 } : undefined}>
        {value}
      </Text>
    </Stack>
  )
}

function buildIncomeCashflowRows(incomeOrders: IncomePaymentOrder[]): IncomeCashflowRow[] {
  return incomeOrders
    .toSorted((left, right) => (right.FromDate || '').localeCompare(left.FromDate || ''))
    .map((income, index) => ({
      amount: income.Amount,
      comment: income.Comment,
      currency: income.Currency?.Code || income.Currency?.Name,
      fromDate: income.FromDate,
      id: String(income.NetUid || income.Id || index),
      income,
      isAccounting: income.IsAccounting,
      isCanceled: income.IsCanceled,
      isManagementAccounting: income.IsManagementAccounting,
      number: income.Number,
      operationType: getIncomeOperationTypeName(income),
      organization: getEntityName(income.Organization),
      payer: getIncomePayerName(income),
      paymentMovement: income.PaymentMovementOperation?.PaymentMovement?.OperationName,
      paymentRegister: income.PaymentRegister?.Name,
      responsible: getEntityName(income.User),
      rootAssigned: hasIncomeDocumentStructure(income),
    }))
}

function getIncomePayerName(income: IncomePaymentOrder): string | undefined {
  if (income.Client) {
    return getEntityName(income.Client)
  }

  if (income.Colleague) {
    return joinTruthyParts(income.Colleague.FirstName, income.Colleague.LastName) || getEntityName(income.Colleague)
  }

  return getEntityName(income.SupplyOrganization)
}

function getIncomeOperationTypeName(income: IncomePaymentOrder): string {
  if (income.OperationTypeName?.trim()) {
    return income.OperationTypeName
  }

  switch (Number(income.OperationType)) {
    case IncomePaymentOperationType.ClientPayment:
      return 'Оплата покупця'
    case IncomePaymentOperationType.SupplierReturn:
      return 'Повернення постачальника'
    case IncomePaymentOperationType.OtherAccountingWithCounterparts:
      return 'Інші з контрагентами'
    case IncomePaymentOperationType.OtherIncome:
      return 'Інший прихід'
    case IncomePaymentOperationType.ReturnFromColleague:
      return 'Повернення від колеги'
    default:
      return 'Невідомий тип операції'
  }
}

function getIncomeCancelUnavailableReason(income: IncomePaymentOrder, t: (key: string) => string): string | null {
  if (income.IsCanceled) {
    return t('Уже скасовано')
  }

  if (!income.NetUid) {
    return t('Документ недоступний для скасування')
  }

  if (!isSameLocalDate(income.Created, new Date())) {
    return t('Скасування доступне тільки в день створення')
  }

  return null
}

function isSameLocalDate(value: unknown, target: Date): boolean {
  const date = parseDateValue(value)

  if (!date) {
    return false
  }

  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  )
}

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value !== 'string' || !value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function hasIncomeDocumentStructure(income: IncomePaymentOrder): boolean {
  return Boolean(
    (income.RootAssignedPaymentOrder && !income.RootAssignedPaymentOrder.Deleted) ||
    getActiveIncomeAssignedPaymentOrders(income.AssignedPaymentOrders).length > 0,
  )
}

function getIncomeDocumentStructureOutcomeToCalculate(income: IncomePaymentOrder): OutcomePaymentOrder | null {
  const rootOutcome = getIncomeAssignedOutcome(income.RootAssignedPaymentOrder)

  if (rootOutcome && !rootOutcome.Deleted) {
    return rootOutcome
  }

  return getActiveIncomeAssignedPaymentOrders(income.AssignedPaymentOrders)
    .map(getIncomeAssignedOutcome)
    .find((outcome): outcome is OutcomePaymentOrder => Boolean(outcome && !outcome.Deleted)) || null
}

function getActiveIncomeAssignedPaymentOrders(orders?: AssignedPaymentOrder[]): AssignedPaymentOrder[] {
  return (orders || []).filter((assignedOrder) => !assignedOrder.Deleted)
}

function getIncomeAssignedOutcome(assignedOrder?: AssignedPaymentOrder | null): OutcomePaymentOrder | null {
  return assignedOrder?.AssignedOutcomePaymentOrder || assignedOrder?.RootOutcomePaymentOrder || null
}

function getOutcomeOrderKey(order?: OutcomePaymentOrder | null): string {
  return String(order?.NetUid || order?.Id || order?.Number || order?.CustomNumber || order?.AdvanceNumber || '')
}

function getIncomeAgreementName(income: IncomePaymentOrder): string | undefined {
  const clientAgreement = income.ClientAgreement?.Agreement

  if (clientAgreement) {
    return joinTruthyParts(clientAgreement.Name || clientAgreement.Number, clientAgreement.Currency?.Code || clientAgreement.Currency?.Name)
  }

  const supplyAgreement = income.SupplyOrganizationAgreement

  if (supplyAgreement) {
    return joinTruthyParts(supplyAgreement.Name || supplyAgreement.Number, supplyAgreement.Currency?.Code || supplyAgreement.Currency?.Name)
  }

  return undefined
}

function getIncomePaymentOrderTitle(income: IncomePaymentOrder | undefined, t: (value: string) => string): string {
  const registerType = income?.PaymentRegister?.Type

  if (registerType === PaymentRegisterType.Cash) {
    return t('Прибутковий касовий ордер')
  }

  if (registerType === PaymentRegisterType.Bank) {
    return t('Прибутковий банківський ордер')
  }

  if (registerType === PaymentRegisterType.Card) {
    return t('Прибутковий картковий ордер')
  }

  return t('Прибутковий ордер')
}

function getOutcomePaymentOrderTypeLabel(order: OutcomePaymentOrder, t: (value: string) => string): string {
  if (order.IsUnderReport) {
    return t('Авансовий звіт')
  }

  const registerType = order.PaymentCurrencyRegister?.PaymentRegister?.Type ?? order.PaymentRegister?.Type

  if (registerType === PaymentRegisterType.Cash) {
    return t('Видатковий касовий ордер')
  }

  if (registerType === PaymentRegisterType.Bank) {
    return t('Видатковий банківський ордер')
  }

  if (registerType === PaymentRegisterType.Card) {
    return t('Видатковий картковий ордер')
  }

  return order.OperationTypeName || t('Видатковий ордер')
}

function getOutcomeCurrency(order: OutcomePaymentOrder | null): string | undefined {
  return order?.PaymentCurrencyRegister?.Currency?.Code
    || order?.PaymentCurrencyRegister?.Currency?.Name
}

function getOutcomePayedTo(order: OutcomePaymentOrder): string | undefined {
  return getEntityName(order.Client)
    || getPersonFullName(order.Colleague)
    || getEntityName(order.Organization)
    || getEntityName(order.User)
}

function getPersonFullName(person?: NamedEntity | null): string | undefined {
  return joinTruthyParts(person?.FirstName, person?.LastName, person?.MiddleName) || getEntityName(person)
}

function toSelectOptions<T extends NamedEntity>(items: T[], labelGetter: (item: T) => string | undefined): SelectOption[] {
  const options: SelectOption[] = []

  for (const item of items) {
    const value = getEntityOptionValue(item)

    if (value) {
      options.push({
        label: labelGetter(item) || getEntityName(item) || value,
        value,
      })
    }
  }

  return options
}

function toClientAgreementOptions(clientAgreements: ClientAgreement[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const clientAgreement of clientAgreements) {
    const agreement = clientAgreement.Agreement
    const value = getEntityOptionValue(clientAgreement)

    if (value) {
      options.push({
        label: joinTruthyParts(agreement?.Name || agreement?.Number, agreement?.Currency?.Code || agreement?.Currency?.Name),
        value,
      })
    }
  }

  return options
}

function toFiniteNumberIds(values: string[]): number[] {
  const ids: number[] = []

  for (const value of values) {
    const id = Number(value)

    if (Number.isFinite(id)) {
      ids.push(id)
    }
  }

  return ids
}

function getSelectedOrganizationFilterIds(selectedIds: string[], allOptions: SelectOption[]): number[] {
  if (selectedIds.length === 0 || selectedIds.length >= allOptions.length) {
    return []
  }

  return toFiniteNumberIds(selectedIds)
}

function getOrganizationFilterError(selectedFilterCount: number, t: (value: string) => string): string | null {
  if (selectedFilterCount <= MAX_ORGANIZATION_QUERY_FILTER_IDS) {
    return null
  }

  return t('Забагато організацій у фільтрі. Оберіть усі організації або звузьте вибір.')
}

function joinTruthyParts(...parts: Array<string | undefined>): string {
  const nextParts: string[] = []

  for (const part of parts) {
    if (part) {
      nextParts.push(part)
    }
  }

  return nextParts.join(' ')
}

function getEntityOptionValue(entity: { Id?: number; NetUid?: string }): string {
  return String(entity.NetUid || entity.Id || '')
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName || entity?.LastName || entity?.Name || entity?.OperationName || entity?.Code
}

function getAssignedKey(assignedOrder: { NetUid?: string; Id?: number }, index: number): string {
  return String(assignedOrder.NetUid || assignedOrder.Id || `assigned-${index}`)
}

function getIncomeOrderSaleKey(sale: IncomePaymentOrderSale, index: number): string {
  const saleDocument = sale.Sale || sale.ReSale

  return String(sale.NetUid || sale.Id || saleDocument?.NetUid || saleDocument?.Id || `income-sale-${index}`)
}

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function readDateSearchParam(value: string | null, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

function getDateRangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) {
    return 'Вкажіть період'
  }

  if (fromDate > toDate) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function formatMoney(value?: number): string {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0

  return moneyFormatter.format(amount)
}

function formatMoneyWithCurrency(value?: number, currency?: string): string {
  if (!hasNumber(value)) {
    return displayValue(undefined)
  }

  const formatted = formatMoney(value)

  return currency ? `${formatted} ${currency}` : formatted
}

function firstNumber(...values: Array<number | undefined>): number | undefined {
  return values.find(hasNumber)
}

function hasNumber(value?: number): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}
