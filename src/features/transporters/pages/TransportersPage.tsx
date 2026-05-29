import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArchive,
  IconPhoto,
  IconRefresh,
  IconTruckDelivery,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  archiveTransporter,
  getArchivedTransportersByType,
  getTransportersByType,
  getTransporterTypes,
} from '../api/transportersApi'
import type { Transporter, TransporterType } from '../types'

const TRANSPORTERS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'icon', 'name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const archiveDisabledCssClass = 'self_checkout_item_class'

type TransporterStatusFilter = 'active' | 'all' | 'archived'

export function TransportersPage() {
  const { t } = useI18n()
  const [transporterTypes, setTransporterTypes] = useValueState<TransporterType[]>([])
  const [selectedTypeNetId, setSelectedTypeNetId] = useValueState<string | null>(null)
  const [transporters, setTransporters] = useValueState<Transporter[]>([])
  const [statusFilter, setStatusFilter] = useValueState<TransporterStatusFilter>('active')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoadingTypes, setLoadingTypes] = useValueState(true)
  const [isLoadingTransporters, setLoadingTransporters] = useValueState(false)
  const [isArchiving, setArchiving] = useValueState(false)
  const [archiveTarget, setArchiveTarget] = useValueState<Transporter | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const usableTransporterTypes = useMemo(
    () => transporterTypes.filter((transporterType) => Boolean(transporterType.NetUid)),
    [transporterTypes],
  )
  const selectedTransporterType = useMemo(
    () => transporterTypes.find((transporterType) => transporterType.NetUid === selectedTypeNetId) || null,
    [selectedTypeNetId, transporterTypes],
  )
  const visibleTransporters = useMemo(
    () =>
      transporters.filter((transporter) => {
        if (statusFilter === 'all') {
          return true
        }

        return statusFilter === 'archived' ? transporter.Deleted === true : transporter.Deleted !== true
      }),
    [statusFilter, transporters],
  )
  const columns = useTransporterColumns(selectedTransporterType, setArchiveTarget)
  const tableToolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {visibleTransporters.length} {t('з')} {transporters.length}
        {selectedTransporterType ? `, ${t('тип')}: ${getTransporterTypeName(selectedTransporterType)}` : ''}
      </Text>
    ),
    [selectedTransporterType, t, transporters.length, visibleTransporters.length],
  )
  const tableToolbarRight = useMemo(
    () => (
      <Group gap={6} wrap="nowrap">
        <Select
          aria-label={t('Фільтр статусу')}
          data={[
            { value: 'active', label: t('Активні') },
            { value: 'all', label: t('Усі') },
            { value: 'archived', label: t('Архів') },
          ]}
          size="xs"
          value={statusFilter}
          w={112}
          onChange={(value) => setStatusFilter((value as TransporterStatusFilter | null) || 'active')}
        />
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={isLoadingTypes || isLoadingTransporters}
            size="sm"
            variant="subtle"
            onClick={() => reload()}
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
    [isLoadingTransporters, isLoadingTypes, setStatusFilter, statusFilter, t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadTransporterTypes() {
      setLoadingTypes(true)
      setError(null)

      try {
        const nextTransporterTypes = await getTransporterTypes()

        if (!cancelled) {
          setTransporterTypes(nextTransporterTypes)
          setSelectedTypeNetId((currentTypeNetId) => {
            if (
              currentTypeNetId &&
              nextTransporterTypes.some((transporterType) => transporterType.NetUid === currentTypeNetId)
            ) {
              return currentTypeNetId
            }

            return nextTransporterTypes.find((transporterType) => transporterType.NetUid)?.NetUid || null
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setTransporterTypes([])
          setSelectedTypeNetId(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити типи перевізників'))
        }
      } finally {
        if (!cancelled) {
          setLoadingTypes(false)
        }
      }
    }

    void loadTransporterTypes()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setError, setLoadingTypes, setSelectedTypeNetId, setTransporterTypes, t])

  useEffect(() => {
    let cancelled = false

    async function loadTransporters() {
      if (!selectedTypeNetId) {
        setTransporters([])
        setLoadingTransporters(false)
        return
      }

      setLoadingTransporters(true)
      setError(null)

      try {
        const nextTransporters = await getTransportersByStatus(selectedTypeNetId, statusFilter)

        if (!cancelled) {
          setTransporters(nextTransporters)
        }
      } catch (loadError) {
        if (!cancelled) {
          setTransporters([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити перевізників'))
        }
      } finally {
        if (!cancelled) {
          setLoadingTransporters(false)
        }
      }
    }

    void loadTransporters()

    return () => {
      cancelled = true
    }
  }, [reloadKey, selectedTypeNetId, setError, setLoadingTransporters, setTransporters, statusFilter, t])

  async function handleArchiveTransporter() {
    if (!archiveTarget?.NetUid || !canArchiveTransporter(archiveTarget)) {
      setArchiveTarget(null)
      return
    }

    setArchiving(true)
    setError(null)

    try {
      await archiveTransporter(archiveTarget.NetUid)
      setTransporters((currentTransporters) =>
        currentTransporters.map((transporter) =>
          transporter.NetUid === archiveTarget.NetUid
            ? {
                ...transporter,
                Deleted: true,
              }
            : transporter,
        ),
      )
      notifications.show({
        color: 'green',
        message: t('Перевізника архівовано'),
      })
      setArchiveTarget(null)
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : t('Не вдалося архівувати перевізника'))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" gap="sm" wrap="nowrap" align="center">
            {usableTransporterTypes.length > 0 ? (
              <div className="pill-tabs">
                {usableTransporterTypes.map((transporterType) => {
                  const value = transporterType.NetUid || ''
                  return (
                    <button
                      key={transporterType.NetUid}
                      type="button"
                      className={`pill-tab${selectedTypeNetId === value ? ' is-active' : ''}`}
                      aria-pressed={selectedTypeNetId === value}
                      onClick={() => setSelectedTypeNetId(value)}
                    >
                      {getTransporterTypeName(transporterType)}
                    </button>
                  )
                })}
              </div>
            ) : isLoadingTypes ? (
              <Text c="dimmed" size="sm">
                {t('Завантаження типів перевізників')}
              </Text>
            ) : (
              <Text c="dimmed" size="sm">
                {t('Типів перевізників не знайдено')}
              </Text>
            )}
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoadingTypes || isLoadingTransporters}
                size={36}
                variant="light"
                onClick={() => reload()}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={visibleTransporters}
            defaultLayout={TRANSPORTERS_TABLE_DEFAULT_LAYOUT}
            emptyText={isLoadingTypes ? t('Завантаження типів перевізників') : selectedTypeNetId ? t('Перевізників не знайдено') : t('Оберіть тип перевізника')}
            getRowId={(transporter, index) => String(transporter.NetUid || transporter.Id || index)}
            isLoading={isLoadingTypes || isLoadingTransporters}
            layoutVersion="transporters-table-1"
            loadingText={t('Завантаження перевізників')}
            maxHeight="calc(100vh - 320px)"
            minWidth={1000}
            tableId="transporters"
            toolbarLeft={tableToolbarLeft}
            toolbarRight={tableToolbarRight}
          />
        </Stack>
      </Card>

      <AppModal
        centered
        opened={Boolean(archiveTarget)}
        title={t('Архівувати перевізника')}
        onClose={() => setArchiveTarget(null)}
      >
        <Stack gap="md">
          <Text>
            {archiveTarget
              ? t('Перевізник "{name}" буде прибраний з активного списку.', { name: getTransporterName(archiveTarget) })
              : ''}
          </Text>
          <Group justify="flex-end">
            <Button color="gray" variant="subtle" onClick={() => setArchiveTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" loading={isArchiving} onClick={handleArchiveTransporter}>
              {t('Архівувати')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function TransporterIcon({ transporter }: { transporter: Transporter }) {
  if (transporter.ImageUrl) {
    return (
      <Avatar radius="sm" size={34} src={transporter.ImageUrl}>
        <IconPhoto size={18} />
      </Avatar>
    )
  }

  return (
    <ThemeIcon color="gray" radius="sm" size={34} variant="light">
      <IconTruckDelivery size={18} />
    </ThemeIcon>
  )
}

function useTransporterColumns(
  selectedTransporterType: TransporterType | null,
  setArchiveTarget: (transporter: Transporter) => void,
): DataTableColumn<Transporter>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<Transporter>[]>(
    () => [
      {
        id: 'status',
        header: 'Статус',
        width: 116,
        minWidth: 104,
        accessor: (transporter) => (transporter.Deleted ? t('Архів') : t('Активний')),
        cell: (transporter) => (
          <Badge color={transporter.Deleted ? 'gray' : 'green'} variant="light">
            {transporter.Deleted ? t('Архів') : t('Активний')}
          </Badge>
        ),
      },
      {
        id: 'icon',
        header: 'Іконка',
        width: 86,
        minWidth: 78,
        align: 'center',
        accessor: (transporter) => transporter.ImageUrl || transporter.CssClass,
        cell: (transporter) => <TransporterIcon transporter={transporter} />,
      },
      {
        id: 'name',
        header: 'Назва',
        width: 260,
        minWidth: 220,
        accessor: getTransporterName,
        cell: (transporter) => (
          <Text fw={600}>{getTransporterName(transporter)}</Text>
        ),
      },
      {
        id: 'type',
        header: 'Тип',
        width: 180,
        minWidth: 140,
        accessor: (transporter) => transporter.TransporterType?.Name || selectedTransporterType?.Name,
        cell: (transporter) =>
          displayValue(transporter.TransporterType?.Name || selectedTransporterType?.Name),
      },
      {
        id: 'cssClass',
        header: 'CSS клас',
        width: 220,
        minWidth: 160,
        accessor: (transporter) => transporter.CssClass,
        cell: (transporter) => displayValue(transporter.CssClass),
      },
      {
        id: 'priority',
        header: 'Пріоритет',
        width: 120,
        minWidth: 104,
        align: 'right',
        accessor: (transporter) => transporter.Priority,
        cell: (transporter) => displayValue(transporter.Priority),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (transporter) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={getArchiveTooltip(transporter)}>
              <ActionIcon
                aria-label={t('Архівувати')}
                color="red"
                disabled={!canArchiveTransporter(transporter)}
                variant="subtle"
                onClick={() => setArchiveTarget(transporter)}
              >
                <IconArchive size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [selectedTransporterType?.Name, setArchiveTarget, t],
  )
}

function getTransporterName(transporter: Transporter): string {
  return transporter.Name?.trim() || translate('Без назви')
}

function getTransporterTypeName(transporterType: TransporterType): string {
  return transporterType.Name?.trim() || translate('Без назви')
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  const normalized = value?.trim()
  return normalized || '-'
}

function canArchiveTransporter(transporter: Transporter): boolean {
  return Boolean(
    transporter.NetUid &&
      transporter.Deleted !== true &&
      transporter.CssClass !== archiveDisabledCssClass,
  )
}

async function getTransportersByStatus(
  transporterTypeNetId: string,
  statusFilter: TransporterStatusFilter,
): Promise<Transporter[]> {
  if (statusFilter === 'archived') {
    return markArchivedTransporters(await getArchivedTransportersByType(transporterTypeNetId))
  }

  if (statusFilter === 'all') {
    const [activeTransporters, archivedTransporters] = await Promise.all([
      getTransportersByType(transporterTypeNetId),
      getArchivedTransportersByType(transporterTypeNetId),
    ])

    return mergeTransporters(activeTransporters, markArchivedTransporters(archivedTransporters))
  }

  return getTransportersByType(transporterTypeNetId)
}

function markArchivedTransporters(transporters: Transporter[]): Transporter[] {
  return transporters.map((transporter) => ({
    ...transporter,
    Deleted: true,
  }))
}

function mergeTransporters(activeTransporters: Transporter[], archivedTransporters: Transporter[]): Transporter[] {
  const transporterByKey = new Map<string, Transporter>()

  activeTransporters.forEach((transporter, index) => {
    transporterByKey.set(getTransporterKey(transporter, index), transporter)
  })
  archivedTransporters.forEach((transporter, index) => {
    transporterByKey.set(getTransporterKey(transporter, index + activeTransporters.length), transporter)
  })

  return Array.from(transporterByKey.values())
}

function getTransporterKey(transporter: Transporter, fallbackIndex: number): string {
  return transporter.NetUid || String(transporter.Id || fallbackIndex)
}

function getArchiveTooltip(transporter: Transporter): string {
  if (transporter.Deleted) {
    return translate('Вже в архіві')
  }

  if (transporter.CssClass === archiveDisabledCssClass) {
    return translate('Архівація недоступна')
  }

  return translate('Архівувати')
}
