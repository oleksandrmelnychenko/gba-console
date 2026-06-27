import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Divider,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconAddressBook,
  IconBuildingFactory2,
  IconCash,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconFileDescription,
  IconFileTypePdf,
  IconId,
  IconMapPin,
  IconPhone,
  IconPlus,
  IconRestore,
  IconSearch,
  IconToggleLeft,
  IconToggleRight,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE, PAGINATOR_PAGE_SIZE_OPTIONS } from '../../../shared/ui/paginator/paginatorPageSize'
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { SupplierPassport } from '../components/SupplierPassport'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useLocation, useNavigate } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import {
  exportSuppliersDocument,
  getSupplierFilterItems,
  getSupplierCount,
  getSuppliers,
  switchClientActiveState,
} from '../api/clientsApi'
import type { Client, ClientAgreement, ClientFilterItem, ClientPrintDocument } from '../types'
import '../../../shared/ui/console-table-page.css'
import './suppliers-page.css'

const pageSizeOptions = PAGINATOR_PAGE_SIZE_OPTIONS
const SUPPLIER_FILTER_ENTITY_TYPE = 7
const SUPPLIER_SEARCH_SQL = 'RegionCode.Value/Client.FullName'
const SUPPLIER_SEARCH_DEBOUNCE_MS = 350
const SUPPLIER_TABLE_PAGE_SIZE_STORAGE_KEY = 'gba-data-table:suppliers:page-size'
const DEFAULT_SUPPLIER_TABLE_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE
const SHOW_SUPPLIER_ROLE_IN_BALANCE = false
const SUPPLIERS_FILTER_COMBOBOX_PROPS = {
  classNames: {
    dropdown: 'suppliers-filter-dropdown',
    option: 'suppliers-filter-dropdown-option',
    options: 'suppliers-filter-dropdown-options',
  },
  position: 'bottom-start' as const,
  width: 'max-content',
}
const SUPPLIERS_FILTER_SCROLL_AREA_PROPS = {
  offsetScrollbars: false as const,
}
const supplierAmountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})
const supplierDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type ActiveFilter = 'all' | 'active' | 'inactive'
type SupplierAction = 'active' | 'export' | null
type SupplierSortId = 'supplier' | 'contacts' | 'volume' | 'balance'
type SupplierSortState = {
  direction: 'asc' | 'desc'
  id: SupplierSortId
}

const DEFAULT_SUPPLIER_SORT_STATE: SupplierSortState = { direction: 'desc', id: 'volume' }
const SUPPLIER_SORT_COLUMNS: Record<SupplierSortId, string> = {
  balance: 'TotalCurrentAmount',
  contacts: 'EmailAddress',
  supplier: 'FullName',
  volume: 'PurchaseVolumeEur',
}

const DEFAULT_SUPPLIER_SEARCH_FIELD_OPTIONS = [
  { value: SUPPLIER_SEARCH_SQL, label: 'Код або назва' },
  { value: 'Client.FullName', label: 'Повна назва' },
  { value: 'Client.ClientNumber/Client.MobileNumber', label: 'Телефон' },
  { value: 'Client.EmailAddress', label: 'Email' },
]

const SUPPLIER_SEARCH_FIELD_LABELS_BY_SQL: Record<string, string> = {
  [SUPPLIER_SEARCH_SQL]: 'Код або назва',
  'RegionCode.Value': 'Код регіону',
  'Client.FullName': 'Повна назва',
  'Client.Name': 'Назва',
  'Client.SupplierName': 'Назва постачальника',
  'Client.Manufacturer': 'Виробник',
  'Client.SupplierCode': 'Код постачальника',
  'Client.USREOU': 'ЄДРПОУ',
  'Client.ClientNumber/Client.MobileNumber': 'Телефон',
  'Client.EmailAddress': 'Email',
  ProductVendorCode: 'Артикул постачальника',
  'Product.VendorCode': 'Артикул постачальника',
  SupplyInvoiceNumber: 'Номер інвойсу',
  'SupplyInvoice.Number': 'Номер інвойсу',
  SupplyOrderNumber: 'Номер замовлення',
  SupplyProFormNumber: 'Номер проформи',
  'SupplyProForm.Number': 'Номер проформи',
}

const SUPPLIER_SEARCH_FIELD_LABELS_BY_NAME: Record<string, string> = {
  'code or name': 'Код або назва',
  code: 'Код',
  email: 'Email',
  'e-mail': 'Email',
  manufacturer: 'Виробник',
  name: 'Назва',
  phone: 'Телефон',
  region: 'Регіон',
  'region code': 'Код регіону',
  supplier: 'Постачальник',
  'supplier code': 'Код постачальника',
  'supplier name': 'Назва постачальника',
  productvendorcode: 'Артикул постачальника',
  supplyinvoicenumber: 'Номер інвойсу',
  supplyordernumber: 'Номер замовлення',
  supplyproformnumber: 'Номер проформи',
  title: 'Назва',
}

