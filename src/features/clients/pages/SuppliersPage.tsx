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
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useDebouncedValue } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconCash,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconExternalLink,
  IconFileTypePdf,
  IconFileTypeXls,
  IconPlus,
  IconRestore,
  IconSearch,
  IconToggleLeft,
  IconToggleRight,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useLocation, useNavigate } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  exportSuppliersDocument,
  getClientTypes,
  getSupplierFilterItems,
  getSupplierCount,
  getSuppliers,
  switchClientActiveState,
} from '../api/clientsApi'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type {
  DataTableColumn,
  DataTableDefaultLayout,
  DataTableSortingState,
} from '../../../shared/ui/data-table/types'
import type { Client, ClientFilterItem, ClientPrintDocument, ClientType } from '../types'

const pageSizeOptions = ['15', '30', '50']
const SUPPLIER_CLIENT_TYPE = 1
const SUPPLIER_FILTER_ENTITY_TYPE = 7
const SUPPLIER_SEARCH_SQL = 'RegionCode.Value/Client.FullName'
const SUPPLIER_SEARCH_DEBOUNCE_MS = 350
const SUPPLIER_TABLE_PAGE_SIZE_STORAGE_KEY = 'gba-data-table:suppliers:page-size'
const DEFAULT_SUPPLIER_TABLE_PAGE_SIZE = 30
const SUPPLIER_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'regionCode', 'supplier'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type ActiveFilter = 'all' | 'active' | 'inactive'
type SupplierAction = 'active' | 'export' | null

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const DEFAULT_SUPPLIER_SEARCH_FIELD_OPTIONS = [
  { value: SUPPLIER_SEARCH_SQL, label: 'Код або назва' },
  { value: 'RegionCode.Value', label: 'Код регіону' },
  { value: 'Client.FullName', label: 'Повна назва' },
  { value: 'Client.ClientNumber/Client.MobileNumber', label: 'Телефон' },
  { value: 'Client.EmailAddress', label: 'Email' },
]

const SUPPLIER_SORT_COLUMNS: Record<string, string> = {
  balance: 'TotalCurrentAmount',
  email: 'EmailAddress',
  notResident: 'IsNotResident',
  phone: 'MobileNumber',
  regionCode: 'RegionCode.Value',
  role: '[ClientInRole.ClientTypeRole].Name',
  status: 'IsActive',
  supplier: 'FullName',
}

