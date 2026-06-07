import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  MultiSelect,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getOrganizationPaymentTasks,
  searchServiceOrganizations,
} from '../api/organisationServicesApi'
import { OrganisationSearchControl } from '../components/OrganisationSearchControl'
import {
  findAutoSelectableOrganization,
  isOrganizationSearchResultForValue,
} from '../components/organisationSearchSelection'
import {
  getBrokerServiceType,
  type ServiceTypeClassificationContext,
} from '../serviceTypeClassifier'
import type {
  DocumentFilter,
  OrganizationPaymentTasks,
  OrganizationPaymentTasksParams,
  PaymentTaskRow,
  ServiceItem,
  ServiceOrganization,
  ServiceOrganizationTypeValue,
  SupplyPaymentTask,
  TaskStatus,
} from '../types'
import { SERVICE_ORGANIZATION_TYPES } from '../types'

const ORGANISATION_SERVICES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['date', 'serviceType', 'number'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const serviceCollections = [
  { key: 'ContainerServices', serviceType: 0 },
  { key: 'CustomAgencyServices', serviceType: 1 },
  { key: 'BrokerServices', serviceType: 2 },
  { key: 'PlaneDeliveryServices', serviceType: 4 },
  { key: 'PortCustomAgencyServices', serviceType: 5 },
  { key: 'PortWorkServices', serviceType: 6 },
  { key: 'TransportationServices', serviceType: 7 },
  { key: 'VehicleDeliveryServices', serviceType: 8 },
  { key: 'VehicleServices', serviceType: 8 },
  { key: 'MergedServices', serviceType: 9 },
] satisfies { key: ServiceCollectionKey; serviceType: ServiceOrganizationTypeValue }[]

const documentFilterOptions = [
  { value: 'invoice', label: 'З фактурою' },
  { value: 'payed', label: 'Оплачені' },
] satisfies { value: DocumentFilter; label: string }[]

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const ALL_SERVICE_ORGANIZATION_TYPE_VALUES = SERVICE_ORGANIZATION_TYPES.map((option) => option.value)

type ServiceCollectionKey =
  | 'BrokerServices'
  | 'ContainerServices'
  | 'CustomAgencyServices'
  | 'MergedServices'
  | 'PlaneDeliveryServices'
  | 'PortCustomAgencyServices'
  | 'PortWorkServices'
  | 'TransportationServices'
  | 'VehicleDeliveryServices'
  | 'VehicleServices'

type OrganizationSearchState = {
  error: string | null
  isLoading: boolean
  query: string
  suggestions: ServiceOrganization[]
}

const EMPTY_ORGANIZATION_SEARCH_STATE: OrganizationSearchState = {
  error: null,
  isLoading: false,
  query: '',
  suggestions: [],
}

export function OrganisationServicesPage() {
  const model = useOrganisationServicesPageModel()

  return <OrganisationServicesPageView model={model} />
}

function useOrganisationServicesPageModel() {
  const { t } = useI18n()
  const [organizationSearch, setOrganizationSearch] = useValueState('')
  const [organizationSearchState, setOrganizationSearchState] = useValueState<OrganizationSearchState>(EMPTY_ORGANIZATION_SEARCH_STATE)
  const [selectedOrganization, setSelectedOrganization] = useValueState<ServiceOrganization | null>(null)
  const [selectedServiceTypes, setSelectedServiceTypes] = useValueState<string[]>([])
  const [documentFilters, setDocumentFilters] = useValueState<DocumentFilter[]>([])
  const [dateFrom, setDateFrom] = useValueState(getDefaultDateFrom)
  const [dateTo, setDateTo] = useValueState(getDefaultDateTo)
  const [paymentTasks, setPaymentTasks] = useValueState<OrganizationPaymentTasks>(createEmptyPaymentTasks)
  const [lastSearchParams, setLastSearchParams] = useValueState<OrganizationPaymentTasksParams | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoadingTasks, setLoadingTasks] = useValueState(false)
  const organizationSearchRequestRef = useRef(0)
  const paymentTasksRequestRef = useRef(0)
  const availableServiceOptions = useMemo(
    () => buildServiceOptions(selectedOrganization?.ServiceOrganizationTypes || []),
    [selectedOrganization?.ServiceOrganizationTypes],
  )
  const rows = useMemo(
    () => filterRows(
      flattenPaymentTasks(paymentTasks.SupplyPaymentTasks, {
        organizationName: lastSearchParams?.organizationName || selectedOrganization?.Name,
        serviceTypes: lastSearchParams?.serviceTypes,
      }),
      documentFilters,
    ),
    [
      documentFilters,
      lastSearchParams?.organizationName,
      lastSearchParams?.serviceTypes,
      paymentTasks.SupplyPaymentTasks,
      selectedOrganization?.Name,
    ],
  )
  const columns = useOrganisationServicesColumns()
  const visibleError = organizationSearchState.error || error
  const loadPaymentTasks = useCallback(
    async (params: OrganizationPaymentTasksParams) => {
      const requestId = paymentTasksRequestRef.current + 1
      paymentTasksRequestRef.current = requestId
      setLoadingTasks(true)
      setError(null)

      try {
        const nextPaymentTasks = await getOrganizationPaymentTasks(params)

        if (paymentTasksRequestRef.current === requestId) {
          setPaymentTasks(nextPaymentTasks)
        }
      } catch (loadError) {
        if (paymentTasksRequestRef.current === requestId) {
          setPaymentTasks(createEmptyPaymentTasks())
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити взаєморозрахунки'))
        }
      } finally {
        if (paymentTasksRequestRef.current === requestId) {
          setLoadingTasks(false)
        }
      }
    },
    [setError, setLoadingTasks, setPaymentTasks, t],
  )
  const toolbarLeft = useMemo(
    () =>
      selectedOrganization?.Name ? (
        <Text c="dimmed" size="xs">
          {t('організація')}: {selectedOrganization.Name}
        </Text>
      ) : null,
    [selectedOrganization, t],
  )
  const toolbarRight = useMemo(
    () => (
      <Tooltip label={t('Оновити')}>
        <ActionIcon
          aria-label={t('Оновити')}
          color="gray"
          disabled={!lastSearchParams}
          loading={isLoadingTasks}
          size="sm"
          variant="subtle"
          onClick={() => {
            if (lastSearchParams) {
              void loadPaymentTasks(lastSearchParams)
            }
          }}
        >
          <IconRefresh size={16} />
        </ActionIcon>
      </Tooltip>
    ),
    [isLoadingTasks, lastSearchParams, loadPaymentTasks, t],
  )

  useEffect(() => {
    const normalizedOrganizationSearch = organizationSearch.trim()

    if (selectedOrganization || !normalizedOrganizationSearch) {
      setOrganizationSearchState(EMPTY_ORGANIZATION_SEARCH_STATE)
      return
    }

    const controller = new AbortController()
    const requestId = organizationSearchRequestRef.current + 1
    organizationSearchRequestRef.current = requestId
    const timeoutId = window.setTimeout(() => {
      setOrganizationSearchState((current) => ({
        ...current,
        error: null,
        isLoading: true,
        query: normalizedOrganizationSearch,
      }))

      searchServiceOrganizations(normalizedOrganizationSearch, controller.signal)
        .then((organizations) => {
          if (!controller.signal.aborted && organizationSearchRequestRef.current === requestId) {
            setOrganizationSearchState({
              error: null,
              isLoading: false,
              query: normalizedOrganizationSearch,
              suggestions: organizations,
            })
          }
        })
        .catch((searchError) => {
          if (!controller.signal.aborted && organizationSearchRequestRef.current === requestId) {
            setOrganizationSearchState({
              error: searchError instanceof Error ? searchError.message : t('Не вдалося знайти організації'),
              isLoading: false,
              query: normalizedOrganizationSearch,
              suggestions: [],
            })
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    organizationSearch,
    selectedOrganization,
    setOrganizationSearchState,
    t,
  ])

  function selectOrganization(organization: ServiceOrganization) {
    const serviceTypes = getDefaultServiceTypes(organization)

    organizationSearchRequestRef.current += 1
    setSelectedOrganization(organization)
    setOrganizationSearch(organization.Name || '')
    setSelectedServiceTypes(serviceTypes.map(String))
    setOrganizationSearchState(EMPTY_ORGANIZATION_SEARCH_STATE)
    setPaymentTasks(createEmptyPaymentTasks())
    setLastSearchParams(null)
    setError(null)
  }

  function clearOrganization() {
    organizationSearchRequestRef.current += 1
    paymentTasksRequestRef.current += 1
    setSelectedOrganization(null)
    setOrganizationSearch('')
    setSelectedServiceTypes([])
    setOrganizationSearchState(EMPTY_ORGANIZATION_SEARCH_STATE)
    setPaymentTasks(createEmptyPaymentTasks())
    setLastSearchParams(null)
    setError(null)
    setLoadingTasks(false)
  }

  function updateOrganizationSearch(value: string) {
    organizationSearchRequestRef.current += 1
    paymentTasksRequestRef.current += 1
    setOrganizationSearch(value)
    setSelectedOrganization(null)
    setSelectedServiceTypes([])
    setOrganizationSearchState(EMPTY_ORGANIZATION_SEARCH_STATE)
    setPaymentTasks(createEmptyPaymentTasks())
    setLastSearchParams(null)
    setError(null)
    setLoadingTasks(false)
  }

  function updateSelectedServiceTypes(values: string[]) {
    if (selectedOrganization && values.length === 0) {
      setError(t('Залиште хоча б один тип послуги'))
      return
    }

    setSelectedServiceTypes(values)
    setError(null)
  }

  async function autoSelectOrganization(fetchIfNeeded: boolean): Promise<ServiceOrganization | null> {
    if (selectedOrganization) {
      return selectedOrganization
    }

    const normalizedOrganizationSearch = organizationSearch.trim()

    if (!normalizedOrganizationSearch) {
      return null
    }

    const currentSuggestions = isOrganizationSearchResultForValue(
      organizationSearchState.query,
      normalizedOrganizationSearch,
    )
      ? organizationSearchState.suggestions
      : []
    const suggestedOrganization = findAutoSelectableOrganization(currentSuggestions, normalizedOrganizationSearch)

    if (suggestedOrganization) {
      selectOrganization(suggestedOrganization)
      return suggestedOrganization
    }

    if (!fetchIfNeeded) {
      return null
    }

    const requestId = organizationSearchRequestRef.current + 1
    organizationSearchRequestRef.current = requestId
    setOrganizationSearchState({
      error: null,
      isLoading: true,
      query: normalizedOrganizationSearch,
      suggestions: currentSuggestions,
    })

    try {
      const organizations = await searchServiceOrganizations(normalizedOrganizationSearch)
      let fetchedOrganization: ServiceOrganization | null = null

      if (organizationSearchRequestRef.current === requestId) {
        fetchedOrganization = findAutoSelectableOrganization(organizations, normalizedOrganizationSearch)

        if (fetchedOrganization) {
          selectOrganization(fetchedOrganization)
        } else {
          setOrganizationSearchState({
            error: null,
            isLoading: false,
            query: normalizedOrganizationSearch,
            suggestions: organizations,
          })
        }
      }

      return fetchedOrganization
    } catch (searchError) {
      if (organizationSearchRequestRef.current === requestId) {
        setOrganizationSearchState({
          error: searchError instanceof Error ? searchError.message : t('Не вдалося знайти організації'),
          isLoading: false,
          query: normalizedOrganizationSearch,
          suggestions: [],
        })
      }
    }

    return null
  }

  function resetFilters() {
    clearOrganization()
    setDateFrom(getDefaultDateFrom())
    setDateTo(getDefaultDateTo())
    setDocumentFilters([])
    setPaymentTasks(createEmptyPaymentTasks())
    setLastSearchParams(null)
    setError(null)
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedOrganization && !organizationSearch.trim()) {
      setError(t('Оберіть організацію'))
      return
    }

    const dateValidationError = validateSearchDates(dateFrom, dateTo)

    if (dateValidationError) {
      setError(dateValidationError)
      return
    }

    const organizationForSearch = selectedOrganization || await autoSelectOrganization(true)
    const selectedServiceTypesForSearch = selectedOrganization
      ? selectedServiceTypes
      : organizationForSearch
        ? getDefaultServiceTypes(organizationForSearch).map(String)
        : selectedServiceTypes
    const serviceTypes = normalizeSelectedServiceTypes(selectedServiceTypesForSearch)
    const validationError = validateSearchSelection(organizationForSearch, serviceTypes)

    if (validationError) {
      setError(validationError)
      return
    }

    const params = {
      organizationId: organizationForSearch?.Id,
      organizationName: organizationForSearch?.Name?.trim() || '',
      organizationNetUid: organizationForSearch?.NetUid,
      serviceTypes,
      from: dateFrom,
      to: dateTo,
    }

    setLastSearchParams(params)
    void loadPaymentTasks(params)
  }

  return {
    availableServiceOptions,
    columns,
    dateFrom,
    dateTo,
    documentFilters,
    isLoadingTasks,
    lastSearchParams,
    organizationSearch,
    organizationSearchState,
    paymentTasks,
    rows,
    selectedOrganization,
    selectedServiceTypes,
    toolbarLeft,
    toolbarRight,
    visibleError,
    autoSelectOrganization,
    clearOrganization,
    resetFilters,
    selectOrganization,
    setDateFrom,
    setDateTo,
    setDocumentFilters,
    updateSelectedServiceTypes,
    submitSearch,
    updateOrganizationSearch,
  }
}

type OrganisationServicesPageModel = ReturnType<typeof useOrganisationServicesPageModel>

function OrganisationServicesPageView({ model }: { model: OrganisationServicesPageModel }) {
  const { t } = useI18n()
  const {
    availableServiceOptions,
    columns,
    dateFrom,
    dateTo,
    documentFilters,
    isLoadingTasks,
    lastSearchParams,
    organizationSearch,
    organizationSearchState,
    paymentTasks,
    rows,
    selectedOrganization,
    selectedServiceTypes,
    toolbarLeft,
    toolbarRight,
    visibleError,
    autoSelectOrganization,
    clearOrganization,
    resetFilters,
    selectOrganization,
    setDateFrom,
    setDateTo,
    setDocumentFilters,
    updateSelectedServiceTypes,
    submitSearch,
    updateOrganizationSearch,
  } = model

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <form onSubmit={submitSearch}>
          <Stack gap="md">
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <OrganisationSearchControl
                isLoading={organizationSearchState.isLoading}
                organizations={organizationSearchState.suggestions}
                selectedOrganization={selectedOrganization}
                value={organizationSearch}
                onAutoSelect={() => {
                  void autoSelectOrganization(true)
                }}
                onChange={updateOrganizationSearch}
                onClear={clearOrganization}
                onSelect={selectOrganization}
              />

              <TextInput
                label={t('Від')}
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.currentTarget.value)}
                style={{ flex: '0 0 160px' }}
              />
              <TextInput
                label={t('До')}
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.currentTarget.value)}
                style={{ flex: '0 0 160px' }}
              />
              <Button
                color={CREATE_ACTION_COLOR}
                loading={isLoadingTasks}
                type="submit"
                style={{ flex: '0 0 auto' }}
              >
                {t('Взаєморозрахунки')}
              </Button>
              <Tooltip label={t('Скинути')}>
                <ActionIcon
                  aria-label={t('Скинути')}
                  color="gray"
                  size={36}
                  variant="light"
                  onClick={resetFilters}
                >
                  <IconRestore size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <MultiSelect
                data={availableServiceOptions}
                disabled={!selectedOrganization}
                label={t('Типи послуг')}
                placeholder={selectedOrganization ? t('Оберіть типи') : t('Оберіть організацію')}
                searchable
                value={selectedServiceTypes}
                onChange={updateSelectedServiceTypes}
                style={{ flex: '1 1 320px', minWidth: 240 }}
              />
              <MultiSelect
                data={documentFilterOptions.map((option) => ({
                  value: option.value,
                  label: t(option.label),
                }))}
                label={t('Документи')}
                placeholder={t('Усі')}
                value={documentFilters}
                onChange={(values) => setDocumentFilters(values.filter(isDocumentFilter))}
                style={{ flex: '0 1 260px', minWidth: 220 }}
              />
            </Group>
          </Stack>
        </form>
      </Card>

      {visibleError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {visibleError}
        </Alert>
      )}

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={ORGANISATION_SERVICES_TABLE_DEFAULT_LAYOUT}
            emptyText={lastSearchParams ? t('Взаєморозрахунків не знайдено') : t('Оберіть організацію і виконайте пошук')}
            getRowId={(row) => row.id}
            isLoading={isLoadingTasks}
            layoutVersion="organisation-services-table-2"
            loadingText={t('Завантаження взаєморозрахунків')}
            maxHeight="calc(100vh - 420px)"
            minWidth={1080}
            tableId="organisation-services"
            toolbarLeft={toolbarLeft}
            toolbarRight={toolbarRight}
          />

          <Group justify="flex-end" gap="lg">
            <SummaryValue label={t('Баланс за період')} value={paymentTasks.TotalByRange} />
            <SummaryValue label={t('Разом')} value={paymentTasks.Total} />
          </Group>
        </Stack>
      </Card>
    </Stack>
  )
}

