import {
  ActionIcon,
  Alert,
  Badge,
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
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconRefresh,
  IconRestore,
  IconRoute,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useReducer } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import { getActProvidingServices } from '../api/actProvidingServicesApi'
import type { ActProvidingService } from '../types'
import { toActProvidingServiceDisplayModel, type ActProvidingServiceDisplayModel } from '../utils'

const PAGE_SIZE = 20
const pageSizeOptions = ['20', '40', '60', '100']
const PERMISSION_LOGISTIC_WAY = 'ActProvidingServices_SelectAnOption_LogisticWayBtn_PKEY'
const PERMISSION_VIEW_OPTION = 'ActProvidingServices_SelectAnOption_viewBtn_PKEY'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['management', 'accounting', 'date', 'number'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type ActProvidingServiceRow = ActProvidingServiceDisplayModel & {
  act: ActProvidingService
}

function useActProvidingServicesPageModel() {
  const { t } = useI18n()
  const defaultFilters = useMemo(() => getDefaultFilters(), [])
  const [acts, setActs] = useValueState<ActProvidingService[]>([])
  const [dateFrom, setDateFrom] = useValueState(defaultFilters.from)
  const [dateTo, setDateTo] = useValueState(defaultFilters.to)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [total, setTotal] = useValueState<number | undefined>(undefined)
  const [selectedRow, setSelectedRow] = useValueState<ActProvidingServiceRow | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateFrom, dateTo)
  const rows = useMemo(
    () => acts.map((act) => ({ ...toActProvidingServiceDisplayModel(act, t), act })),
    [acts, t],
  )
  const canMoveBackward = page > 1
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : acts.length === pageSize
  const toolbarLeft = useMemo(
    () => (
      <Text c="dimmed" size="xs">
        {t('Сторінка')} {page}
        {typeof total === 'number' ? `, ${t('усього')}: ${total}` : ''}
      </Text>
    ),
    [page, t, total],
  )
  const columns = useActProvidingServiceColumns((row) => setSelectedRow(row))

  useEffect(() => {
    if (filterError) {
      setActs([])
      setTotal(undefined)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadActs() {
      setLoading(true)
      setError(null)

      try {
        const response = await getActProvidingServices({
          from: dateFrom,
          limit: pageSize,
          offset,
          to: dateTo,
        })

        if (!cancelled) {
          setActs(response.Items)
          setTotal(response.Total)
        }
      } catch (loadError) {
        if (!cancelled) {
          setActs([])
          setTotal(undefined)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити акти надання послуг'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadActs()

    return () => {
      cancelled = true
    }
  }, [dateFrom, dateTo, filterError, offset, pageSize, reloadKey, setActs, setError, setLoading, setTotal, t])

  function resetFilters() {
    const filters = getDefaultFilters()

    setDateFrom(filters.from)
    setDateTo(filters.to)
    setPage(1)
  }

  return {
    canMoveBackward,
    canMoveForward,
    columns,
    dateFrom,
    dateTo,
    error,
    filterError,
    isLoading,
    page,
    pageSize,
    rows,
    selectedRow,
    toolbarLeft,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
    setSelectedRow,
  }
}

export function ActProvidingServicesPage() {
  const model = useActProvidingServicesPageModel()

  return <ActProvidingServicesPageView model={model} />
}

function ActProvidingServicesPageView({ model }: { model: ReturnType<typeof useActProvidingServicesPageModel> }) {
  const { t } = useI18n()
  const {
    canMoveBackward,
    canMoveForward,
    columns,
    dateFrom,
    dateTo,
    error,
    filterError,
    isLoading,
    page,
    pageSize,
    rows,
    selectedRow,
    toolbarLeft,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
    setSelectedRow,
  } = model

  return (
    <Stack gap="lg">
      <Group justify="flex-end">
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoading}
            size={38}
            variant="light"
            onClick={() => reload()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              label={t('Від')}
              type="date"
              value={dateFrom}
              w={150}
              onChange={(event) => {
                setPage(1)
                setDateFrom(event.currentTarget.value)
              }}
            />
            <TextInput
              label={t('До')}
              type="date"
              value={dateTo}
              w={150}
              onChange={(event) => {
                setPage(1)
                setDateTo(event.currentTarget.value)
              }}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {(error || filterError) && (
            <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {filterError || error}
            </Alert>
          )}

          <Group justify="space-between" gap="sm">
            <Text c="dimmed" size="sm">
              {t('Показано')} {rows.length}
            </Text>
            <Group gap="xs">
              <Select
                aria-label={t('Розмір сторінки')}
                data={pageSizeOptions}
                value={String(pageSize)}
                w={84}
                onChange={(value) => {
                  setPage(1)
                  setPageSize(Number(value || PAGE_SIZE))
                }}
              />
              <ActionIcon
                aria-label={t('Попередня сторінка')}
                color="gray"
                disabled={!canMoveBackward || isLoading}
                size={36}
                variant="light"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text size="sm" ta="center" w={34}>
                {page}
              </Text>
              <ActionIcon
                aria-label={t('Наступна сторінка')}
                color="gray"
                disabled={!canMoveForward || isLoading}
                size={36}
                variant="light"
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          </Group>

          <DataTable
            columns={columns}
            data={rows}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Актів надання послуг не знайдено')}
            getRowId={(row, index) => String(row.netId || row.act.Id || index)}
            isLoading={isLoading}
            layoutVersion="act-providing-services-table-1"
            loadingText={t('Завантаження актів надання послуг')}
            maxHeight="calc(100vh - 310px)"
            minWidth={1320}
            tableId="act-providing-services"
            toolbarLeft={toolbarLeft}
            onRowClick={setSelectedRow}
          />
        </Stack>
      </Card>

      <ActProvidingServiceOptionsModal row={selectedRow} onClose={() => setSelectedRow(null)} />
    </Stack>
  )
}

function ActProvidingServiceOptionsModal({
  row,
  onClose,
}: {
  row: ActProvidingServiceRow | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canOpenLogisticWay = hasPermission(PERMISSION_LOGISTIC_WAY)
  const canOpenViewOption = hasPermission(PERMISSION_VIEW_OPTION)

  useEffect(() => {
    if (!row || row.supplyOrderUkraineNetUid) {
      return
    }

    if (!row.protocolNetId || !row.netId) {
      notifications.show({ color: 'red', message: t('Обрано невірний сервіс') })
    }
  }, [row, t])

  return (
    <AppModal centered opened={Boolean(row)} title={t('Виберіть опцію')} onClose={onClose}>
      {row && (
        <Stack gap="sm">
          <Group gap="xs">
            <Badge color={row.accountingMarker ? 'violet' : 'green'} variant="light">
              {row.accountingMarker ? t('Бухгалтерський') : t('Управлінський')}
            </Badge>
            <Text c="dimmed" size="sm">
              {displayValue(row.number)} · {formatDateTime(row.date)}
            </Text>
          </Group>

          <Button
            component={Link}
            disabled={!row.netId}
            justify="flex-start"
            leftSection={<IconEye size={18} />}
            to={`/act-providing-services/${row.netId}`}
            variant="light"
          >
            {t('Огляд')}
          </Button>
          {row.supplyOrderUkraineNetUid
            ? canOpenViewOption && (
                <Button
                  justify="flex-start"
                  leftSection={<IconRoute size={18} />}
                  variant="light"
                  onClick={() => {
                    navigate(`/orders/ukraine/view/${row.supplyOrderUkraineNetUid}`)
                    onClose()
                  }}
                >
                  {t('Замовлення в Україну')}
                </Button>
              )
            : row.protocolNetId
              && canOpenLogisticWay && (
                <Button
                  justify="flex-start"
                  leftSection={<IconRoute size={18} />}
                  variant="light"
                  onClick={() => {
                    navigate(`/product-delivery-protocols/${row.protocolNetId}`)
                    onClose()
                  }}
                >
                  {t('Логістичний шлях')}
                </Button>
              )}
        </Stack>
      )}
    </AppModal>
  )
}

function useActProvidingServiceColumns(
  onOpen: (row: ActProvidingServiceRow) => void,
): DataTableColumn<ActProvidingServiceRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ActProvidingServiceRow>[]>(
    () => [
      {
        id: 'management',
        header: t('УО'),
        width: 58,
        minWidth: 52,
        accessor: (row) => row.managementMarker,
        cell: (row) => <Text fw={700}>{row.managementMarker}</Text>,
      },
      {
        id: 'accounting',
        header: t('БО'),
        width: 58,
        minWidth: 52,
        accessor: (row) => row.accountingMarker,
        cell: (row) => <Text fw={700}>{row.accountingMarker}</Text>,
      },
      {
        id: 'date',
        header: t('Дата'),
        width: 150,
        minWidth: 132,
        accessor: (row) => row.date,
        cell: (row) => formatDateTime(row.date),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.number,
        cell: (row) => <Text fw={700}>{displayValue(row.number)}</Text>,
      },
      {
        id: 'invDate',
        header: t('Дата інвойсу'),
        width: 150,
        minWidth: 132,
        accessor: (row) => row.invDate,
        cell: (row) => formatDateTime(row.invDate),
      },
      {
        id: 'invNumber',
        header: t('Номер інвойсу'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.invNumber,
        cell: (row) => displayValue(row.invNumber),
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => formatMoney(row.amount),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 92,
        minWidth: 80,
        accessor: (row) => row.currency,
        cell: (row) => displayValue(row.currency),
      },
      {
        id: 'supplier',
        header: t('Постачальник послуг'),
        width: 220,
        minWidth: 180,
        accessor: (row) => row.serviceOrganization,
        cell: (row) => (
          <Text lineClamp={2} size="sm">
            {displayValue(row.serviceOrganization)}
          </Text>
        ),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 220,
        minWidth: 180,
        accessor: (row) => row.organization,
        cell: (row) => displayValue(row.organization),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 160,
        minWidth: 132,
        accessor: (row) => row.responsible,
        cell: (row) => displayValue(row.responsible),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 240,
        minWidth: 180,
        accessor: (row) => row.comment,
        cell: (row) => (
          <Text lineClamp={2} size="sm">
            {displayValue(row.comment)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        width: 56,
        minWidth: 50,
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (row) => (
          <Tooltip label={t('Відкрити')}>
            <ActionIcon
              aria-label={t('Відкрити')}
              color="gray"
              disabled={!row.netId}
              size={30}
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onOpen(row)
              }}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [onOpen, t],
  )
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }

  return moneyFormatter.format(value)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}

function getFilterError(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) {
    return 'Оберіть діапазон дат'
  }

  if (dateFrom > dateTo) {
    return 'Дата “Від” не може бути більшою за дату “До”'
  }

  return null
}

function getDefaultFilters(): { from: string; to: string } {
  const to = new Date()
  const from = new Date()

  from.setDate(from.getDate() - 1)

  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
  }
}
