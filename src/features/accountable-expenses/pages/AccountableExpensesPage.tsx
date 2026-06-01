import {
  ActionIcon,
  Alert,
  Badge,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconEye,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getAccountableExpenses,
  searchAccountableExpenses,
} from '../api/accountableExpensesApi'
import type {
  AccountableExpenseRow,
  ConsumablesOrder,
  OutcomePaymentOrder,
} from '../types'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created', 'advanceNumber'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

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

export function AccountableExpensesPage() {
  const { t } = useI18n()
  const [orders, setOrders] = useValueState<ConsumablesOrder[]>([])
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
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
        ? await searchAccountableExpenses(searchValue)
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
  const columns = useAccountableExpenseColumns(setSelectedRow)

  return (
    <Stack gap="md">
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
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void loadOrders()}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
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
          {t('Документів')}: {orders.length}
        </Badge>
        <Badge color="gray" variant="light">
          {t('Рядків')}: {rows.length}
        </Badge>
        <Badge color="gray" variant="light">
          {t('Оплачено')}: {orders.filter((order) => order.IsPayed).length}
        </Badge>
      </Group>

      <DataTable
        columns={columns}
        data={rows}
        defaultLayout={TABLE_DEFAULT_LAYOUT}
        emptyText={t('Підзвітних витрат не знайдено')}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        layoutVersion="accountable-expenses-1"
        maxHeight="calc(100vh - 285px)"
        minWidth={1280}
        tableId="accountable-expenses"
        onRowClick={setSelectedRow}
      />

      <ExpenseDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </Stack>
  )
}

function useAccountableExpenseColumns(onOpen: (row: AccountableExpenseRow) => void): DataTableColumn<AccountableExpenseRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<AccountableExpenseRow>[]>(
    () => [
      {
        id: 'created',
        header: t('Створено'),
        width: 145,
        minWidth: 130,
        accessor: (row) => row.created,
        cell: (row) => formatDateTime(row.created),
      },
      {
        id: 'advanceNumber',
        header: t('Авансовий звіт'),
        width: 175,
        minWidth: 145,
        accessor: (row) => row.advanceNumber,
        cell: (row) => <Text fw={600}>{displayValue(row.advanceNumber)}</Text>,
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
        id: 'payedTo',
        header: t('Кому видано'),
        width: 160,
        minWidth: 130,
        accessor: (row) => row.payedTo,
        cell: (row) => displayValue(row.payedTo),
      },
      {
        id: 'product',
        header: t('Назва'),
        width: 210,
        minWidth: 170,
        accessor: (row) => row.productName,
        cell: (row) => displayValue(row.productName),
      },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 105,
        minWidth: 90,
        align: 'right',
        accessor: (row) => row.qty,
        cell: (row) => formatAmount(row.qty),
      },
      {
        id: 'price',
        header: t('Ціна'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.pricePerItem,
        cell: (row) => formatMoney(row.pricePerItem),
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
        id: 'responsible',
        header: t('Відповідальний'),
        width: 155,
        minWidth: 120,
        accessor: (row) => row.responsible,
        cell: (row) => displayValue(row.responsible),
      },
      {
        id: 'status',
        header: t('Статус'),
        width: 110,
        minWidth: 95,
        accessor: (row) => row.isPayed,
        cell: (row) => (
          <Badge color={row.isPayed ? 'green' : 'yellow'} variant="light">
            {row.isPayed ? t('Оплачено') : t('Не оплачено')}
          </Badge>
        ),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 220,
        minWidth: 160,
        accessor: (row) => row.comment,
        cell: (row) => displayValue(row.comment),
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
    [onOpen, t],
  )
}

function ExpenseDetailDrawer({ row, onClose }: { row: AccountableExpenseRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const outcome = getOutcomePaymentOrder(row?.order)

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="lg" title={t('Підзвітна витрата')} onClose={onClose}>
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
            <DetailItem label={t('Товар/послуга')} value={displayValue(row.productName)} />
            <DetailItem label={t('Кількість')} value={formatAmount(row.qty)} />
            <DetailItem label={t('Ціна')} value={formatMoney(row.pricePerItem)} />
            <DetailItem label={t('Сума з ПДВ')} value={formatMoney(row.amount)} />
            <DetailItem label={t('Сума без ПДВ')} value={formatMoney(row.item.TotalPrice)} />
            <DetailItem label={t('ПДВ')} value={formatMoney(row.item.VAT)} />
            <DetailItem label={t('ПДВ %')} value={formatAmount(row.item.VatPercent)} />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Оплачено')} value={row.isPayed ? t('Так') : t('Ні')} />
            <DetailItem label={t('Підзвіт закрито')} value={outcome?.IsUnderReportDone ? t('Так') : t('Ні')} />
          </SimpleGrid>
          <Stack gap={2}>
            <Text c="dimmed" size="xs" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{displayValue(row.comment)}</Text>
          </Stack>
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

function buildExpenseRows(orders: ConsumablesOrder[]): AccountableExpenseRow[] {
  const rows: AccountableExpenseRow[] = []

  orders.forEach((order, orderIndex) => {
    const outcome = getOutcomePaymentOrder(order)
    const items = order.ConsumablesOrderItems?.length ? order.ConsumablesOrderItems : [{}]

    items.forEach((item, itemIndex) => {
      rows.push({
        advanceNumber: outcome?.AdvanceNumber,
        amount: item.TotalPriceWithVAT,
        comment: order.Comment,
        created: order.Created,
        currency: outcome?.PaymentCurrencyRegister?.Currency?.Code || outcome?.PaymentCurrencyRegister?.Currency?.Name,
        id: String(item.NetUid || item.Id || `${order.NetUid || order.Id || orderIndex}-${itemIndex}`),
        isPayed: order.IsPayed,
        item,
        order,
        organization: outcome?.Organization?.Name,
        payedTo: outcome?.Colleague?.LastName || outcome?.Colleague?.FullName || outcome?.Colleague?.Name,
        pricePerItem: item.PricePerItem,
        productName: item.ConsumableProduct?.Name,
        qty: item.Qty,
        responsible: order.User?.LastName || order.User?.FullName || order.User?.Name,
      })
    })
  })

  return rows
}

function getOutcomePaymentOrder(order?: ConsumablesOrder | null): OutcomePaymentOrder | null {
  return order?.OutcomePaymentOrderConsumablesOrders?.[0]?.OutcomePaymentOrder || null
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
