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
  IconChevronDown,
  IconChevronUp,
  IconCreditCard,
  IconEye,
  IconExternalLink,
  IconFileText,
  IconPencil,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
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
import '../../../shared/ui/console-table-page.css'

const FILTERS_STORAGE_KEY = 'accountable-expenses-filters-v3'
const DEFAULT_LOOKBACK_DAYS = 30

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

type AccountableExpenseSortId = 'amount' | 'document' | 'price' | 'product' | 'qty' | 'responsible' | 'status'

type AccountableExpenseSortState = {
  direction: 'asc' | 'desc'
  id: AccountableExpenseSortId
} | null

export function AccountableExpensesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const defaultToDate = useMemo(() => formatLocalDate(new Date()), [])
  const defaultFromDate = useMemo(() => shiftDate(-DEFAULT_LOOKBACK_DAYS), [])
  const [orders, setOrders] = useValueState<ConsumablesOrder[]>([])
  const [fromDate, setFromDate] = useValueState(() => readStoredFilters().from || defaultFromDate)
  const [toDate, setToDate] = useValueState(() => readStoredFilters().to || defaultToDate)
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [selectedRow, setSelectedRow] = useValueState<AccountableExpenseRow | null>(null)
  const [sortState, setSortState] = useValueState<AccountableExpenseSortState>(null)
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

  useEffect(() => {
    writeStoredFilters({ from: fromDate, to: toDate })
  }, [fromDate, toDate])

  const rows = useMemo(() => buildExpenseRows(orders), [orders])
  const sortedRows = useMemo(() => sortAccountableExpenseRows(rows, sortState), [rows, sortState])
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
  const resetFilters = useCallback(
    () => {
      setFromDate(defaultFromDate)
      setToDate(defaultToDate)
      setSearchValue('')
      setOrders([])
    },
    [defaultFromDate, defaultToDate, setFromDate, setOrders, setSearchValue, setToDate],
  )
  const toggleSort = useCallback(
    (id: AccountableExpenseSortId) => {
      setSortState((current) => {
        if (current?.id !== id) {
          return { direction: 'asc', id }
        }

        return { direction: current.direction === 'asc' ? 'desc' : 'asc', id }
      })
    },
    [setSortState],
  )
  const hasActiveFilters = Boolean(searchValue.trim()) || fromDate !== defaultFromDate || toDate !== defaultToDate

  return (
    <Stack className="accountable-expenses-page console-table-page" gap="md">
      <div className="console-table-shell">
        <div className="accountable-expenses-command-bar">
          <div className="accountable-expenses-period-filter">
            <span className="accountable-expenses-filter-label">{t('Період')}</span>
            <div className="accountable-expenses-period-fields">
              <TextInput
                className="accountable-expenses-date-input"
                aria-label={t('Від')}
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.currentTarget.value)
                  setOrders([])
                }}
              />
              <span className="accountable-expenses-period-separator" />
              <TextInput
                className="accountable-expenses-date-input"
                aria-label={t('До')}
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.currentTarget.value)
                  setOrders([])
                }}
              />
            </div>
          </div>

          <TextInput
            className="accountable-expenses-search-input"
            leftSection={<IconSearch size={15} />}
            label={t('Пошук')}
            placeholder={t('Номер, товар, відповідальний')}
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.currentTarget.value)
              setOrders([])
            }}
          />

          <div className="accountable-expenses-command-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveFilters}
                size={34}
                variant="light"
                onClick={resetFilters}
              >
                <IconRestore size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={34} variant="light" onClick={() => void loadOrders()}>
                <IconRefresh size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {filterError && (
          <Alert className="console-table-alert" color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {filterError}
          </Alert>
        )}

        <div className="accountable-expenses-page__table console-table-body">
          <AccountableExpensesList
            isLoading={isLoading}
            rows={sortedRows}
            sortState={sortState}
            onEdit={openOrderEdit}
            onOpen={setSelectedRow}
            onPay={openPayment}
            onSort={toggleSort}
          />
        </div>
      </div>

      <ExpenseDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </Stack>
  )
}

