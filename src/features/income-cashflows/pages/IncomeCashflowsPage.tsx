import {
  ActionIcon,
  Alert,
  Autocomplete,
  Badge,
  Button,
  Divider,
  Group,
  Menu,
  MultiSelect,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconChevronDown, IconEye, IconPlus, IconRefresh, IconSearch, IconUserShare, IconX } from '@tabler/icons-react'
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
  cancelIncomeCashflow,
  getIncomeCashflowClientAgreements,
  getIncomeCashflowCurrencies,
  getIncomeCashflowOrganizations,
  getIncomeCashflowSupplyOrganizationAgreements,
  getIncomeCashflows,
  searchIncomeCashflowClientPayers,
  searchIncomeCashflowCounterparties,
  searchIncomeCashflowPaymentRegisters,
  updateIncomeCashflowClient,
} from '../api/incomeCashflowsApi'
import {
  IncomeCounterpartySearchType,
  IncomePaymentOperationType,
} from '../types'
import type {
  Client,
  ClientAgreement,
  Currency,
  IncomeCashflowRow,
  IncomePaymentOrder,
  NamedEntity,
  Organization,
  PaymentRegister,
  SupplyOrganization,
  SupplyOrganizationAgreement,
} from '../types'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350

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

export function IncomeCashflowsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [incomeOrders, setIncomeOrders] = useValueState<IncomePaymentOrder[]>([])
  const [currencies, setCurrencies] = useValueState<Currency[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<PaymentRegister[]>([])
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useValueState<string[]>([])
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-1))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [searchValue, setSearchValue] = useValueState('')
  const [currencyNetId, setCurrencyNetId] = useValueState('')
  const [paymentRegisterNetId, setPaymentRegisterNetId] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [isLoadingLookups, setLoadingLookups] = useValueState(false)
  const [hasMore, setHasMore] = useValueState(false)
  const [selectedRow, setSelectedRow] = useValueState<IncomeCashflowRow | null>(null)
  const [cancelRow, setCancelRow] = useValueState<IncomeCashflowRow | null>(null)
  const [isCanceling, setCanceling] = useValueState(false)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const filterError = getDateRangeError(fromDate, toDate)
  const requestRef = useRef(0)
  const didInitOrganizationsRef = useRef(false)

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
  const [reassignRow, setReassignRow] = useValueState<IncomeCashflowRow | null>(null)
  const rows = useMemo(() => buildIncomeCashflowRows(incomeOrders), [incomeOrders])
  const totalQty = incomeOrders[0]?.TotalQty || incomeOrders.length
  const columns = useIncomeCashflowColumns({
    onCancel: setCancelRow,
    onOpen: setSelectedRow,
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

  const loadIncomeOrders = useCallback(async (offset: number, append: boolean) => {
    if (filterError) {
      requestRef.current += 1

      if (!append) {
        setIncomeOrders([])
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
      const nextOrders = await getIncomeCashflows({
        currencyNetId,
        from: fromDate,
        limit: PAGE_SIZE,
        offset,
        organizationIds: toFiniteNumberIds(selectedOrganizationIds),
        registerNetId: paymentRegisterNetId,
        to: toDate,
        value: normalizedSearchValue,
      })

      if (requestRef.current === requestId) {
        setIncomeOrders((current) => (append ? [...current, ...nextOrders] : nextOrders))
        const nextTotalQty = nextOrders[0]?.TotalQty || offset + nextOrders.length
        setHasMore(nextOrders.length === PAGE_SIZE && offset + nextOrders.length < nextTotalQty)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        if (!append) {
          setIncomeOrders([])
        }
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити прибуткові ордери'))
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
    paymentRegisterNetId,
    selectedOrganizationIds,
    setError,
    setHasMore,
    setIncomeOrders,
    setLoading,
    setLoadingMore,
    t,
    toDate,
  ])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    void loadIncomeOrders(0, false)
  }, [loadIncomeOrders])

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
      void loadIncomeOrders(0, false)
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : t('Не вдалося скасувати прибутковий ордер'))
    } finally {
      setCanceling(false)
    }
  }, [cancelRow, loadIncomeOrders, setCancelRow, setCanceling, setError, t])

  return (
    <Stack gap="md">
      <Group align="end" justify="space-between" gap="sm">
        <Group align="end" gap="sm">
          <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
          <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
          <TextInput
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Номер, платник, рахунок або коментар')}
            value={searchValue}
            w={340}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
        </Group>

        <Group align="end" gap="xs">
          <Menu position="bottom-end" shadow="md" width={300} withinPortal>
            <Menu.Target>
              <Button leftSection={<IconPlus size={16} />} rightSection={<IconChevronDown size={14} />}>
                {t('Новий')}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{t('Каса')}</Menu.Label>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/conversion?type=0')}>
                {t('Інший касовий прихід')}
              </Menu.Item>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/client?type=0&operationType=0')}>
                {t('Оплата покупця')}
              </Menu.Item>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/client?type=0&operationType=1')}>
                {t('Повернення постачальника')}
              </Menu.Item>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/client?type=0&operationType=2')}>
                {t('Інші з контрагентами')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>{t('Банк')}</Menu.Label>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/conversion?type=2')}>
                {t('Інші надходження на рахунок')}
              </Menu.Item>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/client?type=2&operationType=0')}>
                {t('Оплата покупця')}
              </Menu.Item>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/client?type=2&operationType=1')}>
                {t('Повернення постачальника')}
              </Menu.Item>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/client?type=2&operationType=2')}>
                {t('Інші з контрагентами')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>{t('Колеги')}</Menu.Label>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/user')}>
                {t('Повернення від колеги')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>{t('Магазин')}</Menu.Label>
              <Menu.Item onClick={() => navigate('/accounting/income-cashflows/new/shop')}>
                {t('Оплата магазину')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
                void loadIncomeOrders(0, false)
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
          {t('Завантажено')}: {incomeOrders.length}
        </Badge>
        <Badge color="gray" variant="light">
          {t('Всього')}: {totalQty}
        </Badge>
        <Badge color="gray" variant="light">
          {t('Скасовано')}: {incomeOrders.filter((order) => order.IsCanceled).length}
        </Badge>
      </Group>

      <DataTable
        columns={columns}
        data={rows}
        defaultLayout={TABLE_DEFAULT_LAYOUT}
        emptyText={t('Прибуткових ордерів не знайдено')}
        getRowId={(row) => row.id}
        isLoading={isTableBusy}
        layoutVersion="income-cashflows-1"
        maxHeight="calc(100vh - 365px)"
        minWidth={1680}
        tableId="income-cashflows"
        onRowClick={setSelectedRow}
      />

      {hasMore && (
        <Group justify="center">
          <Button loading={isLoadingMore} variant="light" onClick={() => void loadIncomeOrders(incomeOrders.length, true)}>
            {t('Завантажити ще')}
          </Button>
        </Group>
      )}

      <IncomeCashflowDetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onReassign={(row) => {
          setSelectedRow(null)
          setReassignRow(row)
        }}
      />
      <CancelIncomeCashflowModal
        isSaving={isCanceling}
        row={cancelRow}
        onCancel={handleCancel}
        onClose={() => setCancelRow(null)}
      />
      <ReassignIncomeClientModal
        row={reassignRow}
        onClose={() => setReassignRow(null)}
        onSaved={() => {
          setReassignRow(null)
          void loadIncomeOrders(0, false)
        }}
      />
    </Stack>
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
            <Tooltip label={t('Переназначити клієнта')}>
              <ActionIcon
                aria-label={t('Переназначити клієнта')}
                color="blue"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onReassign(row)
                }}
              >
                <IconUserShare size={16} />
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
              disabled={row.isCanceled || !row.income.NetUid}
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
    [onCancel, onOpen, onReassign, t],
  )
}

function IncomeCashflowDetailDrawer({
  row,
  onClose,
  onReassign,
}: {
  row: IncomeCashflowRow | null
  onClose: () => void
  onReassign: (row: IncomeCashflowRow) => void
}) {
  const { t } = useI18n()
  const income = row?.income

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="lg" title={t('Прибутковий ордер')} onClose={onClose}>
      {row && income && (
        <Stack gap="md">
          {isClientPaymentReassignable(income) && (
            <Group justify="flex-end">
              <Button
                color="blue"
                leftSection={<IconUserShare size={16} />}
                variant="light"
                onClick={() => onReassign(row)}
              >
                {t('Переназначити клієнта')}
              </Button>
            </Group>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Дата')} value={formatDateTime(income.FromDate)} />
            <DetailItem label={t('Номер')} value={displayValue(income.Number)} />
            <DetailItem label={t('Платник')} value={displayValue(row.payer)} />
            <DetailItem label={t('Тип операції')} value={displayValue(row.operationType)} />
            <DetailItem label={t('Сума')} value={formatMoney(income.Amount)} />
            <DetailItem label={t('Валюта')} value={displayValue(income.Currency?.Code || income.Currency?.Name)} />
            <DetailItem label={t('Стаття руху')} value={displayValue(row.paymentMovement)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Рахунок')} value={displayValue(row.paymentRegister)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Бухгалтерський')} value={income.IsAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Управлінський')} value={income.IsManagementAccounting ? t('Так') : t('Ні')} />
            <DetailItem label={t('Скасовано')} value={income.IsCanceled ? t('Так') : t('Ні')} />
            <DetailItem label={t('Підстава')} value={displayValue(income.PaymentPurpose || income.ArrivalNumber)} />
          </SimpleGrid>

          <Stack gap={2}>
            <Text c="dimmed" size="xs" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{displayValue(income.Comment)}</Text>
          </Stack>

          {Boolean(income.AssignedPaymentOrders?.length || income.RootAssignedPaymentOrder) && (
            <>
              <Divider />
              <Stack gap="xs">
                <Text fw={700}>{t('Призначені платежі')}</Text>
                {income.RootAssignedPaymentOrder && (
                  <DetailItem label={t('Кореневий платіж')} value={displayValue(income.RootAssignedPaymentOrder.Number)} />
                )}
                {(income.AssignedPaymentOrders || []).map((assignedOrder, index) => (
                  <SimpleGrid key={getAssignedKey(assignedOrder, index)} cols={{ base: 1, sm: 2 }}>
                    <DetailItem label={t('Номер')} value={displayValue(assignedOrder.Number)} />
                    <DetailItem label={t('Сума')} value={formatMoney(assignedOrder.Amount)} />
                  </SimpleGrid>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      )}
    </AppDrawer>
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
          <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
            {t('Ні')}
          </Button>
          <Button color="red" leftSection={<IconX size={16} />} loading={isSaving} onClick={onCancel}>
            {t('Скасувати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

type ReassignSearchType = typeof IncomeCounterpartySearchType.Client | typeof IncomeCounterpartySearchType.Supplier

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
  const [searchType, setSearchType] = useValueState<ReassignSearchType>(IncomeCounterpartySearchType.Client)
  const [searchValue, setSearchValue] = useValueState('')
  const [clients, setClients] = useValueState<Client[]>([])
  const [supplyOrganizations, setSupplyOrganizations] = useValueState<SupplyOrganization[]>([])
  const [selectedClientValue, setSelectedClientValue] = useValueState('')
  const [clientAgreements, setClientAgreements] = useValueState<ClientAgreement[]>([])
  const [supplyAgreements, setSupplyAgreements] = useValueState<SupplyOrganizationAgreement[]>([])
  const [selectedAgreementValue, setSelectedAgreementValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isSaving, setSaving] = useValueState(false)
  const [debouncedSearch] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)

  const isSupplier = searchType === IncomeCounterpartySearchType.Supplier
  const opened = Boolean(row)

  const counterpartyOptions = useMemo(() => {
    const source: NamedEntity[] = isSupplier ? supplyOrganizations : clients
    return toSelectOptions(source, getEntityName)
  }, [clients, isSupplier, supplyOrganizations])

  const agreementOptions = useMemo(
    () => (isSupplier ? toSupplyAgreementOptions(supplyAgreements) : toClientAgreementOptions(clientAgreements)),
    [clientAgreements, isSupplier, supplyAgreements],
  )

  const resetReassignForm = useCallback(() => {
    setSearchType(IncomeCounterpartySearchType.Client)
    setSearchValue('')
    setClients([])
    setSupplyOrganizations([])
    setSelectedClientValue('')
    setClientAgreements([])
    setSupplyAgreements([])
    setSelectedAgreementValue('')
    setError(null)
  }, [
    setClientAgreements,
    setClients,
    setError,
    setSearchType,
    setSearchValue,
    setSelectedAgreementValue,
    setSelectedClientValue,
    setSupplyAgreements,
    setSupplyOrganizations,
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

    const loadCounterparties = async () => {
      const value = debouncedSearch.trim()

      if (!value) {
        if (!cancelled) {
          setClients([])
          setSupplyOrganizations([])
        }
        return
      }

      if (isSupplier) {
        const result = await searchIncomeCashflowCounterparties(value, IncomeCounterpartySearchType.Supplier).catch(() => [])
        if (!cancelled) {
          setSupplyOrganizations(result as SupplyOrganization[])
        }
        return
      }

      const result = await searchIncomeCashflowClientPayers(value).catch(() => [])
      if (!cancelled) {
        setClients(result)
      }
    }

    void loadCounterparties()

    return () => {
      cancelled = true
    }
  }, [debouncedSearch, isSupplier, opened, setClients, setSupplyOrganizations])

  useEffect(() => {
    let cancelled = false

    const loadAgreements = async () => {
      if (!selectedClientValue) {
        if (!cancelled) {
          setClientAgreements([])
          setSupplyAgreements([])
          setSelectedAgreementValue('')
        }
        return
      }

      if (isSupplier) {
        const selected = supplyOrganizations.find(
          (entity) => String(entity.NetUid || entity.Id || '') === selectedClientValue,
        )
        const supplyId = selected?.Id

        if (!supplyId) {
          if (!cancelled) {
            setSupplyAgreements([])
          }
          return
        }

        const result = await getIncomeCashflowSupplyOrganizationAgreements(supplyId).catch(() => [])
        if (!cancelled) {
          setSupplyAgreements(result)
        }
        return
      }

      const result = await getIncomeCashflowClientAgreements(selectedClientValue).catch(() => [])
      if (!cancelled) {
        setClientAgreements(result)
      }
    }

    void loadAgreements()

    return () => {
      cancelled = true
    }
  }, [
    isSupplier,
    selectedClientValue,
    setClientAgreements,
    setSelectedAgreementValue,
    setSupplyAgreements,
    supplyOrganizations,
  ])

  const handleSearchTypeChanged = useCallback(
    (value: string) => {
      setSearchType(Number(value) as ReassignSearchType)
      setSearchValue('')
      setClients([])
      setSupplyOrganizations([])
      setSelectedClientValue('')
      setClientAgreements([])
      setSupplyAgreements([])
      setSelectedAgreementValue('')
    },
    [
      setClientAgreements,
      setClients,
      setSearchType,
      setSearchValue,
      setSelectedAgreementValue,
      setSelectedClientValue,
      setSupplyAgreements,
      setSupplyOrganizations,
    ],
  )

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
    <AppModal centered opened={opened} title={t('Переназначити клієнта')} onClose={handleClose}>
      <Stack gap="md">
        {row && (
          <Text c="dimmed" size="sm">
            {t('Ордер')}: <Text span fw={600}>{row.number || t('Без номера')}</Text>
          </Text>
        )}

        <SegmentedControl
          data={[
            { label: t('За клієнтами'), value: String(IncomeCounterpartySearchType.Client) },
            { label: t('За постачальниками'), value: String(IncomeCounterpartySearchType.Supplier) },
          ]}
          disabled={isSaving}
          value={String(searchType)}
          onChange={handleSearchTypeChanged}
        />

        <Autocomplete
          data={counterpartyOptions.map((option) => option.label)}
          disabled={isSaving}
          label={isSupplier ? t('Постачальник') : t('Клієнт')}
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
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="light" onClick={handleClose}>
            {t('Скасувати')}
          </Button>
          <Button
            disabled={!selectedClientValue || !selectedAgreementValue}
            leftSection={<IconUserShare size={16} />}
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
    <Badge color="green" size="xs" variant="light">
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
        <Badge color="indigo" size="xs" variant="light">
          {t('Повернення')}
        </Badge>
      )}
    </Group>
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
      operationType: income.OperationTypeName,
      organization: getEntityName(income.Organization),
      payer: getIncomePayerName(income),
      paymentMovement: income.PaymentMovementOperation?.PaymentMovement?.OperationName,
      paymentRegister: income.PaymentRegister?.Name,
      responsible: getEntityName(income.User),
      rootAssigned: Boolean(income.RootAssignedPaymentOrder || income.AssignedPaymentOrders?.length),
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

function toSupplyAgreementOptions(agreements: SupplyOrganizationAgreement[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const agreement of agreements) {
    const value = getEntityOptionValue(agreement)

    if (value) {
      options.push({
        label: joinTruthyParts(agreement.Name || agreement.Number, agreement.Currency?.Code || agreement.Currency?.Name),
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

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function formatMoney(value?: number): string {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0

  return moneyFormatter.format(amount)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
