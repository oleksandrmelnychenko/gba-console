import {
  ActionIcon,
  Alert,
  Button,
  Badge,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconCreditCard,
  IconEye,
  IconFileText,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  getConsumableOrders,
  searchConsumableOrders,
} from '../api/consumableOrdersApi'
import type {
  ConsumableOrderRow,
  ConsumablesOrder,
  ConsumablesOrderItem,
  NamedEntity,
  OutcomePaymentOrderConsumablesOrder,
} from '../types'
import './consumable-orders-page.css'
import '../../../shared/ui/console-table-page.css'

const SEARCH_DEBOUNCE_MS = 350
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

type ConsumableOrderSortId = 'amount' | 'document' | 'responsible' | 'serviceOrganization' | 'status' | 'storage'

type ConsumableOrderSortState = {
  direction: 'asc' | 'desc'
  id: ConsumableOrderSortId
} | null

export function ConsumableOrdersPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [orders, setOrders] = useValueState<ConsumablesOrder[]>([])
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-DEFAULT_LOOKBACK_DAYS))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [searchValue, setSearchValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [selectedRow, setSelectedRow] = useValueState<ConsumableOrderRow | null>(null)
  const [sortState, setSortState] = useValueState<ConsumableOrderSortState>(null)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
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
      const nextOrders = normalizedSearchValue
        ? await searchConsumableOrders(normalizedSearchValue, { from: fromDate, to: toDate })
        : await getConsumableOrders({ from: fromDate, to: toDate })

      if (requestRef.current === requestId) {
        setOrders(nextOrders)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setOrders([])
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити прибуткові накладні'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [filterError, fromDate, normalizedSearchValue, setError, setLoading, setOrders, t, toDate])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const rows = useMemo(() => buildConsumableOrderRows(orders), [orders])
  const sortedRows = useMemo(() => sortConsumableOrderRows(rows, sortState), [rows, sortState])
  const isTableBusy = isLoading || isSearchSettling
  const defaultFromDate = shiftDate(-DEFAULT_LOOKBACK_DAYS)
  const defaultToDate = formatLocalDate(new Date())
  const hasActiveFilters = Boolean(searchValue.trim()) || fromDate !== defaultFromDate || toDate !== defaultToDate

  function resetFilters() {
    setFromDate(defaultFromDate)
    setToDate(defaultToDate)
    setSearchValue('')
    setOrders([])
  }

  function toggleSort(id: ConsumableOrderSortId) {
    setSortState((current) => {
      if (current?.id !== id) {
        return { direction: 'asc', id }
      }

      return { direction: current.direction === 'asc' ? 'desc' : 'asc', id }
    })
  }

  return (
    <Stack className="consumable-orders-page console-table-page" gap="md">
      <PageHeaderActions>
        <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={() => navigate('/accounting/consumable-orders/new', { state: { backgroundLocation: location, returnPath: '/accounting/consumable-orders' } })}>
          {t('Додати')}
        </Button>
      </PageHeaderActions>

      <div className="console-table-shell">
        <div className="consumable-orders-command-bar">
          <div className="consumable-orders-period-filter">
            <span className="consumable-orders-filter-label">{t('Період')}</span>
            <div className="consumable-orders-period-fields">
              <TextInput
                className="consumable-orders-date-input"
                aria-label={t('Від')}
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.currentTarget.value)}
              />
              <span className="consumable-orders-period-separator" />
              <TextInput
                className="consumable-orders-date-input"
                aria-label={t('До')}
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.currentTarget.value)}
              />
            </div>
          </div>

          <TextInput
            className="consumable-orders-search-input"
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Номер, постачальник, склад або коментар')}
            value={searchValue}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
          <div className="consumable-orders-command-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveFilters}
                size={38}
                variant="light"
                onClick={resetFilters}
              >
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void loadOrders()}>
                <IconRefresh size={18} />
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

        <div className="consumable-orders-page__table console-table-body">
          <ConsumableOrdersList
            isLoading={isTableBusy}
            rows={sortedRows}
            sortState={sortState}
            onOpen={setSelectedRow}
            onPay={(row) => navigateToPay(navigate, row, location)}
            onSort={toggleSort}
            onView={(row) => navigateToEdit(navigate, row, location)}
          />
        </div>
      </div>

      <ConsumableOrderDetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onPay={(row) => navigateToPay(navigate, row, location)}
        onView={(row) => navigateToEdit(navigate, row, location)}
      />
    </Stack>
  )
}

