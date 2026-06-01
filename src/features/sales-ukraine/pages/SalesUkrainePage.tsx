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
  Loader,
  Menu,
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
  IconArrowsLeftRight,
  IconBrandEdge,
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconExternalLink,
  IconEye,
  IconFileInvoice,
  IconHistory,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconReceipt2,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTag,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { SaleAuditDetail, getSaleStatisticBySaleId, type SaleAuditStatistic } from '../../../shared/sale-audit'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import { UserRoleType } from '../../../shared/auth/types'
import {
  getSalesUkraine,
  getSalesUkraineOrganizations,
  searchSalesUkraineClients,
  unlockSale,
  updateSale,
} from '../api/salesUkraineApi'
import { ConsignmentNoteSettingsDrawer } from '../components/ConsignmentNoteSettingsDrawer'
import { NewSaleModal } from '../components/NewSaleModal'
import { SaleEditDrawer } from '../components/SaleEditDrawer'
import { SaleEditorDrawer } from '../components/SaleEditorDrawer'
import { SaleDetailsDrawer } from '../components/SaleDetailsDrawer'
import { SaleDiscountModal } from '../components/SaleDiscountModal'
import { SaleExpandContent } from '../components/SaleExpandContent'
import { SaleDocumentsMenu } from '../components/SaleDocumentsMenu'
import {
  SALES_UKRAINE_EDIT_PERMISSION,
  SALES_UKRAINE_UNLOCK_PERMISSION,
  SALES_UKRAINE_WILL_NOT_SHIP_PERMISSION,
} from '../permissions'
import type {
  SalesUkraineClientOption,
  SalesUkraineFilters,
  SalesUkraineOrderItem,
  SalesUkraineOrganizationOption,
  SalesUkraineSale,
  SalesUkraineStatusFilter,
  SalesUkraineUserFilter,
} from '../types'
import './salesUkraine.css'

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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  0: 'Неоплаченно',
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
  const { hasPermission, user } = useAuth()
  const isAdmin =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const canEditSale = hasPermission(SALES_UKRAINE_EDIT_PERMISSION)
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
  const [discountTarget, setDiscountTarget] = useValueState<{
    orderItem?: SalesUkraineOrderItem
    sale: SalesUkraineSale
  } | null>(null)
  const [detailsSale, setDetailsSale] = useValueState<SalesUkraineSale | null>(null)
  const [consignmentSale, setConsignmentSale] = useValueState<SalesUkraineSale | null>(null)
  const [editorSale, setEditorSale] = useValueState<SalesUkraineSale | null>(null)
  const [editShiftSale, setEditShiftSale] = useValueState<SalesUkraineSale | null>(null)
  const [auditSale, setAuditSale] = useValueState<SalesUkraineSale | null>(null)
  const [auditStatistic, setAuditStatistic] = useValueState<SaleAuditStatistic | null>(null)
  const [auditLoading, setAuditLoading] = useValueState(false)
  const [auditError, setAuditError] = useValueState<string | null>(null)
  const auditRequestRef = useRef(0)
  const [isNewSaleOpen, setNewSaleOpen] = useValueState(false)
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

  const openAudit = useCallback(
    (sale: SalesUkraineSale) => {
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

  function closeAudit() {
    auditRequestRef.current += 1
    setAuditSale(null)
    setAuditStatistic(null)
    setAuditError(null)
    setAuditLoading(false)
  }

  const realtimeReloadRef = useRef<number | null>(null)
  const backgroundReloadRef = useRef(false)
  const salesRef = useRef<SalesUkraineSale[]>(sales)

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

  const saleHandlers: SaleRowHandlers = {
    canEditSale,
    canUnlock,
    canWillNotShip,
    isAdmin,
    onOpenAudit: openAudit,
    onOpenConsignment: setConsignmentSale,
    onOpenDetails: setDetailsSale,
    onOpenEditor: setEditorSale,
    onOpenEditShift: setEditShiftSale,
    onOpenDiscount: (sale: SalesUkraineSale) => setDiscountTarget({ sale }),
    onOpenSale: setSelectedSale,
    onUnlock: requestUnlock,
    onWillNotShip: requestWillNotShip,
  }

  const renderSaleExpandContent = useCallback(
    (sale: SalesUkraineSale) => (
      <SaleExpandContent
        sale={sale}
        onOpenItemDiscount={(targetSale, orderItem) => setDiscountTarget({ orderItem, sale: targetSale })}
      />
    ),
    [setDiscountTarget],
  )

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
      const isBackgroundReload = backgroundReloadRef.current
      backgroundReloadRef.current = false

      if (!isBackgroundReload) {
        setLoading(true)
        setError(null)
      }

      try {
        const next = await getSalesUkraine(activeFilters)

        if (!cancelled) {
          setSales(next)

          if (isBackgroundReload) {
            setError(null)
          }
        }
      } catch (loadError) {
        if (!cancelled && !isBackgroundReload) {
          setSales([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі'))
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
      <Group justify="space-between" align="center">
        <Button color="violet" leftSection={<IconPlus size={16} />} onClick={() => setNewSaleOpen(true)}>
          {t('Новий продаж')}
        </Button>
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
            getRowCanExpand={(sale) => getOrderItemCount(sale) > 0}
            renderExpandedRow={renderSaleExpandContent}
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
        orderItem={discountTarget?.orderItem}
        sale={discountTarget?.sale ?? null}
        onClose={() => setDiscountTarget(null)}
        onSaved={() => {
          setDiscountTarget(null)
          reload()
        }}
      />

      <SaleDetailsDrawer
        sale={detailsSale}
        onClose={() => setDetailsSale(null)}
        onSaved={() => {
          setDetailsSale(null)
          reload()
        }}
      />

      <ConsignmentNoteSettingsDrawer
        opened={Boolean(consignmentSale)}
        sale={consignmentSale}
        onClose={() => setConsignmentSale(null)}
      />

      <SaleEditorDrawer sale={editorSale} onClose={() => setEditorSale(null)} />

      <SaleEditDrawer
        sale={editShiftSale}
        onClose={() => setEditShiftSale(null)}
        onSaved={() => {
          setEditShiftSale(null)
          reload()
        }}
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

      <NewSaleModal
        opened={isNewSaleOpen}
        onClose={() => setNewSaleOpen(false)}
        onCreated={(sale) => {
          setNewSaleOpen(false)
          setEditorSale(sale)
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
  canEditSale,
  canUnlock,
  canWillNotShip,
  isAdmin,
  onOpenAudit,
  onOpenConsignment,
  onOpenDetails,
  onOpenDiscount,
  onOpenEditor,
  onOpenEditShift,
  onOpenSale,
  onUnlock,
  onWillNotShip,
}: {
  canEditSale: boolean
  canUnlock: boolean
  canWillNotShip: boolean
  isAdmin: boolean
  onOpenAudit: (sale: SalesUkraineSale) => void
  onOpenConsignment: (sale: SalesUkraineSale) => void
  onOpenDetails: (sale: SalesUkraineSale) => void
  onOpenDiscount: (sale: SalesUkraineSale) => void
  onOpenEditor: (sale: SalesUkraineSale) => void
  onOpenEditShift: (sale: SalesUkraineSale) => void
  onOpenSale: (sale: SalesUkraineSale) => void
  onUnlock: (sale: SalesUkraineSale) => void
  onWillNotShip: (sale: SalesUkraineSale) => void
}

function SaleRowActions({ sale, handlers }: { sale: SalesUkraineSale; handlers: SaleRowHandlers }) {
  const { t } = useI18n()
  const lifeCycleType = sale.BaseLifeCycleStatus?.SaleLifeCycleType
  const isPackaging = lifeCycleType === 1 || lifeCycleType === 2
  const hidePrintBlock = Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking && !handlers.isAdmin
  const showTtn = Boolean(sale.TransporterId) && isPackaging && !hidePrintBlock
  const showWillNotShip = handlers.canWillNotShip && Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking
  const showUnlock = handlers.canUnlock && Boolean(sale.IsLocked)
  const showEdit = handlers.canEditSale && (sale.InputSaleMerges?.length ?? 0) === 0

  return (
    <Box onClick={(event) => event.stopPropagation()}>
      <Group gap={2} justify="flex-end" wrap="nowrap">
        <Tooltip label={t('Деталі')}>
          <ActionIcon aria-label={t('Деталі')} color="gray" variant="subtle" onClick={() => handlers.onOpenSale(sale)}>
            <IconEye size={18} />
          </ActionIcon>
        </Tooltip>
        {!hidePrintBlock && <SaleDocumentsMenu sale={sale} />}
        <Menu position="bottom-end" shadow="md" withinPortal>
          <Menu.Target>
            <ActionIcon aria-label={t('Дії')} color="gray" variant="subtle">
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {showEdit && (
              <Menu.Item leftSection={<IconExternalLink size={16} />} onClick={() => handlers.onOpenEditor(sale)}>
                {t('Відкрити продаж')}
              </Menu.Item>
            )}
            {showTtn && (
              <Menu.Item leftSection={<IconReceipt size={16} />} onClick={() => handlers.onOpenConsignment(sale)}>
                {t('Друк ТТН')}
              </Menu.Item>
            )}
            {showWillNotShip && (
              <Menu.Item
                color="orange"
                disabled={!sale.ChangedToInvoice}
                leftSection={<IconAlertTriangle size={16} />}
                onClick={() => handlers.onWillNotShip(sale)}
              >
                {t('Не буде відвантажено')}
              </Menu.Item>
            )}
            {showUnlock && (
              <Menu.Item color="red" leftSection={<IconLockOpen size={16} />} onClick={() => handlers.onUnlock(sale)}>
                {t('Розблокувати')}
              </Menu.Item>
            )}
            <Menu.Item leftSection={<IconHistory size={16} />} onClick={() => handlers.onOpenAudit(sale)}>
              {t('Історія редагувань')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Box>
  )
}

function SaleListRow({ sale, handlers }: { sale: SalesUkraineSale; handlers: SaleRowHandlers }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const unpaid = isUnpaidSale(sale)
  const date = getSaleDate(sale)
  const showEdit = handlers.canEditSale && (sale.InputSaleMerges?.length ?? 0) === 0
  const discount = getNumber(sale.Order?.OrderItems?.[0]?.OneTimeDiscount)

  return (
    <Box className="sale-row">
      <Group
        gap="sm"
        wrap="nowrap"
        align="flex-start"
        className="sale-row-main"
        onClick={() => handlers.onOpenSale(sale)}
      >
        <Group gap={4} wrap="nowrap" align="center" style={{ flex: '0 0 auto' }} onClick={(event) => event.stopPropagation()}>
          {showEdit ? (
            <Tooltip label={t('Відкрити продаж')}>
              <ActionIcon aria-label={t('Відкрити продаж')} color="gray" variant="subtle" onClick={() => handlers.onOpenEditor(sale)}>
                <IconExternalLink size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <ActionIcon aria-label={t('Деталі')} color="gray" variant="subtle" onClick={() => handlers.onOpenSale(sale)}>
              <IconEye size={18} />
            </ActionIcon>
          )}
          {orderItems.length > 0 && (
            <ActionIcon aria-label={t('Позиції')} color="gray" variant="subtle" onClick={() => setExpanded((value) => !value)}>
              {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          )}
        </Group>

        <Stack gap={2} style={{ flex: '1 1 auto', minWidth: 0 }}>
          <Group gap={6} wrap="wrap" align="center">
            <SaleSourceIcon sale={sale} />
            <Text fw={700}>{displayValue(sale.SaleNumber?.Value)}</Text>
            <Text fw={600} lineClamp={1}>{displayValue(getSaleClientName(sale))}</Text>
            {sale.IsVatSale && <Badge color="violet" size="xs" variant="light">{t('ПДВ')}</Badge>}
            {sale.IsDevelopment && <Badge color="grape" size="xs" variant="light">{t('Протокол')}</Badge>}
            {Array.isArray(sale.HistoryInvoiceEdit) && sale.HistoryInvoiceEdit.length > 0 && (
              <Tooltip label={t('Рахунок редаговано')}><IconPencil size={14} style={{ color: 'var(--mantine-color-orange-6)' }} /></Tooltip>
            )}
            {sale.IsPrinted && (
              <Tooltip label={t('Документи надруковано')}><IconPrinter size={14} style={{ color: 'var(--mantine-color-gray-5)' }} /></Tooltip>
            )}
          </Group>
          <Group gap={8} wrap="wrap">
            <Text size="xs" c="dimmed">{displayValue(formatDate(date))} {displayValue(formatTime(date))}</Text>
            <Text size="xs" c="dimmed">· {displayValue(getSaleUserName(sale))}</Text>
            {sale.ClientAgreement?.Agreement?.Name && (
              <Text size="xs" c="dimmed">· {displayValue(sale.ClientAgreement.Agreement.Name)}</Text>
            )}
            {isNewOrPackagingStatus(sale) && (
              <Anchor component="button" type="button" size="xs" onClick={(event) => { event.stopPropagation(); handlers.onOpenDiscount(sale) }}>
                {discount ? `${t('Знижка')} ${amountFormatter.format(discount)} %` : t('Знижка')}
              </Anchor>
            )}
          </Group>
        </Stack>

        <Group gap="lg" wrap="nowrap" align="center" style={{ flex: '0 0 auto' }}>
          <div className="sale-row-amount">
            <Text fw={700} c={unpaid ? 'red' : undefined}>{formatAmount(getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount))}</Text>
            <Text size="xs" c={unpaid ? 'red' : 'dimmed'}>{displayValue(getSaleCurrencyCode(sale))}</Text>
          </div>
          <div className="sale-row-amount">
            <Text>{formatAmount(getSecondaryAmount(sale))}</Text>
            <Text size="xs" c="dimmed">{getSecondaryAmountCode(sale)}</Text>
          </div>
          <div className="sale-row-amount">
            <Text>{formatAmount(getNumber(sale.Order?.TotalVat))}</Text>
            <Text size="xs" c="dimmed">{t('ПДВ')}</Text>
          </div>
          <div className="sale-row-amount">
            <Text>{displayValue(getOrderItemCount(sale))}</Text>
            <Text size="xs" c="dimmed">{t('поз.')}</Text>
          </div>
          {sale.IsLocked && (
            <Tooltip label={t('Заблоковано')}><IconLock size={16} style={{ color: 'var(--mantine-color-gray-5)' }} /></Tooltip>
          )}
          <SaleRowActions sale={sale} handlers={handlers} />
          <Stack gap={0} align="flex-end" style={{ minWidth: 96 }}>
            <Badge color={STATUS_COLORS[getSaleStatusKey(sale)] || 'gray'} variant="light">
              {getSaleStatusLabel(sale)}
            </Badge>
            <Text size="xs" c={getPaymentStatusColor(sale) || 'dimmed'} fw={getPaymentStatusColor(sale) ? 600 : undefined}>
              {displayValue(`${getPaymentStatusLabel(sale)}${getRetailPaymentSuffix(sale)}`)}
            </Text>
          </Stack>
        </Group>
      </Group>

          return (
            <>
              <Text c={unpaid ? 'red' : undefined} fw={600}>
                {formatAmount(getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount))}
              </Text>
              <Text c={unpaid ? 'red' : 'dimmed'} size="xs">
                {displayValue(getSaleCurrencyCode(sale))}
              </Text>
            </>
          )
        },
      },
      {
        id: 'amountEur',
        header: t('Екв.'),
        width: 124,
        minWidth: 112,
        align: 'right',
        accessor: (sale) => getSecondaryAmount(sale),
        cell: (sale) => (
          <>
            <Text>{formatAmount(getSecondaryAmount(sale))}</Text>
            <Text size="xs" c="dimmed">
              {getSecondaryAmountCode(sale)}
            </Text>
          </>
        ),
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
          const items = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
          const firstDiscount = getNumber(items[0]?.OneTimeDiscount)
          const text = firstDiscount ? `${amountFormatter.format(firstDiscount)} %` : '—'

          if (!isNewOrPackagingStatus(sale) || items.length === 0) {
            return text
          }

          const discounts = items.map((item) => getNumber(item.OneTimeDiscount) ?? 0)
          const hasUniformDiscount = discounts[0] !== 0 && discounts.every((value) => value === discounts[0])
          const allPositive = discounts.every((value) => value > 0)

          if (hasUniformDiscount) {
            return (
              <Anchor
                component="button"
                fw={600}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenDiscount(sale)
                }}
              >
                {`${amountFormatter.format(discounts[0])} %`}
              </Anchor>
            )
          }

          if (allPositive) {
            const average = Math.round((discounts.reduce((sum, value) => sum + value, 0) / discounts.length) * 100) / 100

            return <Text span>{`${amountFormatter.format(average)} %`}</Text>
          }

          const lifeCycleType = sale.BaseLifeCycleStatus?.SaleLifeCycleType

          if (lifeCycleType === 1 || lifeCycleType === 2) {
            return '—'
          }

          return (
            <Anchor
              component="button"
              fw={400}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenDiscount(sale)
              }}
            >
              {t('Знижка')}
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
        width: 170,
        minWidth: 130,
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
          const showEditShift = showEdit && getOrderItemCount(sale) > 0

          return (
            <Box onClick={(event) => event.stopPropagation()}>
              <Group gap={2} justify="center" wrap="nowrap">
                <Tooltip label={t('Деталі')}>
                  <ActionIcon aria-label={t('Деталі')} color="gray" variant="subtle" onClick={() => onOpenSale(sale)}>
                    <IconEye size={18} />
                  </ActionIcon>
                </Tooltip>
                {!hidePrintBlock && <SaleDocumentsMenu sale={sale} />}
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
                    {showEditShift && (
                      <Menu.Item leftSection={<IconArrowsLeftRight size={16} />} onClick={() => onOpenEditShift(sale)}>
                        {lifeCycleType === 0 ? t('Акт редагування рахунку') : t('Акт редагування накладної')}
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
      onOpenEditShift,
      onOpenSale,
      onUnlock,
      onWillNotShip,
      t,
    ],
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
          <Badge color="violet" variant="light">
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

function resolveRealtimeSale(payload: unknown): { NetUid?: string; SaleNumber?: { Value?: string } } | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as { Sale?: unknown }
  const sale = record.Sale && typeof record.Sale === 'object' ? record.Sale : payload

  return sale as { NetUid?: string; SaleNumber?: { Value?: string } }
}

function SaleSourceIcon({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const source = sale.Order?.OrderSource
  const lifeCycleType = sale.BaseLifeCycleStatus?.SaleLifeCycleType
  const isInvoiceStage = lifeCycleType === 1 || lifeCycleType === 2

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

function getSaleStatusLabel(sale: SalesUkraineSale): string {
  const statusKey = getSaleStatusKey(sale)
  const label = translate(STATUS_LABELS[statusKey] || sale.BaseLifeCycleStatus?.Name || displayValue(statusKey))

  return sale.IsVatSale ? `(${translate('ПДВ')}) ${label}` : label
}

function getPaymentStatusLabel(sale: SalesUkraineSale): string {
  const status = sale.BaseSalePaymentStatus?.SalePaymentStatusType
  const key = typeof status === 'undefined' || status === null ? '' : String(status)

  return translate(PAYMENT_STATUS_LABELS[key] || sale.BaseSalePaymentStatus?.Name || '')
}

function isUnpaidSale(sale: SalesUkraineSale): boolean {
  return sale.BaseSalePaymentStatus?.SalePaymentStatusType === 0
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

function isNonVatEurAgreement(sale: SalesUkraineSale): boolean {
  return !sale.ClientAgreement?.Agreement?.WithVATAccounting && getSaleCurrencyCode(sale) === 'EUR'
}

function getSecondaryAmount(sale: SalesUkraineSale): number | null {
  return isNonVatEurAgreement(sale) ? getNumber(sale.TotalAmountEurToUah) : getNumber(sale.TotalAmount)
}

function getSecondaryAmountCode(sale: SalesUkraineSale): string {
  return isNonVatEurAgreement(sale) ? 'UAH' : 'EUR'
}

function isNewOrPackagingStatus(sale: SalesUkraineSale): boolean {
  const status = sale.BaseLifeCycleStatus?.SaleLifeCycleType

  return status === 0 || status === 1 || status === 2
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
    case 6:
      return 'All'
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
