import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  MultiSelect,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconEye,
  IconLockOpen,
  IconPencil,
  IconPrinter,
  IconRefresh,
  IconRestore,
  IconSearch,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  getSalesUkraine,
  getSalesUkraineOrganizations,
  searchSalesUkraineClients,
  unlockSale,
  updateSale,
} from '../api/salesUkraineApi'
import { SaleDiscountModal } from '../components/SaleDiscountModal'
import { SaleDocumentsMenu } from '../components/SaleDocumentsMenu'
import { SALES_UKRAINE_UNLOCK_PERMISSION, SALES_UKRAINE_WILL_NOT_SHIP_PERMISSION } from '../permissions'
import type {
  SalesUkraineClientOption,
  SalesUkraineFilters,
  SalesUkraineOrderItem,
  SalesUkraineOrganizationOption,
  SalesUkraineSale,
  SalesUkraineStatusFilter,
  SalesUkraineUserFilter,
} from '../types'

type FilterDraft = {
  clientId: string
  from: string
  onlyMine: boolean
  organisationIds: string[]
  status: SalesUkraineStatusFilter
  to: string
  value: string
}

type ConfirmState = {
  color?: string
  confirmLabel: string
  message: string
  onConfirm: () => Promise<void>
  title: string
}

const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100', '500']
const DEFAULT_PAGE_SIZE = 20

