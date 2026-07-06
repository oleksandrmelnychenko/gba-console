import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Menu,
  Popover,
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
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconLock,
  IconPercentage,
  IconFileInvoice,
  IconHistory,
  IconLockOpen,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconReceipt2,
  IconRestore,
  IconSearch,
  IconTag,
  IconTruckDelivery,
  IconX,
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
import { useSearchParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { TransporterLogo } from '../../../shared/ui/TransporterLogo'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { SaleAuditDetail } from '../../../shared/sale-audit/SaleAuditDetail'
import { getSaleStatisticBySaleId } from '../../../shared/sale-audit/saleAuditApi'
import type { SaleAuditStatistic } from '../../../shared/sale-audit/saleAuditTypes'
import './sales-grid.css'
import './sale-detail-sheet.css'
import { useAuth } from '../../auth/useAuth'
import { UserRoleType } from '../../../shared/auth/types'
import {
  getSaleById,
  getSalesUkraine,
  getSalesUkraineOrganizations,
  unlockSale,
  updateSale,
} from '../api/salesUkraineApi'
import { getAverageOneTimeDiscount, getUniformOneTimeDiscount } from '../saleDiscounts'
import { getSaleLifecycleStatusKey, getStatusTypeKey, isDiscountEditableSaleLifecycle, isStatusType } from '../saleStatus'
import { ConsignmentNoteSettingsDrawer } from '../components/ConsignmentNoteSettingsDrawer'
import { NewSaleWizard } from '../components/new-sale-wizard/NewSaleWizard'
import { SaleEditDrawer } from '../components/SaleEditDrawer'
import { SaleDetailsDrawer } from '../components/SaleDetailsDrawer'
import { SaleDiscountModal } from '../components/SaleDiscountModal'
import { SaleExpandContent } from '../components/SaleExpandContent'
import { SaleDocumentsMenu } from '../components/SaleDocumentsMenu'
import { SalesClientSearch } from '../components/SalesClientSearch'
import {
  SALES_UKRAINE_EDIT_PERMISSION,
  SALES_UKRAINE_UNLOCK_PERMISSION,
  SALES_UKRAINE_WILL_NOT_SHIP_PERMISSION,
} from '../permissions'
import type {
  SalesUkraineFilters,
  SalesUkraineOrderItem,
  SalesUkraineOrganizationOption,
  SalesUkraineSale,
  SalesUkraineStatusFilter,
  SalesUkraineUserFilter,
} from '../types'

type FilterDraft = {
  clientId: string
  forEcommerce: boolean
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
  New: 'orange', // Рахунок
  OrderClosed: 'gray',
  Packaged: 'green', // Накладна
  Packaging: 'green', // Накладна
  Received: 'teal',
  Shipping: 'cyan',
  TransporterChanged: 'blue',
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
  0: 'Неоплачено',
  1: 'Оплачено',
  2: 'Оплачено',
  3: 'Оплачено частково',
  4: 'Повернення',
}

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const compactPercentFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})

const SALES_FILTER_COMBOBOX_PROPS = {
  classNames: {
    dropdown: 'sales-filter-dropdown',
    option: 'sales-filter-dropdown-option',
    options: 'sales-filter-dropdown-options',
  },
  position: 'bottom-start' as const,
  width: 'max-content',
}

const SALES_FILTER_SCROLL_AREA_PROPS = {
  offsetScrollbars: false as const,
}

