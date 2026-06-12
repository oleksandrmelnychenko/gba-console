import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBrandEdge,
  IconDots,
  IconExternalLink,
  IconFileInvoice,
  IconEye,
  IconHistory,
  IconInfoCircle,
  IconLockOpen,
  IconReceipt,
  IconReceipt2,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTag,
  IconTruckDelivery,
} from '@tabler/icons-react'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { AppModal } from '../../../shared/ui/AppModal'
import { SaleAuditDetail, getSaleStatisticBySaleId, type SaleAuditStatistic } from '../../../shared/sale-audit'
import { UserRoleType } from '../../../shared/auth/types'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import '../../sales-ukraine/pages/sale-detail-sheet.css'
import { useAuth } from '../../auth/useAuth'
import { unlockSale, updateSale } from '../../sales-ukraine/api/salesUkraineApi'
import { ConsignmentNoteSettingsDrawer } from '../../sales-ukraine/components/ConsignmentNoteSettingsDrawer'
import { SaleDetailsDrawer } from '../../sales-ukraine/components/SaleDetailsDrawer'
import { SaleDiscountModal } from '../../sales-ukraine/components/SaleDiscountModal'
import { SaleDocumentsMenu } from '../../sales-ukraine/components/SaleDocumentsMenu'
import { SaleEditorDrawer } from '../../sales-ukraine/components/SaleEditorDrawer'
import {
  SALES_UKRAINE_EDIT_PERMISSION,
  SALES_UKRAINE_UNLOCK_PERMISSION,
  SALES_UKRAINE_WILL_NOT_SHIP_PERMISSION,
} from '../../sales-ukraine/permissions'
import type { SalesUkraineSale } from '../../sales-ukraine/types'
import { getSalesOnlineShop } from '../api/salesOnlineShopApi'
import type {
  SalesOnlineShopFilters,
  SalesOnlineShopOrderItem,
  SalesOnlineShopSale,
  SalesOnlineShopStatusFilter,
  SalesOnlineShopUserFilter,
} from '../types'

function asUkraineSale(sale: SalesOnlineShopSale): SalesUkraineSale {
  return sale as unknown as SalesUkraineSale
}

type SalesOnlineShopSaleWithDelivery = SalesOnlineShopSale & {
  CustomersOwnTtn?: { Number?: string } | null
  DeliveryRecipient?: { FullName?: string; MobilePhone?: string } | null
  DeliveryRecipientAddress?: { City?: string; Department?: string; Value?: string } | null
}

type SalesOnlineShopClientWithRoot = NonNullable<SalesOnlineShopSale['ClientAgreement']>['Client'] & {
  RootClient?: {
    FirstName?: string
    FullName?: string
    LastName?: string
  }
}

type ConfirmState = {
  color?: string
  confirmLabel: string
  message: string
  onConfirm: () => Promise<void>
  title: string
}

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
  0: 'Неоплаченно',
  1: 'Оплачено',
  2: 'Оплачено',
  3: 'Оплачено частково',
}

