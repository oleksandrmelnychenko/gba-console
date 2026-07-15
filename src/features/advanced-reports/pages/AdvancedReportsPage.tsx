import {
  ActionIcon,
  Alert,
  Badge,
  Card,
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
import { CircleAlert, EllipsisVertical, Eye, Network, RotateCcw, Search, SquarePen } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  calculateAdvancedReportOrder,
  getAdvancedReportCurrencies,
  getAdvancedReportPaymentMovements,
  getAdvancedReports,
  searchAdvancedReportPaymentRegisters,
} from '../api/advancedReportsApi'
import type {
  AdvancedReportRow,
  AdvancedReportsResponse,
  AdvancedReportsSearchParams,
  AssignedIncomePaymentOrder,
  AssignedPaymentOrder,
  Currency,
  NamedEntity,
  OutcomePaymentOrder,
  PaymentMovement,
  PaymentRegister,
} from '../types'
import './advanced-reports-page.css'

const DEFAULT_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE
const SEARCH_DEBOUNCE_MS = 350

const OUTGOING_CASHFLOW_ROUTE = '/accounting/outgoing-cashflow'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'number'],
    right: ['operations'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function AdvancedReportsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [reports, setReports] = useValueState<AdvancedReportsResponse>({
    Collection: [],
    NegativeDifferenceAmount: 0,
    PositiveDifferenceAmount: 0,
  })
  const [currencies, setCurrencies] = useValueState<Currency[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [paymentMovements, setPaymentMovements] = useValueState<PaymentMovement[]>([])
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [searchValue, setSearchValue] = useValueState('')
  const [currencyNetId, setCurrencyNetId] = useValueState('')
  const [paymentRegisterNetId, setPaymentRegisterNetId] = useValueState('')
  const [paymentMovementNetId, setPaymentMovementNetId] = useValueState('')
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingLookups, setLoadingLookups] = useValueState(false)
  const [selectedRow, setSelectedRow] = useValueState<AdvancedReportRow | null>(null)
  const [structureRow, setStructureRow] = useValueState<AdvancedReportRow | null>(null)
  const [structureCalculatedOrder, setStructureCalculatedOrder] = useValueState<OutcomePaymentOrder | null>(null)
  const [structureCalculationError, setStructureCalculationError] = useValueState<string | null>(null)
  const [isCalculatingStructure, setCalculatingStructure] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const filterError = getDateRangeError(fromDate, toDate)
  const lookupRequestRef = useRef(0)
  const structureCalculationRequestRef = useRef(0)
  const { density, toggleDensity } = useDataTableDensity('advanced-reports', TABLE_DEFAULT_LAYOUT.density)

  const offset = (page - 1) * pageSize
  const totalRows = getTotalRows(reports)
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  const activeFilters = useMemo<AdvancedReportsSearchParams>(
    () => ({
      currencyNetId,
      from: fromDate,
      limit: pageSize,
      offset,
      paymentMovementNetId,
      registerNetId: paymentRegisterNetId,
      to: toDate,
      value: normalizedSearchValue,
    }),
    [currencyNetId, fromDate, normalizedSearchValue, offset, pageSize, paymentMovementNetId, paymentRegisterNetId, toDate],
  )

  const loadLookups = useCallback(async () => {
    const requestId = lookupRequestRef.current + 1
    lookupRequestRef.current = requestId
    setLoadingLookups(true)

    try {
      const [nextCurrencies, nextRegisters, nextMovements] = await Promise.all([
        getAdvancedReportCurrencies(),
        searchAdvancedReportPaymentRegisters(''),
        getAdvancedReportPaymentMovements(),
      ])

      if (lookupRequestRef.current === requestId) {
        setCurrencies(nextCurrencies)
        setPaymentRegisters(nextRegisters)
        setPaymentMovements(nextMovements)
      }
    } catch (lookupError) {
      if (lookupRequestRef.current === requestId) {
        setError(lookupError instanceof Error ? lookupError.message : t('Не вдалося завантажити довідники'))
      }
    } finally {
      if (lookupRequestRef.current === requestId) {
        setLoadingLookups(false)
      }
    }
  }, [setCurrencies, setError, setLoadingLookups, setPaymentMovements, setPaymentRegisters, t])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  const resetReportsForInvalidFilter = useCallback(() => {
    setReports({
      Collection: [],
      NegativeDifferenceAmount: 0,
      PositiveDifferenceAmount: 0,
    })
    setError(null)
    setLoading(false)
  }, [setError, setLoading, setReports])

  const startReportsLoading = useCallback(() => {
    setLoading(true)
    setError(null)
  }, [setError, setLoading])

  const setReportsLoaded = useCallback(
    (nextReports: AdvancedReportsResponse) => {
      setReports(nextReports)
      setLoading(false)
    },
    [setLoading, setReports],
  )

  const setReportsFailed = useCallback(
    (loadError: unknown) => {
      setReports({
        Collection: [],
        NegativeDifferenceAmount: 0,
        PositiveDifferenceAmount: 0,
      })
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити авансові звіти'))
      setLoading(false)
    },
    [setError, setLoading, setReports, t],
  )

  useEffect(() => {
    let cancelled = false

    if (filterError) {
      resetReportsForInvalidFilter()

      return () => {
        cancelled = true
      }
    }

    async function loadReports() {
      startReportsLoading()

      try {
        const nextReports = await getAdvancedReports(activeFilters)

        if (!cancelled) {
          setReportsLoaded(nextReports)
        }
      } catch (loadError) {
        if (!cancelled) {
          setReportsFailed(loadError)
        }
      }
    }

    void loadReports()

    return () => {
      cancelled = true
    }
  }, [
    activeFilters,
    filterError,
    reloadKey,
    resetReportsForInvalidFilter,
    setReportsFailed,
    setReportsLoaded,
    startReportsLoading,
  ])

  const openAdvanceReport = useCallback(
    (row: AdvancedReportRow) => {
      if (row.order.NetUid) {
        navigate(`${OUTGOING_CASHFLOW_ROUTE}/${encodeURIComponent(row.order.NetUid)}/advanced-report/view`, {
          state: {
            backgroundLocation: location,
            returnPath: `${location.pathname}${location.search}`,
          },
        })
      }
    },
    [location, navigate],
  )

  const handleRowClick = useCallback(
    (row: AdvancedReportRow) => {
      if (row.isUnderReport && row.order.NetUid) {
        openAdvanceReport(row)
        return
      }

      setSelectedRow(row)
    },
    [openAdvanceReport, setSelectedRow],
  )

  const openDocumentStructure = useCallback(
    (row: AdvancedReportRow) => {
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
      void calculateAdvancedReportOrder(orderToCalculate)
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

  const rows = useMemo(() => buildAdvancedReportRows(reports.Collection), [reports.Collection])
  const columns = useAdvancedReportColumns({
    onEdit: openAdvanceReport,
    onOpen: setSelectedRow,
    onOpenDocumentStructure: openDocumentStructure,
  })
  const isTableBusy = isLoading || isSearchSettling

  const changeFromDate = useCallback(
    (value: string) => {
      setPage(1)
      setFromDate(value)
    },
    [setFromDate, setPage],
  )

  const changeToDate = useCallback(
    (value: string) => {
      setPage(1)
      setToDate(value)
    },
    [setPage, setToDate],
  )

  const changeSearchValue = useCallback(
    (value: string) => {
      setPage(1)
      setSearchValue(value)
    },
    [setPage, setSearchValue],
  )

  const changeCurrencyNetId = useCallback(
    (value: string) => {
      setPage(1)
      setCurrencyNetId(value)
    },
    [setCurrencyNetId, setPage],
  )

  const changePaymentRegisterNetId = useCallback(
    (value: string) => {
      setPage(1)
      setPaymentRegisterNetId(value)
    },
    [setPage, setPaymentRegisterNetId],
  )

  const changePaymentMovementNetId = useCallback(
    (value: string) => {
      setPage(1)
      setPaymentMovementNetId(value)
    },
    [setPage, setPaymentMovementNetId],
  )

  const changePageSize = useCallback(
    (value: string | null) => {
      setPage(1)
      setPageSize(Number(value || DEFAULT_PAGE_SIZE))
    },
    [setPage, setPageSize],
  )

  const resetFilters = useCallback(() => {
    setPage(1)
    setFromDate(shiftDate(-7))
    setToDate(formatLocalDate(new Date()))
    setSearchValue('')
    setCurrencyNetId('')
    setPaymentRegisterNetId('')
    setPaymentMovementNetId('')
  }, [setCurrencyNetId, setFromDate, setPage, setPaymentMovementNetId, setPaymentRegisterNetId, setSearchValue, setToDate])

  const handleRefresh = useCallback(() => {
    void loadLookups()
    reload()
  }, [loadLookups])

  return (
    <Stack className="advanced-reports-page" gap={6}>
      <Card className="app-data-card advanced-reports-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar advanced-reports-filter-bar">
          <Stack className="advanced-reports-filter-content" gap={8}>
            <Group align="end" gap={10} wrap="nowrap" className="advanced-reports-filter-row">
              <div className="app-filter-date-range">
                <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => changeFromDate(event.currentTarget.value)} />
                <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => changeToDate(event.currentTarget.value)} />
              </div>
              <TextInput
                leftSection={<Search size={16} />}
                label={t('Пошук')}
                placeholder={t('Номер, організація, отримувач або коментар')}
                value={searchValue}
                style={{ flex: '1 1 auto', minWidth: 220 }}
                onChange={(event) => changeSearchValue(event.currentTarget.value)}
              />
              <Select
                clearable
                searchable
                data={toSelectOptions(currencies, (currency) => currency.Name || currency.Code)}
                label={t('Валюта')}
                placeholder={t('Усі')}
                value={currencyNetId || null}
                w={210}
                onChange={(value) => changeCurrencyNetId(value || '')}
              />
              <Select
                clearable
                searchable
                data={toSelectOptions(paymentRegisters, (register) => register.Name)}
                label={t('Грошовий рахунок')}
                placeholder={t('Усі')}
                value={paymentRegisterNetId || null}
                w={260}
                onChange={(value) => changePaymentRegisterNetId(value || '')}
              />
              <Select
                clearable
                searchable
                data={toSelectOptions(paymentMovements, (movement) => movement.OperationName)}
                label={t('Стаття руху')}
                placeholder={t('Усі')}
                value={paymentMovementNetId || null}
                w={300}
                onChange={(value) => changePaymentMovementNetId(value || '')}
              />
              <div className="app-filter-actions">
                <Tooltip label={t('Скинути фільтри')}>
                  <ActionIcon variant="light" color="gray" size={34} aria-label={t('Скинути фільтри')} onClick={resetFilters}>
                    <RotateCcw size={17} />
                  </ActionIcon>
                </Tooltip>
                <DataTableDensityToggle density={density} onToggle={toggleDensity} size={34} />
                <Paginator
                  isLoading={isTableBusy || isLoadingLookups}
                  page={page}
                  pageSize={pageSize}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(nextPageSize) => changePageSize(String(nextPageSize))}
                  onRefresh={handleRefresh}
                />
              </div>
            </Group>
          </Stack>
        </div>

        {error && (
          <Alert className="advanced-reports-page__alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {filterError && (
          <Alert className="advanced-reports-page__alert" color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {filterError}
          </Alert>
        )}

        <div className="advanced-reports-page__table">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText={t('Авансових звітів не знайдено')}
            getRowId={(row) => row.id}
            height="100%"
            isLoading={isTableBusy}
            layoutVersion="advanced-reports-1"
            minWidth={1720}
            tableId="advanced-reports"
            footer={
              <Group className="advanced-reports-table-footer" gap="xs" justify="flex-end" wrap="nowrap">
                <Badge className="app-role-pill is-green" variant="light">
                  {t('Кредиторська заборгованість')}: {formatMoney(reports.PositiveDifferenceAmount)}
                </Badge>
                <Badge className="app-role-pill is-red" variant="light">
                  {t('Дебіторська заборгованість')}: {formatMoney(reports.NegativeDifferenceAmount)}
                </Badge>
              </Group>
            }
            onRowClick={handleRowClick}
          />
        </div>
      </Card>

      <AdvancedReportDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      <AdvancedReportDocumentStructureDrawer
        calculatedOrder={structureCalculatedOrder}
        calculationError={structureCalculationError}
        isCalculating={isCalculatingStructure}
        row={structureRow}
        onClose={closeDocumentStructure}
      />
    </Stack>
  )
}