function AccountableExpensesList({
  isLoading,
  rows,
  sortState,
  onEdit,
  onOpen,
  onPay,
  onSort,
}: {
  isLoading: boolean
  rows: AccountableExpenseRow[]
  sortState: AccountableExpenseSortState
  onEdit: (row: AccountableExpenseRow) => void
  onOpen: (row: AccountableExpenseRow) => void
  onPay: (row: AccountableExpenseRow) => void
  onSort: (id: AccountableExpenseSortId) => void
}) {
  const { t } = useI18n()

  return (
    <div className="accountable-expenses-list">
      <div className="accountable-expenses-list-head">
        <AccountableExpenseSortHeader id="document" label={t('Документ / кому видано')} sortState={sortState} onSort={onSort} />
        <AccountableExpenseSortHeader id="product" label={t('Товар / послуга')} sortState={sortState} onSort={onSort} />
        <AccountableExpenseSortHeader id="qty" label={t('К-сть')} sortState={sortState} align="right" onSort={onSort} />
        <AccountableExpenseSortHeader id="price" label={t('Ціна')} sortState={sortState} align="right" onSort={onSort} />
        <AccountableExpenseSortHeader id="amount" label={t('Сума')} sortState={sortState} align="right" onSort={onSort} />
        <AccountableExpenseSortHeader id="responsible" label={t('Відповідальний')} sortState={sortState} onSort={onSort} />
        <AccountableExpenseSortHeader id="status" label={t('Статус')} sortState={sortState} onSort={onSort} />
        <span aria-hidden />
      </div>

      <div className="accountable-expenses-list-body">
        {isLoading ? (
          <div className="accountable-expenses-list-state">{t('Завантаження підзвітних витрат')}</div>
        ) : rows.length === 0 ? (
          <div className="accountable-expenses-list-state">{t('Підзвітних витрат не знайдено')}</div>
        ) : (
          rows.map((row) => (
            <AccountableExpenseListRow
              key={row.id}
              row={row}
              onEdit={onEdit}
              onOpen={onOpen}
              onPay={onPay}
            />
          ))
        )}
      </div>
    </div>
  )
}

function AccountableExpenseSortHeader({
  align,
  id,
  label,
  sortState,
  onSort,
}: {
  align?: 'right'
  id: AccountableExpenseSortId
  label: string
  sortState: AccountableExpenseSortState
  onSort: (id: AccountableExpenseSortId) => void
}) {
  const isActive = sortState?.id === id

  return (
    <button
      className={`accountable-expenses-sort-header${isActive ? ' is-active' : ''}${align === 'right' ? ' is-right' : ''}`}
      type="button"
      onClick={() => onSort(id)}
    >
      <span>{label}</span>
      {isActive && sortState?.direction === 'desc' ? <IconChevronDown size={13} /> : <IconChevronUp size={13} />}
    </button>
  )
}

function AccountableExpenseListRow({
  row,
  onEdit,
  onOpen,
  onPay,
}: {
  row: AccountableExpenseRow
  onEdit: (row: AccountableExpenseRow) => void
  onOpen: (row: AccountableExpenseRow) => void
  onPay: (row: AccountableExpenseRow) => void
}) {
  return (
    <div
      className="accountable-expenses-row"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(row)
        }
      }}
    >
      <AccountableExpenseDocumentCell row={row} />
      <AccountableExpenseProductCell row={row} />
      <AccountableExpenseQuantityCell value={formatAmount(row.qty)} />
      <AccountableExpenseMoneyCell value={formatMoney(row.pricePerItem)} />
      <AccountableExpenseMoneyCell currency={displayValue(row.currency)} value={formatMoney(row.amount)} />
      <AccountableExpenseResponsibleCell row={row} />
      <AccountableExpenseStatusCell row={row} />
      <AccountableExpenseActions row={row} onEdit={onEdit} onOpen={onOpen} onPay={onPay} />
    </div>
  )
}

function AccountableExpenseDocumentCell({ row }: { row: AccountableExpenseRow }) {
  const title = displayValue(row.advanceNumber || row.order.Number || row.order.OrganizationNumber)
  const meta = compactStrings([formatDateTime(row.created), row.payedTo]).join(' · ')
  const organization = row.organization?.trim()
  const tooltip = compactStrings([title, meta, organization]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="accountable-expenses-document-cell">
        <span className="accountable-expenses-document-icon" aria-hidden>
          <IconFileText size={15} />
        </span>
        <span className="accountable-expenses-document-copy">
          <span className="accountable-expenses-document-title">{title}</span>
          {meta ? <span className="accountable-expenses-document-meta">{meta}</span> : null}
          {organization ? <span className="accountable-expenses-document-meta">{organization}</span> : null}
        </span>
      </span>
    </Tooltip>
  )
}

