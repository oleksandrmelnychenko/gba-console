import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconCreditCard, IconEye, IconPencil, IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
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

const SEARCH_DEBOUNCE_MS = 350
const DEFAULT_LOOKBACK_DAYS = 30

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created', 'number'],
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

const CONSUMABLE_ORDER_TABLE_CELL_STYLE = {
  display: 'block',
  lineHeight: '18px',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

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
        ? await searchConsumableOrders(normalizedSearchValue)
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
  const columns = useConsumableOrderColumns({
    onOpen: setSelectedRow,
    onPay: (row) => navigateToPay(navigate, row, location),
    onView: (row) => navigateToEdit(navigate, row, location),
  })
  const isTableBusy = isLoading || isSearchSettling
  const { density, toggleDensity } = useDataTableDensity('consumable-orders', TABLE_DEFAULT_LAYOUT.density)

  return (
    <Stack className="consumable-orders-page" gap={6}>
      <PageHeaderActions>
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={() => void loadOrders()}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
        <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={() => navigate('/accounting/consumable-orders/new', { state: { backgroundLocation: location, returnPath: '/accounting/consumable-orders' } })}>
          {t('Додати')}
        </Button>
        <DataTableDensityToggle density={density} onToggle={toggleDensity} size={38} />
      </PageHeaderActions>

      <Group align="end" gap="sm" wrap="nowrap">
          <TextInput label={t('Від')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
          <TextInput label={t('До')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
          <TextInput
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Номер, постачальник, склад або коментар')}
            value={searchValue}
            style={{ flex: '1 1 auto' }}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
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

      <div className="consumable-orders-page__table">
        <DataTable
          columns={columns}
          data={rows}
          defaultLayout={TABLE_DEFAULT_LAYOUT}
          density={density}
          emptyText={t('Прибуткових накладних не знайдено')}
          getRowId={(row) => row.id}
          isLoading={isTableBusy}
          layoutVersion="consumable-orders-1"
          height="100%"
          minWidth={1540}
          showLayoutControls={false}
          tableId="consumable-orders"
          onRowClick={setSelectedRow}
        />
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

function useConsumableOrderColumns({
  onOpen,
  onPay,
  onView,
}: {
  onOpen: (row: ConsumableOrderRow) => void
  onPay: (row: ConsumableOrderRow) => void
  onView: (row: ConsumableOrderRow) => void
}): DataTableColumn<ConsumableOrderRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ConsumableOrderRow>[]>(
    () => [
      {
        id: 'created',
        header: t('Створено'),
        width: 145,
        minWidth: 130,
        accessor: (row) => row.created,
        cell: (row) => <ConsumableOrderTableValue value={formatDateTime(row.created)} />,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 145,
        minWidth: 120,
        accessor: (row) => row.order.Number,
        cell: (row) => <ConsumableOrderTableValue fw={600} value={displayValue(row.order.Number)} />,
      },
      {
        id: 'organizationFromDate',
        header: t('Дата входу'),
        width: 145,
        minWidth: 130,
        accessor: (row) => row.organizationFromDate,
        cell: (row) => <ConsumableOrderTableValue value={formatDateTime(row.organizationFromDate)} />,
      },
      {
        id: 'organizationNumber',
        header: t('Номер накладної'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.organizationNumber,
        cell: (row) => <ConsumableOrderTableValue value={displayValue(row.organizationNumber)} />,
      },
      {
        id: 'serviceOrganization',
        header: t('Постачальник послуг'),
        width: 220,
        minWidth: 170,
        accessor: (row) => row.serviceOrganization,
        cell: (row) => <ConsumableOrderTableValue value={displayValue(row.serviceOrganization)} />,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 170,
        minWidth: 130,
        accessor: (row) => row.organization,
        cell: (row) => <ConsumableOrderTableValue value={displayValue(row.organization)} />,
      },
      {
        id: 'totalAmountWithoutVat',
        header: t('Сума'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (row) => row.totalAmountWithoutVat,
        cell: (row) => <ConsumableOrderTableValue value={formatMoney(row.totalAmountWithoutVat)} />,
      },
      {
        id: 'amount',
        header: t('Разом з ПДВ'),
        width: 130,
        minWidth: 110,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => <ConsumableOrderTableValue value={formatMoney(row.amount)} />,
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 90,
        minWidth: 80,
        accessor: (row) => row.currency,
        cell: (row) => <ConsumableOrderTableValue value={displayValue(row.currency)} />,
      },
      {
        id: 'storage',
        header: t('Склад'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.storage,
        cell: (row) => <ConsumableOrderTableValue value={displayValue(row.storage)} />,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 165,
        minWidth: 130,
        accessor: (row) => row.responsible,
        cell: (row) => <ConsumableOrderTableValue value={displayValue(row.responsible)} />,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 240,
        minWidth: 170,
        accessor: (row) => row.comment,
        cell: (row) => <ConsumableOrderTableValue value={displayValue(row.comment)} />,
      },
      {
        id: 'actions',
        header: '',
        width: 112,
        minWidth: 104,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
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
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color={CREATE_ACTION_COLOR}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onView(row)
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            {!row.isPayed && (
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
          </Group>
        ),
      },
    ],
    [onOpen, onPay, onView, t],
  )
}

function ConsumableOrderTableValue({ fw, value }: { fw?: number; value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <Text component="span" fw={fw} style={CONSUMABLE_ORDER_TABLE_CELL_STYLE}>
        {value}
      </Text>
    </Tooltip>
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
    amount: order.TotalAmount,
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