function SummaryValue({ label, value }: { label: string; value: number }) {
  const color = value > 0 ? 'green' : value < 0 ? 'red' : 'gray'

  return (
    <Group gap={6}>
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Badge color={color} size="lg" variant="light">
        {moneyFormatter.format(value)}
      </Badge>
    </Group>
  )
}

function useOrganisationServicesColumns(): DataTableColumn<PaymentTaskRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<PaymentTaskRow>[]>(
    () => [
      {
        id: 'date',
        header: 'Дата',
        width: 132,
        minWidth: 116,
        accessor: (row) => row.date,
        cell: (row) => displayDate(row.date),
      },
      {
        id: 'documentName',
        header: 'Фактура',
        width: 180,
        minWidth: 140,
        accessor: (row) => row.documentName,
        cell: (row) => displayValue(row.documentName),
      },
      {
        id: 'number',
        header: 'Номер',
        width: 160,
        minWidth: 120,
        accessor: (row) => row.number,
        cell: (row) => displayValue(row.number),
      },
      {
        id: 'serviceType',
        header: 'Тип',
        width: 200,
        minWidth: 160,
        accessor: (row) => row.serviceTypeLabel,
        cell: (row) => (
          <Badge color={CREATE_ACTION_COLOR} variant="light">
            {row.serviceTypeLabel}
          </Badge>
        ),
      },
      {
        id: 'serviceName',
        header: 'Послуга',
        width: 240,
        minWidth: 180,
        accessor: (row) => row.serviceName,
        cell: (row) => displayValue(row.serviceName),
      },
      {
        id: 'amount',
        header: 'Сума',
        width: 128,
        minWidth: 112,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => displayMoney(row.amount),
      },
      {
        id: 'status',
        header: 'Статус',
        width: 152,
        minWidth: 132,
        accessor: (row) => getStatusLabel(row.status, t),
        cell: (row) => (
          <Badge color={getStatusColor(row.status)} variant="light">
            {getStatusLabel(row.status, t)}
          </Badge>
        ),
      },
    ],
    [t],
  )
}

