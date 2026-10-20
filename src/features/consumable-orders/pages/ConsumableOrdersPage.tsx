import { getOrganizationDisplayName } from '../../../shared/organizations/organizationDisplayName'
import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import { TableChip } from '../../../shared/ui/TableChip'
import {
  Alert,
  Button,
  Badge,
  Group,
  Stack,
  Text,
  TextInput,
  } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, CreditCard, CreditCard as CreditCardIcon, Eye as EyeIcon, Pencil, Plus, RotateCcw, Search, SquarePen as SquarePenIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useMutatedListRefresh } from '../../../shared/router/useMutatedListRefresh'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DocumentDetailLayout, DocumentDetailSummary, DocumentDetailMetric, DocumentDetailSection, DocumentDetailRow } from '../../../shared/ui/document-detail/DocumentDetail'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import {
  getConsumableOrders,
  searchConsumableOrders,
} from '../api/consumableOrdersApi'
import {
  buildConsumableOrderRows,
  deduplicateConsumableOrdersByIdentity,
  getActiveConsumableOrderItems,
  getActiveOutcomePaymentLinks,
  getConsumableOrderSupplierCellText,
  getEntityName,
  isSameDisplayText,
} from '../model/consumableOrderTableModel'
import type {
  ConsumableOrderRow,
  ConsumablesOrder,
  ConsumablesOrderItem,
  OutcomePaymentOrderConsumablesOrder,
} from '../types'
import {
  CONSUMABLE_ORDER_CREATE_PERMISSION,
  CONSUMABLE_ORDER_EDIT_PERMISSION,
  CONSUMABLE_ORDER_PAY_PERMISSION,
} from '../permissions'
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
  const { hasPermission } = useAuth()
  const canCreateOrder = hasPermission(CONSUMABLE_ORDER_CREATE_PERMISSION)
  const canEditOrder = hasPermission(CONSUMABLE_ORDER_EDIT_PERMISSION)
  const canPayOrder = hasPermission(CONSUMABLE_ORDER_PAY_PERMISSION)
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

  useMutatedListRefresh(loadOrders)

  const uniqueOrders = useMemo(
    () => deduplicateConsumableOrdersByIdentity(orders),
    [orders],
  )
  const hasClientFallbackRows = typeof totalOrders !== 'number' && orders.length > pageSize
  const visibleOrders = useMemo(
    () => (hasClientFallbackRows ? uniqueOrders.slice(offset, offset + pageSize) : uniqueOrders),
    [hasClientFallbackRows, offset, pageSize, uniqueOrders],
  )
  const rows = useMemo(() => buildConsumableOrderRows(visibleOrders), [visibleOrders])
  const columns = useConsumableOrderColumns()
  const isTableBusy = isLoading || isSearchSettling
  const canMoveForward = typeof totalOrders === 'number'
      ? page * pageSize < totalOrders
      : hasClientFallbackRows
        ? offset + pageSize < uniqueOrders.length
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
          <ToolbarDateRangeFilter from={fromDate} to={toDate} onChange={({ from, to }) => { setFromDate(from); setToDate(to); setPage(1); setOrders([]); setTotalOrders(undefined) }} />

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
            <Button
                aria-label={t('Скинути')}
                color="gray"
                disabled={!hasActiveFilters}
                variant="default"
                onClick={resetFilters}
               className="registry-caption-action" title={t('Скинути')} leftSection={<RotateCcw size={17} />}>{t('Скинути')}</Button>
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
          {canCreateOrder && (
            <Button
              color={CREATE_ACTION_COLOR}
              leftSection={<Plus size={16} />}
              size="sm"
              styles={{ label: ORDERS_MONO_STYLE }}
              onClick={() => {
                if (canCreateOrder) {
                  navigate('/accounting/consumable-orders/new', { state: { backgroundLocation: location, returnPath: '/accounting/consumable-orders' } })
                }
              }}
            >
              {t('Нова накладна')}
            </Button>
          )}
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
            distributeAvailableWidth
            emptyText={t('Прибуткових накладних не знайдено')}
            getRowId={(row) => row.id}
            height="100%"
            isLoading={isTableBusy}
            layoutVersion="consumable-orders-table-2"
            minWidth={1080}
            showLayoutControls
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
        onPay={canPayOrder ? (row) => {
          if (!canPayOrder) {
            return
          }
          setActionsRow(null)
          navigateToPay(navigate, row, location)
        } : undefined}
        onView={canEditOrder ? (row) => {
          if (!canEditOrder) {
            return
          }
          setActionsRow(null)
          navigateToEdit(navigate, row, location)
        } : undefined}
      />

      <ConsumableOrderDetailDrawer
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onPay={canPayOrder ? (row) => {
          if (canPayOrder) {
            navigateToPay(navigate, row, location)
          }
        } : undefined}
        onView={canEditOrder ? (row) => {
          if (canEditOrder) {
            navigateToEdit(navigate, row, location)
          }
        } : undefined}
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
        accessor: (row) => compactStrings([
          row.serviceOrganization,
          row.organization,
          row.order.SupplyOrganizationAgreement?.Name,
          row.order.SupplyOrganizationAgreement?.Number,
        ]).join(' '),
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

