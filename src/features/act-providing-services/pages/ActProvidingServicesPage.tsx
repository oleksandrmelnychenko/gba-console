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
import {
  IconAlertCircle,
  IconFileText,
  IconEye,
  IconRestore,
  IconRoute,
  IconSearch,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SYNC_DATA_RANGE_START, formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { useAuth } from '../../auth/useAuth'
import { ActProvidingServiceDetailDrawer } from '../components/ActProvidingServiceDetailDrawer'
import { getActProvidingServices } from '../api/actProvidingServicesApi'
import type { ActProvidingService } from '../types'
import { toActProvidingServiceDisplayModel, type ActProvidingServiceDisplayModel } from '../utils'
import './act-providing-services-page.css'
import '../../../shared/ui/console-table-page.css'

const PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE
const PERMISSION_LOGISTIC_WAY = 'ActProvidingServices_SelectAnOption_LogisticWayBtn_PKEY'
const PERMISSION_VIEW_ACT = 'ActProvidingServices_SelectAnOption_viewBtn_PKEY'

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

const ACT_SERVICES_TABLE_DEFAULT_LAYOUT = {
  columnOrder: ['act', 'invoice', 'amount', 'parties', 'responsible', 'comment', 'actions'],
  columnPinning: {
    left: ['act'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type ActProvidingServicesLoadState = {
  acts: ActProvidingService[]
  error: string | null
  hasMore: boolean
  isLoading: boolean
  total: number | undefined
}

const EMPTY_ACT_PROVIDING_SERVICES_LOAD_STATE: ActProvidingServicesLoadState = {
  acts: [],
  error: null,
  hasMore: false,
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
  const [viewRow, setViewRow] = useValueState<ActProvidingServiceRow | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const requestRef = useRef(0)
  const { acts, error, hasMore, isLoading, total } = loadState
  const offset = (page - 1) * pageSize
  const filterError = getFilterError(dateFrom, dateTo)
  const rows = useMemo(
    () => acts.map((act) => ({ ...toActProvidingServiceDisplayModel(act, t), act })),
    [acts, t],
  )
  const canMoveForward = typeof total === 'number' ? page * pageSize < total : hasMore
  const openSelectedRow = useCallback(
    (row: ActProvidingServiceRow) => {
      if (!hasActProvidingServiceActionTarget(row)) {
        notifications.show({ color: 'red', message: t('Обрано невірний сервіс') })
        return
      }

      setSelectedRow(row)
    },
    [setSelectedRow, t],
  )
  const closeSelectedRow = useCallback(() => setSelectedRow(null), [setSelectedRow])
  const openViewRow = useCallback((row: ActProvidingServiceRow) => setViewRow(row), [setViewRow])
  const closeViewRow = useCallback(() => setViewRow(null), [setViewRow])

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
      isFiltered: offset === 0,
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
          hasMore: Boolean(response.HasMore),
          isLoading: false,
          total: response.Total,
        })
      })
      .catch((loadError: unknown) => {
        if (isActive && requestRef.current === requestId) {
          setLoadState({
            acts: [],
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити акти надання послуг'),
            hasMore: false,
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
    canMoveForward,
    dateFrom,
    dateTo,
    error,
    filterError,
    isLoading,
    page,
    pageSize,
    rows,
    selectedRow,
    viewRow,
    closeSelectedRow,
    openSelectedRow,
    openViewRow,
    closeViewRow,
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
    canMoveForward,
    dateFrom,
    dateTo,
    error,
    filterError,
    isLoading,
    page,
    pageSize,
    rows,
    selectedRow,
    viewRow,
    closeSelectedRow,
    openSelectedRow,
    openViewRow,
    closeViewRow,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
  } = model
  const [searchValue, setSearchValue] = useValueState('')
  const filteredRows = useMemo(() => filterActRows(rows, searchValue), [rows, searchValue])
  const actColumns = useActServicesColumns(openSelectedRow)

  const resetPageFilters = useCallback(() => {
    resetFilters()
    setSearchValue('')
  }, [resetFilters, setSearchValue])

  return (
    <Stack className="act-providing-services-page console-table-page" gap="md">
      <Card className="app-data-card act-providing-services-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar">
          <div className="act-services-filter-row">
            <div className="act-services-period-filter">
              <span className="act-services-filter-label">{t('Період')}</span>
              <div className="act-services-period-fields">
                <TextInput
                  className="act-services-date-input"
                  aria-label={t('Від')}
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setPage(1)
                    setDateFrom(event.currentTarget.value)
                  }}
                />
                <span className="act-services-period-separator" />
                <TextInput
                  className="act-services-date-input"
                  aria-label={t('До')}
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setPage(1)
                    setDateTo(event.currentTarget.value)
                  }}
                />
              </div>
            </div>

            <TextInput
              className="act-services-search-input"
              leftSection={<IconSearch size={15} />}
              label={t('Пошук')}
              placeholder={t('Номер, акт, інвойс, постачальник')}
              value={searchValue}
              onChange={(event) => {
                setPage(1)
                setSearchValue(event.currentTarget.value)
              }}
            />

            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetPageFilters}>
                  <IconRestore size={17} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                hasNext={canMoveForward}
                isLoading={isLoading}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPage(1)
                  setPageSize(nextPageSize)
                }}
                onRefresh={reload}
              />
            </div>
          </div>
        </div>

        {(error || filterError) && (
          <Alert className="console-table-alert" color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
            {filterError || error}
          </Alert>
        )}

        <div className="act-providing-services-page__table console-table-body">
          <DataTable
            columns={actColumns}
            data={filteredRows}
            defaultLayout={ACT_SERVICES_TABLE_DEFAULT_LAYOUT}
            density={ACT_SERVICES_TABLE_DEFAULT_LAYOUT.density}
            emptyText={t('Актів надання послуг не знайдено')}
            getRowId={(row, index) => String(row.netId || row.act.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="act-providing-services-table-1"
            loadingText={t('Завантаження актів надання послуг')}
            minWidth={1080}
            showDensityToggle={false}
            showLayoutControls={false}
            tableId="act-providing-services"
            onRowClick={openSelectedRow}
          />
        </div>
      </Card>

      <ActProvidingServiceOptionsModal row={selectedRow} onClose={closeSelectedRow} onView={openViewRow} />
      <ActProvidingServiceDetailDrawer row={viewRow} onClose={closeViewRow} />
    </Stack>
  )
}

