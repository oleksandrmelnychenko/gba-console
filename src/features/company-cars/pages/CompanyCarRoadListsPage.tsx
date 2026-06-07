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
import { IconAlertCircle, IconArrowLeft, IconPencil, IconPlus, IconRefresh, IconRestore, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { formatDateInputForQuery, formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  deleteCompanyCarRoadList,
  getCompanyCar,
  getCompanyCarRoadLists,
} from '../api/companyCarsApi'
import { CompanyCarRoadListFormModal } from '../components/CompanyCarRoadListFormModal'
import type { CompanyCar, CompanyCarRoadList } from '../types'

const COMPANY_CARS_PATH = '/accounting/company-cars'
const DEFAULT_LOOKBACK_MONTHS = 36

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
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id?: string }>()
  const locationState = location.state as { returnPath?: string } | null
  const returnPath = locationState?.returnPath || COMPANY_CARS_PATH
  const [loadState, dispatchLoadState] = useReducer(roadListsReducer, initialRoadListsState)
  const { companyCar, error, isLoading, roadLists } = loadState
  const [fromDate, setFromDate] = useValueState(() => shiftMonth(-DEFAULT_LOOKBACK_MONTHS))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [isFormOpen, setFormOpen] = useValueState(false)
  const [editTarget, setEditTarget] = useValueState<CompanyCarRoadList | null>(null)
  const [deleteTarget, setDeleteTarget] = useValueState<CompanyCarRoadList | null>(null)
  const [isDeleting, setDeleting] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const { density, toggleDensity } = useDataTableDensity('company-car-road-lists', TABLE_DEFAULT_LAYOUT.density)
  const filterError = getDateRangeError(fromDate, toDate)

  const columns = useRoadListColumns({ onDelete: setDeleteTarget, onEdit: setEditTarget })

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
    setEditTarget(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditTarget(null)
  }

  async function handleDelete() {
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
    setFromDate(shiftMonth(-DEFAULT_LOOKBACK_MONTHS))
    setToDate(formatLocalDate(new Date()))
  }

  return (
    <Stack gap="md">
      <PageHeaderActions>
        <Button
          color={CREATE_ACTION_COLOR}
          size="sm"
          disabled={!companyCar?.NetUid}
          leftSection={<IconPlus size={16} />}
          onClick={openCreateForm}
        >
          {t('Створення шляхового листа')}
        </Button>
      </PageHeaderActions>

      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="flex-end" wrap="wrap">
            <Group gap="xs">
              <Button color="gray" leftSection={<IconArrowLeft size={16} />} variant="light" onClick={() => navigate(returnPath)}>
                {t('Назад')}
              </Button>
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>

          <Group align="end" gap="sm" wrap="wrap">
            <TextInput label={t('Від якої дати')} type="date" value={fromDate} onChange={(event) => setFromDate(event.currentTarget.value)} />
            <TextInput label={t('До якої дати')} type="date" value={toDate} onChange={(event) => setToDate(event.currentTarget.value)} />
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
            <DataTableDensityToggle density={density} onToggle={toggleDensity} size={36} />
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          {filterError && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
              {filterError}
            </Alert>
          )}

          <Group gap="xs">
            <Badge color="violet" variant="light">
              {t('Шляхових листів')}: {roadLists.length}
            </Badge>
          </Group>

          <DataTable
            columns={columns}
            data={roadLists}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText={t('Шляхових листів не знайдено')}
            getRowId={(roadList, index) => String(roadList.NetUid || roadList.Id || index)}
            isLoading={isLoading}
            layoutVersion="company-car-road-lists-1"
            minWidth={1280}
            tableId="company-car-road-lists"
          />
        </Stack>
      </Card>

      {companyCar && (
        <CompanyCarRoadListFormModal
          companyCar={companyCar}
          opened={isFormOpen || Boolean(editTarget)}
          roadList={editTarget}
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
  onDelete,
  onEdit,
}: {
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
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                disabled={!roadList.NetUid && !roadList.Id}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit(roadList)
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={!roadList.NetUid}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(roadList)
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [onDelete, onEdit, t],
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
    <AppModal centered opened={Boolean(roadList)} title={t('Видалити шляховий лист')} onClose={onClose}>
      <Stack gap="md">
        <Text>{t('Шляховий лист буде видалено.')}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={onDelete}>
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

function shiftMonth(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() + months)

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
    return '—'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
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