function useAdvancedReportColumns({
  onEdit,
  onOpen,
  onOpenDocumentStructure,
}: {
  onEdit: (row: AdvancedReportRow) => void
  onOpen: (row: AdvancedReportRow) => void
  onOpenDocumentStructure: (row: AdvancedReportRow) => void
}): DataTableColumn<AdvancedReportRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<AdvancedReportRow>[]>(
    () => [
      {
        id: 'fromDate',
        header: t('Дата'),
        width: 145,
        minWidth: 130,
        accessor: (row) => row.fromDate,
        cell: (row) => (
          <Text
            size="sm"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}
            title={formatDateTime(row.fromDate)}
          >
            {formatDateTime(row.fromDate)}
          </Text>
        ),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 130,
        minWidth: 110,
        accessor: (row) => row.number,
        cell: (row) => (
          <Text
            fw={600}
            size="sm"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0, textTransform: 'uppercase' }}
            title={displayValue(row.number)}
          >
            {displayValue(row.number)}
          </Text>
        ),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.organization,
        cell: (row) => renderSingleLineText(row.organization),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 145,
        minWidth: 115,
        accessor: (row) => row.storage,
        cell: (row) => renderSingleLineText(row.storage),
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
        cell: (row) => renderSingleLineText(row.currency),
      },
      {
        id: 'payedTo',
        header: t('Кому видано'),
        width: 290,
        minWidth: 220,
        accessor: (row) => row.payedTo,
        cell: (row) => <PayedToCell row={row} />,
      },
      {
        id: 'role',
        header: t('Роль'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.role,
        cell: (row) => renderSingleLineText(row.role),
      },
      {
        id: 'paymentRegister',
        header: t('Грошовий рахунок'),
        width: 210,
        minWidth: 160,
        accessor: (row) => row.paymentRegister,
        cell: (row) => renderSingleLineText(row.paymentRegister),
      },
      {
        id: 'paymentMovement',
        header: t('Стаття руху'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.paymentMovement,
        cell: (row) => renderSingleLineText(row.paymentMovement),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 155,
        minWidth: 125,
        accessor: (row) => row.responsible,
        cell: (row) => renderSingleLineText(row.responsible),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 230,
        minWidth: 170,
        accessor: (row) => row.comment,
        cell: (row) => renderSingleLineText(row.comment),
      },
      {
        id: 'operations',
        header: '',
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <Menu position="bottom-end" shadow="md" width={230} withinPortal>
            <Menu.Target>
              <ActionIcon
                aria-label={t('Операції')}
                color="gray"
                size="sm"
                variant="subtle"
                onClick={(event) => event.stopPropagation()}
              >
                <EllipsisVertical size={16} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
              <Menu.Item leftSection={<Eye size={16} />} onClick={() => onOpen(row)}>
                {t('Деталі видаткового ордера')}
              </Menu.Item>
              <Menu.Item
                disabled={!row.isUnderReport || !row.order.NetUid}
                leftSection={<SquarePen size={16} />}
                onClick={() => onEdit(row)}
              >
                {t('Авансовий звіт')}
              </Menu.Item>
              <Menu.Item
                disabled={!row.hasDocumentStructure}
                leftSection={<Network size={16} />}
                onClick={() => onOpenDocumentStructure(row)}
              >
                {row.hasDocumentStructure ? t('Структура документів') : t('Структура документів відсутня')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [onEdit, onOpen, onOpenDocumentStructure, t],
  )
}

function PayedToCell({ row }: { row: AdvancedReportRow }) {
  const { t } = useI18n()
  const title = [
    displayValue(row.payedTo),
    row.isUnderReport ? t('Підзвіт') : '',
    row.rootAssigned ? t('Підзвіт') : '',
    row.differenceAmount ? formatMoney(row.differenceAmount) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Group gap={6} title={title} wrap="nowrap">
      <Text size="sm">{displayValue(row.payedTo)}</Text>
      {row.isUnderReport && (
        <Badge className="app-role-pill is-gray" size="xs" variant="light">
          {t('Підзвіт')}
        </Badge>
      )}
      {row.rootAssigned && (
        <Badge className="app-role-pill is-gray" size="xs" variant="light">
          {t('Підзвіт')}
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

function AdvancedReportDetailDrawer({ row, onClose }: { row: AdvancedReportRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const relatedOrders = getActiveRelatedConsumableOrders(row?.order)

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={t('Авансовий звіт')} onClose={onClose}>
      {row && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Дата')} mono value={formatDateTime(row.fromDate)} />
            <DetailItem label={t('Номер')} value={displayValue(row.number)} />
            <DetailItem label={t('Видатковий ордер')} value={displayValue(row.order.Number || row.order.CustomNumber)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Склад')} value={displayValue(row.storage)} />
            <DetailItem label={t('Сума')} mono value={formatMoney(row.amount)} />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Курс')} value={displayValue(row.order.ExchangeRate)} />
            <DetailItem label={t('Сума в EUR')} mono value={hasNumber(row.order.AfterExchangeAmount) ? formatMoney(row.order.AfterExchangeAmount) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ %')} value={hasNumber(row.order.VatPercent) ? displayValue(row.order.VatPercent) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ')} mono value={hasNumber(row.order.VAT) ? formatMoney(row.order.VAT) : displayValue(undefined)} />
            <DetailItem label={t('Кому видано')} value={displayValue(row.payedTo)} />
            <DetailItem label={t('Роль')} value={displayValue(row.role)} />
            <DetailItem label={t('Рахунок')} value={displayValue(row.paymentRegister)} />
            <DetailItem label={t('Стаття руху')} value={displayValue(row.paymentMovement)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Різниця')} mono value={formatMoney(row.differenceAmount)} />
            <DetailItem label={t('Підзвіт')} value={row.isUnderReport ? t('Так') : t('Ні')} />
            <DetailItem label={t('Закрито')} value={row.order.IsUnderReportDone ? t('Так') : t('Ні')} />
            <DetailItem label={t('Бухгалтерський')} value={row.order.IsAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Управлінський')} value={row.order.IsManagementAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Вхідний номер')} value={displayValue(row.order.ArrivalNumber)} />
            <DetailItem label={t('Призначення платежу')} value={displayValue(row.order.PaymentPurpose)} />
          </SimpleGrid>

          <Stack gap={2}>
            <Text c="dimmed" size="xs" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{displayValue(row.comment)}</Text>
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text className="app-section-title" fw={600} size="sm">{t('Пов’язані документи')}</Text>
            {relatedOrders.length > 0 ? (
              relatedOrders.map((item, index) => {
                const order = item.ConsumablesOrder
                const itemsCount = order?.ConsumablesOrderItems?.length || 0

                return (
                  <SimpleGrid key={getRelatedOrderKey(item, index)} cols={{ base: 1, sm: 2 }}>
                    <DetailItem label={t('Документ')} value={displayValue(order?.Number)} />
                    <DetailItem label={t('Номер організації')} value={displayValue(order?.OrganizationNumber)} />
                    <DetailItem label={t('Дата організації')} mono value={formatDateTime(order?.OrganizationFromDate)} />
                    <DetailItem label={t('Постачальник/отримувач')} value={displayValue(getEntityName(order?.ConsumableProductOrganization))} />
                    <DetailItem label={t('Склад')} value={displayValue(getEntityName(order?.ConsumablesStorage))} />
                    <DetailItem label={t('Позицій')} value={String(itemsCount)} />
                    <DetailItem label={t('Сума без ПДВ')} mono value={formatMoney(order?.TotalAmountWithoutVAT)} />
                    <DetailItem label={t('Сума з ПДВ')} value={formatMoney(order?.TotalAmount)} />
                  </SimpleGrid>
                )
              })
            ) : (
              <Text c="dimmed" size="sm">
                {t('Пов’язаних документів немає')}
              </Text>
            )}
          </Stack>
        </Stack>
      )}
    </AppDrawer>
  )
}

function AdvancedReportDocumentStructureDrawer({
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
  row: AdvancedReportRow | null
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
            <DetailItem label={t('Документ')} value={getOutcomePaymentOrderTypeLabel(row.order, t)} />
            <DetailItem label={t('Видатковий ордер')} value={displayValue(row.order.Number || row.order.CustomNumber || row.number)} />
            <DetailItem label={t('Дата')} mono value={formatDateTime(row.fromDate)} />
            <DetailItem label={t('Сума')} mono value={formatMoney(row.amount)} />
            <DetailItem
              label={t('Перерахована сума')}
              value={hasNumber(calculatedTotal) ? formatMoneyWithCurrency(calculatedTotal, row.currency) : displayValue(undefined)}
            />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Курс')} value={displayValue(row.order.ExchangeRate)} />
            <DetailItem label={t('Сума в EUR')} mono value={hasNumber(row.order.AfterExchangeAmount) ? formatMoney(row.order.AfterExchangeAmount) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ %')} value={hasNumber(row.order.VatPercent) ? displayValue(row.order.VatPercent) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ')} mono value={hasNumber(row.order.VAT) ? formatMoney(row.order.VAT) : displayValue(undefined)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Рахунок')} value={displayValue(row.paymentRegister)} />
            <DetailItem label={t('Стаття руху')} value={displayValue(row.paymentMovement)} />
            <DetailItem label={t('Вхідний номер')} value={displayValue(row.order.ArrivalNumber)} />
            <DetailItem label={t('Призначення платежу')} value={displayValue(row.order.PaymentPurpose)} />
            <DetailItem label={t('Кому видано')} value={displayValue(row.payedTo)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Коментар')} value={displayValue(row.comment)} />
            <DetailItem label={t('Бухгалтерський')} value={row.order.IsAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Управлінський')} value={row.order.IsManagementAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Підзвіт')} value={row.isUnderReport ? t('Так') : t('Ні')} />
            <DetailItem label={t('Авансовий звіт')} value={displayValue(row.order.AdvanceNumber || row.number)} />
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
      <DetailItem label={t('Номер')} value={displayValue(order.Number || order.CustomNumber || order.AdvanceNumber)} />
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
      <DetailItem label={t('Платник')} value={displayValue(getEntityName(order.Colleague))} />
    </SimpleGrid>
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

function getTotalRows(reports: AdvancedReportsResponse): number {
  const total = reports.TotalRowsQty ?? reports.Collection[0]?.TotalRowsQty

  return typeof total === 'number' && Number.isFinite(total) ? total : reports.Collection.length
}

function buildAdvancedReportRows(orders: OutcomePaymentOrder[]): AdvancedReportRow[] {
  const rows: AdvancedReportRow[] = []

  for (const order of orders) {
    if (!order.AdvanceNumber) {
      continue
    }

    rows.push(toAdvancedReportRow(order, rows.length))
  }

  return rows
}

function toAdvancedReportRow(order: OutcomePaymentOrder, index: number): AdvancedReportRow {
  const firstConsumablesOrder = order.OutcomePaymentOrderConsumablesOrders?.[0]?.ConsumablesOrder

  return {
    amount: order.Amount,
    comment: order.Comment,
    currency: order.PaymentCurrencyRegister?.Currency?.Code || order.PaymentCurrencyRegister?.Currency?.Name,
    differenceAmount: order.DifferenceAmount,
    fromDate: order.FromDate,
    hasDocumentStructure: hasDocumentStructure(order),
    id: String(order.NetUid || order.Id || index),
    isUnderReport: order.IsUnderReport,
    number: order.AdvanceNumber,
    order,
    organization: getEntityName(order.Organization),
    payedTo: getPayedTo(order),
    paymentMovement: order.PaymentMovementOperation?.PaymentMovement?.OperationName,
    paymentRegister: order.PaymentCurrencyRegister?.PaymentRegister?.Name,
    responsible: getEntityName(order.User),
    role: order.Colleague?.UserRole?.Name,
    rootAssigned: Boolean(order.RootAssignedPaymentOrder),
    storage: getEntityName(firstConsumablesOrder?.ConsumablesStorage),
  }
}

function getPayedTo(order: OutcomePaymentOrder): string | undefined {
  const colleagueName = getEntityName(order.Colleague)

  if (colleagueName) {
    return colleagueName
  }

  const organizations = getConsumableProductOrganizationNames(order.OutcomePaymentOrderConsumablesOrders || [])

  return unique(organizations).join(' ') || undefined
}

function getConsumableProductOrganizationNames(
  items: NonNullable<OutcomePaymentOrder['OutcomePaymentOrderConsumablesOrders']>,
): string[] {
  const names: string[] = []

  for (const item of items) {
    const name = getEntityName(item.ConsumablesOrder?.ConsumableProductOrganization)

    if (name) {
      names.push(name)
    }
  }

  return names
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return joinTruthyParts(entity?.FirstName, entity?.LastName, entity?.MiddleName)
    || entity?.LastName
    || entity?.FullName
    || entity?.Name
    || entity?.OperationName
    || entity?.Code
    || entity?.Number
}

function hasDocumentStructure(order: OutcomePaymentOrder): boolean {
  return Boolean(order.RootAssignedPaymentOrder && !order.RootAssignedPaymentOrder.Deleted) ||
    Boolean((order.AssignedPaymentOrders || []).some((assignedPaymentOrder) => !assignedPaymentOrder.Deleted))
}

function getDocumentStructureOutcomeToCalculate(order: OutcomePaymentOrder): OutcomePaymentOrder | null {
  const rootOutcome = order.RootAssignedPaymentOrder?.AssignedOutcomePaymentOrder
    || order.RootAssignedPaymentOrder?.RootOutcomePaymentOrder
    || null

  if (rootOutcome && !rootOutcome.Deleted) {
    return rootOutcome
  }

  if (getActiveAssignedPaymentOrders(order.AssignedPaymentOrders).length > 0) {
    return order
  }

  return null
}

function getActiveAssignedPaymentOrders(orders?: AssignedPaymentOrder[]): AssignedPaymentOrder[] {
  return (orders || []).filter((assignedPaymentOrder) => !assignedPaymentOrder.Deleted)
}

function getActiveRelatedConsumableOrders(
  order?: OutcomePaymentOrder | null,
): NonNullable<OutcomePaymentOrder['OutcomePaymentOrderConsumablesOrders']> {
  return (order?.OutcomePaymentOrderConsumablesOrders || []).filter(
    (item) => !item.Deleted && item.ConsumablesOrder && !item.ConsumablesOrder.Deleted,
  )
}

function getRelatedOrderKey(
  item: NonNullable<OutcomePaymentOrder['OutcomePaymentOrderConsumablesOrders']>[number],
  index: number,
): string {
  return String(item.NetUid || item.Id || item.ConsumablesOrder?.NetUid || item.ConsumablesOrder?.Id || `related-${index}`)
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

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function joinTruthyParts(...parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ')
}

function toSelectOptions<T extends { NetUid?: string }>(items: T[], getLabel: (item: T) => string | undefined) {
  return items.flatMap((item) => {
    if (!item.NetUid) {
      return []
    }

    return [
      {
        label: getLabel(item) || item.NetUid,
        value: item.NetUid,
      },
    ]
  })
}

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
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
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function formatMoneyWithCurrency(value?: number, currency?: string): string {
  if (!hasNumber(value)) {
    return displayValue(undefined)
  }

  const formatted = formatMoney(value)

  return currency ? `${formatted} ${currency}` : formatted
}

function hasNumber(value?: number): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function renderSingleLineText(value?: string | number | null) {
  const text = displayValue(value)

  return (
    <Text size="sm" title={text}>
      {text}
    </Text>
  )
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