const SALES_UKRAINE_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['date', 'number', 'client'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SALES_UKRAINE_ITEMS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['product'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const STATUS_OPTIONS: Array<{ label: string; value: SalesUkraineStatusFilter }> = [
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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  0: 'Не оплачено',
  1: 'Оплачено',
  2: 'Оплачено',
  3: 'Оплачено частково',
}

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function SalesUkrainePage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canUnlock = hasPermission(SALES_UKRAINE_UNLOCK_PERMISSION)
  const canWillNotShip = hasPermission(SALES_UKRAINE_WILL_NOT_SHIP_PERMISSION)
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const initialDraft = useMemo<FilterDraft>(
    () => ({
      clientId: '',
      from: today,
      onlyMine: false,
      organisationIds: [],
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
  const [sales, setSales] = useValueState<SalesUkraineSale[]>([])
  const [selectedSale, setSelectedSale] = useValueState<SalesUkraineSale | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [organizations, setOrganizations] = useValueState<SalesUkraineOrganizationOption[]>([])
  const [clientQuery, setClientQuery] = useValueState('')
  const [clientOptions, setClientOptions] = useValueState<SalesUkraineClientOption[]>([])
  const [confirmState, setConfirmState] = useValueState<ConfirmState | null>(null)
  const [isConfirming, setConfirming] = useValueState(false)
  const [discountSale, setDiscountSale] = useValueState<SalesUkraineSale | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const offset = (page - 1) * pageSize
  const totalRows = getTotalRows(sales)
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  const activeFilters = useMemo<SalesUkraineFilters>(
    () => ({
      clientId: activeDraft.clientId,
      from: activeDraft.from,
      limit: pageSize,
      offset,
      organisationIds: activeDraft.organisationIds.map(Number).filter(Number.isFinite),
      status: activeDraft.status,
      to: activeDraft.to,
      type: activeDraft.onlyMine ? 'Self' : 'All',
      value: activeDraft.value,
    }),
    [activeDraft, offset, pageSize],
  )

  const columns = useSalesUkraineColumns({
    canUnlock,
    canWillNotShip,
    onOpenDiscount: setDiscountSale,
    onOpenSale: setSelectedSale,
    onUnlock: requestUnlock,
    onWillNotShip: requestWillNotShip,
  })

  useEffect(() => {
    let cancelled = false

    async function loadOrganizations() {
      try {
        const next = await getSalesUkraineOrganizations()

        if (!cancelled) {
          setOrganizations(next)
        }
      } catch {
        if (!cancelled) {
          setOrganizations([])
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [setOrganizations])

  useEffect(() => {
    const query = clientQuery.trim()

    if (query.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchSalesUkraineClients(query)

        if (!cancelled) {
          setClientOptions(next)
        }
      } catch {
        if (!cancelled) {
          setClientOptions([])
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [clientQuery, setClientOptions])

  useEffect(() => {
    let cancelled = false

    async function loadSales() {
      setLoading(true)
      setError(null)

      try {
        const next = await getSalesUkraine(activeFilters)

        if (!cancelled) {
          setSales(next)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSales([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі'))
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
    setActiveDraft({ ...nextDraft, value: nextDraft.value.trim() })
  }

  function resetFilters() {
    setPage(1)
    setFilterDraft(initialDraft)
    setActiveDraft(initialDraft)
    setClientQuery('')
  }

  function requestUnlock(sale: SalesUkraineSale) {
    const netId = sale.NetUid

    if (!netId) {
      return
    }

    setConfirmState({
      color: 'red',
      confirmLabel: t('Розблокувати'),
      message: t('Розблокувати рахунок?'),
      title: t('Розблокування'),
      onConfirm: async () => {
        await unlockSale(netId)
        notifications.show({ color: 'green', message: t('Продаж розблоковано') })
      },
    })
  }

  function requestWillNotShip(sale: SalesUkraineSale) {
    if (!sale.NetUid) {
      return
    }

    setConfirmState({
      confirmLabel: t('Підтвердити'),
      message: t('Позначити, що замовлення не буде відвантажено?'),
      title: t('Не буде відвантажено'),
      onConfirm: async () => {
        await updateSale({ ...sale, IsAcceptedToPacking: true })
        notifications.show({ color: 'green', message: t('Збережено') })
      },
    })
  }

  async function runConfirm() {
    if (!confirmState) {
      return
    }

    setConfirming(true)

    try {
      await confirmState.onConfirm()
      setConfirmState(null)
      reload()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося виконати дію') })
    } finally {
      setConfirming(false)
    }
  }

  const organizationOptions = useMemo(
    () =>
      organizations
        .filter((organization) => typeof organization.Id === 'number' && organization.Name)
        .map((organization) => ({ label: organization.Name || '', value: String(organization.Id) })),
    [organizations],
  )

  const clientSelectData = useMemo(
    () => clientOptions.map((client) => ({ label: getClientOptionLabel(client), value: String(client.Id ?? client.NetUid ?? '') })),
    [clientOptions],
  )

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
          <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size="sm" variant="subtle" onClick={() => reload()}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
    [isLoading, pageSize, setPage, setPageSize, t],
  )

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="center">
        <Badge color="gray" variant="light">
          {isLoading ? t('Завантаження') : `${t('Записів')}: ${totalRows || sales.length}`}
        </Badge>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
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
              w={180}
              onChange={(value) => applyFilters({ ...filterDraft, status: (value as SalesUkraineStatusFilter | null) || 'all' })}
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
                applyFilters({ ...filterDraft, onlyMine: ((value as SalesUkraineUserFilter | null) || 'All') === 'Self' })
              }
            />
            <MultiSelect
              clearable
              searchable
              data={organizationOptions}
              label={t('Організація')}
              placeholder={filterDraft.organisationIds.length ? undefined : t('Усі')}
              value={filterDraft.organisationIds}
              w={230}
              onChange={(value) => applyFilters({ ...filterDraft, organisationIds: value })}
            />
            <Select
              clearable
              searchable
              data={clientSelectData}
              label={t('Клієнт')}
              nothingFoundMessage={clientQuery.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')}
              placeholder={t('Пошук клієнта')}
              searchValue={clientQuery}
              value={filterDraft.clientId || null}
              w={240}
              onChange={(value) => applyFilters({ ...filterDraft, clientId: value || '' })}
              onSearchChange={setClientQuery}
            />
            <TextInput
              flex={1}
              label={t('Пошук')}
              leftSection={<IconSearch size={16} />}
              miw={200}
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
            defaultLayout={SALES_UKRAINE_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Продажів не знайдено')}
            getRowId={(sale, index) => String(sale.NetUid || sale.Id || index)}
            isLoading={isLoading}
            layoutVersion="sales-ukraine-table-1"
            loadingText={t('Завантаження продажів')}
            maxHeight="calc(100vh - 360px)"
            minWidth={1720}
            tableId="sales-ukraine"
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

      <SaleDiscountModal
        sale={discountSale}
        onClose={() => setDiscountSale(null)}
        onSaved={() => {
          setDiscountSale(null)
          reload()
        }}
      />

      <AppModal
        centered
        opened={Boolean(confirmState)}
        size="sm"
        title={confirmState?.title || ''}
        onClose={() => (isConfirming ? undefined : setConfirmState(null))}
      >
        {confirmState && (
          <Stack gap="md">
            <Text>{confirmState.message}</Text>
            <Group justify="flex-end">
              <Button color="gray" disabled={isConfirming} variant="subtle" onClick={() => setConfirmState(null)}>
                {t('Скасувати')}
              </Button>
              <Button color={confirmState.color || 'violet'} loading={isConfirming} onClick={runConfirm}>
                {confirmState.confirmLabel}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>
    </Stack>
  )
}

function useSalesUkraineColumns({
  canUnlock,
  canWillNotShip,
  onOpenDiscount,
  onOpenSale,
  onUnlock,
  onWillNotShip,
}: {
  canUnlock: boolean
  canWillNotShip: boolean
  onOpenDiscount: (sale: SalesUkraineSale) => void
  onOpenSale: (sale: SalesUkraineSale) => void
  onUnlock: (sale: SalesUkraineSale) => void
  onWillNotShip: (sale: SalesUkraineSale) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SalesUkraineSale>[]>(
    () => [
      {
        id: 'date',
        header: t('Дата'),
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
        header: t('Номер'),
        width: 184,
        minWidth: 150,
        accessor: (sale) => sale.SaleNumber?.Value || sale.NetUid,
        cell: (sale) => (
          <Group gap={5} wrap="wrap">
            <Text fw={600}>{displayValue(sale.SaleNumber?.Value)}</Text>
            {sale.IsVatSale && (
              <Badge color="blue" size="xs" variant="light">
                {t('ПДВ')}
              </Badge>
            )}
            {sale.IsDevelopment && (
              <Badge color="grape" size="xs" variant="light">
                {t('Протокол')}
              </Badge>
            )}
            {Array.isArray(sale.HistoryInvoiceEdit) && sale.HistoryInvoiceEdit.length > 0 && (
              <Tooltip label={t('Рахунок редаговано')}>
                <IconPencil size={14} style={{ color: 'var(--mantine-color-orange-6)' }} />
              </Tooltip>
            )}
            {sale.IsPrinted && (
              <Tooltip label={t('Документи надруковано')}>
                <IconPrinter size={14} style={{ color: 'var(--mantine-color-gray-5)' }} />
              </Tooltip>
            )}
          </Group>
        ),
      },
      {
        id: 'client',
        header: t('Клієнт'),
        width: 300,
        minWidth: 220,
        accessor: getSaleClientName,
        cell: (sale) => (
          <>
            <Text fw={600}>{displayValue(getSaleClientName(sale))}</Text>
            <Text size="xs" c="dimmed">
              {displayValue(sale.ClientAgreement?.Agreement?.Name)}
            </Text>
          </>
        ),
      },
      {
        id: 'status',
        header: t('Статус'),
        width: 150,
        minWidth: 132,
        accessor: getSaleStatusKey,
        cell: (sale) => (
          <Badge color={STATUS_COLORS[getSaleStatusKey(sale)] || 'gray'} variant="light">
            {getSaleStatusLabel(sale)}
          </Badge>
        ),
      },
      {
        id: 'payment',
        header: t('Оплата'),
        width: 132,
        minWidth: 116,
        accessor: getPaymentStatusLabel,
        cell: (sale) => {
          const color = getPaymentStatusColor(sale)

          return (
            <Text c={color} fw={color ? 600 : undefined}>
              {displayValue(`${getPaymentStatusLabel(sale)}${getRetailPaymentSuffix(sale)}`)}
            </Text>
          )
        },
      },
      {
        id: 'responsible',
        header: t('Менеджер'),
        width: 170,
        minWidth: 140,
        accessor: getSaleUserName,
        cell: (sale) => displayValue(getSaleUserName(sale)),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 180,
        minWidth: 150,
        accessor: (sale) => sale.ClientAgreement?.Agreement?.Organization?.Name,
        cell: (sale) => displayValue(sale.ClientAgreement?.Agreement?.Organization?.Name),
      },
      {
        id: 'amountLocal',
        header: t('Сума'),
        width: 132,
        minWidth: 116,
        align: 'right',
        accessor: (sale) => getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount),
        cell: (sale) => (
          <>
            <Text fw={600}>{formatAmount(getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount))}</Text>
            <Text size="xs" c="dimmed">
              {displayValue(getSaleCurrencyCode(sale))}
            </Text>
          </>
        ),
      },
      {
        id: 'amountEur',
        header: t('Екв. EUR'),
        width: 124,
        minWidth: 112,
        align: 'right',
        accessor: (sale) => getNumber(sale.TotalAmount),
        cell: (sale) => formatAmount(getNumber(sale.TotalAmount)),
      },
      {
        id: 'vat',
        header: t('ПДВ'),
        width: 110,
        minWidth: 100,
        align: 'right',
        accessor: (sale) => getNumber(sale.Order?.TotalVat),
        cell: (sale) => formatAmount(getNumber(sale.Order?.TotalVat)),
      },
      {
        id: 'discount',
        header: t('Знижка'),
        width: 110,
        minWidth: 96,
        align: 'right',
        accessor: (sale) => getNumber(sale.Order?.OrderItems?.[0]?.OneTimeDiscount),
        cell: (sale) => {
          const discount = getNumber(sale.Order?.OrderItems?.[0]?.OneTimeDiscount)
          const text = discount ? `${amountFormatter.format(discount)} %` : '—'

          if (!isNewOrPackagingStatus(sale)) {
            return text
          }

          return (
            <Anchor
              component="button"
              fw={discount ? 600 : 400}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenDiscount(sale)
              }}
            >
              {discount ? text : t('Знижка')}
            </Anchor>
          )
        },
      },
      {
        id: 'positions',
        header: t('Позиції'),
        width: 96,
        minWidth: 88,
        align: 'right',
        accessor: getOrderItemCount,
        cell: (sale) => displayValue(getOrderItemCount(sale)),
      },
      {
        id: 'transporter',
        header: t('Перевізник'),
        width: 160,
        minWidth: 130,
        accessor: (sale) => sale.Transporter?.Name || sale.Transporter?.Title,
        cell: (sale) => displayValue(sale.Transporter?.Name || sale.Transporter?.Title),
      },
      {
        id: 'actions',
        header: '',
        width: 152,
        minWidth: 152,
        maxWidth: 152,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (sale) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Group gap={2} justify="center" wrap="nowrap">
              <Tooltip label={t('Деталі')}>
                <ActionIcon aria-label={t('Деталі')} color="gray" variant="subtle" onClick={() => onOpenSale(sale)}>
                  <IconEye size={18} />
                </ActionIcon>
              </Tooltip>
              <SaleDocumentsMenu sale={sale} />
              {canWillNotShip && sale.IsVatSale && !sale.IsAcceptedToPacking && (
                <Tooltip label={t('Не буде відвантажено')}>
                  <ActionIcon
                    aria-label={t('Не буде відвантажено')}
                    color="orange"
                    disabled={!sale.ChangedToInvoice}
                    variant="subtle"
                    onClick={() => onWillNotShip(sale)}
                  >
                    <IconAlertTriangle size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              {canUnlock && sale.IsLocked && (
                <Tooltip label={t('Розблокувати')}>
                  <ActionIcon aria-label={t('Розблокувати')} color="red" variant="subtle" onClick={() => onUnlock(sale)}>
                    <IconLockOpen size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Box>
        ),
      },
    ],
    [canUnlock, canWillNotShip, onOpenDiscount, onOpenSale, onUnlock, onWillNotShip, t],
  )
}

function SaleDetail({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const itemColumns = useMemo<DataTableColumn<SalesUkraineOrderItem>[]>(
    () => [
      { id: 'product', header: t('Товар'), accessor: (item) => getOrderItemProductName(item), minWidth: 240 },
      { id: 'code', header: t('Код'), accessor: (item) => getOrderItemProductCode(item), width: 120 },
      {
        id: 'qty',
        header: t('К-сть'),
        accessor: (item) => getNumber(item.Qty),
        align: 'right',
        cell: (item) => displayValue(getNumber(item.Qty)),
        width: 100,
      },
      {
        id: 'price',
        header: t('Ціна'),
        accessor: (item) => getNumber(item.PricePerItem),
        align: 'right',
        cell: (item) => formatAmount(getNumber(item.PricePerItem)),
        width: 120,
      },
      {
        id: 'amount',
        header: t('Сума'),
        accessor: (item) => getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount),
        align: 'right',
        cell: (item) => formatAmount(getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)),
        width: 130,
      },
    ],
    [t],
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
          <Badge color="blue" variant="light">
            {t('ПДВ')}
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
          [t('Номер'), sale.SaleNumber?.Value],
          [t('Клієнт'), getSaleClientName(sale)],
          [t('Менеджер'), getSaleUserName(sale)],
          [t('Договір'), sale.ClientAgreement?.Agreement?.Name],
          [t('Організація'), sale.ClientAgreement?.Agreement?.Organization?.Name],
          [t('Перевізник'), sale.Transporter?.Name || sale.Transporter?.Title],
          [t('Оплата'), getPaymentStatusLabel(sale)],
          [t('ПДВ'), formatAmount(getNumber(sale.Order?.TotalVat))],
          [
            t('Сума'),
            `${formatAmount(getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount))} ${getSaleCurrencyCode(sale)}`,
          ],
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
          defaultLayout={SALES_UKRAINE_ITEMS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Товарів не знайдено')}
          getRowId={(item, index) => String(item.NetUid || item.Id || index)}
          layoutVersion="sales-ukraine-items-table-1"
          maxHeight="45vh"
          minWidth={720}
          tableId="sales-ukraine-items"
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

function getTotalRows(sales: SalesUkraineSale[]): number {
  return getNumber(sales[0]?.TotalRowsQty) || sales.length
}

function getSaleDate(sale: SalesUkraineSale): Date | null {
  return parseDate(sale.ChangedToInvoice || sale.Updated || sale.Created || sale.FromDate)
}

function getSaleTime(sale: SalesUkraineSale): number {
  return getSaleDate(sale)?.getTime() || 0
}

function getSaleClientName(sale: SalesUkraineSale): string {
  const client = sale.ClientAgreement?.Client

  return (
    client?.FullName?.trim()
    || [client?.LastName, client?.FirstName, client?.MiddleName].filter(Boolean).join(' ').trim()
    || client?.MobileNumber?.trim()
    || ''
  )
}

function getClientOptionLabel(client: SalesUkraineClientOption): string {
  return (
    client.FullName?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || client.Name?.trim()
    || ''
  )
}

function getSaleUserName(sale: SalesUkraineSale): string {
  const user = sale.UpdateUser || sale.User

  return (
    user?.FullName?.trim()
    || user?.Name?.trim()
    || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ').trim()
    || user?.Abbreviation?.trim()
    || ''
  )
}

function getSaleStatusKey(sale: SalesUkraineSale): string {
  const status = sale.BaseLifeCycleStatus?.SaleLifeCycleType

  if (typeof status === 'number') {
    return lifecycleStatusFromNumber(status)
  }

  return String(status || sale.BaseLifeCycleStatus?.Name || '')
}

function getSaleStatusLabel(sale: SalesUkraineSale): string {
  const statusKey = getSaleStatusKey(sale)

  return translate(STATUS_LABELS[statusKey] || sale.BaseLifeCycleStatus?.Name || displayValue(statusKey))
}

function getPaymentStatusLabel(sale: SalesUkraineSale): string {
  const status = sale.BaseSalePaymentStatus?.SalePaymentStatusType
  const key = typeof status === 'undefined' || status === null ? '' : String(status)

  return translate(PAYMENT_STATUS_LABELS[key] || sale.BaseSalePaymentStatus?.Name || '')
}

function getPaymentStatusColor(sale: SalesUkraineSale): string | undefined {
  switch (sale.BaseSalePaymentStatus?.SalePaymentStatusType) {
    case 0:
      return 'red'
    case 1:
      return 'green'
    case 3:
      return 'orange'
    default:
      return undefined
  }
}

function getRetailPaymentSuffix(sale: SalesUkraineSale): string {
  if (!sale.RetailClient) {
    return ''
  }

  return sale.IsFullPayment ? ' (ПО)' : ' (ЧО)'
}

function getSaleCurrencyCode(sale: SalesUkraineSale): string {
  return sale.ClientAgreement?.Agreement?.Currency?.Code || ''
}

function isNewOrPackagingStatus(sale: SalesUkraineSale): boolean {
  const status = sale.BaseLifeCycleStatus?.SaleLifeCycleType

  return status === 0 || status === 1
}

function getOrderItemCount(sale: SalesUkraineSale): number {
  return sale.Order?.OrderItems?.length || getNumber(sale.Order?.TotalCount) || getNumber(sale.TotalCount) || 0
}

function getOrderItemProductName(item: SalesUkraineOrderItem): string {
  return item.Product?.NameUA || item.Product?.Name || ''
}

function getOrderItemProductCode(item: SalesUkraineOrderItem): string {
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
