import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { ChevronDown, ChevronRight, CircleAlert, Download, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CheckboxMultiSelect } from '../../../shared/ui/CheckboxMultiSelect'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  CLIENT_SEARCH_PAGE_SIZE,
  exportClientProductMovementDocument,
  getClientProductMovementOrganizations,
  getClientProductMovements,
  searchClientProductMovementClients,
} from '../api/clientProductMovementApi'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { DownloadDocumentModal } from '../components/DownloadDocumentModal'
import type {
  ClientProductMovementClientOption,
  ClientProductMovementDocument,
  ClientProductMovementDocumentResult,
  ClientProductMovementFilters,
  ClientProductMovementInfoItem,
  ClientProductMovementOrganizationOption,
} from '../types'
import './client-product-movement-page.css'

type FilterDraft = {
  article: string
  clientNetId: string
  from: string
  organizationIds: string[]
  to: string
}

const MOVEMENT_ROW = {
  DETAIL: 'detail',
  DOCUMENT: 'document',
} as const

type MovementRowKind = (typeof MOVEMENT_ROW)[keyof typeof MOVEMENT_ROW]

type MovementRow = {
  id: string
  kind: MovementRowKind
  document: ClientProductMovementDocument
}

type SelectOption = {
  label: string
  value: string
}

const MOVEMENT_TABLE_DEFAULT_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

