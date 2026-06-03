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
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCash,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDotsVertical,
  IconExternalLink,
  IconFileTypePdf,
  IconHierarchy2,
  IconPlus,
  IconRestore,
  IconSearch,
  IconToggleLeft,
  IconToggleRight,
} from '@tabler/icons-react'
import { useDebouncedValue } from '@mantine/hooks'
import { type FormEvent, type RefObject, useCallback, useEffect, useMemo, useRef } from 'react'
import { ClientTypeRoleFilter } from '../components/ClientTypeRoleFilter'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type {
  DataTableColumn,
  DataTableDefaultLayout,
  DataTableSortingState,
} from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  exportClientsDocument,
  getClientCount,
  getClientFilterItems,
  getClients,
  getClientTypes,
  switchClientActiveState,
  updateClientOrderExpireDays,
} from '../api/clientsApi'
import type { Client, ClientFilterItem, ClientPrintDocument, ClientType } from '../types'

const pageSizeOptions = ['15', '30', '50']
const CLIENT_SEARCH_SQL = 'RegionCode.Value/Client.FullName/Client.USREOU'
const CLIENT_CREATE_PERMISSION = 'Header_NewClient_clientsAllView_PKEY'
const CLIENT_CASH_FLOW_PERMISSION = 'AccountingCashFlow_row_clientModal_clientsAll_PKEY'
const CLIENT_VIEW_PERMISSION = 'View_row_clientModal_clientsAll_PKEY'

type ActiveFilter = 'all' | 'active' | 'inactive'
type ClientAction = 'active' | 'reserve' | 'export' | null

const DEFAULT_SEARCH_FIELD_OPTIONS = [
  { value: CLIENT_SEARCH_SQL, label: 'Код, назва або ЄДРПОУ' },
  { value: 'RegionCode.Value', label: 'Код регіону' },
  { value: 'Client.FullName', label: 'Повна назва' },
  { value: 'Client.USREOU', label: 'ЄДРПОУ' },
  { value: 'Client.TIN', label: 'ІПН' },
  { value: 'Client.ClientNumber/Client.MobileNumber', label: 'Телефон' },
  { value: 'Client.EmailAddress', label: 'Email' },
]

const CLIENT_SORT_COLUMNS: Record<string, string> = {
  client: 'FullName',
  email: 'EmailAddress',
  location: 'RegionCode.City',
  phone: 'ClientNumber',
  regionCode: 'RegionCode.Value',
  reserve: 'OrderExpireDays',
  role: '[ClientInRole.ClientTypeRole].Name',
  sroi: 'SROI',
  status: 'IsActive',
  tin: 'TIN',
  usreou: 'USREOU',
}

const CLIENT_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'regionCode', 'client'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout
const CLIENT_TABLE_PAGE_SIZE_STORAGE_KEY = 'gba-data-table:clients:page-size'
const DEFAULT_CLIENT_TABLE_PAGE_SIZE = 30
const CLIENT_SEARCH_DEBOUNCE_MS = 350

