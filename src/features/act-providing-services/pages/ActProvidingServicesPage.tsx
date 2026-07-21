import {
  ActionIcon,
  Alert,
  Button,
  Stack,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { CircleAlert, ExternalLink, RotateCcw, Route, Search } from 'lucide-react'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import { getActProvidingServices } from '../api/actProvidingServicesApi'
import type { ActProvidingService } from '../types'
import { toActProvidingServiceDisplayModel, type ActProvidingServiceDisplayModel } from '../utils'
import './act-providing-services-page.css'
import '../../../shared/ui/console-table-page.css'

const PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE
const PERMISSION_LOGISTIC_WAY = 'ActProvidingServices_SelectAnOption_LogisticWayBtn_PKEY'
const PERMISSION_VIEW_ACT = 'ActProvidingServices_SelectAnOption_viewBtn_PKEY'
const ACT_PROVIDING_SERVICES_TABLE_MIN_WIDTH = 1120
const ACT_PROVIDING_SERVICES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['act'],
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
    closeSelectedRow,
    openSelectedRow,
    reload,
    resetFilters,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
  } = model
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const [searchValue, setSearchValue] = useValueState('')
  const filteredRows = useMemo(() => filterActRows(rows, searchValue), [rows, searchValue])
  const columns = useMemo<DataTableColumn<ActProvidingServiceRow>[]>(
    () => [
      {
        id: 'act',
        header: t('Акт'),
        width: 250,
        minWidth: 220,
        accessor: (row) => row.actNumber || row.number || '',
        cell: (row) => <ActIdentityCell row={row} />,
      },
      {
        id: 'invoice',
        header: t('Інвойс'),
        width: 172,
        minWidth: 146,
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
        header: t('Сума'),
        width: 124,
        minWidth: 112,
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
        header: t('Постачальник / Організація'),
        width: 292,
        minWidth: 240,
        fill: true,
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
        header: t('Відповідальний'),
        width: 164,
        minWidth: 136,
        accessor: (row) => row.responsible || '',
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.responsible)} />,
      },
      {
        id: 'comment',
        header: t('Коментар'),
        width: 220,
        minWidth: 156,
        accessor: (row) => row.comment || '',
        cell: (row) => <ActProvidingServiceTableValue value={displayValue(row.comment)} />,
      },
    ],
    [t],
  )

  const resetPageFilters = useCallback(() => {
    resetFilters()
    setSearchValue('')
  }, [resetFilters, setSearchValue])

  return (
    <Stack className="act-providing-services-page console-table-page" gap={6}>
      <div className="console-table-shell">
        <div className="app-filter-bar act-services-filter-bar">
          <div className="act-services-filter-row">
            <div className="app-filter-date-range">
              <TextInput
                className="act-services-date-input"
                label={t('Від')}
                max={dateTo || undefined}
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setPage(1)
                  setDateFrom(event.currentTarget.value)
                }}
              />
              <TextInput
                className="act-services-date-input"
                label={t('До')}
                min={dateFrom || undefined}
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setPage(1)
                  setDateTo(event.currentTarget.value)
                }}
              />
            </div>

            <TextInput
              className="act-services-search-input"
              leftSection={<Search size={15} />}
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
                  <RotateCcw size={17} />
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
          <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot act-services-table-toolbar-slot" />
        </div>

        {(error || filterError) && (
          <Alert className="console-table-alert" color={filterError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
            {filterError || error}
          </Alert>
        )}

        <div className="act-providing-services-page__table console-table-body">
          <DataTable
            columns={columns}
            data={filteredRows}
            defaultLayout={ACT_PROVIDING_SERVICES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Актів надання послуг не знайдено')}
            getRowId={(row, index) => String(row.netId || row.act.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="act-providing-services-table-3"
            minWidth={ACT_PROVIDING_SERVICES_TABLE_MIN_WIDTH}
            showLayoutControls
            tableId="act-providing-services"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={openSelectedRow}
          />
        </div>
      </div>

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
  const canViewAct = hasPermission(PERMISSION_VIEW_ACT)
  const canOpenSupplyOrder = Boolean(row?.supplyOrderUkraineNetUid)
  const canOpenViewOption = Boolean(row?.netId) && (canViewAct || canOpenSupplyOrder)
  const canOpenProtocol = Boolean(row?.protocolNetId) && canOpenLogisticWay
  const hasAvailableActions = Boolean(canOpenViewOption || canOpenSupplyOrder || canOpenProtocol)
  const isActive = row?.act.Deleted !== true

  return (
    <AppModal
      centered
      opened={Boolean(row)}
      size={496}
      title={
        <span className="act-services-action-title">
          <span className={`act-services-action-status-dot${isActive ? ' is-active' : ''}`} />
          {row ? displayValue(row.actNumber || row.number) || t('Акт надання послуг') : t('Акт надання послуг')}
        </span>
      }
      onClose={onClose}
    >
      {row && (
        <Stack className="app-modal-actions" gap="xs">
          {canOpenViewOption && (
            <Button
              fullWidth
              color="dark"
              disabled={!row.netId}
              justify="flex-start"
              leftSection={
                <span className="app-action-icon">
                  <ExternalLink size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              size="md"
              variant="subtle"
              onClick={() => {
                navigate(`/act-providing-services/${row.netId}`)
                onClose()
              }}
            >
              {t('Огляд')}
            </Button>
          )}
          {canOpenSupplyOrder && (
            <Button
              fullWidth
              color="dark"
              justify="flex-start"
              leftSection={
                <span className="app-action-icon">
                  <Route size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              size="md"
              variant="subtle"
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
              fullWidth
              color="dark"
              justify="flex-start"
              leftSection={
                <span className="app-action-icon">
                  <Route size={20} color="var(--mantine-color-gray-7)" />
                </span>
              }
              size="md"
              variant="subtle"
              onClick={() => {
                navigate(`/product-delivery-protocols/${row.protocolNetId}`)
                onClose()
              }}
            >
              {t('Логістичний шлях')}
            </Button>
          )}
          {!hasAvailableActions && (
            <Button fullWidth color="dark" disabled justify="flex-start" size="md" variant="subtle">
              {t('Немає доступних дій')}
            </Button>
          )}
        </Stack>
      )}
    </AppModal>
  )
}

function ActProvidingServiceTableValue({ value }: { value: string }) {
  return (
    <span className="act-services-single-value" title={nativeTitle(value)}>
      {value}
    </span>
  )
}

function ActIdentityCell({ row }: { row: ActProvidingServiceRow }) {
  const { t } = useI18n()
  const type = row.accountingMarker ? t('БО') : t('УО')
  const date = formatDateTime(row.date)
  const title = displayValue(row.actNumber || row.number)
  const tooltip = [title, type, date].filter(Boolean).join(' · ')

  return (
    <span className="act-service-identity-cell" title={nativeTitle(tooltip)}>
      <span className="act-service-identity-copy">
        <span className="act-service-identity-title">{title}</span>
        <span className="act-service-meta-row">
          <span className="act-service-meta-value">
            <span>{t('тип')}</span>
            <strong>{type}</strong>
          </span>
          {date && (
            <span className="act-service-meta-value">
              <span>{t('від')}</span>
              <strong>{date}</strong>
            </span>
          )}
        </span>
      </span>
    </span>
  )
}

function ActTwoLineValue({ primary, secondary }: { primary: string; secondary: string }) {
  const tooltip = `${primary}\n${secondary}`

  return (
    <span className="act-service-two-line-value" title={nativeTitle(tooltip)}>
      <span>{primary}</span>
      <small>{secondary}</small>
    </span>
  )
}

function ActAmountCell({ amount, currency }: { amount: string; currency: string }) {
  return (
    <span className="act-service-amount-cell" title={nativeTitle([amount, currency].filter(Boolean).join(' '))}>
      <strong>{amount}</strong>
      <small>{currency}</small>
    </span>
  )
}

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
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
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}

function hasActProvidingServiceActionTarget(row: ActProvidingServiceRow): boolean {
  return Boolean(row.netId || row.supplyOrderUkraineNetUid || row.protocolNetId)
}

function nativeTitle(value: string): string | undefined {
  const title = value.trim()

  return title ? title : undefined
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
