import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  MultiSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, RefreshCw, RotateCcw } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getDocumentHref } from '../../../shared/url/getDocumentHref'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
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
  BaseDocument,
  DocumentFilter,
  OrganizationPaymentTasks,
  OrganizationPaymentTasksParams,
  PaymentTaskRow,
  ServiceDetailItem,
  ServiceItem,
  ServiceOrganization,
  ServiceOrganizationTypeValue,
  SupplyPaymentTask,
  TaskStatus,
} from '../types'
import { SERVICE_ORGANIZATION_TYPES } from '../types'
import '../../../shared/ui/console-table-page.css'
import './organisation-services-page.css'

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
  const [selectedServiceRow, setSelectedServiceRow] = useValueState<PaymentTaskRow | null>(null)
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
  const refreshPaymentTasks = useCallback(() => {
    if (lastSearchParams) {
      void loadPaymentTasks(lastSearchParams)
    }
  }, [lastSearchParams, loadPaymentTasks])

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
    setSelectedServiceRow(null)
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
    setSelectedServiceRow(null)
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
    setSelectedServiceRow(null)
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
    setSelectedServiceRow(null)
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
    selectedServiceRow,
    selectedServiceTypes,
    toolbarLeft,
    refreshPaymentTasks,
    visibleError,
    autoSelectOrganization,
    clearOrganization,
    resetFilters,
    selectOrganization,
    setDateFrom,
    setDateTo,
    setDocumentFilters,
    setSelectedServiceRow,
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
    selectedServiceRow,
    selectedServiceTypes,
    toolbarLeft,
    refreshPaymentTasks,
    visibleError,
    autoSelectOrganization,
    clearOrganization,
    resetFilters,
    selectOrganization,
    setDateFrom,
    setDateTo,
    setDocumentFilters,
    setSelectedServiceRow,
    updateSelectedServiceTypes,
    submitSearch,
    updateOrganizationSearch,
  } = model
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  return (
    <Stack className="organisation-services-page console-table-page" gap={6}>
      <div className="organisation-services-shell console-table-shell">
        <form className="app-filter-bar organisation-services-filter-bar" onSubmit={submitSearch}>
          <div className="app-filter-date-range">
            <TextInput
              label={t('Від')}
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.currentTarget.value)}
            />
            <TextInput
              label={t('До')}
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.currentTarget.value)}
            />
          </div>
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
          <MultiSelect
            className="organisation-services-type-filter"
            data={availableServiceOptions}
            disabled={!selectedOrganization}
            label={t('Типи послуг')}
            placeholder={selectedOrganization ? t('Оберіть типи') : t('Оберіть організацію')}
            searchable
            value={selectedServiceTypes}
            onChange={updateSelectedServiceTypes}
          />
          <MultiSelect
            className="organisation-services-document-filter"
            data={documentFilterOptions.map((option) => ({
              value: option.value,
              label: t(option.label),
            }))}
            label={t('Документи')}
            placeholder={t('Усі')}
            value={documentFilters}
            onChange={(values) => setDocumentFilters(values.filter(isDocumentFilter))}
          />
          <div className="app-filter-actions organisation-services-filter-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                size={34}
                type="button"
                variant="light"
                onClick={resetFilters}
              >
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                disabled={!lastSearchParams}
                loading={isLoadingTasks}
                size={34}
                type="button"
                variant="light"
                onClick={refreshPaymentTasks}
              >
                <RefreshCw size={17} />
              </ActionIcon>
            </Tooltip>
          </div>
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
          <Button
            className="organisation-services-submit"
            color={CREATE_ACTION_COLOR}
            loading={isLoadingTasks}
            type="submit"
          >
            {t('Взаєморозрахунки')}
          </Button>
        </form>

        {visibleError && (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {visibleError}
          </Alert>
        )}

        <div className="organisation-services-table console-table-body">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={ORGANISATION_SERVICES_TABLE_DEFAULT_LAYOUT}
            emptyText={lastSearchParams ? t('Взаєморозрахунків не знайдено') : t('Оберіть організацію і виконайте пошук')}
            getRowId={(row) => row.id}
            isLoading={isLoadingTasks}
            layoutVersion="organisation-services-table-2"
            loadingText={t('Завантаження взаєморозрахунків')}
            height="100%"
            minWidth={1080}
            showLayoutControls
            tableId="organisation-services"
            toolbarLeft={toolbarLeft}
            toolbarPortalTarget={tableToolbarSlot}
            footer={
              <Group className="organisation-services-summary" justify="flex-end" gap="lg" wrap="nowrap">
                <SummaryValue label={t('Баланс за період')} value={paymentTasks.TotalByRange} />
                <SummaryValue label={t('Разом')} value={paymentTasks.Total} />
              </Group>
            }
            onRowClick={setSelectedServiceRow}
          />
        </div>
      </div>

      <OrganisationServiceDetailDrawer row={selectedServiceRow} onClose={() => setSelectedServiceRow(null)} />
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