const STATUS_LABELS: Record<string, string> = {
  Await: 'Очікування',
  InvoiceChanged: 'Редаговані накладні',
  New: 'Рахунок',
  OrderClosed: 'Закриті рахунки',
  Packaged: 'Накладна',
  Packaging: 'Накладна',
  Received: 'Отримано',
  Shipping: 'Відправлено',
  TransporterChanged: 'Редаговані перевізники',
}

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function SalesOnlineShopPage() {
  const { t } = useI18n()
  const { hasPermission, user } = useAuth()
  const isAdmin =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const canEditSale = hasPermission(SALES_UKRAINE_EDIT_PERMISSION)
  const canUnlock = hasPermission(SALES_UKRAINE_UNLOCK_PERMISSION)
  const canWillNotShip = hasPermission(SALES_UKRAINE_WILL_NOT_SHIP_PERMISSION)
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
  const [confirmState, setConfirmState] = useValueState<ConfirmState | null>(null)
  const [isConfirming, setConfirming] = useValueState(false)
  const [discountSale, setDiscountSale] = useValueState<SalesOnlineShopSale | null>(null)
  const [detailsSale, setDetailsSale] = useValueState<SalesOnlineShopSale | null>(null)
  const [consignmentSale, setConsignmentSale] = useValueState<SalesOnlineShopSale | null>(null)
  const [editorSale, setEditorSale] = useValueState<SalesOnlineShopSale | null>(null)
  const [auditSale, setAuditSale] = useValueState<SalesOnlineShopSale | null>(null)
  const [auditStatistic, setAuditStatistic] = useValueState<SaleAuditStatistic | null>(null)
  const [auditLoading, setAuditLoading] = useValueState(false)
  const [auditError, setAuditError] = useValueState<string | null>(null)
  const auditRequestRef = useRef(0)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const realtimeReloadRef = useRef<number | null>(null)
  const backgroundReloadRef = useRef(false)
  const salesRef = useRef<SalesOnlineShopSale[]>(sales)
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

  const openAudit = useCallback(
    (sale: SalesOnlineShopSale) => {
      setAuditSale(sale)
      setAuditStatistic(null)
      setAuditError(null)

      if (!sale.NetUid) {
        return
      }

      setAuditLoading(true)
      const requestId = auditRequestRef.current + 1
      auditRequestRef.current = requestId

      void (async () => {
        try {
          const statistic = await getSaleStatisticBySaleId(sale.NetUid as string)

          if (auditRequestRef.current === requestId) {
            setAuditStatistic(statistic)
          }
        } catch (auditFetchError) {
          if (auditRequestRef.current === requestId) {
            setAuditError(
              auditFetchError instanceof Error ? auditFetchError.message : t('Не вдалося завантажити дані'),
            )
          }
        } finally {
          if (auditRequestRef.current === requestId) {
            setAuditLoading(false)
          }
        }
      })()
    },
    [setAuditSale, setAuditStatistic, setAuditError, setAuditLoading, t],
  )

  const closeAudit = useCallback(() => {
    auditRequestRef.current += 1
    setAuditSale(null)
    setAuditStatistic(null)
    setAuditError(null)
    setAuditLoading(false)
  }, [setAuditSale, setAuditStatistic, setAuditError, setAuditLoading])

  const requestUnlock = useCallback(
    (sale: SalesOnlineShopSale) => {
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
    },
    [setConfirmState, t],
  )

  const requestWillNotShip = useCallback(
    (sale: SalesOnlineShopSale) => {
      if (!sale.NetUid) {
        return
      }

      setConfirmState({
        confirmLabel: t('Підтвердити'),
        message: t('Позначити, що замовлення не буде відвантажено?'),
        title: t('Не буде відвантажено'),
        onConfirm: async () => {
          await updateSale({ ...asUkraineSale(sale), IsAcceptedToPacking: true })
          notifications.show({ color: 'green', message: t('Збережено') })
        },
      })
    },
    [setConfirmState, t],
  )

  const columns = useSalesOnlineShopColumns({
    canEditSale,
    canUnlock,
    canWillNotShip,
    isAdmin,
    onOpenAudit: openAudit,
    onOpenConsignment: setConsignmentSale,
    onOpenDetails: setDetailsSale,
    onOpenDiscount: setDiscountSale,
    onOpenEditor: setEditorSale,
    onOpenSale: setSelectedSale,
    onUnlock: requestUnlock,
    onWillNotShip: requestWillNotShip,
  })

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

  useEffect(() => {
    salesRef.current = sales
  }, [sales])

  const scheduleRealtimeReload = useCallback(() => {
    if (realtimeReloadRef.current !== null) {
      window.clearTimeout(realtimeReloadRef.current)
    }

    realtimeReloadRef.current = window.setTimeout(() => {
      realtimeReloadRef.current = null
      backgroundReloadRef.current = true
      reload()
    }, 800)
  }, [reload])

  useEffect(
    () => () => {
      if (realtimeReloadRef.current !== null) {
        window.clearTimeout(realtimeReloadRef.current)
      }
    },
    [],
  )

  const handleRealtimeSaleAdded = useCallback(
    (payload: unknown) => {
      const sale = resolveRealtimeSale(payload)
      const number = sale?.SaleNumber?.Value

      if (typeof number === 'string' && number.trim().startsWith('P')) {
        return
      }

      scheduleRealtimeReload()
    },
    [scheduleRealtimeReload],
  )

  const handleRealtimeSaleUpdated = useCallback(
    (payload: unknown) => {
      const sale = resolveRealtimeSale(payload)
      const netId = sale?.NetUid

      if (!netId || salesRef.current.some((current) => current.NetUid === netId)) {
        scheduleRealtimeReload()
      }
    },
    [scheduleRealtimeReload],
  )

  useRealtimeEvent(realtimeEvents.saleAdded, handleRealtimeSaleAdded)
  useRealtimeEvent(realtimeEvents.saleUpdated, handleRealtimeSaleUpdated)

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {activeDraft.onlyMine ? t('тільки мої') : ''}
      </Text>
    ),
    [activeDraft.onlyMine, t],
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
      const isBackgroundReload = backgroundReloadRef.current
      backgroundReloadRef.current = false

      if (!isBackgroundReload) {
        setLoading(true)
        setError(null)
      }

      try {
        const nextSales = await getSalesOnlineShop(activeFilters)

        if (!cancelled) {
          setSales(nextSales)

          if (isBackgroundReload) {
            setError(null)
          }
        }
      } catch (loadError) {
        if (!cancelled && !isBackgroundReload) {
          setSales([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі інтернет-магазину'))
        }
      } finally {
        if (!cancelled && !isBackgroundReload) {
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
            minWidth={1670}
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
        classNames={{
          body: 'sale-detail-drawer-body',
          content: 'sale-detail-drawer-content',
        }}
        opened={Boolean(selectedSale)}
        position="right"
        size="min(820px, 100vw)"
        title={t('Деталі продажу')}
        onClose={() => setSelectedSale(null)}
      >
        {selectedSale && <SaleDetail sale={selectedSale} />}
      </AppDrawer>

      <SaleDiscountModal
        sale={discountSale ? asUkraineSale(discountSale) : null}
        onClose={() => setDiscountSale(null)}
        onSaved={() => {
          setDiscountSale(null)
          reload()
        }}
      />

      <SaleDetailsDrawer
        sale={detailsSale ? asUkraineSale(detailsSale) : null}
        onClose={() => setDetailsSale(null)}
        onSaved={() => {
          setDetailsSale(null)
          reload()
        }}
      />

      <ConsignmentNoteSettingsDrawer
        opened={Boolean(consignmentSale)}
        sale={consignmentSale ? asUkraineSale(consignmentSale) : null}
        onClose={() => setConsignmentSale(null)}
      />

      <SaleEditorDrawer
        sale={editorSale ? asUkraineSale(editorSale) : null}
        onClose={() => setEditorSale(null)}
      />

      <AppDrawer
        opened={Boolean(auditSale)}
        position="right"
        size="min(720px, 100vw)"
        title={t('Історія редагувань')}
        onClose={closeAudit}
      >
        <SaleAuditDetail error={auditError} isLoading={auditLoading} statistic={auditStatistic} />
      </AppDrawer>

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

function useSalesOnlineShopColumns({
  canEditSale,
  canUnlock,
  canWillNotShip,
  isAdmin,
  onOpenAudit,
  onOpenConsignment,
  onOpenDetails,
  onOpenDiscount,
  onOpenEditor,
  onOpenSale,
  onUnlock,
  onWillNotShip,
}: {
  canEditSale: boolean
  canUnlock: boolean
  canWillNotShip: boolean
  isAdmin: boolean
  onOpenAudit: (sale: SalesOnlineShopSale) => void
  onOpenConsignment: (sale: SalesOnlineShopSale) => void
  onOpenDetails: (sale: SalesOnlineShopSale) => void
  onOpenDiscount: (sale: SalesOnlineShopSale) => void
  onOpenEditor: (sale: SalesOnlineShopSale) => void
  onOpenSale: (sale: SalesOnlineShopSale) => void
  onUnlock: (sale: SalesOnlineShopSale) => void
  onWillNotShip: (sale: SalesOnlineShopSale) => void
}) {
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
        cell: (sale) => (
          <Group gap={5} wrap="nowrap">
            <Tooltip label={t('Інтернет-магазин')}>
              <Box c="gray.6" style={{ display: 'inline-flex' }}>
                <IconBrandEdge size={14} />
              </Box>
            </Tooltip>
            <Text fw={600}>{displayValue(sale.SaleNumber?.Value)}</Text>
          </Group>
        ),
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
            <Group gap={4} wrap="nowrap">
              <Text size="xs" c="dimmed">
                {displayValue(getRetailClientLine(sale))}
              </Text>
              {sale.MisplacedSaleId && (
                <Tooltip label={t('Часткова продажа')}>
                  <Box c="red" style={{ display: 'inline-flex' }}>
                    <IconInfoCircle size={14} />
                  </Box>
                </Tooltip>
              )}
            </Group>
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
        cell: (sale) => (
          <Text c={isUnpaidSale(sale) ? 'red' : undefined} fw={600}>
            {formatAmount(getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount))}
          </Text>
        ),
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
        id: 'discount',
        header: 'Знижка',
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
        cell: (sale) => {
          const name = sale.Transporter?.Name || sale.Transporter?.Title

          if (!sale.Transporter) {
            return displayValue(name)
          }

          return (
            <Anchor
              component="button"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenDetails(sale)
              }}
            >
              {displayValue(name)}
            </Anchor>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        width: 132,
        minWidth: 132,
        maxWidth: 132,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (sale) => {
          const lifeCycleType = sale.BaseLifeCycleStatus?.SaleLifeCycleType
          const isPackaging = lifeCycleType === 1 || lifeCycleType === 2
          const hidePrintBlock = Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking && !isAdmin
          const showTtn = Boolean(sale.TransporterId) && isPackaging && !hidePrintBlock
          const showWillNotShip = canWillNotShip && Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking
          const showUnlock = canUnlock && Boolean(sale.IsLocked)
          const showEdit = canEditSale && (sale.InputSaleMerges?.length ?? 0) === 0

          return (
            <Box onClick={(event) => event.stopPropagation()}>
              <Group gap={2} justify="center" wrap="nowrap">
                <Tooltip label={t('Деталі')}>
                  <ActionIcon aria-label={t('Деталі')} color="gray" variant="subtle" onClick={() => onOpenSale(sale)}>
                    <IconEye size={18} />
                  </ActionIcon>
                </Tooltip>
                {!hidePrintBlock && <SaleDocumentsMenu sale={asUkraineSale(sale)} />}
                <Menu position="bottom-end" shadow="md" withinPortal>
                  <Menu.Target>
                    <ActionIcon aria-label={t('Дії')} color="gray" variant="subtle">
                      <IconDots size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {showEdit && (
                      <Menu.Item leftSection={<IconExternalLink size={16} />} onClick={() => onOpenEditor(sale)}>
                        {t('Відкрити продаж')}
                      </Menu.Item>
                    )}
                    {showTtn && (
                      <Menu.Item leftSection={<IconReceipt size={16} />} onClick={() => onOpenConsignment(sale)}>
                        {t('Друк ТТН')}
                      </Menu.Item>
                    )}
                    {showWillNotShip && (
                      <Menu.Item
                        color="orange"
                        disabled={!sale.ChangedToInvoice}
                        leftSection={<IconAlertTriangle size={16} />}
                        onClick={() => onWillNotShip(sale)}
                      >
                        {t('Не буде відвантажено')}
                      </Menu.Item>
                    )}
                    {showUnlock && (
                      <Menu.Item color="red" leftSection={<IconLockOpen size={16} />} onClick={() => onUnlock(sale)}>
                        {t('Розблокувати')}
                      </Menu.Item>
                    )}
                    <Menu.Item leftSection={<IconHistory size={16} />} onClick={() => onOpenAudit(sale)}>
                      {t('Історія редагувань')}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Box>
          )
        },
      },
    ],
    [
      canEditSale,
      canUnlock,
      canWillNotShip,
      isAdmin,
      onOpenAudit,
      onOpenConsignment,
      onOpenDetails,
      onOpenDiscount,
      onOpenEditor,
      onOpenSale,
      onUnlock,
      onWillNotShip,
      t,
    ],
  )
}

