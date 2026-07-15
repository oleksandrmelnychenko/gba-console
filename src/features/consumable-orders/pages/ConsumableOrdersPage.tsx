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
import { CircleAlert, CreditCard, CreditCard as CreditCardIcon, Eye as EyeIcon, Pencil, Plus, RotateCcw, Search, SquarePen as SquarePenIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
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

const ORDERS_MONO_STYLE = { fontFamily: 'var(--font-mono)', letterSpacing: 0 } as const

const CONSUMABLE_ORDERS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['document'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

export function ConsumableOrdersPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [orders, setOrders] = useValueState<ConsumablesOrder[]>([])
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-DEFAULT_LOOKBACK_DAYS))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [searchValue, setSearchValue] = useValueState('')
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [totalOrders, setTotalOrders] = useValueState<number | undefined>(undefined)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [selectedRow, setSelectedRow] = useValueState<ConsumableOrderRow | null>(null)
  const [actionsRow, setActionsRow] = useValueState<ConsumableOrderRow | null>(null)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
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
      const nextResponse = normalizedSearchValue
        ? await searchConsumableOrders(normalizedSearchValue, { from: fromDate, limit: pageSize, offset, to: toDate })
        : await getConsumableOrders({ from: fromDate, limit: pageSize, offset, to: toDate })

      if (requestRef.current === requestId) {
        setOrders(nextResponse.Items)
        setTotalOrders(nextResponse.Total)
      }
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setOrders([])
        setTotalOrders(undefined)
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити прибуткові накладні'))
      }
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [filterError, fromDate, normalizedSearchValue, offset, pageSize, setError, setLoading, setOrders, setTotalOrders, t, toDate])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const hasClientFallbackRows = typeof totalOrders !== 'number' && orders.length > pageSize
  const visibleOrders = useMemo(
    () => (hasClientFallbackRows ? orders.slice(offset, offset + pageSize) : orders),
    [hasClientFallbackRows, offset, orders, pageSize],
  )
  const rows = useMemo(() => buildConsumableOrderRows(visibleOrders), [visibleOrders])
  const columns = useConsumableOrderColumns()
  const isTableBusy = isLoading || isSearchSettling
  const canMoveForward = typeof totalOrders === 'number'
    ? page * pageSize < totalOrders
    : hasClientFallbackRows
      ? offset + pageSize < orders.length
      : orders.length === pageSize
  const totalPages = typeof totalOrders === 'number'
    ? Math.max(1, Math.ceil(totalOrders / pageSize))
    : page + (canMoveForward ? 1 : 0)
  const defaultFromDate = shiftDate(-DEFAULT_LOOKBACK_DAYS)
  const defaultToDate = formatLocalDate(new Date())
  const hasActiveFilters = Boolean(searchValue.trim()) || fromDate !== defaultFromDate || toDate !== defaultToDate

  useEffect(() => {
    if (typeof totalOrders === 'number' && page > totalPages) {
      setPage(totalPages)
    }
  }, [page, setPage, totalOrders, totalPages])

  function resetFilters() {
    setFromDate(defaultFromDate)
    setToDate(defaultToDate)
    setSearchValue('')
    setPage(1)
    setOrders([])
    setTotalOrders(undefined)
  }

  return (
    <Stack className="consumable-orders-page console-table-page" gap={6}>
      <div className="console-table-shell">
        <div className="app-filter-bar consumable-orders-command-bar">
          <div className="app-filter-field consumable-orders-period-filter">
            <span className="app-filter-label consumable-orders-filter-label">{t('Період')}</span>
            <div className="consumable-orders-period-fields">
              <TextInput
                className="consumable-orders-date-input"
                aria-label={t('Від')}
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.currentTarget.value)
                  setPage(1)
                  setOrders([])
                  setTotalOrders(undefined)
                }}
              />
              <span className="consumable-orders-period-separator" />
              <TextInput
                className="consumable-orders-date-input"
                aria-label={t('До')}
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
          </div>

          <TextInput
            className="consumable-orders-search-input"
            leftSection={<Search size={16} />}
            label={t('Пошук')}
            placeholder={t('Номер, постачальник, склад або коментар')}
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.currentTarget.value)
              setPage(1)
              setOrders([])
              setTotalOrders(undefined)
            }}
          />
          <div className="app-filter-actions consumable-orders-command-actions">
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
          <div className="consumable-orders-table-toolbar-slot" ref={setTableToolbarSlot} />
          <Button
            color={CREATE_ACTION_COLOR}
            leftSection={<Plus size={16} />}
            size="sm"
            styles={{ label: ORDERS_MONO_STYLE }}
            onClick={() => navigate('/accounting/consumable-orders/new', { state: { backgroundLocation: location, returnPath: '/accounting/consumable-orders' } })}
          >
            {t('Нова накладна')}
          </Button>
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

        <div className="consumable-orders-page__table console-table-body">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={CONSUMABLE_ORDERS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Прибуткових накладних не знайдено')}
            getRowId={(row) => row.id}
            height="100%"
            isLoading={isTableBusy}
            layoutVersion="consumable-orders-table-1"
            minWidth={1080}
            tableId="consumable-orders"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={setActionsRow}
          />
        </div>
      </div>

      <ConsumableOrderActionsModal
        row={actionsRow}
        onClose={() => setActionsRow(null)}
        onOpenDetails={(row) => {
          setActionsRow(null)
          setSelectedRow(row)
        }}
        onPay={(row) => {
          setActionsRow(null)
          navigateToPay(navigate, row, location)
        }}
        onView={(row) => {
          setActionsRow(null)
          navigateToEdit(navigate, row, location)
        }}
      />

      <ConsumableOrderDetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onPay={(row) => navigateToPay(navigate, row, location)}
        onView={(row) => navigateToEdit(navigate, row, location)}
      />
    </Stack>
  )
}