function useClientsPageModel() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [urlSearchParams, setUrlSearchParams] = useSearchParams()
  const { hasPermission } = useAuth()
  const hasLoadedClientsRef = useRef(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [clients, setClients] = useValueState<Client[]>([])
  const [clientTypes, setClientTypes] = useValueState<ClientType[]>([])
  const [clientFilterItems, setClientFilterItems] = useValueState<ClientFilterItem[]>([])
  const [totalCount, setTotalCount] = useValueState<number | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isRefreshing, setRefreshing] = useValueState(false)
  const [clientAction, setClientAction] = useValueState<ClientAction>(null)
  const [downloadDocument, setDownloadDocument] = useValueState<ClientPrintDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [selectedClient, setSelectedClient] = useValueState<Client | null>(null)
  const [structureClient, setStructureClient] = useValueState<Client | null>(null)
  const [reserveClient, setReserveClient] = useValueState<Client | null>(null)
  const [reserveDays, setReserveDays] = useValueState(0)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(readClientTablePageSize)
  const urlActiveFilter = useMemo(() => parseActiveFilterSearchParams(urlSearchParams), [urlSearchParams])
  const [activeFilter, setActiveFilter] = useValueState<ActiveFilter>(() => urlActiveFilter)
  const [roleFilter, setRoleFilter] = useValueState<string[]>(() => parseRoleFilterSearchParam(urlSearchParams.get('roleIds')))
  const [searchField, setSearchField] = useValueState(CLIENT_SEARCH_SQL)
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, CLIENT_SEARCH_DEBOUNCE_MS)
  const [sorting, setSorting] = useValueState<DataTableSortingState>([])
  const offset = (page - 1) * pageSize
  const canMoveBack = page > 1
  const canMoveForward = clients.length === pageSize
  const canCreateClient = hasPermission(CLIENT_CREATE_PERMISSION)
  const canOpenCashFlow = hasPermission(CLIENT_CASH_FLOW_PERMISSION)
  const canViewClient = hasPermission(CLIENT_VIEW_PERMISSION)
  const active = activeFilter === 'all' ? null : activeFilter === 'active'
  const typeRoleFilter = roleFilter.join(',')
  const searchFieldOptions = useMemo(() => buildSearchFieldOptions(clientFilterItems), [clientFilterItems])
  const selectedFilterItem = useMemo(
    () => clientFilterItems.find((filterItem) => filterItem.SQL === searchField),
    [clientFilterItems, searchField],
  )
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isRefreshing || isSearchSettling
  const sortDescriptors = useMemo(() => buildClientSortDescriptors(sorting), [sorting])
  const searchParams = useMemo(
    () => ({
      active,
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
  const openClientActions = useCallback((client: Client) => setSelectedClient(client), [setSelectedClient])
  const clientColumns = useClientColumns(openClientActions)
  const changePageSize = useCallback((value: string | null) => {
    const nextPageSize = normalizeClientTablePageSize(value)

    setPage(1)
    setPageSize(nextPageSize)
    writeClientTablePageSize(nextPageSize)
  }, [setPage, setPageSize])
  const setActiveFilterInUrl = useCallback((nextFilter: ActiveFilter) => {
    setActiveFilter(nextFilter)
    setUrlSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)

      nextParams.delete('active')
      nextParams.delete('isActive')
      nextParams.delete('status')

      if (nextFilter === 'all') {
        nextParams.delete('activeFilter')
      } else {
        nextParams.set('activeFilter', nextFilter)
      }

      return nextParams
    }, { replace: true, state: location.state })
  }, [location.state, setActiveFilter, setUrlSearchParams])
  const tableToolbarLeft = useMemo(
    () => (
      <ClientTableSummary
        page={page}
        searchValue={normalizedSearchValue}
        totalCount={totalCount}
      />
    ),
    [normalizedSearchValue, page, totalCount],
  )
  const tableToolbarRight = useMemo(
    () => (
      <ClientTablePagination
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

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function loadClients() {
      const isInitialLoad = !hasLoadedClientsRef.current

      if (isInitialLoad) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError(null)

      try {
        const nextClients = await getClients(searchParams, controller.signal)

        if (!cancelled) {
          setClients(nextClients)
          hasLoadedClientsRef.current = true
        }
      } catch (loadError) {
        if (isAbortError(loadError)) {
          return
        }

        if (!cancelled) {
          if (!hasLoadedClientsRef.current) {
            setClients([])
          }

          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити клієнтів'))
        }
      } finally {
        if (!cancelled) {
          hasLoadedClientsRef.current = true
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void loadClients()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [searchParams, setClients, setError, setLoading, setRefreshing, t])

  useEffect(() => {
    let cancelled = false

    async function loadClientMeta() {
      try {
        const [nextTotalCount, nextClientTypes, nextFilterItems] = await Promise.all([
          getClientCount(),
          getClientTypes(),
          getClientFilterItems(),
        ])

        if (!cancelled) {
          setTotalCount(nextTotalCount)
          setClientTypes(nextClientTypes)
          setClientFilterItems(nextFilterItems)
        }
      } catch {
        if (!cancelled) {
          setTotalCount(null)
          setClientTypes([])
          setClientFilterItems([])
        }
      }
    }

    void loadClientMeta()

    return () => {
      cancelled = true
    }
  }, [setClientFilterItems, setClientTypes, setTotalCount])

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveFilter(urlActiveFilter)
  }, [setActiveFilter, urlActiveFilter])

  function resetSearch() {
    setPage(1)
    setActiveFilterInUrl('all')
    setRoleFilter([])
    setSearchField(CLIENT_SEARCH_SQL)
    setSearchValue('')
  }

  function openClient(client: Client) {
    if (!client.NetUid) {
      return
    }

    navigate(`/clients/edit/${client.NetUid}${location.search}`, {
      state: {
        backgroundLocation: location,
        moduleTitle: t('Клієнти'),
        nodeTitle: getClientDisplayName(client),
        returnPath: `${location.pathname}${location.search}`,
      },
    })
    setSelectedClient(null)
  }

  function openCashFlow(client: Client) {
    if (!client.NetUid) {
      return
    }

    navigate(`/clients/accounting-cash-flow/${client.NetUid}`, {
      state: {
        moduleTitle: t('Клієнти'),
        nodeTitle: getClientDisplayName(client),
      },
    })
    setSelectedClient(null)
  }

  function openReserveDays(client: Client) {
    setReserveClient(client)
    setReserveDays(Number(client.OrderExpireDays ?? 0))
    setSelectedClient(null)
  }

  function openClientStructure(client: Client) {
    setStructureClient(client)
    setSelectedClient(null)
  }

  function openCreateClient() {
    navigate('/clients/new/role', {
      state: {
        backgroundLocation: location,
        returnPath: `${location.pathname}${location.search}`,
      },
    })
  }

  async function handleSwitchActive(client: Client) {
    if (!client.NetUid) {
      return
    }

    setClientAction('active')
    setError(null)

    try {
      await switchClientActiveState(client.NetUid)
      setClients((currentClients) =>
        currentClients.reduce<Client[]>((nextClients, currentClient) => {
          const nextClient =
            currentClient.NetUid === client.NetUid
              ? {
                  ...currentClient,
                  IsActive: currentClient.IsActive === false,
                }
              : currentClient

          if (shouldKeepClientInActiveFilter(nextClient, activeFilter)) {
            nextClients.push(nextClient)
          }

          return nextClients
        }, []),
      )
      setSelectedClient((currentClient) =>
        currentClient && currentClient.NetUid === client.NetUid
          ? shouldKeepClientInActiveFilter({ ...currentClient, IsActive: currentClient.IsActive === false }, activeFilter)
            ? {
                ...currentClient,
                IsActive: currentClient.IsActive === false,
              }
            : null
          : currentClient,
      )
      notifications.show({
        color: 'green',
        message: t('Статус клієнта оновлено'),
      })
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося змінити статус клієнта'))
    } finally {
      setClientAction(null)
    }
  }

  async function handleReserveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!reserveClient?.NetUid) {
      return
    }

    const nextDays = Math.max(0, Math.trunc(reserveDays))
    setClientAction('reserve')
    setError(null)

    try {
      await updateClientOrderExpireDays(reserveClient.NetUid, nextDays)
      setClients((currentClients) =>
        currentClients.map((currentClient) =>
          currentClient.NetUid === reserveClient.NetUid
            ? {
                ...currentClient,
                OrderExpireDays: nextDays,
              }
            : currentClient,
        ),
      )
      setReserveClient(null)
      notifications.show({
        color: 'green',
        message: t('Дні резерву оновлено'),
      })
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося оновити дні резерву'))
    } finally {
      setClientAction(null)
    }
  }

  async function handleExport() {
    setClientAction('export')
    setError(null)

    try {
      const document = await exportClientsDocument({
        ...searchParams,
        limit: totalCount && totalCount > 0 ? totalCount : pageSize,
        offset: 0,
      })

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося підготувати документ'))
    } finally {
      setClientAction(null)
    }
  }

  return {
    activeFilter,
    canCreateClient,
    canOpenCashFlow,
    canViewClient,
    clientAction,
    clientColumns,
    clients,
    clientTypes,
    downloadDocument,
    downloadModalOpened,
    error,
    isLoading,
    isTableBusy,
    reserveClient,
    reserveDays,
    roleFilter,
    searchField,
    searchFieldOptions,
    searchInputRef,
    searchValue,
    selectedClient,
    sorting,
    structureClient,
    tableToolbarLeft,
    tableToolbarRight,
    handleExport,
    handleReserveSubmit,
    handleSwitchActive,
    openCashFlow,
    openClient,
    openClientStructure,
    openCreateClient,
    openReserveDays,
    resetSearch,
    setActiveFilter: setActiveFilterInUrl,
    setDownloadModalOpened,
    setPage,
    setReserveClient,
    setReserveDays,
    setRoleFilter,
    setSearchField,
    setSearchValue,
    setSelectedClient,
    setSorting,
    setStructureClient,
  }
}