function ConsumableOrdersList({
  isLoading,
  rows,
  sortState,
  onOpen,
  onPay,
  onSort,
  onView,
}: {
  isLoading: boolean
  rows: ConsumableOrderRow[]
  sortState: ConsumableOrderSortState
  onOpen: (row: ConsumableOrderRow) => void
  onPay: (row: ConsumableOrderRow) => void
  onSort: (id: ConsumableOrderSortId) => void
  onView: (row: ConsumableOrderRow) => void
}) {
  const { t } = useI18n()

  return (
    <div className="consumable-orders-list">
      <div className="consumable-orders-list-head">
        <ConsumableOrderSortHeader id="document" label={t('Документ / дата')} sortState={sortState} onSort={onSort} />
        <ConsumableOrderSortHeader id="serviceOrganization" label={t('Постачальник / організація')} sortState={sortState} onSort={onSort} />
        <ConsumableOrderSortHeader id="storage" label={t('Склад')} sortState={sortState} onSort={onSort} />
        <ConsumableOrderSortHeader id="amount" label={t('Сума')} sortState={sortState} align="right" onSort={onSort} />
        <ConsumableOrderSortHeader id="responsible" label={t('Відповідальний')} sortState={sortState} onSort={onSort} />
        <ConsumableOrderSortHeader id="status" label={t('Статус')} sortState={sortState} onSort={onSort} />
        <span aria-hidden />
      </div>

      <div className="consumable-orders-list-body">
        {isLoading ? (
          <div className="consumable-orders-list-state">{t('Завантаження прибуткових накладних')}</div>
        ) : rows.length === 0 ? (
          <div className="consumable-orders-list-state">{t('Прибуткових накладних не знайдено')}</div>
        ) : (
          rows.map((row) => (
            <ConsumableOrderListRow
              key={row.id}
              row={row}
              onOpen={onOpen}
              onPay={onPay}
              onView={onView}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ConsumableOrderSortHeader({
  align,
  id,
  label,
  sortState,
  onSort,
}: {
  align?: 'right'
  id: ConsumableOrderSortId
  label: string
  sortState: ConsumableOrderSortState
  onSort: (id: ConsumableOrderSortId) => void
}) {
  const isActive = sortState?.id === id

  return (
    <button
      className={`consumable-orders-sort-header${isActive ? ' is-active' : ''}${align === 'right' ? ' is-right' : ''}`}
      type="button"
      onClick={() => onSort(id)}
    >
      <span>{label}</span>
      {isActive && sortState?.direction === 'desc' ? <IconChevronDown size={13} /> : <IconChevronUp size={13} />}
    </button>
  )
}

function ConsumableOrderListRow({
  row,
  onOpen,
  onPay,
  onView,
}: {
  row: ConsumableOrderRow
  onOpen: (row: ConsumableOrderRow) => void
  onPay: (row: ConsumableOrderRow) => void
  onView: (row: ConsumableOrderRow) => void
}) {
  return (
    <div
      className="consumable-orders-row"
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
      <ConsumableOrderDocumentCell row={row} />
      <ConsumableOrderSupplierCell row={row} />
      <ConsumableOrderStorageCell row={row} />
      <ConsumableOrderAmountCell row={row} />
      <ConsumableOrderResponsibleCell row={row} />
      <ConsumableOrderStatusCell row={row} />
      <ConsumableOrderActions row={row} onOpen={onOpen} onPay={onPay} onView={onView} />
    </div>
  )
}

function ConsumableOrderDocumentCell({ row }: { row: ConsumableOrderRow }) {
  const { t } = useI18n()
  const invoice = row.organizationNumber?.trim()
  const titleValue = row.order.Number || invoice
  const title = displayValue(titleValue)
  const createdDate = formatDateTime(row.created)
  const organizationDate = row.organizationFromDate ? formatDateTime(row.organizationFromDate) : ''
  const invoiceTooltip = invoice ? `${t('Накладна')}: ${invoice}` : ''
  const createdTooltip = `${t('Створено')}: ${createdDate}`
  const organizationDateTooltip = organizationDate ? `${t('Вхід')}: ${organizationDate}` : ''
  const tooltip = compactStrings([title, invoiceTooltip, createdTooltip, organizationDateTooltip]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="consumable-orders-document-cell">
        <span className="consumable-orders-document-icon" aria-hidden>
          <IconFileText size={15} />
        </span>
        <span className="consumable-orders-document-copy">
          <span className="consumable-orders-document-title">{title}</span>
          <span className="consumable-orders-document-dates">
            <span><small>{t('Ств.')}</small>{createdDate}</span>
            {organizationDate ? <span><small>{t('Вх.')}</small>{organizationDate}</span> : null}
          </span>
          {invoice ? <span className="consumable-orders-document-invoice"><small>{t('Накл.')}</small>{invoice}</span> : null}
        </span>
      </span>
    </Tooltip>
  )
}

function ConsumableOrderSupplierCell({ row }: { row: ConsumableOrderRow }) {
  const title = displayValue(row.serviceOrganization)
  const organization = row.organization?.trim()
  const agreement = getOrderAgreementName(row)
  const tooltip = compactStrings([title, organization, agreement]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="consumable-orders-two-line-cell">
        <span>{title}</span>
        {organization ? <small>{organization}</small> : null}
        {agreement ? <small>{agreement}</small> : null}
      </span>
    </Tooltip>
  )
}

function ConsumableOrderStorageCell({ row }: { row: ConsumableOrderRow }) {
  const { t } = useI18n()
  const title = displayValue(row.storage)
  const meta = t('{{count}} позицій').replace('{{count}}', formatAmount(row.itemCount))
  const tooltip = compactStrings([title, meta]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="consumable-orders-two-line-cell">
        <span>{title}</span>
        <small>{meta}</small>
      </span>
    </Tooltip>
  )
}

function ConsumableOrderAmountCell({ row }: { row: ConsumableOrderRow }) {
  const { t } = useI18n()
  const totalWithoutVat = formatMoney(row.totalAmountWithoutVat)
  const totalWithVat = formatMoney(row.amount)
  const currency = displayValue(row.currency)
  const totalWithVatLabel = `${t('З ПДВ')}: ${totalWithVat}`
  const totalWithoutVatLabel = `${t('Без ПДВ')}: ${totalWithoutVat}`
  const tooltip = compactStrings([totalWithVatLabel, currency, totalWithoutVatLabel]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="consumable-orders-amount-cell">
        <strong>{totalWithVat}</strong>
        <span><small>{t('без ПДВ')}</small>{totalWithoutVat}</span>
        <em>{currency}</em>
      </span>
    </Tooltip>
  )
}

function ConsumableOrderResponsibleCell({ row }: { row: ConsumableOrderRow }) {
  const title = displayValue(row.responsible)
  const comment = row.comment?.trim()
  const tooltip = compactStrings([title, comment]).join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="consumable-orders-responsible-cell">
        <span>{title}</span>
        {comment ? <small>{comment}</small> : null}
      </span>
    </Tooltip>
  )
}

function ConsumableOrderStatusCell({ row }: { row: ConsumableOrderRow }) {
  const { t } = useI18n()

  return (
    <span className="consumable-orders-status-cell">
      <Badge color={row.isPayed ? 'green' : 'orange'} variant="light">
        {row.isPayed ? t('Оплачено') : t('Не оплачено')}
      </Badge>
      <small>{row.isDone ? t('Закрито') : t('В роботі')}</small>
    </span>
  )
}

function ConsumableOrderActions({
  row,
  onOpen,
  onPay,
  onView,
}: {
  row: ConsumableOrderRow
  onOpen: (row: ConsumableOrderRow) => void
  onPay: (row: ConsumableOrderRow) => void
  onView: (row: ConsumableOrderRow) => void
}) {
  const { t } = useI18n()

  return (
    <Group className="consumable-orders-row-actions" gap={4} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      {!row.isPayed && (
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
      <Tooltip label={t('Редагувати')}>
        <ActionIcon
          aria-label={t('Редагувати')}
          color={CREATE_ACTION_COLOR}
          size="sm"
          variant="subtle"
          onClick={() => onView(row)}
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


function ConsumableOrderDetailDrawer({
  row,
  onClose,
  onPay,
  onView,
}: {
  row: ConsumableOrderRow | null
  onClose: () => void
  onPay: (row: ConsumableOrderRow) => void
  onView: (row: ConsumableOrderRow) => void
}) {
  const { t } = useI18n()
  const order = row?.order
  const items = order?.ConsumablesOrderItems || []
  const outcomes = order?.OutcomePaymentOrderConsumablesOrders || []

  return (
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={t('Прибуткова накладна')} onClose={onClose}>
      {row && order && (
        <Stack gap="md">
          <Group justify="flex-end">
            <Button leftSection={<IconPencil size={16} />} variant="light" onClick={() => onView(row)}>
              {t('Редагувати')}
            </Button>
            {!order.IsPayed && (
              <Button color="green" leftSection={<IconCreditCard size={16} />} variant="light" onClick={() => onPay(row)}>
                {t('Оплатити')}
              </Button>
            )}
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Створено')} value={formatDateTime(row.created)} />
            <DetailItem label={t('Номер')} value={displayValue(order.Number)} />
            <DetailItem label={t('Дата входу')} value={formatDateTime(order.OrganizationFromDate)} />
            <DetailItem label={t('Номер накладної')} value={displayValue(order.OrganizationNumber)} />
            <DetailItem label={t('Постачальник послуг')} value={displayValue(row.serviceOrganization)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Договір')} value={displayValue(order.SupplyOrganizationAgreement?.Name || order.SupplyOrganizationAgreement?.Number)} />
            <DetailItem label={t('Склад')} value={displayValue(row.storage)} />
            <DetailItem label={t('Сума')} value={formatMoney(row.totalAmountWithoutVat)} />
            <DetailItem label={t('Разом з ПДВ')} value={formatMoney(row.amount)} />
            <DetailItem label={t('Валюта')} value={displayValue(row.currency)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Оплачено')} value={order.IsPayed ? t('Так') : t('Ні')} />
            <DetailItem label={t('Закрито')} value={order.IsDone ? t('Так') : t('Ні')} />
          </SimpleGrid>

          <Stack gap={2}>
            <Text c="dimmed" size="xs" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{displayValue(row.comment)}</Text>
          </Stack>

          <Divider />

          <Stack gap="sm">
            <Text fw={700}>{t('Позиції')}</Text>
            {items.length > 0 ? (
              items.map((item, index) => (
                <SimpleGrid key={getItemKey(item, index)} cols={{ base: 1, sm: 3 }}>
                  <DetailItem label={t('Артикул')} value={displayValue(item.ConsumableProduct?.VendorCode)} />
                  <DetailItem label={t('Назва')} value={displayValue(getItemName(item))} />
                  <DetailItem label={t('Категорія')} value={displayValue(item.ConsumableProductCategory?.Name || item.ConsumableProduct?.ConsumableProductCategory?.Name)} />
                  <DetailItem label={t('Кількість')} value={formatAmount(item.Qty)} />
                  <DetailItem label={t('Ціна')} value={formatMoney(item.PricePerItem)} />
                  <DetailItem label={t('Сума без ПДВ')} value={formatMoney(item.TotalPrice)} />
                  <DetailItem label={t('ПДВ %')} value={formatAmount(item.VatPercent)} />
                  <DetailItem label={t('ПДВ')} value={formatMoney(item.VAT)} />
                  <DetailItem label={t('Разом з ПДВ')} value={formatMoney(item.TotalPriceWithVAT)} />
                </SimpleGrid>
              ))
            ) : (
              <Text c="dimmed" size="sm">
                {t('Позицій немає')}
              </Text>
            )}
          </Stack>

          <Divider />

          <Stack gap="sm">
            <Text fw={700}>{t('Структура документа')}</Text>
            {outcomes.length > 0 ? (
              outcomes.map((item, index) => (
                <OutcomeStructureItem key={getOutcomeLinkKey(item, index)} item={item} />
              ))
            ) : (
              <Text c="dimmed" size="sm">
                {t('Оплат за документом немає')}
              </Text>
            )}
          </Stack>
        </Stack>
      )}
    </AppDrawer>
  )
}

function OutcomeStructureItem({ item }: { item: OutcomePaymentOrderConsumablesOrder }) {
  const { t } = useI18n()
  const outcome = item.OutcomePaymentOrder

  if (!outcome) {
    return (
      <Text c="dimmed" size="sm">
        {t('Платіж не завантажено')}
      </Text>
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <DetailItem label={t('Ордер')} value={displayValue(outcome.Number || outcome.AdvanceNumber)} />
      <DetailItem label={t('Дата')} value={formatDateTime(outcome.FromDate)} />
      <DetailItem label={t('Сума')} value={formatMoney(outcome.Amount)} />
      <DetailItem label={t('Валюта')} value={displayValue(outcome.PaymentCurrencyRegister?.Currency?.Code || outcome.PaymentCurrencyRegister?.Currency?.Name)} />
      <DetailItem label={t('Організація')} value={displayValue(getEntityName(outcome.Organization))} />
      <DetailItem label={t('Кому видано')} value={displayValue(getEntityName(outcome.Colleague))} />
      <DetailItem label={t('Підзвіт')} value={outcome.IsUnderReport ? t('Так') : t('Ні')} />
      <DetailItem label={t('Скасовано')} value={outcome.IsCanceled ? t('Так') : t('Ні')} />
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

function buildConsumableOrderRows(orders: ConsumablesOrder[]): ConsumableOrderRow[] {
  return orders.map((order, index) => ({
    amount: order.ConsumableProductOrganization ? order.TotalAmount : 0,
    comment: order.Comment,
    created: order.Created,
    currency: order.ConsumableProductOrganization
      ? order.SupplyOrganizationAgreement?.Currency?.Code || order.SupplyOrganizationAgreement?.Currency?.Name
      : undefined,
    id: String(order.NetUid || order.Id || index),
    isDone: order.IsDone,
    isPayed: order.IsPayed,
    itemCount: order.ConsumablesOrderItems?.length || 0,
    order,
    organization: getEntityName(order.SupplyOrganizationAgreement?.Organization),
    organizationFromDate: order.OrganizationFromDate,
    organizationNumber: order.OrganizationNumber,
    responsible: getEntityName(order.User),
    serviceOrganization: getEntityName(order.ConsumableProductOrganization),
    storage: getEntityName(order.ConsumablesStorage),
    totalAmountWithoutVat: order.TotalAmountWithoutVAT,
  }))
}

function sortConsumableOrderRows(rows: ConsumableOrderRow[], sortState: ConsumableOrderSortState): ConsumableOrderRow[] {
  if (!sortState) {
    return rows
  }

  const direction = sortState.direction === 'asc' ? 1 : -1

  return [...rows].sort((left, right) => compareConsumableOrderSortValues(
    getConsumableOrderSortValue(left, sortState.id),
    getConsumableOrderSortValue(right, sortState.id),
  ) * direction)
}

function getConsumableOrderSortValue(row: ConsumableOrderRow, id: ConsumableOrderSortId): number | string {
  switch (id) {
    case 'amount':
      return row.amount ?? row.totalAmountWithoutVat ?? 0
    case 'document':
      return compactStrings([row.order.Number, row.created, row.organizationNumber, row.organizationFromDate]).join(' ')
    case 'responsible':
      return compactStrings([row.responsible, row.comment]).join(' ')
    case 'serviceOrganization':
      return compactStrings([row.serviceOrganization, row.organization, getOrderAgreementName(row)]).join(' ')
    case 'status':
      return `${row.isPayed ? 1 : 0}-${row.isDone ? 1 : 0}`
    case 'storage':
      return compactStrings([row.storage, row.itemCount]).join(' ')
  }
}

function compareConsumableOrderSortValues(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }

  return String(left).localeCompare(String(right), 'uk', { numeric: true, sensitivity: 'base' })
}

function getOrderAgreementName(row: ConsumableOrderRow): string {
  return displayValue(row.order.SupplyOrganizationAgreement?.Name || row.order.SupplyOrganizationAgreement?.Number)
}

function compactStrings(values: Array<string | number | null | undefined>): string[] {
  return values
    .map((value) => (typeof value === 'number' ? String(value) : value?.trim()))
    .filter((value): value is string => Boolean(value && value !== 'вЂ”'))
}

function navigateToEdit(navigate: NavigateFunction, row: ConsumableOrderRow, backgroundLocation: Location) {
  const netId = row.order.NetUid || row.id

  if (!netId) {
    return
  }

  navigate(`/accounting/consumable-orders/edit/${netId}`, { state: { backgroundLocation, returnPath: '/accounting/consumable-orders' } })
}

function navigateToPay(navigate: NavigateFunction, row: ConsumableOrderRow, backgroundLocation: Location) {
  const netId = row.order.NetUid || row.id

  if (!netId) {
    return
  }

  navigate(`/accounting/consumable-orders/pay/${netId}`, { state: { backgroundLocation, returnPath: '/accounting/consumable-orders' } })
}

function getItemName(item: ConsumablesOrderItem): string | undefined {
  return item.ConsumableProduct?.Name || item.ConsumableProductCategory?.Name
}

function getEntityName(entity?: NamedEntity | null): string | undefined {
  return entity?.LastName || entity?.FullName || entity?.Name || entity?.OperationName || entity?.Code
}

function getItemKey(item: ConsumablesOrderItem, index: number): string {
  return String(item.NetUid || item.Id || `${item.ConsumableProduct?.NetUid || item.ConsumableProduct?.Id || 'item'}-${index}`)
}

function getOutcomeLinkKey(item: OutcomePaymentOrderConsumablesOrder, index: number): string {
  return String(item.NetUid || item.Id || item.OutcomePaymentOrder?.NetUid || item.OutcomePaymentOrder?.Id || `outcome-${index}`)
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
