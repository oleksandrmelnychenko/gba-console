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
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getAdvancePayments } from '../api/advancePaymentsApi'
import type { AdvancePayment, User } from '../types'

const ADVANCE_PAYMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['fromDate', 'number'],
  },
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

export function AdvancePaymentsPage() {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState(() => shiftMonth(-1))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [payments, setPayments] = useValueState<AdvancePayment[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const columns = useAdvancePaymentColumns()

  useEffect(() => {
    let isActive = true
    setLoading(true)
    setError(null)

    async function loadPayments() {
      try {
        const nextPayments = await getAdvancePayments({
          from: fromDate,
          to: toDate,
        })

        if (isActive) {
          setPayments(nextPayments)
        }
      } catch (loadError) {
        if (isActive) {
          setPayments([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити авансові платежі'))
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadPayments()

    return () => {
      isActive = false
    }
  }, [fromDate, reloadKey, setError, setLoading, setPayments, t, toDate])

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
                {t('Авансові платежі')}
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
            </Group>
          </Group>

          <Group align="end" gap="sm">
            <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
            <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Badge color="violet" variant="light" w="fit-content">
            {t('Завантажено')}: {payments.length}
          </Badge>

          <DataTable
            columns={columns}
            data={payments}
            defaultLayout={ADVANCE_PAYMENTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Авансових платежів за період не знайдено')}
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
        header: t('Дата'),
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
        header: t('VAT, %'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (payment) => payment.VatPercent,
        cell: (payment) => formatPercent(payment.VatPercent),
      },
      {
        id: 'vatAmount',
        header: t('Сума VAT'),
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

function getUserName(user?: User | null): string | undefined {
  return user?.FullName || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ')
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatPercent(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string | null): string {
  return value || '—'
}