const MOVEMENT_ITEMS_TABLE_DEFAULT_LAYOUT = {
  density: 'compact',
} satisfies DataTableDefaultLayout

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function ClientProductMovementPage() {
  const { t } = useI18n()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  const initialDraft = useMemo<FilterDraft>(
    () => ({
      article: '',
      clientNetId: '',
      from: today,
      organizationIds: [],
      to: today,
    }),
    [today],
  )

  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialDraft)
  const [activeDraft, setActiveDraft] = useValueState<FilterDraft>(initialDraft)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [documents, setDocuments] = useValueState<ClientProductMovementDocument[]>([])
  const [organizations, setOrganizations] = useValueState<ClientProductMovementOrganizationOption[]>([])
  const [clientQuery, setClientQuery] = useValueState('')
  const [clientOptions, setClientOptions] = useValueState<ClientProductMovementClientOption[]>([])
  const [clientOffset, setClientOffset] = useValueState(0)
  const [clientHasMore, setClientHasMore] = useValueState(false)
  const [expandedKeys, setExpandedKeys] = useValueState<Set<string>>(() => new Set())
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isExporting, setExporting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<ClientProductMovementDocumentResult | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  const [debouncedArticle] = useDebouncedValue(filterDraft.article, 400)

  const offset = (page - 1) * pageSize
  const totalRows = getTotalRows(documents)
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const hasClient = Boolean(activeDraft.clientNetId)

  const activeFilters = useMemo<ClientProductMovementFilters>(
    () => ({
      article: activeDraft.article,
      clientNetId: activeDraft.clientNetId,
      from: activeDraft.from,
      limit: pageSize,
      offset,
      organizationId: activeDraft.organizationIds,
      to: activeDraft.to,
    }),
    [activeDraft, offset, pageSize],
  )

  useEffect(() => {
    let cancelled = false

    async function loadOrganizations() {
      try {
        const next = await getClientProductMovementOrganizations()

        if (!cancelled) {
          setOrganizations(next)
          setFilterDraft((current) => applyDefaultOrganizations(current, next))
          setActiveDraft((current) => applyDefaultOrganizations(current, next))
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
  }, [setActiveDraft, setFilterDraft, setOrganizations])

  useEffect(() => {
    const query = clientQuery.trim()

    let cancelled = false
    const controller = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const next = await searchClientProductMovementClients(query, clientOffset, controller.signal)

        if (!cancelled) {
          setClientOptions((current) =>
            clientOffset === 0 ? next : mergeClientOptions(current, next),
          )
          setClientHasMore(next.length >= CLIENT_SEARCH_PAGE_SIZE)
        }
      } catch {
        if (!cancelled) {
          if (clientOffset === 0) {
            setClientOptions([])
          }

          setClientHasMore(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(handle)
    }
  }, [clientOffset, clientQuery, setClientHasMore, setClientOptions])

  useEffect(() => {
    setClientOffset(0)
  }, [clientQuery, setClientOffset])

  useEffect(() => {
    if (!activeFilters.clientNetId) {
      setDocuments([])
      setExpandedKeys(new Set())

      return
    }

    let cancelled = false

    async function loadDocuments() {
      setLoading(true)
      setError(null)

      try {
        const next = await getClientProductMovements(activeFilters)

        if (!cancelled) {
          setDocuments(next)
          setExpandedKeys(new Set())
        }
      } catch (loadError) {
        if (!cancelled) {
          setDocuments([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рух товару'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDocuments()

    return () => {
      cancelled = true
    }
  }, [activeFilters, reloadKey, setDocuments, setError, setExpandedKeys, setLoading, t])

  useEffect(() => {
    if (debouncedArticle !== filterDraft.article) {
      return
    }

    const nextArticle = debouncedArticle.trim()

    if (nextArticle === activeDraft.article) {
      return
    }

    setPage(1)
    setActiveDraft((current) => ({ ...current, article: nextArticle }))
  }, [activeDraft.article, debouncedArticle, filterDraft.article, setActiveDraft, setPage])

  function applyFilters(nextDraft: FilterDraft) {
    setPage(1)
    setFilterDraft(nextDraft)
    setActiveDraft({ ...nextDraft, article: nextDraft.article.trim() })
  }

  function resetFilters() {
    const nextDraft = applyDefaultOrganizations(initialDraft, organizations)

    setPage(1)
    setFilterDraft(nextDraft)
    setActiveDraft(nextDraft)
    setClientQuery('')
    setClientOffset(0)
  }

  function loadMoreClients() {
    if (!clientHasMore) {
      return
    }

    setClientOffset((current) => current + CLIENT_SEARCH_PAGE_SIZE)
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  async function exportDocument() {
    if (!activeFilters.clientNetId) {
      return
    }

    setExporting(true)

    try {
      const result = await exportClientProductMovementDocument(activeFilters)

      setDownloadDocument(result)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
    }
  }

  const organizationOptions = useMemo(
    () => toOrganizationSelectOptions(organizations),
    [organizations],
  )

  const clientSelectData = useMemo(
    () => toClientSelectOptions(clientOptions),
    [clientOptions],
  )

  const rows = useMemo(() => buildRows(documents, expandedKeys), [documents, expandedKeys])

  const columns = useColumns({ expandedKeys, onToggle: toggleExpanded })

  const toolbarLeft = useMemo(
    () => (hasClient ? null : (
      <Text size="xs" c="dimmed">
        {t('Оберіть клієнта')}
      </Text>
    )),
    [hasClient, t],
  )

  return (
    <Stack className="client-product-movement-page" gap={6}>
      <Card className="app-data-card client-product-movement-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar client-product-movement-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="client-product-movement-filter-row">
            <div className="app-filter-date-range">
              <TextInput
                label={t('Від')}
                max={filterDraft.to || undefined}
                type="date"
                value={filterDraft.from}
                onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
              />
              <TextInput
                label={t('До')}
                min={filterDraft.from || undefined}
                type="date"
                value={filterDraft.to}
                onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
              />
            </div>
            <Select
              clearable
              searchable
              data={clientSelectData}
              label={t('Клієнт')}
              nothingFoundMessage={t('Нічого не знайдено')}
              placeholder={t('Пошук клієнта')}
              scrollAreaProps={{ onBottomReached: loadMoreClients }}
              searchValue={clientQuery}
              value={filterDraft.clientNetId || null}
              w={260}
              onChange={(value) => applyFilters({ ...filterDraft, clientNetId: value || '' })}
              onSearchChange={setClientQuery}
            />
            <CheckboxMultiSelect
              data={organizationOptions}
              label={t('Організація')}
              placeholder={t('Усі')}
              value={filterDraft.organizationIds}
              w={240}
              onChange={(value) => applyFilters({ ...filterDraft, organizationIds: value })}
            />
            <TextInput
              label={t('Артикул')}
              value={filterDraft.article}
              w={180}
              onChange={(event) => setFilterDraft({ ...filterDraft, article: event.currentTarget.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applyFilters({ ...filterDraft, article: event.currentTarget.value })
                }
              }}
            />
            <div className="app-filter-actions client-product-movement-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon
                  aria-label={t('Скинути')}
                  color="gray"
                  size={34}
                  variant="light"
                  onClick={resetFilters}
                >
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              {hasClient && (
                <Tooltip label={t('Експорт')}>
                  <ActionIcon
                    aria-label={t('Експорт')}
                    color="gray"
                    loading={isExporting}
                    size={34}
                    variant="light"
                    onClick={exportDocument}
                  >
                    <Download size={18} />
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
                onRefresh={reload}
              />
            </div>
            <div
              ref={setTableToolbarSlot}
              className="app-filter-table-toolbar-slot client-product-movement-table-toolbar-slot"
            />
          </Group>
        </div>

        {error && (
          <Alert
            className="client-product-movement-page__alert"
            color="red"
            icon={<CircleAlert size={18} />}
            variant="light"
          >
            {error}
          </Alert>
        )}

        <div className="client-product-movement-page__table">
          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={MOVEMENT_TABLE_DEFAULT_LAYOUT}
            distributeAvailableWidth
            emptyText={hasClient ? t('Документів не знайдено') : t('Оберіть клієнта для перегляду')}
            getRowId={(row) => row.id}
            height="100%"
            isLoading={isLoading}
            layoutVersion="client-product-movement-table-2"
            loadingText={t('Завантаження руху товару')}
            minWidth={1280}
            rowClassName={(row) => (row.kind === MOVEMENT_ROW.DETAIL ? 'gba-movement-detail-row' : undefined)}
            showLayoutControls
            tableId="client-product-movement"
            toolbarLeft={toolbarLeft}
            toolbarPortalTarget={tableToolbarSlot}
          />
        </div>
      </Card>

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        title={t('Експорт руху товару')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

function useColumns({
  expandedKeys,
  onToggle,
}: {
  expandedKeys: Set<string>
  onToggle: (key: string) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<MovementRow>[]>(
    () => [
      {
        id: 'type',
        header: t('Тип'),
        width: 320,
        minWidth: 220,
        enableSorting: false,
        accessor: (row) => row.document.DocumentTypeName,
        cell: (row) => {
          if (row.kind === MOVEMENT_ROW.DETAIL) {
            return <MovementInfoItemsTable document={row.document} />
          }

          const documentKey = row.id
          const isExpanded = expandedKeys.has(documentKey)
          const hasItems = (row.document.InfoItems?.length || 0) > 0

          return (
            <Group gap={6} wrap="nowrap">
              <ActionIcon
                aria-label={isExpanded ? t('Згорнути') : t('Розгорнути')}
                color="gray"
                disabled={!hasItems}
                size="sm"
                variant="subtle"
                onClick={() => onToggle(documentKey)}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </ActionIcon>
              <MovementEntityCell value={displayValue(row.document.DocumentTypeName)} />
            </Group>
          )
        },
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        enableSorting: false,
        accessor: (row) => row.document.DocumentNumber,
        cell: (row) => (row.kind === MOVEMENT_ROW.DETAIL ? null : <MovementMonoCell value={displayValue(row.document.DocumentNumber)} />),
      },
      {
        id: 'fromDate',
        header: t('Дата'),
        width: 160,
        minWidth: 130,
        enableSorting: false,
        accessor: (row) => row.document.DocumentFromDate,
        cell: (row) => (row.kind === MOVEMENT_ROW.DETAIL ? null : <MovementMonoCell value={displayValue(formatDateTime(row.document.DocumentFromDate))} />),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 200,
        minWidth: 150,
        enableSorting: false,
        accessor: (row) => row.document.OrganizationName,
        cell: (row) => (row.kind === MOVEMENT_ROW.DETAIL ? null : displayValue(row.document.OrganizationName)),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 180,
        minWidth: 140,
        enableSorting: false,
        accessor: (row) => row.document.Responsible,
        cell: (row) => (row.kind === MOVEMENT_ROW.DETAIL ? null : displayValue(row.document.Responsible)),
      },
      {
        id: 'updatedDate',
        header: t('Оновлено'),
        width: 160,
        minWidth: 130,
        enableSorting: false,
        accessor: (row) => row.document.DocumentUpdatedDate,
        cell: (row) => (row.kind === MOVEMENT_ROW.DETAIL ? null : <MovementMonoCell value={displayValue(formatDateTime(row.document.DocumentUpdatedDate))} />),
      },
      {
        id: 'amount',
        header: t('Сума EUR'),
        width: 140,
        minWidth: 120,
        align: 'right',
        enableSorting: false,
        accessor: (row) => getNumber(row.document.TotalEuroAmount),
        cell: (row) => (row.kind === MOVEMENT_ROW.DETAIL ? null : <MovementMoneyCell value={formatAmount(getNumber(row.document.TotalEuroAmount))} />),
      },
      {
        id: 'positions',
        header: t('Позиції'),
        width: 110,
        minWidth: 90,
        align: 'right',
        enableSorting: false,
        accessor: (row) => getNumber(row.document.TotalPositions),
        cell: (row) => (row.kind === MOVEMENT_ROW.DETAIL ? null : <MovementNumberCell value={displayValue(getNumber(row.document.TotalPositions))} />),
      },
    ],
    [expandedKeys, onToggle, t],
  )
}

function MovementInfoItemsTable({ document }: { document: ClientProductMovementDocument }) {
  const { t } = useI18n()
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const items = Array.isArray(document.InfoItems) ? document.InfoItems : []
  const itemColumns = useMemo<DataTableColumn<ClientProductMovementInfoItem>[]>(
    () => [
      {
        id: 'vendorCode',
        header: t('Код Виробника'),
        width: 320,
        minWidth: 220,
        accessor: (item) => item.Product?.VendorCode,
        cell: (item) => {
          const netId = item.Product?.NetUid
          const code = displayValue(item.Product?.VendorCode)
          const name = displayValue(item.Product?.Name)

          return (
            <Stack align="flex-start" gap={0}>
              {netId ? (
                <Anchor
                  className="client-product-movement-product-code"
                  component="button"
                  title={code}
                  type="button"
                  underline="always"
                  onClick={(event) => {
                    event.stopPropagation()
                    setProductCardNetId(netId)
                  }}
                >
                  {code}
                </Anchor>
              ) : (
                <MovementMonoCell value={code} />
              )}
              {netId ? (
                <Anchor
                  className="client-product-movement-product-name"
                  component="button"
                  title={name}
                  type="button"
                  underline="always"
                  onClick={(event) => {
                    event.stopPropagation()
                    setProductCardNetId(netId)
                  }}
                >
                  {name}
                </Anchor>
              ) : (
                <Text className="client-product-movement-product-name" title={name}>
                  {name}
                </Text>
              )}
            </Stack>
          )
        },
      },
      {
        id: 'specificationCode',
        header: t('Митний код'),
        width: 200,
        minWidth: 140,
        accessor: (item) => item.ProductSpecificationCode,
        cell: (item) => <MovementMonoCell value={displayValue(item.ProductSpecificationCode)} />,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 200,
        minWidth: 140,
        accessor: (item) => item.Responsible,
        cell: (item) => displayValue(item.Responsible),
      },
      {
        id: 'amount',
        header: t('Сума EUR'),
        width: 140,
        minWidth: 110,
        align: 'right',
        accessor: (item) => getNumber(item.TotalAmount),
        cell: (item) => <MovementMoneyCell value={formatAmount(getNumber(item.TotalAmount))} />,
      },
      {
        id: 'qty',
        header: t('штук'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (item) => getNumber(item.ItemQty),
        cell: (item) => <MovementNumberCell value={displayValue(getNumber(item.ItemQty))} />,
      },
    ],
    [t],
  )

  return (
    <Box className="client-product-movement-detail-table" py="xs">
      <DataTable
        columns={itemColumns}
        data={items}
        defaultLayout={MOVEMENT_ITEMS_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Позицій не знайдено')}
        getRowId={(item, index) => `${item.Product?.VendorCode || ''}-${item.ProductSpecificationCode || ''}-${index}`}
        layoutVersion="client-product-movement-items-table-1"
        maxHeight="40vh"
        minWidth={960}
        tableId={`client-product-movement-items-${document.DocumentId ?? document.DocumentNumber ?? 'doc'}`}
      />
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Box>
  )
}

function MovementEntityCell({ value }: { value: string }) {
  return (
    <Text className="client-product-movement-entity-cell" title={value}>
      {value}
    </Text>
  )
}

function MovementMonoCell({ value }: { value: string }) {
  return (
    <Text className="client-product-movement-mono-cell" title={value}>
      {value}
    </Text>
  )
}

function MovementNumberCell({ value }: { value: string }) {
  return (
    <Text className="client-product-movement-number-cell" title={value}>
      {value}
    </Text>
  )
}

function MovementMoneyCell({ value }: { value: string }) {
  return value ? (
    <span className="app-money client-product-movement-money-cell" title={value}>
      {value}
    </span>
  ) : null
}

function buildRows(documents: ClientProductMovementDocument[], expandedKeys: Set<string>): MovementRow[] {
  const rows: MovementRow[] = []

  documents.forEach((document, index) => {
    const key = getDocumentKey(document, index)

    rows.push({ document, id: key, kind: MOVEMENT_ROW.DOCUMENT })

    if (expandedKeys.has(key) && (document.InfoItems?.length || 0) > 0) {
      rows.push({ document, id: `${key}-detail`, kind: MOVEMENT_ROW.DETAIL })
    }
  })

  return rows
}

function getDocumentKey(document: ClientProductMovementDocument, index: number): string {
  return String(document.DocumentId ?? `${document.DocumentNumber ?? ''}-${index}`)
}

function applyDefaultOrganizations(
  draft: FilterDraft,
  organizations: ClientProductMovementOrganizationOption[],
): FilterDraft {
  if (draft.organizationIds.length > 0) {
    return draft
  }

  const ids = getOrganizationIds(organizations)

  if (ids.length === 0) {
    return draft
  }

  return { ...draft, organizationIds: ids }
}

function toOrganizationSelectOptions(organizations: ClientProductMovementOrganizationOption[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const organization of organizations) {
    if (typeof organization.Id === 'number' && organization.Name) {
      options.push({ label: organization.Name || '', value: String(organization.Id) })
    }
  }

  return options
}

function mergeClientOptions(
  current: ClientProductMovementClientOption[],
  next: ClientProductMovementClientOption[],
): ClientProductMovementClientOption[] {
  const seen = new Set(current.map(getClientOptionKey))
  const merged = [...current]

  for (const client of next) {
    const key = getClientOptionKey(client)

    if (!seen.has(key)) {
      seen.add(key)
      merged.push(client)
    }
  }

  return merged
}

function getClientOptionKey(client: ClientProductMovementClientOption): string {
  return String(client.NetUid ?? client.Id ?? '')
}

function toClientSelectOptions(clients: ClientProductMovementClientOption[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const client of clients) {
    const option = {
      label: getClientOptionLabel(client),
      value: String(client.NetUid ?? client.Id ?? ''),
    }

    if (option.value) {
      options.push(option)
    }
  }

  return options
}

function getOrganizationIds(organizations: ClientProductMovementOrganizationOption[]): string[] {
  const ids: string[] = []

  for (const organization of organizations) {
    if (typeof organization.Id === 'number') {
      ids.push(String(organization.Id))
    }
  }

  return ids
}

function getClientOptionLabel(client: ClientProductMovementClientOption): string {
  return (
    client.FullName?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || client.Name?.trim()
    || ''
  )
}

function getTotalRows(documents: ClientProductMovementDocument[]): number {
  return getNumber(documents[0]?.TotalRowsQty) || documents.length
}

const movementDateFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : movementDateFormatter.format(date).replace(',', '')
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : displayValue(value)
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
    return value.trim()
  }

  return ''
}
