import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconBuilding,
  IconCalendar,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconDots,
  IconFileTypePdf,
  IconPackageImport,
  IconPlus,
  IconRestore,
  IconSearch,
  IconTruckDelivery,
  IconUser,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { useAuth } from '../../auth/useAuth'
import {
  createProtocol,
  exportProtocolsDocument,
  getProtocolOrganizations,
  getProtocols,
} from '../api/productDeliveryProtocolsApi'
import { NewProductDeliveryProtocolModal } from '../components/NewProductDeliveryProtocolModal'
import { ProtocolOptionsModal } from '../components/ProtocolOptionsModal'
import { getProtocolPlacementStatusLabel, getProtocolStatusLabel } from '../protocolStatus'
import type {
  CreateProtocolPayload,
  DeliveryProductProtocol,
  ProtocolExportColumn,
  ProtocolExportDocument,
  ProtocolOrganization,
} from '../types'
import './product-delivery-protocols-page.css'
import '../../../shared/ui/console-table-page.css'

type FilterDraft = {
  from: string
  organization: string
  supplier: string
  to: string
}

type ProtocolSortId = 'comment' | 'created' | 'fromDate' | 'number' | 'organization' | 'responsible' | 'status' | 'suppliers'

type ProtocolSortState = {
  direction: 'asc' | 'desc'
  id: ProtocolSortId
} | null

const EXPORT_COLUMNS: ProtocolExportColumn[] = [
  { Number: 1, TableName: 'DeliveryProductProtocol.DeliveryProductProtocolNumber', ColumnName: 'Number', Translate: 'Номер' },
  { Number: 2, TableName: 'DeliveryProductProtocol', ColumnName: 'FromDate', Translate: 'Від якої дати' },
  { Number: 3, TableName: 'DeliveryProductProtocol.Organization', ColumnName: 'Name', Translate: 'Організація' },
  { Number: 4, TableName: 'DeliveryProductProtocol.User', ColumnName: 'LastName', Translate: 'Відповідальний' },
  { Number: 5, TableName: 'DeliveryProductProtocol', ColumnName: 'Created', Translate: 'Створено' },
  { Number: 6, TableName: 'DeliveryProductProtocol.SupplyInvoices.SupplyOrder.Client', ColumnName: 'FullName', Translate: 'Постачальники' },
  { Number: 7, TableName: 'DeliveryProductProtocol', ColumnName: 'Comment', Translate: 'Коментар' },
]

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })

const PERMISSION_EXPORT = 'ProductDeliveryProtocols_Load_PKEY'
const PERMISSION_CREATE = 'ProductDeliveryProtocols_AddNew_PKEY'
const PERMISSION_SELECT_OPTIONS = 'ProductDeliveryProtocols_SelectAnOption_SelectOptionBtn_PKEY'
const PERMISSION_OPEN_LOGISTIC_PATH = 'ProductDeliveryProtocols_SelectAnOption_LogisticWay_PKEY'
const PERMISSION_OPEN_SPECIFICATIONS = 'ProductDeliveryProtocols_SelectAnOption_ProductSpecificationCodes_PKEY'
const PERMISSION_OPEN_INCOME = 'ProductDeliveryProtocols_SelectAnOption_PlacementSupplyOrder_PKEY'

function useProtocolsPageModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const initialFilters = useMemo<FilterDraft>(
    () => ({
      from: getDateShiftedByDays(-30),
      organization: '',
      supplier: '',
      to: formatLocalDate(new Date()),
    }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [protocols, setProtocols] = useValueState<DeliveryProductProtocol[]>([])
  const [totalQty, setTotalQty] = useValueState(0)
  const [organizations, setOrganizations] = useValueState<ProtocolOrganization[]>([])
  const [organizationsError, setOrganizationsError] = useValueState<string | null>(null)
  const [optionsProtocol, setOptionsProtocol] = useValueState<DeliveryProductProtocol | null>(null)
  const [isCreateModalOpen, setCreateModalOpen] = useValueState(false)
  const [createError, setCreateError] = useValueState<string | null>(null)
  const [isCreating, setCreating] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [hasMore, setHasMore] = useValueState(false)
  const [sortState, setSortState] = useValueState<ProtocolSortState>(null)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<ProtocolExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const sortedProtocols = useMemo(() => sortProtocols(protocols, sortState), [protocols, sortState])
  const totalPages = Math.max(1, Math.ceil(totalQty / pageSize))
  const canMoveBackward = page > 1
  const canMoveForward = hasMore || page < totalPages
  const canExport = hasPermission(PERMISSION_EXPORT)
  const canCreate = hasPermission(PERMISSION_CREATE)
  const canOpenOptions = hasPermission(PERMISSION_SELECT_OPTIONS)
  const canOpenLogisticPath = hasPermission(PERMISSION_OPEN_LOGISTIC_PATH)
  const canOpenSpecifications = hasPermission(PERMISSION_OPEN_SPECIFICATIONS)
  const canOpenIncome = hasPermission(PERMISSION_OPEN_INCOME)
  const exportScopeWarning = getExportScopeWarning(activeFilters, t)

  const resetProtocols = useCallback(() => {
    setProtocols([])
    setTotalQty(0)
    setHasMore(false)
    setLoading(false)
  }, [setHasMore, setLoading, setProtocols, setTotalQty])

  useProtocolOrganizationsLoader({ setOrganizations, setOrganizationsError })

  useProtocolsLoader({
    activeFilters,
    filterError,
    page,
    pageSize,
    reloadKey,
    resetProtocols,
    setError,
    setHasMore,
    setLoading,
    setProtocols,
    setTotalQty,
  })

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
    setPage(1)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
    setPage(1)
  }

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  async function exportDocument() {
    if (filterError) {
      setDownloadOpened(true)
      setDownloadDocument(null)
      setDownloadError(filterError)
      setDownloading(false)
      return
    }

    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    setDownloadOpened(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await exportProtocolsDocument(activeFilters.from, activeFilters.to, EXPORT_COLUMNS)

      if (downloadRequestRef.current === requestId) {
        setDownloadDocument(document)
      }
    } catch (exportError) {
      if (downloadRequestRef.current === requestId) {
        setDownloadError(exportError instanceof Error ? exportError.message : t('Документ недоступний для завантаження'))
      }
    } finally {
      if (downloadRequestRef.current === requestId) {
        setDownloading(false)
      }
    }
  }

  function openCreateModal() {
    setCreateError(null)
    setCreateModalOpen(true)
  }

  function closeCreateModal() {
    if (!isCreating) {
      setCreateModalOpen(false)
      setCreateError(null)
    }
  }

  async function handleCreate(payload: CreateProtocolPayload) {
    setCreateError(null)
    setCreating(true)

    try {
      const created = await createProtocol(payload)

      setCreateModalOpen(false)

      if (created?.NetUid) {
        navigate(`/product-delivery-protocols/${created.NetUid}`)
        return
      }

      reload()
    } catch (createErrorValue) {
      setCreateError(createErrorValue instanceof Error ? createErrorValue.message : t('Не вдалося створити протокол'))
    } finally {
      setCreating(false)
    }
  }

  const openOptions = useCallback(
    (protocol: DeliveryProductProtocol) => {
      if (canOpenOptions) {
        setOptionsProtocol(protocol)
      }
    },
    [canOpenOptions, setOptionsProtocol],
  )
  const closeOptions = useCallback(() => setOptionsProtocol(null), [setOptionsProtocol])

  const navigateToLogisticPath = useCallback(
    (protocol: DeliveryProductProtocol) => {
      closeOptions()
      navigate(`/product-delivery-protocols/${protocol.NetUid}`)
    },
    [closeOptions, navigate],
  )
  const navigateToSpecifications = useCallback(
    (protocol: DeliveryProductProtocol) => {
      closeOptions()
      navigate(`/product-delivery-protocols/${protocol.NetUid}/specifications`)
    },
    [closeOptions, navigate],
  )
  const navigateToIncome = useCallback(
    (protocol: DeliveryProductProtocol) => {
      closeOptions()
      navigate(`/product-delivery-protocols/${protocol.NetUid}/product-income`)
    },
    [closeOptions, navigate],
  )

  return {
    activeFilters, canCreate, canExport, canOpenIncome, canOpenLogisticPath, canOpenOptions, canOpenSpecifications,
    canMoveBackward, canMoveForward, closeCreateModal, closeDownload, closeOptions, createError, downloadDocument, downloadError,
    downloadOpened, error, exportDocument, filterDraft, filterError, handleCreate, isCreateModalOpen,
    exportScopeWarning, isCreating, isDownloading, isLoading, navigateToIncome, navigateToLogisticPath,
    navigateToSpecifications, openCreateModal, openOptions, optionsProtocol, organizations, organizationsError,
    page, pageSize, protocols: sortedProtocols, applyFilters, reload, resetFilters, setPage, setPageSize,
    setSortState, sortState, totalPages, totalQty,
  }
}