function SaleDetail({ sale }: { sale: SalesOnlineShopSale }) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const date = getSaleDate(sale)
  const paymentTone = getPaymentStatusTone(sale)
  const primaryAmount = getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount)
  const secondaryAmount = getSecondaryAmount(sale)
  const vatAmount = getNumber(sale.Order?.TotalVat)
  const currencyCode = getSaleCurrencyCode(sale)
  const secondaryCurrencyCode = getSecondaryAmountCode(sale)
  const deliverySale = sale as SalesOnlineShopSaleWithDelivery
  const retailClientLine = getRetailClientLine(sale)
  const clientRows: Array<[string, unknown]> = [
    [t('Клієнт'), getSaleClientName(sale)],
    [t('Договір'), sale.ClientAgreement?.Agreement?.Name],
    [t('Організація'), sale.ClientAgreement?.Agreement?.Organization?.Name],
    [t('Телефон'), sale.ClientAgreement?.Client?.MobileNumber || sale.ClientAgreement?.Client?.PhoneNumber],
  ]

  if (retailClientLine) {
    clientRows.splice(1, 0, [t('Retail-клієнт'), retailClientLine])
  }

  return (
    <div className="sale-detail-sheet">
      <section className="sale-detail-hero">
        <div className="sale-detail-hero-copy">
          <div className="sale-detail-kicker">
            <SaleSourceIcon sale={sale} />
            <span>{displayValue(sale.SaleNumber?.Value)}</span>
            {date && (
              <>
                <span className="sale-detail-dot" />
                <span>
                  {formatDate(date)} {formatTime(date)}
                </span>
              </>
            )}
          </div>
          <OverflowTooltipText className="sale-detail-title">
            {displayValue(getSaleClientDisplayName(sale))}
          </OverflowTooltipText>
          <OverflowTooltipText className="sale-detail-subtitle">
            {displayValue(sale.ClientAgreement?.Agreement?.Name)}
          </OverflowTooltipText>
        </div>

        <div className={`sale-detail-total${isUnpaidSale(sale) ? ' is-unpaid' : ''}`}>
          <span className="sale-detail-total-label">{t('Сума')}</span>
          <strong>{formatAmount(primaryAmount)}</strong>
          <span>{displayValue(currencyCode)}</span>
        </div>
      </section>

      <div className="sale-detail-status-strip">
        <Badge color={STATUS_COLORS[getSaleStatusKey(sale)] || 'gray'} variant="light">
          {getSaleStatusLabel(sale)}
        </Badge>
        <span className={`sale-detail-payment-pill is-${paymentTone}`}>
          {displayValue(`${getPaymentStatusLabel(sale)}${getRetailPaymentSuffix(sale)}`)}
        </span>
        {sale.IsFullPayment && <span className="sale-detail-soft-pill is-success">{t('Повна оплата')}</span>}
        {sale.IsVatSale && <span className="sale-detail-soft-pill is-info">{t('ПДВ')}</span>}
        {sale.IsLocked && <span className="sale-detail-soft-pill is-danger">{t('Заблоковано')}</span>}
        {sale.MisplacedSaleId && <span className="sale-detail-soft-pill is-danger">{t('Часткова продажа')}</span>}
        {sale.IsPrinted && <span className="sale-detail-soft-pill">{t('Друковано')}</span>}
      </div>

      <div className="sale-detail-metrics">
        <SaleDetailMetric label={t('Позиції')} value={displayValue(orderItems.length)} />
        <SaleDetailMetric label={t('ПДВ')} value={formatAmount(vatAmount)} />
        <SaleDetailMetric label={displayValue(secondaryCurrencyCode)} value={formatAmount(secondaryAmount)} />
        <SaleDetailMetric label={t('Менеджер')} value={displayValue(getSaleUserName(sale))} />
      </div>

      <div className="sale-detail-sections">
        <SaleDetailSection
          icon={<IconReceipt2 size={15} />}
          title={t('Продаж')}
          rows={[
            [t('Номер'), sale.SaleNumber?.Value],
            [t('Дата'), date ? `${formatDate(date)} ${formatTime(date)}` : ''],
            [t('Статус'), getSaleStatusLabel(sale)],
            [t('Оплата'), getPaymentStatusLabel(sale)],
          ]}
        />
        <SaleDetailSection
          icon={<IconTag size={15} />}
          title={t('Клієнт і договір')}
          rows={clientRows}
        />
        <SaleDetailSection
          icon={<IconTruckDelivery size={15} />}
          title={t('Доставка')}
          rows={[
            [t('Перевізник'), getSaleTransporterName(sale)],
            [t('Отримувач'), deliverySale.DeliveryRecipient?.FullName],
            [t('Телефон'), deliverySale.DeliveryRecipient?.MobilePhone],
            [t('Адреса'), getSaleDeliveryAddress(sale)],
            [t('ТТН'), deliverySale.CustomersOwnTtn?.Number || sale.TTN],
          ]}
        />
      </div>

      {sale.Comment && (
        <section className="sale-detail-comment">
          <span>{t('Коментар')}</span>
          <p>{sale.Comment}</p>
        </section>
      )}

      <section className="sale-detail-products">
        <div className="sale-detail-section-header">
          <div>
            <Text className="sale-detail-section-title">{t('Товари')}</Text>
            <Text className="sale-detail-section-subtitle">
              {orderItems.length} {t('позицій')}
            </Text>
          </div>
        </div>

        <div className="sale-detail-products-table">
          <div className="sale-detail-products-head">
            <span>{t('Товар')}</span>
            <span>{t('К-сть')}</span>
            <span>{t('Ціна')}</span>
            <span>{t('Сума')}</span>
          </div>
          <div className="sale-detail-products-body">
            {orderItems.length > 0 ? (
              orderItems.map((item, index) => (
                <SaleDetailProductRow
                  key={String(item.NetUid || item.Id || index)}
                  item={item}
                  currencyCode={currencyCode}
                />
              ))
            ) : (
              <div className="sale-detail-products-empty">{t('Товарів не знайдено')}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function SaleDetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="sale-detail-metric">
      <span>{label}</span>
      <OverflowTooltipText strong>{value}</OverflowTooltipText>
    </div>
  )
}

function OverflowTooltipText({
  children,
  className,
  strong = false,
}: {
  children: string
  className?: string
  strong?: boolean
}) {
  const textRef = useRef<HTMLElement | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const updateOverflow = useCallback(() => {
    const element = textRef.current

    setIsOverflowing(Boolean(element && element.scrollWidth > element.clientWidth + 1))
  }, [])

  const setTextRef = useCallback((node: HTMLElement | null) => {
    textRef.current = node
  }, [])

  useLayoutEffect(() => {
    updateOverflow()

    const element = textRef.current

    if (!element) {
      return undefined
    }

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOverflow)

    observer?.observe(element)
    window.addEventListener('resize', updateOverflow)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateOverflow)
    }
  }, [children, updateOverflow])

  const node = strong ? (
    <strong ref={setTextRef} className={className}>
      {children}
    </strong>
  ) : (
    <span ref={setTextRef} className={className}>
      {children}
    </span>
  )

  return (
    <Tooltip disabled={!isOverflowing || children.trim().length === 0} label={children} openDelay={350} withArrow>
      {node}
    </Tooltip>
  )
}

