import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Divider,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconFileTypePdf,
  IconPlus,
  IconRestore,
  IconSearch,
  IconToggleLeft,
  IconToggleRight,
} from '@tabler/icons-react'
import { ExternalLink, IdCard, Wallet } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE, PAGINATOR_PAGE_SIZE_OPTIONS } from '../../../shared/ui/paginator/paginatorPageSize'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
const SUPPLIERS_FILTER_COMBOBOX_PROPS = {
  position: 'bottom-start' as const,
}
const SUPPLIERS_FILTER_SCROLL_AREA_PROPS = {
  offsetScrollbars: false as const,
}
const supplierDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const SUPPLIER_TABLE_CELL_STYLE = {
  display: 'block',
  lineHeight: '18px',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const
const SUPPLIER_TABLE_MONO_STYLE = {
  fontFamily: 'var(--font-mono)',
  letterSpacing: 0,
} as const
const SUPPLIER_CODE_SUBTEXT_STYLE = {
  ...SUPPLIER_TABLE_CELL_STYLE,
  fontSize: 11,
  lineHeight: '14px',
} as const
const SUPPLIER_TABLE_MIN_WIDTH = 1240
const SUPPLIER_TABLE_DEFAULT_LAYOUT = {
  // Default view: supplier (with code beneath the name), role, TIN/USREOU/SROI,
  // phone, email, brand, manufacturer. Everything else stays available through
  // the columns menu but is hidden by default.
  columnOrder: [
    'status',
    'supplier',
    'role',
    'tin',
    'usreou',
    'sroi',
    'phone',
    'email',
    'brand',
    'manufacturer',
    'resident',
    'regionCode',
    'location',
    'director',
    'accountant',
    'fax',
    'agreement',
    'currency',
    'agreementOrg',
    'agreementPeriod',
    'payment',
    'incoterms',
    'packing',
    'reserve',
    'contactName',
    'legalAddress',
    'actualAddress',
    'deliveryAddress',
    'country',
    'created',
    'updated',
    'comment',
  ],
  columnPinning: {
    left: ['status', 'supplier'],
  },
  columnVisibility: {
    resident: false,
    regionCode: false,
    location: false,
    director: false,
    accountant: false,
    fax: false,
    agreement: false,
    currency: false,
    agreementOrg: false,
    agreementPeriod: false,
    payment: false,
    incoterms: false,
    packing: false,
    reserve: false,
    contactName: false,
    legalAddress: false,
    actualAddress: false,
    deliveryAddress: false,
    country: false,
    created: false,
    updated: false,
    comment: false,
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type ActiveFilter = 'all' | 'active' | 'inactive'
type SupplierAction = 'active' | 'export' | null

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
  const searchParams = useMemo(
    () => ({
      active,
      filterEntityType: SUPPLIER_FILTER_ENTITY_TYPE,
      filterOperationSql: selectedFilterItem?.FilterOperationItem?.SQL,
      filterSql: searchField,
      limit: pageSize,
      offset,
      value: normalizedSearchValue,
    }),
    [active, normalizedSearchValue, offset, pageSize, searchField, selectedFilterItem],
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
    supplierAction,
    suppliers,
    totalPages,
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
  const columns = useSupplierColumns()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
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
    supplierAction,
    suppliers,
    totalPages,
    page,
    pageSize,
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
          <div ref={setTableToolbarSlot} className="suppliers-table-toolbar-slot" />
          <Button
            className="suppliers-create-button"
            color={CREATE_ACTION_COLOR}
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={openNewSupplier}
          >
            {t('Добавити')}
          </Button>
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="suppliers-page__content console-table-body">
          <DataTable
            columns={columns}
            data={suppliers}
            defaultLayout={SUPPLIER_TABLE_DEFAULT_LAYOUT}
            distributeAvailableWidth
            emptyText={t('Постачальників не знайдено')}
            getRowId={(supplier, index) => String(supplier.NetUid || supplier.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="suppliers-table-9"
            loadingText={t('Завантаження постачальників')}
            minWidth={SUPPLIER_TABLE_MIN_WIDTH}
            showLayoutControls
            tableId="suppliers"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={setSelectedSupplier}
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
      classNames={{ body: 'supplier-passport-modal-body' }}
      size="lg"
      opened={Boolean(supplier)}
      title={
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {supplier ? `${t('Паспорт постачальника')}: ${getSupplierDisplayName(supplier)}` : t('Паспорт постачальника')}
        </span>
      }
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

  return (
    <AppModal
      centered
      size={496}
      opened={Boolean(supplier)}
      title={
        <span style={{ alignItems: 'center', display: 'inline-flex', fontFamily: 'var(--font-mono)', gap: 8 }}>
          <span
            style={{
              background: isActive ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-4)',
              borderRadius: 999,
              boxShadow: isActive ? '0 0 0 3px rgba(64, 192, 87, 0.16)' : 'none',
              flex: '0 0 auto',
              height: 9,
              width: 9,
            }}
          />
          {supplier ? getSupplierDisplayName(supplier) : t('Постачальник')}
        </span>
      }
      onClose={onClose}
    >
      {supplier && (
        <div className="suppliers-detail">
          <section className="suppliers-detail-section suppliers-detail-actions">
            <Button
              fullWidth
              justify="flex-start"
              color="dark"
              size="md"
              leftSection={<SupplierDetailActionIcon icon={<ExternalLink size={20} color="var(--mantine-color-gray-7)" />} />}
              variant="subtle"
              onClick={() => onEdit(supplier)}
            >
              {t('Відкрити картку')}
            </Button>
            <Button
              fullWidth
              justify="flex-start"
              color="dark"
              size="md"
              leftSection={<SupplierDetailActionIcon icon={<Wallet size={20} color="var(--mantine-color-gray-7)" />} />}
              variant="subtle"
              onClick={() => onCashFlow(supplier)}
            >
              {t('Взаєморозрахунки')}
            </Button>
            <Button
              fullWidth
              justify="flex-start"
              color="dark"
              size="md"
              leftSection={<SupplierDetailActionIcon icon={<IdCard size={20} color="var(--mantine-color-gray-7)" />} />}
              variant="subtle"
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
    </AppModal>
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
        label={t('Назва або код')}
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

function SupplierDetailActionIcon({ icon }: { icon: ReactNode }) {
  return <span className="suppliers-detail-action-icon">{icon}</span>
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

/* Native title instead of Mantine Tooltip: with ~34 columns a Tooltip per cell
   means hundreds of Floating-UI hook instances re-running on every table render
   (resize/sort/hover) — the main source of the table lag. */
function SupplierTableValue({ fw, mono, value }: { fw?: number; mono?: boolean; value: string }) {
  return (
    <Text
      component="span"
      fw={fw}
      style={mono ? { ...SUPPLIER_TABLE_CELL_STYLE, ...SUPPLIER_TABLE_MONO_STYLE } : SUPPLIER_TABLE_CELL_STYLE}
      title={value}
    >
      {value}
    </Text>
  )
}

/* Supplier column cell: name with the supplier code as a second, dimmed line
   (the standalone «Код» column was folded in here). */
function SupplierNameCell({ supplier }: { supplier: Client }) {
  const name = getSupplierDisplayName(supplier)
  const code = displayValue(supplier.SupplierCode)

  return (
    <span style={{ display: 'block', minWidth: 0 }} title={code ? `${name} · ${code}` : name}>
      <Text component="span" fw={600} style={SUPPLIER_TABLE_CELL_STYLE}>
        {name}
      </Text>
      {code ? (
        <Text component="span" c="dimmed" style={SUPPLIER_CODE_SUBTEXT_STYLE}>
          {code}
        </Text>
      ) : null}
    </span>
  )
}

function SupplierStatusDot({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <span className="suppliers-status-dot-wrap" aria-label={label} title={label}>
      <span className={isActive ? 'suppliers-status-dot is-active' : 'suppliers-status-dot is-inactive'} />
    </span>
  )
}

function useSupplierColumns() {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Client>[]>(
    () => [
      {
        id: 'status',
        header: '',
        width: 48,
        minWidth: 44,
        accessor: (supplier) => (supplier.IsActive === false ? t('Неактивний') : t('Активний')),
        cell: (supplier) => {
          const isActive = supplier.IsActive !== false
          return <SupplierStatusDot isActive={isActive} label={isActive ? t('Активний') : t('Неактивний')} />
        },
      },
      {
        id: 'supplier',
        header: 'Постачальник',
        width: 360,
        minWidth: 320,
        accessor: getSupplierDisplayName,
        cell: (supplier) => <SupplierNameCell supplier={supplier} />,
      },
      {
        id: 'role',
        header: 'Роль',
        width: 132,
        minWidth: 110,
        accessor: (supplier) => supplier.ClientInRole?.ClientTypeRole?.Name || '',
        cell: (supplier) => {
          const name = supplier.ClientInRole?.ClientTypeRole?.Name?.trim()
          return name ? (
            <Badge className="app-role-pill" variant="light">
              {name}
            </Badge>
          ) : null
        },
      },
      {
        id: 'resident',
        header: 'Резидентність',
        width: 132,
        minWidth: 110,
        accessor: (supplier) => (supplier.IsNotResident ? t('Нерезидент') : t('Резидент')),
        cell: (supplier) => (
          <Badge className={supplier.IsNotResident ? 'app-role-pill is-orange' : 'app-role-pill is-gray'} variant="light">
            {supplier.IsNotResident ? t('Нерезидент') : t('Резидент')}
          </Badge>
        ),
      },
      {
        id: 'regionCode',
        header: 'Регіон (код)',
        width: 120,
        minWidth: 96,
        accessor: (supplier) => supplier.RegionCode?.Value,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.RegionCode?.Value)} />,
      },
      {
        id: 'location',
        header: 'Місто / район',
        width: 170,
        minWidth: 140,
        accessor: (supplier) => [supplier.RegionCode?.City, supplier.RegionCode?.District].filter(Boolean).join(' '),
        cell: (supplier) => (
          <SupplierTableValue
            value={displayValue([supplier.RegionCode?.City, supplier.RegionCode?.District].filter(Boolean).join(' ') || undefined)}
          />
        ),
      },
      {
        id: 'tin',
        header: 'ІПН',
        width: 118,
        minWidth: 96,
        accessor: (supplier) => supplier.TIN,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.TIN)} />,
      },
      {
        id: 'usreou',
        header: 'ЄДРПОУ',
        width: 122,
        minWidth: 100,
        accessor: (supplier) => supplier.USREOU,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.USREOU)} />,
      },
      {
        id: 'sroi',
        header: 'SROI',
        width: 118,
        minWidth: 96,
        accessor: (supplier) => supplier.SROI,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.SROI)} />,
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 132,
        minWidth: 110,
        accessor: getSupplierPhone,
        cell: (supplier) => <SupplierTableValue value={displayValue(getSupplierPhone(supplier))} />,
      },
      {
        id: 'director',
        header: 'Тел. директора',
        width: 144,
        minWidth: 116,
        accessor: (supplier) => supplier.DirectorNumber,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.DirectorNumber)} />,
      },
      {
        id: 'accountant',
        header: 'Тел. бухгалтера',
        width: 150,
        minWidth: 120,
        accessor: (supplier) => supplier.AccountantNumber,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.AccountantNumber)} />,
      },
      {
        id: 'fax',
        header: 'Факс',
        width: 124,
        minWidth: 100,
        accessor: (supplier) => supplier.FaxNumber,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.FaxNumber)} />,
      },
      {
        id: 'email',
        header: 'Email',
        width: 184,
        minWidth: 150,
        accessor: (supplier) => supplier.EmailAddress,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.EmailAddress)} />,
      },
      {
        id: 'agreement',
        header: 'Договір',
        width: 190,
        minWidth: 150,
        accessor: (supplier) => getSupplierAgreementName(getPrimarySupplierAgreement(supplier)),
        cell: (supplier) => (
          <SupplierTableValue value={displayValue(getSupplierAgreementName(getPrimarySupplierAgreement(supplier)))} />
        ),
      },
      {
        id: 'currency',
        header: 'Валюта',
        width: 96,
        minWidth: 80,
        accessor: (supplier) => getSupplierAgreementCurrency(getPrimarySupplierAgreement(supplier)),
        cell: (supplier) => (
          <SupplierTableValue value={displayValue(getSupplierAgreementCurrency(getPrimarySupplierAgreement(supplier)))} />
        ),
      },
      {
        id: 'agreementOrg',
        header: 'Організація (договір)',
        width: 190,
        minWidth: 150,
        accessor: (supplier) => getSupplierAgreementOrganization(getPrimarySupplierAgreement(supplier)),
        cell: (supplier) => (
          <SupplierTableValue value={displayValue(getSupplierAgreementOrganization(getPrimarySupplierAgreement(supplier)))} />
        ),
      },
      {
        id: 'agreementPeriod',
        header: 'Період договору',
        width: 170,
        minWidth: 140,
        accessor: (supplier) => getSupplierAgreementPeriod(getPrimarySupplierAgreement(supplier)),
        cell: (supplier) => (
          <SupplierTableValue value={displayValue(getSupplierAgreementPeriod(getPrimarySupplierAgreement(supplier)))} />
        ),
      },
      {
        id: 'payment',
        header: 'Оплата',
        width: 176,
        minWidth: 140,
        accessor: (supplier) => getSupplierAgreementPaymentSummary(getPrimarySupplierAgreement(supplier)),
        cell: (supplier) => (
          <SupplierTableValue value={displayValue(getSupplierAgreementPaymentSummary(getPrimarySupplierAgreement(supplier)))} />
        ),
      },
      {
        id: 'incoterms',
        header: 'Умови поставки',
        width: 160,
        minWidth: 130,
        accessor: getSupplierDeliveryTerms,
        cell: (supplier) => <SupplierTableValue value={displayValue(getSupplierDeliveryTerms(supplier))} />,
      },
      {
        id: 'packing',
        header: 'Пакування',
        width: 160,
        minWidth: 130,
        accessor: getSupplierPackingSummary,
        cell: (supplier) => <SupplierTableValue value={displayValue(getSupplierPackingSummary(supplier))} />,
      },
      {
        id: 'reserve',
        header: 'Резерв',
        width: 98,
        minWidth: 80,
        align: 'right',
        accessor: (supplier) => supplier.OrderExpireDays,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.OrderExpireDays)} />,
      },
      {
        id: 'brand',
        header: 'Бренд',
        width: 140,
        minWidth: 110,
        accessor: (supplier) => supplier.Brand,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.Brand)} />,
      },
      {
        id: 'manufacturer',
        header: 'Виробник',
        width: 160,
        minWidth: 130,
        accessor: (supplier) => supplier.Manufacturer,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.Manufacturer)} />,
      },
      {
        id: 'contactName',
        header: 'Контактна особа',
        width: 176,
        minWidth: 140,
        accessor: (supplier) => supplier.SupplierContactName,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.SupplierContactName)} />,
      },
      {
        id: 'legalAddress',
        header: 'Юр. адреса',
        width: 210,
        minWidth: 150,
        accessor: (supplier) => supplier.LegalAddress,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.LegalAddress)} />,
      },
      {
        id: 'actualAddress',
        header: 'Факт. адреса',
        width: 210,
        minWidth: 150,
        accessor: (supplier) => supplier.ActualAddress,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.ActualAddress)} />,
      },
      {
        id: 'deliveryAddress',
        header: 'Адреса доставки',
        width: 210,
        minWidth: 150,
        accessor: (supplier) => supplier.DeliveryAddress,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.DeliveryAddress)} />,
      },
      {
        id: 'country',
        header: 'Країна',
        width: 130,
        minWidth: 100,
        accessor: (supplier) => supplier.Country?.Name,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.Country?.Name)} />,
      },
      {
        id: 'created',
        header: 'Створено',
        width: 122,
        minWidth: 100,
        accessor: (supplier) => (typeof supplier.Created === 'string' ? supplier.Created : undefined),
        cell: (supplier) => <SupplierTableValue value={formatSupplierDate(supplier.Created) ?? ''} />,
      },
      {
        id: 'updated',
        header: 'Оновлено',
        width: 122,
        minWidth: 100,
        accessor: (supplier) => (typeof supplier.Updated === 'string' ? supplier.Updated : undefined),
        cell: (supplier) => <SupplierTableValue value={formatSupplierDate(supplier.Updated) ?? ''} />,
      },
      {
        id: 'comment',
        header: 'Коментар',
        width: 210,
        minWidth: 150,
        accessor: (supplier) => supplier.Comment,
        cell: (supplier) => <SupplierTableValue value={displayValue(supplier.Comment)} />,
      },
    ],
    [t],
  )
}

