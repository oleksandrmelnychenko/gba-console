import {
  ActionIcon,
  Alert,
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
import { Ban, Banknote, ChevronDown, CircleAlert, Eye, Landmark, ListChecks, Network, Plus, RotateCcw, Search, SquarePen } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import {
  buildOutgoingRegisterItems,
  buildOutgoingStandaloneItems,
} from '../outgoingCreateMenu'
import { PaymentRegisterType } from '../../income-cashflows/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { calculateAdvanceReportOrder } from '../api/advanceReportApi'
import {
  cancelOutgoingCashflow,
  getOutgoingCashflowByNetId,
  getOutgoingCashflowCurrencies,
  getOutgoingCashflowOrganizations,
  getOutgoingCashflowPaymentMovements,
  getOutgoingCashflows,
  searchOutgoingCashflowPaymentRegisters,
} from '../api/outgoingCashflowsApi'
import type {
  AssignedIncomePaymentOrder,
  AssignedPaymentOrder,
  ConsumablesOrder,
  Currency,
  NamedEntity,
  Organization,
  OutcomePaymentOrder,
  OutgoingCashflowRow,
  OutgoingCashflowsResponse,
  PaymentMovement,
  PaymentRegister,
} from '../types'
import '../../../shared/ui/console-table-page.css'
import './outgoing-cashflows-page.css'

const PAGE_SIZE = 40
const SEARCH_DEBOUNCE_MS = 350
const MAX_ORGANIZATION_QUERY_FILTER_IDS = 1800

const ADVANCE_REPORT_ROUTE = '/accounting/outgoing-cashflow'

const TABLE_DEFAULT_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function useOutgoingCashflowsPageModel(): OutgoingCashflowsPageModel {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const [searchParams] = useSearchParams()
  const focusedOrderNetId = searchParams.get('orderNetId') || searchParams.get('netId') || ''
  const [cashflows, setCashflows] = useValueState<OutgoingCashflowsResponse>({
    Collection: [],
    NegativeDifferenceAmount: 0,
    PositiveDifferenceAmount: 0,
  })
  const [currencies, setCurrencies] = useValueState<Currency[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useValueState<string[]>([])
  const [fromDate, setFromDate] = useValueState(() => readDateSearchParam(searchParams.get('from'), shiftDate(-7)))
  const [toDate, setToDate] = useValueState(() => readDateSearchParam(searchParams.get('to'), formatLocalDate(new Date())))
  const [searchValue, setSearchValue] = useValueState('')
  const [currencyNetId, setCurrencyNetId] = useValueState(() => searchParams.get('currencyNetId') || '')
  const [paymentRegisterNetId, setPaymentRegisterNetId] = useValueState(() => searchParams.get('registerNetId') || '')
  const [paymentMovementNetId, setPaymentMovementNetId] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingLookups, setLoadingLookups] = useValueState(false)
  const [hasMore, setHasMore] = useValueState(false)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [totalRowsQty, setTotalRowsQty] = useValueState<number | null>(null)
  const [selectedRow, setSelectedRow] = useValueState<OutgoingCashflowRow | null>(null)
  const [structureRow, setStructureRow] = useValueState<OutgoingCashflowRow | null>(null)
  const [structureCalculatedOrder, setStructureCalculatedOrder] = useValueState<OutcomePaymentOrder | null>(null)
  const [structureCalculationError, setStructureCalculationError] = useValueState<string | null>(null)
  const [isCalculatingStructure, setCalculatingStructure] = useValueState(false)
  const [cancelRow, setCancelRow] = useValueState<OutgoingCashflowRow | null>(null)
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

  const organizationOptions = useMemo(() => toOrganizationOptions(organizations), [organizations])
  const selectedOrganizationFilterIds = useMemo(
    () => getSelectedOrganizationFilterIds(selectedOrganizationIds, organizationOptions),
    [organizationOptions, selectedOrganizationIds],
  )
  const filterError = dateRangeError || getOrganizationFilterError(selectedOrganizationFilterIds.length, t)

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true)

    try {
      const [nextCurrencies, nextRegisters, nextMovements, nextOrganizations] = await Promise.all([
        getOutgoingCashflowCurrencies(),
        searchOutgoingCashflowPaymentRegisters(''),
        getOutgoingCashflowPaymentMovements(),
        getOutgoingCashflowOrganizations(),
      ])

      setCurrencies(nextCurrencies)
      setPaymentRegisters(nextRegisters)
      setPaymentMovements(nextMovements)
      setOrganizations(nextOrganizations)

      if (!didInitOrganizationsRef.current) {
        didInitOrganizationsRef.current = true
        setSelectedOrganizationIds(toOrganizationOptions(nextOrganizations).map((option) => option.value))
      }
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : t('Не вдалося завантажити довідники'))
    } finally {
      setLoadingLookups(false)
    }
  }, [
    setCurrencies,
    setError,
    setLoadingLookups,
    setOrganizations,
    setPaymentMovements,
    setPaymentRegisters,
    setSelectedOrganizationIds,
    t,
  ])

  const loadCashflows = useCallback(async (nextPage: number) => {
    if (filterError) {
      requestRef.current += 1
      setCashflows({
        Collection: [],
        NegativeDifferenceAmount: 0,
        PositiveDifferenceAmount: 0,
      })
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
      const nextCashflows = await getOutgoingCashflows({
        currencyNetId,
        from: fromDate,
        limit: pageSize,
        offset,
        organizationIds: selectedOrganizationFilterIds,
        paymentMovementNetId,
        registerNetId: paymentRegisterNetId,
        to: toDate,
        value: normalizedSearchValue,
      })

      if (requestRef.current === requestId) {
        setCashflows(nextCashflows)
        const loadedQty = offset + nextCashflows.Collection.length
        const responseTotalRowsQty = nextCashflows.TotalRowsQty
        const nextTotalQty =
          typeof responseTotalRowsQty === 'number' && Number.isFinite(responseTotalRowsQty)
            ? responseTotalRowsQty
            : null
        setTotalRowsQty(nextTotalQty)
        setHasMore(nextCashflows.Collection.length === pageSize && (nextTotalQty === null || loadedQty < nextTotalQty))
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setCashflows({
          Collection: [],
          NegativeDifferenceAmount: 0,
          PositiveDifferenceAmount: 0,
        })
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити видаткові ордери'))
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
    paymentMovementNetId,
    paymentRegisterNetId,
    selectedOrganizationFilterIds,
    setCashflows,
    setError,
    setHasMore,
    setLoading,
    setTotalRowsQty,
    t,
    toDate,
  ])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  // Any filter change restarts from the first page (loadCashflows identity change reloads).
  useEffect(() => {
    setPage(1)
  }, [currencyNetId, fromDate, normalizedSearchValue, paymentMovementNetId, paymentRegisterNetId, selectedOrganizationFilterIds, setPage, toDate])

  useEffect(() => {
    void loadCashflows(page)
  }, [loadCashflows, page])

  const openAdvanceReport = useCallback(
    (row: OutgoingCashflowRow) => {
      if (row.order.NetUid) {
        navigate(`${ADVANCE_REPORT_ROUTE}/${encodeURIComponent(row.order.NetUid)}/advanced-report/view`, {
          state: {
            backgroundLocation: location,
            returnPath: `${location.pathname}${location.search}`,
          },
        })
      }
    },
    [location, navigate],
  )

  const openDocumentStructure = useCallback(
    (row: OutgoingCashflowRow) => {
      const orderToCalculate = getDocumentStructureOutcomeToCalculate(row.order)
      const requestId = structureCalculationRequestRef.current + 1
      structureCalculationRequestRef.current = requestId

      setStructureRow(row)
      setStructureCalculatedOrder(null)
      setStructureCalculationError(null)

      if (!orderToCalculate) {
        setCalculatingStructure(false)
        return
      }

      setCalculatingStructure(true)
      void calculateAdvanceReportOrder(orderToCalculate)
        .then((calculatedOrder) => {
          if (structureCalculationRequestRef.current === requestId) {
            setStructureCalculatedOrder(calculatedOrder)
          }
        })
        .catch((calculationError: unknown) => {
          if (structureCalculationRequestRef.current === requestId) {
            setStructureCalculationError(
              calculationError instanceof Error
                ? calculationError.message
                : t('Не вдалося перерахувати структуру документів'),
            )
          }
        })
        .finally(() => {
          if (structureCalculationRequestRef.current === requestId) {
            setCalculatingStructure(false)
          }
        })
    },
    [
      setCalculatingStructure,
      setStructureCalculatedOrder,
      setStructureCalculationError,
      setStructureRow,
      t,
    ],
  )

  const closeDocumentStructure = useCallback(() => {
    structureCalculationRequestRef.current += 1
    setStructureRow(null)
    setStructureCalculatedOrder(null)
    setStructureCalculationError(null)
    setCalculatingStructure(false)
  }, [setCalculatingStructure, setStructureCalculatedOrder, setStructureCalculationError, setStructureRow])

  const openCashflowDetails = useCallback(
    (row: OutgoingCashflowRow) => {
      setSelectedRow(row)
    },
    [setSelectedRow],
  )

  const rows = useMemo(() => buildCashflowRows(cashflows.Collection), [cashflows.Collection])
  const closeCashflowDetails = useCallback(() => {
    if (focusedOrderNetId && selectedRow?.order.NetUid === focusedOrderNetId) {
      dismissedFocusedOrderNetIdRef.current = focusedOrderNetId
    }

    setSelectedRow(null)
  }, [focusedOrderNetId, selectedRow?.order.NetUid, setSelectedRow])
  const columns = useOutgoingCashflowColumns({
    onCancel: setCancelRow,
    onEditReport: openAdvanceReport,
    onOpenDocumentStructure: openDocumentStructure,
    onOpen: openCashflowDetails,
  })
  const isTableBusy = isLoading || isSearchSettling

  useEffect(() => {
    if (
      !focusedOrderNetId ||
      isLoading ||
      dismissedFocusedOrderNetIdRef.current === focusedOrderNetId ||
      selectedRow?.order.NetUid === focusedOrderNetId
    ) {
      return
    }

    const focusedRow = rows.find((row) => row.order.NetUid === focusedOrderNetId)

    if (focusedRow) {
      openCashflowDetails(focusedRow)
      return
    }

    if (isLoading || focusedOrderRequestRef.current === focusedOrderNetId) {
      return
    }

    focusedOrderRequestRef.current = focusedOrderNetId
    const controller = new AbortController()

    void getOutgoingCashflowByNetId(focusedOrderNetId, controller.signal)
      .then((outcomeOrder) => {
        if (controller.signal.aborted || !outcomeOrder || dismissedFocusedOrderNetIdRef.current === focusedOrderNetId) {
          return
        }

        const focusedLoadedRow = buildCashflowRows([outcomeOrder])[0]

        if (focusedLoadedRow) {
          openCashflowDetails(focusedLoadedRow)
        }
      })
      .catch((focusLoadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(focusLoadError instanceof Error ? focusLoadError.message : t('Не вдалося завантажити видатковий ордер'))
        }
      })

    return () => {
      controller.abort()
    }
  }, [focusedOrderNetId, isLoading, openCashflowDetails, rows, selectedRow?.order.NetUid, setError, t])

  const resetFilters = useCallback(() => {
    setFromDate(shiftDate(-7))
    setToDate(formatLocalDate(new Date()))
    setSearchValue('')
    setCurrencyNetId('')
    setPaymentRegisterNetId('')
    setPaymentMovementNetId('')
    setSelectedOrganizationIds(organizationOptions.map((option) => option.value))
  }, [
    organizationOptions,
    setCurrencyNetId,
    setFromDate,
    setPaymentMovementNetId,
    setPaymentRegisterNetId,
    setSearchValue,
    setSelectedOrganizationIds,
    setToDate,
  ])

  const handleCancel = useCallback(async () => {
    if (!cancelRow?.order.NetUid || isCanceling) {
      return
    }

    setCanceling(true)
    setError(null)

    try {
      await cancelOutgoingCashflow(cancelRow.order.NetUid)
      setCancelRow(null)
      void loadCashflows(page)
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати видатковий ордер'))
    } finally {
      setCanceling(false)
    }
  }, [cancelRow, isCanceling, loadCashflows, page, setCancelRow, setCanceling, setError, t])

  return {
    cancelRow,
    cashflows,
    columns,
    currencies,
    currencyNetId,
    error,
    filterError,
    fromDate,
    hasMore,
    isCalculatingStructure,
    isCanceling,
    isLoading,
    isLoadingLookups,
    isTableBusy,
    page,
    pageSize,
    totalRowsQty,
    organizationOptions,
    paymentMovementNetId,
    paymentMovements,
    paymentRegisterNetId,
    paymentRegisters,
    rows,
    searchValue,
    selectedOrganizationIds,
    selectedRow,
    structureCalculatedOrder,
    structureCalculationError,
    structureRow,
    toDate,
    onCancel: handleCancel,
    onCloseCancel: () => setCancelRow(null),
    onCloseDetails: closeCashflowDetails,
    onCloseDocumentStructure: closeDocumentStructure,
    onLoadCashflows: loadCashflows,
    onLoadLookups: loadLookups,
    onSetPage: setPage,
    onSetPageSize: (nextPageSize: number) => {
      setPageSize(nextPageSize)
      setPage(1)
    },
    onOpenDetails: openCashflowDetails,
    onResetFilters: resetFilters,
    onSetCurrencyNetId: setCurrencyNetId,
    onSetFromDate: setFromDate,
    onSetPaymentMovementNetId: setPaymentMovementNetId,
    onSetPaymentRegisterNetId: setPaymentRegisterNetId,
    onSetSearchValue: setSearchValue,
    onSetSelectedOrganizationIds: setSelectedOrganizationIds,
    onSetToDate: setToDate,
  }
}

