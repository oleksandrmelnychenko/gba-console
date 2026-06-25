import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconCash,
  IconExternalLink,
  IconFileTypePdf,
  IconId,
  IconPlus,
  IconRestore,
  IconSearch,
  IconToggleLeft,
  IconToggleRight,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE, PAGINATOR_PAGE_SIZE_OPTIONS } from '../../../shared/ui/paginator/paginatorPageSize'
import { type RefObject, useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { ClientTypeRoleFilter } from '../components/ClientTypeRoleFilter'
import { SupplierPassport } from '../components/SupplierPassport'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useLocation, useNavigate } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import {
  exportSuppliersDocument,
  getClientTypes,
  getSupplierFilterItems,
  getSupplierCount,
  getSuppliers,
  switchClientActiveState,
} from '../api/clientsApi'
import type { DataTableColumn, DataTableSortingState } from '../../../shared/ui/data-table/types'
import type { Client, ClientFilterItem, ClientPrintDocument, ClientType } from '../types'
import '../../../shared/ui/console-table-page.css'
import './suppliers-page.css'

const pageSizeOptions = PAGINATOR_PAGE_SIZE_OPTIONS
const SUPPLIER_CLIENT_TYPE = 1
const SUPPLIER_FILTER_ENTITY_TYPE = 7
const SUPPLIER_SEARCH_SQL = 'RegionCode.Value/Client.FullName'
const SUPPLIER_SEARCH_DEBOUNCE_MS = 350
const SUPPLIER_TABLE_PAGE_SIZE_STORAGE_KEY = 'gba-data-table:suppliers:page-size'
const DEFAULT_SUPPLIER_TABLE_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE

type ActiveFilter = 'all' | 'active' | 'inactive'
type SupplierAction = 'active' | 'export' | null
type SupplierSortId = 'purchaseVolume'


const DEFAULT_SUPPLIER_SEARCH_FIELD_OPTIONS = [
  { value: SUPPLIER_SEARCH_SQL, label: 'Код або назва' },
  { value: 'RegionCode.Value', label: 'Код регіону' },
  { value: 'Client.FullName', label: 'Повна назва' },
  { value: 'Client.ClientNumber/Client.MobileNumber', label: 'Телефон' },
  { value: 'Client.EmailAddress', label: 'Email' },
]

const SUPPLIER_SORT_COLUMNS: Record<SupplierSortId, string> = {
  purchaseVolume: 'PurchaseVolumeEur',
}