export function ClientsPage() {
  const model = useClientsPageModel()

  return <ClientsPageView model={model} />
}

function ClientsPageView({ model }: { model: ReturnType<typeof useClientsPageModel> }) {
  const { t } = useI18n()
  const {
    activeFilter,
    canCreateClient,
    canOpenCashFlow,
    canViewClient,
    clientAction,
    clientColumns,
    clients,
    clientTypes,
    downloadDocument,
    downloadModalOpened,
    error,
    isLoading,
    isTableBusy,
    reserveClient,
    reserveDays,
    roleFilter,
    searchField,
    searchFieldOptions,
    searchInputRef,
    searchValue,
    selectedClient,
    sorting,
    structureClient,
    tableToolbarLeft,
    tableToolbarRight,
    handleExport,
    handleReserveSubmit,
    handleSwitchActive,
    openCashFlow,
    openClient,
    openClientStructure,
    openCreateClient,
    openReserveDays,
    resetSearch,
    setActiveFilter,
    setDownloadModalOpened,
    setPage,
    setReserveClient,
    setReserveDays,
    setRoleFilter,
    setSearchField,
    setSearchValue,
    setSelectedClient,
    setSorting,
    setStructureClient,
  } = model

  return (
    <Stack gap="lg">
      {canCreateClient && (
        <PageHeaderActions>
          <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<IconPlus size={16} />} onClick={openCreateClient}>
            {t('Новий клієнт')}
          </Button>
        </PageHeaderActions>
      )}

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <ClientsFilterToolbar
            activeFilter={activeFilter}
            clientTypes={clientTypes}
            isExporting={clientAction === 'export'}
            isTableBusy={isTableBusy}
            roleFilter={roleFilter}
            searchField={searchField}
            searchFieldOptions={searchFieldOptions}
            searchInputRef={searchInputRef}
            searchValue={searchValue}
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
            columns={clientColumns}
            data={clients}
            defaultLayout={CLIENT_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Клієнтів не знайдено')}
            getRowId={(client, index) => String(client.NetUid || client.Id || index)}
            height="calc(100vh - 240px)"
            isLoading={isLoading}
            layoutVersion="clients-table-compact-3"
            loadingText={t('Завантаження клієнтів')}
            manualSorting
            minWidth={1120}
            tableId="clients"
            sorting={sorting}
            toolbarLeft={tableToolbarLeft}
            toolbarRight={tableToolbarRight}
            onRowClick={setSelectedClient}
            onSortingChange={(nextSorting) => {
              setPage(1)
              setSorting(nextSorting)
            }}
          />
        </Stack>
      </Card>

      <ClientActionsModal
        canOpenCashFlow={canOpenCashFlow}
        canViewClient={canViewClient}
        client={selectedClient}
        isActiveLoading={clientAction === 'active'}
        onCashFlow={openCashFlow}
        onClose={() => setSelectedClient(null)}
        onEdit={openClient}
        onReserveDays={openReserveDays}
        onStructure={openClientStructure}
        onSwitchActive={handleSwitchActive}
      />

      <ReserveDaysModal
        client={reserveClient}
        days={reserveDays}
        isSaving={clientAction === 'reserve'}
        onChangeDays={setReserveDays}
        onClose={() => setReserveClient(null)}
        onSubmit={handleReserveSubmit}
      />

      <ClientDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        title={t('Експорт клієнтів')}
        onClose={() => setDownloadModalOpened(false)}
      />

      <ClientStructureModal
        client={structureClient}
        onClose={() => setStructureClient(null)}
        onOpenClient={(subClient) => {
          setStructureClient(null)
          openClient(subClient)
        }}
      />
    </Stack>
  )
}

