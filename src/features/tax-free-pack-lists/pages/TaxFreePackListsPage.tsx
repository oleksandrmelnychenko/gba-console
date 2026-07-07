import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { CircleAlert, Download, PackageMinus, RotateCcw, SquarePen, Trash2 } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate, SYNC_DATA_RANGE_START } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE, PAGINATOR_PAGE_SIZE_OPTIONS } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  deleteTaxFreePackList,
  exportTaxFreePackLists,
  getTaxFreePackLists,
} from '../api/taxFreePackListsApi'
import { CreateSupplyOrderModal } from '../components/CreateSupplyOrderModal'
import { hasTaxFreePrintDocumentUrl, TaxFreePrintDocumentModal } from '../components/TaxFreePrintDocumentModal'
import type { TaxFreePackList, TaxFreePrintDocument } from '../types'
import {
  displayValue,
  formatDateTime,
  getEntityName,
  getPackListAgreementName,
} from '../utils'
import './taxFreePackLists.css'

const PAGE_SIZE_OPTIONS = PAGINATOR_PAGE_SIZE_OPTIONS
const DEFAULT_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE
const PAGE_SIZE_STORAGE_KEY = 'gba-data-table:tax-free-pack-lists:page-size'
const FILTER_STORAGE_KEY = 'taxFreePackListFilters:v2'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['actions', 'fromDate', 'number'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const PACK_LIST_TABLE_CELL_STYLE = {
  display: 'block',
  lineHeight: '18px',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

const EXPORT_COLUMNS = [
  { Number: 1, TableName: 'TaxFreePackList.FromDate', ColumnName: 'FromDate', Translate: 'Від якої дати' },
  { Number: 2, TableName: 'TaxFreePackList.Number', ColumnName: 'Number', Translate: 'Номер' },
  { Number: 3, TableName: 'TaxFreePackList.Organization', ColumnName: 'Name', Translate: 'Організація' },
  { Number: 4, TableName: 'TaxFreePackList.Client', ColumnName: 'FullName', Translate: 'Клієнт' },
  { Number: 5, TableName: 'TaxFreePackList.ClientAgreement.Agreement', ColumnName: 'Name', Translate: 'Договір' },
  { Number: 6, TableName: 'TaxFreePackList', ColumnName: 'TaxFreeCount', Translate: 'К-сть Tax free' },
  { Number: 7, TableName: 'TaxFreePackList', ColumnName: 'Status', Translate: 'Статус' },
  { Number: 8, TableName: 'TaxFreePackList.Responsible', ColumnName: 'LastName', Translate: 'Відповідальний' },
  { Number: 9, TableName: 'TaxFreePackList', ColumnName: 'Comment', Translate: 'Коментар' },
]

type PackListFilters = {
  from: string
  to: string
}

type ListState = {
  error: string | null
  filters: PackListFilters
  isLoading: boolean
  page: number
  pageSize: number
  packLists: TaxFreePackList[]
  reloadKey: number
  totalQty?: number
}

type ListAction =
  | { type: 'filterChanged'; field: keyof PackListFilters; value: string }
  | { type: 'filtersReset'; filters: PackListFilters }
  | { type: 'pageChanged'; page: number }
  | { type: 'pageSizeChanged'; pageSize: number }
  | { type: 'reloadRequested' }
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; packLists: TaxFreePackList[]; totalQty?: number }
  | { type: 'loadFailed'; error: string }
  | { type: 'errorChanged'; error: string | null }

export function TaxFreePackListsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [listState, dispatchList] = useReducer(listReducer, undefined, createInitialListState)
  const [selectedPackList, setSelectedPackList] = useState<TaxFreePackList | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<TaxFreePackList | null>(null)
  const [orderPackList, setOrderPackList] = useState<TaxFreePackList | null>(null)
  const [downloadDocument, setDownloadDocument] = useState<TaxFreePrintDocument | null>(null)
  const [isExporting, setExporting] = useState(false)
  const { error, filters, isLoading, packLists, page, pageSize, reloadKey, totalQty } = listState
  const filterError = filters.from > filters.to ? t('Початкова дата має бути не пізніше кінцевої') : null
  const offset = (page - 1) * pageSize
  const canMoveForward = packLists.length === pageSize
  const totalPages = typeof totalQty === 'number' && totalQty > 0
    ? Math.max(1, Math.ceil(totalQty / pageSize))
    : page + (canMoveForward ? 1 : 0)
  const columns = usePackListColumns({
    onDelete: setDeleteCandidate,
    onOpen: setSelectedPackList,
  })
  useEffect(() => {
    writeStoredFilters(filters)
  }, [filters])

  useEffect(() => {
    if (filterError) {
      return
    }

    let cancelled = false

    async function loadPackLists() {
      dispatchList({ type: 'loadStarted' })

      try {
        const response = await getTaxFreePackLists({
          from: filters.from,
          limit: pageSize,
          offset,
          to: filters.to,
        })

        if (!cancelled) {
          dispatchList({ type: 'loadSucceeded', packLists: response.items, totalQty: response.totalQty })
        }
      } catch (loadError) {
        if (!cancelled) {
          dispatchList({
            type: 'loadFailed',
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити пакувальні листи'),
          })
        }
      }
    }

    loadPackLists()

    return () => {
      cancelled = true
    }
  }, [filters.from, filters.to, filterError, offset, pageSize, reloadKey, t])

  function resetFilters() {
    dispatchList({ type: 'filtersReset', filters: getDefaultFilters() })
  }

  async function confirmDelete() {
    if (!deleteCandidate?.NetUid) {
      return
    }

    try {
      await deleteTaxFreePackList(deleteCandidate.NetUid)
      notifications.show({ color: 'green', message: t('Пакувальний лист видалено') })
      setDeleteCandidate(null)
      dispatchList({ type: 'reloadRequested' })
    } catch (deleteError) {
      notifications.show({
        color: 'red',
        message: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити пакувальний лист'),
      })
    }
  }

  async function exportPackLists() {
    if (filterError) {
      dispatchList({ type: 'errorChanged', error: filterError })
      return
    }

    setExporting(true)
    dispatchList({ type: 'errorChanged', error: null })

    try {
      const document = await exportTaxFreePackLists({
        columns: EXPORT_COLUMNS,
        from: filters.from,
        to: filters.to,
      })

      if (!hasTaxFreePrintDocumentUrl(document)) {
        notifications.show({ color: 'yellow', message: t('Документ не містить посилання для відкриття') })
        return
      }

      setDownloadDocument(document)
    } catch (exportError) {
      dispatchList({
        type: 'errorChanged',
        error: exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'),
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Stack className="tax-free-pack-lists-page" gap={6}>
      <Card className="app-data-card tax-free-pack-lists-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar tax-free-pack-lists-filter-bar">
          <Group align="end" gap="sm" wrap="nowrap" className="tax-free-pack-lists-filter-row">
            <TextInput
              label={t('Від')}
              type="date"
              value={filters.from}
              w={150}
              onChange={(event) => {
                dispatchList({ type: 'filterChanged', field: 'from', value: event.currentTarget.value })
              }}
            />
            <TextInput
              label={t('До')}
              type="date"
              value={filters.to}
              w={150}
              onChange={(event) => {
                dispatchList({ type: 'filterChanged', field: 'to', value: event.currentTarget.value })
              }}
            />
            <div className="app-filter-actions" style={{ marginLeft: 'auto' }}>
              <Tooltip label={t('Скинути')}>
                <ActionIcon
                  variant="light"
                  color="gray"
                  size={34}
                  aria-label={t('Скинути')}
                  onClick={resetFilters}
                >
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Завантажити')}>
                <ActionIcon
                  variant="default"
                  size={34}
                  aria-label={t('Завантажити')}
                  loading={isExporting}
                  onClick={exportPackLists}
                >
                  <Download size={18} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                isLoading={isLoading}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                onPageChange={(nextPage) => dispatchList({ type: 'pageChanged', page: nextPage })}
                onPageSizeChange={(nextPageSize) => {
                  writeStoredPageSize(nextPageSize)
                  dispatchList({ type: 'pageSizeChanged', pageSize: nextPageSize })
                }}
                onRefresh={() => dispatchList({ type: 'reloadRequested' })}
              />
            </div>
          </Group>
        </div>

        {(error || filterError) && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {filterError || error}
          </Alert>
        )}

        <div className="tax-free-pack-lists-page__table">
          <DataTable
            columns={columns}
            data={filterError ? [] : packLists}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Пакувальних листів не знайдено')}
            getRowId={(packList, index) => packList.NetUid || String(packList.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="tax-free-pack-lists-table-2"
            loadingText={t('Завантаження пакувальних листів')}
            minWidth={1290}
            showLayoutControls={false}
            showDensityToggle={false}
            tableId="tax-free-pack-lists"
            onRowClick={setSelectedPackList}
          />
        </div>
      </Card>

      <AppModal centered opened={Boolean(selectedPackList)} title={t('Оберіть дію')} onClose={() => setSelectedPackList(null)}>
        {selectedPackList && (
          <Stack gap="xs">
            <Button
              justify="flex-start"
              leftSection={<SquarePen size={16} />}
              variant="subtle"
              onClick={() => navigate(`/tax-free/pack-list/edit/${selectedPackList.NetUid}`)}
            >
              {t('Переглянути')}
            </Button>
            <Button
              disabled={!selectedPackList.IsSent || Boolean(selectedPackList.SupplyOrderUkraineId)}
              justify="flex-start"
              leftSection={<PackageMinus size={16} />}
              variant="subtle"
              onClick={() => {
                setOrderPackList(selectedPackList)
                setSelectedPackList(null)
              }}
            >
              {t('Створити замовлення в Україну')}
            </Button>
            {(!selectedPackList.IsSent || selectedPackList.SupplyOrderUkraineId) && (
              <Text size="xs" c="dimmed">
                {selectedPackList.IsSent
                  ? t('Замовлення вже створено для цього листа')
                  : t('Створення замовлення доступне тільки для проведених листів')}
              </Text>
            )}
          </Stack>
        )}
      </AppModal>

      <AppModal centered opened={Boolean(deleteCandidate)} title={t('Підтвердити видалення')} onClose={() => setDeleteCandidate(null)}>
        <Stack>
          <Text size="sm">{t('Видалити пакувальний лист')} {deleteCandidate?.Number || ''}?</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteCandidate(null)}>{t('Скасувати')}</Button>
            <Button color="red" onClick={confirmDelete}>{t('Видалити')}</Button>
          </Group>
        </Stack>
      </AppModal>

      <CreateSupplyOrderModal
        opened={Boolean(orderPackList)}
        packList={orderPackList}
        onClose={() => setOrderPackList(null)}
        onCreated={(netUid) => {
          if (netUid) {
            navigate(`/orders/ukraine/view/${netUid}`)
          }
        }}
      />

      <TaxFreePrintDocumentModal
        document={downloadDocument}
        title={t('Пакувальні листи Tax Free')}
        onClose={() => setDownloadDocument(null)}
      />
    </Stack>
  )
}

function createInitialListState(): ListState {
  const filters = readStoredFilters()

  return {
    error: null,
    filters,
    isLoading: false,
    page: 1,
    pageSize: readStoredPageSize(),
    packLists: [],
    reloadKey: 0,
    totalQty: undefined,
  }
}

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'filterChanged':
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.field]: action.value,
        },
        page: 1,
      }
    case 'filtersReset':
      return {
        ...state,
        filters: action.filters,
        page: 1,
      }
    case 'pageChanged':
      return {
        ...state,
        page: action.page,
      }
    case 'pageSizeChanged':
      return {
        ...state,
        page: 1,
        pageSize: action.pageSize,
      }
    case 'reloadRequested':
      return {
        ...state,
        reloadKey: state.reloadKey + 1,
      }
    case 'loadStarted':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    case 'loadSucceeded':
      return {
        ...state,
        isLoading: false,
        packLists: action.packLists,
        totalQty: action.totalQty,
      }
    case 'loadFailed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
        packLists: [],
        totalQty: undefined,
      }
    case 'errorChanged':
      return {
        ...state,
        error: action.error,
      }
  }
}