export function ConsumableOrderActionsModal({
  row,
  onClose,
  onOpenDetails,
  onPay,
  onView,
}: {
  row: ConsumableOrderRow | null
  onClose: () => void
  onOpenDetails: (row: ConsumableOrderRow) => void
  onPay?: (row: ConsumableOrderRow) => void
  onView?: (row: ConsumableOrderRow) => void
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
          {onView && (
            <Button fullWidth justify="flex-start" size="lg" variant="subtle" onClick={() => onView(row)}>
              <Group gap={12} wrap="nowrap">
                <span className="app-action-icon">
                  <SquarePenIcon size={20} />
                </span>
                {t('Редагувати')}
              </Group>
            </Button>
          )}
          {onPay && !row.isPayed ? (
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
  const createdDate = row.created ? formatDateTime(row.created) : ''
  const organizationDate = row.organizationFromDate ? formatDateTime(row.organizationFromDate) : ''
  const distinctInvoice = invoice && !isSameDisplayText(invoice, title) ? invoice : ''
  const meta = compactStrings([
    createdDate ? `${t('Ств.')} ${createdDate}` : '',
    organizationDate ? `${t('Вх.')} ${organizationDate}` : '',
    distinctInvoice ? `${t('Накл.')} ${distinctInvoice}` : '',
  ]).join(' · ')
  const tooltip = compactStrings([title, meta]).join('\n')

  return (
    <span className="consumable-orders-document-cell" title={nativeTitle(tooltip)}>
      <span className="consumable-orders-document-copy">
        {title ? <TableChip tone="document" value={title} /> : null}
        {meta ? <small className="consumable-orders-document-meta">{meta}</small> : null}
      </span>
    </span>
  )
}

function ConsumableOrderSupplierCell({ row }: { row: ConsumableOrderRow }) {
  const { primary, secondary } = getConsumableOrderSupplierCellText(row)
  const tooltip = compactStrings([primary, secondary]).join('\n')
  const organizationPrefix = `${row.organization || ''} · `
  const secondaryText = secondary.startsWith(organizationPrefix) ? secondary.slice(organizationPrefix.length) : isSameDisplayText(secondary, row.organization) ? '' : secondary

  return (
    <span className="consumable-orders-two-line-cell" title={nativeTitle(tooltip)}>
      {primary ? (isSameDisplayText(primary, row.organization) ? <TableChip tone="product" value={primary} /> : <span>{primary}</span>) : null}
      {secondary ? <small>{row.organization && !isSameDisplayText(row.organization, primary) ? <TableChip tone="product" value={row.organization} /> : null}{secondaryText}</small> : null}
    </span>
  )
}

function ConsumableOrderStorageCell({ row }: { row: ConsumableOrderRow }) {
  const { t } = useI18n()
  const title = displayValue(row.storage)
  const meta = t('{{count}} позицій').replace('{{count}}', formatAmount(row.itemCount))
  const tooltip = compactStrings([title, meta]).join('\n')

  return (
    <span className="consumable-orders-two-line-cell" title={nativeTitle(tooltip)}>
      {title ? <TableChip tone="storage" value={title} /> : null}
      <small>{meta}</small>
    </span>
  )
}

function ConsumableOrderAmountCell({ row }: { row: ConsumableOrderRow }) {
  const { t } = useI18n()
  const totalWithoutVat = formatTableMoney(row.totalAmountWithoutVat)
  const totalWithVat = formatTableMoney(row.amount)
  const currency = displayValue(row.currency)
  const hasDistinctWithoutVat = Boolean(totalWithoutVat && totalWithoutVat !== totalWithVat)
  const totalWithVatLabel = totalWithVat ? `${t('З ПДВ')}: ${totalWithVat}` : ''
  const totalWithoutVatLabel = hasDistinctWithoutVat ? `${t('Без ПДВ')}: ${totalWithoutVat}` : ''
  const tooltip = compactStrings([totalWithVatLabel, currency, totalWithoutVatLabel]).join('\n')

  return (
    <span className="consumable-orders-amount-cell" title={nativeTitle(tooltip)}>
      <span className="consumable-orders-amount-primary">
        {totalWithVat ? <strong>{totalWithVat}</strong> : null}
        {currency ? <em>{currency}</em> : null}
      </span>
      {hasDistinctWithoutVat ? (
        <small><span>{t('без ПДВ')}</span>{totalWithoutVat}</small>
      ) : null}
    </span>
  )
}

function ConsumableOrderResponsibleCell({ row }: { row: ConsumableOrderRow }) {
  const title = displayValue(row.responsible)
  const comment = row.comment?.trim()
  const tooltip = compactStrings([title, comment]).join('\n')

  return (
    <span className="consumable-orders-responsible-cell" title={nativeTitle(tooltip)}>
      {title ? <TableChip tone="warning" value={title} /> : null}
    </span>
  )
}

function ConsumableOrderStatusCell({ row }: { row: ConsumableOrderRow }) {
  const { t } = useI18n()
  const paymentStatus = row.isPayed ? t('Оплачено') : t('Не оплачено')
  const workStatus = row.isDone ? t('Закрито') : t('В роботі')

  return (
    <span className="consumable-orders-status-cell" title={nativeTitle(`${paymentStatus} · ${workStatus}`)}>
      <Badge className={row.isPayed ? 'app-role-pill is-green' : 'app-role-pill is-red'} variant="light">
        {paymentStatus}
      </Badge>
      <Badge className={row.isDone ? 'app-role-pill is-gray' : 'app-role-pill is-orange'} variant="light">
        {workStatus}
      </Badge>
    </span>
  )
}

export function ConsumableOrderDetailDrawer({
  row,
  onClose,
  onPay,
  onView,
}: {
  row: ConsumableOrderRow | null
  onClose: () => void
  onPay?: (row: ConsumableOrderRow) => void
  onView?: (row: ConsumableOrderRow) => void
}) {
  const { t } = useI18n()
  const order = row?.order
  const items = order ? getActiveConsumableOrderItems(order) : []
  const outcomes = order ? getActiveOutcomePaymentLinks(order) : []

  const itemColumns: DataTableColumn<ConsumablesOrderItem>[] = [
    { id: 'code', header: t('Артикул'), minWidth: 140, accessor: (item) => item.ConsumableProduct?.VendorCode || '', cell: (item) => <TableChip tone="product" value={item.ConsumableProduct?.VendorCode} /> },
    { id: 'name', header: t('Назва'), minWidth: 200, accessor: getItemName },
    { id: 'category', header: t('Категорія'), minWidth: 160, accessor: (item) => item.ConsumableProductCategory?.Name || item.ConsumableProduct?.ConsumableProductCategory?.Name || '' },
    { id: 'qty', header: t('Кількість'), minWidth: 100, align: 'right', accessor: (item) => item.Qty, cell: (item) => formatAmount(item.Qty) },
    { id: 'price', header: t('Ціна'), minWidth: 120, align: 'right', accessor: (item) => item.PricePerItem, cell: (item) => formatMoney(item.PricePerItem) },
    { id: 'net', header: t('Сума без ПДВ'), minWidth: 130, align: 'right', accessor: (item) => item.TotalPrice, cell: (item) => formatMoney(item.TotalPrice) },
    { id: 'vatPercent', header: t('ПДВ %'), minWidth: 90, align: 'right', accessor: (item) => item.VatPercent, cell: (item) => formatAmount(item.VatPercent) },
    { id: 'vat', header: t('ПДВ'), minWidth: 120, align: 'right', accessor: (item) => item.VAT, cell: (item) => formatMoney(item.VAT) },
    { id: 'gross', header: t('Разом з ПДВ'), minWidth: 140, align: 'right', accessor: (item) => item.TotalPriceWithVAT, cell: (item) => formatMoney(item.TotalPriceWithVAT) },
  ]

  return (
    <AppDrawer opened={Boolean(row)} size="wide" title={t('Прибуткова накладна')} onClose={onClose}>
      {row && order && (
        <DocumentDetailLayout
          variant="inventory"
          actions={<Group gap={8}>
            {onView && <Button color="gray" leftSection={<Pencil size={16} />} variant="default" onClick={() => onView(row)}>{t('Редагувати')}</Button>}
            {onPay && !order.IsPayed && <Button color="green" leftSection={<CreditCard size={16} />} variant="outline" onClick={() => onPay(row)}>{t('Оплатити')}</Button>}
          </Group>}
          summary={<DocumentDetailSummary
            eyebrow={t('Прибуткова накладна')}
            title={displayValue(order.Number)}
            meta={<><span>{t('Створено')}: {formatDateTime(row.created)}</span><TableChip tone="source" value={row.currency} /></>}
            metrics={<>
              <DocumentDetailMetric label={t('Сума')} value={formatMoney(row.totalAmountWithoutVat)} />
              <DocumentDetailMetric label={t('Разом з ПДВ')} value={formatMoney(row.amount)} />
            </>}
          />}
        >
          <DocumentDetailSection title={t('Реквізити документа')}>
            <DocumentDetailRow label={t('Дата входу')} mono value={formatDateTime(order.OrganizationFromDate)} />
            <DocumentDetailRow label={t('Номер накладної')} value={<TableChip tone="document" value={order.OrganizationNumber} />} />
            <DocumentDetailRow label={t('Постачальник послуг')} value={displayValue(row.serviceOrganization)} />
            <DocumentDetailRow label={t('Організація')} value={<TableChip tone="product" value={row.organization} />} />
            <DocumentDetailRow label={t('Договір')} value={<TableChip tone="neutral" value={order.SupplyOrganizationAgreement?.Name || order.SupplyOrganizationAgreement?.Number} />} />
            <DocumentDetailRow label={t('Склад')} value={<TableChip tone="storage" value={row.storage} />} />
            <DocumentDetailRow label={t('Відповідальний')} value={<TableChip tone="warning" value={row.responsible} />} />
            <DocumentDetailRow label={t('Оплачено')} value={<TableChip tone={order.IsPayed ? 'success' : 'neutral'} value={order.IsPayed ? t('Так') : t('Ні')} />} />
            <DocumentDetailRow label={t('Закрито')} value={<TableChip tone={order.IsDone ? 'success' : 'neutral'} value={order.IsDone ? t('Так') : t('Ні')} />} />
            <DocumentDetailRow label={t('Коментар')} value={displayValue(row.comment)} wide />
          </DocumentDetailSection>
          <DocumentDetailSection title={t('Позиції')} subtitle={String(items.length)} stacked>
            <DataTable
              columns={itemColumns}
              data={items}
              defaultLayout={{ density: 'compact' }}
              emptyText={t('Позицій немає')}
              getRowId={getItemKey}
              layoutVersion="consumable-order-detail-items-1"
              maxHeight="45vh"
              minWidth={1200}
              showToolbar={false}
              tableId="consumable-order-detail-items"
            />
          </DocumentDetailSection>
          <DocumentDetailSection title={t('Структура документа')} stacked>
            {outcomes.length > 0 ? outcomes.map((item, index) => <OutcomeStructureItem key={getOutcomeLinkKey(item, index)} item={item} />) : <Text size="sm">{t('Оплат за документом немає')}</Text>}
          </DocumentDetailSection>
        </DocumentDetailLayout>
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
    <DocumentDetailSection title={`${t('Ордер')} ${displayValue(outcome.Number || outcome.AdvanceNumber)}`}>
      <DocumentDetailRow label={t('Ордер')} mono value={displayValue(outcome.Number || outcome.AdvanceNumber)} />
      <DocumentDetailRow label={t('Дата')} mono value={formatDateTime(outcome.FromDate)} />
      <DocumentDetailRow label={t('Сума')} mono value={formatMoney(outcome.Amount)} />
      <DocumentDetailRow label={t('Валюта')} mono value={<TableChip tone="source" value={outcome.PaymentCurrencyRegister?.Currency?.Code || outcome.PaymentCurrencyRegister?.Currency?.Name} />} />
      <DocumentDetailRow label={t('Організація')} value={<TableChip tone="product" value={getOrganizationDisplayName(outcome.Organization)} />} />
      <DocumentDetailRow label={t('Кому видано')} value={displayValue(getEntityName(outcome.Colleague))} />
      <DocumentDetailRow label={t('Підзвіт')} value={outcome.IsUnderReport ? t('Так') : t('Ні')} />
      <DocumentDetailRow label={t('Скасовано')} value={outcome.IsCanceled ? t('Так') : t('Ні')} />
    </DocumentDetailSection>
  )
}

function compactStrings(values: Array<string | number | null | undefined>): string[] {
  return values
    .map((value) => (typeof value === 'number' ? String(value) : value?.trim()))
    .filter((value): value is string => Boolean(value && value !== '—'))
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

function formatTableMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}

// Empty values render blank (docs/ui-patterns.md §5).
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
