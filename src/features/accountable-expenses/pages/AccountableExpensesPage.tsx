import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCreditCard,
  IconEye,
  IconExternalLink,
  IconPencil,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getAccountableExpenses,
  searchAccountableExpenses,
} from '../api/accountableExpensesApi'
import {
  buildExpenseRows,
  formatPaymentStatus,
  formatUnderReportStatus,
  getAdvanceReportLink,
  getOutcomeOrderLinkKey,
  getOutcomePaymentOrder,
  getOutcomePaymentOrders,
  getPaymentStatusColor,
} from '../accountableExpenseRows'
import type {
  AccountableExpenseRow,
  ConsumablesOrder,
} from '../types'
import './accountable-expenses-page.css'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created', 'advanceNumber'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const DEFAULT_LOOKBACK_DAYS = 7

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 3,
})

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const ACCOUNTABLE_EXPENSE_TABLE_CELL_STYLE = {
  display: 'block',
  lineHeight: '18px',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

export function AccountableExpensesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [orders, setOrders] = useValueState<ConsumablesOrder[]>([])
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-DEFAULT_LOOKBACK_DAYS))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [selectedRow, setSelectedRow] = useValueState<AccountableExpenseRow | null>(null)
  const filterError = getDateRangeError(fromDate, toDate)
  const requestRef = useRef(0)

  const loadOrders = useCallback(async () => {
    if (filterError) {
      requestRef.current += 1
      setError(null)
      setLoading(false)
      setOrders([])
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const nextOrders = searchValue
        ? await searchAccountableExpenses(searchValue, { from: fromDate, to: toDate })
        : await getAccountableExpenses({ from: fromDate, to: toDate })

      if (requestRef.current === requestId) {
        setOrders(nextOrders)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setOrders([])
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити підзвітні витрати'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [filterError, fromDate, searchValue, setError, setLoading, setOrders, t, toDate])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrders()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [loadOrders])

  const rows = useMemo(() => buildExpenseRows(orders), [orders])
  const openPayment = useCallback(
    (row: AccountableExpenseRow) => {
      const netId = row.order.NetUid || row.order.Id

      if (!netId) {
        return
      }

      navigate(`/accounting/consumable-orders/pay/${String(netId)}`, {
        state: {
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )
  const openOrderEdit = useCallback(
    (row: AccountableExpenseRow) => {
      const netId = row.order.NetUid || row.order.Id

      if (!netId) {
        return
      }

      navigate(`/accounting/consumable-orders/edit/${String(netId)}`, {
        state: {
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )
  const columns = useAccountableExpenseColumns({
    onEdit: openOrderEdit,
    onOpen: setSelectedRow,
    onPay: openPayment,
  })
  const { density, toggleDensity } = useDataTableDensity('accountable-expenses', TABLE_DEFAULT_LAYOUT.density)
  const toolbarLeft = useMemo(
    () => (
      <Text c="dimmed" size="xs">
        {t('Документів')}: {orders.length}
        {rows.length !== orders.length ? `, ${t('рядків')}: ${rows.length}` : ''}
      </Text>
    ),
    [orders.length, rows.length, t],
  )

  return (
    <Stack className="accountable-expenses-page" gap={6}>
      <Group justify="space-between" align="end" gap="sm">
        <Group align="end" gap="sm">
          <TextInput
            label={t('Від')}
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.currentTarget.value)}
          />
          <TextInput
            label={t('До')}
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.currentTarget.value)}
          />
          <TextInput
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Номер, товар, відповідальний')}
            value={searchValue}
            w={320}
            onChange={(event) => {
              setSearchValue(event.currentTarget.value)
              setOrders([])
            }}
          />
        </Group>
        <Group align="end" gap="sm">
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void loadOrders()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <DataTableDensityToggle density={density} onToggle={toggleDensity} size={38} />
        </Group>
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

      <div className="accountable-expenses-page__table">
        <DataTable
          columns={columns}
          data={rows}
          defaultLayout={TABLE_DEFAULT_LAYOUT}
          density={density}
          emptyText={t('Підзвітних витрат не знайдено')}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          layoutVersion="accountable-expenses-1"
          height="100%"
          minWidth={1480}
          showLayoutControls={false}
          tableId="accountable-expenses"
          toolbarLeft={toolbarLeft}
          onRowClick={setSelectedRow}
        />
      </div>

      <ExpenseDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </Stack>
  )
}

function useAccountableExpenseColumns({
  onEdit,
  onOpen,
  onPay,
}: {
  onEdit: (row: AccountableExpenseRow) => void
  onOpen: (row: AccountableExpenseRow) => void
  onPay: (row: AccountableExpenseRow) => void
}): DataTableColumn<AccountableExpenseRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<AccountableExpenseRow>[]>(
    () => [
      {
        id: 'created',
        header: t('Створено'),
        width: 145,
        minWidth: 130,
        accessor: (row) => row.created,
        cell: (row) => <AccountableExpenseTableValue value={formatDateTime(row.created)} />,
      },
      {
        id: 'advanceNumber',
        header: t('Авансовий звіт'),
        width: 175,
        minWidth: 145,
        accessor: (row) => row.advanceNumber,
        cell: (row) => <AccountableExpenseTableValue fw={600} value={displayValue(row.advanceNumber)} />,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.organization,
        cell: (row) => <AccountableExpenseTableValue value={displayValue(row.organization)} />,
      },
      {
        id: 'payedTo',
        header: t('Кому видано'),
        width: 160,
        minWidth: 130,
        accessor: (row) => row.payedTo,
        cell: (row) => <AccountableExpenseTableValue value={displayValue(row.payedTo)} />,
      },
      {
        id: 'vendorCode',
        header: t('Артикул'),
        width: 110,
        minWidth: 90,
        accessor: (row) => row.vendorCode,
        cell: (row) => <AccountableExpenseTableValue value={displayValue(row.vendorCode)} />,
      },
      {
        id: 'product',
        header: t('Назва'),
        width: 210,
        minWidth: 170,
        accessor: (row) => row.productName,
        cell: (row) => <AccountableExpenseTableValue value={displayValue(row.productName)} />,
      },
      {
        id: 'type',
        header: t('Тип'),
        width: 105,
        minWidth: 90,
        accessor: (row) => row.item.IsService,
        cell: (row) => (
          <Badge color={row.item.IsService ? 'indigo' : 'gray'} variant="light">
            {row.item.IsService ? t('Послуга') : t('Товар')}
          </Badge>
        ),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 105,
        minWidth: 90,
        align: 'right',
        accessor: (row) => row.qty,
        cell: (row) => <AccountableExpenseTableValue value={formatAmount(row.qty)} />,
      },
      {
        id: 'price',
        header: t('Ціна'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.pricePerItem,
        cell: (row) => <AccountableExpenseTableValue value={formatMoney(row.pricePerItem)} />,
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => <AccountableExpenseTableValue value={formatMoney(row.amount)} />,
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 90,
        minWidth: 80,
        accessor: (row) => row.currency,
        cell: (row) => <AccountableExpenseTableValue value={displayValue(row.currency)} />,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 155,
        minWidth: 120,
        accessor: (row) => row.responsible,
        cell: (row) => <AccountableExpenseTableValue value={displayValue(row.responsible)} />,
      },
      {
        id: 'status',
        header: t('Статус'),
        width: 130,
        minWidth: 110,
        accessor: (row) => row.paymentStatus,
        cell: (row) => (
          <Badge color={getPaymentStatusColor(row.paymentStatus)} variant="light">
            {formatPaymentStatus(row.paymentStatus, t)}
          </Badge>
        ),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 220,
        minWidth: 160,
        accessor: (row) => row.comment,
        cell: (row) => <AccountableExpenseTableValue value={displayValue(row.comment)} />,
      },
      {
        id: 'actions',
        header: '',
        width: 122,
        minWidth: 116,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            {row.paymentStatus !== 'paid' && (
              <Tooltip label={t('Оплатити')}>
                <ActionIcon
                  aria-label={t('Оплатити')}
                  color="green"
                  size="sm"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onPay(row)
                  }}
                >
                  <IconCreditCard size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={t('Відкрити накладну')}>
              <ActionIcon
                aria-label={t('Відкрити накладну')}
                color="blue"
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit(row)
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
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
          </Group>
        ),
      },
    ],
    [onEdit, onOpen, onPay, t],
  )
}

function AccountableExpenseTableValue({ fw, value }: { fw?: number; value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <Text component="span" fw={fw} style={ACCOUNTABLE_EXPENSE_TABLE_CELL_STYLE}>
        {value}
      </Text>
    </Tooltip>
  )
}

function ExpenseDetailDrawer({ row, onClose }: { row: AccountableExpenseRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const outcome = getOutcomePaymentOrder(row?.order)
  const outcomeOrders = getOutcomePaymentOrders(row?.order)
  const advanceReportLink = getAdvanceReportLink(outcome)

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={t('Підзвітна витрата')} onClose={onClose}>
      {row && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Створено')} value={formatDateTime(row.created)} />
            <DetailItem label={t('Номер документа')} value={displayValue(row.order.Number)} />
            <DetailItem label={t('Номер організації')} value={displayValue(row.order.OrganizationNumber)} />
            <DetailItem label={t('Дата організації')} value={formatDateTime(row.order.OrganizationFromDate)} />
            <DetailItem label={t('Авансовий звіт')} value={displayValue(row.advanceNumber)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Кому видано')} value={displayValue(row.payedTo)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Артикул')} value={displayValue(row.vendorCode)} />
            <DetailItem label={t('Товар/послуга')} value={displayValue(row.productName)} />
            <DetailItem label={t('Тип')} value={row.item.IsService ? t('Послуга') : t('Товар')} />
            <DetailItem label={t('Кількість')} value={formatAmount(row.qty)} />
            <DetailItem label={t('Ціна')} value={formatMoney(row.pricePerItem)} />
            <DetailItem label={t('Сума з ПДВ')} value={formatMoney(row.amount)} />
            <DetailItem label={t('Сума без ПДВ')} value={formatMoney(row.item.TotalPrice)} />
            <DetailItem label={t('ПДВ')} value={formatMoney(row.item.VAT)} />
            <DetailItem label={t('ПДВ %')} value={formatAmount(row.item.VatPercent)} />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Оплата')} value={formatPaymentStatus(row.paymentStatus, t)} />
            <DetailItem label={t('Підзвіт закрито')} value={formatUnderReportStatus(row.underReportStatus, t)} />
            <DetailItem label={t('Оплачено сумарно')} value={formatMoney(row.paidAmount)} />
          </SimpleGrid>
          <Stack gap={2}>
            <Text c="dimmed" size="xs" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{displayValue(row.comment)}</Text>
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Group justify="space-between" align="center" gap="sm">
              <Text fw={700}>{t('Пов’язаний видатковий документ')}</Text>
              {advanceReportLink && (
                <Button
                  component={Link}
                  leftSection={<IconExternalLink size={16} />}
                  size="xs"
                  to={advanceReportLink}
                  variant="light"
                >
                  {t('Відкрити авансовий звіт')}
                </Button>
              )}
            </Group>
            {outcome ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <DetailItem label={t('Видатковий ордер')} value={displayValue(outcome.Number || outcome.CustomNumber)} />
                <DetailItem label={t('Дата')} value={formatDateTime(outcome.FromDate)} />
                <DetailItem label={t('Сума')} value={formatMoney(outcome.Amount)} />
                <DetailItem label={t('Валюта')} value={displayValue(outcome.PaymentCurrencyRegister?.Currency?.Code || outcome.PaymentCurrencyRegister?.Currency?.Name)} />
                <DetailItem label={t('Рахунок')} value={displayValue(outcome.PaymentCurrencyRegister?.PaymentRegister?.Name)} />
                <DetailItem label={t('Стаття руху')} value={displayValue(outcome.PaymentMovementOperation?.PaymentMovement?.OperationName)} />
                <DetailItem label={t('Призначення платежу')} value={displayValue(outcome.PaymentPurpose)} />
                <DetailItem label={t('Коментар ордера')} value={displayValue(outcome.Comment)} />
              </SimpleGrid>
            ) : (
              <Text c="dimmed" size="sm">
                {t('Пов’язаний видатковий документ не завантажено')}
              </Text>
            )}
          </Stack>

          {outcomeOrders.length > 1 && (
            <>
              <Divider />
              <Stack gap="xs">
                <Text fw={700}>{t('Усі прив’язки до авансових звітів')}</Text>
                {outcomeOrders.map((item, index) => (
                  <SimpleGrid key={getOutcomeOrderLinkKey(item, index)} cols={{ base: 1, sm: 2 }}>
                    <DetailItem label={t('Авансовий звіт')} value={displayValue(item.OutcomePaymentOrder?.AdvanceNumber)} />
                    <DetailItem label={t('Видатковий ордер')} value={displayValue(item.OutcomePaymentOrder?.Number || item.OutcomePaymentOrder?.CustomNumber)} />
                    <DetailItem label={t('Дата')} value={formatDateTime(item.OutcomePaymentOrder?.FromDate)} />
                    <DetailItem label={t('Сума')} value={formatMoney(item.OutcomePaymentOrder?.Amount)} />
                    <DetailItem label={t('Валюта')} value={displayValue(item.OutcomePaymentOrder?.PaymentCurrencyRegister?.Currency?.Code || item.OutcomePaymentOrder?.PaymentCurrencyRegister?.Currency?.Name)} />
                    <DetailItem label={t('Закрито')} value={item.OutcomePaymentOrder?.IsUnderReportDone ? t('Так') : t('Ні')} />
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

function formatAmount(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : '—'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
