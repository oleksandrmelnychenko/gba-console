import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconDownload,
  IconFileTypePdf,
  IconPlus,
  IconRefresh,
  IconRestore,
} from '@tabler/icons-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  createProtocol,
  exportProtocolsDocument,
  getProtocolOrganizations,
  getProtocols,
} from '../api/productDeliveryProtocolsApi'
import { NewProductDeliveryProtocolModal } from '../components/NewProductDeliveryProtocolModal'
import { ProtocolOptionsModal } from '../components/ProtocolOptionsModal'
import type {
  CreateProtocolPayload,
  DeliveryProductProtocol,
  ProtocolExportColumn,
  ProtocolExportDocument,
  ProtocolOrganization,
} from '../types'

type FilterDraft = {
  from: string
  organization: string
  supplier: string
  to: string
}

const DEFAULT_PAGE_SIZE = 30
const PAGE_SIZE_OPTIONS = ['30', '50', '100', '150']

const PROTOCOLS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['index', 'number', 'fromDate'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

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
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [hasMore, setHasMore] = useValueState(false)
  const [downloadOpened, setDownloadOpened] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<ProtocolExportDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [isDownloading, setDownloading] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const downloadRequestRef = useRef(0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${activeFilters.organization}|${activeFilters.supplier}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)
  const protocolIndexMap = useMemo(() => buildIndexMap(protocols), [protocols])
  const canExport = hasPermission(PERMISSION_EXPORT)
  const canCreate = hasPermission(PERMISSION_CREATE)
  const canOpenOptions = hasPermission(PERMISSION_SELECT_OPTIONS)
  const canOpenLogisticPath = hasPermission(PERMISSION_OPEN_LOGISTIC_PATH)
  const canOpenSpecifications = hasPermission(PERMISSION_OPEN_SPECIFICATIONS)
  const canOpenIncome = hasPermission(PERMISSION_OPEN_INCOME)

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

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
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  async function loadMoreProtocols() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = protocols.length
    setLoadingMore(true)
    setError(null)

    try {
      const result = await getProtocols({
        from: activeFilters.from,
        limit: pageSize,
        offset: requestOffset,
        organization: activeFilters.organization,
        supplier: activeFilters.supplier,
        to: activeFilters.to,
      })

      if (listRequestKeyRef.current === requestKey) {
        setProtocols((current) => (current.length === requestOffset ? [...current, ...result.items] : current))
        setTotalQty(result.totalQty)
        setHasMore(requestOffset + result.items.length < result.totalQty && result.items.length > 0)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити наступні протоколи'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  const closeDownload = useCallback(() => {
    downloadRequestRef.current += 1
    setDownloadOpened(false)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(false)
  }, [setDownloadDocument, setDownloadError, setDownloadOpened, setDownloading])

  async function exportDocument() {
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

  const columns = useProtocolColumns(protocolIndexMap)

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {protocols.length} / {totalQty}
      </Text>
    ),
    [protocols.length, t, totalQty],
  )

  return {
    activeFilters, canCreate, canExport, canOpenIncome, canOpenLogisticPath, canOpenOptions, canOpenSpecifications,
    closeCreateModal, closeDownload, closeOptions, columns, createError, downloadDocument, downloadError,
    downloadOpened, error, exportDocument, filterDraft, filterError, handleCreate, hasMore, isCreateModalOpen,
    isCreating, isDownloading, isLoading, isLoadingMore, loadMoreProtocols, navigateToIncome, navigateToLogisticPath,
    navigateToSpecifications, openCreateModal, openOptions, optionsProtocol, organizations, organizationsError,
    pageSize, protocols, applyFilters, reload, resetFilters, setPageSize, toolbarLeft,
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
        const result = await getProtocols({
          from: activeFilters.from,
          limit: pageSize,
          offset: 0,
          organization: activeFilters.organization,
          supplier: activeFilters.supplier,
          to: activeFilters.to,
        })

        if (!cancelled) {
          setProtocols(result.items)
          setTotalQty(result.totalQty)
          setHasMore(result.items.length < result.totalQty && result.items.length > 0)
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
  const model = useProtocolsPageModel()

  return (
    <Stack gap="lg">
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
    applyFilters, canCreate, canExport, canOpenOptions, columns, error, exportDocument, filterDraft, filterError,
    hasMore, isDownloading, isLoading, isLoadingMore, loadMoreProtocols, openCreateModal, openOptions, organizations,
    pageSize, protocols, reload, resetFilters, setPageSize, toolbarLeft,
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

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
          <TextInput
            label={t('Постачальник')}
            value={filterDraft.supplier}
            onChange={(event) => applyFilters({ ...filterDraft, supplier: event.currentTarget.value })}
            style={{ flex: '1 1 auto', minWidth: 180 }}
          />
          <TextInput
            label={t('Від якої дати')}
            max={filterDraft.to || undefined}
            type="date"
            value={filterDraft.from}
            onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
            style={{ flex: '0 0 auto' }}
          />
          <TextInput
            label={t('До якої дати')}
            min={filterDraft.from || undefined}
            type="date"
            value={filterDraft.to}
            onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
            style={{ flex: '0 0 auto' }}
          />
          <Select
            data={organizationOptions}
            label={t('Організація')}
            searchable
            value={filterDraft.organization}
            w={220}
            onChange={(value) => applyFilters({ ...filterDraft, organization: value || '' })}
            style={{ flex: '0 0 auto' }}
          />
          <Tooltip label={t('Скинути')}>
            <ActionIcon
              aria-label={t('Скинути')}
              color="gray"
              size={36}
              style={{ flex: '0 0 auto' }}
              variant="light"
              onClick={resetFilters}
            >
              <IconRestore size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size={36}
              style={{ flex: '0 0 auto' }}
              variant="light"
              onClick={() => reload()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          {canExport && (
            <Button
              color="gray"
              leftSection={<IconDownload size={16} />}
              loading={isDownloading}
              style={{ flex: '0 0 auto' }}
              variant="light"
              onClick={exportDocument}
            >
              {t('Завантажити')}
            </Button>
          )}
          {canCreate && (
            <Button
              color="violet"
              leftSection={<IconPlus size={16} />}
              style={{ flex: '0 0 auto' }}
              onClick={openCreateModal}
            >
              {t('Додати')}
            </Button>
          )}
        </Group>

        {(error || filterError) && (
          <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
            {filterError || error}
          </Alert>
        )}

        <Group justify="flex-end" gap="xs">
          <Select
            aria-label={t('Кількість рядків')}
            data={PAGE_SIZE_OPTIONS}
            size="xs"
            value={String(pageSize)}
            w={88}
            onChange={(value) => {
              setPageSize(Number(value || DEFAULT_PAGE_SIZE))
              reload()
            }}
          />
        </Group>

        <DataTable
          columns={columns}
          data={protocols}
          defaultLayout={PROTOCOLS_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Протоколів не знайдено')}
          getRowId={(protocol, index) => String(protocol.NetUid || protocol.Id || index)}
          isLoading={isLoading}
          layoutVersion="product-delivery-protocols-table-1"
          loadingText={t('Завантаження протоколів')}
          maxHeight="calc(100vh - 360px)"
          minWidth={1240}
          tableId="product-delivery-protocols"
          toolbarLeft={toolbarLeft}
          onRowClick={canOpenOptions ? openOptions : undefined}
        />

        {hasMore && (
          <Group justify="center">
            <Button color="gray" loading={isLoadingMore} variant="light" onClick={loadMoreProtocols}>
              {t('Завантажити ще')}
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  )
}

function ProtocolsDownloadModal({ model }: { model: ReturnType<typeof useProtocolsPageModel> }) {
  const { t } = useI18n()
  const { closeDownload, downloadDocument, downloadError, downloadOpened, isDownloading } = model

  return (
    <AppModal centered opened={downloadOpened} title={t('Завантажити')} onClose={closeDownload}>
      <Stack gap="sm">
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
              <Anchor href={downloadDocument.DocumentURL} target="_blank" rel="noreferrer" className="document-link">
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {downloadDocument.PdfDocumentURL && (
              <Anchor href={downloadDocument.PdfDocumentURL} target="_blank" rel="noreferrer" className="document-link">
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

function useProtocolColumns(indexMap: Map<DeliveryProductProtocol, number>) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<DeliveryProductProtocol>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 56,
        minWidth: 48,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        accessor: (protocol) => indexMap.get(protocol) || 0,
        cell: (protocol) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(protocol) || ''}
          </Text>
        ),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        accessor: (protocol) => protocol.DeliveryProductProtocolNumber?.Number,
        cell: (protocol) => <Text fw={700}>{displayValue(protocol.DeliveryProductProtocolNumber?.Number)}</Text>,
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 140,
        minWidth: 120,
        accessor: (protocol) => getDateTime(protocol.FromDate),
        cell: (protocol) => <Text fw={600}>{formatDate(protocol.FromDate)}</Text>,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 240,
        minWidth: 180,
        accessor: (protocol) => protocol.Organization?.Name,
        cell: (protocol) => displayValue(protocol.Organization?.Name),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 200,
        minWidth: 150,
        accessor: (protocol) => protocol.User?.LastName,
        cell: (protocol) => displayValue(getResponsibleName(protocol)),
      },
      {
        id: 'created',
        header: t('Створено'),
        width: 168,
        minWidth: 148,
        accessor: (protocol) => getDateTime(protocol.Created),
        cell: (protocol) => formatDateTime(protocol.Created),
      },
      {
        id: 'suppliers',
        header: t('Постачальники'),
        minWidth: 240,
        enableSorting: false,
        accessor: (protocol) => formatSuppliers(protocol),
        cell: (protocol) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(formatSuppliers(protocol))}
          </Text>
        ),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 200,
        accessor: (protocol) => protocol.Comment,
        cell: (protocol) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(protocol.Comment)}
          </Text>
        ),
      },
    ],
    [indexMap, t],
  )
}

function buildIndexMap(protocols: DeliveryProductProtocol[]): Map<DeliveryProductProtocol, number> {
  return protocols.reduce((indexMap, protocol, index) => {
    indexMap.set(protocol, index + 1)

    return indexMap
  }, new Map<DeliveryProductProtocol, number>())
}

function formatSuppliers(protocol: DeliveryProductProtocol): string {
  return (protocol.SupplyInvoices || []).reduce<string[]>((suppliers, invoice) => {
    const supplierName = invoice.SupplyOrder?.Client?.FullName || invoice.SupplyOrder?.Client?.Name || ''

    if (supplierName) {
      suppliers.push(supplierName)
    }

    return suppliers
  }, []).join(', ')
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