function useSuppliersPageModel() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const hasLoadedSuppliersRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [suppliers, setSuppliers] = useValueState<Client[]>([])
  const [supplierFilterItems, setSupplierFilterItems] = useValueState<ClientFilterItem[]>([])
  const [totalCount, setTotalCount] = useValueState<number | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isRefreshing, setRefreshing] = useValueState(false)
  const [supplierAction, setSupplierAction] = useValueState<SupplierAction>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ClientPrintDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [selectedSupplier, setSelectedSupplier] = useValueState<Client | null>(null)
  const [passportSupplier, setPassportSupplier] = useValueState<Client | null>(null)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(readSupplierTablePageSize)
  const [activeFilter, setActiveFilter] = useValueState<ActiveFilter>('all')
  const [sortState, setSortState] = useValueState<SupplierSortState>(DEFAULT_SUPPLIER_SORT_STATE)
  const [searchField, setSearchField] = useValueState(SUPPLIER_SEARCH_SQL)
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SUPPLIER_SEARCH_DEBOUNCE_MS)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const offset = (page - 1) * pageSize
  const canMoveForward = suppliers.length === pageSize
  const totalPages = typeof totalCount === 'number' && totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : page + (canMoveForward ? 1 : 0)
  const active = activeFilter === 'all' ? null : activeFilter === 'active'
  const searchFieldOptions = useMemo(() => buildSupplierSearchFieldOptions(supplierFilterItems), [supplierFilterItems])
  useEffect(() => {
    if (!searchFieldOptions.some((option) => option.value === searchField)) {
      setSearchField(SUPPLIER_SEARCH_SQL)
    }
  }, [searchField, searchFieldOptions, setSearchField])
  const selectedFilterItem = useMemo(
    () => supplierFilterItems.find((filterItem) => filterItem.SQL === searchField),
    [searchField, supplierFilterItems],
  )
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isRefreshing || isSearchSettling
  const sortDescriptors = useMemo(
    () => [{ Column: SUPPLIER_SORT_COLUMNS[sortState.id], Dir: sortState.direction }],
    [sortState.direction, sortState.id],
  )
  const searchParams = useMemo(
    () => ({
      active,
      filterEntityType: SUPPLIER_FILTER_ENTITY_TYPE,
      filterOperationSql: selectedFilterItem?.FilterOperationItem?.SQL,
      filterSql: searchField,
      limit: pageSize,
      offset,
      sortDescriptors,
      value: normalizedSearchValue,
    }),
    [active, normalizedSearchValue, offset, pageSize, searchField, selectedFilterItem, sortDescriptors],
  )
  const changePageSize = useCallback((value: string | null) => {
    const nextPageSize = normalizeSupplierTablePageSize(value)

    setPage(1)
    setPageSize(nextPageSize)
    writeSupplierTablePageSize(nextPageSize)
  }, [setPage, setPageSize])
  useSupplierListLoader({
    hasLoadedSuppliersRef,
    reloadKey,
    searchParams,
    setError,
    setLoading,
    setRefreshing,
    setSuppliers,
  })
  useSupplierMetaLoader({
    setSupplierFilterItems,
    setTotalCount,
  })

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  function resetSearch() {
    setPage(1)
    setActiveFilter('all')
    setSearchField(SUPPLIER_SEARCH_SQL)
    setSearchValue('')
  }

  function changeSort(id: SupplierSortId) {
    setPage(1)
    setSortState((currentSort) => ({
      direction: currentSort.id === id && currentSort.direction === 'asc' ? 'desc' : 'asc',
      id,
    }))
  }

  function openNewSupplier() {
    navigate('/clients/new/role', {
      state: {
        backgroundLocation: location,
        clientType: 'supplier',
        moduleTitle: t('Постачальники'),
        returnPath: `${location.pathname}${location.search}`,
      },
    })
  }

  function openSupplier(supplier: Client) {
    if (!supplier.NetUid) {
      return
    }

    navigate(`/suppliers/edit/${supplier.NetUid}`, {
      state: {
        backgroundLocation: location,
        moduleTitle: t('Постачальники'),
        nodeTitle: getSupplierDisplayName(supplier),
        returnPath: `${location.pathname}${location.search}`,
      },
    })
    setSelectedSupplier(null)
  }

  function openPassport(supplier: Client) {
    setPassportSupplier(supplier)
    setSelectedSupplier(null)
  }

  function openCashFlow(supplier: Client) {
    if (!supplier.NetUid) {
      return
    }

    navigate(`/suppliers/accounting-cash-flow/${supplier.NetUid}`, {
      state: {
        moduleTitle: t('Постачальники'),
        nodeTitle: getSupplierDisplayName(supplier),
      },
    })
    setSelectedSupplier(null)
  }

  async function handleSwitchActive(supplier: Client) {
    if (!supplier.NetUid) {
      return
    }

    setSupplierAction('active')
    setError(null)

    try {
      await switchClientActiveState(supplier.NetUid)
      setSuppliers((currentSuppliers) =>
        currentSuppliers.reduce<Client[]>((nextSuppliers, currentSupplier) => {
          const nextSupplier =
            currentSupplier.NetUid === supplier.NetUid
              ? {
                  ...currentSupplier,
                  IsActive: currentSupplier.IsActive === false,
                }
              : currentSupplier

          if (shouldKeepSupplierInActiveFilter(nextSupplier, activeFilter)) {
            nextSuppliers.push(nextSupplier)
          }

          return nextSuppliers
        }, []),
      )
      setSelectedSupplier((currentSupplier) =>
        currentSupplier && currentSupplier.NetUid === supplier.NetUid
          ? shouldKeepSupplierInActiveFilter({ ...currentSupplier, IsActive: currentSupplier.IsActive === false }, activeFilter)
            ? {
                ...currentSupplier,
                IsActive: currentSupplier.IsActive === false,
              }
            : null
          : currentSupplier,
      )
      notifications.show({
        color: 'green',
        message: t('Статус постачальника оновлено'),
      })
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося змінити статус постачальника'))
    } finally {
      setSupplierAction(null)
    }
  }

  async function handleExport() {
    setSupplierAction('export')
    setError(null)

    try {
      const document = await exportSuppliersDocument({
        ...searchParams,
        limit: totalCount && totalCount > 0 ? totalCount : pageSize,
        offset: 0,
      })

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося підготувати документ'))
    } finally {
      setSupplierAction(null)
    }
  }

  return {
    activeFilter,
    downloadDocument,
    downloadModalOpened,
    error,
    isLoading,
    isTableBusy,
    page,
    pageSize,
    passportSupplier,
    searchField,
    searchFieldOptions,
    searchInputRef,
    searchValue,
    selectedSupplier,
    sortState,
    supplierAction,
    suppliers,
    totalPages,
    changeSort,
    changePageSize,
    reload,
    handleExport,
    handleSwitchActive,
    openCashFlow,
    openNewSupplier,
    openPassport,
    openSupplier,
    resetSearch,
    setActiveFilter,
    setDownloadModalOpened,
    setPage,
    setPassportSupplier,
    setSearchField,
    setSelectedSupplier,
    setSearchValue,
  }
}