function AccountableExpenseProductCell({ row }: { row: AccountableExpenseRow }) {
  const { t } = useI18n()
  const title = displayValue(row.productName)
  const vendorCode = row.vendorCode?.trim()
  const typeLabel = row.item.IsService ? t('Послуга') : t('Товар')
  const tooltip = compactStrings([title, vendorCode, typeLabel]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="accountable-expenses-product-cell">
        <span className="accountable-expenses-product-copy">
          <span className="accountable-expenses-product-title-row">
            <span className="accountable-expenses-product-title">{title}</span>
            <Badge className="accountable-expenses-type-badge" color={row.item.IsService ? 'indigo' : 'gray'} variant="light">
              {typeLabel}
            </Badge>
          </span>
          {vendorCode ? <span className="accountable-expenses-product-code">{vendorCode}</span> : null}
        </span>
      </span>
    </Tooltip>
  )
}

function AccountableExpenseQuantityCell({ value }: { value: string }) {
  return (
    <span className="accountable-expenses-quantity-cell">
      <span className="accountable-expenses-quantity-icon" aria-hidden>
        #
      </span>
      <strong>{value}</strong>
    </span>
  )
}

function AccountableExpenseMoneyCell({ currency, value }: { currency?: string; value: string }) {
  const tooltip = compactStrings([value, currency]).join(' ')

  return (
    <Tooltip label={tooltip} openDelay={350} withArrow>
      <span className="accountable-expenses-money-cell">
        <strong>{value}</strong>
        {currency ? <small>{currency}</small> : null}
      </span>
    </Tooltip>
  )
}

function AccountableExpenseResponsibleCell({ row }: { row: AccountableExpenseRow }) {
  const title = displayValue(row.responsible)
  const comment = row.comment?.trim()
  const tooltip = compactStrings([title, comment]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="accountable-expenses-responsible-cell">
        <span>{title}</span>
        {comment ? <small>{comment}</small> : null}
      </span>
    </Tooltip>
  )
}

function AccountableExpenseStatusCell({ row }: { row: AccountableExpenseRow }) {
  const { t } = useI18n()

  return (
    <span className="accountable-expenses-status-cell">
      <Badge color={getPaymentStatusColor(row.paymentStatus)} variant="light">
        {formatPaymentStatus(row.paymentStatus, t)}
      </Badge>
      <small>{t('Підзвіт')}: {formatUnderReportStatus(row.underReportStatus, t)}</small>
    </span>
  )
}

