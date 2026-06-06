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
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconPencil, IconPlus, IconRefresh, IconRoad, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { getCompanyCars, searchCompanyCars } from '../api/companyCarsApi'
import { COMPANY_CAR_CREATE_PERMISSION } from '../permissions'
import type { CompanyCar } from '../types'

const COMPANY_CARS_PATH = '/accounting/company-cars'
const SEARCH_DEBOUNCE_MS = 350

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['carBrand'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type CompanyCarsPageState = {
  companyCars: CompanyCar[]
  error: string | null
  isLoading: boolean
}

type CompanyCarsPageAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; companyCars: CompanyCar[] }
  | { type: 'start-loading' }

const initialCompanyCarsPageState: CompanyCarsPageState = {
  companyCars: [],
  error: null,
  isLoading: true,
}

export function CompanyCarsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [pageState, dispatchPageState] = useReducer(companyCarsPageReducer, initialCompanyCarsPageState)
  const { companyCars, error, isLoading } = pageState
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isSearchSettling

  const openEditor = useCallback(
    (companyCar: CompanyCar) => {
      if (!companyCar.NetUid) {
        return
      }

      navigate(`${COMPANY_CARS_PATH}/edit/${companyCar.NetUid}`, {
        state: {
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

  const openRoadLists = useCallback(
    (companyCar: CompanyCar) => {
      if (!companyCar.NetUid) {
        return
      }

      navigate(`${COMPANY_CARS_PATH}/${companyCar.NetUid}/road-lists`, {
        state: {
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

  const columns = useCompanyCarColumns({ onEdit: openEditor, onRoadLists: openRoadLists })

  useEffect(() => {
    const controller = new AbortController()

    async function loadCompanyCars() {
      dispatchPageState({ type: 'start-loading' })

      try {
        const nextCompanyCars = normalizedSearchValue
          ? await searchCompanyCars(normalizedSearchValue)
          : await getCompanyCars()

        if (!controller.signal.aborted) {
          dispatchPageState({ companyCars: nextCompanyCars, type: 'loaded' })
        }
      } catch (loadError) {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          dispatchPageState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити автомобілі компанії'),
            type: 'failed',
          })
        }
      }
    }

    void loadCompanyCars()

    return () => controller.abort()
  }, [normalizedSearchValue, reloadKey, t])

  const toolbarLeft = useMemo(
    () => (
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder={t('Місце вводу для пошуку')}
        value={searchValue}
        w={{ base: '100%', sm: 360 }}
        onChange={(event) => setSearchValue(event.currentTarget.value)}
      />
    ),
    [searchValue, setSearchValue, t],
  )

  return (
    <Stack gap="md">
      <PageHeaderActions>
        <Group gap="xs" wrap="nowrap">
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <PermissionGate permissionKey={COMPANY_CAR_CREATE_PERMISSION}>
            <Button
              color={CREATE_ACTION_COLOR}
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                navigate(`${COMPANY_CARS_PATH}/new`, {
                  state: {
                    backgroundLocation: location,
                    returnPath: `${location.pathname}${location.search}`,
                  },
                })
              }
            >
              {t('Завести нову машину компанії')}
            </Button>
          </PermissionGate>
        </Group>
      </PageHeaderActions>

      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Group gap="xs">
            <Badge color="blue" variant="light">
              {t('Автомобілів')}: {companyCars.length}
            </Badge>
          </Group>

          <DataTable
            columns={columns}
            data={companyCars}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Автомобілів не знайдено')}
            getRowId={(companyCar, index) => String(companyCar.NetUid || companyCar.Id || index)}
            isLoading={isTableBusy}
            layoutVersion="company-cars-1"
            minWidth={1180}
            tableId="company-cars"
            toolbarLeft={toolbarLeft}
            onRowClick={openEditor}
          />
        </Stack>
      </Card>
    </Stack>
  )
}

function companyCarsPageReducer(state: CompanyCarsPageState, action: CompanyCarsPageAction): CompanyCarsPageState {
  switch (action.type) {
    case 'failed':
      return {
        companyCars: [],
        error: action.error,
        isLoading: false,
      }
    case 'loaded':
      return {
        companyCars: action.companyCars,
        error: null,
        isLoading: false,
      }
    case 'start-loading':
      return {
        ...state,
        error: null,
        isLoading: true,
      }
    default:
      return state
  }
}

function useCompanyCarColumns({
  onEdit,
  onRoadLists,
}: {
  onEdit: (companyCar: CompanyCar) => void
  onRoadLists: (companyCar: CompanyCar) => void
}): DataTableColumn<CompanyCar>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<CompanyCar>[]>(
    () => [
      {
        id: 'carBrand',
        header: t('Марка автомобіля'),
        minWidth: 180,
        accessor: (companyCar) => companyCar.CarBrand,
        cell: (companyCar) => <Text fw={600}>{displayValue(companyCar.CarBrand)}</Text>,
      },
      {
        id: 'licensePlate',
        header: t('№ Авто'),
        width: 150,
        minWidth: 120,
        accessor: (companyCar) => companyCar.LicensePlate,
        cell: (companyCar) => displayValue(companyCar.LicensePlate),
      },
      {
        id: 'fuelAmount',
        header: t('Кількість пального'),
        width: 180,
        minWidth: 140,
        align: 'right',
        accessor: (companyCar) => companyCar.FuelAmount,
        cell: (companyCar) => formatNumber(companyCar.FuelAmount),
      },
      {
        id: 'tankCapacity',
        header: t('Вмістимість баку'),
        width: 170,
        minWidth: 130,
        align: 'right',
        accessor: (companyCar) => companyCar.TankCapacity,
        cell: (companyCar) => formatNumber(companyCar.TankCapacity),
      },
      {
        id: 'inCityConsumption',
        header: t('Розхід по місту на 100 км'),
        width: 200,
        minWidth: 150,
        align: 'right',
        accessor: (companyCar) => companyCar.InCityConsumption,
        cell: (companyCar) => formatNumber(companyCar.InCityConsumption),
      },
      {
        id: 'outsideCityConsumption',
        header: t('Розхід по трасі на 100 км'),
        width: 220,
        minWidth: 160,
        align: 'right',
        accessor: (companyCar) => companyCar.OutsideCityConsumption,
        cell: (companyCar) => formatNumber(companyCar.OutsideCityConsumption),
      },
      {
        id: 'mixedModeConsumption',
        header: t('Змішаний розхід'),
        width: 170,
        minWidth: 130,
        align: 'right',
        accessor: (companyCar) => companyCar.MixedModeConsumption,
        cell: (companyCar) => formatNumber(companyCar.MixedModeConsumption),
      },
      {
        id: 'mileage',
        header: t('Показники одометра'),
        width: 170,
        minWidth: 130,
        align: 'right',
        accessor: (companyCar) => companyCar.Mileage,
        cell: (companyCar) => formatNumber(companyCar.Mileage),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 200,
        minWidth: 140,
        accessor: (companyCar) => companyCar.Organization?.Name,
        cell: (companyCar) => displayValue(companyCar.Organization?.Name),
      },
      {
        id: 'actions',
        header: '',
        width: 110,
        minWidth: 100,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (companyCar) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Tooltip label={t('Шляхові листи автомобіля')}>
              <ActionIcon
                aria-label={t('Шляхові листи автомобіля')}
                color="gray"
                disabled={!companyCar.NetUid}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onRoadLists(companyCar)
                }}
              >
                <IconRoad size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color="violet"
                disabled={!companyCar.NetUid}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit(companyCar)
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [onEdit, onRoadLists, t],
  )
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
