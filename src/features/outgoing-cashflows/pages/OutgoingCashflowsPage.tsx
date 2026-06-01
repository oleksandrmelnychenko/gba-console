import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconEdit, IconEye, IconHierarchy2, IconPlus, IconRefresh, IconSearch, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  cancelOutgoingCashflow,
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

const PAGE_SIZE = 100
const SEARCH_DEBOUNCE_MS = 350

const ADVANCE_REPORT_ROUTE = '/accounting/outgoing-cashflow'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'number'],
    right: ['documentStructure', 'editReport', 'cancel', 'actions'],
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

export function OutgoingCashflowsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
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
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [searchValue, setSearchValue] = useValueState('')
  const [currencyNetId, setCurrencyNetId] = useValueState('')
  const [paymentRegisterNetId, setPaymentRegisterNetId] = useValueState('')
  const [paymentMovementNetId, setPaymentMovementNetId] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [isLoadingLookups, setLoadingLookups] = useValueState(false)
  const [hasMore, setHasMore] = useValueState(false)
  const [selectedRow, setSelectedRow] = useValueState<OutgoingCashflowRow | null>(null)
  const [structureRow, setStructureRow] = useValueState<OutgoingCashflowRow | null>(null)
  const [cancelRow, setCancelRow] = useValueState<OutgoingCashflowRow | null>(null)
  const [isCanceling, setCanceling] = useValueState(false)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const filterError = getDateRangeError(fromDate, toDate)
  const requestRef = useRef(0)
  const didInitOrganizationsRef = useRef(false)

  const organizationOptions = useMemo(() => toOrganizationOptions(organizations), [organizations])

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

  const loadCashflows = useCallback(async (offset: number, append: boolean) => {
    if (filterError) {
      requestRef.current += 1

      if (!append) {
        setCashflows({
          Collection: [],
          NegativeDifferenceAmount: 0,
          PositiveDifferenceAmount: 0,
        })
      }

      setError(null)
      setHasMore(false)
      setLoading(false)
      setLoadingMore(false)
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const nextCashflows = await getOutgoingCashflows({
        currencyNetId,
        from: fromDate,
        limit: PAGE_SIZE,
        offset,
        organizationIds: selectedOrganizationIds,
        paymentMovementNetId,
        registerNetId: paymentRegisterNetId,
        to: toDate,
        value: normalizedSearchValue,
      })

      if (requestRef.current === requestId) {
        setCashflows((current) => mergeCashflowResponses(current, nextCashflows, append))
        setHasMore(nextCashflows.Collection.length === PAGE_SIZE)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        if (!append) {
          setCashflows({
            Collection: [],
            NegativeDifferenceAmount: 0,
            PositiveDifferenceAmount: 0,
          })
        }
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити видаткові ордери'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [
    currencyNetId,
    filterError,
    fromDate,
    normalizedSearchValue,
    paymentMovementNetId,
    paymentRegisterNetId,
    selectedOrganizationIds,
    setCashflows,
    setError,
    setHasMore,
    setLoading,
    setLoadingMore,
    t,
    toDate,
  ])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    void loadCashflows(0, false)
  }, [loadCashflows])

  const openAdvanceReport = useCallback(
    (row: OutgoingCashflowRow) => {
      if (row.order.NetUid) {
        navigate(`${ADVANCE_REPORT_ROUTE}/${encodeURIComponent(row.order.NetUid)}/advanced-report/view`)
      }
    },
    [navigate],
  )

  const rows = useMemo(() => buildCashflowRows(cashflows.Collection), [cashflows.Collection])
  const columns = useOutgoingCashflowColumns({
    onCancel: setCancelRow,
    onEditReport: openAdvanceReport,
    onOpenDocumentStructure: setStructureRow,
    onOpen: setSelectedRow,
  })
  const isTableBusy = isLoading || isSearchSettling

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
      void loadCashflows(0, false)
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати видатковий ордер'))
    } finally {
      setCanceling(false)
    }
  }, [cancelRow, isCanceling, loadCashflows, setCancelRow, setCanceling, setError, t])

  return (
    <Stack gap="md">
      <Group align="end" justify="space-between" gap="sm">
        <Group align="end" gap="sm">
          <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
          <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
          <TextInput
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Номер, отримувач, рахунок або коментар')}
            value={searchValue}
            w={340}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
        </Group>

        <Group align="end" gap="xs">
          <Button
            color="violet"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/accounting/outgoing-cashflow/new')}
          >
            {t('Новий')}
          </Button>
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
                void loadCashflows(0, false)
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
          w={190}
          onChange={(value) => setCurrencyNetId(value || '')}
        />
        <Select
          clearable
          searchable
          data={toSelectOptions(paymentRegisters, (register) => register.Name)}
          label={t('Рахунок')}
          placeholder={t('Усі')}
          value={paymentRegisterNetId || null}
          w={250}
          onChange={(value) => setPaymentRegisterNetId(value || '')}
        />
        <Select
          clearable
          searchable
          data={toSelectOptions(paymentMovements, (movement) => movement.OperationName)}
          label={t('Стаття руху')}
          placeholder={t('Усі')}
          value={paymentMovementNetId || null}
          w={280}
          onChange={(value) => setPaymentMovementNetId(value || '')}
        />
        <MultiSelect
          clearable
          searchable
          data={organizationOptions}
          label={t('Організації')}
          placeholder={t('Без фільтра')}
          value={selectedOrganizationIds}
          w={360}
          onChange={setSelectedOrganizationIds}
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

      <Group gap="xs">
        <Badge color="violet" variant="light">
          {t('Завантажено')}: {cashflows.Collection.length}
        </Badge>
        <Badge color="gray" variant="light">
          {t('Рядків')}: {rows.length}
        </Badge>
        <Badge color="green" variant="light">
          {t('Кредиторська заборгованість')}: {formatMoney(cashflows.PositiveDifferenceAmount)}
        </Badge>
        <Badge color="red" variant="light">
          {t('Дебіторська заборгованість')}: {formatMoney(cashflows.NegativeDifferenceAmount)}
        </Badge>
      </Group>

      <DataTable
        columns={columns}
        data={rows}
        defaultLayout={TABLE_DEFAULT_LAYOUT}
        emptyText={t('Видаткових ордерів не знайдено')}
        getRowId={(row) => row.id}
        isLoading={isTableBusy}
        layoutVersion="outgoing-cashflows-1"
        maxHeight="calc(100vh - 365px)"
        minWidth={1860}
        tableId="outgoing-cashflows"
        onRowClick={setSelectedRow}
      />

      {hasMore && (
        <Group justify="center">
          <Button loading={isLoadingMore} variant="light" onClick={() => void loadCashflows(cashflows.Collection.length, true)}>
            {t('Завантажити ще')}
          </Button>
        </Group>
      )}

      <OutgoingCashflowDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      <OutgoingCashflowDocumentStructureDrawer row={structureRow} onClose={() => setStructureRow(null)} />
      <CancelOutgoingCashflowModal
        isSaving={isCanceling}
        row={cancelRow}
        onCancel={handleCancel}
        onClose={() => setCancelRow(null)}
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
        cell: (row) => formatDateTime(row.fromDate),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 135,
        minWidth: 115,
        accessor: (row) => row.number,
        cell: (row) => (
          <Group gap={6} wrap="nowrap">
            <Text fw={600} size="sm">{displayValue(row.number)}</Text>
            {row.isCanceled && (
              <Badge color="red" size="xs" variant="light">
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
        cell: (row) => formatOptionalNumber(row.totalRowsQty),
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
        id: 'documentStructure',
        header: '',
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) =>
          row.hasDocumentStructure ? (
            <Tooltip label={t('Структура документів')}>
              <ActionIcon
                aria-label={t('Структура документів')}
                color="blue"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenDocumentStructure(row)
                }}
              >
                <IconHierarchy2 size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null,
      },
      {
        id: 'editReport',
        header: '',
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) =>
          row.isUnderReport ? (
            <Tooltip label={t('Редагувати звіт')}>
              <ActionIcon
                aria-label={t('Редагувати звіт')}
                color="violet"
                disabled={!row.order.NetUid}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onEditReport(row)
                }}
              >
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
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
        cell: (row) => (
          <Tooltip label={row.isCanceled ? t('Уже скасовано') : t('Скасувати')}>
            <ActionIcon
              aria-label={t('Скасувати')}
              color="red"
              disabled={row.isCanceled || !row.order.NetUid}
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onCancel(row)
              }}
            >
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        ),
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
          <Tooltip label={t('Деталі')}>
            <ActionIcon
              aria-label={t('Деталі')}
              color="gray"
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onOpen(row)
              }}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [onCancel, onEditReport, onOpen, onOpenDocumentStructure, t],
  )
}