function usePackListColumns({
  onDelete,
  onOpen,
}: {
  onDelete: (packList: TaxFreePackList) => void
  onOpen: (packList: TaxFreePackList) => void
}) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<TaxFreePackList>[]>(
    () => [
      {
        id: 'actions',
        header: '',
        width: 86,
        enableSorting: false,
        cell: (packList) => (
          <Group gap={4} wrap="nowrap">
            <Tooltip label={t('Переглянути')}>
              <ActionIcon
                aria-label={t('Переглянути')}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen(packList)
                }}
              >
                <SquarePen size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={packList.IsSent ? t('Проведений лист не можна видалити') : t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={packList.IsSent}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(packList)
                }}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
      {
        id: 'fromDate',
        header: t('Дата'),
        width: 150,
        accessor: (packList) => packList.FromDate,
        cell: (packList) => <PackListTableValue fw={600} value={formatDateTime(packList.FromDate)} />,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        accessor: (packList) => packList.Number,
        cell: (packList) => <PackListTableValue fw={600} value={displayValue(packList.Number)} />,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 160,
        accessor: (packList) => getEntityName(packList.Organization),
        cell: (packList) => <PackListTableValue value={displayValue(getEntityName(packList.Organization))} />,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        width: 250,
        accessor: (packList) => getEntityName(packList.Client),
        cell: (packList) => <PackListTableValue value={displayValue(getEntityName(packList.Client))} />,
      },
      {
        id: 'agreement',
        header: t('Договір'),
        width: 170,
        accessor: getPackListAgreementName,
        cell: (packList) => <PackListTableValue value={displayValue(getPackListAgreementName(packList))} />,
      },
      {
        id: 'taxFreeCount',
        header: t('К-сть Tax Free'),
        width: 120,
        align: 'right',
        accessor: (packList) => packList.TaxFreesCount ?? packList.TaxFrees?.length,
        cell: (packList) => <PackListTableValue value={displayValue(packList.TaxFreesCount ?? packList.TaxFrees?.length ?? 0)} />,
      },
      {
        id: 'status',
        header: t('Статус'),
        width: 130,
        accessor: (packList) => packList.IsSent,
        cell: (packList) => (
          <Badge color={packList.IsSent ? 'green' : 'gray'} variant="light">
            {packList.IsSent ? t('Проведено') : t('Не проведено')}
          </Badge>
        ),
      },
      {
        id: 'order',
        header: t('Замовлення'),
        width: 120,
        accessor: (packList) => Boolean(packList.SupplyOrderUkraineId),
        cell: (packList) => (
          <Badge color={packList.SupplyOrderUkraineId ? 'green' : 'gray'} variant="dot">
            {packList.SupplyOrderUkraineId ? t('Створено') : t('Немає')}
          </Badge>
        ),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 170,
        accessor: (packList) => getEntityName(packList.Responsible),
        cell: (packList) => <PackListTableValue value={displayValue(getEntityName(packList.Responsible))} />,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 250,
        accessor: (packList) => packList.Comment,
        cell: (packList) => <PackListTableValue value={displayValue(packList.Comment)} />,
      },
    ],
    [onDelete, onOpen, t],
  )
}