function useProtocolOrganizationsLoader({
  setOrganizations,
  setOrganizationsError,
}: {
  setOrganizations: (value: ProtocolOrganization[]) => void
  setOrganizationsError: (value: string | null) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false

    async function loadOrganizations() {
      setOrganizationsError(null)

      try {
        const nextOrganizations = await getProtocolOrganizations()

        if (!cancelled) {
          setOrganizations(nextOrganizations)
        }
      } catch (loadError) {
        if (!cancelled) {
          setOrganizations([])
          setOrganizationsError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити організації'))
        }
      }
    }

    void loadOrganizations()

    return () => {
      cancelled = true
    }
  }, [setOrganizations, setOrganizationsError, t])
}

function useProtocolsLoader({
  activeFilters,
  filterError,
  page,
  pageSize,
  reloadKey,
  resetProtocols,
  setError,
  setHasMore,
  setLoading,
  setProtocols,
  setTotalQty,
}: {
  activeFilters: FilterDraft
  filterError: string | null
  page: number
  pageSize: number
  reloadKey: number
  resetProtocols: () => void
  setError: (value: string | null) => void
  setHasMore: (value: boolean) => void
  setLoading: (value: boolean) => void
  setProtocols: (value: DeliveryProductProtocol[]) => void
  setTotalQty: (value: number) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError) {
      resetProtocols()
      return
    }

    let cancelled = false

    async function loadProtocols() {
      setLoading(true)
      setError(null)

      try {
        const offset = (page - 1) * pageSize
        const result = await getProtocols({
          from: activeFilters.from,
          limit: pageSize,
          offset,
          organization: activeFilters.organization,
          supplier: activeFilters.supplier,
          to: activeFilters.to,
        })

        if (!cancelled) {
          setProtocols(result.items)
          setTotalQty(result.totalQty)
          setHasMore(offset + result.items.length < result.totalQty && result.items.length > 0)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProtocols([])
          setTotalQty(0)
          setHasMore(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити протоколи'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProtocols()

    return () => {
      cancelled = true
    }
  }, [
    activeFilters,
    filterError,
    page,
    pageSize,
    reloadKey,
    resetProtocols,
    setError,
    setHasMore,
    setLoading,
    setProtocols,
    setTotalQty,
    t,
  ])
}

export function ProductDeliveryProtocolsPage() {
  const { t } = useI18n()
  const model = useProtocolsPageModel()

  return (
    <Stack className="product-delivery-protocols-page console-table-page" gap="md">
      {model.canCreate && (
        <PageHeaderActions>
          <Button
            color={CREATE_ACTION_COLOR}
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={model.openCreateModal}
          >
            {t('Додати')}
          </Button>
        </PageHeaderActions>
      )}
      <ProtocolsTableCard model={model} />
      <ProtocolOptionsModal
        canOpenIncome={model.canOpenIncome}
        canOpenLogisticPath={model.canOpenLogisticPath}
        canOpenSpecifications={model.canOpenSpecifications}
        protocol={model.optionsProtocol}
        onClose={model.closeOptions}
        onOpenIncome={model.navigateToIncome}
        onOpenLogisticPath={model.navigateToLogisticPath}
        onOpenSpecifications={model.navigateToSpecifications}
      />
      <NewProductDeliveryProtocolModal
        createError={model.createError}
        isCreating={model.isCreating}
        opened={model.isCreateModalOpen}
        organizations={model.organizations}
        organizationsError={model.organizationsError}
        onClose={model.closeCreateModal}
        onCreate={model.handleCreate}
      />
      <ProtocolsDownloadModal model={model} />
    </Stack>
  )
}

function ProtocolsTableCard({ model }: { model: ReturnType<typeof useProtocolsPageModel> }) {
  const { t } = useI18n()
  const {
    applyFilters, canExport, canOpenOptions, error, exportDocument, filterDraft,
    filterError, isDownloading, isLoading, openOptions, organizations, page, pageSize, protocols, reload,
    resetFilters, setPage, setPageSize, setSortState, sortState, totalPages,
  } = model
  const organizationOptions = useMemo(
    () => [
      { label: t('Всі організації'), value: '' },
      ...organizations.reduce<{ label: string; value: string }[]>((options, organization) => {
        if (organization.Name || organization.FullName) {
          options.push({
            label: organization.Name || organization.FullName || '',
            value: organization.Name || organization.FullName || '',
          })
        }

        return options
      }, []),
    ],
    [organizations, t],
  )
  const hasActiveFilters = Boolean(filterDraft.supplier.trim() || filterDraft.organization || filterDraft.from || filterDraft.to)

  return (
    <div className="console-table-shell">
      <div className="app-filter-bar product-delivery-protocols-command-bar">
        <div className="product-delivery-protocols-period-filter">
          <span className="product-delivery-protocols-filter-label">{t('Період')}</span>
          <div className="product-delivery-protocols-period-fields">
            <TextInput
              className="product-delivery-protocols-date-input"
              aria-label={t('Від')}
              max={filterDraft.to || undefined}
              type="date"
              value={filterDraft.from}
              onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
            />
            <span className="product-delivery-protocols-period-separator" />
            <TextInput
              className="product-delivery-protocols-date-input"
              aria-label={t('До')}
              min={filterDraft.from || undefined}
              type="date"
              value={filterDraft.to}
              onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
            />
          </div>
        </div>

        <TextInput
          className="product-delivery-protocols-search-input"
          leftSection={<IconSearch size={16} />}
          label={t('Постачальник')}
          placeholder={t('Пошук постачальника')}
          value={filterDraft.supplier}
          onChange={(event) => applyFilters({ ...filterDraft, supplier: event.currentTarget.value })}
        />

        <Select
          className="product-delivery-protocols-organization-select"
          data={organizationOptions}
          label={t('Організація')}
          searchable
          value={filterDraft.organization}
          onChange={(value) => applyFilters({ ...filterDraft, organization: value || '' })}
        />

        <div className="app-filter-actions product-delivery-protocols-command-actions">
          <Tooltip label={t('Скинути')}>
            <ActionIcon
              aria-label={t('Скинути')}
              color="gray"
              disabled={!hasActiveFilters}
              size={34}
              variant="light"
              onClick={resetFilters}
            >
              <IconRestore size={17} />
            </ActionIcon>
          </Tooltip>
          {canExport && (
            <Tooltip label={t('Завантажити')}>
              <ActionIcon
                aria-label={t('Завантажити')}
                color="gray"
                disabled={Boolean(filterError) || isDownloading}
                loading={isDownloading}
                size={34}
                variant="light"
                onClick={exportDocument}
              >
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
          )}
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

      {(error || filterError) && (
        <Alert className="console-table-alert" color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
          {filterError || error}
        </Alert>
      )}

      <div className="product-delivery-protocols-page__table console-table-body">
        <ProtocolsList
          canOpenOptions={canOpenOptions}
          isLoading={isLoading}
          protocols={protocols}
          sortState={sortState}
          onOpenOptions={openOptions}
          onSort={setSortState}
        />
      </div>
    </div>
  )
}

function ProtocolsList({
  canOpenOptions,
  isLoading,
  protocols,
  sortState,
  onOpenOptions,
  onSort,
}: {
  canOpenOptions: boolean
  isLoading: boolean
  protocols: DeliveryProductProtocol[]
  sortState: ProtocolSortState
  onOpenOptions: (protocol: DeliveryProductProtocol) => void
  onSort: Dispatch<SetStateAction<ProtocolSortState>>
}) {
  const { t } = useI18n()

  return (
    <div className="product-delivery-protocols-list">
      <div className="product-delivery-protocols-list-head">
        <ProtocolSortHeader id="number" label={t('Протокол / дата')} sortState={sortState} onSort={onSort} />
        <ProtocolSortHeader id="status" label={t('Статус / оприбуткування')} sortState={sortState} onSort={onSort} />
        <ProtocolSortHeader id="organization" label={t('Організація')} sortState={sortState} onSort={onSort} />
        <ProtocolSortHeader id="suppliers" label={t('Постачальники')} sortState={sortState} onSort={onSort} />
        <ProtocolSortHeader id="comment" label={t('Коментар')} sortState={sortState} onSort={onSort} />
        <ProtocolSortHeader id="responsible" label={t('Відповідальний')} sortState={sortState} onSort={onSort} />
        <ProtocolSortHeader id="created" label={t('Створено')} sortState={sortState} onSort={onSort} />
        <span aria-hidden />
      </div>

      <div className="product-delivery-protocols-list-body">
        {isLoading ? (
          <div className="product-delivery-protocols-list-state">{t('Завантаження протоколів')}</div>
        ) : protocols.length === 0 ? (
          <div className="product-delivery-protocols-list-state">{t('Протоколів не знайдено')}</div>
        ) : (
          protocols.map((protocol, index) => (
            <ProtocolRow
              key={String(protocol.NetUid || protocol.Id || index)}
              canOpenOptions={canOpenOptions}
              protocol={protocol}
              onOpenOptions={onOpenOptions}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ProtocolSortHeader({
  id,
  label,
  sortState,
  onSort,
}: {
  id: ProtocolSortId
  label: string
  sortState: ProtocolSortState
  onSort: Dispatch<SetStateAction<ProtocolSortState>>
}) {
  const isActive = sortState?.id === id

  return (
    <button
      className={`product-delivery-protocols-sort-header${isActive ? ' is-active' : ''}`}
      type="button"
      onClick={() => {
        onSort((current) => {
          if (current?.id !== id) {
            return { direction: 'asc', id }
          }

          return { direction: current.direction === 'asc' ? 'desc' : 'asc', id }
        })
      }}
    >
      <span>{label}</span>
      {isActive && sortState?.direction === 'desc' ? <IconChevronDown size={13} /> : <IconChevronUp size={13} />}
    </button>
  )
}

function ProtocolRow({
  canOpenOptions,
  protocol,
  onOpenOptions,
}: {
  canOpenOptions: boolean
  protocol: DeliveryProductProtocol
  onOpenOptions: (protocol: DeliveryProductProtocol) => void
}) {
  const openOptions = () => {
    if (canOpenOptions) {
      onOpenOptions(protocol)
    }
  }

  return (
    <div
      className={`product-delivery-protocols-row${canOpenOptions ? ' is-clickable' : ''}`}
      role={canOpenOptions ? 'button' : undefined}
      tabIndex={canOpenOptions ? 0 : -1}
      onClick={openOptions}
      onKeyDown={(event) => {
        if (canOpenOptions && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          openOptions()
        }
      }}
    >
      <ProtocolMainCell protocol={protocol} />
      <ProtocolStateCell protocol={protocol} />
      <ProtocolOrganizationCell protocol={protocol} />
      <ProtocolSuppliersCell protocol={protocol} />
      <ProtocolCommentCell protocol={protocol} />
      <ProtocolResponsibleCell protocol={protocol} />
      <ProtocolCreatedCell protocol={protocol} />
      <ProtocolActionsCell canOpenOptions={canOpenOptions} protocol={protocol} onOpenOptions={onOpenOptions} />
    </div>
  )
}

function ProtocolMainCell({ protocol }: { protocol: DeliveryProductProtocol }) {
  const { t } = useI18n()
  const number = displayValue(protocol.DeliveryProductProtocolNumber?.Number)
  const date = formatDate(protocol.FromDate)
  const tooltip = [number, date].join('\n')

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="product-delivery-protocols-main-cell">
        <span className="product-delivery-protocols-main-icon" aria-hidden>
          <IconTruckDelivery size={16} />
        </span>
        <span className="product-delivery-protocols-main-copy">
          <span className="product-delivery-protocols-main-title">{number}</span>
          <span className="product-delivery-protocols-main-subtitle">
            <IconCalendar size={12} />
            {t('від')} {date}
          </span>
        </span>
      </span>
    </Tooltip>
  )
}

function ProtocolStateCell({ protocol }: { protocol: DeliveryProductProtocol }) {
  const { t } = useI18n()

  return (
    <span className="product-delivery-protocols-state-cell">
      <span className={`product-delivery-protocols-state-main is-${getProtocolStatusTone(protocol)}`}>
        <span className="product-delivery-protocols-state-dot" aria-hidden />
        {getProtocolStatusLabel(protocol, t)}
      </span>
      <span className={`product-delivery-protocols-state-sub is-${getProtocolPlacementTone(protocol)}`}>
        {getProtocolPlacementStatusLabel(protocol, t)}
      </span>
    </span>
  )
}

function ProtocolOrganizationCell({ protocol }: { protocol: DeliveryProductProtocol }) {
  const title = displayValue(protocol.Organization?.Name)
  const subtitle = displayValue(protocol.Organization?.FullName || protocol.Organization?.Abbreviation || protocol.Organization?.Code)
  const tooltip = [title, subtitle].filter((value) => value && value !== '-').join('\n') || title

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="product-delivery-protocols-icon-cell">
        <span className="product-delivery-protocols-small-icon" aria-hidden>
          <IconBuilding size={14} />
        </span>
        <span className="product-delivery-protocols-two-line-cell">
          <span>{title}</span>
          <small>{subtitle}</small>
        </span>
      </span>
    </Tooltip>
  )
}

function ProtocolResponsibleCell({ protocol }: { protocol: DeliveryProductProtocol }) {
  const title = displayValue(getResponsibleName(protocol))
  const subtitle = displayValue(protocol.User?.Name || protocol.User?.FullName)
  const tooltip = [title, subtitle].filter((value) => value && value !== '-').join('\n') || title

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="product-delivery-protocols-icon-cell">
        <span className="product-delivery-protocols-user-icon" aria-hidden>
          <IconUser size={14} />
        </span>
        <span className="product-delivery-protocols-two-line-cell">
          <span>{title}</span>
          <small>{subtitle}</small>
        </span>
      </span>
    </Tooltip>
  )
}

function ProtocolSuppliersCell({ protocol }: { protocol: DeliveryProductProtocol }) {
  const { t } = useI18n()
  const suppliers = getSupplierNames(protocol)
  const invoiceCount = protocol.SupplyInvoices?.length || 0
  const title = displayValue(suppliers[0])
  const subtitle = suppliers.length > 1
    ? `${suppliers.length} ${t('постачальники')}`
    : `${invoiceCount} ${t('інвойсів')}`
  const tooltip = suppliers.length > 0 ? suppliers.join('\n') : title

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="product-delivery-protocols-icon-cell">
        <span className="product-delivery-protocols-small-icon" aria-hidden>
          <IconPackageImport size={14} />
        </span>
        <span className="product-delivery-protocols-two-line-cell">
          <span>{title}</span>
          <small>{subtitle}</small>
        </span>
      </span>
    </Tooltip>
  )
}

function ProtocolCommentCell({ protocol }: { protocol: DeliveryProductProtocol }) {
  const value = displayValue(protocol.Comment)

  return (
    <Tooltip label={value} multiline openDelay={350} withArrow>
      <span className="product-delivery-protocols-comment-cell">{value}</span>
    </Tooltip>
  )
}

function ProtocolCreatedCell({ protocol }: { protocol: DeliveryProductProtocol }) {
  const dateParts = formatDateTimeParts(protocol.Created)

  return (
    <Tooltip label={dateParts.tooltip} openDelay={350} withArrow>
      <span className="product-delivery-protocols-date-cell">
        <span>{dateParts.date}</span>
        <small>{dateParts.time}</small>
      </span>
    </Tooltip>
  )
}

function ProtocolActionsCell({
  canOpenOptions,
  protocol,
  onOpenOptions,
}: {
  canOpenOptions: boolean
  protocol: DeliveryProductProtocol
  onOpenOptions: (protocol: DeliveryProductProtocol) => void
}) {
  const { t } = useI18n()

  if (!canOpenOptions) {
    return <span className="product-delivery-protocols-action-placeholder" aria-hidden />
  }

  return (
    <Group className="product-delivery-protocols-row-actions" gap={4} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      <Tooltip label={t('Дії')}>
        <ActionIcon aria-label={t('Дії')} color="gray" size="sm" variant="subtle" onClick={() => onOpenOptions(protocol)}>
          <IconDots size={15} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

function ProtocolsDownloadModal({ model }: { model: ReturnType<typeof useProtocolsPageModel> }) {
  const { t } = useI18n()
  const { closeDownload, downloadDocument, downloadError, downloadOpened, exportScopeWarning, isDownloading } = model

  return (
    <AppModal centered opened={downloadOpened} title={t('Завантажити')} onClose={closeDownload}>
      <Stack gap="sm">
        {exportScopeWarning && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {exportScopeWarning}
          </Alert>
        )}

        {isDownloading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : downloadError ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {downloadError}
          </Alert>
        ) : downloadDocument?.DocumentURL || downloadDocument?.PdfDocumentURL ? (
          <>
            {downloadDocument.DocumentURL && (
              <Anchor
                href={upgradeHttpToHttps(downloadDocument.DocumentURL)}
                target="_blank"
                rel="noreferrer"
                className="document-link"
              >
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {downloadDocument.PdfDocumentURL && (
              <Anchor
                href={upgradeHttpToHttps(downloadDocument.PdfDocumentURL)}
                target="_blank"
                rel="noreferrer"
                className="document-link"
              >
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

function getExportScopeWarning(filters: Pick<FilterDraft, 'organization' | 'supplier'>, t: (value: string) => string): string | null {
  if (!filters.organization && !filters.supplier) {
    return null
  }

  return t('Експорт протоколів використовує тільки період дат. Фільтри організації та постачальника не входять у цей документ.')
}

function sortProtocols(protocols: DeliveryProductProtocol[], sortState: ProtocolSortState): DeliveryProductProtocol[] {
  if (!sortState) {
    return protocols
  }

  const direction = sortState.direction === 'asc' ? 1 : -1

  return protocols.toSorted(
    (firstProtocol, secondProtocol) =>
      compareProtocolSortValues(
        getProtocolSortValue(firstProtocol, sortState.id),
        getProtocolSortValue(secondProtocol, sortState.id),
      ) * direction,
  )
}

function getProtocolSortValue(protocol: DeliveryProductProtocol, id: ProtocolSortId): number | string {
  switch (id) {
    case 'comment':
      return protocol.Comment || ''
    case 'created':
      return getDateTime(protocol.Created)
    case 'fromDate':
      return getDateTime(protocol.FromDate)
    case 'number':
      return protocol.DeliveryProductProtocolNumber?.Number || ''
    case 'organization':
      return compactStrings([protocol.Organization?.Name, protocol.Organization?.FullName, protocol.Organization?.Abbreviation]).join(' ')
    case 'responsible':
      return getResponsibleName(protocol)
    case 'status':
      return `${protocol.IsCompleted ? 2 : protocol.IsShipped ? 1 : 0}:${protocol.IsPlaced ? 2 : protocol.IsPartiallyPlaced ? 1 : 0}`
    case 'suppliers':
      return getSupplierNames(protocol).join(' ')
  }
}

function compareProtocolSortValues(firstValue: number | string, secondValue: number | string): number {
  if (typeof firstValue === 'number' && typeof secondValue === 'number') {
    return firstValue - secondValue
  }

  return String(firstValue).localeCompare(String(secondValue), 'uk', {
    numeric: true,
    sensitivity: 'base',
  })
}

function getSupplierNames(protocol: DeliveryProductProtocol): string[] {
  return Array.from(
    new Set(
      (protocol.SupplyInvoices || [])
        .map((invoice) => invoice.SupplyOrder?.Client?.FullName || invoice.SupplyOrder?.Client?.Name || '')
        .filter(Boolean),
    ),
  )
}

function getProtocolStatusTone(protocol: DeliveryProductProtocol): 'info' | 'neutral' | 'success' {
  if (protocol.IsCompleted) {
    return 'success'
  }

  if (protocol.IsShipped) {
    return 'info'
  }

  return 'neutral'
}

function getProtocolPlacementTone(protocol: DeliveryProductProtocol): 'neutral' | 'success' | 'warning' {
  if (protocol.IsPlaced) {
    return 'success'
  }

  if (protocol.IsPartiallyPlaced) {
    return 'warning'
  }

  return 'neutral'
}

function getResponsibleName(protocol: DeliveryProductProtocol): string {
  const user = protocol.User

  return (
    user?.LastName?.trim()
    || user?.FullName?.trim()
    || user?.Name?.trim()
    || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ').trim()
    || ''
  )
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}

function getDateShiftedByDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getDateTime(value: unknown): number {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime()
  }

  if (typeof value !== 'string' || !value) {
    return 0
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateFormatter.format(date)
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function formatDateTimeParts(value?: Date | string): { date: string; time: string; tooltip: string } {
  if (!value) {
    return { date: '-', time: '-', tooltip: '-' }
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    const fallback = String(value)

    return { date: fallback, time: '-', tooltip: fallback }
  }

  const datePart = dateFormatter.format(date)
  const timePart = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })

  return {
    date: datePart,
    time: timePart,
    tooltip: formatDateTime(value),
  }
}

function compactStrings(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