function flattenPaymentTasks(tasks: SupplyPaymentTask[], context: ServiceTypeClassificationContext): PaymentTaskRow[] {
  return tasks.flatMap((task, taskIndex) =>
    serviceCollections.flatMap((collection) =>
      readServices(task, collection.key).map((service, serviceIndex) => {
        const serviceType = getServiceType(collection, service, context)
        const serviceTypeLabel = getServiceTypeLabel(serviceType)
        const invoiceDocument = getInvoiceDocument(task, service)
        const invoiceDocumentId = getInvoiceDocumentId(service)

        return {
          amount: readAmount(service, task),
          date: service.FromDate || task.PayToDate || task.Created,
          documentName: getDocumentName(invoiceDocument, service, invoiceDocumentId),
          hasInvoice: Boolean(invoiceDocument || invoiceDocumentId),
          id: [
            task.NetUid || task.Id || taskIndex,
            collection.key,
            service.NetUid || service.Id || serviceIndex,
          ].join(':'),
          isPayed: task.IsPayed === true || task.TaskStatus === 1,
          number: service.Number || service.ServiceNumber,
          serviceName: getServiceName(service, serviceTypeLabel),
          serviceType,
          serviceTypeLabel,
          status: task.TaskStatus,
        }
      }),
    ),
  )
}