function useConsumableOrderColumns() {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ConsumableOrderRow>[]>(
    () => [
      {
        id: 'document',
        header: t('Документ'),
        width: 260,
        minWidth: 220,
        accessor: (row) => row.order.Number || row.organizationNumber || '',
        cell: (row) => <ConsumableOrderDocumentCell row={row} />,
      },
      {
        id: 'serviceOrganization',
        header: t('Постачальник / Організація'),
        width: 250,
        minWidth: 200,
        fill: true,
        accessor: (row) => row.serviceOrganization || '',
        cell: (row) => <ConsumableOrderSupplierCell row={row} />,
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 170,
        minWidth: 140,
        accessor: (row) => row.storage || '',
        cell: (row) => <ConsumableOrderStorageCell row={row} />,
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 168,
        minWidth: 140,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => <ConsumableOrderAmountCell row={row} />,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 180,
        minWidth: 150,
        accessor: (row) => row.responsible || '',
        cell: (row) => <ConsumableOrderResponsibleCell row={row} />,
      },
      {
        id: 'status',
        header: t('Статус'),
        width: 158,
        minWidth: 132,
        accessor: (row) => (row.isPayed ? 1 : 0),
        cell: (row) => <ConsumableOrderStatusCell row={row} />,
      },
    ],
    [t],
  )
}