export function OutgoingCashflowsPage() {
  const model = useOutgoingCashflowsPageModel()

  return <OutgoingCashflowsContent model={model} />
}

type OutgoingCashflowsPageModel = {
  cancelRow: OutgoingCashflowRow | null
  cashflows: OutgoingCashflowsResponse
  columns: DataTableColumn<OutgoingCashflowRow>[]
  currencies: Currency[]
  currencyNetId: string
  error: string | null
  filterError: string | null
  fromDate: string
  hasMore: boolean
  isCalculatingStructure: boolean
  isCanceling: boolean
  isLoading: boolean
  isLoadingLookups: boolean
  isTableBusy: boolean
  page: number
  pageSize: number
  totalRowsQty: number | null
  organizationOptions: Array<{ label: string; value: string }>
  paymentMovementNetId: string
  paymentMovements: PaymentMovement[]
  paymentRegisterNetId: string
  paymentRegisters: PaymentRegister[]
  rows: OutgoingCashflowRow[]
  searchValue: string
  selectedOrganizationIds: string[]
  selectedRow: OutgoingCashflowRow | null
  structureCalculatedOrder: OutcomePaymentOrder | null
  structureCalculationError: string | null
  structureRow: OutgoingCashflowRow | null
  toDate: string
  onCancel: () => void
  onCloseCancel: () => void
  onCloseDetails: () => void
  onCloseDocumentStructure: () => void
  onLoadCashflows: (page: number) => Promise<void>
  onLoadLookups: () => Promise<void>
  onSetPage: (page: number) => void
  onSetPageSize: (pageSize: number) => void
  onOpenDetails: (row: OutgoingCashflowRow) => void
  onResetFilters: () => void
  onSetCurrencyNetId: (value: string) => void
  onSetFromDate: (value: string) => void
  onSetPaymentMovementNetId: (value: string) => void
  onSetPaymentRegisterNetId: (value: string) => void
  onSetSearchValue: (value: string) => void
  onSetSelectedOrganizationIds: (value: string[]) => void
  onSetToDate: (value: string) => void
}