function useSuppliersPageModel() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const hasLoadedSuppliersRef = useRef(false)
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
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(readSupplierTablePageSize)
  const [activeFilter, setActiveFilter] = useValueState<ActiveFilter>('all')
  const [roleFilter, setRoleFilter] = useValueState<string[]>([])
  const [searchField, setSearchField] = useValueState(SUPPLIER_SEARCH_SQL)
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SUPPLIER_SEARCH_DEBOUNCE_MS)
  const [sorting, setSorting] = useValueState<DataTableSortingState>([])
  const offset = (page - 1) * pageSize
  const canMoveBack = page > 1
  const canMoveForward = suppliers.length === pageSize
  const active = activeFilter === 'all' ? null : activeFilter === 'active'
  const typeRoleFilter = roleFilter.join(',')
  const searchFieldOptions = useMemo(() => buildSupplierSearchFieldOptions(supplierFilterItems), [supplierFilterItems])
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
  const roleOptions = useMemo(() => buildSupplierRoleOptions(clientTypes), [clientTypes])
  const openSupplierActions = useCallback((supplier: Client) => setSelectedSupplier(supplier), [setSelectedSupplier])
  const supplierColumns = useSupplierColumns(openSupplierActions)
  const changePageSize = useCallback((value: string | null) => {
    const nextPageSize = normalizeSupplierTablePageSize(value)

    setPage(1)
    setPageSize(nextPageSize)
    writeSupplierTablePageSize(nextPageSize)
  }, [setPage, setPageSize])
  const tableToolbarLeft = useMemo(
    () => (
      <SupplierTableSummary
        count={suppliers.length}
        page={page}
        searchValue={normalizedSearchValue}
        totalCount={totalCount}
      />
    ),
    [normalizedSearchValue, page, suppliers.length, totalCount],
  )
  const tableToolbarRight = useMemo(
    () => (
      <SupplierTablePagination
        canMoveBack={canMoveBack}
        canMoveForward={canMoveForward}
        isTableBusy={isTableBusy}
        page={page}
        pageSize={pageSize}
        onPageSizeChange={changePageSize}
        onSetPage={setPage}
      />
    ),
    [canMoveBack, canMoveForward, changePageSize, isTableBusy, page, pageSize, setPage],
  )

  useSupplierListLoader({
    hasLoadedSuppliersRef,
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

    navigate(`/clients/edit/${supplier.NetUid}`, {
      state: {
        backgroundLocation: location,
        moduleTitle: t('Постачальники'),
        nodeTitle: getSupplierDisplayName(supplier),
        returnPath: `${location.pathname}${location.search}`,
      },
    })
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
    canMoveBack,
    canMoveForward,
    downloadDocument,
    downloadModalOpened,
    error,
    isLoading,
    isTableBusy,
    page,
    pageSize,
    roleFilter,
    roleOptions,
    searchField,
    searchFieldOptions,
    searchValue,
    selectedSupplier,
    sorting,
    supplierAction,
    supplierColumns,
    suppliers,
    tableToolbarLeft,
    tableToolbarRight,
    totalCount,
    handleExport,
    handleSwitchActive,
    openCashFlow,
    openNewSupplier,
    openSupplier,
    resetSearch,
    setActiveFilter,
    setDownloadModalOpened,
    setPage,
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
  searchParams,
  setError,
  setLoading,
  setRefreshing,
  setSuppliers,
}: {
  hasLoadedSuppliersRef: { current: boolean }
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
  }, [hasLoadedSuppliersRef, searchParams, setError, setLoading, setRefreshing, setSuppliers, t])
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
    downloadDocument,
    downloadModalOpened,
    error,
    isLoading,
    isTableBusy,
    roleFilter,
    roleOptions,
    searchField,
    searchFieldOptions,
    searchValue,
    selectedSupplier,
    sorting,
    supplierAction,
    supplierColumns,
    suppliers,
    tableToolbarLeft,
    tableToolbarRight,
    handleExport,
    handleSwitchActive,
    openCashFlow,
    openNewSupplier,
    openSupplier,
    resetSearch,
    setActiveFilter,
    setDownloadModalOpened,
    setPage,
    setRoleFilter,
    setSearchField,
    setSelectedSupplier,
    setSearchValue,
    setSorting,
  } = model

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <SuppliersFilterToolbar
            activeFilter={activeFilter}
            isExporting={supplierAction === 'export'}
            isTableBusy={isTableBusy}
            roleFilter={roleFilter}
            roleOptions={roleOptions}
            searchField={searchField}
            searchFieldOptions={searchFieldOptions}
            searchValue={searchValue}
            onCreate={openNewSupplier}
            onExport={handleExport}
            onReset={resetSearch}
            onSetActiveFilter={setActiveFilter}
            onSetPage={setPage}
            onSetRoleFilter={setRoleFilter}
            onSetSearchField={setSearchField}
            onSetSearchValue={setSearchValue}
          />

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <DataTable
            columns={supplierColumns}
            data={suppliers}
            defaultLayout={SUPPLIER_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Постачальників не знайдено')}
            getRowId={(supplier, index) => String(supplier.NetUid || supplier.Id || index)}
            height="calc(100vh - 240px)"
            isLoading={isLoading}
            layoutVersion="suppliers-table-default-freeze-1"
            loadingText={t('Завантаження постачальників')}
            manualSorting
            minWidth={1120}
            tableId="suppliers"
            sorting={sorting}
            toolbarLeft={tableToolbarLeft}
            toolbarRight={tableToolbarRight}
            onRowClick={setSelectedSupplier}
            onSortingChange={(nextSorting) => {
              setPage(1)
              setSorting(nextSorting)
            }}
          />
        </Stack>
      </Card>

      <SupplierActionsModal
        supplier={selectedSupplier}
        isActiveLoading={supplierAction === 'active'}
        onCashFlow={openCashFlow}
        onClose={() => setSelectedSupplier(null)}
        onEdit={openSupplier}
        onSwitchActive={handleSwitchActive}
      />

      <SupplierDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

type SupplierActionsModalProps = {
  supplier: Client | null
  isActiveLoading: boolean
  onCashFlow: (supplier: Client) => void
  onClose: () => void
  onEdit: (supplier: Client) => void
  onSwitchActive: (supplier: Client) => void
}

function SupplierActionsModal({
  supplier,
  isActiveLoading,
  onCashFlow,
  onClose,
  onEdit,
  onSwitchActive,
}: SupplierActionsModalProps) {
  const { t } = useI18n()
  const isActive = supplier?.IsActive !== false

  return (
    <Modal centered opened={Boolean(supplier)} title={supplier ? getSupplierDisplayName(supplier) : t('Постачальник')} onClose={onClose}>
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
              {t('Рух коштів')}
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
    </Modal>
  )
}

function SuppliersFilterToolbar({
  activeFilter,
  isExporting,
  isTableBusy,
  roleFilter,
  roleOptions,
  searchField,
  searchFieldOptions,
  searchValue,
  onCreate,
  onExport,
  onReset,
  onSetActiveFilter,
  onSetPage,
  onSetRoleFilter,
  onSetSearchField,
  onSetSearchValue,
}: {
  activeFilter: ActiveFilter
  isExporting: boolean
  isTableBusy: boolean
  roleFilter: string[]
  roleOptions: Array<{ label: string; value: string }>
  searchField: string
  searchFieldOptions: Array<{ label: string; value: string }>
  searchValue: string
  onCreate: () => void
  onExport: () => void
  onReset: () => void
  onSetActiveFilter: (value: ActiveFilter) => void
  onSetPage: (value: number) => void
  onSetRoleFilter: (value: string[]) => void
  onSetSearchField: (value: string) => void
  onSetSearchValue: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
      <TextInput
        leftSection={<IconSearch size={16} />}
        label={t('Пошук')}
        placeholder={t('Введіть значення')}
        rightSection={isTableBusy ? <Loader color="violet" size={14} /> : undefined}
        value={searchValue}
        onChange={(event) => {
          onSetPage(1)
          onSetSearchValue(event.currentTarget.value)
        }}
        style={{ flex: '1 1 auto', minWidth: 160 }}
      />
      <Select
        label={t('Поле')}
        data={searchFieldOptions}
        value={searchField}
        style={{ flex: '0 0 180px' }}
        onChange={(value) => {
          onSetPage(1)
          onSetSearchField(value || SUPPLIER_SEARCH_SQL)
        }}
      />
      <Select
        label={t('Статус')}
        data={[
          { value: 'all', label: t('Усі') },
          { value: 'active', label: t('Активні') },
          { value: 'inactive', label: t('Неактивні') },
        ]}
        value={activeFilter}
        style={{ flex: '0 0 130px' }}
        onChange={(value) => {
          onSetPage(1)
          onSetActiveFilter((value as ActiveFilter | null) || 'all')
        }}
      />
      <MultiSelect
        clearable
        data={roleOptions}
        disabled={roleOptions.length === 0}
        label={t('Ролі')}
        maxDropdownHeight={280}
        placeholder={t('Усі ролі')}
        value={roleFilter}
        style={{ flex: '0 0 220px' }}
        onChange={(value) => {
          onSetPage(1)
          onSetRoleFilter(value)
        }}
      />
      <Tooltip label={t('Скинути')}>
        <ActionIcon variant="light" color="gray" size={36} aria-label={t('Скинути')} onClick={onReset} style={{ flex: '0 0 auto' }}>
          <IconRestore size={18} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('Експорт в Excel')}>
        <ActionIcon
          variant="light"
          color="green"
          size={36}
          aria-label={t('Експорт в Excel')}
          loading={isExporting}
          onClick={onExport}
          style={{ flex: '0 0 auto' }}
        >
          <IconFileTypeXls size={20} stroke={1.8} />
        </ActionIcon>
      </Tooltip>
      <Button leftSection={<IconPlus size={16} />} color="violet" onClick={onCreate} style={{ flex: '0 0 auto' }}>
        {t('Новий виробник...')}
      </Button>
    </Group>
  )
}