function ActProvidingServiceOptionsModal({
  row,
  onClose,
  onView,
}: {
  row: ActProvidingServiceRow | null
  onClose: () => void
  onView: (row: ActProvidingServiceRow) => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canOpenLogisticWay = hasPermission(PERMISSION_LOGISTIC_WAY)
  const canViewAct = hasPermission(PERMISSION_VIEW_ACT)
  const canOpenSupplyOrder = Boolean(row?.supplyOrderUkraineNetUid)
  const canOpenViewOption = Boolean(row?.netId) && (canViewAct || canOpenSupplyOrder)
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
              disabled={!row.netId}
              justify="flex-start"
              leftSection={<IconEye size={18} />}
              variant="light"
              onClick={() => {
                onView(row)
                onClose()
              }}
            >
              {t('Огляд')}
            </Button>
          )}
          {canOpenSupplyOrder && (
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
          )}
          {canOpenProtocol && (
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

function useActServicesColumns(
  onOpen: (row: ActProvidingServiceRow) => void,
): DataTableColumn<ActProvidingServiceRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ActProvidingServiceRow>[]>(
    () => [
      {
        id: 'act',
        header: 'Акт',
        width: 280,
        minWidth: 250,
        fill: true,
        accessor: (row) => row.actNumber || row.number || '',
        cell: (row) => <ActIdentityCell row={row} />,
      },
      {
        id: 'invoice',
        header: 'Інвойс',
        width: 170,
        minWidth: 158,
        accessor: (row) => `${row.invNumber || ''} ${row.listInvDate || row.invDate || ''}`,
        cell: (row) => (
          <ActTwoLineValue
            primary={displayValue(row.invNumber)}
            secondary={formatDateTime(row.listInvDate ?? row.invDate)}
          />
        ),
      },
      {
        id: 'amount',
        header: 'Сума',
        width: 116,
        minWidth: 110,
        align: 'right',
        accessor: (row) => getActProvidingServiceListAmount(row) ?? Number.NEGATIVE_INFINITY,
        cell: (row) => (
          <ActAmountCell
            amount={formatMoney(getActProvidingServiceListAmount(row))}
            currency={displayValue(row.currency)}
          />
        ),
      },
      {
        id: 'parties',
        header: 'Постачальник / Організація',
        width: 280,
        minWidth: 260,
        accessor: (row) => `${row.serviceOrganization || ''} ${row.organization || ''}`,
        cell: (row) => (
          <ActTwoLineValue
            primary={displayValue(row.serviceOrganization)}
            secondary={displayValue(row.organization)}
          />
        ),
      },
      {
        id: 'responsible',
        header: 'Відповідальний',
        width: 160,
        minWidth: 150,
        accessor: (row) => row.responsible || '',
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.responsible)} />,
      },
      {
        id: 'comment',
        header: 'Коментар',
        width: 190,
        minWidth: 180,
        accessor: (row) => row.comment || '',
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.comment)} />,
      },
      {
        id: 'actions',
        header: '',
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (row) => (
          <Tooltip label={t('Відкрити')}>
            <ActionIcon
              aria-label={t('Відкрити')}
              color="gray"
              disabled={!hasActProvidingServiceActionTarget(row)}
              size="sm"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                onOpen(row)
              }}
            >
              <IconEye size={15} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [onOpen, t],
  )
}