type SupplierSearchParams = Parameters<typeof getSuppliers>[0]

function useSupplierListLoader({
  hasLoadedSuppliersRef,
  reloadKey,
  searchParams,
  setError,
  setLoading,
  setRefreshing,
  setSuppliers,
}: {
  hasLoadedSuppliersRef: { current: boolean }
  reloadKey: number
  searchParams: SupplierSearchParams
  setError: (value: string | null) => void
  setLoading: (value: boolean) => void
  setRefreshing: (value: boolean) => void
  setSuppliers: (value: Client[]) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function loadSuppliers() {
      const isInitialLoad = !hasLoadedSuppliersRef.current

      if (isInitialLoad) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError(null)

      try {
        const nextSuppliers = await getSuppliers(searchParams, controller.signal)

        if (!cancelled) {
          setSuppliers(nextSuppliers)
          hasLoadedSuppliersRef.current = true
        }
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return
        }

        if (!cancelled) {
          if (!hasLoadedSuppliersRef.current) {
            setSuppliers([])
          }

          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити постачальників'))
        }
      } finally {
        if (!cancelled) {
          hasLoadedSuppliersRef.current = true
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [hasLoadedSuppliersRef, reloadKey, searchParams, setError, setLoading, setRefreshing, setSuppliers, t])
}

function useSupplierMetaLoader({
  setSupplierFilterItems,
  setTotalCount,
}: {
  setSupplierFilterItems: (value: ClientFilterItem[]) => void
  setTotalCount: (value: number | null) => void
}) {
  useEffect(() => {
    let cancelled = false

    async function loadSupplierMeta() {
      try {
        const [nextTotalCount, nextFilterItems] = await Promise.all([
          getSupplierCount(),
          getSupplierFilterItems(),
        ])

        if (!cancelled) {
          setTotalCount(nextTotalCount)
          setSupplierFilterItems(nextFilterItems)
        }
      } catch {
        if (!cancelled) {
          setTotalCount(null)
          setSupplierFilterItems([])
        }
      }
    }

    void loadSupplierMeta()

    return () => {
      cancelled = true
    }
  }, [setSupplierFilterItems, setTotalCount])
}

export function SuppliersPage() {
  const model = useSuppliersPageModel()

  return <SuppliersPageView model={model} />
}

function SuppliersPageView({ model }: { model: ReturnType<typeof useSuppliersPageModel> }) {
  const { t } = useI18n()
  const {
    activeFilter,
    downloadDocument,
    downloadModalOpened,
    error,
    isLoading,
    isTableBusy,
    passportSupplier,
    searchField,
    searchFieldOptions,
    searchInputRef,
    searchValue,
    selectedSupplier,
    sortState,
    supplierAction,
    suppliers,
    totalPages,
    page,
    pageSize,
    changeSort,
    changePageSize,
    reload,
    handleExport,
    handleSwitchActive,
    openCashFlow,
    openNewSupplier,
    openPassport,
    openSupplier,
    resetSearch,
    setActiveFilter,
    setDownloadModalOpened,
    setPage,
    setPassportSupplier,
    setSearchField,
    setSelectedSupplier,
    setSearchValue,
  } = model

  return (
    <Stack className="suppliers-page console-table-page" gap={6}>
      <PageHeaderActions>
        <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={openNewSupplier}>
          {t('Добавити')}
        </Button>
      </PageHeaderActions>

      <div className="console-table-shell suppliers-card">
        <div className="app-filter-bar suppliers-filter-bar">
          <SuppliersFilterToolbar
            activeFilter={activeFilter}
            isExporting={supplierAction === 'export'}
            isTableBusy={isTableBusy}
            page={page}
            pageSize={pageSize}
            searchField={searchField}
            searchFieldOptions={searchFieldOptions}
            searchInputRef={searchInputRef}
            searchValue={searchValue}
            totalPages={totalPages}
            onChangePageSize={changePageSize}
            onExport={handleExport}
            onRefresh={reload}
            onReset={resetSearch}
            onSetActiveFilter={setActiveFilter}
            onSetPage={setPage}
            onSetSearchField={setSearchField}
            onSetSearchValue={setSearchValue}
          />
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="suppliers-page__content console-table-body">
          <SupplierRegistryList
            isBusy={isTableBusy}
            isLoading={isLoading}
            sortState={sortState}
            suppliers={suppliers}
            onSort={changeSort}
            onOpen={setSelectedSupplier}
          />
        </div>
      </div>

      <SupplierDetailDrawer
        supplier={selectedSupplier}
        isActiveLoading={supplierAction === 'active'}
        onCashFlow={openCashFlow}
        onClose={() => setSelectedSupplier(null)}
        onEdit={openSupplier}
        onPassport={openPassport}
        onSwitchActive={handleSwitchActive}
      />

      <SupplierPassportModal supplier={passportSupplier} onClose={() => setPassportSupplier(null)} />

      <SupplierDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

function SupplierPassportModal({ supplier, onClose }: { supplier: Client | null; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      size="lg"
      opened={Boolean(supplier)}
      title={supplier ? `${t('Паспорт постачальника')}: ${getSupplierDisplayName(supplier)}` : t('Паспорт постачальника')}
      onClose={onClose}
    >
      {supplier && <SupplierPassport client={supplier} netUid={supplier.NetUid} />}
    </AppModal>
  )
}

type SupplierDetailDrawerProps = {
  supplier: Client | null
  isActiveLoading: boolean
  onCashFlow: (supplier: Client) => void
  onClose: () => void
  onEdit: (supplier: Client) => void
  onPassport: (supplier: Client) => void
  onSwitchActive: (supplier: Client) => void
}

function SupplierDetailDrawer({
  supplier,
  isActiveLoading,
  onCashFlow,
  onClose,
  onEdit,
  onPassport,
  onSwitchActive,
}: SupplierDetailDrawerProps) {
  const { t } = useI18n()
  const isActive = supplier?.IsActive !== false
  const roleName = supplier?.ClientInRole?.ClientTypeRole?.Name?.trim()
  const balance = supplier?.TotalCurrentAmount || 0
  const primaryAgreement = supplier ? getPrimarySupplierAgreement(supplier) : null
  const primaryAgreementName = getSupplierAgreementName(primaryAgreement)
  const primaryAgreementOrganization = getSupplierAgreementOrganization(primaryAgreement)
  const primaryAgreementCurrency = getSupplierAgreementCurrency(primaryAgreement)
  const primaryAgreementPeriod = getSupplierAgreementPeriod(primaryAgreement)
  const primaryAgreementPayment = getSupplierAgreementPaymentSummary(primaryAgreement)

  return (
    <AppDrawer
      opened={Boolean(supplier)}
      position="right"
      size="compact"
      title={supplier ? getSupplierDisplayName(supplier) : t('Постачальник')}
      onClose={onClose}
    >
      {supplier && (
        <div className="suppliers-detail">
          <section className="suppliers-detail-hero">
            <div className="suppliers-detail-hero-main">
              <ThemeIcon color={isActive ? 'orange' : 'gray'} radius="md" size={46} variant="light">
                <IconBuildingFactory2 size={24} stroke={1.8} />
              </ThemeIcon>
              <div className="suppliers-detail-hero-copy">
                <span className="suppliers-detail-eyebrow">{t('Постачальник')}</span>
                <strong>{getSupplierDisplayName(supplier)}</strong>
                <span>
                  {displayValue(supplier.SupplierCode)} · {displayValue(supplier.Country?.Name)}
                </span>
              </div>
            </div>

            <div className="suppliers-detail-metrics">
              <SupplierDetailMetric label="EUR" value={formatSupplierAmount(supplier.PurchaseVolumeEur)} />
              <SupplierDetailMetric
                label={t('Баланс')}
                tone={balance < 0 ? 'danger' : 'neutral'}
                value={formatSupplierAmount(supplier.TotalCurrentAmount)}
              />
              <SupplierDetailMetric label={t('Код')} value={displayValue(supplier.SupplierCode)} />
            </div>
          </section>

          <section className="suppliers-detail-section">
            <div className="suppliers-detail-status-strip">
              <Badge color={isActive ? 'green' : 'gray'} variant="light">
                {isActive ? t('Активний') : t('Неактивний')}
              </Badge>
              {supplier.IsNotResident && (
                <Badge color="orange" variant="light">
                  {t('Нерезидент')}
                </Badge>
              )}
              {roleName ? (
                <span className={`suppliers-profile-role is-${roleBadgeColor(roleName)}`}>{roleName}</span>
              ) : null}
            </div>
          </section>

          <section className={`suppliers-detail-section suppliers-detail-section--agreement${primaryAgreement?.Agreement?.IsActive ? ' is-active' : ''}`}>
            <div className="suppliers-detail-section-head">
              <span className="suppliers-detail-section-icon" aria-hidden>
                <IconFileDescription size={16} />
              </span>
              <div>
                <span className="suppliers-detail-eyebrow">{t('Договір')}</span>
                <strong>{displayValue(primaryAgreementName)}</strong>
              </div>
            </div>
            <div className="suppliers-detail-agreement-strip">
              <span className={primaryAgreement?.Agreement?.IsActive ? 'is-active' : ''}>
                {primaryAgreement?.Agreement?.IsActive ? t('Активний') : t('Договір')}
              </span>
              {primaryAgreementCurrency ? <span>{primaryAgreementCurrency}</span> : null}
              {primaryAgreementOrganization ? <span>{primaryAgreementOrganization}</span> : null}
            </div>
            <div className="suppliers-detail-rows">
              <SupplierDetailRow label={t('Назва')} value={primaryAgreementName} />
              <SupplierDetailRow label={t('Організація')} value={primaryAgreementOrganization} />
              <SupplierDetailRow label={t('Валюта')} value={primaryAgreementCurrency} />
              <SupplierDetailRow label={t('Період')} value={primaryAgreementPeriod} />
              <SupplierDetailRow label={t('Оплата')} value={primaryAgreementPayment} />
            </div>
          </section>

          <section className="suppliers-detail-section">
            <div className="suppliers-detail-section-head">
              <span className="suppliers-detail-section-icon" aria-hidden>
                <IconMapPin size={16} />
              </span>
              <div>
                <span className="suppliers-detail-eyebrow">{t('Поставка')}</span>
                <strong>{displayValue(supplier.Country?.Name)}</strong>
              </div>
            </div>
            <div className="suppliers-detail-rows">
              <SupplierDetailRow label={t('Країна')} value={supplier.Country?.Name} />
              <SupplierDetailRow label="Incoterms" value={getSupplierDeliveryTerms(supplier)} />
              <SupplierDetailRow label={t('Маркування')} value={getSupplierPackingSummary(supplier)} />
              <SupplierDetailRow label={t('Юридична адреса')} value={supplier.LegalAddress} />
              <SupplierDetailRow label={t('Фактична адреса')} value={supplier.ActualAddress || supplier.DeliveryAddress} />
            </div>
          </section>

          <section className="suppliers-detail-section">
            <div className="suppliers-detail-section-head">
              <span className="suppliers-detail-section-icon" aria-hidden>
                <IconPhone size={16} />
              </span>
              <div>
                <span className="suppliers-detail-eyebrow">{t('Контакти')}</span>
                <strong>{displayValue(supplier.SupplierContactName || supplier.SupplierName || supplier.Manufacturer)}</strong>
              </div>
            </div>
            <div className="suppliers-detail-rows">
              <SupplierDetailRow label={t('Телефон')} value={getSupplierPhone(supplier)} />
              <SupplierDetailRow label={t('Email')} value={supplier.EmailAddress} />
              <SupplierDetailRow label={t('Бренд')} value={supplier.Brand} />
              <SupplierDetailRow label={t('Виробник')} value={supplier.Manufacturer} />
            </div>
          </section>

          <section className="suppliers-detail-section suppliers-detail-actions">
            <Button
              fullWidth
              justify="flex-start"
              leftSection={<IconExternalLink size={16} />}
              variant="light"
              onClick={() => onEdit(supplier)}
            >
              {t('Відкрити картку')}
            </Button>
            <Button
              fullWidth
              justify="flex-start"
              leftSection={<IconCash size={16} />}
              variant="light"
              onClick={() => onCashFlow(supplier)}
            >
              {t('Взаєморозрахунки')}
            </Button>
            <Button
              fullWidth
              justify="flex-start"
              leftSection={<IconId size={16} />}
              variant="light"
              onClick={() => onPassport(supplier)}
            >
              {t('Паспорт постачальника')}
            </Button>
          </section>

          <Divider />

          <Button
            fullWidth
            color={isActive ? 'gray' : 'green'}
            justify="flex-start"
            leftSection={isActive ? <IconToggleLeft size={16} /> : <IconToggleRight size={16} />}
            loading={isActiveLoading}
            variant="light"
            onClick={() => onSwitchActive(supplier)}
          >
            {isActive ? t('Позначити неактивним') : t('Позначити активним')}
          </Button>
        </div>
      )}
    </AppDrawer>
  )
}

function SuppliersFilterToolbar({
  activeFilter,
  isExporting,
  isTableBusy,
  page,
  pageSize,
  searchField,
  searchFieldOptions,
  searchInputRef,
  searchValue,
  totalPages,
  onChangePageSize,
  onExport,
  onRefresh,
  onReset,
  onSetActiveFilter,
  onSetPage,
  onSetSearchField,
  onSetSearchValue,
}: {
  activeFilter: ActiveFilter
  isExporting: boolean
  isTableBusy: boolean
  page: number
  pageSize: number
  searchField: string
  searchFieldOptions: Array<{ label: string; value: string }>
  searchInputRef: RefObject<HTMLInputElement | null>
  searchValue: string
  totalPages: number
  onChangePageSize: (value: string | null) => void
  onExport: () => void
  onRefresh: () => void
  onReset: () => void
  onSetActiveFilter: (value: ActiveFilter) => void
  onSetPage: (value: number) => void
  onSetSearchField: (value: string) => void
  onSetSearchValue: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="sales-filter-row suppliers-filter-row">
      <TextInput
        ref={searchInputRef}
        className="sales-filter-search suppliers-filter-search-input"
        size="sm"
        leftSection={<IconSearch size={16} />}
        label={t('Виробник')}
        placeholder={t('Назва або код')}
        rightSection={isTableBusy ? <Loader color="violet" size={14} /> : undefined}
        value={searchValue}
        onChange={(event) => {
          onSetPage(1)
          onSetSearchValue(event.currentTarget.value)
        }}
      />
      <Select
        allowDeselect={false}
        className="sales-filter-control suppliers-filter-field"
        comboboxProps={SUPPLIERS_FILTER_COMBOBOX_PROPS}
        size="sm"
        label={t('Поле')}
        data={searchFieldOptions}
        scrollAreaProps={SUPPLIERS_FILTER_SCROLL_AREA_PROPS}
        value={searchField}
        onChange={(value) => {
          onSetPage(1)
          onSetSearchField(value || SUPPLIER_SEARCH_SQL)
        }}
      />
      <Select
        allowDeselect={false}
        className="sales-filter-control suppliers-filter-status"
        comboboxProps={SUPPLIERS_FILTER_COMBOBOX_PROPS}
        size="sm"
        label={t('Статус')}
        data={[
          { value: 'all', label: t('Усі') },
          { value: 'active', label: t('Активні') },
          { value: 'inactive', label: t('Неактивні') },
        ]}
        scrollAreaProps={SUPPLIERS_FILTER_SCROLL_AREA_PROPS}
        value={activeFilter}
        onChange={(value) => {
          onSetPage(1)
          onSetActiveFilter((value as ActiveFilter | null) || 'all')
        }}
      />
      <div className="app-filter-actions sales-filter-actions suppliers-filter-actions">
        <Tooltip label={t('Скинути')}>
          <ActionIcon variant="light" color="gray" size={34} aria-label={t('Скинути')} onClick={onReset}>
            <IconRestore size={17} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('Експорт в Excel')}>
          <ActionIcon
            variant="default"
            size={34}
            aria-label={t('Експорт в Excel')}
            loading={isExporting}
            onClick={onExport}
          >
            <ExcelIcon size={22} />
          </ActionIcon>
        </Tooltip>
        <Paginator
          isLoading={isTableBusy}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={onSetPage}
          onPageSizeChange={(nextPageSize) => onChangePageSize(String(nextPageSize))}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  )
}

function SupplierDocumentModal({
  document,
  opened,
  onClose,
}: {
  document: ClientPrintDocument | null
  opened: boolean
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={t('Експорт постачальників')} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.DocumentURL && (
              <Anchor href={getDocumentHref(document.DocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor href={getDocumentHref(document.PdfDocumentURL)} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-pdf">
                  <IconFileTypePdf size={22} stroke={1.8} />
                </span>
                <span>{t('PDF документ')}</span>
              </Anchor>
            )}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}

function SupplierRegistryList({
  isBusy,
  isLoading,
  sortState,
  suppliers,
  onOpen,
  onSort,
}: {
  isBusy: boolean
  isLoading: boolean
  sortState: SupplierSortState
  suppliers: Client[]
  onOpen: (supplier: Client) => void
  onSort: (id: SupplierSortId) => void
}) {
  const { t } = useI18n()

  if (isLoading) {
    return <SupplierRegistryState isLoading text={t('Завантаження постачальників')} />
  }

  if (suppliers.length === 0) {
    return <SupplierRegistryState text={t('Постачальників не знайдено')} />
  }

  return (
    <Box className={`suppliers-registry${isBusy ? ' is-busy' : ''}`} aria-busy={isBusy}>
      {isBusy && (
        <div className="suppliers-registry-loading" aria-hidden="true">
          <Loader color="orange" size="xs" />
        </div>
      )}
      <div className="suppliers-registry-head">
        <SupplierRegistrySortHeader id="supplier" label={t('Постачальник')} sortState={sortState} onSort={onSort} />
        <SupplierRegistryHeadLabel label={t('Договір')} />
        <SupplierRegistrySortHeader id="contacts" label={t('Контакти')} sortState={sortState} onSort={onSort} />
        <SupplierRegistrySortHeader align="right" id="volume" label={t('Обсяг')} sortState={sortState} onSort={onSort} />
        <SupplierRegistrySortHeader align="right" id="balance" label={t('Баланс')} sortState={sortState} onSort={onSort} />
      </div>
      <div className="suppliers-registry-body">
        {suppliers.map((supplier, index) => (
          <SupplierRegistryRow
            key={String(supplier.NetUid || supplier.Id || index)}
            supplier={supplier}
            onOpen={onOpen}
          />
        ))}
      </div>
    </Box>
  )
}

function SupplierRegistrySortHeader({
  align,
  id,
  label,
  sortState,
  onSort,
}: {
  align?: 'right'
  id: SupplierSortId
  label: string
  sortState: SupplierSortState
  onSort: (id: SupplierSortId) => void
}) {
  const isActive = sortState.id === id

  return (
    <button
      className={`suppliers-registry-sort-header${isActive ? ' is-active' : ''}${align === 'right' ? ' is-right' : ''}`}
      type="button"
      onClick={() => onSort(id)}
    >
      <span>{label}</span>
      {isActive && sortState.direction === 'desc' ? <IconChevronDown size={13} /> : <IconChevronUp size={13} />}
    </button>
  )
}

function SupplierRegistryHeadLabel({ label }: { label: string }) {
  return <span className="suppliers-registry-head-label">{label}</span>
}

function SupplierRegistryState({ isLoading = false, text }: { isLoading?: boolean; text: string }) {
  return (
    <div className="suppliers-registry-state">
      {isLoading && <Loader color="orange" size="sm" />}
      <Text c="dimmed" fw={650} size="sm">{text}</Text>
    </div>
  )
}

function SupplierRegistryRow({ supplier, onOpen }: { supplier: Client; onOpen: (supplier: Client) => void }) {
  const isActive = supplier.IsActive !== false
  const balance = supplier.TotalCurrentAmount || 0

  return (
    <button
      className={`suppliers-registry-row${isActive ? '' : ' is-inactive'}${supplier.IsNotResident ? ' is-nonresident' : ''}`}
      type="button"
      onClick={() => onOpen(supplier)}
    >
      <SupplierProfileCell supplier={supplier} />
      <SupplierAgreementCell supplier={supplier} />
      <SupplierContactCell supplier={supplier} />
      <SupplierAmountCell label="EUR" value={formatSupplierAmount(supplier.PurchaseVolumeEur)} />
      <SupplierAmountCell
        tone={balance < 0 ? 'danger' : 'muted'}
        value={formatSupplierAmount(supplier.TotalCurrentAmount)}
        footer={SHOW_SUPPLIER_ROLE_IN_BALANCE ? <SupplierRoleCell supplier={supplier} /> : undefined}
      />
    </button>
  )
}

function SupplierProfileCell({ supplier }: { supplier: Client }) {
  const { t } = useI18n()
  const name = getSupplierDisplayName(supplier)
  const isActive = supplier.IsActive !== false
  const code = displayValue(supplier.SupplierCode)
  const iconColor = !isActive ? 'gray' : supplier.IsNotResident ? 'orange' : 'teal'

  return (
    <div className="suppliers-profile-cell">
      <ThemeIcon className="suppliers-profile-icon" color={iconColor} radius="xl" size={34} variant="light">
        <IconBuildingFactory2 size={19} stroke={1.8} />
      </ThemeIcon>
      <div className="suppliers-profile-copy">
        <div className="suppliers-profile-title-row">
          <Tooltip label={name} openDelay={350} withArrow>
            <span className="suppliers-profile-name">{name}</span>
          </Tooltip>
        </div>
        <div className="suppliers-profile-meta">
          <span className={`suppliers-profile-status${isActive ? ' is-active' : ' is-inactive'}`}>
            {isActive ? t('Активний') : t('Неактивний')}
          </span>
          <span className={`suppliers-profile-code${code === '-' ? ' is-empty' : ''}`}>{code}</span>
          {supplier.IsNotResident && <span className="suppliers-profile-resident">{t('Нерезидент')}</span>}
        </div>
      </div>
    </div>
  )
}

function SupplierRoleCell({ supplier }: { supplier: Client }) {
  const roleName = supplier.ClientInRole?.ClientTypeRole?.Name?.trim()

  if (!roleName) {
    return null
  }

  return (
    <Tooltip label={roleName} openDelay={350} withArrow>
      <span className={`suppliers-profile-role is-${roleBadgeColor(roleName)}`}>{roleName}</span>
    </Tooltip>
  )
}

function SupplierAgreementCell({ supplier }: { supplier: Client }) {
  const agreement = getPrimarySupplierAgreement(supplier)
  const name = getSupplierAgreementName(agreement)?.trim()
  const organization = getSupplierAgreementOrganization(agreement)?.trim()
  const currency = getSupplierAgreementCurrency(agreement)?.trim()
  const period = getSupplierAgreementPeriod(agreement)?.trim()
  const payment = getSupplierAgreementPaymentSummary(agreement)?.trim()
  const hasAgreementInfo = Boolean(name || organization || currency || period || payment)
  const title = name || organization || translate('Без договору')
  const meta = name ? organization || period || payment : period || payment
  const isActive = agreement?.Agreement?.IsActive === true
  const tooltipDetails = [name, currency, organization, period, payment].filter(Boolean).join(' / ')

  return (
    <Tooltip disabled={!tooltipDetails} label={tooltipDetails} openDelay={350} withArrow>
      <div
        className={`suppliers-agreement-cell${hasAgreementInfo ? '' : ' is-empty'}${isActive ? ' is-active' : ''}`}
      >
        <span className="suppliers-agreement-title-row">
          {hasAgreementInfo ? <span className="suppliers-agreement-state" aria-hidden /> : null}
          <span className={`suppliers-agreement-title${hasAgreementInfo ? '' : ' is-empty'}`}>{title}</span>
        </span>
        {hasAgreementInfo && (currency || meta) ? (
          <span className="suppliers-agreement-meta">
            {currency ? <span className="suppliers-agreement-currency">{currency}</span> : null}
            {meta ? <span className="suppliers-agreement-meta-text">{meta}</span> : null}
          </span>
        ) : null}
      </div>
    </Tooltip>
  )
}

function SupplierContactCell({ supplier }: { supplier: Client }) {
  const phone = getSupplierPhone(supplier)?.trim()
  const email = supplier.EmailAddress?.trim()
  const tooltip = [phone, email].filter(Boolean).join(' / ')
  const hasContacts = Boolean(tooltip)

  return (
    <Tooltip disabled={!hasContacts} label={tooltip} openDelay={350} withArrow>
      <span className={`suppliers-contact-cell${hasContacts ? '' : ' is-empty'}`}>
        <span className="suppliers-contact-icon" aria-hidden>
          <IconAddressBook size={14} stroke={1.8} />
        </span>
        {hasContacts ? (
          <span className="suppliers-contact-copy">
            {phone ? <span className="suppliers-contact-text">{phone}</span> : null}
            {email ? <span className="suppliers-contact-text is-secondary">{email}</span> : null}
          </span>
        ) : null}
      </span>
    </Tooltip>
  )
}

function SupplierAmountCell({
  footer,
  label,
  tone,
  value,
}: {
  footer?: ReactNode
  label?: string
  tone?: 'danger' | 'muted'
  value: string
}) {
  return (
    <span className={`suppliers-amount-cell${tone ? ` is-${tone}` : ''}`}>
      <strong>{value}</strong>
      {label ? <small>{label}</small> : null}
      {footer ? <span className="suppliers-amount-footer">{footer}</span> : null}
    </span>
  )
}

function SupplierDetailMetric({
  label,
  tone,
  value,
}: {
  label: string
  tone?: 'danger' | 'neutral'
  value: string
}) {
  return (
    <span className={`suppliers-detail-metric${tone === 'danger' ? ' is-danger' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

function SupplierDetailRow({ label, value }: { label: string; value?: number | string | null }) {
  return (
    <div className="suppliers-detail-row">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  )
}

function buildSupplierSearchFieldOptions(filterItems: ClientFilterItem[]) {
  const dynamicOptions: Array<{ label: string; value: string }> = []

  filterItems
    .map((filterItem) => ({ ...filterItem, Name: getSupplierSearchFieldLabel(filterItem) }))
    .forEach((filterItem) => {
      if (filterItem.SQL) {
        dynamicOptions.push({
        label: filterItem.Name?.trim() || filterItem.Description?.trim() || filterItem.SQL || translate('Поле'),
          value: filterItem.SQL,
        })
      }
    })

  return dynamicOptions.length > 0
    ? dynamicOptions
    : DEFAULT_SUPPLIER_SEARCH_FIELD_OPTIONS.map((option) => ({ ...option, label: translate(option.label) }))
}

function getSupplierSearchFieldLabel(filterItem: ClientFilterItem): string {
  const sql = filterItem.SQL?.trim() || ''
  const mappedLabel = SUPPLIER_SEARCH_FIELD_LABELS_BY_SQL[sql]

  if (mappedLabel) {
    return translate(mappedLabel)
  }

  const rawLabel = filterItem.Name?.trim() || filterItem.Description?.trim()
  const mappedRawLabel = rawLabel
    ? SUPPLIER_SEARCH_FIELD_LABELS_BY_NAME[rawLabel.toLowerCase()]
      || SUPPLIER_SEARCH_FIELD_LABELS_BY_NAME[normalizeSupplierSearchFieldLabelKey(rawLabel)]
    : undefined

  return translate(mappedRawLabel || rawLabel || 'Поле')
}

function normalizeSupplierSearchFieldLabelKey(value: string): string {
  return value.replace(/[\s._/-]+/g, '').toLowerCase()
}

function formatSupplierAmount(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return supplierAmountFormatter.format(value)
}

function readSupplierTablePageSize() {
  if (typeof window === 'undefined') {
    return DEFAULT_SUPPLIER_TABLE_PAGE_SIZE
  }

  return normalizeSupplierTablePageSize(
    window.localStorage.getItem(SUPPLIER_TABLE_PAGE_SIZE_STORAGE_KEY),
  )
}

function writeSupplierTablePageSize(pageSize: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SUPPLIER_TABLE_PAGE_SIZE_STORAGE_KEY, String(pageSize))
}

function normalizeSupplierTablePageSize(value?: string | null) {
  return pageSizeOptions.includes(value ?? '')
    ? Number(value)
    : DEFAULT_SUPPLIER_TABLE_PAGE_SIZE
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function shouldKeepSupplierInActiveFilter(supplier: Client, activeFilter: ActiveFilter): boolean {
  if (activeFilter === 'all') {
    return true
  }

  return activeFilter === 'active' ? supplier.IsActive !== false : supplier.IsActive === false
}

function getSupplierDisplayName(supplier: Client): string {
  const fullName = supplier.FullName?.trim() || supplier.Name?.trim()

  if (fullName) {
    return fullName
  }

  return [supplier.FirstName, supplier.LastName, supplier.MiddleName].filter(Boolean).join(' ') || translate('Без назви')
}

function getSupplierPhone(supplier: Client): string | undefined {
  return supplier.MobileNumber || supplier.ClientNumber
}

function getPrimarySupplierAgreement(supplier: Client): ClientAgreement | null {
  const agreements = Array.isArray(supplier.ClientAgreements)
    ? supplier.ClientAgreements.filter((clientAgreement) => !clientAgreement.Deleted && clientAgreement.Agreement?.Deleted !== true)
    : []

  return agreements.find((clientAgreement) => clientAgreement.Agreement?.IsActive === true)
    || agreements.find((clientAgreement) => clientAgreement.Agreement)
    || agreements[0]
    || null
}

function getSupplierAgreementName(clientAgreement?: ClientAgreement | null): string | undefined {
  const agreement = clientAgreement?.Agreement

  return agreement?.Name?.trim()
    || agreement?.FullName?.trim()
    || agreement?.Number?.trim()
    || clientAgreement?.AgreementName?.trim()
    || clientAgreement?.NetUid?.trim()
}

function getSupplierAgreementOrganization(clientAgreement?: ClientAgreement | null): string | undefined {
  return clientAgreement?.Agreement?.Organization?.Name?.trim() || clientAgreement?.OriginalClientName?.trim()
}

function getSupplierAgreementCurrency(clientAgreement?: ClientAgreement | null): string | undefined {
  const currency = clientAgreement?.Agreement?.Currency

  return currency?.Code?.trim() || currency?.Name?.trim()
}

function getSupplierAgreementPeriod(clientAgreement?: ClientAgreement | null): string | undefined {
  const agreement = clientAgreement?.Agreement
  const from = formatSupplierDate(agreement?.FromDate)
  const to = formatSupplierDate(agreement?.ToDate)

  if (from && to) {
    return `${from} - ${to}`
  }

  return from || to
}

function getSupplierAgreementPaymentSummary(clientAgreement?: ClientAgreement | null): string | undefined {
  const agreement = clientAgreement?.Agreement

  if (!agreement) {
    return undefined
  }

  const paymentParts = [
    agreement.TermsOfPayment?.trim(),
    agreement.DeferredPayment ? `${agreement.DeferredPayment} ${translate('днів').toLowerCase()}` : undefined,
    !agreement.DeferredPayment && typeof agreement.NumberDaysDebt === 'number' && agreement.NumberDaysDebt > 0
      ? `${agreement.NumberDaysDebt} ${translate('днів').toLowerCase()}`
      : undefined,
    agreement.IsPrePaymentFull ? translate('Повна передплата') : undefined,
  ].filter(Boolean)

  return paymentParts.length > 0 ? paymentParts.join(' · ') : undefined
}

function formatSupplierDate(value?: Date | string): string | undefined {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/)

    if (dateOnly) {
      return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`
    }
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : supplierDateFormatter.format(date)
}

function getSupplierDeliveryTerms(supplier: Client): string | undefined {
  if (supplier.IsIncotermsElse && supplier.IncotermsElse) {
    return supplier.IncotermsElse
  }

  return supplier.Incoterm?.IncotermName || supplier.TermsOfDelivery?.Name || supplier.IncotermsElse
}

function getSupplierPackingSummary(supplier: Client): string | undefined {
  const packing = [supplier.PackingMarking?.Name, supplier.PackingMarkingPayment?.Name]
    .map((value) => value?.trim())
    .filter(Boolean)

  return packing.length > 0 ? packing.join(' · ') : undefined
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}

const ROLE_BADGE_PALETTE = ['violet', 'indigo', 'teal', 'cyan', 'blue', 'grape', 'pink', 'lime'] as const

function roleHash(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function roleBadgeColor(name: string): (typeof ROLE_BADGE_PALETTE)[number] {
  const key = name.trim().toLowerCase()

  if (key.includes('постач')) {
    return 'teal'
  }

  if (key.includes('покуп')) {
    return 'indigo'
  }

  return ROLE_BADGE_PALETTE[roleHash(key) % ROLE_BADGE_PALETTE.length]
}
