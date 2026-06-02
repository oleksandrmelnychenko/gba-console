import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconDotsVertical,
  IconEdit,
  IconEye,
  IconHierarchy2,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
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

const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100']
const DEFAULT_PAGE_SIZE = 20
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
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const filterError = getDateRangeError(fromDate, toDate)
  const lookupRequestRef = useRef(0)

  const offset = (page - 1) * pageSize
  const totalRows = getTotalRows(reports.Collection)
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
        navigate(`${OUTGOING_CASHFLOW_ROUTE}/${encodeURIComponent(row.order.NetUid)}/advanced-report/view`)
      }
    },
    [navigate],
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

  const rows = useMemo(() => buildAdvancedReportRows(reports.Collection), [reports.Collection])
  const columns = useAdvancedReportColumns({
    onEdit: openAdvanceReport,
    onOpen: setSelectedRow,
    onOpenDocumentStructure: setStructureRow,
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

  return (
    <Stack gap="md">
      <Group align="end" justify="space-between" gap="sm">
        <Group align="end" gap="sm">
          <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => changeFromDate(event.currentTarget.value)} />
          <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => changeToDate(event.currentTarget.value)} />
          <TextInput
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Номер, організація, отримувач або коментар')}
            value={searchValue}
            w={340}
            onChange={(event) => changeSearchValue(event.currentTarget.value)}
          />
        </Group>

        <Group align="end" gap="xs">
          <Tooltip label={t('Скинути фільтри')}>
            <Button color="gray" leftSection={<IconX size={16} />} variant="light" onClick={resetFilters}>
              {t('Скинути')}
            </Button>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading || isLoadingLookups}
              size={38}
              variant="light"
              onClick={() => {
                void loadLookups()
                reload()
              }}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Group align="end" gap="sm">
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
          label={t('Рахунок')}
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
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {filterError && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {filterError}
        </Alert>
      )}

      <Group gap="xs" justify="space-between">
        <Group gap="xs">
          <Badge color="blue" variant="light">
            {t('Завантажено')}: {reports.Collection.length}
          </Badge>
          <Badge color="gray" variant="light">
            {t('Рядків')}: {rows.length}
          </Badge>
          <Badge color="green" variant="light">
            {t('Кредиторська заборгованість')}: {formatMoney(reports.PositiveDifferenceAmount)}
          </Badge>
          <Badge color="red" variant="light">
            {t('Дебіторська заборгованість')}: {formatMoney(reports.NegativeDifferenceAmount)}
          </Badge>
        </Group>
        <Select
          aria-label={t('Кількість рядків')}
          data={PAGE_SIZE_OPTIONS}
          size="xs"
          value={String(pageSize)}
          w={88}
          onChange={changePageSize}
        />
      </Group>

      <DataTable
        columns={columns}
        data={rows}
        defaultLayout={TABLE_DEFAULT_LAYOUT}
        emptyText={t('Авансових звітів не знайдено')}
        getRowId={(row) => row.id}
        isLoading={isTableBusy}
        layoutVersion="advanced-reports-1"
        maxHeight="calc(100vh - 315px)"
        minWidth={1720}
        tableId="advanced-reports"
        onRowClick={handleRowClick}
      />

      {totalPages > 1 && (
        <Group justify="flex-end">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}

      <AdvancedReportDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      <AdvancedReportDocumentStructureDrawer row={structureRow} onClose={() => setStructureRow(null)} />
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
        cell: (row) => formatDateTime(row.fromDate),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 130,
        minWidth: 110,
        accessor: (row) => row.number,
        cell: (row) => <Text fw={600}>{displayValue(row.number)}</Text>,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.organization,
        cell: (row) => displayValue(row.organization),
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 145,
        minWidth: 115,
        accessor: (row) => row.storage,
        cell: (row) => displayValue(row.storage),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => formatMoney(row.amount),
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
        cell: (row) => displayValue(row.role),
      },
      {
        id: 'paymentRegister',
        header: t('Рахунок'),
        width: 210,
        minWidth: 160,
        accessor: (row) => row.paymentRegister,
        cell: (row) => displayValue(row.paymentRegister),
      },
      {
        id: 'paymentMovement',
        header: t('Стаття руху'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.paymentMovement,
        cell: (row) => displayValue(row.paymentMovement),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 155,
        minWidth: 125,
        accessor: (row) => row.responsible,
        cell: (row) => displayValue(row.responsible),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 230,
        minWidth: 170,
        accessor: (row) => row.comment,
        cell: (row) => displayValue(row.comment),
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
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
              <Menu.Item leftSection={<IconEye size={16} />} onClick={() => onOpen(row)}>
                {t('Деталі видаткового ордера')}
              </Menu.Item>
              <Menu.Item
                disabled={!row.isUnderReport || !row.order.NetUid}
                leftSection={<IconEdit size={16} />}
                onClick={() => onEdit(row)}
              >
                {t('Авансовий звіт')}
              </Menu.Item>
              <Menu.Item
                disabled={!row.hasDocumentStructure}
                leftSection={<IconHierarchy2 size={16} />}
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

  return (
    <Group gap={6} wrap="nowrap">
      <Text size="sm">{displayValue(row.payedTo)}</Text>
      {row.isUnderReport && (
        <Badge color="indigo" size="xs" variant="light">
          {t('Підзвіт')}
        </Badge>
      )}
      {row.rootAssigned && (
        <Badge color="gray" size="xs" variant="light">
          {t('Підзвіт')}
        </Badge>
      )}
      {Boolean(row.differenceAmount) && (
        <Text c={(row.differenceAmount || 0) < 0 ? 'red' : 'green'} fw={700} size="sm">
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
            <DetailItem label={t('Дата')} value={formatDateTime(row.fromDate)} />
            <DetailItem label={t('Номер')} value={displayValue(row.number)} />
            <DetailItem label={t('Видатковий ордер')} value={displayValue(row.order.Number || row.order.CustomNumber)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Склад')} value={displayValue(row.storage)} />
            <DetailItem label={t('Сума')} value={formatMoney(row.amount)} />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Курс')} value={displayValue(row.order.ExchangeRate)} />
            <DetailItem label={t('Сума в EUR')} value={hasNumber(row.order.AfterExchangeAmount) ? formatMoney(row.order.AfterExchangeAmount) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ %')} value={hasNumber(row.order.VatPercent) ? displayValue(row.order.VatPercent) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ')} value={hasNumber(row.order.VAT) ? formatMoney(row.order.VAT) : displayValue(undefined)} />
            <DetailItem label={t('Кому видано')} value={displayValue(row.payedTo)} />
            <DetailItem label={t('Роль')} value={displayValue(row.role)} />
            <DetailItem label={t('Рахунок')} value={displayValue(row.paymentRegister)} />
            <DetailItem label={t('Стаття руху')} value={displayValue(row.paymentMovement)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Різниця')} value={formatMoney(row.differenceAmount)} />
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
            <Text fw={700}>{t('Пов’язані документи')}</Text>
            {relatedOrders.length > 0 ? (
              relatedOrders.map((item, index) => {
                const order = item.ConsumablesOrder
                const itemsCount = order?.ConsumablesOrderItems?.length || 0

                return (
                  <SimpleGrid key={getRelatedOrderKey(item, index)} cols={{ base: 1, sm: 2 }}>
                    <DetailItem label={t('Документ')} value={displayValue(order?.Number)} />
                    <DetailItem label={t('Номер організації')} value={displayValue(order?.OrganizationNumber)} />
                    <DetailItem label={t('Дата організації')} value={formatDateTime(order?.OrganizationFromDate)} />
                    <DetailItem label={t('Постачальник/отримувач')} value={displayValue(getEntityName(order?.ConsumableProductOrganization))} />
                    <DetailItem label={t('Склад')} value={displayValue(getEntityName(order?.ConsumablesStorage))} />
                    <DetailItem label={t('Позицій')} value={String(itemsCount)} />
                    <DetailItem label={t('Сума без ПДВ')} value={formatMoney(order?.TotalAmountWithoutVAT)} />
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
  onClose,
  row,
}: {
  onClose: () => void
  row: AdvancedReportRow | null
}) {
  const { t } = useI18n()
  const assignedOrders = row?.order.AssignedPaymentOrders || []
  const rootAssignedOrder = row?.order.RootAssignedPaymentOrder || null

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={t('Структура документів')} onClose={onClose}>
      {row && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Видатковий ордер')} value={displayValue(row.order.Number || row.order.CustomNumber || row.number)} />
            <DetailItem label={t('Дата')} value={formatDateTime(row.fromDate)} />
            <DetailItem label={t('Сума')} value={formatMoney(row.amount)} />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Курс')} value={displayValue(row.order.ExchangeRate)} />
            <DetailItem label={t('Сума в EUR')} value={hasNumber(row.order.AfterExchangeAmount) ? formatMoney(row.order.AfterExchangeAmount) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ %')} value={hasNumber(row.order.VatPercent) ? displayValue(row.order.VatPercent) : displayValue(undefined)} />
            <DetailItem label={t('ПДВ')} value={hasNumber(row.order.VAT) ? formatMoney(row.order.VAT) : displayValue(undefined)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Рахунок')} value={displayValue(row.paymentRegister)} />
            <DetailItem label={t('Стаття руху')} value={displayValue(row.paymentMovement)} />
            <DetailItem label={t('Призначення платежу')} value={displayValue(row.order.PaymentPurpose)} />
            <DetailItem label={t('Підзвіт')} value={row.isUnderReport ? t('Так') : t('Ні')} />
            <DetailItem label={t('Авансовий звіт')} value={displayValue(row.order.AdvanceNumber || row.number)} />
          </SimpleGrid>

          <Divider />

          <Stack gap="sm">
            {rootAssignedOrder && !rootAssignedOrder.Deleted && (
              <AssignedPaymentOrderBlock assignedPaymentOrder={rootAssignedOrder} parentOrder={row.order} title={t('Кореневий документ')} />
            )}

            {assignedOrders.filter((assignedPaymentOrder) => !assignedPaymentOrder.Deleted).length > 0 ? (
              assignedOrders
                .filter((assignedPaymentOrder) => !assignedPaymentOrder.Deleted)
                .map((assignedPaymentOrder, index) => (
                  <AssignedPaymentOrderBlock
                    key={getAssignedPaymentOrderKey(assignedPaymentOrder, index)}
                    assignedPaymentOrder={assignedPaymentOrder}
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
  parentOrder,
  title,
}: {
  assignedPaymentOrder: AssignedPaymentOrder
  parentOrder: OutcomePaymentOrder
  title: string
}) {
  const { t } = useI18n()
  const assignedOutcome = assignedPaymentOrder.AssignedOutcomePaymentOrder || assignedPaymentOrder.RootOutcomePaymentOrder
  const assignedIncome = assignedPaymentOrder.AssignedIncomePaymentOrder || assignedPaymentOrder.RootIncomePaymentOrder

  return (
    <Stack gap="xs">
      <Group gap="xs">
        <IconHierarchy2 size={16} />
        <Text fw={700}>{title}</Text>
      </Group>
      <AdvanceReportStructureSummary
        assignedPaymentOrder={assignedPaymentOrder}
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
  parentOrder,
}: {
  assignedPaymentOrder: AssignedPaymentOrder
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

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <DetailItem label={t('Авансовий звіт')} value={displayValue(parentOrder.AdvanceNumber)} />
      <DetailItem label={t('Дата авансового звіту')} value={formatDateTime(assignedOutcome?.Created || assignedOutcome?.FromDate || parentOrder.FromDate)} />
      <DetailItem label={t('Сума авансового звіту')} value={formatMoneyWithCurrency(parentOrder.Amount, currency)} />
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

function getTotalRows(orders: OutcomePaymentOrder[]): number {
  const total = orders[0]?.TotalRowsQty

  return typeof total === 'number' && Number.isFinite(total) ? total : orders.length
}

function buildAdvancedReportRows(orders: OutcomePaymentOrder[]): AdvancedReportRow[] {
  const rows: AdvancedReportRow[] = []

  for (const order of orders) {
    if (!order.AdvanceNumber?.trim()) {
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

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