function ActProvidingServiceTableValue({ value }: { value: string }) {
  return (
    <Tooltip label={value} openDelay={350} withArrow>
      <span className="act-services-single-value">
        {value}
      </span>
    </Tooltip>
  )
}

function ActIdentityCell({ row }: { row: ActProvidingServiceRow }) {
  const metaItems = [
    row.managementMarker ? `УО ${row.managementMarker}` : null,
    row.accountingMarker ? `БО ${row.accountingMarker}` : null,
    formatDateTime(row.date),
  ].filter(Boolean)
  const title = displayValue(row.actNumber || row.number)
  const subtitle = metaItems.join(' · ')

  return (
    <Tooltip label={`${title}\n${subtitle}`} multiline openDelay={350} withArrow>
      <span className="act-service-identity-cell">
        <span className="act-service-identity-icon" aria-hidden>
          <IconFileText size={16} />
        </span>
        <span className="act-service-identity-copy">
          <span className="act-service-identity-title">{title}</span>
          <span className="act-service-identity-subtitle">{subtitle}</span>
        </span>
      </span>
    </Tooltip>
  )
}

function ActTwoLineValue({ primary, secondary }: { primary: string; secondary: string }) {
  const tooltip = `${primary}\n${secondary}`

  return (
    <Tooltip label={tooltip} multiline openDelay={350} withArrow>
      <span className="act-service-two-line-value">
        <span>{primary}</span>
        <small>{secondary}</small>
      </span>
    </Tooltip>
  )
}

function ActAmountCell({ amount, currency }: { amount: string; currency: string }) {
  return (
    <span className="act-service-amount-cell">
      <strong>{amount}</strong>
      <small>{currency}</small>
    </span>
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

function getActProvidingServiceListAmount(row: ActProvidingServiceRow): number | undefined {
  return row.act.Price ?? row.amount
}

function filterActRows(rows: ActProvidingServiceRow[], searchValue: string): ActProvidingServiceRow[] {
  const normalizedSearchValue = normalizeActSearchValue(searchValue)

  if (!normalizedSearchValue) {
    return rows
  }

  return rows.filter((row) => normalizeActSearchValue(getActSearchText(row)).includes(normalizedSearchValue))
}

function getActSearchText(row: ActProvidingServiceRow): string {
  return [
    row.actNumber,
    row.number,
    row.managementMarker,
    row.accountingMarker,
    row.invNumber,
    formatDateTime(row.listInvDate ?? row.invDate),
    formatDateTime(row.date),
    formatMoney(getActProvidingServiceListAmount(row)),
    row.currency,
    row.serviceOrganization,
    row.organization,
    row.responsible,
    row.comment,
    row.netId,
    row.supplyOrderUkraineNetUid,
    row.protocolNetId,
  ].filter(Boolean).join(' ')
}

function normalizeActSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase('uk')
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}

function hasActProvidingServiceActionTarget(row: ActProvidingServiceRow): boolean {
  return Boolean(row.netId || row.supplyOrderUkraineNetUid || row.protocolNetId)
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

  return {
    from: SYNC_DATA_RANGE_START,
    to: formatLocalDate(to),
  }
}