type ClientActionsModalProps = {
  canOpenCashFlow: boolean
  canViewClient: boolean
  client: Client | null
  isActiveLoading: boolean
  onCashFlow: (client: Client) => void
  onClose: () => void
  onEdit: (client: Client) => void
  onReserveDays: (client: Client) => void
  onStructure: (client: Client) => void
  onSwitchActive: (client: Client) => void
}

function ClientActionsModal({
  canOpenCashFlow,
  canViewClient,
  client,
  isActiveLoading,
  onCashFlow,
  onClose,
  onEdit,
  onReserveDays,
  onStructure,
  onSwitchActive,
}: ClientActionsModalProps) {
  const { t } = useI18n()
  const isActive = client?.IsActive !== false
  const subClientCount = client ? getClientSubClients(client).length : 0

  return (
    <AppModal centered opened={Boolean(client)} title={client ? getClientDisplayName(client) : t('Клієнт')} onClose={onClose}>
      {client && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge color={isActive ? 'green' : 'gray'} variant="light">
              {isActive ? t('Активний') : t('Неактивний')}
            </Badge>
            <Text size="sm" c="dimmed">
              {displayValue(client.RegionCode?.Value)}
            </Text>
          </Group>

          <Stack gap="xs">
            {canViewClient && (
              <Button
                fullWidth
                justify="flex-start"
                leftSection={<IconExternalLink size={16} />}
                variant="light"
                onClick={() => onEdit(client)}
              >
                {t('Відкрити картку')}
              </Button>
            )}
            {canOpenCashFlow && (
              <Button
                fullWidth
                justify="flex-start"
                leftSection={<IconCash size={16} />}
                variant="light"
                onClick={() => onCashFlow(client)}
              >
                {t('Рух коштів')}
              </Button>
            )}
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Button
              fullWidth
              color={isActive ? 'gray' : 'green'}
              justify="flex-start"
              leftSection={isActive ? <IconToggleLeft size={16} /> : <IconToggleRight size={16} />}
              loading={isActiveLoading}
              variant="light"
              onClick={() => onSwitchActive(client)}
            >
              {isActive ? t('Позначити неактивним') : t('Позначити активним')}
            </Button>
            <Button
              fullWidth
              justify="flex-start"
              leftSection={<IconClock size={16} />}
              variant="light"
              onClick={() => onReserveDays(client)}
            >
              {t('Дні резерву')}
            </Button>
            {subClientCount > 0 && (
              <Button
                fullWidth
                justify="flex-start"
                leftSection={<IconHierarchy2 size={16} />}
                variant="light"
                onClick={() => onStructure(client)}
              >
                {t('Структура клієнта')} ({subClientCount})
              </Button>
            )}
          </Stack>
        </Stack>
      )}
    </AppModal>
  )
}