function SaleDetailSection({
  icon,
  rows,
  title,
}: {
  icon: ReactNode
  rows: Array<[string, unknown]>
  title: string
}) {
  return (
    <section className="sale-detail-info-section">
      <div className="sale-detail-section-header">
        <span className="sale-detail-section-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <Text className="sale-detail-section-title">{title}</Text>
        </div>
      </div>

      <div className="sale-detail-rows">
        {rows.map(([label, value]) => (
          <div key={label} className="sale-detail-row">
            <span>{label}</span>
            <OverflowTooltipText strong>{displayValue(value)}</OverflowTooltipText>
          </div>
        ))}
      </div>
    </section>
  )
}

function SaleDetailProductRow({
  currencyCode,
  item,
}: {
  currencyCode: string
  item: SalesOnlineShopOrderItem
}) {
  const amount = getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)

  return (
    <div className="sale-detail-product-row">
      <div className="sale-detail-product-name">
        <span className="sale-detail-product-icon" aria-hidden="true">
          <IconTag size={14} />
        </span>
        <div className="sale-detail-product-copy">
          <OverflowTooltipText className="sale-detail-product-title">
            {displayValue(getOrderItemProductName(item))}
          </OverflowTooltipText>
          <OverflowTooltipText className="sale-detail-product-subtitle">
            {displayValue(getOrderItemProductCode(item))}
          </OverflowTooltipText>
        </div>
      </div>
      <span className="sale-detail-product-value">{displayValue(getNumber(item.Qty))}</span>
      <span className="sale-detail-product-value">{formatAmount(getNumber(item.PricePerItem))}</span>
      <span className="sale-detail-product-amount">
        {formatAmount(amount)} <small>{displayValue(currencyCode)}</small>
      </span>
    </div>
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

function getSaleClientDisplayName(sale: SalesOnlineShopSale): string {
  const baseName = getSaleClientName(sale)
  const root = (sale.ClientAgreement?.Client as SalesOnlineShopClientWithRoot | undefined)?.RootClient
  const rootName =
    root?.FullName?.trim()
    || [root?.LastName, root?.FirstName].filter(Boolean).join(' ').trim()

  return [rootName, baseName].filter(Boolean).join(' / ') || baseName
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

function resolveRealtimeSale(payload: unknown): { NetUid?: string; SaleNumber?: { Value?: string } } | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as { Sale?: unknown }
  const sale = record.Sale && typeof record.Sale === 'object' ? record.Sale : payload

  return sale as { NetUid?: string; SaleNumber?: { Value?: string } }
}

function getSaleStatusLabel(sale: SalesOnlineShopSale): string {
  const statusKey = getSaleStatusKey(sale)

  return translate(STATUS_LABELS[statusKey] || sale.BaseLifeCycleStatus?.Name || displayValue(statusKey))
}

function getPaymentStatusLabel(sale: SalesOnlineShopSale): string {
  const key = getStatusTypeKey(sale.BaseSalePaymentStatus?.SalePaymentStatusType)

  return translate(PAYMENT_STATUS_LABELS[key] || sale.BaseSalePaymentStatus?.Name || '')
}

function isUnpaidSale(sale: SalesOnlineShopSale): boolean {
  return isStatusType(sale.BaseSalePaymentStatus?.SalePaymentStatusType, 0)
}

function getPaymentStatusColor(sale: SalesOnlineShopSale): string | undefined {
  switch (getStatusTypeKey(sale.BaseSalePaymentStatus?.SalePaymentStatusType)) {
    case '0':
      return 'red'
    case '1':
      return 'green'
    case '3':
      return 'orange'
    default:
      return undefined
  }
}

function getPaymentStatusTone(sale: SalesOnlineShopSale): string {
  switch (getStatusTypeKey(sale.BaseSalePaymentStatus?.SalePaymentStatusType)) {
    case '0':
      return 'danger'
    case '1':
    case '2':
      return 'success'
    case '3':
      return 'warning'
    case '4':
      return 'info'
    default:
      return 'neutral'
  }
}

function getRetailPaymentSuffix(sale: SalesOnlineShopSale): string {
  if (!sale.RetailClient) {
    return ''
  }

  return sale.IsFullPayment ? ' (ПО)' : ' (ЧО)'
}

function getSaleCurrencyCode(sale: SalesOnlineShopSale): string {
  return sale.ClientAgreement?.Agreement?.Currency?.Code || ''
}

function isNonVatEurAgreement(sale: SalesOnlineShopSale): boolean {
  return !sale.ClientAgreement?.Agreement?.WithVATAccounting && getSaleCurrencyCode(sale) === 'EUR'
}

function getSecondaryAmount(sale: SalesOnlineShopSale): number | null {
  return isNonVatEurAgreement(sale) ? getNumber(sale.TotalAmountEurToUah) : getNumber(sale.TotalAmount)
}

function getSecondaryAmountCode(sale: SalesOnlineShopSale): string {
  return isNonVatEurAgreement(sale) ? 'UAH' : 'EUR'
}

function isNewOrPackagingStatus(sale: SalesOnlineShopSale): boolean {
  const status = sale.BaseLifeCycleStatus?.SaleLifeCycleType

  return isStatusType(status, 0) || isStatusType(status, 1)
}

function getStatusTypeKey(value: number | string | null | undefined): string {
  return value === null || typeof value === 'undefined' ? '' : String(value)
}

function isStatusType(value: number | string | null | undefined, expected: number): boolean {
  return getStatusTypeKey(value) === String(expected)
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

function getSaleTransporterName(sale: SalesOnlineShopSale): string {
  return sale.Transporter?.Name || sale.Transporter?.Title || ''
}

function getSaleDeliveryAddress(sale: SalesOnlineShopSale): string {
  const address = (sale as SalesOnlineShopSaleWithDelivery).DeliveryRecipientAddress

  return [address?.City, address?.Department, address?.Value].filter(Boolean).join(', ')
}

function SaleSourceIcon({ sale }: { sale: SalesOnlineShopSale }) {
  const { t } = useI18n()
  const source = sale.Order?.OrderSource
  const lifecycleStatusKey = getSaleStatusKey(sale)
  const isInvoiceStage = lifecycleStatusKey === 'Packaging' || lifecycleStatusKey === 'Packaged'

  const indicator =
    source === 0
      ? { icon: <IconBrandEdge size={14} />, label: t('Інтернет-магазин') }
      : source === 2
        ? { icon: <IconTag size={14} />, label: t('Оферта') }
        : isInvoiceStage
          ? { icon: <IconFileInvoice size={14} />, label: t('Накладна') }
          : { icon: <IconReceipt2 size={14} />, label: t('Рахунок') }

  return (
    <Tooltip label={indicator.label}>
      <Box c="gray.6" style={{ display: 'inline-flex' }}>
        {indicator.icon}
      </Box>
    </Tooltip>
  )
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