export function SalesUkrainePage() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const focusedSaleNetId = searchParams.get('saleNetId') || ''
  const { hasPermission, user } = useAuth()
  const isAdmin =
    user?.UserRole?.UserRoleType === UserRoleType.Administrator || user?.UserRole?.UserRoleType === UserRoleType.GBA
  const canEditSale = hasPermission(SALES_UKRAINE_EDIT_PERMISSION)
  const canCreateSale = canEditSale
  const canUnlock = hasPermission(SALES_UKRAINE_UNLOCK_PERMISSION)
  const canWillNotShip = hasPermission(SALES_UKRAINE_WILL_NOT_SHIP_PERMISSION)
  const today = useMemo(() => formatLocalDate(new Date()), [])
  // Default the period to the last week (from = today − 7 days) instead of just today.
  const weekAgo = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 7)

    return formatLocalDate(date)
  }, [])
  const initialDraft = useMemo<FilterDraft>(
    () => ({
      clientId: '',
      forEcommerce: false,
      from: weekAgo,
      onlyMine: false,
      organisationIds: [],
      status: 'all',
      to: today,
      value: '',
    }),
    [today, weekAgo],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialDraft)
  const [activeDraft, setActiveDraft] = useValueState<FilterDraft>(initialDraft)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [sales, setSales] = useValueState<SalesUkraineSale[]>([])
  const [selectedSale, setSelectedSale] = useValueState<SalesUkraineSale | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [organizations, setOrganizations] = useValueState<SalesUkraineOrganizationOption[]>([])
  const [organisationQuery, setOrganisationQuery] = useState('')
  const [confirmState, setConfirmState] = useValueState<ConfirmState | null>(null)
  const [isConfirming, setConfirming] = useValueState(false)
  const [discountTarget, setDiscountTarget] = useValueState<{
    orderItem?: SalesUkraineOrderItem
    sale: SalesUkraineSale
  } | null>(null)
  const [detailsSale, setDetailsSale] = useValueState<SalesUkraineSale | null>(null)
  const [consignmentSale, setConsignmentSale] = useValueState<SalesUkraineSale | null>(null)
  const [wizardEditSale, setWizardEditSale] = useValueState<SalesUkraineSale | null>(null)
  const [editShiftSale, setEditShiftSale] = useValueState<SalesUkraineSale | null>(null)
  const [auditSale, setAuditSale] = useValueState<SalesUkraineSale | null>(null)
  const [auditStatistic, setAuditStatistic] = useValueState<SaleAuditStatistic | null>(null)
  const [auditLoading, setAuditLoading] = useValueState(false)
  const [auditError, setAuditError] = useValueState<string | null>(null)
  const auditRequestRef = useRef(0)
  const focusedSaleRequestRef = useRef(0)
  const dismissedFocusedSaleNetIdRef = useRef('')
  const [isNewSaleOpen, setNewSaleOpen] = useValueState(false)
  const [expandedKeys, setExpandedKeys] = useValueState<Set<string>>(() => new Set())
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const offset = (page - 1) * pageSize
  const totalRows = getTotalRows(sales)
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  const activeFilters = useMemo<SalesUkraineFilters>(
    () => ({
      clientId: activeDraft.clientId,
      forEcommerce: activeDraft.forEcommerce,
      from: activeDraft.from,
      limit: pageSize,
      offset,
      organisationIds: activeDraft.organisationIds.reduce<number[]>((acc, id) => {
        const parsed = Number(id)

        if (Number.isFinite(parsed)) {
          acc.push(parsed)
        }

        return acc
      }, []),
      status: activeDraft.status,
      to: activeDraft.to,
      type: activeDraft.onlyMine ? 'Self' : 'All',
      value: activeDraft.value,
    }),
    [activeDraft, offset, pageSize],
  )

  const closeSelectedSale = useCallback(() => {
    if (focusedSaleNetId && selectedSale?.NetUid === focusedSaleNetId) {
      dismissedFocusedSaleNetIdRef.current = focusedSaleNetId
    }

    focusedSaleRequestRef.current += 1
    setSelectedSale(null)
  }, [focusedSaleNetId, selectedSale?.NetUid, setSelectedSale])

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
  const expandedKeysRef = useRef<Set<string>>(expandedKeys)

  useEffect(() => {
    salesRef.current = sales
  }, [sales])

  useEffect(() => {
    expandedKeysRef.current = expandedKeys
  }, [expandedKeys])

  const ensureSaleDetails = useCallback(
    async (sale: SalesUkraineSale, options?: { force?: boolean }): Promise<SalesUkraineSale | null> => {
      // force: hydrate even when HasDetails isn't strictly false. Writes that post
      // the whole sale back (e.g. IsAcceptedToPacking) must run on a fresh, fully
      // hydrated record — a stale in-memory row without Order.OrderPackages wipes
      // them server-side on /sales/update (bug #13).
      if (!options?.force && !needsSaleDetails(sale)) {
        return sale
      }

      if (!sale.NetUid) {
        return sale
      }

      try {
        const loaded = await getSaleById(sale.NetUid)

        if (!loaded) {
          // Return null (not the un-hydrated sale) so callers' guards fire —
          // posting an un-hydrated sale to /sales/update wipes Order packages.
          return null
        }

        const next = { ...loaded, TotalRowsQty: sale.TotalRowsQty }

        setSales((current) => replaceSaleInList(current, next))

        return next
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продаж'))

        return null
      }
    },
    [setError, setSales, t],
  )

  const openSaleSheet = useCallback(
    async (sale: SalesUkraineSale) => {
      const next = await ensureSaleDetails(sale)

      if (next) {
        setSelectedSale(next)
      }
    },
    [ensureSaleDetails, setSelectedSale],
  )

  const openSaleDetails = useCallback(
    async (sale: SalesUkraineSale) => {
      const next = await ensureSaleDetails(sale)

      if (next) {
        setDetailsSale(next)
      }
    },
    [ensureSaleDetails, setDetailsSale],
  )

  const openSaleDiscount = useCallback(
    async (sale: SalesUkraineSale, orderItem?: SalesUkraineOrderItem) => {
      const next = await ensureSaleDetails(sale)

      if (next) {
        setDiscountTarget({ orderItem, sale: next })
      }
    },
    [ensureSaleDetails, setDiscountTarget],
  )

  const toggleSaleExpand = useCallback(
    async (key: string, sale: SalesUkraineSale) => {
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

  useEffect(() => {
    if (
      !focusedSaleNetId ||
      dismissedFocusedSaleNetIdRef.current === focusedSaleNetId ||
      selectedSale?.NetUid === focusedSaleNetId
    ) {
      return
    }

    const currentSale = salesRef.current.find((sale) => sale.NetUid === focusedSaleNetId)

    if (currentSale) {
      void openSaleSheet(currentSale)
      return
    }

    const requestId = focusedSaleRequestRef.current + 1
    focusedSaleRequestRef.current = requestId

    void getSaleById(focusedSaleNetId)
      .then((sale) => {
        if (focusedSaleRequestRef.current === requestId && sale) {
          setSelectedSale(sale)
        }
      })
      .catch((focusedSaleError: unknown) => {
        if (focusedSaleRequestRef.current === requestId) {
          setError(focusedSaleError instanceof Error ? focusedSaleError.message : t('Не вдалося завантажити продаж'))
        }
      })
  }, [focusedSaleNetId, openSaleSheet, sales, selectedSale?.NetUid, setError, setSelectedSale, t])

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
          const { sales: mergedSales, rehydrate } = mergeExpandedSaleDetails(next, salesRef.current, expandedKeysRef.current)

          setSales(mergedSales)

          for (const netUid of rehydrate) {
            void getSaleById(netUid).then((fresh) => {
              if (fresh && !cancelled) {
                setSales((current) => replaceSaleInList(current, fresh))
              }
            })
          }

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
      message: t('Розблокувати продаж для відвантаження?'),
      title: t('Підтвердження відвантаження'),
      onConfirm: async () => {
        const next = await ensureSaleDetails(sale, { force: true })

        if (!next) {
          throw new Error(t('Не вдалося завантажити продаж'))
        }

        await updateSale({ ...next, IsAcceptedToPacking: true })
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
    } catch (error) {
      notifications.show({ color: 'red', message: error instanceof Error ? error.message : t('Не вдалося виконати дію') })
    } finally {
      setConfirming(false)
    }
  }

  const organizationOptions = useMemo(
    () =>
      organizations.reduce<Array<{ label: string; value: string }>>((acc, organization) => {
        if (typeof organization.Id === 'number' && organization.Name) {
          acc.push({ label: organization.Name || '', value: String(organization.Id) })
        }

        return acc
      }, []),
    [organizations],
  )
  const organisationSummary = useMemo(() => {
    if (filterDraft.organisationIds.length === 0) {
      return t('Усі')
    }

    if (filterDraft.organisationIds.length > 1) {
      return `${t('Обрано')} ${filterDraft.organisationIds.length}`
    }

    return organizationOptions.find((option) => option.value === filterDraft.organisationIds[0])?.label || t('Обрано')
  }, [filterDraft.organisationIds, organizationOptions, t])
  const filteredOrganizationOptions = useMemo(() => {
    const query = organisationQuery.trim().toLowerCase()

    return query ? organizationOptions.filter((option) => option.label.toLowerCase().includes(query)) : organizationOptions
  }, [organisationQuery, organizationOptions])

  const dateRangeLabel = useMemo(() => {
    if (filterDraft.from && filterDraft.to) {
      return `${formatDateRangeFilterValue(filterDraft.from)} - ${formatDateRangeFilterValue(filterDraft.to)}`
    }

    if (filterDraft.from) {
      return `${t('З')} ${formatDateRangeFilterValue(filterDraft.from)}`
    }

    if (filterDraft.to) {
      return `${t('По')} ${formatDateRangeFilterValue(filterDraft.to)}`
    }

    return t('Період')
  }, [filterDraft.from, filterDraft.to, t])

  const toolbarRight = useMemo(
    () => (
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
    ),
    [isLoading, page, pageSize, reload, setPage, setPageSize, totalPages],
  )

  return (
    <Stack className="sales-ukraine-page" gap={6}>
      <Card className="sales-ukraine-card" withBorder radius="md" padding={0}>
        <Stack className="sales-ukraine-content" gap={0}>
          <div className="sales-filter-bar">
            <div className="sales-filter-row has-create">
              <TextInput
                className="sales-filter-search"
                label={t('Пошук')}
                leftSection={<IconSearch size={16} />}
                placeholder={t('Товар або номер продажу')}
                size="sm"
                value={filterDraft.value}
                onChange={(event) => applyFilters({ ...filterDraft, value: event.currentTarget.value })}
              />
              <div className="sales-filter-period-wrap">
                <span className="sales-filter-label">{t('Період')}</span>
                <Popover position="bottom-start" shadow="md" width={340} withinPortal>
                  <Popover.Target>
                    <Button
                      className="sales-filter-period"
                      color="gray"
                      justify="space-between"
                      rightSection={<IconChevronDown size={14} />}
                      size="sm"
                      variant="default"
                    >
                      <span className="sales-filter-period-value">{dateRangeLabel}</span>
                  </Button>
                </Popover.Target>
                <Popover.Dropdown className="sales-filter-period-menu">
                  <div className="sales-filter-period-panel">
                    <div className="sales-filter-period-range">
                      <TextInput
                        className="sales-filter-period-field"
                        label={t('З')}
                        max={filterDraft.to || undefined}
                        size="sm"
                        type="date"
                        value={filterDraft.from}
                        onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
                      />
                      <span className="sales-filter-period-separator" aria-hidden="true" />
                      <TextInput
                        className="sales-filter-period-field"
                        label={t('По')}
                        min={filterDraft.from || undefined}
                        size="sm"
                        type="date"
                        value={filterDraft.to}
                        onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
                      />
                    </div>
                    <div className="sales-filter-period-presets">
                      <Button
                        color="gray"
                        size="xs"
                        variant="subtle"
                        onClick={() => applyFilters({ ...filterDraft, from: today, to: today })}
                      >
                        {t('Сьогодні')}
                      </Button>
                      <Button
                        color="gray"
                        size="xs"
                        variant="subtle"
                        onClick={() => applyFilters({ ...filterDraft, from: '', to: '' })}
                      >
                        {t('Очистити')}
                      </Button>
                    </div>
                  </div>
                </Popover.Dropdown>
                </Popover>
              </div>
              <Select
                allowDeselect={false}
                className="sales-filter-control"
                comboboxProps={SALES_FILTER_COMBOBOX_PROPS}
                data={STATUS_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                label={t('Статус')}
                scrollAreaProps={SALES_FILTER_SCROLL_AREA_PROPS}
                size="sm"
                value={filterDraft.status}
                onChange={(value) => applyFilters({ ...filterDraft, status: (value as SalesUkraineStatusFilter | null) || 'all' })}
              />
              <Select
                allowDeselect={false}
                className="sales-filter-control"
                comboboxProps={SALES_FILTER_COMBOBOX_PROPS}
                data={[
                  { value: 'All', label: t('Усі менеджери') },
                  { value: 'Self', label: t('Тільки мої') },
                ]}
                label={t('Менеджер')}
                scrollAreaProps={SALES_FILTER_SCROLL_AREA_PROPS}
                size="sm"
                value={filterDraft.onlyMine ? 'Self' : 'All'}
                onChange={(value) =>
                  applyFilters({ ...filterDraft, onlyMine: ((value as SalesUkraineUserFilter | null) || 'All') === 'Self' })
                }
              />
              <div className="sales-filter-control sales-filter-organisation-picker">
                <span className="sales-filter-label">{t('Організація')}</span>
                <div className="sales-filter-organisation-input">
                  <Popover position="bottom-start" shadow="md" width={320} withinPortal>
                    <Popover.Target>
                      <button
                        className={`sales-filter-organisation-trigger${filterDraft.organisationIds.length ? ' has-value' : ''}`}
                        type="button"
                      >
                        <span title={organisationSummary}>{organisationSummary}</span>
                        <IconChevronDown size={14} />
                      </button>
                    </Popover.Target>
                    <Popover.Dropdown className="sales-filter-organisation-menu">
                      <TextInput
                        className="sales-filter-organisation-search"
                        leftSection={<IconSearch size={14} />}
                        placeholder={t('Пошук')}
                        size="xs"
                        value={organisationQuery}
                        onChange={(event) => setOrganisationQuery(event.currentTarget.value)}
                      />
                      <div className="sales-filter-organisation-options">
                        {filteredOrganizationOptions.map((option) => {
                          const checked = filterDraft.organisationIds.includes(option.value)

                          return (
                            <button
                              key={option.value}
                              className={`sales-filter-organisation-option${checked ? ' is-selected' : ''}`}
                              type="button"
                              onClick={() =>
                                applyFilters({
                                  ...filterDraft,
                                  organisationIds: checked
                                    ? filterDraft.organisationIds.filter((id) => id !== option.value)
                                    : [...filterDraft.organisationIds, option.value],
                                })
                              }
                            >
                              <span className="sales-filter-organisation-check" aria-hidden="true">
                                {checked && <IconCheck size={13} />}
                              </span>
                              <span className="sales-filter-organisation-option-label" title={option.label}>
                                {option.label}
                              </span>
                            </button>
                          )
                        })}
                        {filteredOrganizationOptions.length === 0 && (
                          <div className="sales-filter-organisation-empty">{t('Нічого не знайдено')}</div>
                        )}
                      </div>
                    </Popover.Dropdown>
                  </Popover>
                  {filterDraft.organisationIds.length > 0 && (
                    <button
                      aria-label={t('Очистити')}
                      className="sales-filter-organisation-clear"
                      type="button"
                      onClick={() => applyFilters({ ...filterDraft, organisationIds: [] })}
                    >
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>
              <SalesClientSearch
                className="sales-filter-control sales-filter-client"
                label={t('Клієнт')}
                placeholder={t('Пошук клієнта')}
                value={filterDraft.clientId}
                onChange={(clientId) => applyFilters({ ...filterDraft, clientId })}
              />
              <Checkbox
                checked={filterDraft.forEcommerce}
                className="sales-filter-ecommerce"
                label={t('Інтернет-магазин')}
                size="sm"
                onChange={(event) => applyFilters({ ...filterDraft, forEcommerce: event.currentTarget.checked })}
              />
              <div className="sales-filter-actions">
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
                <Box className="sales-filter-toolbar">{toolbarRight}</Box>
              </div>
              <Button
                className="sales-filter-create"
                color={CREATE_ACTION_COLOR}
                disabled={!canCreateSale}
                leftSection={<IconPlus size={16} />}
                size="sm"
                onClick={() => setNewSaleOpen(true)}
              >
                {t('Новий продаж')}
              </Button>
            </div>
          </div>

          {error && (
            <Alert className="sales-grid-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <div className="sales-grid">
            {isLoading ? (
              <div className="sales-grid-skeleton" aria-label={t('Завантаження продажів')} aria-busy="true">
                {Array.from({ length: 9 }, (_, rowIndex) => (
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
                      <SaleGridRow
                        sale={sale}
                        canEditSale={canEditSale}
                        canUnlock={canUnlock}
                        canWillNotShip={canWillNotShip}
                        isAdmin={isAdmin}
                        canExpand={canExpand}
                        isExpanded={isExpanded}
                        onToggleExpand={() => void toggleSaleExpand(key, sale)}
                        onOpenSale={(target) => void openSaleSheet(target)}
                        onOpenEditor={setWizardEditSale}
                        onOpenEditShift={setEditShiftSale}
                        onOpenDetails={(target) => void openSaleDetails(target)}
                        onOpenConsignment={setConsignmentSale}
                        onOpenAudit={openAudit}
                        onUnlock={requestUnlock}
                        onWillNotShip={requestWillNotShip}
                        onOpenDiscount={(target) => void openSaleDiscount(target)}
                      />
                      {isExpanded && (
                        <div className="sales-grid-expand">
                          <SaleExpandContent
                            sale={sale}
                            onOpenItemDiscount={(targetSale, orderItem) => void openSaleDiscount(targetSale, orderItem)}
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
        onClose={closeSelectedSale}
      >
        {selectedSale && <SaleDetail sale={selectedSale} />}
      </AppDrawer>

      <SaleDiscountModal
        orderItem={discountTarget?.orderItem}
        sale={discountTarget?.sale ?? null}
        onClose={() => setDiscountTarget(null)}
        onSaved={(updatedSale) => {
          if (updatedSale) {
            setSales((current) => replaceSaleInList(current, updatedSale))

            if (selectedSale && isSameSale(selectedSale, updatedSale)) {
              setSelectedSale(updatedSale)
            }

            if (detailsSale && isSameSale(detailsSale, updatedSale)) {
              setDetailsSale(updatedSale)
            }
          }

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
        <SaleAuditDetail
          error={auditError}
          isLoading={auditLoading}
          statistic={auditStatistic}
          onConfirmed={() => {
            closeAudit()
            reload()
          }}
        />
      </AppDrawer>

      <NewSaleWizard
        editSale={wizardEditSale}
        opened={(canCreateSale && isNewSaleOpen) || Boolean(wizardEditSale)}
        onClose={() => {
          setNewSaleOpen(false)
          setWizardEditSale(null)
          reload()
        }}
        onCreated={() => {
          setNewSaleOpen(false)
          setWizardEditSale(null)
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
              <Button color={confirmState.color || CREATE_ACTION_COLOR} loading={isConfirming} onClick={runConfirm}>
                {confirmState.confirmLabel}
              </Button>
            </Group>
          </Stack>
        )}
      </AppModal>
    </Stack>
  )
}

type SaleGridRowProps = {
  sale: SalesUkraineSale
  canEditSale: boolean
  canUnlock: boolean
  canWillNotShip: boolean
  isAdmin: boolean
  canExpand: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onOpenSale: (sale: SalesUkraineSale) => void
  onOpenEditor: (sale: SalesUkraineSale) => void
  onOpenEditShift: (sale: SalesUkraineSale) => void
  onOpenDetails: (sale: SalesUkraineSale) => void
  onOpenConsignment: (sale: SalesUkraineSale) => void
  onOpenAudit: (sale: SalesUkraineSale) => void
  onUnlock: (sale: SalesUkraineSale) => void
  onWillNotShip: (sale: SalesUkraineSale) => void
  onOpenDiscount: (sale: SalesUkraineSale) => void
}

function SaleGridRow({
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
  onOpenEditShift,
  onOpenDetails,
  onOpenConsignment,
  onOpenAudit,
  onUnlock,
  onWillNotShip,
  onOpenDiscount,
}: SaleGridRowProps) {
  const { t } = useI18n()

  const client = sale.ClientAgreement?.Client
  const code = (client?.RootClient ? client.RootClient.RegionCode?.Value : client?.RegionCode?.Value)?.trim()
  const clientName = getSaleClientDisplayName(sale)
  const retailLine = getRetailClientLine(sale)
  const date = getSaleDate(sale)
  const manager = getSaleUserName(sale)
  const contract = sale.ClientAgreement?.Agreement?.Name
  const transporter = getSaleTransporterName(sale)
  const transporterImageUrl = getTransporterImageUrl(sale)
  const unpaid = isUnpaidSale(sale)
  const localAmount = getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount)
  const vat = sale.IsVatSale ? getNumber(sale.Order?.TotalVat) : null
  const positions = getOrderItemCount(sale)
  const paymentColor = getPaymentStatusColor(sale)

  const lifecycleStatusKey = getSaleStatusKey(sale)
  const isPackaging = lifecycleStatusKey === 'Packaging' || lifecycleStatusKey === 'Packaged'
  // Legacy hides the edit-act / print / audit / delivery actions for a Received-and-unpaid sale
  // (a strictly NotPaid sale that has already been received). PartialPaid stays visible.
  const hideEditActActions = lifecycleStatusKey === 'Received' && unpaid
  const hidePrintBlock = Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking && !isAdmin
  const showTtn = Boolean(sale.TransporterId) && isPackaging && !hidePrintBlock
  const showWillNotShip = canWillNotShip && Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking
  const showUnlock = canUnlock && Boolean(sale.IsLocked)
  const showEdit = canEditSale && (sale.InputSaleMerges?.length ?? 0) === 0
  const showEditShift = showEdit && positions > 0 && !hideEditActActions
  const showBang = Boolean(sale.IsVatSale) && !sale.IsAcceptedToPacking
  const bangClickable = Boolean(sale.ChangedToInvoice) && canWillNotShip
  const discountEditable = isNewOrPackagingStatus(sale) && positions > 0
  const rowOrderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const uniformDiscount = rowOrderItems.length ? getUniformOneTimeDiscount(rowOrderItems) : getNumber(sale.OneTimeDiscountUniform)
  const averageDiscount =
    uniformDiscount == null
      ? rowOrderItems.length
        ? getAverageOneTimeDiscount(rowOrderItems)
        : getNumber(sale.OneTimeDiscountAverage)
      : null
  const saleDiscountBadge = uniformDiscount != null || averageDiscount != null ? formatCompactPercent(uniformDiscount ?? averageDiscount ?? 0) : null
  const saleDiscountUpdater =
    uniformDiscount != null
      ? (rowOrderItems[0]?.DiscountUpdatedBy?.LastName ?? sale.DiscountUpdatedByLastName)?.trim() || ''
      : ''
  const isEdited = Boolean(sale.IsEdited) || (Array.isArray(sale.HistoryInvoiceEdit) && sale.HistoryInvoiceEdit.length > 0)

  const openSale = () => onOpenSale(sale)

  return (
    <div
      className={`sales-grid-row${isExpanded ? ' is-expanded' : ''}${isEdited ? ' is-edited' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={t('Відкрити продаж')}
      onClick={(event) => {
        const target = event.target as HTMLElement

        // Ignore clicks coming from portaled content (menus, modals) that React bubbles
        // through the component tree even though they live outside the row in the DOM.
        if (!event.currentTarget.contains(target)) {
          return
        }

        if (!target.closest('[data-row-stop]')) {
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
          {showEdit ? (
            <span className="sg-action-slot">
              <Tooltip label={t('Редагування')}>
                <ActionIcon aria-label={t('Редагування')} color="gray" size="sm" variant="subtle" onClick={() => onOpenEditor(sale)}>
                  <IconPencil size={15} />
                </ActionIcon>
              </Tooltip>
            </span>
          ) : (
            <span className="sg-action-slot is-empty" aria-hidden="true" />
          )}
          {showBang ? (
            <span className="sg-action-slot is-bang">
              <Tooltip label={t('Розблокувати для відвантаження')}>
                {bangClickable ? (
                  <button
                    className="sg-bang"
                    data-clickable="true"
                    type="button"
                    aria-label={t('Розблокувати для відвантаження')}
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
            </span>
          ) : (
            <span className="sg-action-slot is-bang" aria-hidden="true">
              <span className="sg-bang sg-bang-placeholder">!</span>
            </span>
          )}
          {canExpand ? (
            <span className="sg-action-slot">
              <Tooltip label={isExpanded ? t('Згорнути') : t('Розгорнути')}>
                <ActionIcon aria-label={t('Розгорнути')} color="gray" size="sm" variant="subtle" onClick={onToggleExpand}>
                  {isExpanded ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
                </ActionIcon>
              </Tooltip>
            </span>
          ) : (
            <span className="sg-action-slot is-empty" aria-hidden="true" />
          )}
        </div>

        <div className="sg-client-body">
          <div className="sg-client-name">
            {code && <span className="sg-client-code">{code}</span>}
            {client?.IsTemporaryClient && (
              <Text span c="red" fw={700}>
                !
              </Text>
            )}
            <Tooltip label={clientName} disabled={!clientName} multiline maw={360}>
              <span className="sg-client-name-text">{displayValue(clientName)}</span>
            </Tooltip>
            {sale.IsVatSale && (
              <Badge className="app-role-pill" size="xs" variant="light">
                {t('ПДВ')}
              </Badge>
            )}
            {sale.IsDevelopment && (
              <Badge className="app-role-pill is-orange" size="xs" variant="light">
                {t('Протокол')}
              </Badge>
            )}
            {retailLine && (
              <Tooltip label={retailLine} multiline maw={360}>
                <span className="sg-client-retail">{retailLine}</span>
              </Tooltip>
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
            {contract && <span className="sg-meta-contract">{contract}</span>}
            {isEdited && (
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

      <div className={`sg-amt${unpaid ? ' is-unpaid' : ''}`}>
        <span className="sg-amt-val">{formatAmount(localAmount)}</span>
        <span className="sg-amt-unit">{displayValue(getSaleCurrencyCode(sale))}</span>
      </div>
      <div className={`sg-amt${unpaid ? ' is-unpaid' : ''}`}>
        <span className="sg-amt-val">{formatAmount(getSecondaryAmount(sale))}</span>
        <span className="sg-amt-unit">{getSecondaryAmountCode(sale)}</span>
      </div>
      <div className={`sg-amt${unpaid ? ' is-unpaid' : ''}`}>
        <span className="sg-amt-val">{formatAmount(vat)}</span>
        <span className="sg-amt-unit">{t('ПДВ')}</span>
      </div>

      <div className="sg-positions">{positions}</div>

      <div className="sg-slot" data-row-stop="true">
        {saleDiscountBadge != null ? (
          <Tooltip label={saleDiscountUpdater ? `${t('Знижка')}: ${saleDiscountUpdater}` : t('Знижка')}>
            {discountEditable && uniformDiscount != null ? (
              <button className="sg-discount-badge" type="button" onClick={() => onOpenDiscount(sale)}>
                {saleDiscountBadge}
              </button>
            ) : (
              <span className="sg-discount-badge is-static">{saleDiscountBadge}</span>
            )}
          </Tooltip>
        ) : discountEditable ? (
          <Tooltip label={t('Додати знижку')}>
            <ActionIcon
              aria-label={t('Додати знижку')}
              className="sg-discount-add"
              color="gray"
              size="sm"
              variant="subtle"
              onClick={() => onOpenDiscount(sale)}
            >
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
        {!hideEditActActions && (
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
        )}
      </div>

      <div className="sg-doc-actions" data-row-stop="true">
        {!hidePrintBlock && !hideEditActActions && <SaleDocumentsMenu sale={sale} />}
        <Menu position="bottom-end" shadow="md" withinPortal>
          <Menu.Target>
            <ActionIcon aria-label={t('Дії')} color="gray" size="sm" variant="subtle">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            {showEdit && (
              <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => onOpenEditor(sale)}>
                {t('Редагування')}
              </Menu.Item>
            )}
            {showEditShift && (
              <Menu.Item leftSection={<IconArrowsLeftRight size={16} />} onClick={() => onOpenEditShift(sale)}>
                {lifecycleStatusKey === 'New' ? t('Акт редагування рахунку') : t('Акт редагування накладної')}
              </Menu.Item>
            )}
            {!hideEditActActions && (
              <Menu.Item leftSection={<IconTruckDelivery size={16} />} onClick={() => onOpenDetails(sale)}>
                {t('Дані доставки')}
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
                {t('Розблокувати для відвантаження')}
              </Menu.Item>
            )}
            {showUnlock && (
              <Menu.Item color="red" leftSection={<IconLockOpen size={16} />} onClick={() => onUnlock(sale)}>
                {t('Розблокувати')}
              </Menu.Item>
            )}
            {!hideEditActActions && (
              <Menu.Item leftSection={<IconHistory size={16} />} onClick={() => onOpenAudit(sale)}>
                {t('Історія редагувань')}
              </Menu.Item>
            )}
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

function SaleDetail({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const date = getSaleDate(sale)
  const paymentTone = getPaymentStatusTone(sale)
  const primaryAmount = getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount)
  const secondaryAmount = getSecondaryAmount(sale)
  const vatAmount = sale.IsVatSale ? getNumber(sale.Order?.TotalVat) : null
  const currencyCode = getSaleCurrencyCode(sale)
  const secondaryCurrencyCode = getSecondaryAmountCode(sale)

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
          rows={[
            [t('Клієнт'), getSaleClientName(sale)],
            [t('Покупець'), getRetailClientLine(sale)],
            [t('Договір'), sale.ClientAgreement?.Agreement?.Name],
            [t('Організація'), sale.ClientAgreement?.Agreement?.Organization?.Name],
            [
              t('Телефон'),
              sale.ClientAgreement?.Client?.MobileNumber || sale.ClientAgreement?.Client?.PhoneNumber || sale.ClientAgreement?.Client?.ClientNumber,
            ],
          ]}
        />
        <SaleDetailSection
          icon={<IconTruckDelivery size={15} />}
          title={t('Доставка')}
          rows={[
            [t('Перевізник'), getSaleTransporterName(sale)],
            [t('Отримувач'), sale.DeliveryRecipient?.FullName],
            [t('Телефон'), sale.DeliveryRecipient?.MobilePhone],
            [t('Адреса'), getSaleDeliveryAddress(sale)],
            [t('ТТН'), sale.CustomersOwnTtn?.Number || sale.TTN],
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
                  showUah={isNonVatEurAgreement(sale)}
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
            <strong>{displayValue(value)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function SaleDetailProductRow({
  currencyCode,
  item,
  showUah,
}: {
  currencyCode: string
  item: SalesUkraineOrderItem
  showUah?: boolean
}) {
  const amount = getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)
  const qty = getNumber(item.Qty)
  const unitPrice = amount != null && qty ? amount / qty : null
  // For non-VAT EUR agreements the агрегат currency is EUR; also show the UAH
  // equivalent per line (same TotalAmountEurToUah source as the sale total).
  const uahAmount = showUah ? getNumber(item.TotalAmountEurToUah) : null
  const uahUnitPrice = uahAmount != null && qty ? uahAmount / qty : null

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
      <span className="sale-detail-product-value">
        {formatAmount(unitPrice)}
        {uahUnitPrice != null && <small className="sale-detail-product-uah">{formatAmount(uahUnitPrice)} грн</small>}
      </span>
      <span className="sale-detail-product-amount">
        {formatAmount(amount)} <small>{displayValue(currencyCode)}</small>
        {uahAmount != null && <small className="sale-detail-product-uah">{formatAmount(uahAmount)} грн</small>}
      </span>
    </div>
  )
}

function getTotalRows(sales: SalesUkraineSale[]): number {
  for (const sale of sales) {
    const total = getNumber(sale.TotalRowsQty)

    if (total) {
      return total
    }
  }

  return sales.length
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

function getSaleClientDisplayName(sale: SalesUkraineSale): string {
  const baseName = getSaleClientName(sale)
  const root = sale.ClientAgreement?.Client?.RootClient

  if (!root) {
    return baseName
  }

  const rootName = root.FullName?.trim() || [root.LastName, root.FirstName].filter(Boolean).join(' ').trim()

  return rootName ? `${rootName} (${baseName})` : baseName
}

function getRetailClientLine(sale: SalesUkraineSale): string {
  const retail = sale.RetailClient

  if (!retail) {
    return ''
  }

  return [retail.PhoneNumber?.trim(), retail.Name?.trim() || retail.FullName?.trim()].filter(Boolean).join(' - ')
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
  return getSaleLifecycleStatusKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name)
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

function getSaleStatusLabel(sale: SalesUkraineSale): string {
  const statusKey = getSaleStatusKey(sale)
  const label = translate(STATUS_LABELS[statusKey] || sale.BaseLifeCycleStatus?.Name || displayValue(statusKey))

  return sale.IsVatSale ? `(${translate('ПДВ')}) ${label}` : label
}

function getPaymentStatusLabel(sale: SalesUkraineSale): string {
  const key = getStatusTypeKey(sale.BaseSalePaymentStatus?.SalePaymentStatusType)

  return translate(PAYMENT_STATUS_LABELS[key] || sale.BaseSalePaymentStatus?.Name || '')
}

function isUnpaidSale(sale: SalesUkraineSale): boolean {
  return isStatusType(sale.BaseSalePaymentStatus?.SalePaymentStatusType, 0)
}

function getPaymentStatusColor(sale: SalesUkraineSale): string | undefined {
  switch (getStatusTypeKey(sale.BaseSalePaymentStatus?.SalePaymentStatusType)) {
    case '0':
      return 'red'
    case '1':
      return 'green'
    case '2':
      return 'green'
    case '3':
      return 'orange'
    case '4':
      return 'blue'
    default:
      return undefined
  }
}

function getPaymentStatusTone(sale: SalesUkraineSale): string {
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
  return isDiscountEditableSaleLifecycle(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name)
}

function getOrderItemCount(sale: SalesUkraineSale): number {
  return sale.Order?.OrderItems?.length || getNumber(sale.TotalPositions) || 0
}

function needsSaleDetails(sale: SalesUkraineSale): boolean {
  return sale.HasDetails === false
}

function replaceSaleInList(sales: SalesUkraineSale[], nextSale: SalesUkraineSale): SalesUkraineSale[] {
  return sales.map((sale) => (isSameSale(sale, nextSale) ? nextSale : sale))
}

function mergeExpandedSaleDetails(
  next: SalesUkraineSale[],
  previous: SalesUkraineSale[],
  expandedKeys: Set<string>,
): { sales: SalesUkraineSale[]; rehydrate: string[] } {
  const rehydrate: string[] = []

  const sales = next.map((sale) => {
    const key = String(sale.NetUid || sale.Id || '')

    if (!key || !expandedKeys.has(key) || !needsSaleDetails(sale)) {
      return sale
    }

    const prior = previous.find((item) => isSameSale(item, sale))

    if (!prior || needsSaleDetails(prior)) {
      return sale
    }

    if (sale.NetUid) {
      rehydrate.push(sale.NetUid)
    }

    return { ...sale, HasDetails: true, Order: prior.Order }
  })

  return { rehydrate, sales }
}

function isSameSale(left: SalesUkraineSale, right: SalesUkraineSale): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  return Boolean(left.Id && right.Id && left.Id === right.Id)
}

function getOrderItemProductName(item: SalesUkraineOrderItem): string {
  return item.Product?.NameUA || item.Product?.Name || ''
}

function getOrderItemProductCode(item: SalesUkraineOrderItem): string {
  return item.Product?.VendorCode || item.Product?.Articul || item.Product?.MainOriginalNumber || ''
}

function getSaleTransporterName(sale: SalesUkraineSale): string {
  return (
    sale.Transporter?.Name
    || sale.Transporter?.Title
    || sale.UpdateDataCarrier?.[0]?.Transporter?.Name
    || sale.UpdateDataCarrier?.[0]?.Transporter?.Title
    || ''
  )
}

function getTransporterImageUrl(sale: SalesUkraineSale): string {
  return sale.Transporter?.ImageUrl?.trim() || sale.UpdateDataCarrier?.[0]?.Transporter?.ImageUrl?.trim() || ''
}

function getSaleDeliveryAddress(sale: SalesUkraineSale): string {
  const address = sale.DeliveryRecipientAddress
  const carrier = sale.UpdateDataCarrier?.[0]

  return (
    address?.Value
    || [address?.City, address?.Department].filter(Boolean).join(', ')
    || [carrier?.City, carrier?.Department].filter(Boolean).join(', ')
    || ''
  )
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

function formatDateRangeFilterValue(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return value
  }

  return `${match[3]}.${match[2]}.${match[1].slice(2)}`
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : displayValue(value)
}

function formatCompactPercent(value: number): string {
  return `${compactPercentFormatter.format(value)}%`
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
    return value.trim() || ''
  }

  return ''
}