function SupplierTableSummary({
  count,
  page,
  searchValue,
  totalCount,
}: {
  count: number
  page: number
  searchValue: string
  totalCount: number | null
}) {
  const { t } = useI18n()

  return (
    <Text size="xs" c="dimmed">
      {t('Показано')} {count},{' '}
      <Text component="span" inherit c="dark" fw={700}>
        {t('сторінка')} {page}
      </Text>
      {typeof totalCount === 'number' ? `, ${t('всього')} ${totalCount}` : ''}
      {searchValue ? `, ${t('фільтр')}: ${searchValue}` : ''}
    </Text>
  )
}

function SupplierTablePagination({
  canMoveBack,
  canMoveForward,
  isTableBusy,
  page,
  pageSize,
  onPageSizeChange,
  onSetPage,
}: {
  canMoveBack: boolean
  canMoveForward: boolean
  isTableBusy: boolean
  page: number
  pageSize: number
  onPageSizeChange: (value: string | null) => void
  onSetPage: (value: number | ((currentPage: number) => number)) => void
}) {
  const { t } = useI18n()

  return (
    <Group gap={4} wrap="nowrap">
      <Select
        aria-label={t('Розмір сторінки')}
        data={pageSizeOptions}
        disabled={isTableBusy}
        size="xs"
        value={String(pageSize)}
        w={68}
        onChange={onPageSizeChange}
      />
      <Text size="xs" c="dark" fw={700} style={{ whiteSpace: 'nowrap' }}>
        {t('стор.')} {page}
      </Text>
      <ActionIcon
        aria-label={t('Попередня сторінка')}
        color="gray"
        disabled={!canMoveBack || isTableBusy}
        size="sm"
        variant="subtle"
        onClick={() => onSetPage((currentPage) => Math.max(1, currentPage - 1))}
      >
        <IconChevronLeft size={16} />
      </ActionIcon>
      <ActionIcon
        aria-label={t('Наступна сторінка')}
        color="gray"
        disabled={!canMoveForward || isTableBusy}
        size="sm"
        variant="subtle"
        onClick={() => onSetPage((currentPage) => currentPage + 1)}
      >
        <IconChevronRight size={16} />
      </ActionIcon>
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
    <Modal centered opened={opened} title={t('Експорт постачальників')} onClose={onClose}>
      <Stack gap="sm">
        {document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.DocumentURL && (
              <Anchor href={document.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <IconFileTypeXls size={22} stroke={1.8} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor href={document.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
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
    </Modal>
  )
}

function useSupplierColumns(onOpenActions: (supplier: Client) => void) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Client>[]>(
    () => [
      {
        id: 'status',
        header: 'Статус',
        width: 118,
        minWidth: 108,
        accessor: (supplier) => (supplier.IsActive === false ? t('Неактивний') : t('Активний')),
        cell: (supplier) => (
          <Badge color={supplier.IsActive === false ? 'gray' : 'green'} variant="light">
            {supplier.IsActive === false ? t('Неактивний') : t('Активний')}
          </Badge>
        ),
      },
      {
        id: 'regionCode',
        header: 'Код',
        width: 96,
        minWidth: 84,
        accessor: (supplier) => supplier.RegionCode?.Value,
        cell: (supplier) => displayValue(supplier.RegionCode?.Value),
      },
      {
        id: 'supplier',
        header: 'Постачальник',
        width: 300,
        minWidth: 220,
        accessor: getSupplierDisplayName,
        cell: (supplier) => <Text fw={600}>{getSupplierDisplayName(supplier)}</Text>,
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 150,
        minWidth: 132,
        accessor: getSupplierPhone,
        cell: (supplier) => displayValue(getSupplierPhone(supplier)),
      },
      {
        id: 'balance',
        header: 'Поточний баланс',
        width: 150,
        minWidth: 130,
        align: 'right',
        accessor: (supplier) => supplier.TotalCurrentAmount,
        cell: (supplier) => formatAmount(supplier.TotalCurrentAmount),
      },
      {
        id: 'email',
        header: 'Email',
        width: 220,
        minWidth: 160,
        accessor: (supplier) => supplier.EmailAddress,
        cell: (supplier) => displayValue(supplier.EmailAddress),
      },
      {
        id: 'notResident',
        header: 'Нерезидент',
        width: 132,
        minWidth: 112,
        accessor: (supplier) => Boolean(supplier.IsNotResident),
        cell: (supplier) =>
          supplier.IsNotResident ? (
            <Badge color="orange" variant="light">
              {t('Так')}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              -
            </Text>
          ),
      },
      {
        id: 'role',
        header: 'Роль',
        width: 180,
        minWidth: 140,
        accessor: (supplier) => supplier.ClientInRole?.ClientTypeRole?.Name,
        cell: (supplier) => displayValue(supplier.ClientInRole?.ClientTypeRole?.Name),
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
        cell: (supplier) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Дії')}>
              <ActionIcon
                aria-label={t('Дії')}
                color="gray"
                variant="subtle"
                onClick={() => onOpenActions(supplier)}
              >
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [onOpenActions, t],
  )
}

function buildSupplierRoleOptions(clientTypes: ClientType[]) {
  const options: Array<{ label: string; value: string }> = []

  clientTypes.forEach((clientType) => {
    if (clientType.Type !== SUPPLIER_CLIENT_TYPE) {
      return
    }

    const roles = clientType.ClientTypeRoles || []

    roles.forEach((role) => {
      if (typeof role.Id === 'number') {
        options.push({
          value: String(role.Id),
          label: [clientType.Name, role.Name].filter(Boolean).join(': ') || translate('Без назви'),
        })
      }
    })
  })

  return options
}

function buildSupplierSearchFieldOptions(filterItems: ClientFilterItem[]) {
  const dynamicOptions: Array<{ label: string; value: string }> = []

  filterItems.forEach((filterItem) => {
    if (filterItem.SQL) {
      dynamicOptions.push({
        value: filterItem.SQL,
        label: filterItem.Name?.trim() || filterItem.Description?.trim() || filterItem.SQL,
      })
    }
  })

  return dynamicOptions.length > 0
    ? dynamicOptions
    : DEFAULT_SUPPLIER_SEARCH_FIELD_OPTIONS.map((option) => ({ ...option, label: translate(option.label) }))
}

function buildSupplierSortDescriptors(sorting: DataTableSortingState) {
  const descriptors: Array<{ Column: string; Dir: 'asc' | 'desc' }> = []

  sorting.forEach((sortItem) => {
    const column = SUPPLIER_SORT_COLUMNS[sortItem.id]

    if (column) {
      descriptors.push({
        Column: column,
        Dir: sortItem.desc ? 'desc' as const : 'asc' as const,
      })
    }
  })

  return descriptors
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

function formatAmount(value?: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : '-'
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
