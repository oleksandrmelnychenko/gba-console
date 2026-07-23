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
import { notifications } from '@mantine/notifications'
import { ArrowLeft, CircleAlert, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { formatDateInputForQuery, formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { useAuth } from '../../auth/useAuth'
import {
  deleteCompanyCarRoadList,
  getCompanyCar,
  getCompanyCarRoadLists,
} from '../api/companyCarsApi'
import { CompanyCarRoadListFormModal } from '../components/CompanyCarRoadListFormModal'
import { COMPANY_CAR_ROAD_LIST_MANAGE_PERMISSION } from '../permissions'
import type { CompanyCar, CompanyCarRoadList } from '../types'
import './company-car-road-lists-page.css'

const COMPANY_CARS_PATH = '/accounting/company-cars'
const DEFAULT_LOOKBACK_DAYS = 7

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['created'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

type CompanyCarRoadListsState = {
  companyCar: CompanyCar | null
  error: string | null
  isLoading: boolean
  roadLists: CompanyCarRoadList[]
}

type CompanyCarRoadListsAction =
  | { type: 'append-road-list'; roadList: CompanyCarRoadList }
  | { type: 'delete-road-list'; companyCar: CompanyCar | null; netUid: string }
  | { type: 'failed'; error: string }
  | { type: 'invalid-filter' }
  | { type: 'missing-company-car' }
  | { type: 'set-error'; error: string | null }
  | { type: 'start-loading' }
  | { type: 'upsert-road-list'; companyCar: CompanyCar | null; roadList: CompanyCarRoadList }
  | { type: 'loaded'; companyCar: CompanyCar | null; roadLists: CompanyCarRoadList[] }

const initialRoadListsState: CompanyCarRoadListsState = {
  companyCar: null,
  error: null,
  isLoading: true,
  roadLists: [],
}

export function CompanyCarRoadListsPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id?: string }>()
  const locationState = location.state as { returnPath?: string } | null
  const returnPath = locationState?.returnPath || COMPANY_CARS_PATH
  const [loadState, dispatchLoadState] = useReducer(roadListsReducer, initialRoadListsState)
  const { companyCar, error, isLoading, roadLists } = loadState
  const [fromDate, setFromDate] = useValueState(() => shiftDay(-DEFAULT_LOOKBACK_DAYS))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [isFormOpen, setFormOpen] = useValueState(false)
  const [editTarget, setEditTarget] = useValueState<CompanyCarRoadList | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<CompanyCarRoadList | null>(null)
  const [isDeleting, setDeleting] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, toggleDensity } = useDataTableDensity('company-car-road-lists', TABLE_DEFAULT_LAYOUT.density)
  const filterError = getDateRangeError(fromDate, toDate)
  const canManageRoadLists = hasPermission(COMPANY_CAR_ROAD_LIST_MANAGE_PERMISSION)

  const columns = useRoadListColumns({ canManage: canManageRoadLists, onDelete: setDeleteTarget, onEdit: setEditTarget })

  useEffect(() => {
    if (!id) {
      dispatchLoadState({ type: 'missing-company-car' })
      return
    }

    if (filterError) {
      dispatchLoadState({ type: 'invalid-filter' })
      return
    }

    const controller = new AbortController()
    dispatchLoadState({ type: 'start-loading' })

    void Promise.all([
      getCompanyCar(id),
      getCompanyCarRoadLists({
        companyCarNetId: id,
        from: formatDateInputForQuery(fromDate),
        to: formatDateInputForQuery(toDate),
      }),
    ])
      .then(([nextCompanyCar, nextRoadLists]) => {
        if (!controller.signal.aborted) {
          dispatchLoadState({ companyCar: nextCompanyCar, roadLists: nextRoadLists, type: 'loaded' })
        }
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          dispatchLoadState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити шляхові листи'),
            type: 'failed',
          })
        }
      })

    return () => controller.abort()
  }, [filterError, fromDate, id, reloadKey, t, toDate])

  const handleSaved = useCallback(
    (roadList: CompanyCarRoadList) => {
      const wasEdit = Boolean(editTarget?.NetUid || editTarget?.Id)

      dispatchLoadState({ companyCar: roadList.CompanyCar || null, roadList, type: 'upsert-road-list' })
      setFormOpen(false)
      setEditTarget(null)
      notifications.show({ color: 'green', message: wasEdit ? t('Шляховий лист оновлено') : t('Шляховий лист створено') })
    },
    [editTarget, setEditTarget, setFormOpen, t],
  )

  function openCreateForm() {
    if (!canManageRoadLists) {
      dispatchLoadState({ error: t('Немає прав для зміни шляхових листів'), type: 'set-error' })
      return
    }

    setEditTarget(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditTarget(null)
  }

  async function handleDelete() {
    if (!canManageRoadLists) {
      dispatchLoadState({ error: t('Немає прав для видалення шляхового листа'), type: 'set-error' })
      return
    }

    if (!deleteTarget?.NetUid) {
      return
    }

    setDeleting(true)
    dispatchLoadState({ error: null, type: 'set-error' })

    try {
      const nextCompanyCar = await deleteCompanyCarRoadList(deleteTarget.NetUid)
      dispatchLoadState({ companyCar: nextCompanyCar, netUid: deleteTarget.NetUid, type: 'delete-road-list' })
      notifications.show({ color: 'green', message: t('Шляховий лист видалено') })
      setDeleteTarget(null)
    } catch (deleteError) {
      dispatchLoadState({
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити шляховий лист'),
        type: 'set-error',
      })
    } finally {
      setDeleting(false)
    }
  }

  function resetFilters() {
    setFromDate(shiftDay(-DEFAULT_LOOKBACK_DAYS))
    setToDate(formatLocalDate(new Date()))
  }

  return (
    <Stack className="company-car-road-lists-page" gap={6}>
      <Card className="app-data-card company-car-road-lists-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar company-car-road-lists-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="company-car-road-lists-filter-row">
            <Group gap="xs" wrap="nowrap" className="company-car-road-lists-identity">
              <Button color="gray" leftSection={<ArrowLeft size={16} />} size="sm" variant="light" onClick={() => navigate(returnPath)}>
                {t('Назад')}
              </Button>
              <Badge className="app-role-pill" variant="light">
                {displayValue(companyCar?.LicensePlate)}
              </Badge>
              <Text fw={700}>{displayValue(companyCar?.CarBrand)}</Text>
              {companyCar?.Organization && (
                <Text c="dimmed" size="sm">
                  {displayValue(companyCar.Organization.Name)}
                </Text>
              )}
            </Group>
            <TextInput
              label={t('Від якої дати')}
              type="date"
              value={fromDate}
              w={170}
              onChange={(event) => setFromDate(event.currentTarget.value)}
            />
            <TextInput
              label={t('До якої дати')}
              type="date"
              value={toDate}
              w={170}
              onChange={(event) => setToDate(event.currentTarget.value)}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <DataTableDensityToggle density={density} onToggle={toggleDensity} size={34} />
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} size={34} variant="light" onClick={reload}>
                  <RefreshCw size={18} />
                </ActionIcon>
              </Tooltip>
            </div>
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!canManageRoadLists || !companyCar?.NetUid}
              leftSection={<Plus size={16} />}
              size="sm"
              styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
              onClick={openCreateForm}
            >
              {t('Створення шляхового листа')}
            </Button>
          </Group>
        </div>

        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {filterError && (
          <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
            {filterError}
          </Alert>
        )}

        <div className="company-car-road-lists-page__table">
          <DataTable
            columns={columns}
            data={roadLists}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText={t('Шляхових листів не знайдено')}
            getRowId={(roadList, index) => String(roadList.NetUid || roadList.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="company-car-road-lists-1"
            minWidth={1280}
            tableId="company-car-road-lists"
          />
        </div>
      </Card>

      {companyCar && (
        <CompanyCarRoadListFormModal
          companyCar={companyCar}
          opened={isFormOpen || Boolean(editTarget)}
          roadList={editTarget}
          canSave={canManageRoadLists}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}

      <DeleteRoadListModal
        isSaving={isDeleting}
        roadList={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={handleDelete}
      />
    </Stack>
  )
}

function roadListsReducer(
  state: CompanyCarRoadListsState,
  action: CompanyCarRoadListsAction,
): CompanyCarRoadListsState {
  switch (action.type) {
    case 'append-road-list':
      return {
        ...state,
        roadLists: [...state.roadLists, action.roadList],
      }
    case 'delete-road-list':
      return {
        ...state,
        companyCar: action.companyCar || state.companyCar,
        roadLists: state.roadLists.filter((roadList) => roadList.NetUid !== action.netUid),
      }
    case 'failed':
      return {
        ...state,
        error: action.error,
        isLoading: false,
        roadLists: [],
      }
    case 'invalid-filter':
      return {
        ...state,
        error: null,
        isLoading: false,
        roadLists: [],
      }
    case 'missing-company-car':
      return {
        companyCar: null,
        error: null,
        isLoading: false,
        roadLists: [],
      }
    case 'set-error':
      return {
        ...state,
        error: action.error,
      }
    case 'start-loading':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    case 'upsert-road-list': {
      const roadListIndex = state.roadLists.findIndex((roadList) => isSameRoadList(roadList, action.roadList))

      if (roadListIndex === -1) {
        return {
          ...state,
          companyCar: action.companyCar || state.companyCar,
          roadLists: [...state.roadLists, action.roadList],
        }
      }

      return {
        ...state,
        companyCar: action.companyCar || state.companyCar,
        roadLists: state.roadLists.map((roadList, index) => (index === roadListIndex ? action.roadList : roadList)),
      }
    }
    case 'loaded':
      return {
        companyCar: action.companyCar,
        error: null,
        isLoading: false,
        roadLists: action.roadLists,
      }
    default:
      return state
  }
}

function useRoadListColumns({
  canManage,
  onDelete,
  onEdit,
}: {
  canManage: boolean
  onDelete: (roadList: CompanyCarRoadList) => void
  onEdit: (roadList: CompanyCarRoadList) => void
}): DataTableColumn<CompanyCarRoadList>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<CompanyCarRoadList>[]>(
    () => [
      {
        id: 'created',
        header: t('Дата створення'),
        width: 150,
        minWidth: 130,
        accessor: (roadList) => roadList.Created,
        cell: (roadList) => formatDateTime(roadList.Created),
      },
      {
        id: 'mileage',
        header: t('Показники одометра'),
        width: 170,
        minWidth: 130,
        align: 'right',
        accessor: (roadList) => roadList.Mileage,
        cell: (roadList) => formatNumber(roadList.Mileage),
      },
      {
        id: 'fuelAmount',
        header: t('Кількість пального'),
        width: 170,
        minWidth: 130,
        align: 'right',
        accessor: (roadList) => roadList.FuelAmount,
        cell: (roadList) => formatNumber(roadList.FuelAmount),
      },
      {
        id: 'drivers',
        header: t('Кому видано'),
        minWidth: 200,
        enableSorting: false,
        accessor: (roadList) => getDriversLabel(roadList),
        cell: (roadList) => displayValue(getDriversLabel(roadList)),
      },
      {
        id: 'inCityKilometers',
        header: t('По місту'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (roadList) => roadList.InCityKilometers,
        cell: (roadList) => formatNumber(roadList.InCityKilometers),
      },
      {
        id: 'outsideCityKilometers',
        header: t('За містом'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (roadList) => roadList.OutsideCityKilometers,
        cell: (roadList) => formatNumber(roadList.OutsideCityKilometers),
      },
      {
        id: 'mixedModeKilometers',
        header: t('Змішаний режим'),
        width: 180,
        minWidth: 140,
        align: 'right',
        accessor: (roadList) => roadList.MixedModeKilometers,
        cell: (roadList) => formatNumber(roadList.MixedModeKilometers),
      },
      {
        id: 'totalKilometers',
        header: t('Загальний кілометраж'),
        width: 190,
        minWidth: 150,
        align: 'right',
        accessor: (roadList) => roadList.TotalKilometers,
        cell: (roadList) => formatNumber(roadList.TotalKilometers),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        minWidth: 180,
        accessor: (roadList) => roadList.Responsible?.LastName,
        cell: (roadList) => displayValue(roadList.Responsible?.LastName),
      },
      {
        id: 'actions',
        header: '',
        width: 92,
        minWidth: 88,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (roadList) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <TableRowAction
              action="edit"
              disabled={!canManage || (!roadList.NetUid && !roadList.Id)}
              label={t('Редагувати')}
              onClick={(event) => {
                event.stopPropagation()
                onEdit(roadList)
              }}
            />
            <TableRowAction
              action="delete"
              disabled={!canManage || !roadList.NetUid}
              label={t('Видалити')}
              onClick={(event) => {
                event.stopPropagation()
                onDelete(roadList)
              }}
            />
          </Group>
        ),
      },
    ],
    [canManage, onDelete, onEdit, t],
  )
}

function DeleteRoadListModal({
  isSaving,
  onClose,
  onDelete,
  roadList,
}: {
  isSaving: boolean
  onClose: () => void
  onDelete: () => void
  roadList: CompanyCarRoadList | null
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(roadList)} title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Видалити шляховий лист')}</span>} onClose={onClose}>
      <Stack gap="md">
        <Text>{t('Шляховий лист буде видалено.')}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<Trash2 size={16} />} loading={isSaving} onClick={onDelete}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function getDriversLabel(roadList: CompanyCarRoadList): string {
  return (roadList.CompanyCarRoadListDrivers || [])
    .map((driver) => driver.User?.LastName)
    .filter((lastName): lastName is string => Boolean(lastName))
    .join(' ')
}

function shiftDay(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function getDateRangeError(fromDate: string, toDate: string): string | null {
  if (!fromDate || !toDate) {
    return 'Вкажіть період'
  }

  if (fromDate > toDate) {
    return 'Дата початку не може бути пізніше дати завершення'
  }

  return null
}

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}

function isSameRoadList(left: CompanyCarRoadList, right: CompanyCarRoadList): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  return typeof left.Id === 'number' && typeof right.Id === 'number' && left.Id === right.Id
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