function OutgoingCashflowsContent({ model }: { model: OutgoingCashflowsPageModel }) {
  const {
    cancelRow,
    cashflows,
    columns,
    currencies,
    currencyNetId,
    error,
    filterError,
    fromDate,
    hasMore,
    isCalculatingStructure,
    isCanceling,
    isLoading,
    isLoadingLookups,
    isTableBusy,
    page,
    pageSize,
    totalRowsQty,
    organizationOptions,
    paymentMovementNetId,
    paymentMovements,
    paymentRegisterNetId,
    paymentRegisters,
    rows,
    searchValue,
    selectedOrganizationIds,
    selectedRow,
    structureCalculatedOrder,
    structureCalculationError,
    structureRow,
    toDate,
    onCancel,
    onCloseCancel,
    onCloseDetails,
    onCloseDocumentStructure,
    onLoadCashflows,
    onLoadLookups,
    onSetPage,
    onSetPageSize,
    onOpenDetails,
    onResetFilters,
    onSetCurrencyNetId,
    onSetFromDate,
    onSetPaymentMovementNetId,
    onSetPaymentRegisterNetId,
    onSetSearchValue,
    onSetSelectedOrganizationIds,
    onSetToDate,
  } = model
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const location = useLocation()

  function navigateToCreateItem(path: string) {
    if (path.startsWith('/accounting/outgoing-cashflow/new')) {
      navigate(path, { state: { backgroundLocation: location } })
      return
    }

    navigate(path)
  }

  return (
    <Stack className="outgoing-cashflows-page console-table-page" gap={6}>
      <div className="console-table-shell outgoing-cashflows-card">
        <div className="app-filter-bar outgoing-cashflows-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="outgoing-cashflows-filter-row">
            <div className="app-filter-date-range">
              <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => onSetFromDate(event.currentTarget.value)} />
              <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => onSetToDate(event.currentTarget.value)} />
            </div>
            <TextInput
              leftSection={<Search size={16} />}
              label={t('Пошук')}
              placeholder={t('Номер, отримувач, рахунок або коментар')}
              value={searchValue}
              w="100%"
              onChange={(event) => onSetSearchValue(event.currentTarget.value)}
            />
            <Select
              clearable
              searchable
              data={toSelectOptions(currencies, (currency) => currency.Name || currency.Code)}
              label={t('Валюта')}
              placeholder={t('Усі')}
              value={currencyNetId || null}
              w="100%"
              onChange={(value) => onSetCurrencyNetId(value || '')}
            />
            <Select
              clearable
              searchable
              data={toSelectOptions(paymentRegisters, (register) => register.Name)}
              label={t('Рахунок')}
              placeholder={t('Усі')}
              value={paymentRegisterNetId || null}
              w="100%"
              onChange={(value) => onSetPaymentRegisterNetId(value || '')}
            />
            <Select
              clearable
              searchable
              data={toSelectOptions(paymentMovements, (movement) => movement.OperationName)}
              label={t('Стаття руху')}
              placeholder={t('Усі')}
              value={paymentMovementNetId || null}
              w="100%"
              onChange={(value) => onSetPaymentMovementNetId(value || '')}
            />
            <CheckboxMultiSelect
              data={organizationOptions}
              label={t('Організації')}
              placeholder={t('Без фільтра')}
              value={selectedOrganizationIds}
              w="100%"
              onChange={onSetSelectedOrganizationIds}
            />
            <div className="app-filter-actions outgoing-cashflows-filter-actions">
              <Tooltip label={t('Скинути фільтри')}>
                <ActionIcon aria-label={t('Скинути фільтри')} color="gray" size={34} variant="light" onClick={onResetFilters}>
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
                onPageSizeChange={onSetPageSize}
                onRefresh={() => {
                  void onLoadLookups()
                  void onLoadCashflows(page)
                }}
              />
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
            <div className="outgoing-cashflows-create-actions">
              <Menu position="bottom-end" shadow="md" width={340} withinPortal>
                <Menu.Target>
                  <Button
                    color={CREATE_ACTION_COLOR}
                    leftSection={<Plus size={16} />}
                    rightSection={<ChevronDown size={14} />}
                    size="sm"
                    styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                  >
                    {t('Новий')}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('Банківські операції')}</Menu.Label>
                  {buildOutgoingRegisterItems(t, PaymentRegisterType.Bank).map((item) => (
                    <Menu.Item
                      key={item.path}
                      leftSection={<Landmark size={15} />}
                      onClick={() => navigateToCreateItem(item.path)}
                    >
                      {item.label}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  <Menu.Label>{t('Касові операції')}</Menu.Label>
                  {buildOutgoingRegisterItems(t, PaymentRegisterType.Cash).map((item) => (
                    <Menu.Item
                      key={item.path}
                      leftSection={<Banknote size={15} />}
                      onClick={() => navigateToCreateItem(item.path)}
                    >
                      {item.label}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  <Menu.Label>{t('Інші операції (бух/упр)')}</Menu.Label>
                  {buildOutgoingStandaloneItems(t).map((item) => (
                    <Menu.Item
                      key={item.path}
                      leftSection={<ListChecks size={15} />}
                      onClick={() => navigateToCreateItem(item.path)}
                    >
                      {item.label}
                    </Menu.Item>
                  ))}
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

        <div className="outgoing-cashflows-page__table console-table-body">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            enablePinning={false}
            emptyText={t('Видаткових ордерів не знайдено')}
            getRowId={(row) => row.id}
            isLoading={isTableBusy}
            layoutVersion="outgoing-cashflows-actions-1"
            minWidth={1860}
            showLayoutControls
            tableId="outgoing-cashflows"
            toolbarPortalTarget={tableToolbarSlot}
            footer={
              <Group className="outgoing-cashflows-table-footer" gap="xs" justify="flex-end" wrap="nowrap">
                <Badge className="app-role-pill is-gray" variant="light">
                  {t('Рядків')}: {rows.length}
                </Badge>
                <Badge className="app-role-pill is-green" variant="light">
                  {t('Кредиторська заборгованість')}: {formatMoney(cashflows.PositiveDifferenceAmount)}
                </Badge>
                <Badge className="app-role-pill is-red" variant="light">
                  {t('Дебіторська заборгованість')}: {formatMoney(cashflows.NegativeDifferenceAmount)}
                </Badge>
              </Group>
            }
            onRowClick={onOpenDetails}
          />
        </div>
      </div>

      <OutgoingCashflowDetailDrawer row={selectedRow} onClose={onCloseDetails} />
      <OutgoingCashflowDocumentStructureDrawer
        calculatedOrder={structureCalculatedOrder}
        calculationError={structureCalculationError}
        isCalculating={isCalculatingStructure}
        row={structureRow}
        onClose={onCloseDocumentStructure}
      />
      <CancelOutgoingCashflowModal
        isSaving={isCanceling}
        row={cancelRow}
        onCancel={onCancel}
        onClose={onCloseCancel}
      />
    </Stack>
  )
}

function useOutgoingCashflowColumns({
  onCancel,
  onEditReport,
  onOpenDocumentStructure,
  onOpen,
}: {
  onCancel: (row: OutgoingCashflowRow) => void
  onEditReport: (row: OutgoingCashflowRow) => void
  onOpenDocumentStructure: (row: OutgoingCashflowRow) => void
  onOpen: (row: OutgoingCashflowRow) => void
}): DataTableColumn<OutgoingCashflowRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<OutgoingCashflowRow>[]>(
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
        id: 'payedTo',
        header: t('Кому видано'),
        width: 310,
        minWidth: 230,
        accessor: (row) => row.payedTo,
        cell: (row) => <PayedToCell row={row} />,
      },
      {
        id: 'paymentRegister',
        header: t('Рахунок'),
        width: 250,
        minWidth: 190,
        accessor: (row) => row.paymentRegister,
        cell: (row) => displayValue(row.paymentRegister),
      },
      {
        id: 'operationType',
        header: t('Тип операції'),
        width: 240,
        minWidth: 180,
        accessor: (row) => row.operationType,
        cell: (row) => displayValue(row.operationType),
      },
      {
        id: 'paymentMovement',
        header: t('Стаття руху'),
        width: 240,
        minWidth: 180,
        accessor: (row) => row.paymentMovement,
        cell: (row) => displayValue(row.paymentMovement),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 210,
        minWidth: 160,
        accessor: (row) => row.organization,
        cell: (row) => displayValue(row.organization),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 170,
        minWidth: 130,
        accessor: (row) => row.responsible,
        cell: (row) => displayValue(row.responsible),
      },
      {
        id: 'totalRowsQty',
        header: t('Рядків'),
        width: 100,
        minWidth: 90,
        align: 'right',
        accessor: (row) => row.totalRowsQty,
        cell: (row) => (
          <Text className="app-money" size="sm" ta="right">
            {formatOptionalNumber(row.totalRowsQty)}
          </Text>
        ),
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
        id: 'actions',
        header: t('Дії'),
        width: 104,
        minWidth: 100,
        align: 'right',
        className: 'outgoing-cashflows-actions-column',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <Group className="outgoing-cashflows-row-actions" gap={2} justify="flex-end" wrap="nowrap">
            {row.hasDocumentStructure && (
              <Tooltip label={t('Структура документів')}>
                <ActionIcon
                  aria-label={t('Структура документів')}
                  color="gray"
                  size={20}
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenDocumentStructure(row)
                  }}
                >
                  <Network size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            {row.isUnderReport && (
              <Tooltip label={t('Редагувати звіт')}>
                <ActionIcon
                  aria-label={t('Редагувати звіт')}
                  color="gray"
                  disabled={!row.order.NetUid}
                  size={20}
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEditReport(row)
                  }}
                >
                  <SquarePen size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={row.isCanceled ? t('Уже скасовано') : t('Скасувати')}>
              <ActionIcon
                aria-label={t('Скасувати')}
                color="red"
                disabled={row.isCanceled || !row.order.NetUid}
                size={20}
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onCancel(row)
                }}
              >
                <Ban size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Деталі')}>
              <ActionIcon
                aria-label={t('Деталі')}
                color="gray"
                size={20}
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen(row)
                }}
              >
                <Eye size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [onCancel, onEditReport, onOpen, onOpenDocumentStructure, t],
  )
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