function filterRows(rows: PaymentTaskRow[], documentFilters: DocumentFilter[]): PaymentTaskRow[] {
  return rows.filter((row) => {
    if (documentFilters.includes('invoice') && !row.hasInvoice) {
      return false
    }

    if (documentFilters.includes('payed') && !row.isPayed) {
      return false
    }

    return true
  })
}

function readServices(task: SupplyPaymentTask, key: ServiceCollectionKey): ServiceItem[] {
  const services = task[key]

  return Array.isArray(services) ? services : []
}

function getInvoiceDocument(task: SupplyPaymentTask, service: ServiceItem) {
  return service.BillOfLadingDocument
    || service.InvoiceDocuments?.[0]
    || service.BillOfLadingDocuments?.[0]
    || task.InvoiceDocuments?.[0]
    || task.SupplyPaymentTaskDocuments?.[0]
    || null
}

function getInvoiceDocumentId(service: ServiceItem): number | undefined {
  return service.SupplyServiceAccountDocumentId
    || service.BillOfLadingDocumentId
    || service.ActProvidingServiceDocumentId
}

function getDocumentName(
  document: ReturnType<typeof getInvoiceDocument>,
  service: ServiceItem,
  documentId?: number,
): string | undefined {
  const documentNumber = document && 'Number' in document ? (document as { Number?: string }).Number : undefined

  return documentNumber
    || document?.FileName
    || document?.GeneratedName
    || service.BillOfLadingDocument?.Number
    || (documentId ? String(documentId) : undefined)
}

