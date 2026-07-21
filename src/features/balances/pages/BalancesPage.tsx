import {
  ActionIcon,
  Alert,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { formatDateInputForQuery, formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getSyncDocuments } from '../api/balancesApi'
import { ContractorType, type ContractorTypeValue, type SyncDocument } from '../types'
import '../../../shared/ui/console-table-page.css'
import './balances-page.css'

type FilterDraft = {
  from: string
  name: string
  to: string
  type: ContractorTypeValue
}

const DEFAULT_PAGE_SIZE = 20

const BALANCES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['date', 'number'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

function getInitialFilters(): FilterDraft {
  const today = formatLocalDate(new Date())

  return {
    from: today,
    name: '',
    to: today,
    type: ContractorType.None,
  }
}

function useBalancesPageModel() {
  const { t } = useI18n()
  const initialFilters = useMemo(() => getInitialFilters(), [])
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [documents, setDocuments] = useValueState<SyncDocument[]>([])
  const [totalQty, setTotalQty] = useValueState(0)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useValueState(1)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const columns = useBalancesColumns()
  const totalPages = Math.max(1, Math.ceil(totalQty / pageSize))

  const resetDocuments = useCallback(() => {
    setDocuments([])
    setTotalQty(0)
    setLoading(false)
  }, [setDocuments, setLoading, setTotalQty])

  useBalancesLoader({
    activeFilters,
    filterError,
    page,
    pageSize,
    reloadKey,
    resetDocuments,
    setDocuments,
    setError,
    setLoading,
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

  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Всього')} {totalQty}
      </Text>
    ),
    [t, totalQty],
  )

  return {
    applyFilters, columns, documents, error, filterDraft, filterError, isLoading,
    page, pageSize, reload, resetFilters, setPage, setPageSize, toolbarLeft, totalPages,
  }
}

function useBalancesLoader({
  activeFilters,
  filterError,
  page,
  pageSize,
  reloadKey,
  resetDocuments,
  setDocuments,
  setError,
  setLoading,
  setTotalQty,
}: {
  activeFilters: FilterDraft
  filterError: string | null
  page: number
  pageSize: number
  reloadKey: number
  resetDocuments: () => void
  setDocuments: (value: SyncDocument[]) => void
  setError: (value: string | null) => void
  setLoading: (value: boolean) => void
  setTotalQty: (value: number) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (filterError) {
      resetDocuments()
      return
    }

    let cancelled = false

    async function loadDocuments() {
      setLoading(true)
      setError(null)

      try {
        const result = await getSyncDocuments({
          from: toIsoString(activeFilters.from),
          limit: pageSize,
          name: activeFilters.name,
          offset: (page - 1) * pageSize,
          to: toIsoString(activeFilters.to),
          type: activeFilters.type,
        })

        if (!cancelled) {
          setDocuments(result.items)
          setTotalQty(result.totalQty)
        }
      } catch (loadError) {
        if (!cancelled) {
          setDocuments([])
          setTotalQty(0)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
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
  }, [
    activeFilters,
    filterError,
    page,
    pageSize,
    reloadKey,
    resetDocuments,
    setDocuments,
    setError,
    setLoading,
    setTotalQty,
    t,
  ])
}

export function BalancesPage() {
  const model = useBalancesPageModel()

  return (
    <Stack className="balances-page console-table-page" gap={6}>
      <BalancesTableCard model={model} />
    </Stack>
  )
}

function BalancesTableCard({ model }: { model: ReturnType<typeof useBalancesPageModel> }) {
  const { t } = useI18n()
  const {
    applyFilters, columns, documents, error, filterDraft, filterError, isLoading,
    page, pageSize, reload, resetFilters, setPage, setPageSize, toolbarLeft, totalPages,
  } = model
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  const typeOptions = useMemo(
    () => [
      { label: t('Клієнт'), value: String(ContractorType.Client) },
      { label: t('Постачальник'), value: String(ContractorType.Supplier) },
      { label: t('Постачальник послуг'), value: String(ContractorType.SupplyOrganization) },
      { label: t('Відсутній'), value: String(ContractorType.None) },
    ],
    [t],
  )

  return (
    <div className="balances-card console-table-shell">
      <div className="app-filter-bar balances-filter-bar">
        <Group align="end" gap={10} wrap="nowrap" className="balances-filter-row">
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
          <TextInput
            label={t('Назва')}
            value={filterDraft.name}
            onChange={(event) => applyFilters({ ...filterDraft, name: event.currentTarget.value })}
          />
          <Select
            data={typeOptions}
            label={t('Тип')}
            value={String(filterDraft.type)}
            w={200}
            onChange={(value) =>
              applyFilters({
                ...filterDraft,
                type: value === null ? ContractorType.None : (Number(value) as ContractorTypeValue),
              })
            }
          />
          <div className="app-filter-actions balances-filter-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
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
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        </Group>
      </div>

      {(error || filterError) && (
        <Alert
          className="console-table-alert"
          color={filterError ? 'yellow' : 'red'}
          icon={<CircleAlert size={18} />}
          variant="light"
        >
          {filterError || error}
        </Alert>
      )}

      <div className="balances-page__table console-table-body">
        <DataTable
          columns={columns}
          data={documents}
          defaultLayout={BALANCES_TABLE_DEFAULT_LAYOUT}
          emptyText={t('Відсутній')}
          getRowId={(document, index) => String(document.NetUid || document.Id || index)}
          isLoading={isLoading}
          layoutVersion="balances-table-1"
          loadingText={t('Завантаження')}
          height="100%"
          minWidth={1620}
          showLayoutControls
          tableId="balances"
          toolbarLeft={toolbarLeft}
          toolbarPortalTarget={tableToolbarSlot}
        />
      </div>
    </div>
  )
}

function useBalancesColumns() {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SyncDocument>[]>(
    () => [
      {
        id: 'date',
        header: t('Дата'),
        width: 120,
        minWidth: 100,
        accessor: (document) => getDateTime(document.SynchronizationDate),
        cell: (document) => formatDate(document.SynchronizationDate),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 200,
        minWidth: 140,
        accessor: (document) => document.Number,
        cell: (document) => <Text fw={600}>{displayValue(document.Number)}</Text>,
      },
      {
        id: 'type',
        header: t('Тип'),
        width: 220,
        minWidth: 160,
        accessor: (document) => document.Type,
        cell: (document) => displayValue(document.Type),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 120,
        minWidth: 100,
        accessor: (document) => document.Amount,
        cell: (document) => displayValue(document.Amount),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 80,
        minWidth: 70,
        accessor: (document) => document.Currency?.Name,
        cell: (document) => displayValue(document.Currency?.Name),
      },
      {
        id: 'contractorType',
        header: t('Тип'),
        width: 180,
        minWidth: 140,
        accessor: (document) => getContractorTypeLabel(document.ContractorType, t),
        cell: (document) => displayValue(getContractorTypeLabel(document.ContractorType, t)),
      },
      {
        id: 'counterparty',
        header: t('Контрагент'),
        width: 300,
        minWidth: 200,
        accessor: (document) => getCounterparty(document),
        cell: (document) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(getCounterparty(document))}
          </Text>
        ),
      },
      {
        id: 'agreement',
        header: t('Договір'),
        minWidth: 220,
        accessor: (document) => getAgreement(document),
        cell: (document) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(getAgreement(document))}
          </Text>
        ),
      },
      {
        id: 'organization',
        header: t('Організація'),
        minWidth: 200,
        accessor: (document) => document.Organization?.Name,
        cell: (document) => displayValue(document.Organization?.Name),
      },
    ],
    [t],
  )
}

function getContractorTypeLabel(type: ContractorTypeValue | number | undefined, t: (value: string) => string): string {
  switch (type) {
    case ContractorType.Client:
      return t('Клієнт')
    case ContractorType.Supplier:
      return t('Постачальник')
    case ContractorType.SupplyOrganization:
      return t('Постачальник послуг')
    case ContractorType.None:
      return t('Відсутній')
    default:
      return ''
  }
}

function getCounterparty(document: SyncDocument): string {
  return document.Client?.FullName || document.SupplyOrganization?.Name || ''
}

function getAgreement(document: SyncDocument): string {
  return document.ClientAgreement?.Agreement?.Name || document.SupplyOrganizationAgreement?.Name || ''
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

function toIsoString(value: string): string {
  return formatDateInputForQuery(value)
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}
