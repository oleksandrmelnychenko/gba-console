import { ActionIcon, Alert, Badge, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import type { EditingItemsResponse, EditingActItem } from '../types'
import { displayValue, formatDateTime, getDateShiftedByDays, toDateString } from './dateHelpers'

const PAGE_SIZE = 20

type FilterDraft = {
  from: string
  to: string
}

type EditingListProps = {
  tableId: string
  layoutVersion: string
  loader: (params: {
    from: string
    to: string
    limit: number
    offset: number
    isDevelopment: boolean
  }) => Promise<EditingItemsResponse>
}

export function EditingList({ layoutVersion, loader, tableId }: EditingListProps) {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0) }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [items, setItems] = useValueState<EditingActItem[]>([])
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const itemIndexMap = useMemo(() => buildIndexMap(items), [items])

  useEffect(() => {
    if (filterError) {
      setItems([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadItems() {
      setLoading(true)
      setError(null)

      try {
        const result = await loader({
          from: toDateString(activeFilters.from),
          to: toDateString(activeFilters.to),
          limit: PAGE_SIZE,
          offset: 0,
          isDevelopment: false,
        })

        if (!cancelled) {
          setItems(result.items)
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [activeFilters, filterError, loader, reloadKey, setError, setItems, setLoading, t])

  const columns = useEditingColumns(itemIndexMap)

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  return (
    <Stack gap="md">
      <Group align="end" gap="sm" wrap="wrap">
        <TextInput
          label={t('Початкова дата')}
          max={filterDraft.to || undefined}
          type="date"
          value={filterDraft.from}
          onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
        />
        <TextInput
          label={t('Кінцева дата')}
          min={filterDraft.from || undefined}
          type="date"
          value={filterDraft.to}
          onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
        />
        <Tooltip label={t('Скинути')}>
          <ActionIcon aria-label={t('Скинути')} color="gray" size={36} variant="light" onClick={resetFilters}>
            <IconRestore size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('Оновити')}>
          <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={36} variant="light" onClick={() => reload()}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {(error || filterError) && (
        <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
          {filterError || error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={items}
        emptyText={t('Даних не знайдено')}
        getRowId={(item, index) => String(item.NetUid || item.Id || index)}
        isLoading={isLoading}
        layoutVersion={layoutVersion}
        maxHeight="calc(100vh - 480px)"
        minWidth={920}
        tableId={tableId}
      />
    </Stack>
  )
}

function useEditingColumns(indexMap: Map<EditingActItem, number>) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<EditingActItem>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        width: 52,
        minWidth: 44,
        align: 'right',
        enableSorting: false,
        accessor: (item) => indexMap.get(item) || 0,
        cell: (item) => (
          <Text c="dimmed" size="sm">
            {indexMap.get(item) || ''}
          </Text>
        ),
      },
      {
        id: 'updateDate',
        header: t('Дата редагування'),
        width: 170,
        minWidth: 140,
        accessor: (item) => item.Created,
        cell: (item) => <Text fw={600}>{formatDateTime(item.Created)}</Text>,
      },
      {
        id: 'number',
        header: t('Номер ВН'),
        width: 200,
        minWidth: 150,
        accessor: (item) => item.Sale?.SaleNumber?.Value,
        cell: (item) => <Text fw={700}>{displayValue(item.Sale?.SaleNumber?.Value)}</Text>,
      },
      {
        id: 'buyer',
        header: t('Покупець'),
        minWidth: 240,
        accessor: (item) => buildBuyer(item),
        cell: (item) => (
          <Text size="sm" lineClamp={2}>
            {displayValue(buildBuyer(item))}
          </Text>
        ),
      },
      {
        id: 'isPrinted',
        header: t('Роздруковано'),
        width: 140,
        minWidth: 110,
        accessor: (item) => item.Sale?.IsPrinted,
        cell: (item) =>
          item.Sale?.IsPrinted ? (
            <Badge color="teal" variant="light">
              {t('Так')}
            </Badge>
          ) : (
            '-'
          ),
      },
      {
        id: 'processed',
        header: t('Опрацьовано'),
        width: 150,
        minWidth: 120,
        accessor: (item) => item.ApproveUpdate,
        cell: (item) =>
          item.ApproveUpdate ? (
            <Badge color="blue" variant="light">
              {t('Так')}
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              {t('Ні')}
            </Badge>
          ),
      },
    ],
    [indexMap, t],
  )
}

function buildBuyer(item: EditingActItem): string {
  const client = item.Sale?.ClientAgreement?.Client
  const region = client?.RegionCode?.Value ? `${client.RegionCode.Value} ` : ''

  return `${region}${client?.FullName || ''}`.trim()
}

function buildIndexMap(items: EditingActItem[]): Map<EditingActItem, number> {
  return items.reduce((indexMap, item, index) => {
    indexMap.set(item, index + 1)

    return indexMap
  }, new Map<EditingActItem, number>())
}

function getFilterError(from: string, to: string): string | null {
  if (!from || !to) {
    return translate('Вкажіть дату початку та дату завершення')
  }

  if (from > to) {
    return translate('Дата початку не може бути пізнішою за дату завершення')
  }

  return null
}