function StatusFlag({ active }: { active?: boolean }) {
  return active ? (
    <Badge color="green" size="xs" variant="light">
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
        <Badge color="indigo" size="xs" variant="light">
          {t('Підзвіт')}
        </Badge>
      )}
      {row.rootAssigned && (
        <Badge color="gray" size="xs" variant="light">
          {t('Призначено')}
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

function OutgoingCashflowDetailDrawer({ row, onClose }: { row: OutgoingCashflowRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const relatedOrders = getActiveRelatedConsumablesOrders(row?.order.OutcomePaymentOrderConsumablesOrders)

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={t('Видатковий ордер')} onClose={onClose}>
      {row && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Дата')} value={formatDateTime(row.fromDate)} />
            <DetailItem label={t('Номер')} value={displayValue(row.number)} />
            <DetailItem label={t('Сума')} value={formatMoney(row.amount)} />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Кому видано')} value={displayValue(row.payedTo)} />
            <DetailItem label={t('Тип операції')} value={displayValue(row.operationType)} />
            <DetailItem label={t('Рахунок')} value={displayValue(row.paymentRegister)} />
            <DetailItem label={t('Стаття руху')} value={displayValue(row.paymentMovement)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Різниця')} value={formatMoney(row.differenceAmount)} />
            <DetailItem label={t('Підзвіт')} value={row.isUnderReport ? t('Так') : t('Ні')} />
            <DetailItem label={t('Закрито')} value={row.order.IsUnderReportDone ? t('Так') : t('Ні')} />
            <DetailItem label={t('Скасовано')} value={row.isCanceled ? t('Так') : t('Ні')} />
            <DetailItem label={t('Бухгалтерський')} value={row.isAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Управлінський')} value={row.isManagementAccounting ? t('Так') : t('Ні')} />
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
                const itemsCount = getActiveConsumablesItemsCount(order)

                return (
                  <SimpleGrid key={getRelatedOrderKey(row, item, index)} cols={{ base: 1, sm: 2 }}>
                    <DetailItem label={t('Документ')} value={displayValue(order?.Number)} />
                    <DetailItem label={t('Постачальник/отримувач')} value={displayValue(getEntityName(order?.ConsumableProductOrganization))} />
                    <DetailItem label={t('Склад')} value={displayValue(getEntityName(order?.ConsumablesStorage))} />
                    <DetailItem label={t('Позицій')} value={String(itemsCount)} />
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

function OutgoingCashflowDocumentStructureDrawer({
  onClose,
  row,
}: {
  onClose: () => void
  row: OutgoingCashflowRow | null
}) {
  const { t } = useI18n()
  const assignedOrders = row?.order.AssignedPaymentOrders || []
  const rootAssignedOrder = row?.order.RootAssignedPaymentOrder || null

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={t('Структура документів')} onClose={onClose}>
      {row && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Видатковий ордер')} value={displayValue(row.number)} />
            <DetailItem label={t('Дата')} value={formatDateTime(row.fromDate)} />
            <DetailItem label={t('Сума')} value={formatMoney(row.amount)} />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Підзвіт')} value={row.isUnderReport ? t('Так') : t('Ні')} />
            <DetailItem label={t('Авансовий звіт')} value={displayValue(row.order.AdvanceNumber)} />
          </SimpleGrid>

          <Divider />

          <Stack gap="sm">
            {rootAssignedOrder && (
              <AssignedPaymentOrderBlock assignedPaymentOrder={rootAssignedOrder} title={t('Кореневий документ')} />
            )}

            {assignedOrders.length > 0 ? (
              assignedOrders.map((assignedPaymentOrder, index) => (
                <AssignedPaymentOrderBlock
                  key={getAssignedPaymentOrderKey(assignedPaymentOrder, index)}
                  assignedPaymentOrder={assignedPaymentOrder}
                  title={`${t('Пов’язаний документ')} ${index + 1}`}
                />
              ))
            ) : !rootAssignedOrder ? (
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
  title,
}: {
  assignedPaymentOrder: AssignedPaymentOrder
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
    rootAssigned: Boolean(order.RootAssignedPaymentOrder),
    totalRowsQty: order.TotalRowsQty,
  }))
}

function getPayedTo(order: OutcomePaymentOrder): string | undefined {
  if (!order.IsUnderReport) {
    return getEntityName(order.ConsumableProductOrganization)
      || getEntityName(order.ClientAgreement?.Client)
      || getColleagueFullName(order.Colleague)
      || getEntityName(order.Client)
      || undefined
  }

  return getColleagueFullName(order.Colleague)
}

function getColleagueFullName(colleague?: NamedEntity | null): string | undefined {
  if (!colleague?.Id || colleague.Id <= 0) {
    return undefined
  }

  return [colleague.LastName, colleague.FirstName, colleague.MiddleName].filter(Boolean).join(' ') || undefined
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.LastName || entity?.FullName || entity?.Name || entity?.OperationName || entity?.Code
}

function hasDocumentStructure(order: OutcomePaymentOrder): boolean {
  return Boolean(order.RootAssignedPaymentOrder && !order.RootAssignedPaymentOrder.Deleted) ||
    Boolean((order.AssignedPaymentOrders || []).some((assignedPaymentOrder) => !assignedPaymentOrder.Deleted))
}

function getActiveRelatedConsumablesOrders(
  orders?: OutcomePaymentOrder['OutcomePaymentOrderConsumablesOrders'],
): NonNullable<OutcomePaymentOrder['OutcomePaymentOrderConsumablesOrders']> {
  return (orders || []).filter(
    (order) => !order.Deleted && getActiveConsumablesItemsCount(order.ConsumablesOrder) > 0,
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

function mergeCashflowResponses(
  current: OutgoingCashflowsResponse,
  next: OutgoingCashflowsResponse,
  append: boolean,
): OutgoingCashflowsResponse {
  if (!append) {
    return next
  }

  return {
    ...next,
    Collection: [...current.Collection, ...next.Collection],
  }
}

function getRelatedOrderKey(row: OutgoingCashflowRow, item: { NetUid?: string; Id?: number; ConsumablesOrder?: { NetUid?: string; Id?: number } | null }, index: number): string {
  return String(item.NetUid || item.Id || item.ConsumablesOrder?.NetUid || item.ConsumablesOrder?.Id || `${row.id}-related-${index}`)
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

function formatOptionalNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