function PayedToCell({ row }: { row: OutgoingCashflowRow }) {
  const { t } = useI18n()

  return (
    <Group gap={6} wrap="nowrap">
      <Text size="sm">{displayValue(row.payedTo)}</Text>
      {row.isUnderReport && (
        <Badge className="app-role-pill" size="xs" variant="light">
          {t('Підзвіт')}
        </Badge>
      )}
      {row.rootAssigned && (
        <Badge className="app-role-pill is-gray" size="xs" variant="light">
          {t('Призначено')}
        </Badge>
      )}
      {Boolean(row.differenceAmount) && (
        <Text className="app-money" size="sm">
          {formatMoney(row.differenceAmount)}
        </Text>
      )}
    </Group>
  )
}

function OutgoingCashflowDetailDrawer({ row, onClose }: { row: OutgoingCashflowRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const relatedOrders = getActiveRelatedConsumablesOrders(row?.order.OutcomePaymentOrderConsumablesOrders)

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={t('Видатковий ордер')} onClose={onClose}>
      {row && (
        <div className="outgoing-detail-drawer">
          <section className="outgoing-detail-summary">
            <div className="outgoing-detail-summary__main">
              <span className="outgoing-detail-eyebrow">{t('Документ')}</span>
              <Text className="outgoing-detail-summary__title">{displayValue(row.number)}</Text>
              <Text className="outgoing-detail-summary__meta">
                {formatDateTime(row.fromDate)} · {displayValue(row.operationType)}
              </Text>
            </div>
            <div className="outgoing-detail-summary__metrics">
              <OutgoingDetailMetric label={t('Сума')} value={formatMoney(row.amount)} suffix={row.currency} />
              <OutgoingDetailMetric label={t('Різниця')} tone={row.differenceAmount ? 'danger' : undefined} value={formatMoney(row.differenceAmount)} />
              <OutgoingDetailMetric label={t('ПДВ')} value={formatMoneyOptional(row.order.VAT)} />
            </div>
          </section>

          <div className="outgoing-detail-tree">
            <OutgoingDetailSection subtitle={displayValue(row.number)} title={t('Документ')}>
              <OutgoingDetailRow label={t('Дата')} value={formatDateTime(row.fromDate)} />
              <OutgoingDetailRow label={t('Номер')} value={displayValue(row.number)} />
              <OutgoingDetailRow label={t('Вхідний номер')} value={displayValue(row.order.ArrivalNumber)} />
              <OutgoingDetailRow label={t('Тип операції')} value={displayValue(row.operationType)} />
              <OutgoingDetailRow label={t('Призначення платежу')} value={displayValue(row.order.PaymentPurpose)} wide />
              <OutgoingDetailRow label={t('Коментар')} value={displayValue(row.comment)} wide />
            </OutgoingDetailSection>

            <OutgoingDetailSection subtitle={displayValue(row.currency)} title={t('Суми та валюта')}>
              <OutgoingDetailRow label={t('Сума')} value={formatMoneyWithCurrency(row.amount, row.currency)} />
              <OutgoingDetailRow label={t('Валюта')} value={displayValue(row.currency)} />
              <OutgoingDetailRow label={t('Курс')} value={displayValue(row.order.ExchangeRate)} />
              <OutgoingDetailRow label={t('Сума в EUR')} value={formatMoneyOptional(row.order.EuroAmount ?? row.order.AfterExchangeAmount)} />
              <OutgoingDetailRow label={t('ПДВ %')} value={hasNumber(row.order.VatPercent) ? displayValue(row.order.VatPercent) : displayValue(undefined)} />
              <OutgoingDetailRow label={t('ПДВ')} value={formatMoneyOptional(row.order.VAT)} />
              <OutgoingDetailRow label={t('Різниця')} tone={row.differenceAmount ? 'danger' : undefined} value={formatMoney(row.differenceAmount)} />
            </OutgoingDetailSection>

            <OutgoingDetailSection subtitle={displayValue(row.organization)} title={t('Учасники та рахунки')}>
              <OutgoingDetailRow label={t('Кому видано')} value={displayValue(row.payedTo)} wide />
              <OutgoingDetailRow label={t('Організація')} value={displayValue(row.organization)} wide />
              <OutgoingDetailRow label={t('Рахунок')} value={displayValue(row.paymentRegister)} wide />
              <OutgoingDetailRow label={t('Стаття руху')} value={displayValue(row.paymentMovement)} wide />
              <OutgoingDetailRow label={t('Відповідальний')} value={displayValue(row.responsible)} />
              <OutgoingDetailRow label={t('Клієнт')} value={displayValue(getEntityName(row.order.ClientAgreement?.Client) || getEntityName(row.order.Client))} wide />
            </OutgoingDetailSection>

            <OutgoingDetailSection title={t('Стани')}>
              <div className="outgoing-detail-flags">
                <OutgoingDetailFlag active={Boolean(row.isUnderReport)} label={t('Підзвіт')} />
                <OutgoingDetailFlag active={Boolean(row.order.IsUnderReportDone)} label={t('Закрито')} />
                <OutgoingDetailFlag active={Boolean(row.isCanceled)} label={t('Скасовано')} />
                <OutgoingDetailFlag active={Boolean(row.isAccounting)} label={t('Бухгалтерський')} />
                <OutgoingDetailFlag active={Boolean(row.isManagementAccounting)} label={t('Управлінський')} />
              </div>
            </OutgoingDetailSection>

            <OutgoingDetailSection subtitle={`${relatedOrders.length}`} title={t('Пов’язані документи')}>
              {relatedOrders.length > 0 ? (
                <div className="outgoing-detail-related-list">
                  {relatedOrders.map((item, index) => {
                    const order = item.ConsumablesOrder
                    const itemsCount = getActiveConsumablesItemsCount(order)

                    return (
                      <article key={getRelatedOrderKey(row, item, index)} className="outgoing-detail-related-card">
                        <div className="outgoing-detail-related-card__head">
                          <span>{displayValue(order?.Number)}</span>
                          <span>{formatDateTime(order?.OrganizationFromDate)}</span>
                        </div>
                        <div className="outgoing-detail-related-card__grid">
                          <OutgoingDetailRow label={t('Номер організації')} value={displayValue(order?.OrganizationNumber)} />
                          <OutgoingDetailRow label={t('Постачальник/отримувач')} value={displayValue(getEntityName(order?.ConsumableProductOrganization))} />
                          <OutgoingDetailRow label={t('Склад')} value={displayValue(getEntityName(order?.ConsumablesStorage))} />
                          <OutgoingDetailRow label={t('Позицій')} value={String(itemsCount)} />
                          <OutgoingDetailRow label={t('Сума без ПДВ')} value={formatMoneyOptional(order?.TotalAmountWithoutVAT)} />
                          <OutgoingDetailRow label={t('Сума з ПДВ')} value={formatMoneyOptional(order?.TotalAmount)} />
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="outgoing-detail-empty">{t('Пов’язаних документів немає')}</div>
              )}
            </OutgoingDetailSection>
          </div>
        </div>
      )}
    </AppDrawer>
  )
}

function OutgoingDetailMetric({
  label,
  suffix,
  tone,
  value,
}: {
  label: string
  suffix?: string
  tone?: 'danger'
  value: string
}) {
  return (
    <div className={`outgoing-detail-metric${tone ? ` is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>
        {displayValue(value)}
        {suffix ? <em>{suffix}</em> : null}
      </strong>
    </div>
  )
}

function OutgoingDetailSection({ children, subtitle, title }: { children: ReactNode; subtitle?: string; title: string }) {
  return (
    <section className="outgoing-detail-section">
      <div className="outgoing-detail-section__head">
        <span className="outgoing-detail-section__title">{title}</span>
        {subtitle ? <span className="outgoing-detail-section__subtitle">{subtitle}</span> : null}
      </div>
      <div className="outgoing-detail-section__body">{children}</div>
    </section>
  )
}

function OutgoingDetailRow({
  label,
  tone,
  value,
  wide,
}: {
  label: string
  tone?: 'danger'
  value: string
  wide?: boolean
}) {
  return (
    <div className={`outgoing-detail-row${wide ? ' is-wide' : ''}`}>
      <span className="outgoing-detail-row__label">{label}</span>
      <span className="outgoing-detail-row__line" aria-hidden />
      <span className={`outgoing-detail-row__value${tone ? ` is-${tone}` : ''}`}>{displayValue(value) || '-'}</span>
    </div>
  )
}

function OutgoingDetailFlag({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`outgoing-detail-flag${active ? ' is-active' : ''}`}>
      <span aria-hidden />
      {label}
    </span>
  )
}

function OutgoingCashflowDocumentStructureDrawer({
  calculatedOrder,
  calculationError,
  isCalculating,
  onClose,
  row,
}: {
  calculatedOrder: OutcomePaymentOrder | null
  calculationError: string | null
  isCalculating: boolean
  onClose: () => void
  row: OutgoingCashflowRow | null
}) {
  const { t } = useI18n()
  const assignedOrders = getActiveAssignedPaymentOrders(row?.order.AssignedPaymentOrders)
  const rootAssignedOrder = row?.order.RootAssignedPaymentOrder || null
  const calculatedTotal = calculatedOrder?.Amount

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={t('Структура документів')} onClose={onClose}>
      {row && (
        <Stack gap="md">
          {isCalculating && (
            <Alert color="gray" variant="light">
              {t('Перерахунок структури документів...')}
            </Alert>
          )}

          {calculationError && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {calculationError}
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Видатковий ордер')} value={displayValue(row.number)} />
            <DetailItem label={t('Дата')} value={formatDateTime(row.fromDate)} />
            <DetailItem label={t('Сума')} value={formatMoney(row.amount)} />
            <DetailItem
              label={t('Перерахована сума')}
              value={hasNumber(calculatedTotal) ? formatMoneyWithCurrency(calculatedTotal, row.currency) : displayValue(undefined)}
            />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Курс')} value={displayValue(row.order.ExchangeRate)} />
            <DetailItem label={t('Сума в EUR')} value={formatMoneyOptional(row.order.EuroAmount ?? row.order.AfterExchangeAmount)} />
            <DetailItem label={t('ПДВ %')} value={hasNumber(row.order.VatPercent) ? displayValue(row.order.VatPercent) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ')} value={formatMoneyOptional(row.order.VAT)} />
            <DetailItem label={t('Кому видано')} value={displayValue(row.payedTo)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Рахунок')} value={displayValue(row.paymentRegister)} />
            <DetailItem label={t('Стаття руху')} value={displayValue(row.paymentMovement)} />
            <DetailItem label={t('Призначення платежу')} value={displayValue(row.order.PaymentPurpose)} />
            <DetailItem label={t('Підзвіт')} value={row.isUnderReport ? t('Так') : t('Ні')} />
            <DetailItem label={t('Авансовий звіт')} value={displayValue(row.order.AdvanceNumber)} />
          </SimpleGrid>

          <Divider />

          <Stack gap="sm">
            {rootAssignedOrder && !rootAssignedOrder.Deleted && (
              <AssignedPaymentOrderBlock
                assignedPaymentOrder={rootAssignedOrder}
                calculatedTotal={calculatedTotal}
                parentOrder={row.order}
                title={t('Кореневий документ')}
              />
            )}

            {assignedOrders.length > 0 ? (
              assignedOrders.map((assignedPaymentOrder, index) => (
                <AssignedPaymentOrderBlock
                  key={getAssignedPaymentOrderKey(assignedPaymentOrder, index)}
                  assignedPaymentOrder={assignedPaymentOrder}
                  calculatedTotal={calculatedTotal}
                  parentOrder={row.order}
                  title={`${t('Пов’язаний документ')} ${index + 1}`}
                />
              ))
            ) : !rootAssignedOrder || rootAssignedOrder.Deleted ? (
              <Text c="dimmed" size="sm">
                {t('Структура документів відсутня')}
              </Text>
            ) : null}
          </Stack>
        </Stack>
      )}
    </AppDrawer>
  )
}

function AssignedPaymentOrderBlock({
  assignedPaymentOrder,
  calculatedTotal,
  parentOrder,
  title,
}: {
  assignedPaymentOrder: AssignedPaymentOrder
  calculatedTotal?: number
  parentOrder: OutcomePaymentOrder
  title: string
}) {
  const { t } = useI18n()
  const assignedOutcome = assignedPaymentOrder.AssignedOutcomePaymentOrder || assignedPaymentOrder.RootOutcomePaymentOrder
  const assignedIncome = assignedPaymentOrder.AssignedIncomePaymentOrder || assignedPaymentOrder.RootIncomePaymentOrder

  return (
    <Stack gap="xs">
      <Text className="app-section-title" fw={600} size="sm">{title}</Text>
      <AdvanceReportStructureSummary
        assignedPaymentOrder={assignedPaymentOrder}
        calculatedTotal={calculatedTotal}
        parentOrder={parentOrder}
      />
      {assignedOutcome && <AssignedOutcomeOrderView order={assignedOutcome} />}
      {assignedIncome && <AssignedIncomeOrderView order={assignedIncome} />}
      {!assignedOutcome && !assignedIncome && (
        <Text c="dimmed" size="sm">
          {t('Пов’язаний документ не завантажено')}
        </Text>
      )}
    </Stack>
  )
}

function AdvanceReportStructureSummary({
  assignedPaymentOrder,
  calculatedTotal,
  parentOrder,
}: {
  assignedPaymentOrder: AssignedPaymentOrder
  calculatedTotal?: number
  parentOrder: OutcomePaymentOrder
}) {
  const { t } = useI18n()
  const assignedOutcome = assignedPaymentOrder.AssignedOutcomePaymentOrder || assignedPaymentOrder.RootOutcomePaymentOrder
  const assignedIncome = assignedPaymentOrder.AssignedIncomePaymentOrder || assignedPaymentOrder.RootIncomePaymentOrder
  const currency = assignedIncome?.Currency?.Code
    || assignedIncome?.Currency?.Name
    || assignedOutcome?.PaymentCurrencyRegister?.Currency?.Code
    || assignedOutcome?.PaymentCurrencyRegister?.Currency?.Name
    || parentOrder.PaymentCurrencyRegister?.Currency?.Code
    || parentOrder.PaymentCurrencyRegister?.Currency?.Name
  const advanceReportTotal = hasNumber(calculatedTotal) ? calculatedTotal : parentOrder.Amount

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <DetailItem label={t('Авансовий звіт')} value={displayValue(parentOrder.AdvanceNumber)} />
      <DetailItem label={t('Дата авансового звіту')} value={formatDateTime(assignedOutcome?.Created || assignedOutcome?.FromDate || parentOrder.FromDate)} />
      <DetailItem label={t('Сума авансового звіту')} value={formatMoneyWithCurrency(advanceReportTotal, currency)} />
      <DetailItem label={t('Сума зв’язки')} value={formatMoneyWithCurrency(assignedPaymentOrder.Amount, currency)} />
    </SimpleGrid>
  )
}

function AssignedOutcomeOrderView({ order }: { order: OutcomePaymentOrder }) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <DetailItem label={t('Документ')} value={getOutcomePaymentOrderTypeLabel(order, t)} />
      <DetailItem label={t('Номер')} value={displayValue(order.Number || order.CustomNumber)} />
      <DetailItem label={t('Дата')} value={formatDateTime(order.FromDate)} />
      <DetailItem label={t('Сума')} value={formatMoney(order.Amount)} />
      <DetailItem label={t('Валюта')} value={displayValue(order.PaymentCurrencyRegister?.Currency?.Code || order.PaymentCurrencyRegister?.Currency?.Name)} />
      <DetailItem label={t('Отримувач')} value={displayValue(getPayedTo(order))} />
    </SimpleGrid>
  )
}

function AssignedIncomeOrderView({ order }: { order: AssignedIncomePaymentOrder }) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <DetailItem label={t('Документ')} value={getIncomePaymentOrderTypeLabel(order, t)} />
      <DetailItem label={t('Номер')} value={displayValue(order.Number)} />
      <DetailItem label={t('Дата')} value={formatDateTime(order.FromDate)} />
      <DetailItem label={t('Сума')} value={formatMoney(order.Amount)} />
      <DetailItem label={t('Валюта')} value={displayValue(order.Currency?.Code || order.Currency?.Name)} />
      <DetailItem label={t('Колега')} value={displayValue(getColleagueFullName(order.Colleague))} />
    </SimpleGrid>
  )
}

function CancelOutgoingCashflowModal({
  isSaving,
  onCancel,
  onClose,
  row,
}: {
  isSaving: boolean
  onCancel: () => void
  onClose: () => void
  row: OutgoingCashflowRow | null
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={Boolean(row)}
      title={t('Скасувати видатковий ордер')}
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}
    >
      <Stack gap="md">
        <Text>{row ? t('Ордер "{number}" буде позначено як скасований.', { number: displayValue(row.number) }) : ''}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
            {t('Закрити')}
          </Button>
          <Button color="red" disabled={isSaving} loading={isSaving} onClick={onCancel}>
            {t('Скасувати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  )
}

function buildCashflowRows(orders: OutcomePaymentOrder[]): OutgoingCashflowRow[] {
  return orders.map((order, index) => ({
    amount: order.Amount,
    comment: order.Comment,
    currency: order.PaymentCurrencyRegister?.Currency?.Code || order.PaymentCurrencyRegister?.Currency?.Name,
    differenceAmount: order.DifferenceAmount,
    fromDate: order.FromDate,
    hasDocumentStructure: hasDocumentStructure(order),
    id: String(order.NetUid || order.Id || index),
    isAccounting: order.IsAccounting,
    isCanceled: order.IsCanceled,
    isManagementAccounting: order.IsManagementAccounting,
    isUnderReport: order.IsUnderReport,
    number: order.Number || order.CustomNumber,
    operationType: order.OperationTypeName,
    order,
    organization: getEntityName(order.Organization),
    payedTo: getPayedTo(order),
    paymentMovement: order.PaymentMovementOperation?.PaymentMovement?.OperationName,
    paymentRegister: order.PaymentCurrencyRegister?.PaymentRegister?.Name,
    responsible: getEntityName(order.User),
    rootAssigned: Boolean(order.RootAssignedPaymentOrder && !order.RootAssignedPaymentOrder.Deleted),
    totalRowsQty: order.TotalRowsQty,
  }))
}

function getPayedTo(order: OutcomePaymentOrder): string | undefined {
  const consumablesRecipients = getConsumablesOrderRecipientNames(order)

  if (order.IsUnderReport) {
    return getColleagueFullName(order.Colleague) || consumablesRecipients
  }

  return consumablesRecipients
    || getEntityName(order.ConsumableProductOrganization)
    || getEntityName(order.ClientAgreement?.Client)
    || getColleagueFullName(order.Colleague)
    || getEntityName(order.Client)
    || undefined
}

function getConsumablesOrderRecipientNames(order: OutcomePaymentOrder): string | undefined {
  const names = getActiveRelatedConsumablesOrders(order.OutcomePaymentOrderConsumablesOrders)
    .map((item) => getEntityName(item.ConsumablesOrder?.ConsumableProductOrganization))
    .filter((name): name is string => Boolean(name))

  return Array.from(new Set(names)).join(', ') || undefined
}

function getColleagueFullName(colleague?: NamedEntity | null): string | undefined {
  return joinTruthyParts(colleague?.LastName, colleague?.FirstName, colleague?.MiddleName)
    || getEntityName(colleague)
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.FullName
    || joinTruthyParts(entity?.LastName, entity?.FirstName, entity?.MiddleName)
    || entity?.LastName
    || entity?.Name
    || entity?.OperationName
    || entity?.Code
    || entity?.Number
}

function hasDocumentStructure(order: OutcomePaymentOrder): boolean {
  return Boolean(order.IsUnderReport) ||
    Boolean(order.RootAssignedPaymentOrder && !order.RootAssignedPaymentOrder.Deleted) ||
    Boolean((order.AssignedPaymentOrders || []).some((assignedPaymentOrder) => !assignedPaymentOrder.Deleted))
}

function getDocumentStructureOutcomeToCalculate(order: OutcomePaymentOrder): OutcomePaymentOrder | null {
  const rootOutcome = order.RootAssignedPaymentOrder?.AssignedOutcomePaymentOrder
    || order.RootAssignedPaymentOrder?.RootOutcomePaymentOrder
    || null

  if (rootOutcome && !rootOutcome.Deleted) {
    return rootOutcome
  }

  if (order.IsUnderReport || getActiveAssignedPaymentOrders(order.AssignedPaymentOrders).length > 0) {
    return order
  }

  return null
}

function getActiveAssignedPaymentOrders(orders?: AssignedPaymentOrder[]): AssignedPaymentOrder[] {
  return (orders || []).filter((assignedPaymentOrder) => !assignedPaymentOrder.Deleted)
}

function getActiveRelatedConsumablesOrders(
  orders?: OutcomePaymentOrder['OutcomePaymentOrderConsumablesOrders'],
): NonNullable<OutcomePaymentOrder['OutcomePaymentOrderConsumablesOrders']> {
  return (orders || []).filter(
    (order) => !order.Deleted && order.ConsumablesOrder && !order.ConsumablesOrder.Deleted,
  )
}

function getActiveConsumablesItemsCount(order?: ConsumablesOrder | null): number {
  return (order?.ConsumablesOrderItems || []).filter((item) => !item.Deleted).length
}

function getAssignedPaymentOrderKey(assignedPaymentOrder: AssignedPaymentOrder, index: number): string {
  return String(
    assignedPaymentOrder.NetUid ||
      assignedPaymentOrder.Id ||
      assignedPaymentOrder.AssignedOutcomePaymentOrder?.NetUid ||
      assignedPaymentOrder.AssignedIncomePaymentOrder?.NetUid ||
      `assigned-${index}`,
  )
}

function getOutcomePaymentOrderTypeLabel(order: OutcomePaymentOrder, t: (value: string) => string): string {
  return getPaymentRegisterTypeLabel(order.PaymentCurrencyRegister?.PaymentRegister?.Type, t, 'outcome')
}

function getIncomePaymentOrderTypeLabel(order: AssignedIncomePaymentOrder, t: (value: string) => string): string {
  return getPaymentRegisterTypeLabel(order.PaymentRegister?.Type, t, 'income')
}

function getPaymentRegisterTypeLabel(
  type: number | undefined,
  t: (value: string) => string,
  direction: 'income' | 'outcome',
): string {
  if (type === 0) {
    return direction === 'income' ? t('Прибутковий касовий ордер') : t('Видатковий касовий ордер')
  }

  if (type === 2) {
    return direction === 'income' ? t('Прибутковий банківський ордер') : t('Видатковий банківський ордер')
  }

  return direction === 'income' ? t('Прибутковий картковий ордер') : t('Видатковий картковий ордер')
}

function toSelectOptions<T extends { NetUid?: string; Id?: number }>(items: T[], getLabel: (item: T) => string | undefined) {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    const value = item.NetUid || (typeof item.Id === 'number' ? String(item.Id) : '')

    if (!value) {
      return options
    }

    options.push({
      label: getLabel(item) || value,
      value,
    })

    return options
  }, [])
}

function toOrganizationOptions(organizations: Organization[]) {
  return organizations.reduce<Array<{ label: string; value: string }>>((options, organization) => {
    if (organization.Id == null) {
      return options
    }

    options.push({
      label: organization.Name || organization.FullName || String(organization.Id),
      value: String(organization.Id),
    })

    return options
  }, [])
}

function getSelectedOrganizationFilterIds(
  selectedIds: string[],
  allOptions: Array<{ label: string; value: string }>,
): string[] {
  if (selectedIds.length === 0 || selectedIds.length >= allOptions.length) {
    return []
  }

  return selectedIds
}

function getOrganizationFilterError(selectedFilterCount: number, t: (value: string) => string): string | null {
  if (selectedFilterCount <= MAX_ORGANIZATION_QUERY_FILTER_IDS) {
    return null
  }

  return t('Забагато організацій у фільтрі. Оберіть усі організації або звузьте вибір.')
}

function getRelatedOrderKey(row: OutgoingCashflowRow, item: { NetUid?: string; Id?: number; ConsumablesOrder?: { NetUid?: string; Id?: number } | null }, index: number): string {
  return String(item.NetUid || item.Id || item.ConsumablesOrder?.NetUid || item.ConsumablesOrder?.Id || `${row.id}-related-${index}`)
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

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}

function formatMoneyOptional(value?: number): string {
  return hasNumber(value) ? formatMoney(value) : ''
}

function formatMoneyWithCurrency(value?: number, currency?: string): string {
  if (!hasNumber(value)) {
    return displayValue(undefined)
  }

  const formatted = formatMoney(value)

  return currency ? `${formatted} ${currency}` : formatted
}

function formatOptionalNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function hasNumber(value?: number): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function joinTruthyParts(...parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ')
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}
