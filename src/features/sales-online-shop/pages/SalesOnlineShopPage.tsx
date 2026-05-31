import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Card,
  Divider,
  Group,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { IconAlertCircle, IconEye, IconRefresh, IconRestore, IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getSalesOnlineShop } from '../api/salesOnlineShopApi'
import type {
  SalesOnlineShopFilters,
  SalesOnlineShopOrderItem,
  SalesOnlineShopSale,
  SalesOnlineShopStatusFilter,
  SalesOnlineShopUserFilter,
} from '../types'

type FilterDraft = {
  from: string
  onlyMine: boolean
  status: SalesOnlineShopStatusFilter
  to: string
  value: string
}

const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100']
const DEFAULT_PAGE_SIZE = 20

const SALES_ONLINE_SHOP_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['date', 'number', 'client'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SALES_ONLINE_SHOP_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['product'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const STATUS_OPTIONS: Array<{ label: string; value: SalesOnlineShopStatusFilter }> = [
  { value: 'all', label: 'Усі' },
  { value: 'New', label: 'Нові' },
  { value: 'Packaging', label: 'Пакування' },
  { value: 'InvoiceChanged', label: 'Змінено рахунок' },
  { value: 'TransporterChanged', label: 'Змінено перевізника' },
  { value: 'OrderClosed', label: 'Закриті' },
]

const STATUS_COLORS: Record<string, string> = {
  Await: 'yellow',
  InvoiceChanged: 'blue',
  New: 'green',
  OrderClosed: 'gray',
  Packaged: 'violet',
  Packaging: 'orange',
  Received: 'teal',
  Shipping: 'cyan',
  TransporterChanged: 'indigo',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  0: 'Не оплачено',
  1: 'Частково',
  2: 'Оплачено',
  3: 'Переплата',
}

const STATUS_LABELS: Record<string, string> = {
  Await: 'Очікує',
  InvoiceChanged: 'Змінено рахунок',
  New: 'Новий',
  OrderClosed: 'Закритий',
  Packaged: 'Запаковано',
  Packaging: 'Пакування',
  Received: 'Отримано',
  Shipping: 'Доставка',
  TransporterChanged: 'Змінено перевізника',
}

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function SalesOnlineShopPage() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const initialDraft = useMemo<FilterDraft>(
    () => ({
      from: today,
      onlyMine: false,
      status: 'all',
      to: today,
      value: '',
    }),
    [today],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialDraft)
  const [activeDraft, setActiveDraft] = useValueState<FilterDraft>(initialDraft)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [sales, setSales] = useValueState<SalesOnlineShopSale[]>([])
  const [selectedSale, setSelectedSale] = useValueState<SalesOnlineShopSale | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const offset = (page - 1) * pageSize
  const totalRows = getTotalRows(sales)
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const activeFilters = useMemo<SalesOnlineShopFilters>(
    () => ({
      from: activeDraft.from,
      limit: pageSize,
      offset,
      status: activeDraft.status,
      to: activeDraft.to,
      type: activeDraft.onlyMine ? 'Self' : 'All',
      value: activeDraft.value,
    }),
    [activeDraft, offset, pageSize],
  )

  const columns = useSalesOnlineShopColumns(setSelectedSale)

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {sales.length}
        {totalRows ? ` ${t('з')} ${totalRows}` : ''}
        {activeDraft.onlyMine ? `, ${t('тільки мої')}` : ''}
      </Text>
    ),
    [activeDraft.onlyMine, sales.length, t, totalRows],
  )

  const toolbarRight = useMemo(
    () => (
      <Group gap={6} wrap="nowrap">
        <Select
          aria-label={t('Кількість рядків')}
          data={PAGE_SIZE_OPTIONS}
          size="xs"
          value={String(pageSize)}
          w={88}
          onChange={(value) => {
            setPage(1)
            setPageSize(Number(value || DEFAULT_PAGE_SIZE))
          }}
        />
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size="sm"
            variant="subtle"
            onClick={() => reload()}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
    [isLoading, pageSize, setPage, setPageSize, t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadSales() {
      setLoading(true)
      setError(null)

      try {
        const nextSales = await getSalesOnlineShop(activeFilters)

        if (!cancelled) {
          setSales(nextSales)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSales([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі інтернет-магазину'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSales()

    return () => {
      cancelled = true
    }
  }, [activeFilters, reloadKey, setError, setLoading, setSales, t])

  function applyFilters(nextDraft: FilterDraft) {
    setPage(1)
    setFilterDraft(nextDraft)
    setActiveDraft({
      ...nextDraft,
      value: nextDraft.value.trim(),
    })
  }

  function resetFilters() {
    setPage(1)
    setFilterDraft(initialDraft)
    setActiveDraft(initialDraft)
  }

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="center">
        <Badge color="gray" variant="light">
          {isLoading ? t('Завантаження') : `${t('Записів')}: ${totalRows || sales.length}`}
        </Badge>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              label={t('З')}
              max={filterDraft.to || undefined}
              type="date"
              value={filterDraft.from}
              onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              label={t('По')}
              min={filterDraft.from || undefined}
              type="date"
              value={filterDraft.to}
              onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
            />
            <Select
              allowDeselect={false}
              data={STATUS_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
              label={t('Статус')}
              value={filterDraft.status}
              w={190}
              onChange={(value) =>
                applyFilters({
                  ...filterDraft,
                  status: (value as SalesOnlineShopStatusFilter | null) || 'all',
                })
              }
            />
            <Select
              allowDeselect={false}
              data={[
                { value: 'All', label: t('Усі менеджери') },
                { value: 'Self', label: t('Тільки мої') },
              ]}
              label={t('Менеджер')}
              value={filterDraft.onlyMine ? 'Self' : 'All'}
              w={150}
              onChange={(value) =>
                applyFilters({
                  ...filterDraft,
                  onlyMine: ((value as SalesOnlineShopUserFilter | null) || 'All') === 'Self',
                })
              }
            />
            <TextInput
              flex={1}
              label={t('Пошук')}
              leftSection={<IconSearch size={16} />}
              placeholder={t('Товар або номер продажу')}
              value={filterDraft.value}
              onChange={(event) => applyFilters({ ...filterDraft, value: event.currentTarget.value })}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon variant="light" color="gray" size={36} aria-label={t('Скинути')} onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={sales}
            defaultLayout={SALES_ONLINE_SHOP_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Продажів не знайдено')}
            getRowId={(sale, index) => String(sale.NetUid || sale.Id || index)}
            isLoading={isLoading}
            layoutVersion="sales-online-shop-table-1"
            loadingText={t('Завантаження продажів')}
            maxHeight="calc(100vh - 340px)"
            minWidth={1490}
            tableId="sales-online-shop"
            toolbarLeft={toolbarLeft}
            toolbarRight={toolbarRight}
            onRowClick={setSelectedSale}
          />

          {totalPages > 1 && (
            <Group justify="flex-end">
              <Pagination total={totalPages} value={page} onChange={setPage} />
            </Group>
          )}
        </Stack>
      </Card>

      <AppDrawer
        opened={Boolean(selectedSale)}
        position="right"
        size="min(820px, 100vw)"
        title={t('Деталі продажу')}
        onClose={() => setSelectedSale(null)}
      >
        {selectedSale && <SaleDetail sale={selectedSale} />}
      </AppDrawer>
    </Stack>
  )
}

function useSalesOnlineShopColumns(onOpenSale: (sale: SalesOnlineShopSale) => void) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SalesOnlineShopSale>[]>(
    () => [
      {
        id: 'date',
        header: 'Дата',
        width: 150,
        minWidth: 132,
        accessor: (sale) => getSaleTime(sale),
        cell: (sale) => (
          <>
            <Text fw={600}>{displayValue(formatDate(getSaleDate(sale)))}</Text>
            <Text size="xs" c="dimmed">
              {displayValue(formatTime(getSaleDate(sale)))}
            </Text>
          </>
        ),
      },
      {
        id: 'number',
        header: 'Номер',
        width: 150,
        minWidth: 132,
        accessor: (sale) => sale.SaleNumber?.Value || sale.NetUid,
        cell: (sale) => <Text fw={600}>{displayValue(sale.SaleNumber?.Value)}</Text>,
      },
      {
        id: 'client',
        header: 'Клієнт',
        width: 310,
        minWidth: 240,
        accessor: getSaleClientName,
        cell: (sale) => (
          <>
            <Text fw={600}>{displayValue(getSaleClientName(sale))}</Text>
            <Text size="xs" c="dimmed">
              {displayValue(getRetailClientLine(sale))}
            </Text>
          </>
        ),
      },
      {
        id: 'status',
        header: 'Статус',
        width: 154,
        minWidth: 136,
        accessor: getSaleStatusKey,
        cell: (sale) => {
          const statusKey = getSaleStatusKey(sale)

          return (
            <Badge color={STATUS_COLORS[statusKey] || 'gray'} variant="light">
              {getSaleStatusLabel(sale)}
            </Badge>
          )
        },
      },
      {
        id: 'payment',
        header: 'Оплата',
        width: 128,
        minWidth: 116,
        accessor: getPaymentStatusLabel,
        cell: (sale) => displayValue(getPaymentStatusLabel(sale)),
      },
      {
        id: 'responsible',
        header: 'Менеджер',
        width: 180,
        minWidth: 150,
        accessor: getSaleUserName,
        cell: (sale) => displayValue(getSaleUserName(sale)),
      },
      {
        id: 'amountLocal',
        header: 'Сума',
        width: 132,
        minWidth: 116,
        align: 'right',
        accessor: (sale) => getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount),
        cell: (sale) => formatAmount(getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount)),
      },
      {
        id: 'currency',
        header: 'Валюта',
        width: 100,
        minWidth: 88,
        accessor: getSaleCurrencyCode,
        cell: (sale) => displayValue(getSaleCurrencyCode(sale)),
      },
      {
        id: 'positions',
        header: 'Позиції',
        width: 104,
        minWidth: 96,
        align: 'right',
        accessor: getOrderItemCount,
        cell: (sale) => displayValue(getOrderItemCount(sale)),
      },
      {
        id: 'transporter',
        header: 'Перевізник',
        width: 170,
        minWidth: 140,
        accessor: (sale) => sale.Transporter?.Name || sale.Transporter?.Title,
        cell: (sale) => displayValue(sale.Transporter?.Name || sale.Transporter?.Title),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (sale) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Деталі')}>
              <ActionIcon aria-label={t('Деталі')} color="gray" variant="subtle" onClick={() => onOpenSale(sale)}>
                <IconEye size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [onOpenSale, t],
  )
}

function SaleDetail({ sale }: { sale: SalesOnlineShopSale }) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const itemColumns = useMemo<DataTableColumn<SalesOnlineShopOrderItem>[]>(
    () => [
      {
        id: 'product',
        header: 'Товар',
        accessor: (item) => getOrderItemProductName(item),
        minWidth: 240,
      },
      {
        id: 'code',
        header: 'Код',
        accessor: (item) => getOrderItemProductCode(item),
        width: 120,
      },
      {
        id: 'qty',
        header: 'К-сть',
        accessor: (item) => getNumber(item.Qty),
        align: 'right',
        cell: (item) => displayValue(getNumber(item.Qty)),
        width: 110,
      },
      {
        id: 'price',
        header: 'Ціна',
        accessor: (item) => getNumber(item.PricePerItem),
        align: 'right',
        cell: (item) => formatAmount(getNumber(item.PricePerItem)),
        width: 120,
      },
      {
        id: 'amount',
        header: 'Сума',
        accessor: (item) => getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount),
        align: 'right',
        cell: (item) => formatAmount(getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)),
        width: 130,
      },
    ],
    [],
  )

  return (
    <Stack gap="md">
      <Group gap="xs">
        <Badge color={STATUS_COLORS[getSaleStatusKey(sale)] || 'gray'} variant="light">
          {getSaleStatusLabel(sale)}
        </Badge>
        {sale.IsFullPayment && (
          <Badge color="green" variant="light">
            {t('Повна оплата')}
          </Badge>
        )}
        {sale.IsVatSale && (
          <Badge color="violet" variant="light">
            ПДВ
          </Badge>
        )}
        {sale.IsLocked && (
          <Badge color="red" variant="light">
            {t('Заблоковано')}
          </Badge>
        )}
      </Group>

      <DetailRows
        rows={[
          [t('Клієнт'), getSaleClientName(sale)],
          [t('Retail-клієнт'), getRetailClientLine(sale)],
          [t('Менеджер'), getSaleUserName(sale)],
          [t('Договір'), sale.ClientAgreement?.Agreement?.Name],
          [t('Організація'), sale.ClientAgreement?.Agreement?.Organization?.Name],
          [t('Перевізник'), sale.Transporter?.Name || sale.Transporter?.Title],
          [t('Оплата'), getPaymentStatusLabel(sale)],
          [t('Сума'), `${formatAmount(getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount))} ${getSaleCurrencyCode(sale)}`],
        ]}
      />

      {sale.Comment && (
        <>
          <Divider />
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase">
              {t('Коментар')}
            </Text>
            <Text size="sm">{sale.Comment}</Text>
          </Box>
        </>
      )}

      <Divider />

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{t('Товари')}</Text>
          <Badge color="gray" variant="light">
            {orderItems.length}
          </Badge>
        </Group>
        <DataTable
          columns={itemColumns}
          data={orderItems}
          defaultLayout={SALES_ONLINE_SHOP_ITEMS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Товарів не знайдено')}
          getRowId={(item, index) => String(item.NetUid || item.Id || index)}
          layoutVersion="sales-online-shop-items-table-1"
          maxHeight="45vh"
          minWidth={720}
          tableId="sales-online-shop-items"
        />
      </Stack>
    </Stack>
  )
}

function DetailRows({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <Stack gap={6}>
      {rows.map(([label, value]) => (
        <Group key={label} justify="space-between" align="flex-start" gap="lg" wrap="nowrap">
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          <Text size="sm" ta="right">
            {displayValue(value)}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

function getTotalRows(sales: SalesOnlineShopSale[]): number {
  return getNumber(sales[0]?.TotalRowsQty) || sales.length
}

function getSaleDate(sale: SalesOnlineShopSale): Date | null {
  return parseDate(sale.ChangedToInvoice || sale.Updated || sale.Created || sale.FromDate)
}

function getSaleTime(sale: SalesOnlineShopSale): number {
  return getSaleDate(sale)?.getTime() || 0
}

function getSaleClientName(sale: SalesOnlineShopSale): string {
  const client = sale.ClientAgreement?.Client

  return (
    client?.FullName?.trim()
    || [client?.LastName, client?.FirstName, client?.MiddleName].filter(Boolean).join(' ').trim()
    || client?.MobileNumber?.trim()
    || ''
  )
}

function getRetailClientLine(sale: SalesOnlineShopSale): string {
  const retailClient = sale.RetailClient
  const phone = retailClient?.PhoneNumber || retailClient?.Phone
  const name =
    retailClient?.Name
    || retailClient?.FullName
    || [retailClient?.LastName, retailClient?.FirstName].filter(Boolean).join(' ').trim()

  return [phone, name].filter(Boolean).join(' - ')
}

function getSaleUserName(sale: SalesOnlineShopSale): string {
  const user = sale.UpdateUser || sale.User

  return (
    user?.FullName?.trim()
    || user?.Name?.trim()
    || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ').trim()
    || user?.Abbreviation?.trim()
    || ''
  )
}

function getSaleStatusKey(sale: SalesOnlineShopSale): string {
  const status = sale.BaseLifeCycleStatus?.SaleLifeCycleType

  if (typeof status === 'number') {
    return lifecycleStatusFromNumber(status)
  }

  return String(status || sale.BaseLifeCycleStatus?.Name || '')
}

function getSaleStatusLabel(sale: SalesOnlineShopSale): string {
  const statusKey = getSaleStatusKey(sale)

  return translate(STATUS_LABELS[statusKey] || sale.BaseLifeCycleStatus?.Name || displayValue(statusKey))
}

function getPaymentStatusLabel(sale: SalesOnlineShopSale): string {
  const status = sale.BaseSalePaymentStatus?.SalePaymentStatusType
  const key = typeof status === 'undefined' || status === null ? '' : String(status)

  return translate(PAYMENT_STATUS_LABELS[key] || sale.BaseSalePaymentStatus?.Name || '')
}

function getSaleCurrencyCode(sale: SalesOnlineShopSale): string {
  return sale.ClientAgreement?.Agreement?.Currency?.Code || ''
}

function getOrderItemCount(sale: SalesOnlineShopSale): number {
  return sale.Order?.OrderItems?.length || getNumber(sale.Order?.TotalCount) || getNumber(sale.TotalCount) || 0
}

function getOrderItemProductName(item: SalesOnlineShopOrderItem): string {
  return item.Product?.NameUA || item.Product?.Name || ''
}

function getOrderItemProductCode(item: SalesOnlineShopOrderItem): string {
  return item.Product?.VendorCode || item.Product?.Articul || item.Product?.MainOriginalNumber || ''
}

function lifecycleStatusFromNumber(status: number): string {
  switch (status) {
    case 0:
      return 'New'
    case 1:
      return 'Packaging'
    case 2:
      return 'Packaged'
    case 3:
      return 'Shipping'
    case 4:
      return 'Received'
    case 5:
      return 'Await'
    case 100:
      return 'OrderClosed'
    case 101:
      return 'TransporterChanged'
    case 102:
      return 'InvoiceChanged'
    default:
      return String(status)
  }
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value !== 'string' || !value) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const dateOnly = new Date(year, month - 1, day)

    return Number.isNaN(dateOnly.getTime()) ? null : dateOnly
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString('uk-UA') : ''
}

function formatTime(value: Date | null): string {
  return value ? value.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : ''
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : displayValue(value)
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  return '—'
}