function getServiceName(service: ServiceItem, serviceTypeLabel: string): string | undefined {
  return service.Name?.trim() || serviceTypeLabel || service.ServiceNumber
}

function readAmount(service: ServiceItem, task: SupplyPaymentTask): number | undefined {
  return service.GrossPrice ?? service.AccountingGrossPrice ?? task.GrossPrice
}

function getServiceTypeLabel(value: ServiceOrganizationTypeValue): string {
  return SERVICE_ORGANIZATION_TYPES.find((option) => option.value === value)?.label || 'Послуга'
}

function getServiceType(
  collection: { key: ServiceCollectionKey; serviceType: ServiceOrganizationTypeValue },
  service: ServiceItem,
  context: ServiceTypeClassificationContext,
): ServiceOrganizationTypeValue {
  return collection.key === 'BrokerServices'
    ? getBrokerServiceType(service, context, collection.serviceType)
    : collection.serviceType
}

function buildServiceOptions(serviceTypes: ServiceOrganizationTypeValue[]) {
  const usableTypes = serviceTypes.length
    ? serviceTypes
    : ALL_SERVICE_ORGANIZATION_TYPE_VALUES

  return SERVICE_ORGANIZATION_TYPES.reduce<Array<{ label: string; value: string }>>((options, option) => {
    if (!usableTypes.includes(option.value)) {
      return options
    }

    options.push({
      value: String(option.value),
      label: option.label,
    })

    return options
  }, [])
}