function AccountableExpenseActions({
  row,
  onEdit,
  onOpen,
  onPay,
}: {
  row: AccountableExpenseRow
  onEdit: (row: AccountableExpenseRow) => void
  onOpen: (row: AccountableExpenseRow) => void
  onPay: (row: AccountableExpenseRow) => void
}) {
  const { t } = useI18n()

  return (
    <Group className="accountable-expenses-row-actions" gap={4} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      {row.paymentStatus !== 'paid' && (
        <Tooltip label={t('Оплатити')}>
          <ActionIcon
            aria-label={t('Оплатити')}
            color="green"
            size="sm"
            variant="subtle"
            onClick={() => onPay(row)}
          >
            <IconCreditCard size={15} />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip label={t('Відкрити накладну')}>
        <ActionIcon
          aria-label={t('Відкрити накладну')}
          color="gray"
          size="sm"
          variant="subtle"
          onClick={() => onEdit(row)}
        >
          <IconPencil size={15} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Деталі')}>
        <ActionIcon
          aria-label={t('Деталі')}
          color="gray"
          size="sm"
          variant="subtle"
          onClick={() => onOpen(row)}
        >
          <IconEye size={15} />
        </ActionIcon>
      </Tooltip>
    </Group>
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
              <Text fw={700}>{t('Повʼязаний видатковий документ')}</Text>
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
                {t('Повʼязаний видатковий документ не завантажено')}
              </Text>
            )}
          </Stack>

          {outcomeOrders.length > 1 && (
            <>
              <Divider />
              <Stack gap="xs">
                <Text fw={700}>{t('Усі привʼязки до авансових звітів')}</Text>
                {outcomeOrders.map((item, index) => {
                  const itemOutcome = item.OutcomePaymentOrder
                  const itemAdvanceReportLink = getAdvanceReportLink(itemOutcome)

                  return (
                    <Stack key={getOutcomeOrderLinkKey(item, index)} gap="xs">
                      <Group justify="space-between" gap="sm">
                        <Text fw={600} size="sm">
                          {displayValue(itemOutcome?.AdvanceNumber)}
                        </Text>
                        {itemAdvanceReportLink && (
                          <Button
                            component={Link}
                            leftSection={<IconExternalLink size={16} />}
                            size="xs"
                            to={itemAdvanceReportLink}
                            variant="light"
                          >
                            {t('Відкрити авансовий звіт')}
                          </Button>
                        )}
                      </Group>
                      <SimpleGrid cols={{ base: 1, sm: 2 }}>
                        <DetailItem label={t('Авансовий звіт')} value={displayValue(itemOutcome?.AdvanceNumber)} />
                        <DetailItem label={t('Видатковий ордер')} value={displayValue(itemOutcome?.Number || itemOutcome?.CustomNumber)} />
                        <DetailItem label={t('Дата')} value={formatDateTime(itemOutcome?.FromDate)} />
                        <DetailItem label={t('Сума')} value={formatMoney(itemOutcome?.Amount)} />
                        <DetailItem label={t('Валюта')} value={displayValue(itemOutcome?.PaymentCurrencyRegister?.Currency?.Code || itemOutcome?.PaymentCurrencyRegister?.Currency?.Name)} />
                        <DetailItem label={t('Закрито')} value={itemOutcome?.IsUnderReportDone ? t('Так') : t('Ні')} />
                      </SimpleGrid>
                    </Stack>
                  )
                })}
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

type StoredFilters = {
  from?: string
  to?: string
}

function readStoredFilters(): StoredFilters {
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null

    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const filters = parsed as Record<string, unknown>

    return {
      from: typeof filters.from === 'string' ? filters.from : undefined,
      to: typeof filters.to === 'string' ? filters.to : undefined,
    }
  } catch {
    return {}
  }
}

function writeStoredFilters(filters: StoredFilters) {
  try {
    window.sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    return
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

function sortAccountableExpenseRows(
  rows: AccountableExpenseRow[],
  sortState: AccountableExpenseSortState,
): AccountableExpenseRow[] {
  if (!sortState) {
    return rows
  }

  const direction = sortState.direction === 'asc' ? 1 : -1

  return rows.toSorted(
    (firstRow, secondRow) =>
      compareAccountableExpenseSortValues(
        getAccountableExpenseSortValue(firstRow, sortState.id),
        getAccountableExpenseSortValue(secondRow, sortState.id),
      ) * direction,
  )
}

function getAccountableExpenseSortValue(row: AccountableExpenseRow, id: AccountableExpenseSortId): number | string {
  switch (id) {
    case 'amount':
      return row.amount ?? Number.NEGATIVE_INFINITY
    case 'document':
      return compactStrings([row.advanceNumber, row.order.Number, row.created, row.payedTo, row.organization]).join(' ')
    case 'price':
      return row.pricePerItem ?? Number.NEGATIVE_INFINITY
    case 'product':
      return compactStrings([row.productName, row.vendorCode, row.item.IsService ? 'service' : 'product']).join(' ')
    case 'qty':
      return row.qty ?? Number.NEGATIVE_INFINITY
    case 'responsible':
      return compactStrings([row.responsible, row.comment]).join(' ')
    case 'status':
      return compactStrings([row.paymentStatus, row.underReportStatus]).join(' ')
  }
}

function compareAccountableExpenseSortValues(firstValue: number | string, secondValue: number | string): number {
  if (typeof firstValue === 'number' && typeof secondValue === 'number') {
    return firstValue - secondValue
  }

  return String(firstValue).localeCompare(String(secondValue), 'uk', {
    numeric: true,
    sensitivity: 'base',
  })
}

function compactStrings(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))
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

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}
