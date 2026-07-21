import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, CreditCard as CreditCardIcon, ExternalLink, ExternalLink as ExternalLinkIcon, Eye as EyeIcon, RotateCcw, Search } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type {
  DataTableColumn,
  DataTableDefaultLayout,
} from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
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

const ACCOUNTABLE_EXPENSES_TABLE_DEFAULT_LAYOUT = {
  columnOrder: [
    'document',
    'product',
    'qty',
    'price',
    'amount',
    'responsible',
    'status',
  ],
  columnPinning: {
    left: ['document'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

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
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [totalOrders, setTotalOrders] = useValueState<number | undefined>(undefined)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [selectedRow, setSelectedRow] = useValueState<AccountableExpenseRow | null>(null)
  const [actionsRow, setActionsRow] = useValueState<AccountableExpenseRow | null>(null)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const filterError = getDateRangeError(fromDate, toDate)
  const requestRef = useRef(0)
  const offset = (page - 1) * pageSize

  const loadOrders = useCallback(async () => {
    if (filterError) {
      requestRef.current += 1
      setError(null)
      setLoading(false)
      setOrders([])
      setTotalOrders(undefined)
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const trimmedSearchValue = searchValue.trim()
      const nextResponse = trimmedSearchValue
        ? await searchAccountableExpenses(trimmedSearchValue, { from: fromDate, limit: pageSize, offset, to: toDate })
        : await getAccountableExpenses({ from: fromDate, limit: pageSize, offset, to: toDate })

      if (requestRef.current === requestId) {
        setOrders(nextResponse.Items)
        setTotalOrders(nextResponse.Total)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setOrders([])
        setTotalOrders(undefined)
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити підзвітні витрати'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [filterError, fromDate, offset, pageSize, searchValue, setError, setLoading, setOrders, setTotalOrders, t, toDate])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrders()
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [loadOrders])

  useEffect(() => {
    writeStoredFilters({ from: fromDate, to: toDate })
  }, [fromDate, toDate])

  const hasClientFallbackRows = typeof totalOrders !== 'number' && orders.length > pageSize
  const visibleOrders = useMemo(
    () => (hasClientFallbackRows ? orders.slice(offset, offset + pageSize) : orders),
    [hasClientFallbackRows, offset, orders, pageSize],
  )
  const rows = useMemo(() => buildExpenseRows(visibleOrders), [visibleOrders])
  const canMoveForward = typeof totalOrders === 'number'
    ? page * pageSize < totalOrders
    : hasClientFallbackRows
      ? offset + pageSize < orders.length
      : orders.length === pageSize
  const totalPages = typeof totalOrders === 'number'
    ? Math.max(1, Math.ceil(totalOrders / pageSize))
    : page + (canMoveForward ? 1 : 0)

  useEffect(() => {
    if (typeof totalOrders === 'number' && page > totalPages) {
      setPage(totalPages)
    }
  }, [page, setPage, totalOrders, totalPages])

  const openPayment = useCallback(
    (row: AccountableExpenseRow) => {
      const netId = row.order.NetUid || row.order.Id

      if (!netId) {
        return
      }

      setActionsRow(null)
      navigate(`/accounting/consumable-orders/pay/${String(netId)}`, {
        state: {
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate, setActionsRow],
  )
  const openOrderEdit = useCallback(
    (row: AccountableExpenseRow) => {
      const netId = row.order.NetUid || row.order.Id

      if (!netId) {
        return
      }

      setActionsRow(null)
      navigate(`/accounting/consumable-orders/edit/${String(netId)}`, {
        state: {
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate, setActionsRow],
  )
  const openDetails = useCallback(
    (row: AccountableExpenseRow) => {
      setActionsRow(null)
      setSelectedRow(row)
    },
    [setActionsRow, setSelectedRow],
  )
  const resetFilters = useCallback(
    () => {
      setFromDate(defaultFromDate)
      setToDate(defaultToDate)
      setSearchValue('')
      setPage(1)
      setOrders([])
      setTotalOrders(undefined)
    },
    [defaultFromDate, defaultToDate, setFromDate, setOrders, setPage, setSearchValue, setToDate, setTotalOrders],
  )
  const columns = useAccountableExpenseColumns()
  const hasActiveFilters = Boolean(searchValue.trim()) || fromDate !== defaultFromDate || toDate !== defaultToDate

  return (
    <Stack className="accountable-expenses-page console-table-page" gap={6}>
      <div className="accountable-expenses-shell console-table-shell">
        <div className="app-filter-bar accountable-expenses-command-bar">
          <div className="app-filter-date-range">
            <TextInput
              className="accountable-expenses-date-input"
              label={t('Від')}
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.currentTarget.value)
                setPage(1)
                setOrders([])
                setTotalOrders(undefined)
              }}
            />
            <TextInput
              className="accountable-expenses-date-input"
              label={t('До')}
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.currentTarget.value)
                setPage(1)
                setOrders([])
                setTotalOrders(undefined)
              }}
            />
          </div>

          <TextInput
            className="accountable-expenses-search-input"
            leftSection={<Search size={15} />}
            label={t('Пошук')}
            placeholder={t('Номер, товар, відповідальний')}
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.currentTarget.value)
              setPage(1)
              setOrders([])
              setTotalOrders(undefined)
            }}
          />

          <div className="app-filter-actions accountable-expenses-command-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveFilters}
                size={34}
                variant="light"
                onClick={resetFilters}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Paginator
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1)
                setPageSize(nextPageSize)
                setTotalOrders(undefined)
              }}
              onRefresh={() => void loadOrders()}
            />
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
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

        <div className="accountable-expenses-page__table console-table-body">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={ACCOUNTABLE_EXPENSES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Підзвітних витрат не знайдено')}
            getRowId={(row, index) => row.id || String(index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="accountable-expenses-table-2"
            minWidth={1160}
            showLayoutControls
            tableId="accountable-expenses"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={setActionsRow}
          />
        </div>
      </div>

      <AccountableExpenseActionsModal
        row={actionsRow}
        onClose={() => setActionsRow(null)}
        onDetails={openDetails}
        onEdit={openOrderEdit}
        onPay={openPayment}
      />
      <ExpenseDetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
    </Stack>
  )
}

function useAccountableExpenseColumns() {
  return useMemo<DataTableColumn<AccountableExpenseRow>[]>(
    () => [
      {
        id: 'document',
        header: 'Документ / кому видано',
        width: 300,
        minWidth: 270,
        fill: true,
        accessor: (row) =>
          compactStrings([row.advanceNumber, row.order.Number, row.created, row.payedTo, row.organization]).join(' '),
        cell: (row) => <AccountableExpenseDocumentCell row={row} />,
      },
      {
        id: 'product',
        header: 'Товар / послуга',
        width: 290,
        minWidth: 270,
        accessor: (row) =>
          compactStrings([row.productName, row.vendorCode, row.item.IsService ? 'service' : 'product']).join(' '),
        cell: (row) => <AccountableExpenseProductCell row={row} />,
      },
      {
        id: 'qty',
        header: 'К-сть',
        width: 92,
        minWidth: 78,
        align: 'right',
        accessor: (row) => row.qty ?? Number.NEGATIVE_INFINITY,
        cell: (row) => <AccountableExpenseQuantityCell value={formatAmount(row.qty)} />,
      },
      {
        id: 'price',
        header: 'Ціна',
        width: 116,
        minWidth: 108,
        align: 'right',
        accessor: (row) => row.pricePerItem ?? Number.NEGATIVE_INFINITY,
        cell: (row) => <AccountableExpenseMoneyCell value={formatMoney(row.pricePerItem)} />,
      },
      {
        id: 'amount',
        header: 'Сума',
        width: 134,
        minWidth: 126,
        align: 'right',
        accessor: (row) => row.amount ?? Number.NEGATIVE_INFINITY,
        cell: (row) => <AccountableExpenseMoneyCell currency={displayValue(row.currency)} value={formatMoney(row.amount)} />,
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 200,
        minWidth: 178,
        accessor: (row) => compactStrings([row.responsible, row.comment]).join(' '),
        cell: (row) => <AccountableExpenseResponsibleCell row={row} />,
      },
      {
        id: 'status',
        header: 'Статус',
        width: 150,
        minWidth: 138,
        accessor: (row) => compactStrings([row.paymentStatus, row.underReportStatus]).join(' '),
        cell: (row) => <AccountableExpenseStatusCell row={row} />,
      },
    ],
    [],
  )
}

function AccountableExpenseDocumentCell({ row }: { row: AccountableExpenseRow }) {
  const title = displayValue(row.advanceNumber || row.order.Number || row.order.OrganizationNumber)
  const meta = compactStrings([formatDateTime(row.created), row.payedTo]).join(' · ')
  const organization = row.organization?.trim()
  const nativeTooltip = compactStrings([title, meta, organization]).join('\n')

  return (
    <span className="accountable-expenses-document-cell" title={nativeTitle(nativeTooltip)}>
      <span className="accountable-expenses-document-copy">
        <span className="accountable-expenses-document-title">{title}</span>
        {meta ? <span className="accountable-expenses-document-meta">{meta}</span> : null}
        {organization ? <span className="accountable-expenses-document-meta">{organization}</span> : null}
      </span>
    </span>
  )
}

function AccountableExpenseProductCell({ row }: { row: AccountableExpenseRow }) {
  const { t } = useI18n()
  const title = displayValue(row.productName)
  const vendorCode = row.vendorCode?.trim()
  const typeLabel = row.item.IsService ? t('Послуга') : t('Товар')
  const nativeTooltip = compactStrings([title, vendorCode, typeLabel]).join('\n')

  return (
    <span className="accountable-expenses-product-cell" title={nativeTitle(nativeTooltip)}>
      <span className="accountable-expenses-product-copy">
        <span className="accountable-expenses-product-title-row">
          <span className="accountable-expenses-product-title">{title}</span>
          <Badge
            className={`app-role-pill accountable-expenses-type-badge${row.item.IsService ? ' is-orange' : ' is-gray'}`}
            color={row.item.IsService ? 'orange' : 'gray'}
            variant="light"
          >
            {typeLabel}
          </Badge>
        </span>
        {vendorCode ? <span className="accountable-expenses-product-code">{vendorCode}</span> : null}
      </span>
    </span>
  )
}

function AccountableExpenseQuantityCell({ value }: { value: string }) {
  return (
    <span className="accountable-expenses-quantity-cell">
      <strong>{value}</strong>
    </span>
  )
}

function AccountableExpenseMoneyCell({ currency, value }: { currency?: string; value: string }) {
  return (
    <span className="accountable-expenses-money-cell" title={nativeTitle(compactStrings([value, currency]).join(' '))}>
      <strong>{value}</strong>
      {currency ? <small>{currency}</small> : null}
    </span>
  )
}

function AccountableExpenseResponsibleCell({ row }: { row: AccountableExpenseRow }) {
  const title = displayValue(row.responsible)
  const comment = row.comment?.trim()
  const nativeTooltip = compactStrings([title, comment]).join('\n')

  return (
    <span className="accountable-expenses-responsible-cell" title={nativeTitle(nativeTooltip)}>
      <span>{title}</span>
      {comment ? <small>{comment}</small> : null}
    </span>
  )
}

function AccountableExpenseStatusCell({ row }: { row: AccountableExpenseRow }) {
  const { t } = useI18n()

  return (
    <span className="accountable-expenses-status-cell">
      <Badge className={`app-role-pill ${getPaymentStatusPillVariant(row.paymentStatus)}`} variant="light">
        {formatPaymentStatus(row.paymentStatus, t)}
      </Badge>
      <small>{t('Підзвіт')}: {formatUnderReportStatus(row.underReportStatus, t)}</small>
    </span>
  )
}

function AccountableExpenseActionsModal({
  row,
  onClose,
  onDetails,
  onEdit,
  onPay,
}: {
  row: AccountableExpenseRow | null
  onClose: () => void
  onDetails: (row: AccountableExpenseRow) => void
  onEdit: (row: AccountableExpenseRow) => void
  onPay: (row: AccountableExpenseRow) => void
}) {
  const { t } = useI18n()
  const isPaid = row?.paymentStatus === 'paid'
  const title = row ? displayValue(row.productName || row.advanceNumber || row.order.Number) || t('Підзвітна витрата') : t('Підзвітна витрата')

  return (
    <AppModal
      centered
      opened={Boolean(row)}
      size={496}
      title={
        <span className="accountable-expenses-action-title">
          <span className={`accountable-expenses-action-status-dot${isPaid ? ' is-active' : ''}`} />
          {title}
        </span>
      }
      onClose={onClose}
    >
      {row && (
        <Stack className="app-modal-actions" gap="xs">
          <Button
            fullWidth
            color="dark"
            justify="flex-start"
            leftSection={
              <span className="app-action-icon">
                <EyeIcon size={20} color="var(--mantine-color-gray-7)" />
              </span>
            }
            size="md"
            variant="subtle"
            onClick={() => onDetails(row)}
          >
            {t('Деталі')}
          </Button>
          <Button
            fullWidth
            color="dark"
            justify="flex-start"
            leftSection={
              <span className="app-action-icon">
                <ExternalLinkIcon size={20} color="var(--mantine-color-gray-7)" />
              </span>
            }
            size="md"
            variant="subtle"
            onClick={() => onEdit(row)}
          >
            {t('Відкрити накладну')}
          </Button>
          {row.paymentStatus !== 'paid' && (
            <Button
              fullWidth
              color="dark"
              justify="flex-start"
              leftSection={
                <span className="app-action-icon">
                  <CreditCardIcon size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              size="md"
              variant="subtle"
              onClick={() => onPay(row)}
            >
              {t('Оплатити')}
            </Button>
          )}
        </Stack>
      )}
    </AppModal>
  )
}

function ExpenseDetailDrawer({ row, onClose }: { row: AccountableExpenseRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const outcome = getOutcomePaymentOrder(row?.order)
  const outcomeOrders = getOutcomePaymentOrders(row?.order)
  const advanceReportLink = getAdvanceReportLink(outcome)
  const paymentLabel = row ? formatPaymentStatus(row.paymentStatus, t) : ''
  const underReportLabel = row ? formatUnderReportStatus(row.underReportStatus, t) : ''
  const typeLabel = row?.item.IsService ? t('Послуга') : t('Товар')
  const heroMeta = row
    ? compactStrings([
        row.advanceNumber,
        row.created ? formatDateTime(row.created) : undefined,
        row.organization,
      ]).join(' / ')
    : ''

  return (
    <AppDrawer
      classNames={{
        body: 'accountable-expense-detail-drawer__body',
        content: 'accountable-expense-detail-drawer__content',
      }}
      className="accountable-expense-detail-drawer"
      opened={Boolean(row)}
      padding="md"
      size="xl"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Підзвітна витрата')}</span>}
      onClose={onClose}
    >
      {row && (
        <div className="accountable-expense-detail">
          <section className="accountable-expense-detail-hero">
            <div>
              <div className="accountable-expense-detail-title">
                <div className="accountable-expense-detail-title__copy">
                  <strong>{displayValue(row.productName || row.advanceNumber || row.order.Number)}</strong>
                  <span>{heroMeta || displayValue(undefined)}</span>
                </div>
              </div>
              <div className="accountable-expense-detail-badges">
                <Badge className={`app-role-pill ${getPaymentStatusPillVariant(row.paymentStatus)}`} variant="light">
                  {paymentLabel}
                </Badge>
                {underReportLabel ? (
                  <Badge className={row.underReportStatus === 'closed' ? 'app-role-pill is-green' : row.underReportStatus === 'mixed' ? 'app-role-pill is-orange' : 'app-role-pill is-gray'} variant="light">
                    {underReportLabel}
                  </Badge>
                ) : null}
                <Badge className="app-role-pill is-orange" variant="light">
                  {typeLabel}
                </Badge>
              </div>
            </div>
            <div className="accountable-expense-detail-metrics">
              <ExpenseDetailMetric label={t('Сума з ПДВ')} meta={displayValue(row.currency)} tone="orange" value={formatMoney(row.amount)} />
              <ExpenseDetailMetric label={t('Оплачено')} meta={displayValue(row.currency)} value={formatMoney(row.paidAmount)} />
              <ExpenseDetailMetric label={t('Кількість')} meta={typeLabel} value={formatAmount(row.qty)} />
            </div>
          </section>

          <ExpenseDetailSection title={t('Реквізити')}>
            <div className="accountable-expense-detail-grid">
              <DetailItem label={t('Створено')} mono value={formatDateTime(row.created)} />
              <DetailItem label={t('Номер документа')} mono value={displayValue(row.order.Number)} />
              <DetailItem label={t('Номер організації')} mono value={displayValue(row.order.OrganizationNumber)} />
              <DetailItem label={t('Дата організації')} mono value={formatDateTime(row.order.OrganizationFromDate)} />
              <DetailItem label={t('Авансовий звіт')} mono value={displayValue(row.advanceNumber)} />
              <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
              <DetailItem label={t('Кому видано')} value={displayValue(row.payedTo)} />
              <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            </div>
          </ExpenseDetailSection>

          <ExpenseDetailSection title={t('Товар або послуга')}>
            <div className="accountable-expense-detail-product">
              <div className="accountable-expense-detail-product__main">
                <div>
                  <strong>{displayValue(row.productName)}</strong>
                  <span>{displayValue(row.vendorCode)}</span>
                </div>
              </div>
              <Badge className="app-role-pill is-orange" variant="light">
                {typeLabel}
              </Badge>
            </div>
            <div className="accountable-expense-detail-grid is-compact">
              <DetailItem label={t('Артикул')} mono value={displayValue(row.vendorCode)} />
              <DetailItem label={t('Тип')} value={typeLabel} />
              <DetailItem label={t('Кількість')} mono value={formatAmount(row.qty)} />
              <DetailItem label={t('Ціна')} mono value={formatMoney(row.pricePerItem)} />
              <DetailItem label={t('Сума без ПДВ')} mono value={formatMoney(row.item.TotalPrice)} />
              <DetailItem label={t('ПДВ')} mono value={formatMoney(row.item.VAT)} />
              <DetailItem label={t('ПДВ %')} mono value={formatAmount(row.item.VatPercent)} />
              <DetailItem label={t('Валюта')} mono value={displayValue(row.currency)} />
            </div>
          </ExpenseDetailSection>

          <ExpenseDetailSection title={t('Стан розрахунків')}>
            <div className="accountable-expense-detail-grid is-compact">
              <DetailItem label={t('Оплата')} value={paymentLabel} />
              <DetailItem label={t('Підзвіт закрито')} value={underReportLabel} />
              <DetailItem label={t('Оплачено сумарно')} mono value={formatMoney(row.paidAmount)} />
              <DetailItem label={t('Сума з ПДВ')} mono value={formatMoney(row.amount)} />
            </div>
          </ExpenseDetailSection>

          <ExpenseDetailSection title={t('Примітка')}>
            <p className="accountable-expense-detail-comment">{displayValue(row.comment)}</p>
          </ExpenseDetailSection>

          <ExpenseDetailSection
            action={
              advanceReportLink ? (
                <Button
                  className="accountable-expense-detail-open-button"
                  component={Link}
                  leftSection={<ExternalLink size={14} />}
                  size="xs"
                  to={advanceReportLink}
                  variant="outline"
                >
                  {t('Відкрити')}
                </Button>
              ) : null
            }
            title={t('Повʼязаний видатковий документ')}
          >
            {outcome ? (
              <div className="accountable-expense-detail-grid">
                <DetailItem label={t('Видатковий ордер')} value={displayValue(outcome.Number || outcome.CustomNumber)} />
                <DetailItem label={t('Дата')} value={formatDateTime(outcome.FromDate)} />
                <DetailItem label={t('Сума')} value={formatMoney(outcome.Amount)} />
                <DetailItem label={t('Валюта')} mono value={displayValue(outcome.PaymentCurrencyRegister?.Currency?.Code || outcome.PaymentCurrencyRegister?.Currency?.Name)} />
                <DetailItem label={t('Рахунок')} value={displayValue(outcome.PaymentCurrencyRegister?.PaymentRegister?.Name)} />
                <DetailItem label={t('Стаття руху')} value={displayValue(outcome.PaymentMovementOperation?.PaymentMovement?.OperationName)} />
                <DetailItem label={t('Призначення платежу')} value={displayValue(outcome.PaymentPurpose)} />
                <DetailItem label={t('Коментар ордера')} value={displayValue(outcome.Comment)} />
              </div>
            ) : (
              <Text className="accountable-expense-detail-empty" c="dimmed" size="sm">
                {t('Повʼязаний видатковий документ не завантажено')}
              </Text>
            )}
          </ExpenseDetailSection>

          {outcomeOrders.length > 1 && (
            <ExpenseDetailSection title={t('Усі привʼязки до авансових звітів')}>
              <div className="accountable-expense-detail-links">
                {outcomeOrders.map((item, index) => {
                  const itemOutcome = item.OutcomePaymentOrder
                  const itemAdvanceReportLink = getAdvanceReportLink(itemOutcome)

                  return (
                    <div className="accountable-expense-detail-link-card" key={getOutcomeOrderLinkKey(item, index)}>
                      <Group className="accountable-expense-detail-link-card__head" justify="space-between" gap="sm">
                        <strong>{displayValue(itemOutcome?.AdvanceNumber)}</strong>
                        {itemAdvanceReportLink && (
                          <Button
                            className="accountable-expense-detail-open-button"
                            component={Link}
                            leftSection={<ExternalLink size={14} />}
                            size="xs"
                            to={itemAdvanceReportLink}
                            variant="outline"
                          >
                            {t('Відкрити')}
                          </Button>
                        )}
                      </Group>
                      <div className="accountable-expense-detail-grid">
                        <DetailItem label={t('Авансовий звіт')} mono value={displayValue(itemOutcome?.AdvanceNumber)} />
                        <DetailItem label={t('Видатковий ордер')} value={displayValue(itemOutcome?.Number || itemOutcome?.CustomNumber)} />
                        <DetailItem label={t('Дата')} value={formatDateTime(itemOutcome?.FromDate)} />
                        <DetailItem label={t('Сума')} value={formatMoney(itemOutcome?.Amount)} />
                        <DetailItem label={t('Валюта')} mono value={displayValue(itemOutcome?.PaymentCurrencyRegister?.Currency?.Code || itemOutcome?.PaymentCurrencyRegister?.Currency?.Name)} />
                        <DetailItem label={t('Закрито')} value={itemOutcome?.IsUnderReportDone ? t('Так') : t('Ні')} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </ExpenseDetailSection>
          )}
        </div>
      )}
    </AppDrawer>
  )
}

function ExpenseDetailMetric({
  label,
  meta,
  tone = 'neutral',
  value,
}: {
  label: string
  meta?: string
  tone?: 'neutral' | 'orange'
  value: string
}) {
  return (
    <div className={`accountable-expense-detail-metric is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {meta && <small>{meta}</small>}
    </div>
  )
}

function ExpenseDetailSection({
  action,
  children,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  title: string
}) {
  return (
    <section className="accountable-expense-detail-section">
      <div className="accountable-expense-detail-section__header">
        <Text className="app-section-title" fw={600} size="sm">
          {title}
        </Text>
        {action && <div className="accountable-expense-detail-section__action">{action}</div>}
      </div>
      <div className="accountable-expense-detail-section__body">{children}</div>
    </section>
  )
}

function DetailItem({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className={`accountable-expense-detail-field${mono ? ' is-mono' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function compactStrings(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))
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

function formatAmount(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? amountFormatter.format(value) : ''
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}

function nativeTitle(value: string): string | undefined {
  const title = value.trim()

  return title ? title : undefined
}

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getPaymentStatusPillVariant(status: Parameters<typeof getPaymentStatusColor>[0]) {
  const color = getPaymentStatusColor(status)

  if (color === 'green') {
    return 'is-green'
  }

  // 'orange' = частково; все інше (неоплачено) — червоний, щоб кидалось в очі.
  return color === 'orange' ? 'is-orange' : 'is-red'
}