function buildSupplierSearchFieldOptions(filterItems: ClientFilterItem[]) {
  const dynamicOptions: Array<{ label: string; value: string }> = []

  filterItems.forEach((filterItem) => {
    if (filterItem.SQL) {
      const label = getSupplierSearchFieldLabel(filterItem)

      dynamicOptions.push({
        label: label.trim() || filterItem.Description?.trim() || filterItem.SQL || translate('Поле'),
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

/* Five agreement columns call this from both accessor and cell — without a cache
   that is ~10 array traversals per row on EVERY table render. Client objects are
   stable per fetch, so a WeakMap keyed by the row object is safe. */
const primarySupplierAgreementCache = new WeakMap<Client, ClientAgreement | null>()

function getPrimarySupplierAgreement(supplier: Client): ClientAgreement | null {
  const cached = primarySupplierAgreementCache.get(supplier)

  if (cached !== undefined) {
    return cached
  }

  const agreements = Array.isArray(supplier.ClientAgreements)
    ? supplier.ClientAgreements.filter((clientAgreement) => !clientAgreement.Deleted && clientAgreement.Agreement?.Deleted !== true)
    : []
  const primary = agreements.find((clientAgreement) => clientAgreement.Agreement?.IsActive === true)
    || agreements.find((clientAgreement) => clientAgreement.Agreement)
    || agreements[0]
    || null

  primarySupplierAgreementCache.set(supplier, primary)

  return primary
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

  // Empty values render as blank cells (no dash placeholder).
  return value?.trim() || ''
}