function getDefaultServiceTypes(organization: ServiceOrganization): ServiceOrganizationTypeValue[] {
  return organization.ServiceOrganizationTypes?.length
    ? organization.ServiceOrganizationTypes
    : ALL_SERVICE_ORGANIZATION_TYPE_VALUES
}

function normalizeSelectedServiceTypes(selectedServiceTypes: string[]): ServiceOrganizationTypeValue[] {
  const serviceTypes = selectedServiceTypes.reduce<ServiceOrganizationTypeValue[]>((types, selectedServiceType) => {
    const normalizedSelectedServiceType = selectedServiceType.trim()

    if (!normalizedSelectedServiceType) {
      return types
    }

    const serviceType = Number(normalizedSelectedServiceType)
    if (isServiceOrganizationTypeValue(serviceType)) {
      types.push(serviceType)
    }

    return types
  }, [])

  return Array.from(new Set(serviceTypes))
}

function isServiceOrganizationTypeValue(value: number): value is ServiceOrganizationTypeValue {
  return SERVICE_ORGANIZATION_TYPES.some((option) => option.value === value)
}

function validateSearchDates(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) {
    return 'Оберіть період'
  }

  if (dateFrom > dateTo) {
    return 'Дата від не може бути пізніше дати до'
  }

  return null
}

