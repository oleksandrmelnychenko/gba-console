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
import { IconAlertCircle, IconArrowLeft, IconPlus, IconRefresh, IconRestore, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  deleteCompanyCarRoadList,
  getCompanyCar,
  getCompanyCarRoadLists,
} from '../api/companyCarsApi'
import { CompanyCarRoadListFormModal } from '../components/CompanyCarRoadListFormModal'
import type { CompanyCar, CompanyCarRoadList } from '../types'

const COMPANY_CARS_PATH = '/accounting/company-cars'

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

export function CompanyCarRoadListsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id?: string }>()
  const locationState = location.state as { returnPath?: string } | null
  const returnPath = locationState?.returnPath || COMPANY_CARS_PATH
  const [companyCar, setCompanyCar] = useValueState<CompanyCar | null>(null)
  const [roadLists, setRoadLists] = useValueState<CompanyCarRoadList[]>([])
  const [fromDate, setFromDate] = useValueState(() => shiftDate(-7))
  const [toDate, setToDate] = useValueState(() => formatLocalDate(new Date()))
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isFormOpen, setFormOpen] = useValueState(false)
  const [deleteTarget, setDeleteTarget] = useValueState<CompanyCarRoadList | null>(null)
  const [isDeleting, setDeleting] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const columns = useRoadListColumns(setDeleteTarget)

  useEffect(() => {
    if (!id) {
      setCompanyCar(null)
      setRoadLists([])
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadResources(companyCarNetId: string) {
      setLoading(true)
      setError(null)

      try {
        const nextCompanyCar = await getCompanyCar(companyCarNetId)
        const nextRoadLists = await getCompanyCarRoadLists({
          companyCarNetId,
          from: toLegacyDateString(fromDate),
          to: toLegacyDateString(toDate),
        })

        if (!controller.signal.aborted) {
          setCompanyCar(nextCompanyCar)
          setRoadLists(nextRoadLists)
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setRoadLists([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити шляхові листи'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadResources(id)

    return () => controller.abort()
  }, [fromDate, id, reloadKey, setCompanyCar, setError, setLoading, setRoadLists, t, toDate])

  const handleCreated = useCallback(
    (roadList: CompanyCarRoadList) => {
      setRoadLists((current) => [...current, roadList])
      setFormOpen(false)
      notifications.show({ color: 'green', message: t('Шляховий лист створено') })
    },
    [setFormOpen, setRoadLists, t],
  )

  async function handleDelete() {
    if (!deleteTarget?.NetUid) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteCompanyCarRoadList(deleteTarget.NetUid)
      setRoadLists((current) => current.filter((roadList) => roadList.NetUid !== deleteTarget.NetUid))
      notifications.show({ color: 'green', message: t('Шляховий лист видалено') })
      setDeleteTarget(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити шляховий лист'))
    } finally {
      setDeleting(false)
    }
  }

  function resetFilters() {
    setFromDate(shiftDate(-7))
    setToDate(formatLocalDate(new Date()))
  }

  const title = companyCar
    ? `${t('Шляхові листи автомобіля')} ${companyCar.LicensePlate || ''} ${companyCar.CarBrand || ''}`.trim()
    : t('Шляхові листи автомобіля')

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Text fw={700} size="xl">
              {title}
            </Text>

            <Group gap="xs">
              <Button color="gray" leftSection={<IconArrowLeft size={16} />} variant="light" onClick={() => navigate(returnPath)}>
                {t('Назад')}
              </Button>
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Button
                color="violet"
                disabled={!companyCar?.NetUid}
                leftSection={<IconPlus size={16} />}
                onClick={() => setFormOpen(true)}
              >
                {t('Створення шляхового листа')}
              </Button>
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
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
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
          opened={isFormOpen}
          onClose={() => setFormOpen(false)}
          onCreated={handleCreated}
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

function useRoadListColumns(onDelete: (roadList: CompanyCarRoadList) => void): DataTableColumn<CompanyCarRoadList>[] {
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
        width: 62,
        minWidth: 58,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (roadList) => (
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
        ),
      },
    ],
    [onDelete, t],
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

function shiftDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)

  return formatLocalDate(date)
}

function toLegacyDateString(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : date.toDateString()
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