function ClientsFilterToolbar({
  activeFilter,
  clientTypes,
  isExporting,
  isTableBusy,
  roleFilter,
  searchField,
  searchFieldOptions,
  searchInputRef,
  searchValue,
  onExport,
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
  roleFilter: string[]
  searchField: string
  searchFieldOptions: Array<{ label: string; value: string }>
  searchInputRef: RefObject<HTMLInputElement | null>
  searchValue: string
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
        ref={searchInputRef}
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
          onSetSearchField(value || CLIENT_SEARCH_SQL)
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
      <ClientTypeRoleFilter
        clientTypes={clientTypes}
        value={roleFilter}
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
          variant="default"
          size={36}
          aria-label={t('Експорт в Excel')}
          loading={isExporting}
          onClick={onExport}
          style={{ flex: '0 0 auto' }}
        >
          <ExcelIcon size={22} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

function ReserveDaysModal({
  client,
  days,
  isSaving,
  onChangeDays,
  onClose,
  onSubmit,
}: {
  client: Client | null
  days: number
  isSaving: boolean
  onChangeDays: (value: number) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={Boolean(client)}
      title={client ? `${t('Резерв')}: ${getClientDisplayName(client)}` : t('Резерв')}
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <NumberInput
            allowDecimal={false}
            label={t('Днів резерву')}
            min={0}
            value={days}
            onChange={(value) => onChangeDays(Number(value) || 0)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button type="submit" color="violet" loading={isSaving}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

function ClientDocumentModal({
  document,
  opened,
  title,
  onClose,
}: {
  document: ClientPrintDocument | null
  opened: boolean
  title: string
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
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

function ClientStructureModal({
  client,
  onClose,
  onOpenClient,
}: {
  client: Client | null
  onClose: () => void
  onOpenClient: (client: Client) => void
}) {
  const { t } = useI18n()
  const subClients = client ? getClientSubClients(client) : []

  return (
    <AppModal
      centered
      opened={Boolean(client)}
      title={client ? `${t('Структура')}: ${getClientDisplayName(client)}` : t('Структура клієнта')}
      onClose={onClose}
    >
      <Stack gap="sm">
        {subClients.length > 0 ? (
          subClients.map((subClient, index) => (
            <Button
              key={subClient.NetUid || subClient.Id || index}
              fullWidth
              justify="flex-start"
              leftSection={<IconExternalLink size={16} />}
              variant="light"
              onClick={() => onOpenClient(subClient)}
            >
              <Stack gap={0} align="flex-start">
                <Text fw={600} size="sm">
                  {getClientDisplayName(subClient)}
                </Text>
                <Text c="dimmed" size="xs">
                  {displayValue(subClient.RegionCode?.Value)}
                </Text>
              </Stack>
            </Button>
          ))
        ) : (
          <Text c="dimmed" size="sm">
            {t('Підклієнтів не знайдено')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}

function useClientColumns(onOpenActions: (client: Client) => void) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Client>[]>(
    () => [
      {
        id: 'status',
        header: 'Статус',
        width: 100,
        minWidth: 90,
        accessor: (client) => (client.IsActive === false ? t('Неактивний') : t('Активний')),
        cell: (client) => (
          <Badge color={client.IsActive === false ? 'gray' : 'green'} variant="light">
            {client.IsActive === false ? t('Неактивний') : t('Активний')}
          </Badge>
        ),
      },
      {
        id: 'regionCode',
        header: 'Код',
        width: 82,
        minWidth: 76,
        accessor: (client) => client.RegionCode?.Value,
        cell: (client) => displayValue(client.RegionCode?.Value),
      },
      {
        id: 'client',
        header: 'Клієнт',
        width: 210,
        minWidth: 170,
        accessor: getClientDisplayName,
        cell: (client) => <Text fw={600}>{getClientDisplayName(client)}</Text>,
      },
      {
        id: 'tin',
        header: 'ІПН',
        width: 112,
        minWidth: 100,
        accessor: (client) => client.TIN,
        cell: (client) => displayValue(client.TIN),
      },
      {
        id: 'sroi',
        header: 'SROI',
        width: 90,
        minWidth: 80,
        accessor: (client) => client.SROI,
        cell: (client) => displayValue(client.SROI),
      },
      {
        id: 'usreou',
        header: 'ЄДРПОУ',
        width: 108,
        minWidth: 94,
        accessor: (client) => client.USREOU,
        cell: (client) => displayValue(client.USREOU),
      },
      {
        id: 'reserve',
        header: 'Резерв',
        width: 78,
        minWidth: 70,
        align: 'right',
        accessor: (client) => client.OrderExpireDays,
        cell: (client) => (
          <Text span inherit style={{ fontVariantNumeric: 'tabular-nums' }}>
            {displayValue(client.OrderExpireDays)}
          </Text>
        ),
      },
      {
        id: 'location',
        header: 'Місто / район',
        width: 140,
        minWidth: 120,
        accessor: (client) => [client.RegionCode?.City, client.RegionCode?.District].filter(Boolean).join(' '),
        cell: (client) => (
          <Text size="sm">
            {displayValue(client.RegionCode?.City)}
            {client.RegionCode?.District ? (
              <Text component="span" inherit c="dimmed">
                {' · '}
                {client.RegionCode.District}
              </Text>
            ) : null}
          </Text>
        ),
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 120,
        minWidth: 110,
        accessor: getClientPhone,
        cell: (client) => displayValue(getClientPhone(client)),
      },
      {
        id: 'email',
        header: 'Email',
        width: 168,
        minWidth: 150,
        accessor: (client) => client.EmailAddress,
        cell: (client) => displayValue(client.EmailAddress),
      },
      {
        id: 'role',
        header: 'Роль',
        width: 124,
        minWidth: 110,
        accessor: (client) => client.ClientInRole?.ClientTypeRole?.Name || t('Новий клієнт'),
        cell: (client) => {
          const name = client.ClientInRole?.ClientTypeRole?.Name?.trim()
          return name ? (
            <Badge color={roleBadgeColor(name)} variant="light">
              {name}
            </Badge>
          ) : (
            <Text c="dimmed">{t('Новий клієнт')}</Text>
          )
        },
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
        cell: (client) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Дії')}>
              <ActionIcon
                aria-label={t('Дії')}
                color="gray"
                variant="subtle"
                onClick={() => onOpenActions(client)}
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

function ClientTableSummary({
  page,
  searchValue,
  totalCount,
}: {
  page: number
  searchValue: string
  totalCount: number | null
}) {
  const { t } = useI18n()

  return (
    <Text size="xs" c="dimmed">
      <Text component="span" inherit c="dark" fw={700}>
        {t('сторінка')} {page}
      </Text>
      {typeof totalCount === 'number' ? `, ${t('всього')} ${totalCount}` : ''}
      {searchValue ? `, ${t('фільтр')}: ${searchValue}` : ''}
    </Text>
  )
}

function ClientTablePagination({
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

function parseRoleFilterSearchParam(value: string | null): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .flatMap((roleId) => {
      const normalizedRoleId = roleId.trim()

      return normalizedRoleId ? [normalizedRoleId] : []
    })
}

function buildSearchFieldOptions(filterItems: ClientFilterItem[]) {
  const dynamicOptions: Array<{ label: string; value: string }> = []

  filterItems.forEach((filterItem) => {
    if (filterItem.SQL) {
      dynamicOptions.push({
      value: filterItem.SQL || '',
      label: filterItem.Name?.trim() || filterItem.Description?.trim() || filterItem.SQL || translate('Поле'),
      })
    }
  })

  return dynamicOptions.length > 0
    ? dynamicOptions
    : DEFAULT_SEARCH_FIELD_OPTIONS.map((option) => ({ ...option, label: translate(option.label) }))
}

function buildClientSortDescriptors(sorting: DataTableSortingState) {
  return sorting
    .map((sortItem) => {
      const column = CLIENT_SORT_COLUMNS[sortItem.id]

      if (!column) {
        return null
      }

      return {
        Column: column,
        Dir: sortItem.desc ? 'desc' as const : 'asc' as const,
      }
    })
    .filter((descriptor): descriptor is { Column: string; Dir: 'asc' | 'desc' } => Boolean(descriptor))
}

function readClientTablePageSize() {
  if (typeof window === 'undefined') {
    return DEFAULT_CLIENT_TABLE_PAGE_SIZE
  }

  return normalizeClientTablePageSize(
    window.localStorage.getItem(CLIENT_TABLE_PAGE_SIZE_STORAGE_KEY),
  )
}

function writeClientTablePageSize(pageSize: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(CLIENT_TABLE_PAGE_SIZE_STORAGE_KEY, String(pageSize))
}

function parseActiveFilterSearchParams(params: URLSearchParams): ActiveFilter {
  const explicitFilter = normalizeActiveFilterSearchValue(params.get('activeFilter') || params.get('status'))

  if (explicitFilter) {
    return explicitFilter
  }

  const activeValue = params.get('active') || params.get('isActive')

  if (!activeValue) {
    return 'all'
  }

  const normalizedActiveValue = activeValue.trim().toLowerCase()

  if (['true', '1', 'active'].includes(normalizedActiveValue)) {
    return 'active'
  }

  if (['false', '0', 'inactive', 'new'].includes(normalizedActiveValue)) {
    return 'inactive'
  }

  return 'all'
}

function normalizeActiveFilterSearchValue(value: string | null): ActiveFilter | null {
  if (value === 'all' || value === 'active' || value === 'inactive') {
    return value
  }

  return null
}

function normalizeClientTablePageSize(value?: string | null) {
  return pageSizeOptions.includes(value ?? '')
    ? Number(value)
    : DEFAULT_CLIENT_TABLE_PAGE_SIZE
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function shouldKeepClientInActiveFilter(client: Client, activeFilter: ActiveFilter): boolean {
  if (activeFilter === 'all') {
    return true
  }

  return activeFilter === 'active' ? client.IsActive !== false : client.IsActive === false
}

function getClientSubClients(client: Client): Client[] {
  const subClients: Client[] = []

  const subClientLinks = client.SubClients || []

  subClientLinks.forEach((subClientLink) => {
    if (subClientLink.SubClient) {
      subClients.push(subClientLink.SubClient)
    }
  })

  return subClients
}

function getClientDisplayName(client: Client): string {
  const fullName = client.FullName?.trim() || client.Name?.trim()

  if (fullName) {
    return fullName
  }

  return [client.FirstName, client.LastName, client.MiddleName].filter(Boolean).join(' ') || translate('Без назви')
}

function getClientPhone(client: Client): string | undefined {
  return client.ClientNumber || client.MobileNumber
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}

// Role names are dynamic free strings from the backend, so we derive a stable
// color per name (djb2 hash, mirroring hashString in navigationIcons.tsx). The
// palette excludes orange (reserved for create actions) and green/gray (status).
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