function OrganisationServiceDetailDrawer({ row, onClose }: { row: PaymentTaskRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const service = row?.service
  const task = row?.task
  const serviceDetails = service?.ServiceDetailItems || []
  const documents = row ? collectServiceDocuments(row.task, row.service) : []

  return (
    <AppDrawer
      opened={Boolean(row)}
      padding="lg"
      position="right"
      size="min(980px, 100vw)"
      title={row ? `${row.serviceTypeLabel}${row.number ? ` #${row.number}` : ''}` : t('Деталі послуги')}
      onClose={onClose}
    >
      {row && service && task && (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            <DetailItem label={t('Дата')} value={displayDate(row.date)} />
            <DetailItem label={t('Тип')} value={row.serviceTypeLabel} />
            <DetailItem label={t('Назва')} value={displayValue(row.serviceName)} />
            <DetailItem label={t('Номер')} value={displayValue(service.Number || service.ServiceNumber)} />
            <DetailItem label={t('Номер документа')} value={displayValue(service.ServiceNumber)} />
            <DetailItem label={t('Фактура')} value={displayValue(row.documentName)} />
            <DetailItem label={t('Організація')} value={displayValue(getServiceOrganizationName(service))} />
            <DetailItem label={t('Договір')} value={displayValue(getAgreementLabel(service))} />
            <DetailItem label={t('Валюта')} value={displayValue(getServiceCurrencyCode(service))} />
            <DetailItem label={t('Сума нетто')} value={displayMoney(service.NetPrice)} />
            <DetailItem label={t('Сума')} value={displayMoney(service.GrossPrice)} />
            <DetailItem label={t('Бух. нетто')} value={displayMoney(service.AccountingNetPrice)} />
            <DetailItem label={t('Бух. сума')} value={displayMoney(service.AccountingGrossPrice)} />
            <DetailItem label={`${t('ПДВ')} %`} value={displayNumber(service.VatPercent ?? service.AccountingVatPercent)} />
            <DetailItem label={t('ПДВ')} value={displayMoney(service.Vat ?? service.AccountingVat)} />
            <DetailItem label={t('Контейнер / авто')} value={displayValue(getServiceTransportNumber(service))} />
            <DetailItem label={t('Дата завантаження')} value={displayDate(service.LoadDate)} />
            <DetailItem label={t('Днів доставки')} value={displayNumber(service.TermDeliveryInDays)} />
            <DetailItem label={t('Статус')} value={getStatusLabel(row.status, t)} />
          </SimpleGrid>

          <Divider />

          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700}>{t('Деталізація послуги')}</Text>
              <Badge color={serviceDetails.length > 0 ? CREATE_ACTION_COLOR : 'gray'} variant="light">
                {serviceDetails.length}
              </Badge>
            </Group>
            {serviceDetails.length > 0 ? (
              <DataTable
                columns={getServiceDetailColumns(t)}
                data={serviceDetails}
                density="compact"
                emptyText={t('Деталізації немає')}
                getRowId={(detail, index) => detail.NetUid || String(detail.Id || index)}
                layoutVersion="organisation-service-detail-items-1"
                maxHeight={320}
                minWidth={760}
                showDensityToggle={false}
                tableId={`organisation-service-detail-items-${row.id}`}
              />
            ) : (
              <Text c="dimmed" size="sm">
                {t('Деталізації немає')}
              </Text>
            )}
          </Stack>

          <Divider />

          <Stack gap="sm">
            <Text fw={700}>{t('Документи')}</Text>
            {documents.length > 0 ? (
              <Stack gap="xs">
                {documents.map((document, index) => {
                  const documentUrl = getServiceDocumentUrl(document)
                  const documentName = getServiceDocumentName(document, index)
                  const documentKey = getServiceDocumentKey(document, documentName)

                  return documentUrl ? (
                    <Anchor key={documentKey} href={getDocumentHref(documentUrl)} target="_blank" rel="noreferrer">
                      {documentName}
                    </Anchor>
                  ) : (
                    <Text key={documentKey} c="dimmed" size="sm">
                      {documentName}
                    </Text>
                  )
                })}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">
                {t('Документів немає')}
              </Text>
            )}
          </Stack>
        </Stack>
      )}
    </AppDrawer>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  )
}

function getServiceDetailColumns(t: (value: string) => string): DataTableColumn<ServiceDetailItem>[] {
  return [
    {
      id: 'symbol',
      header: t('Код'),
      width: 110,
      accessor: (row) => row.ServiceDetailItemKey?.Symbol,
      cell: (row) => displayValue(row.ServiceDetailItemKey?.Symbol),
    },
    {
      id: 'name',
      header: t('Назва'),
      width: 220,
      accessor: (row) => row.ServiceDetailItemKey?.Name,
      cell: (row) => displayValue(row.ServiceDetailItemKey?.Name),
    },
    {
      id: 'qty',
      header: t('Кількість'),
      width: 110,
      align: 'right',
      accessor: (row) => row.Qty,
      cell: (row) => displayNumber(row.Qty),
    },
    {
      id: 'unitPrice',
      header: t('Ціна'),
      width: 120,
      align: 'right',
      accessor: (row) => row.UnitPrice,
      cell: (row) => displayMoney(row.UnitPrice),
    },
    {
      id: 'netPrice',
      header: t('Нетто'),
      width: 120,
      align: 'right',
      accessor: (row) => row.NetPrice,
      cell: (row) => displayMoney(row.NetPrice),
    },
    {
      id: 'vatPercent',
      header: `${t('ПДВ')} %`,
      width: 100,
      align: 'right',
      accessor: (row) => row.VatPercent,
      cell: (row) => displayNumber(row.VatPercent),
    },
    {
      id: 'vat',
      header: t('ПДВ'),
      width: 120,
      align: 'right',
      accessor: (row) => row.Vat,
      cell: (row) => displayMoney(row.Vat),
    },
    {
      id: 'grossPrice',
      header: t('Сума'),
      width: 120,
      align: 'right',
      accessor: (row) => row.GrossPrice,
      cell: (row) => displayMoney(row.GrossPrice),
    },
  ]
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
          service,
          serviceName: getServiceName(service, serviceTypeLabel),
          serviceType,
          serviceTypeLabel,
          status: task.TaskStatus,
          task,
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

function getServiceOrganizationName(service: ServiceItem): string | undefined {
  return service.ContainerOrganization?.Name
    || service.CustomAgencyOrganization?.Name
    || service.CustomOrganization?.Name
    || service.ExciseDutyOrganization?.Name
    || service.PlaneDeliveryOrganization?.Name
    || service.PortCustomAgencyOrganization?.Name
    || service.PortWorkOrganization?.Name
    || service.TransportationOrganization?.Name
    || service.VehicleDeliveryOrganization?.Name
    || service.VehicleOrganization?.Name
    || service.SupplyOrganizationAgreement?.Organization?.Name
}

function getAgreementLabel(service: ServiceItem): string | undefined {
  const agreement = service.SupplyOrganizationAgreement

  return agreement?.Name || agreement?.Number || agreement?.NetUid
}

function getServiceCurrencyCode(service: ServiceItem): string | undefined {
  return service.SupplyOrganizationAgreement?.Currency?.Code || service.SupplyOrganizationAgreement?.Currency?.Name
}

function getServiceTransportNumber(service: ServiceItem): string | undefined {
  return service.ContainerNumber || service.VehicleNumber
}

function collectServiceDocuments(task: SupplyPaymentTask, service: ServiceItem): BaseDocument[] {
  return [
    service.BillOfLadingDocument,
    ...(service.InvoiceDocuments || []),
    ...(service.BillOfLadingDocuments || []),
    ...(task.InvoiceDocuments || []),
    ...(task.SupplyPaymentTaskDocuments || []),
  ].filter((document): document is BaseDocument => Boolean(document))
}

function getServiceDocumentName(document: BaseDocument, index: number): string {
  const documentNumber = 'Number' in document ? stringFromUnknown(document.Number) : undefined

  return documentNumber
    || document.FileName
    || document.GeneratedName
    || document.NetUid
    || (document.Id ? String(document.Id) : `Документ ${index + 1}`)
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined
}

function getServiceDocumentUrl(document: BaseDocument): string | undefined {
  return document.DocumentURL
    || document.DocumentUrl
    || document.PdfDocumentURL
    || document.PdfDocumentUrl
    || document.URL
    || document.Url
    || document.url
}

function getServiceDocumentKey(document: BaseDocument, documentName: string): string {
  return document.NetUid
    || (document.Id ? String(document.Id) : undefined)
    || getServiceDocumentUrl(document)
    || documentName
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

function displayNumber(value?: number): string {
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
