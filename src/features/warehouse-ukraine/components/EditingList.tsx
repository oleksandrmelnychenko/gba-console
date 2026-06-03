import { ActionIcon, Alert, Anchor, Badge, Button, Checkbox, Group, Select, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconCheck, IconRefresh, IconRestore } from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import type { EditingItemsResponse, EditingActItem, WarehouseUkraineUser } from '../types'
import { displayValue, formatDateTime, getDateShiftedByDays, toDateString } from './dateHelpers'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['20', '40', '60', '100']

type FilterDraft = {
  from: string
  to: string
  isDevelopment: boolean
}

type EditingListProps = {
  tableId: string
  kind: 'act' | 'carrier'
  layoutVersion: string
  loader: (params: {
    from: string
    to: string
    limit: number
    offset: number
    isDevelopment: boolean
  }) => Promise<EditingItemsResponse>
  processor: (netId: string) => Promise<void>
  onProcessed?: () => void
}

export function EditingList({ kind, layoutVersion, loader, onProcessed, processor, tableId }: EditingListProps) {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0), isDevelopment: false }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [items, setItems] = useValueState<EditingActItem[]>([])
  const [totalQty, setTotalQty] = useValueState(0)
  const [hasMore, setHasMore] = useValueState(false)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingMore, setLoadingMore] = useValueState(false)
  const [isProcessing, setProcessing] = useValueState(false)
  const [confirmItem, setConfirmItem] = useValueState<EditingActItem | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const itemIndexMap = useMemo(() => buildIndexMap(items), [items])
  const listRequestKey = `${activeFilters.from}|${activeFilters.to}|${activeFilters.isDevelopment}|${pageSize}`
  const listRequestKeyRef = useRef(listRequestKey)

  useEffect(() => {
    listRequestKeyRef.current = listRequestKey
  }, [listRequestKey])

  useEffect(() => {
    if (filterError) {
      setItems([])
      setTotalQty(0)
      setHasMore(false)
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
          limit: pageSize,
          offset: 0,
          isDevelopment: activeFilters.isDevelopment,
        })

        if (!cancelled) {
          setItems(result.items)
          setTotalQty(result.totalQty)
          setHasMore(result.items.length === pageSize)
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setTotalQty(0)
          setHasMore(false)
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
  }, [activeFilters, filterError, loader, pageSize, reloadKey, setError, setHasMore, setItems, setLoading, setTotalQty, t])

  const columns = useEditingColumns({
    indexMap: itemIndexMap,
    kind,
    onProcess: openProcessConfirm,
  })

  async function loadMoreItems() {
    const requestKey = listRequestKeyRef.current
    const requestOffset = items.length
    setLoadingMore(true)
    setError(null)

    try {
      const result = await loader({
        from: toDateString(activeFilters.from),
        to: toDateString(activeFilters.to),
        limit: pageSize,
        offset: requestOffset,
        isDevelopment: activeFilters.isDevelopment,
      })

      if (listRequestKeyRef.current === requestKey) {
        setItems((current) => (current.length === requestOffset ? [...current, ...result.items] : current))
        setTotalQty(result.totalQty)
        setHasMore(result.items.length === pageSize)
      }
    } catch (loadError) {
      if (listRequestKeyRef.current === requestKey) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
      }
    } finally {
      if (listRequestKeyRef.current === requestKey) {
        setLoadingMore(false)
      }
    }
  }

  function applyFilters(nextFilters: FilterDraft) {
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  function openProcessConfirm(item: EditingActItem) {
    if (kind === 'carrier' && !item.Sale?.IsPrinted) {
      setError(t('Накладну не роздруковано'))

      return
    }

    setError(null)
    setConfirmItem(item)
  }

  async function processConfirmedItem() {
    if (!confirmItem?.NetUid) {
      setError(t('Не вдалося визначити запис для обробки'))
      setConfirmItem(null)

      return
    }

    setProcessing(true)
    setError(null)

    try {
      await processor(confirmItem.NetUid)
      setConfirmItem(null)
      reload()
      onProcessed?.()
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : t('Не вдалося виконати запит'))
    } finally {
      setProcessing(false)
    }
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
        <Checkbox
          checked={filterDraft.isDevelopment}
          label={t('Опрацьовані')}
          onChange={(event) => applyFilters({ ...filterDraft, isDevelopment: event.currentTarget.checked })}
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

      <Group justify="space-between" gap="xs">
        <Text c="dimmed" size="xs">
          {t('Показано')} {items.length} / {totalQty}
        </Text>
        <Select
          aria-label={t('Кількість рядків')}
          data={PAGE_SIZE_OPTIONS}
          size="xs"
          value={String(pageSize)}
          w={88}
          onChange={(value) => setPageSize(Number(value || DEFAULT_PAGE_SIZE))}
        />
      </Group>

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

      {hasMore && (
        <Group justify="center">
          <Button color="gray" loading={isLoadingMore} variant="light" onClick={loadMoreItems}>
            {t('Завантажити ще')}
          </Button>
        </Group>
      )}

      <AppModal
        centered
        opened={Boolean(confirmItem)}
        title={kind === 'carrier' ? t('Підтвердити зміну перевізника') : t('Підтвердити обробку акту')}
        onClose={() => setConfirmItem(null)}
      >
        <Stack gap="md">
          <Text size="sm">{t('Після підтвердження запис буде позначено як опрацьований.')}</Text>

          {confirmItem && kind === 'carrier' && <CarrierChangeSummary item={confirmItem} />}

          <Group justify="flex-end" gap="sm">
            <Button color="gray" variant="light" onClick={() => setConfirmItem(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="green" loading={isProcessing} onClick={processConfirmedItem}>
              {t('Підтвердити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

type EditingColumnsModel = {
  indexMap: Map<EditingActItem, number>
  kind: 'act' | 'carrier'
  onProcess: (item: EditingActItem) => void
}

function useEditingColumns({ indexMap, kind, onProcess }: EditingColumnsModel) {
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
        accessor: (item) => item.IsDevelopment,
        cell: (item) => {
          if (item.IsDevelopment) {
            return (
              <Badge color="teal" variant="light">
                {t('Так')}
              </Badge>
            )
          }

          if (item.ApproveUpdate) {
            return (
              <Badge color="yellow" variant="light">
                {t('Очікує')}
              </Badge>
            )
          }

          return (
            <Badge color="gray" variant="light">
              {t('Ні')}
            </Badge>
          )
        },
      },
      {
        id: 'process',
        header: '',
        width: 58,
        minWidth: 52,
        align: 'center',
        enableSorting: false,
        accessor: (item) => canProcessItem(item),
        cell: (item) =>
          canProcessItem(item) ? (
            <Tooltip label={kind === 'carrier' ? t('Підтвердити зміну перевізника') : t('Підтвердити обробку')}>
              <ActionIcon color="green" size="sm" variant="subtle" onClick={() => onProcess(item)}>
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            ''
          ),
      },
    ],
    [indexMap, kind, onProcess, t],
  )
}

function canProcessItem(item: EditingActItem): boolean {
  return !item.IsDevelopment && Boolean(item.ApproveUpdate)
}

function CarrierChangeSummary({ item }: { item: EditingActItem }) {
  const { t } = useI18n()
  const previous = item.Sale?.WarehousesShipment

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      <Stack gap={4}>
        <Text fw={700} size="sm">
          {t('Поточні дані')}
        </Text>
        <SummaryLine label={t('Перевізник')} value={previous?.Transporter?.Name} />
        <SummaryLine label={t('Місто')} value={previous?.City} />
        <SummaryLine label={t('Відділення')} value={previous?.Department} />
        <SummaryLine label={t('Дата відвантаження')} value={formatDateTimeOrEmpty(previous?.ShipmentDate)} />
        <SummaryLine label={t("Повне ім'я")} value={previous?.FullName} />
        <SummaryLine label={t('Мобільний телефон')} value={previous?.MobilePhone} />
        <SummaryLine label={t('Коментар')} value={previous?.Comment} />
        <SummaryLine label={t('Накладений платіж')} value={formatBoolean(t, previous?.IsCashOnDelivery)} />
        <SummaryLine label={t('Сума накладеного платежу')} value={formatAmount(previous?.CashOnDeliveryAmount)} />
        <SummaryLine label={t('Наявність документів')} value={formatBoolean(t, previous?.HasDocument)} />
        <SummaryLine label={t('ТТН')} value={previous?.TTN || previous?.Number} />
        <SummaryLine label={t('Відповідальний')} value={buildUserName(previous?.User)} />
        <SummaryLine label={t('Документ')} value={previous?.TtnPDFPath ?? undefined} link />
      </Stack>
      <Stack gap={4}>
        <Text fw={700} size="sm">
          {t('Нові дані')}
        </Text>
        <SummaryLine label={t('Перевізник')} value={readNestedString(item, ['Transporter', 'Name'])} />
        <SummaryLine label={t('Місто')} value={readStringField(item, 'City')} />
        <SummaryLine label={t('Відділення')} value={readStringField(item, 'Department')} />
        <SummaryLine
          label={t('Дата відвантаження')}
          value={formatDateTimeOrEmpty(readRawValue(item, 'ShipmentDate'))}
        />
        <SummaryLine label={t("Повне ім'я")} value={readStringField(item, 'FullName')} />
        <SummaryLine label={t('Мобільний телефон')} value={readStringField(item, 'MobilePhone')} />
        <SummaryLine label={t('Коментар')} value={readStringField(item, 'Comment')} />
        <SummaryLine label={t('Накладений платіж')} value={formatBoolean(t, readBooleanField(item, 'IsCashOnDelivery'))} />
        <SummaryLine
          label={t('Сума накладеного платежу')}
          value={formatAmount(readNumberField(item, 'CashOnDeliveryAmount'))}
        />
        <SummaryLine label={t('Наявність документів')} value={formatBoolean(t, readBooleanField(item, 'HasDocument'))} />
        <SummaryLine label={t('ТТН')} value={readStringField(item, 'TTN') || readStringField(item, 'Number')} />
        <SummaryLine
          label={t('Відповідальний')}
          value={buildUserNameFromFields(readNestedString(item, ['User', 'FirstName']), readNestedString(item, ['User', 'LastName']))}
        />
        <SummaryLine label={t('Документ')} value={readStringField(item, 'TtnPDFPath')} link />
      </Stack>
    </SimpleGrid>
  )
}

function SummaryLine({ label, link, value }: { label: string; link?: boolean; value?: string }) {
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <Text c="dimmed" size="xs" miw={110}>
        {label}:
      </Text>
      {link && value ? (
        <Anchor href={upgradeHttpToHttps(value)} target="_blank" rel="noreferrer" size="xs">
          {translate('Завантажити')}
        </Anchor>
      ) : (
        <Text size="xs">{displayValue(value)}</Text>
      )}
    </Group>
  )
}

function readStringField(item: EditingActItem, field: string): string {
  const value = (item as unknown as Record<string, unknown>)[field]

  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''
}

function readNestedString(item: EditingActItem, path: string[]): string {
  let value: unknown = item

  path.forEach((field) => {
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[field] : undefined
  })

  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''
}

function readRawValue(item: EditingActItem, field: string): unknown {
  return (item as unknown as Record<string, unknown>)[field]
}

function readBooleanField(item: EditingActItem, field: string): boolean {
  return readRawValue(item, field) === true
}

function readNumberField(item: EditingActItem, field: string): number | undefined {
  const value = readRawValue(item, field)

  return typeof value === 'number' ? value : undefined
}

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

function formatAmount(value?: number): string {
  return typeof value === 'number' ? amountFormatter.format(value) : ''
}

function formatDateTimeOrEmpty(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  return formatDateTime(value as Date | string)
}

function formatBoolean(t: TranslateFunction, value?: boolean): string {
  return value ? t('Так') : ''
}

function buildUserName(user?: WarehouseUkraineUser | null): string {
  if (!user) {
    return ''
  }

  return buildUserNameFromFields(user.FirstName || '', user.LastName || '')
}

function buildUserNameFromFields(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim()
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
