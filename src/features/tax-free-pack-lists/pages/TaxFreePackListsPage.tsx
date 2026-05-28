import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Pagination,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconDownload,
  IconEdit,
  IconPackageExport,
  IconRefresh,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  deleteTaxFreePackList,
  exportTaxFreePackLists,
  getTaxFreePackLists,
} from '../api/taxFreePackListsApi'
import { CreateSupplyOrderModal } from '../components/CreateSupplyOrderModal'
import type { TaxFreePackList } from '../types'
import {
  displayValue,
  formatDateTime,
  getEntityName,
  getPackListAgreementName,
  openDocumentUrl,
} from '../utils'
import './taxFreePackLists.css'

const PAGE_SIZE = 20
const FILTER_STORAGE_KEY = 'taxFreePackListFilters'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['actions', 'fromDate', 'number'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

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

type ListState = {
  isLoading: boolean
  packLists: TaxFreePackList[]
}

export function TaxFreePackListsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const restoredFilters = useMemo(() => readStoredFilters(), [])
  const [dateFrom, setDateFrom] = useState(restoredFilters.from)
  const [dateTo, setDateTo] = useState(restoredFilters.to)
  const [page, setPage] = useState(1)
  const [state, setState] = useState<ListState>({ isLoading: false, packLists: [] })
  const [error, setError] = useState<string | null>(null)
  const [selectedPackList, setSelectedPackList] = useState<TaxFreePackList | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<TaxFreePackList | null>(null)
  const [orderPackList, setOrderPackList] = useState<TaxFreePackList | null>(null)
  const [isExporting, setExporting] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = dateFrom > dateTo ? t('Початкова дата має бути не пізніше кінцевої') : null
  const offset = (page - 1) * PAGE_SIZE
  const canMoveForward = state.packLists.length === PAGE_SIZE
  const columns = usePackListColumns({
    onDelete: setDeleteCandidate,
    onOpen: setSelectedPackList,
  })

  useEffect(() => {
    writeStoredFilters({ from: dateFrom, to: dateTo })
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (filterError) {
      return
    }

    let cancelled = false

    async function loadPackLists() {
      setState((currentState) => ({ ...currentState, isLoading: true }))
      setError(null)

      try {
        const nextPackLists = await getTaxFreePackLists({
          from: dateFrom,
          limit: PAGE_SIZE,
          offset,
          to: dateTo,
        })

        if (!cancelled) {
          setState({ isLoading: false, packLists: nextPackLists })
        }
      } catch (loadError) {
        if (!cancelled) {
          setState({ isLoading: false, packLists: [] })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити пакувальні листи'))
        }
      }
    }

    loadPackLists()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, filterError, offset, reloadKey, t])

  function resetFilters() {
    const filters = getDefaultFilters()
    setDateFrom(filters.from)
    setDateTo(filters.to)
    setPage(1)
  }

  async function confirmDelete() {
    if (!deleteCandidate?.NetUid) {
      return
    }

    try {
      await deleteTaxFreePackList(deleteCandidate.NetUid)
      notifications.show({ color: 'green', message: t('Пакувальний лист видалено') })
      setDeleteCandidate(null)
      reload()
    } catch (deleteError) {
      notifications.show({
        color: 'red',
        message: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити пакувальний лист'),
      })
    }
  }

  async function exportPackLists() {
    if (filterError) {
      setError(filterError)
      return
    }

    setExporting(true)
    setError(null)

    try {
      const document = await exportTaxFreePackLists({
        columns: EXPORT_COLUMNS,
        from: dateFrom,
        to: dateTo,
      })

      if (!openDocumentUrl(document)) {
        notifications.show({ color: 'yellow', message: t('Документ не містить посилання для відкриття') })
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати документ'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="flex-end" align="center">
        <Group gap="xs">
          <Tooltip label={t('Оновити')}>
            <ActionIcon variant="light" size={36} aria-label={t('Оновити')} onClick={reload}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button leftSection={<IconDownload size={16} />} loading={isExporting} variant="light" onClick={exportPackLists}>
            {t('Завантажити')}
          </Button>
        </Group>
      </Group>

      <Card withBorder radius="md">
        <Stack>
          <Group align="flex-end">
            <TextInput
              label={t('Дата з')}
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setPage(1)
                setDateFrom(event.currentTarget.value)
              }}
            />
            <TextInput
              label={t('Дата по')}
              type="date"
              value={dateTo}
              onChange={(event) => {
                setPage(1)
                setDateTo(event.currentTarget.value)
              }}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon variant="light" color="gray" size={36} aria-label={t('Скинути')} onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(error || filterError) && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {filterError || error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={filterError ? [] : state.packLists}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Пакувальних листів не знайдено')}
            getRowId={(packList, index) => packList.NetUid || String(packList.Id || index)}
            isLoading={state.isLoading}
            layoutVersion="tax-free-pack-lists-table-1"
            loadingText={t('Завантаження пакувальних листів')}
            maxHeight="calc(100vh - 330px)"
            minWidth={1290}
            tableId="tax-free-pack-lists"
            toolbarLeft={<Text size="xs" c="dimmed">{t('Сторінка')} {page}</Text>}
            onRowClick={setSelectedPackList}
          />

          {(page > 1 || canMoveForward) && (
            <Group justify="flex-end">
              <Pagination
                total={canMoveForward ? page + 1 : page}
                value={page}
                onChange={setPage}
              />
            </Group>
          )}
        </Stack>
      </Card>

      <Modal centered opened={Boolean(selectedPackList)} title={t('Оберіть дію')} onClose={() => setSelectedPackList(null)}>
        {selectedPackList && (
          <Stack gap="xs">
            <Button
              justify="flex-start"
              leftSection={<IconEdit size={16} />}
              variant="subtle"
              onClick={() => navigate(`/tax-free/pack-list/edit/${selectedPackList.NetUid}`)}
            >
              {t('Переглянути')}
            </Button>
            <Button
              disabled={!selectedPackList.IsSent || Boolean(selectedPackList.SupplyOrderUkraineId)}
              justify="flex-start"
              leftSection={<IconPackageExport size={16} />}
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
      </Modal>

      <Modal centered opened={Boolean(deleteCandidate)} title={t('Підтвердити видалення')} onClose={() => setDeleteCandidate(null)}>
        <Stack>
          <Text size="sm">{t('Видалити пакувальний лист')} {deleteCandidate?.Number || ''}?</Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteCandidate(null)}>{t('Скасувати')}</Button>
            <Button color="red" onClick={confirmDelete}>{t('Видалити')}</Button>
          </Group>
        </Stack>
      </Modal>

      <CreateSupplyOrderModal
        opened={Boolean(orderPackList)}
        packList={orderPackList}
        onClose={() => setOrderPackList(null)}
        onCreated={(netUid) => {
          notifications.show({
            color: 'yellow',
            message: t('Маршрут перегляду створеного замовлення ще не підключено'),
          })
          void netUid
        }}
      />
    </Stack>
  )
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
                <IconEdit size={16} />
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
                <IconTrash size={16} />
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
        cell: (packList) => <Text fw={600}>{formatDateTime(packList.FromDate)}</Text>,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        accessor: (packList) => packList.Number,
        cell: (packList) => <Text fw={600}>{displayValue(packList.Number)}</Text>,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 160,
        accessor: (packList) => getEntityName(packList.Organization),
        cell: (packList) => displayValue(getEntityName(packList.Organization)),
      },
      {
        id: 'client',
        header: t('Клієнт'),
        width: 250,
        accessor: (packList) => getEntityName(packList.Client),
        cell: (packList) => displayValue(getEntityName(packList.Client)),
      },
      {
        id: 'agreement',
        header: t('Договір'),
        width: 170,
        accessor: getPackListAgreementName,
        cell: (packList) => displayValue(getPackListAgreementName(packList)),
      },
      {
        id: 'taxFreeCount',
        header: t('К-сть Tax Free'),
        width: 120,
        align: 'right',
        accessor: (packList) => packList.TaxFreesCount ?? packList.TaxFrees?.length,
        cell: (packList) => displayValue(packList.TaxFreesCount ?? packList.TaxFrees?.length ?? 0),
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
        cell: (packList) => displayValue(getEntityName(packList.Responsible)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 250,
        accessor: (packList) => packList.Comment,
        cell: (packList) => displayValue(packList.Comment),
      },
    ],
    [onDelete, onOpen, t],
  )
}

function getDefaultFilters() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 7)

  return {
    from: formatLocalDate(from),
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
