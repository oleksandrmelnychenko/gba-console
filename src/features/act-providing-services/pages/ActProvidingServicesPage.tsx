import {
  ActionIcon,
  Alert,
  Badge,
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
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconRefresh,
  IconRestore,
  IconRoute,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import { getActProvidingServices } from '../api/actProvidingServicesApi'
import type { ActProvidingService } from '../types'
import { toActProvidingServiceDisplayModel, type ActProvidingServiceDisplayModel } from '../utils'
import './act-providing-services-page.css'

const PAGE_SIZE = 20
const pageSizeOptions = ['20', '40', '60', '100']
const PERMISSION_LOGISTIC_WAY = 'ActProvidingServices_SelectAnOption_LogisticWayBtn_PKEY'
const PERMISSION_VIEW_OPTION = 'ActProvidingServices_SelectAnOption_viewBtn_PKEY'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['management', 'accounting', 'date', 'number'],
    right: ['actions'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const ACT_PROVIDING_SERVICE_TABLE_CELL_STYLE = {
  display: 'block',
  lineHeight: '18px',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const

type ActProvidingServiceRow = ActProvidingServiceDisplayModel & {
  act: ActProvidingService
}

type ActProvidingServicesLoadState = {
  acts: ActProvidingService[]
  error: string | null
  isLoading: boolean
  total: number | undefined
}

const EMPTY_ACT_PROVIDING_SERVICES_LOAD_STATE: ActProvidingServicesLoadState = {
  acts: [],
  error: null,
  isLoading: false,
  total: undefined,
}

function useActProvidingServicesPageModel() {
  const { t } = useI18n()
  const defaultFilters = useMemo(() => getDefaultFilters(), [])
  const [loadState, setLoadState] = useValueState<ActProvidingServicesLoadState>(EMPTY_ACT_PROVIDING_SERVICES_LOAD_STATE)
  const [dateFrom, setDateFrom] = useValueState(defaultFilters.from)
  const [dateTo, setDateTo] = useValueState(defaultFilters.to)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [selectedRow, setSelectedRow] = useValueState<ActProvidingServiceRow | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const requestRef = useRef(0)
  const { acts, error, isLoading, total } = loadState
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
  const openSelectedRow = useCallback(
    (row: ActProvidingServiceRow) => {
      if (!row.supplyOrderUkraineNetUid && (!row.protocolNetId || !row.netId)) {
        notifications.show({ color: 'red', message: t('Обрано невірний сервіс') })
        return
      }

      setSelectedRow(row)
    },
    [setSelectedRow, t],
  )
  const closeSelectedRow = useCallback(() => setSelectedRow(null), [setSelectedRow])
  const columns = useActProvidingServiceColumns(openSelectedRow)

  const loadActs = useCallback(() => {
    let isActive = true
    const requestId = requestRef.current + 1
    requestRef.current = requestId

    if (filterError) {
      setLoadState(EMPTY_ACT_PROVIDING_SERVICES_LOAD_STATE)
      return () => {
        isActive = false
      }
    }

    setLoadState((currentState) => ({ ...currentState, error: null, isLoading: true }))

    void getActProvidingServices({
      from: dateFrom,
      limit: pageSize,
      offset,
      to: dateTo,
    })
      .then((response) => {
        if (!isActive || requestRef.current !== requestId) {
          return
        }

        setLoadState({
          acts: response.Items,
          error: null,
          isLoading: false,
          total: response.Total,
        })
      })
      .catch((loadError: unknown) => {
        if (isActive && requestRef.current === requestId) {
          setLoadState({
            acts: [],
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити акти надання послуг'),
            isLoading: false,
            total: undefined,
          })
        }
      })

    return () => {
      isActive = false
    }
  }, [dateFrom, dateTo, filterError, offset, pageSize, setLoadState, t])

  useEffect(() => {
    return loadActs()
  }, [loadActs, reloadKey])

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
    closeSelectedRow,
    openSelectedRow,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
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
    closeSelectedRow,
    openSelectedRow,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
  } = model

  return (
    <Stack className="act-providing-services-page" gap={6}>
      <PageHeaderActions>
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
      </PageHeaderActions>

      <Group align="end" gap="sm" wrap="nowrap">
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

      <div className="act-providing-services-page__table">
        <DataTable
            columns={columns}
            data={rows}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Актів надання послуг не знайдено')}
            getRowId={(row, index) => String(row.netId || row.act.Id || index)}
            isLoading={isLoading}
            layoutVersion="act-providing-services-table-2"
            loadingText={t('Завантаження актів надання послуг')}
            height="100%"
            minWidth={1320}
            showLayoutControls={false}
            tableId="act-providing-services"
            toolbarLeft={toolbarLeft}
            onRowClick={openSelectedRow}
          />
      </div>

      <Group className="act-providing-services-page__pagination" justify="flex-end" gap="sm">
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

      <ActProvidingServiceOptionsModal row={selectedRow} onClose={closeSelectedRow} />
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
  const canOpenSupplyOrder = Boolean(row?.supplyOrderUkraineNetUid)
  const canOpenProtocol = Boolean(row?.protocolNetId) && canOpenLogisticWay
  const hasAvailableActions = Boolean(canOpenViewOption || canOpenSupplyOrder || canOpenProtocol)

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

          {canOpenViewOption && (
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
          )}
          {canOpenSupplyOrder
            ? (
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
            : canOpenProtocol && (
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
          {!hasAvailableActions && (
            <Text c="dimmed" size="sm">
              {t('Немає доступних дій')}
            </Text>
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
        cell: (row) => <ActProvidingServiceTableValue fw={700} value={displayValue(row.managementMarker)} />,
      },
      {
        id: 'accounting',
        header: t('БО'),
        width: 58,
        minWidth: 52,
        accessor: (row) => row.accountingMarker,
        cell: (row) => <ActProvidingServiceTableValue fw={700} value={displayValue(row.accountingMarker)} />,
      },
      {
        id: 'date',
        header: t('Дата'),
        width: 150,
        minWidth: 132,
        accessor: (row) => row.date,
        cell: (row) => <ActProvidingServiceTableValue value={formatDateTime(row.date)} />,
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        accessor: (row) => row.number,
        cell: (row) => <ActProvidingServiceTableValue fw={700} value={displayValue(row.number)} />,
      },
      {
        id: 'invDate',
        header: t('Дата інвойсу'),
        width: 150,
        minWidth: 132,
        accessor: (row) => row.invDate,
        cell: (row) => <ActProvidingServiceTableValue value={formatDateTime(row.invDate)} />,
      },
      {
        id: 'invNumber',
        header: t('Номер інвойсу'),
        width: 180,
        minWidth: 140,
        accessor: (row) => row.invNumber,
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.invNumber)} />,
      },
      {
        id: 'amount',
        header: t('Сума'),
        width: 116,
        minWidth: 104,
        align: 'right',
        accessor: (row) => row.amount,
        cell: (row) => <ActProvidingServiceTableValue value={formatMoney(row.amount)} />,
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 92,
        minWidth: 80,
        accessor: (row) => row.currency,
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.currency)} />,
      },
      {
        id: 'supplier',
        header: t('Постачальник послуг'),
        width: 220,
        minWidth: 180,
        accessor: (row) => row.serviceOrganization,
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.serviceOrganization)} />,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 220,
        minWidth: 180,
        accessor: (row) => row.organization,
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.organization)} />,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 160,
        minWidth: 132,
        accessor: (row) => row.responsible,
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.responsible)} />,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 240,
        minWidth: 180,
        accessor: (row) => row.comment,
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.comment)} />,
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

function ActProvidingServiceTableValue({ fw, value }: { fw?: number; value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <Text component="span" fw={fw} style={ACT_PROVIDING_SERVICE_TABLE_CELL_STYLE}>
        {value}
      </Text>
    </Tooltip>
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