function useSuppliersPageModel() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const hasLoadedSuppliersRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [suppliers, setSuppliers] = useValueState<Client[]>([])
  const [clientTypes, setClientTypes] = useValueState<ClientType[]>([])
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
  const [roleFilter, setRoleFilter] = useValueState<string[]>([])
  const [searchField, setSearchField] = useValueState(SUPPLIER_SEARCH_SQL)
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SUPPLIER_SEARCH_DEBOUNCE_MS)
  const [sorting, setSorting] = useValueState<DataTableSortingState>([{ id: 'purchaseVolume', desc: true }])
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const offset = (page - 1) * pageSize
  const canMoveForward = suppliers.length === pageSize
  const totalPages = typeof totalCount === 'number' && totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : page + (canMoveForward ? 1 : 0)
  const active = activeFilter === 'all' ? null : activeFilter === 'active'
  const typeRoleFilter = roleFilter.join(',')
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
  const sortDescriptors = useMemo(() => buildSupplierSortDescriptors(sorting), [sorting])
  const searchParams = useMemo(
    () => ({
      active,
      filterEntityType: SUPPLIER_FILTER_ENTITY_TYPE,
      filterOperationSql: selectedFilterItem?.FilterOperationItem?.SQL,
      filterSql: searchField,
      limit: pageSize,
      offset,
      sortDescriptors,
      typeRoleFilter,
      value: normalizedSearchValue,
    }),
    [active, normalizedSearchValue, offset, pageSize, searchField, selectedFilterItem, sortDescriptors, typeRoleFilter],
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
    setClientTypes,
    setSupplierFilterItems,
    setTotalCount,
  })

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  function resetSearch() {
    setPage(1)
    setActiveFilter('all')
    setRoleFilter([])
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
    clientTypes,
    downloadDocument,
    downloadModalOpened,
    error,
    isLoading,
    isTableBusy,
    page,
    pageSize,
    passportSupplier,
    roleFilter,
    searchField,
    searchFieldOptions,
    searchInputRef,
    searchValue,
    selectedSupplier,
    sorting,
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
    setRoleFilter,
    setSearchField,
    setSelectedSupplier,
    setSorting,
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
  setClientTypes,
  setSupplierFilterItems,
  setTotalCount,
}: {
  setClientTypes: (value: ClientType[]) => void
  setSupplierFilterItems: (value: ClientFilterItem[]) => void
  setTotalCount: (value: number | null) => void
}) {
  useEffect(() => {
    let cancelled = false

    async function loadSupplierMeta() {
      try {
        const [nextTotalCount, nextClientTypes, nextFilterItems] = await Promise.all([
          getSupplierCount(),
          getClientTypes(),
          getSupplierFilterItems(),
        ])

        if (!cancelled) {
          setTotalCount(nextTotalCount)
          setClientTypes(nextClientTypes)
          setSupplierFilterItems(nextFilterItems)
        }
      } catch {
        if (!cancelled) {
          setTotalCount(null)
          setClientTypes([])
          setSupplierFilterItems([])
        }
      }
    }

    void loadSupplierMeta()

    return () => {
      cancelled = true
    }
  }, [setClientTypes, setSupplierFilterItems, setTotalCount])
}

export function SuppliersPage() {
  const model = useSuppliersPageModel()

  return <SuppliersPageView model={model} />
}