function PackListTableValue({ fw, value }: { fw?: number; value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <Text component="span" fw={fw} style={PACK_LIST_TABLE_CELL_STYLE}>
        {value}
      </Text>
    </Tooltip>
  )
}

function getDefaultFilters() {
  const to = new Date()

  return {
    from: SYNC_DATA_RANGE_START,
    to: formatLocalDate(to),
  }
}

function readStoredFilters() {
  try {
    const storedFilters = localStorage.getItem(FILTER_STORAGE_KEY)

    if (!storedFilters) {
      return getDefaultFilters()
    }

    return {
      ...getDefaultFilters(),
      ...JSON.parse(storedFilters) as ReturnType<typeof getDefaultFilters>,
    }
  } catch {
    return getDefaultFilters()
  }
}

function writeStoredFilters(filters: ReturnType<typeof getDefaultFilters>) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    // Ignore unavailable storage; filters still work for the current session.
  }
}

function readStoredPageSize() {
  if (typeof window === 'undefined') {
    return DEFAULT_PAGE_SIZE
  }

  return normalizePageSize(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY))
}

function writeStoredPageSize(pageSize: number) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize))
}

function normalizePageSize(value?: string | null) {
  return PAGE_SIZE_OPTIONS.includes(value ?? '') ? Number(value) : DEFAULT_PAGE_SIZE
}