function ConsumableOrderActionsModal({
  row,
  onClose,
  onOpenDetails,
  onPay,
  onView,
}: {
  row: ConsumableOrderRow | null
  onClose: () => void
  onOpenDetails: (row: ConsumableOrderRow) => void
  onPay: (row: ConsumableOrderRow) => void
  onView: (row: ConsumableOrderRow) => void
}) {
  const { t } = useI18n()
  const title = row?.order.Number || row?.organizationNumber || t('Накладна')

  return (
    <AppModal
      centered
      opened={Boolean(row)}
      size={496}
      title={<span style={ORDERS_MONO_STYLE}>{title}</span>}
      onClose={onClose}
    >
      {row ? (
        <Stack className="app-modal-actions" gap="xs">
          <Button fullWidth justify="flex-start" size="lg" variant="subtle" onClick={() => onOpenDetails(row)}>
            <Group gap={12} wrap="nowrap">
              <span className="app-action-icon">
                <EyeIcon size={20} />
              </span>
              {t('Деталі')}
            </Group>
          </Button>
          <Button fullWidth justify="flex-start" size="lg" variant="subtle" onClick={() => onView(row)}>
            <Group gap={12} wrap="nowrap">
              <span className="app-action-icon">
                <SquarePenIcon size={20} />
              </span>
              {t('Редагувати')}
            </Group>
          </Button>
          {!row.isPayed ? (
            <Button fullWidth justify="flex-start" size="lg" variant="subtle" onClick={() => onPay(row)}>
              <Group gap={12} wrap="nowrap">
                <span className="app-action-icon">
                  <CreditCardIcon size={20} />
                </span>
                {t('Оплатити')}
              </Group>
            </Button>
          ) : null}
        </Stack>
      ) : null}
    </AppModal>
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
        <span className="consumable-orders-document-copy">
          <span className="consumable-orders-document-title">{title}</span>
          <span className="consumable-orders-document-dates">
            <span><small>{t('Ств.')}</small>{createdDate}</span>
            {organizationDate ? <span><small>{t('Вх.')}</small>{organizationDate}</span> : null}
          </span>
          {invoice && invoice !== title ? (
            <span className="consumable-orders-document-invoice"><small>{t('Накл.')}</small>{invoice}</span>
          ) : null}
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
        {agreement ? (
          <Badge className="app-role-pill consumable-orders-agreement-pill" variant="light">
            {agreement}
          </Badge>
        ) : null}
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
        {totalWithoutVat !== totalWithVat ? (
          <span><small>{t('без ПДВ')}</small>{totalWithoutVat}</span>
        ) : null}
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
      <Badge className={row.isPayed ? 'app-role-pill is-green' : 'app-role-pill is-red'} variant="light">
        {row.isPayed ? t('Оплачено') : t('Не оплачено')}
      </Badge>
      <small>{row.isDone ? t('Закрито') : t('В роботі')}</small>
    </span>
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
    <AppDrawer opened={Boolean(row)} padding="md" size="xl" title={<span style={ORDERS_MONO_STYLE}>{t('Прибуткова накладна')}</span>} onClose={onClose}>
      {row && order && (
        <Stack gap="md">
          <Group justify="flex-end">
            <Button leftSection={<Pencil size={16} />} styles={{ label: ORDERS_MONO_STYLE }} variant="outline" onClick={() => onView(row)}>
              {t('Редагувати')}
            </Button>
            {!order.IsPayed && (
              <Button color="green" leftSection={<CreditCard size={16} />} styles={{ label: ORDERS_MONO_STYLE }} variant="outline" onClick={() => onPay(row)}>
                {t('Оплатити')}
              </Button>
            )}
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DetailItem label={t('Створено')} mono value={formatDateTime(row.created)} />
            <DetailItem label={t('Номер')} mono value={displayValue(order.Number)} />
            <DetailItem label={t('Дата входу')} mono value={formatDateTime(order.OrganizationFromDate)} />
            <DetailItem label={t('Номер накладної')} mono value={displayValue(order.OrganizationNumber)} />
            <DetailItem label={t('Постачальник послуг')} value={displayValue(row.serviceOrganization)} />
            <DetailItem label={t('Організація')} value={displayValue(row.organization)} />
            <DetailItem label={t('Договір')} value={displayValue(order.SupplyOrganizationAgreement?.Name || order.SupplyOrganizationAgreement?.Number)} />
            <DetailItem label={t('Склад')} value={displayValue(row.storage)} />
            <DetailItem label={t('Сума')} mono value={formatMoney(row.totalAmountWithoutVat)} />
            <DetailItem label={t('Разом з ПДВ')} mono value={formatMoney(row.amount)} />
            <DetailItem label={t('Валюта')} mono value={displayValue(row.currency)} />
            <DetailItem label={t('Відповідальний')} value={displayValue(row.responsible)} />
            <DetailItem label={t('Оплачено')} value={order.IsPayed ? t('Так') : t('Ні')} />
            <DetailItem label={t('Закрито')} value={order.IsDone ? t('Так') : t('Ні')} />
          </SimpleGrid>

          <Stack gap={2}>
            <Text className="app-section-title" fw={600} size="sm">
              {t('Коментар')}
            </Text>
            <Text size="sm">{displayValue(row.comment)}</Text>
          </Stack>

          <Divider />

          <Stack gap="sm">
            <Text className="app-section-title" fw={600} size="sm">
              {t('Позиції')}
            </Text>
            {items.length > 0 ? (
              items.map((item, index) => (
                <SimpleGrid key={getItemKey(item, index)} cols={{ base: 1, sm: 3 }}>
                  <DetailItem label={t('Артикул')} mono value={displayValue(item.ConsumableProduct?.VendorCode)} />
                  <DetailItem label={t('Назва')} value={displayValue(getItemName(item))} />
                  <DetailItem label={t('Категорія')} value={displayValue(item.ConsumableProductCategory?.Name || item.ConsumableProduct?.ConsumableProductCategory?.Name)} />
                  <DetailItem label={t('Кількість')} mono value={formatAmount(item.Qty)} />
                  <DetailItem label={t('Ціна')} mono value={formatMoney(item.PricePerItem)} />
                  <DetailItem label={t('Сума без ПДВ')} mono value={formatMoney(item.TotalPrice)} />
                  <DetailItem label={t('ПДВ %')} mono value={formatAmount(item.VatPercent)} />
                  <DetailItem label={t('ПДВ')} mono value={formatMoney(item.VAT)} />
                  <DetailItem label={t('Разом з ПДВ')} mono value={formatMoney(item.TotalPriceWithVAT)} />
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
            <Text className="app-section-title" fw={600} size="sm">
              {t('Структура документа')}
            </Text>
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
      <DetailItem label={t('Ордер')} mono value={displayValue(outcome.Number || outcome.AdvanceNumber)} />
      <DetailItem label={t('Дата')} mono value={formatDateTime(outcome.FromDate)} />
      <DetailItem label={t('Сума')} mono value={formatMoney(outcome.Amount)} />
      <DetailItem label={t('Валюта')} mono value={displayValue(outcome.PaymentCurrencyRegister?.Currency?.Code || outcome.PaymentCurrencyRegister?.Currency?.Name)} />
      <DetailItem label={t('Організація')} value={displayValue(getEntityName(outcome.Organization))} />
      <DetailItem label={t('Кому видано')} value={displayValue(getEntityName(outcome.Colleague))} />
      <DetailItem label={t('Підзвіт')} value={outcome.IsUnderReport ? t('Так') : t('Ні')} />
      <DetailItem label={t('Скасовано')} value={outcome.IsCanceled ? t('Так') : t('Ні')} />
    </SimpleGrid>
  )
}

function DetailItem({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className={`consumable-orders-detail-field${mono ? ' is-mono' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

// Empty values render blank (docs/ui-patterns.md §5).
function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}