function SuppliersPageView({ model }: { model: ReturnType<typeof useSuppliersPageModel> }) {
  const { t } = useI18n()
  const {
    activeFilter,
    clientTypes,
    downloadDocument,
    downloadModalOpened,
    error,
    isLoading,
    isTableBusy,
    passportSupplier,
    roleFilter,
    searchField,
    searchFieldOptions,
    searchInputRef,
    searchValue,
    selectedSupplier,
    sorting,
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
    setRoleFilter,
    setSearchField,
    setSelectedSupplier,
    setSearchValue,
    setSorting,
  } = model
  const supplierColumns = useSupplierColumns()

  return (
    <Stack className="suppliers-page" gap={6}>
      <PageHeaderActions>
        <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={openNewSupplier}>
          {t('Добавити')}
        </Button>
      </PageHeaderActions>

      <Card className="app-data-card suppliers-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar suppliers-filter-bar">
          <SuppliersFilterToolbar
            activeFilter={activeFilter}
            clientTypes={clientTypes}
            isExporting={supplierAction === 'export'}
            isTableBusy={isTableBusy}
            page={page}
            pageSize={pageSize}
            roleFilter={roleFilter}
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
            onSetRoleFilter={setRoleFilter}
            onSetSearchField={setSearchField}
            onSetSearchValue={setSearchValue}
          />
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="suppliers-page__table">
          <DataTable
            columns={supplierColumns}
            data={suppliers}
            getRowId={(supplier, index) => String(supplier.NetUid || supplier.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="suppliers-table-1"
            loadingText={t('Завантаження постачальників')}
            emptyText={t('Постачальників не знайдено')}
            manualSorting
            minWidth={1320}
            showDensityToggle={false}
            showLayoutControls={false}
            tableId="suppliers"
            sorting={sorting}
            onRowClick={setSelectedSupplier}
            onSortingChange={(nextSorting) => {
              setPage(1)
              setSorting(nextSorting)
            }}
          />
        </div>
      </Card>

      <SupplierActionsModal
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

type SupplierActionsModalProps = {
  supplier: Client | null
  isActiveLoading: boolean
  onCashFlow: (supplier: Client) => void
  onClose: () => void
  onEdit: (supplier: Client) => void
  onPassport: (supplier: Client) => void
  onSwitchActive: (supplier: Client) => void
}

function SupplierActionsModal({
  supplier,
  isActiveLoading,
  onCashFlow,
  onClose,
  onEdit,
  onPassport,
  onSwitchActive,
}: SupplierActionsModalProps) {
  const { t } = useI18n()
  const isActive = supplier?.IsActive !== false

  return (
    <AppModal centered opened={Boolean(supplier)} title={supplier ? getSupplierDisplayName(supplier) : t('Постачальник')} onClose={onClose}>
      {supplier && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge color={isActive ? 'green' : 'gray'} variant="light">
              {isActive ? t('Активний') : t('Неактивний')}
            </Badge>
            <Text size="sm" c="dimmed">
              {displayValue(supplier.RegionCode?.Value)}
            </Text>
          </Group>

          <Stack gap="xs">
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
          </Stack>

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
        </Stack>
      )}
    </AppModal>
  )
}

function SuppliersFilterToolbar({
  activeFilter,
  clientTypes,
  isExporting,
  isTableBusy,
  page,
  pageSize,
  roleFilter,
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
  onSetRoleFilter,
  onSetSearchField,
  onSetSearchValue,
}: {
  activeFilter: ActiveFilter
  clientTypes: ClientType[]
  isExporting: boolean
  isTableBusy: boolean
  page: number
  pageSize: number
  roleFilter: string[]
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
  onSetRoleFilter: (value: string[]) => void
  onSetSearchField: (value: string) => void
  onSetSearchValue: (value: string) => void
}) {
  const { t } = useI18n()
  const supplierClientTypes = useMemo(
    () => clientTypes.filter((clientType) => clientType.Type === SUPPLIER_CLIENT_TYPE),
    [clientTypes],
  )

  return (
    <Group align="end" gap="sm" wrap="nowrap" className="suppliers-filter-row">
      <TextInput
        ref={searchInputRef}
        size="sm"
        leftSection={<IconSearch size={16} />}
        label={t('Пошук')}
        placeholder={t('Введіть значення')}
        rightSection={isTableBusy ? <Loader color="violet" size={14} /> : undefined}
        value={searchValue}
        onChange={(event) => {
          onSetPage(1)
          onSetSearchValue(event.currentTarget.value)
        }}
        style={{ flex: '1 1 auto', minWidth: 200 }}
      />
      <Select
        size="sm"
        label={t('Поле')}
        data={searchFieldOptions}
        value={searchField}
        style={{ flex: '0 0 190px' }}
        onChange={(value) => {
          onSetPage(1)
          onSetSearchField(value || SUPPLIER_SEARCH_SQL)
        }}
      />
      <Select
        size="sm"
        label={t('Статус')}
        data={[
          { value: 'all', label: t('Усі') },
          { value: 'active', label: t('Активні') },
          { value: 'inactive', label: t('Неактивні') },
        ]}
        value={activeFilter}
        style={{ flex: '0 0 122px' }}
        onChange={(value) => {
          onSetPage(1)
          onSetActiveFilter((value as ActiveFilter | null) || 'all')
        }}
      />
      <ClientTypeRoleFilter
        clientTypes={supplierClientTypes}
        value={roleFilter}
        onChange={(value) => {
          onSetPage(1)
          onSetRoleFilter(value)
        }}
      />
      <div className="app-filter-actions">
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
    </Group>
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

function useSupplierColumns() {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Client>[]>(
    () => [
      {
        id: 'status',
        header: t('Статус'),
        width: 110,
        minWidth: 96,
        enableSorting: false,
        accessor: (supplier) => (supplier.IsActive === false ? t('Неактивний') : t('Активний')),
        cell: (supplier) => (
          <Badge color={supplier.IsActive === false ? 'gray' : 'green'} variant="light">
            {supplier.IsActive === false ? t('Неактивний') : t('Активний')}
          </Badge>
        ),
      },
      {
        id: 'regionCode',
        header: t('Код'),
        width: 90,
        minWidth: 80,
        enableSorting: false,
        accessor: (supplier) => supplier.RegionCode?.Value,
        cell: (supplier) => <Text size="sm">{displayValue(supplier.RegionCode?.Value)}</Text>,
      },
      {
        id: 'supplier',
        header: t('Постачальник'),
        width: 280,
        minWidth: 220,
        fill: true,
        enableSorting: false,
        accessor: getSupplierDisplayName,
        cell: (supplier) => (
          <Tooltip label={getSupplierDisplayName(supplier)} openDelay={350} withArrow>
            <Text
              component="span"
              fw={600}
              style={{ display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {getSupplierDisplayName(supplier)}
            </Text>
          </Tooltip>
        ),
      },
      {
        id: 'location',
        header: t('Місто / район'),
        width: 180,
        minWidth: 150,
        enableSorting: false,
        accessor: (supplier) => [supplier.RegionCode?.City, supplier.RegionCode?.District].filter(Boolean).join(' '),
        cell: (supplier) => (
          <Text size="sm">
            {displayValue(supplier.RegionCode?.City)}
            {supplier.RegionCode?.District ? (
              <Text component="span" inherit c="dimmed">
                {' · '}
                {supplier.RegionCode.District}
              </Text>
            ) : null}
          </Text>
        ),
      },
      {
        id: 'role',
        header: t('Роль'),
        width: 220,
        minWidth: 200,
        enableSorting: false,
        accessor: (supplier) => supplier.ClientInRole?.ClientTypeRole?.Name,
        cell: (supplier) => {
          const name = supplier.ClientInRole?.ClientTypeRole?.Name?.trim()
          return name ? (
            <Badge color={roleBadgeColor(name)} variant="light">
              {name}
            </Badge>
          ) : (
            <Text c="dimmed">-</Text>
          )
        },
      },
      {
        id: 'notResident',
        header: t('Резидентність'),
        width: 130,
        minWidth: 110,
        enableSorting: false,
        accessor: (supplier) => supplier.IsNotResident,
        cell: (supplier) => <Text size="sm">{supplier.IsNotResident ? t('Нерезидент') : t('Резидент')}</Text>,
      },
      {
        id: 'phone',
        header: t('Телефон'),
        width: 130,
        minWidth: 110,
        enableSorting: false,
        accessor: getSupplierPhone,
        cell: (supplier) => <SupplierContactValue value={displayValue(getSupplierPhone(supplier))} />,
      },
      {
        id: 'email',
        header: 'Email',
        width: 180,
        minWidth: 150,
        enableSorting: false,
        accessor: (supplier) => supplier.EmailAddress,
        cell: (supplier) => <SupplierContactValue value={displayValue(supplier.EmailAddress)} />,
      },
    ],
    [t],
  )
}

function buildSupplierSearchFieldOptions(filterItems: ClientFilterItem[]) {
  const dynamicOptions: Array<{ label: string; value: string }> = []

  filterItems.forEach((filterItem) => {
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

function SupplierContactValue({ value }: { value: string }) {
  const isEmpty = value === '-'

  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <span className={`suppliers-contact-value${isEmpty ? ' is-empty' : ''}`}>
        {value}
      </span>
    </Tooltip>
  )
}

function buildSupplierSortDescriptors(sorting: DataTableSortingState) {
  const descriptors: Array<{ Column: string; Dir: 'asc' | 'desc' }> = []

  sorting.forEach((sortItem) => {
    if (!isSupplierSortId(sortItem.id)) {
      return
    }

    const column = SUPPLIER_SORT_COLUMNS[sortItem.id]

    descriptors.push({
      Column: column,
      Dir: sortItem.desc ? 'desc' as const : 'asc' as const,
    })
  })

  return descriptors
}

function isSupplierSortId(id: string): id is SupplierSortId {
  return id in SUPPLIER_SORT_COLUMNS
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
