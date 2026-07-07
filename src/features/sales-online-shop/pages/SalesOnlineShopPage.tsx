import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Menu,
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
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconExternalLink,
  IconFileInvoice,
  IconEye,
  IconHistory,
  IconInfoCircle,
  IconLock,
  IconLockOpen,
  IconPencil,
  IconPercentage,
  IconPrinter,
  IconReceipt,
  IconReceipt2,
  IconRestore,
  IconSearch,
  IconTag,
  IconTruckDelivery,
} from '@tabler/icons-react'
import {
  Fragment,
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
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { TransporterLogo } from '../../../shared/ui/TransporterLogo'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { SaleAuditDetail, getSaleStatisticBySaleId, type SaleAuditStatistic } from '../../../shared/sale-audit'
import { UserRoleType } from '../../../shared/auth/types'
import '../../sales-ukraine/pages/sales-grid.css'
import '../../sales-ukraine/pages/sale-detail-sheet.css'
import { useAuth } from '../../auth/useAuth'
import { getSaleById, unlockSale, updateSale } from '../../sales-ukraine/api/salesUkraineApi'
import { ConsignmentNoteSettingsDrawer } from '../../sales-ukraine/components/ConsignmentNoteSettingsDrawer'
import { SaleDetailsDrawer } from '../../sales-ukraine/components/SaleDetailsDrawer'
import { SaleDiscountModal } from '../../sales-ukraine/components/SaleDiscountModal'
import { SaleDocumentsMenu } from '../../sales-ukraine/components/SaleDocumentsMenu'
import { SaleEditorDrawer } from '../../sales-ukraine/components/SaleEditorDrawer'
import { SaleExpandContent } from '../../sales-ukraine/components/SaleExpandContent'
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
  Packaged: 'orange',
  Packaging: 'orange',
  Received: 'teal',
  Shipping: 'cyan',
  TransporterChanged: 'blue',
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
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [sales, setSales] = useValueState<SalesOnlineShopSale[]>([])
  const [expandedKeys, setExpandedKeys] = useValueState<Set<string>>(() => new Set())
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

  const ensureSaleDetails = useCallback(
    async (sale: SalesOnlineShopSale): Promise<SalesOnlineShopSale | null> => {
      if (!needsSaleDetails(sale)) {
        return sale
      }

      if (!sale.NetUid) {
        return sale
      }

      try {
        const next = await getSaleById(sale.NetUid)

        if (!next) {
          return sale
        }

        const onlineSale = { ...(next as unknown as SalesOnlineShopSale), TotalRowsQty: sale.TotalRowsQty }
        setSales((current) => replaceSaleInList(current, onlineSale))

        return onlineSale
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продаж'))

        return null
      }
    },
    [setError, setSales, t],
  )

  const openSaleSheet = useCallback(
    async (sale: SalesOnlineShopSale) => {
      const next = await ensureSaleDetails(sale)

      if (next) {
        setSelectedSale(next)
      }
    },
    [ensureSaleDetails, setSelectedSale],
  )

  const openSaleDiscount = useCallback(
    async (sale: SalesOnlineShopSale) => {
      const next = await ensureSaleDetails(sale)

      if (next) {
        setDiscountSale(next)
      }
    },
    [ensureSaleDetails, setDiscountSale],
  )

  const toggleSaleExpand = useCallback(
    async (key: string, sale: SalesOnlineShopSale) => {
      if (expandedKeys.has(key)) {
        setExpandedKeys((current) => {
          const next = new Set(current)
          next.delete(key)

          return next
        })

        return
      }

      const nextSale = await ensureSaleDetails(sale)

      if (!nextSale) {
        return
      }

      setExpandedKeys((current) => {
        const next = new Set(current)
        next.add(key)

        return next
      })
    },
    [ensureSaleDetails, expandedKeys, setExpandedKeys],
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

      const netId = sale.NetUid

      setConfirmState({
        confirmLabel: t('Підтвердити'),
        message: t('Позначити, що замовлення не буде відвантажено?'),
        title: t('Не буде відвантажено'),
        onConfirm: async () => {
          const hydrated = await getSaleById(netId)

          if (!hydrated) {
            throw new Error(t('Не вдалося завантажити продаж'))
          }

          await updateSale({ ...hydrated, IsAcceptedToPacking: true })
          notifications.show({ color: 'green', message: t('Збережено') })
        },
      })
    },
    [setConfirmState, t],
  )

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
    <Stack className="sales-ukraine-page" gap="lg">
      <Card className="sales-ukraine-card" withBorder radius="md" padding={0}>
        <Stack className="sales-ukraine-content" gap={0}>
          <div className="sales-filter-bar">
            <div className="sales-filter-row sales-online-filter-row">
              <TextInput
                className="sales-filter-search"
                label={t('Пошук')}
                leftSection={<IconSearch size={16} />}
                placeholder={t('Товар або номер продажу')}
                value={filterDraft.value}
                onChange={(event) => applyFilters({ ...filterDraft, value: event.currentTarget.value })}
              />
              <TextInput
                className="sales-filter-control"
                label={t('З')}
                max={filterDraft.to || undefined}
                type="date"
                value={filterDraft.from}
                onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
              />
              <TextInput
                className="sales-filter-control"
                label={t('По')}
                min={filterDraft.from || undefined}
                type="date"
                value={filterDraft.to}
                onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
              />
              <Select
                allowDeselect={false}
                className="sales-filter-control"
                data={STATUS_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                label={t('Статус')}
                value={filterDraft.status}
                onChange={(value) =>
                  applyFilters({
                    ...filterDraft,
                    status: (value as SalesOnlineShopStatusFilter | null) || 'all',
                  })
                }
              />
              <Select
                allowDeselect={false}
                className="sales-filter-control"
                data={[
                  { value: 'All', label: t('Усі менеджери') },
                  { value: 'Self', label: t('Тільки мої') },
                ]}
                label={t('Менеджер')}
                value={filterDraft.onlyMine ? 'Self' : 'All'}
                onChange={(value) =>
                  applyFilters({
                    ...filterDraft,
                    onlyMine: ((value as SalesOnlineShopUserFilter | null) || 'All') === 'Self',
                  })
                }
              />
              <div className="app-filter-actions sales-filter-actions">
                <Tooltip label={t('Скинути')}>
                  <ActionIcon
                    aria-label={t('Скинути')}
                    className="sales-filter-reset"
                    color="gray"
                    size={34}
                    variant="light"
                    onClick={resetFilters}
                  >
                    <IconRestore size={17} />
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
                  }}
                  onRefresh={() => reload()}
                />
              </div>
            </div>
          </div>

          {error && (
            <Alert className="sales-grid-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <div className="sales-grid sales-online-grid">
            {isLoading ? (
              <div className="sales-grid-skeleton" aria-label={t('Завантаження продажів')} aria-busy="true">
                {Array.from({ length: 10 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="sales-grid-row sales-grid-skeleton-row">
                    <span className="sales-grid-skeleton-line is-main" />
                    <span className="sales-grid-skeleton-line is-number" />
                    <span className="sales-grid-skeleton-line is-number" />
                    <span className="sales-grid-skeleton-line is-number" />
                    <span className="sales-grid-skeleton-line is-short" />
                    <span className="sales-grid-skeleton-line is-icon" />
                    <span className="sales-grid-skeleton-line is-short" />
                    <span className="sales-grid-skeleton-line is-short" />
                    <span className="sales-grid-skeleton-line is-status" />
                  </div>
                ))}
              </div>
            ) : sales.length === 0 ? (
              <div className="sales-grid-state">{t('Продажів не знайдено')}</div>
            ) : (
              <>
                <div className="sales-grid-head">
                  <span>{t('Продаж / клієнт')}</span>
                  <span>{t('Сума')}</span>
                  <span>{t('Дод. сума')}</span>
                  <span>{t('ПДВ')}</span>
                  <span>{t('Поз.')}</span>
                  <span>{t('Знижка')}</span>
                  <span>{t('Перевізник')}</span>
                  <span>{t('Документи')}</span>
                  <span>{t('Статус')}</span>
                </div>
                {sales.map((sale, index) => {
                  const key = String(sale.NetUid || sale.Id || index)
                  const canExpand = getOrderItemCount(sale) > 0
                  const isExpanded = expandedKeys.has(key)

                  return (
                    <Fragment key={key}>
                      <SalesOnlineShopGridRow
                        sale={sale}
                        canEditSale={canEditSale}
                        canUnlock={canUnlock}
                        canWillNotShip={canWillNotShip}
                        isAdmin={isAdmin}
                        canExpand={canExpand}
                        isExpanded={isExpanded}
                        onToggleExpand={() => void toggleSaleExpand(key, sale)}
                        onOpenSale={(target) => void openSaleSheet(target)}
                        onOpenEditor={setEditorSale}
                        onOpenDetails={setDetailsSale}
                        onOpenConsignment={setConsignmentSale}
                        onOpenAudit={openAudit}
                        onUnlock={requestUnlock}
                        onWillNotShip={requestWillNotShip}
                        onOpenDiscount={(target) => void openSaleDiscount(target)}
                      />
                      {isExpanded && (
                        <div className="sales-grid-expand">
                          <SaleExpandContent
                            sale={asUkraineSale(sale)}
                            onOpenItemDiscount={(targetSale) =>
                              void openSaleDiscount(targetSale as unknown as SalesOnlineShopSale)
                            }
                          />
                        </div>
                      )}
                    </Fragment>
                  )
                })}
              </>
            )}
          </div>
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
              <Button color={confirmState.color || 'orange'} loading={isConfirming} onClick={runConfirm}>
                {confirmState.confirmLabel}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>
    </Stack>
  )
}