function validateSearchSelection(
  organization: ServiceOrganization | null,
  serviceTypes: ServiceOrganizationTypeValue[],
): string | null {
  if (!organization?.Name?.trim()) {
    return 'Оберіть організацію'
  }

  if (serviceTypes.length === 0) {
    return 'Оберіть хоча б один тип послуги'
  }

  return null
}

function isDocumentFilter(value: string): value is DocumentFilter {
  return value === 'invoice' || value === 'payed'
}

function getDefaultDateFrom(): string {
  const date = new Date()
  date.setMonth(date.getMonth() - 1)

  return toDateInputValue(date)
}

function getDefaultDateTo(): string {
  return toDateInputValue(new Date())
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function displayDate(value?: string): string {
  const normalizedValue = (value || '').trim()

  if (!normalizedValue) {
    return '-'
  }

  const date = parseDisplayDate(normalizedValue)

  if (!date) {
    return normalizedValue
  }

  return date.toLocaleDateString('uk-UA')
}

function parseDisplayDate(value: string): Date | null {
  const dateInputMatch = DATE_INPUT_PATTERN.exec(value)

  if (dateInputMatch) {
    const year = Number(dateInputMatch[1])
    const month = Number(dateInputMatch[2])
    const day = Number(dateInputMatch[3])
    const date = new Date(year, month - 1, day)

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function displayMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}

function displayValue(value?: string | null): string {
  const normalizedValue = value?.trim()

  return normalizedValue || '-'
}

function getStatusLabel(status: TaskStatus | undefined, t: (value: string) => string): string {
  if (status === 0) {
    return t('Не завершено')
  }

  if (status === 1) {
    return t('Виконано')
  }

  if (status === 2) {
    return t('Оплачено частково')
  }

  return t('Немає статусу')
}

function getStatusColor(status: TaskStatus | undefined): string {
  if (status === 1) {
    return 'green'
  }

  if (status === 2) {
    return 'yellow'
  }

  return 'gray'
}

function createEmptyPaymentTasks(): OrganizationPaymentTasks {
  return {
    SupplyPaymentTasks: [],
    Total: 0,
    TotalByRange: 0,
  }
}
