import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getAdvancePayments } from '../api/advancePaymentsApi'
import type { AdvancePayment, User } from '../types'

const ADVANCE_PAYMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'number'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type AdvancePaymentsLoadState = {
  error: string | null
  isLoading: boolean
  payments: AdvancePayment[]
}

type AdvancePaymentsLoadAction =
  | { type: 'failed'; error: string }
  | { type: 'invalid-filter' }
  | { type: 'loaded'; payments: AdvancePayment[] }
  | { type: 'start-loading' }

const INITIAL_ADVANCE_PAYMENTS_LOAD_STATE: AdvancePaymentsLoadState = {
  error: null,
  isLoading: true,
  payments: [],
}

export function AdvancePaymentsPage() {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState(() => shiftMonth(-1))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [loadState, dispatchLoadState] = useReducer(advancePaymentsLoadReducer, INITIAL_ADVANCE_PAYMENTS_LOAD_STATE)
  const { error, isLoading, payments } = loadState
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getDateRangeError(fromDate, toDate)
  const columns = useAdvancePaymentColumns()
  const { density, toggleDensity } = useDataTableDensity('advance-payments', 'normal')

  useEffect(() => {
    let isActive = true

    if (filterError) {
      dispatchLoadState({ type: 'invalid-filter' })

      return () => {
        isActive = false
      }
    }

    dispatchLoadState({ type: 'start-loading' })

    async function loadPayments() {
      try {
        const nextPayments = await getAdvancePayments({
          from: fromDate,
          to: toDate,
        })

        if (isActive) {
          dispatchLoadState({ payments: nextPayments, type: 'loaded' })
        }
      } catch (loadError) {
        if (isActive) {
          dispatchLoadState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити авансові платежі'),
            type: 'failed',
          })
        }
      }
    }

    void loadPayments()

    return () => {
      isActive = false
    }
  }, [filterError, fromDate, reloadKey, t, toDate])

  function resetFilters() {
    setFromDate(shiftMonth(-1))
    setToDate(formatLocalDate(new Date()))
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700} size="xl">
                {t('Зарахування авансу')}
              </Text>
            </div>

            <Group gap="xs">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <DataTableDensityToggle density={density} onToggle={toggleDensity} size={36} />
            </Group>
          </Group>

          <Group align="end" gap="sm">
            <TextInput label={t('Від якої дати')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
            <TextInput label={t('До якої дати')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
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

          <Badge color="blue" variant="light" w="fit-content">
            {t('Завантажено')}: {payments.length}
          </Badge>

          <DataTable
            columns={columns}
            data={payments}
            defaultLayout={ADVANCE_PAYMENTS_TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText={t('Немає даних за вибраний період')}
            getRowId={(payment, index) => String(payment.NetUid || payment.Id || payment.Number || index)}
            isLoading={isLoading}
            layoutVersion="advance-payments-table-1"
            maxHeight="calc(100vh - 310px)"
            minWidth={1080}
            tableId="advance-payments"
          />
        </Stack>
      </Card>
    </Stack>
  )
}

function useAdvancePaymentColumns(): DataTableColumn<AdvancePayment>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<AdvancePayment>[]>(
    () => [
      {
        id: 'fromDate',
        header: t('Вхідна дата'),
        width: 160,
        minWidth: 140,
        accessor: (payment) => payment.FromDate,
        cell: (payment) => formatDateTime(payment.FromDate),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 210,
        minWidth: 170,
        accessor: (payment) => payment.Number,
        cell: (payment) => <Text fw={600}>{displayValue(payment.Number)}</Text>,
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (payment) => payment.Amount,
        cell: (payment) => formatMoney(payment.Amount),
      },
      {
        id: 'vatPercent',
        header: t('ПДВ %'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (payment) => payment.VatPercent,
        cell: (payment) => formatPercent(payment.VatPercent),
      },
      {
        id: 'vatAmount',
        header: t('Сума ПДВ'),
        width: 140,
        minWidth: 120,
        align: 'right',
        accessor: (payment) => payment.VatAmount,
        cell: (payment) => formatMoney(payment.VatAmount),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 240,
        minWidth: 190,
        accessor: (payment) => payment.Organization?.Name || payment.Organization?.FullName,
        cell: (payment) => displayValue(payment.Organization?.Name || payment.Organization?.FullName),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 210,
        minWidth: 170,
        accessor: (payment) => getUserName(payment.User),
        cell: (payment) => displayValue(getUserName(payment.User)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 220,
        accessor: (payment) => payment.Comment,
        cell: (payment) => displayValue(payment.Comment),
      },
    ],
    [t],
  )
}

function shiftMonth(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() + months)

  return formatLocalDate(date)
}

function advancePaymentsLoadReducer(
  state: AdvancePaymentsLoadState,
  action: AdvancePaymentsLoadAction,
): AdvancePaymentsLoadState {
  switch (action.type) {
    case 'failed':
      return {
        error: action.error,
        isLoading: false,
        payments: [],
      }
    case 'invalid-filter':
      return {
        error: null,
        isLoading: false,
        payments: [],
      }
    case 'loaded':
      return {
        error: null,
        isLoading: false,
        payments: action.payments,
      }
    case 'start-loading':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    default:
      return state
  }
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

function getUserName(user?: User | null): string | undefined {
  return user?.FullName || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ')
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${day}.${month}.${year} ${hours}:${minutes}`
}

function formatPercent(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
}

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function formatMoney(value?: number): string {
  return moneyFormatter.format(typeof value === 'number' && Number.isFinite(value) ? value : 0)
}

function displayValue(value?: string | null): string {
  return value || '—'
}