type SalesOnlineShopGridRowProps = {
  sale: SalesOnlineShopSale
  canEditSale: boolean
  canUnlock: boolean
  canWillNotShip: boolean
  isAdmin: boolean
  canExpand: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onOpenSale: (sale: SalesOnlineShopSale) => void
  onOpenEditor: (sale: SalesOnlineShopSale) => void
  onOpenDetails: (sale: SalesOnlineShopSale) => void
  onOpenConsignment: (sale: SalesOnlineShopSale) => void
  onOpenAudit: (sale: SalesOnlineShopSale) => void
  onUnlock: (sale: SalesOnlineShopSale) => void
  onWillNotShip: (sale: SalesOnlineShopSale) => void
  onOpenDiscount: (sale: SalesOnlineShopSale) => void
}

function SalesOnlineShopGridRow({
  sale,
  canEditSale,
  canUnlock,
  canWillNotShip,
  isAdmin,
  canExpand,
  isExpanded,
  onToggleExpand,
  onOpenSale,
  onOpenEditor,
  onOpenDetails,
  onOpenConsignment,
  onOpenAudit,
  onUnlock,
  onWillNotShip,
  onOpenDiscount,
}: SalesOnlineShopGridRowProps) {
  const { t } = useI18n()
  const date = getSaleDate(sale)
  const clientName = getSaleClientDisplayName(sale)
  const retailClientLine = getRetailClientLine(sale)
  const manager = getSaleUserName(sale)
  const contract = sale.ClientAgreement?.Agreement?.Name
  const transporter = getSaleTransporterName(sale)
  const transporterImageUrl = getTransporterImageUrl(sale)
  const localAmount = getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount)
  const vat = getNumber(sale.Order?.TotalVat)
  const positions = getOrderItemCount(sale)
  const paymentColor = getPaymentStatusColor(sale)
  const lifecycleStatusKey = getSaleStatusKey(sale)
  const isPackaging = lifecycleStatusKey === 'Packaging' || lifecycleStatusKey === 'Packaged'
  const hidePrintBlock = Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking && !isAdmin
  const showTtn = Boolean(sale.TransporterId) && isPackaging && !hidePrintBlock
  const showWillNotShip = canWillNotShip && Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking
  const showUnlock = canUnlock && Boolean(sale.IsLocked)
  const showEdit = canEditSale && (sale.InputSaleMerges?.length ?? 0) === 0
  const showBang = Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking
  const bangClickable = Boolean(sale.ChangedToInvoice) && canWillNotShip
  const discountEditable = isNewOrPackagingStatus(sale) && positions > 0
  const openSale = () => onOpenSale(sale)

  return (
    <div
      className={`sales-grid-row${isExpanded ? ' is-expanded' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t('Відкрити продаж')}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('[data-row-stop]')) {
          openSale()
        }
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
          event.preventDefault()
          openSale()
        }
      }}
    >
      <div className="sg-client">
        <div className="sg-client-actions" data-row-stop="true">
          {showEdit && (
            <Tooltip label={t('Відкрити продаж')}>
              <ActionIcon aria-label={t('Відкрити продаж')} color="gray" size="sm" variant="subtle" onClick={() => onOpenEditor(sale)}>
                <IconPencil size={15} />
              </ActionIcon>
            </Tooltip>
          )}
          {showBang ? (
            <Tooltip label={t('Замовлення не буде відвантажено')}>
              {bangClickable ? (
                <button
                  className="sg-bang"
                  data-clickable="true"
                  type="button"
                  aria-label={t('Замовлення не буде відвантажено')}
                  style={{ opacity: 1 }}
                  onClick={() => onWillNotShip(sale)}
                >
                  !
                </button>
              ) : (
                <span className="sg-bang" style={{ opacity: sale.ChangedToInvoice ? 1 : 0.4 }}>
                  !
                </span>
              )}
            </Tooltip>
          ) : (
            <span className="sg-bang sg-bang-placeholder" aria-hidden="true" />
          )}
          {canExpand && (
            <Tooltip label={isExpanded ? t('Згорнути') : t('Розгорнути')}>
              <ActionIcon aria-label={t('Розгорнути')} color="gray" size="sm" variant="subtle" onClick={onToggleExpand}>
                {isExpanded ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
              </ActionIcon>
            </Tooltip>
          )}
        </div>

        <div className="sg-client-body">
          <div className="sg-client-name">
            {sale.MisplacedSaleId && (
              <Tooltip label={t('Часткова продажа')}>
                <Box c="red" style={{ display: 'inline-flex' }}>
                  <IconInfoCircle size={14} />
                </Box>
              </Tooltip>
            )}
            <Tooltip label={clientName} disabled={!clientName} multiline maw={360}>
              <span className="sg-client-name-text">{displayValue(clientName)}</span>
            </Tooltip>
            {sale.IsVatSale && (
              <Badge color="blue" size="xs" variant="light">
                {t('ПДВ')}
              </Badge>
            )}
            {sale.IsDevelopment && (
              <Badge color="orange" size="xs" variant="light">
                {t('Протокол')}
              </Badge>
            )}
          </div>

          <div className="sg-meta">
            <SaleSourceIcon sale={sale} />
            <span className="sg-meta-sale-number">{displayValue(sale.SaleNumber?.Value)}</span>
            {date && (
              <>
                <span className="sg-meta-sep">·</span>
                <span>
                  {formatDate(date)} {formatTime(date)}
                </span>
              </>
            )}
            {manager && (
              <>
                <span className="sg-meta-sep">·</span>
                <span>{manager}</span>
              </>
            )}
            {retailClientLine && (
              <>
                <span className="sg-meta-sep">·</span>
                <span>{retailClientLine}</span>
              </>
            )}
            {contract && (
              <>
                <span className="sg-meta-sep">:</span>
                <span className="sg-meta-contract">{contract}</span>
              </>
            )}
            {Array.isArray(sale.HistoryInvoiceEdit) && sale.HistoryInvoiceEdit.length > 0 && (
              <Tooltip label={t('Рахунок редаговано')}>
                <IconPencil size={12} style={{ color: 'var(--mantine-color-orange-6)' }} />
              </Tooltip>
            )}
            {sale.IsPrinted && (
              <Tooltip label={t('Документи надруковано')}>
                <IconPrinter size={12} style={{ color: 'var(--mantine-color-gray-5)' }} />
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <div className={`sg-amt${isUnpaidSale(sale) ? ' is-unpaid' : ''}`}>
        <span className="sg-amt-val">{formatAmount(localAmount)}</span>
        <span className="sg-amt-unit">{displayValue(getSaleCurrencyCode(sale))}</span>
      </div>
      <div className="sg-amt">
        <span className="sg-amt-val">{formatAmount(getSecondaryAmount(sale))}</span>
        <span className="sg-amt-unit">{getSecondaryAmountCode(sale)}</span>
      </div>
      <div className="sg-amt">
        <span className="sg-amt-val">{formatAmount(vat)}</span>
        <span className="sg-amt-unit">{t('ПДВ')}</span>
      </div>

      <div className="sg-positions">
        {positions} {t('поз.')}
      </div>

      <div className="sg-slot" data-row-stop="true">
        {discountEditable ? (
          <Tooltip label={t('Знижка')}>
            <ActionIcon aria-label={t('Знижка')} color="gray" size="sm" variant="subtle" onClick={() => onOpenDiscount(sale)}>
              <IconPercentage size={15} />
            </ActionIcon>
          </Tooltip>
        ) : sale.IsLocked ? (
          <Tooltip label={t('Заблоковано')}>
            <IconLock size={14} style={{ color: 'var(--mantine-color-gray-5)' }} />
          </Tooltip>
        ) : null}
      </div>

      <div className="sg-transporter-cell" data-row-stop="true">
        <Tooltip label={transporter || t('Перевізник')}>
          <button
            className="sg-transporter-button"
            type="button"
            aria-label={transporter || t('Перевізник')}
            onClick={() => onOpenDetails(sale)}
          >
            <TransporterLogo className="sg-transporter-logo" imageUrl={transporterImageUrl} />
          </button>
        </Tooltip>
      </div>

      <div className="sg-doc-actions" data-row-stop="true">
        <Tooltip label={t('Деталі')}>
          <ActionIcon aria-label={t('Деталі')} color="gray" size="sm" variant="subtle" onClick={() => onOpenSale(sale)}>
            <IconEye size={15} />
          </ActionIcon>
        </Tooltip>
        {!hidePrintBlock && <SaleDocumentsMenu sale={asUkraineSale(sale)} />}
        <Menu position="bottom-end" shadow="md" withinPortal>
          <Menu.Target>
            <ActionIcon aria-label={t('Дії')} color="gray" size="sm" variant="subtle">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {showEdit && (
              <Menu.Item leftSection={<IconExternalLink size={16} />} onClick={() => onOpenEditor(sale)}>
                {t('Відкрити продаж')}
              </Menu.Item>
            )}
            <Menu.Item leftSection={<IconTruckDelivery size={16} />} onClick={() => onOpenDetails(sale)}>
              {t('Дані доставки')}
            </Menu.Item>
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
      </div>

      <div className="sg-status">
        <Badge color={STATUS_COLORS[getSaleStatusKey(sale)] || 'gray'} size="sm" variant="light">
          {getSaleStatusLabel(sale)}
        </Badge>
        <span
          className="sg-status-pay"
          style={{ color: paymentColor ? `var(--mantine-color-${paymentColor}-6)` : undefined }}
        >
          {displayValue(`${getPaymentStatusLabel(sale)}${getRetailPaymentSuffix(sale)}`)}
        </span>
      </div>
    </div>
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

  const commitOverflow = useCallback((nextOverflowing: boolean) => {
    setIsOverflowing((currentOverflowing) =>
      currentOverflowing === nextOverflowing ? currentOverflowing : nextOverflowing,
    )
  }, [])
  const measureOverflow = useCallback(() => {
    const element = textRef.current

    commitOverflow(Boolean(element && element.scrollWidth > element.clientWidth + 1))
  }, [commitOverflow])

  const setTextRef = useCallback((node: HTMLElement | null) => {
    textRef.current = node
  }, [])

  useLayoutEffect(() => {
    let animationFrameId = 0
    const scheduleMeasure = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0
        measureOverflow()
      })
    }

    scheduleMeasure()

    const element = textRef.current

    if (!element) {
      return () => {
        if (animationFrameId) {
          window.cancelAnimationFrame(animationFrameId)
        }
      }
    }

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure)

    observer?.observe(element)
    window.addEventListener('resize', scheduleMeasure)

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }

      observer?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [children, measureOverflow])

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
  const qty = getNumber(item.Qty)
  const unitPrice = amount != null && qty ? amount / qty : null

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
      <span className="sale-detail-product-value">{displayValue(qty)}</span>
      <span className="sale-detail-product-value">{formatAmount(unitPrice)}</span>
      <span className="sale-detail-product-amount">
        {formatAmount(amount)} <small>{displayValue(currencyCode)}</small>
      </span>
    </div>
  )
}

function getTotalRows(sales: SalesOnlineShopSale[]): number {
  for (const sale of sales) {
    const total = getNumber(sale.TotalRowsQty)

    if (total) {
      return total
    }
  }

  return sales.length
}

function getSaleDate(sale: SalesOnlineShopSale): Date | null {
  return parseDate(sale.ChangedToInvoice || sale.Updated || sale.Created || sale.FromDate)
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
  return sale.Order?.OrderItems?.length || getNumber(sale.TotalPositions) || 0
}

function needsSaleDetails(sale: SalesOnlineShopSale): boolean {
  return sale.HasDetails === false
}

function replaceSaleInList(sales: SalesOnlineShopSale[], nextSale: SalesOnlineShopSale): SalesOnlineShopSale[] {
  return sales.map((sale) => (isSameSale(sale, nextSale) ? nextSale : sale))
}

function isSameSale(left: SalesOnlineShopSale, right: SalesOnlineShopSale): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  return Boolean(left.Id && right.Id && left.Id === right.Id)
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

function getTransporterImageUrl(sale: SalesOnlineShopSale): string {
  if (sale.Transporter?.CssClass === 'self_checkout_item_class') {
    return ''
  }

  return sale.Transporter?.ImageUrl?.trim() || ''
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
    return Number.isFinite(value) ? String(value) : ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  return ''
}
