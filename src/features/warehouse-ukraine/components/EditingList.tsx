import { ActionIcon, Alert, Anchor, Badge, Button, Checkbox, Group, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Check, CircleAlert, RotateCcw } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { SaleAuditDetail } from '../../../shared/sale-audit/SaleAuditDetail'
import { getSaleStatisticBySaleId } from '../../../shared/sale-audit/saleAuditApi'
import type { SaleAuditStatistic } from '../../../shared/sale-audit/saleAuditTypes'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import { TransporterIcon } from '../../../shared/transporter-icons/TransporterIcon'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import type { EditingItemsResponse, EditingActItem, WarehouseUkraineShipmentDetails, WarehouseUkraineUpdateDataCarrier, WarehouseUkraineUser } from '../types'
import { displayValue, formatDateTime, getDateShiftedByDays, toDateString } from './dateHelpers'

const DEFAULT_PAGE_SIZE = DEFAULT_PAGINATOR_PAGE_SIZE

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
  onLoaded?: () => void
  processor: (netId: string) => Promise<void>
  onProcessed?: () => void
}

export function EditingList({ kind, layoutVersion, loader, onLoaded, onProcessed, processor, tableId }: EditingListProps) {
  const { t } = useI18n()
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0), isDevelopment: false }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [activeFilters, setActiveFilters] = useValueState<FilterDraft>(initialFilters)
  const [items, setItems] = useValueState<EditingActItem[]>([])
  const [totalQty, setTotalQty] = useValueState(0)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useValueState(1)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isProcessing, setProcessing] = useValueState(false)
  const [confirmItem, setConfirmItem] = useValueState<EditingActItem | null>(null)
  const [auditStatistic, setAuditStatistic] = useValueState<SaleAuditStatistic | null>(null)
  const [auditLoading, setAuditLoading] = useValueState(false)
  const [auditError, setAuditError] = useValueState<string | null>(null)
  const auditRequestRef = useRef(0)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const filterError = getFilterError(activeFilters.from, activeFilters.to)
  const pageOffset = (page - 1) * pageSize
  const itemIndexMap = useMemo(() => buildIndexMap(items, pageOffset), [items, pageOffset])
  const totalPages = totalQty > 0 ? Math.ceil(totalQty / pageSize) : undefined
  const hasNext = totalQty > 0 ? page * pageSize < totalQty : items.length === pageSize

  useEffect(() => {
    if (filterError) {
      setItems([])
      setTotalQty(0)
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
          offset: pageOffset,
          isDevelopment: activeFilters.isDevelopment,
        })

        if (!cancelled) {
          const lastPage = Math.max(1, Math.ceil(result.totalQty / pageSize))

          if (page > lastPage) {
            setPage(lastPage)

            return
          }

          setItems(result.items)
          setTotalQty(result.totalQty)
          onLoaded?.()
        }
      } catch (loadError) {
        if (!cancelled) {
          setItems([])
          setTotalQty(0)
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
  }, [activeFilters, filterError, loader, onLoaded, page, pageOffset, pageSize, reloadKey, setError, setItems, setLoading, setPage, setTotalQty, t])

  const columns = useEditingColumns({
    indexMap: itemIndexMap,
    kind,
    onProcess: openProcessConfirm,
  })

  function applyFilters(nextFilters: FilterDraft) {
    setPage(1)
    setFilterDraft(nextFilters)
    setActiveFilters(nextFilters)
  }

  function resetFilters() {
    setPage(1)
    setFilterDraft(initialFilters)
    setActiveFilters(initialFilters)
  }

  function changePageSize(nextPageSize: number) {
    setPage(1)
    setPageSize(nextPageSize || DEFAULT_PAGE_SIZE)
  }

  function openProcessConfirm(item: EditingActItem) {
    // Legacy only enforced the printed guard on the carrier tab; the act tab could open the audit
    // for a non-printed invoice.
    if (kind === 'carrier' && !item.Sale?.IsPrinted) {
      setError(t('Накладну не роздруковано'))

      return
    }

    setError(null)
    setConfirmItem(item)

    if (kind !== 'act') {
      return
    }

    setAuditStatistic(null)
    setAuditError(null)

    const saleNetId = item.Sale?.NetUid

    if (!saleNetId) {
      return
    }

    setAuditLoading(true)
    const requestId = auditRequestRef.current + 1
    auditRequestRef.current = requestId

    void (async () => {
      try {
        const statistic = await getSaleStatisticBySaleId(saleNetId)

        if (auditRequestRef.current === requestId) {
          setAuditStatistic(statistic)
        }
      } catch (auditFetchError) {
        if (auditRequestRef.current === requestId) {
          setAuditError(auditFetchError instanceof Error ? auditFetchError.message : t('Не вдалося завантажити дані'))
        }
      } finally {
        if (auditRequestRef.current === requestId) {
          setAuditLoading(false)
        }
      }
    })()
  }

  function closeConfirm() {
    auditRequestRef.current += 1
    setConfirmItem(null)
    setAuditStatistic(null)
    setAuditError(null)
    setAuditLoading(false)
  }

  async function processConfirmedItem() {
    if (!confirmItem?.NetUid) {
      setError(t('Не вдалося визначити запис для обробки'))
      closeConfirm()

      return
    }

    setProcessing(true)
    setError(null)

    try {
      await processor(confirmItem.NetUid)
      notifications.show({
        color: 'green',
        message:
          kind === 'carrier'
            ? t('Накладна успішно перенесена до нового перевізника')
            : t('Акт редагування накладної опрацьовано'),
      })
      closeConfirm()
      reload()
      onProcessed?.()
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : t('Не вдалося виконати запит'))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="app-filter-bar warehouse-ukraine-filter-bar is-editing">
          <div className="app-filter-date-range">
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Від')}
              max={filterDraft.to || undefined}
              type="date"
              value={filterDraft.from}
              onChange={(event) => applyFilters({ ...filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('До')}
              min={filterDraft.from || undefined}
              type="date"
              value={filterDraft.to}
              onChange={(event) => applyFilters({ ...filterDraft, to: event.currentTarget.value })}
            />
          </div>
          <Checkbox
            checked={filterDraft.isDevelopment}
            label={t('Опрацьовані')}
            onChange={(event) => applyFilters({ ...filterDraft, isDevelopment: event.currentTarget.checked })}
          />
          <div className="app-filter-actions warehouse-ukraine-filter-actions">
            <Tooltip label={t('Скинути')}>
              <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetFilters}>
                <RotateCcw size={17} />
              </ActionIcon>
            </Tooltip>
            <Paginator
              hasNext={hasNext}
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={changePageSize}
              onRefresh={() => reload()}
            />
          </div>
          <div ref={setTableToolbarSlot} className="warehouse-ukraine-table-toolbar-slot" />
        </div>

        {(error || filterError) && (
          <Alert className="console-table-alert" color={filterError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
            {filterError || error}
          </Alert>
        )}

        <div className="warehouse-ukraine-table console-table-body">
          <DataTable
            columns={columns}
            data={items}
            distributeAvailableWidth
            emptyText={t('Даних не знайдено')}
            getRowId={(item, index) => String(item.NetUid || item.Id || index)}
            height="100%"
            isLoading={isLoading}
            layoutVersion={`${layoutVersion}-toolbar`}
            minWidth={920}
            showLayoutControls
            tableId={tableId}
            toolbarPortalTarget={tableToolbarSlot}
          />
        </div>

      </div>

      <AppModal
        centered
        opened={Boolean(confirmItem)}
        size={kind === 'act' ? 'lg' : undefined}
        title={kind === 'carrier' ? t('Підтвердити зміну перевізника') : t('Підтвердити обробку акту')}
        onClose={closeConfirm}
      >
        <Stack gap="md">
          <Text size="sm">{t('Після підтвердження запис буде позначено як опрацьований.')}</Text>

          {confirmItem && kind === 'carrier' && <CarrierChangeSummary item={confirmItem} />}

          {confirmItem && kind === 'act' && (
            <SaleAuditDetail error={auditError} isLoading={auditLoading} showConfirm={false} statistic={auditStatistic} />
          )}

          <Group justify="flex-end" gap="sm">
            <Button color="gray" variant="light" onClick={closeConfirm}>
              {t('Скасувати')}
            </Button>
            <Button
              color="green"
              loading={isProcessing}
              disabled={kind === 'act' && (auditLoading || Boolean(auditError) || !auditStatistic)}
              onClick={processConfirmedItem}
            >
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
        cell: (item) => (
          <Text className="warehouse-ukraine-editing-cell-mono" fw={600}>
            {formatDateTime(item.Created)}
          </Text>
        ),
      },
      {
        id: 'number',
        header: t('Номер ВН'),
        width: 200,
        minWidth: 150,
        accessor: (item) => item.Sale?.SaleNumber?.Value,
        cell: (item) => (
          <Text className="warehouse-ukraine-editing-cell-mono is-strong">
            {displayValue(item.Sale?.SaleNumber?.Value).toLocaleUpperCase('uk-UA')}
          </Text>
        ),
      },
      {
        id: 'buyer',
        header: t('Покупець'),
        minWidth: 240,
        accessor: (item) => buildBuyer(item),
        cell: (item) => (
          <Text size="sm" title={displayValue(buildBuyer(item))}>
            {displayValue(buildBuyer(item))}
          </Text>
        ),
      },
      ...(kind === 'carrier'
        ? [
            {
              id: 'changes',
              header: t('Зміни'),
              minWidth: 360,
              accessor: (item: EditingActItem) => buildCarrierChangesText(item, t),
              cell: (item: EditingActItem) => <CarrierChangesCell item={item} />,
            } satisfies DataTableColumn<EditingActItem>,
          ]
        : []),
      {
        id: 'isPrinted',
        header: t('Роздруковано'),
        width: 140,
        minWidth: 110,
        accessor: (item) => item.Sale?.IsPrinted,
        cell: (item) =>
          item.Sale?.IsPrinted ? (
            <Badge className="app-role-pill is-green" variant="light">
              {t('Так')}
            </Badge>
          ) : (
            ''
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
              <Badge className="app-role-pill is-green" variant="light">
                {t('Так')}
              </Badge>
            )
          }

          if (item.ApproveUpdate) {
            return (
              <Badge className="app-role-pill is-yellow" variant="light">
                {t('Очікує')}
              </Badge>
            )
          }

          return (
            <Badge className="app-role-pill is-gray" variant="light">
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
                <Check size={16} />
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

type CarrierChangeItem = {
  after: string
  before: string
  changed: boolean
  label: string
}

function CarrierChangesCell({ item }: { item: EditingActItem }) {
  const { t } = useI18n()
  const changes = buildCarrierChangeItems(item, t).filter((change) => change.changed)
  const previous = getCarrierComparisonBase(item)
  const transporterLabel = t('Перевізник')

  if (changes.length === 0) {
    return (
      <Text c="dimmed" size="xs">
        {t('Змін не знайдено')}
      </Text>
    )
  }

  return (
    <Text size="xs" title={buildCarrierChangesText(item, t)} style={{ whiteSpace: 'nowrap' }}>
      {changes.map((change, index) => {
        const isTransporter = change.label === transporterLabel

        return (
          <span key={change.label}>
            {index > 0 && '; '}
            <Text span c="red" fw={700}>
              {change.label}
            </Text>
            {': '}
            {isTransporter ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
                <TransporterIcon cssClass={previous?.Transporter?.CssClass} imageUrl={previous?.Transporter?.ImageUrl} name={change.before} size={16} />
                {displayChangeValue(change.before)}
              </span>
            ) : (
              displayChangeValue(change.before)
            )}
            {' → '}
            <Text span fw={600}>
              {isTransporter ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
                  <TransporterIcon cssClass={item.Transporter?.CssClass} imageUrl={item.Transporter?.ImageUrl} name={change.after} size={16} />
                  {displayChangeValue(change.after)}
                </span>
              ) : (
                displayChangeValue(change.after)
              )}
            </Text>
          </span>
        )
      })}
    </Text>
  )
}

function buildCarrierChangesText(item: EditingActItem, t: TranslateFunction): string {
  const changes = buildCarrierChangeItems(item, t).filter((change) => change.changed)

  return changes
    .map((change) => `${change.label}: ${displayChangeValue(change.before)} -> ${displayChangeValue(change.after)}`)
    .join('; ')
}

function buildCarrierChangeItems(item: EditingActItem, t: TranslateFunction): CarrierChangeItem[] {
  const previous = getCarrierComparisonBase(item)

  return [
    {
      label: t('Перевізник'),
      before: previous?.Transporter?.Name || '',
      after: readNestedString(item, ['Transporter', 'Name']),
      changed: isCarrierTextFieldChanged(readNestedRaw(item, ['Transporter', 'Name']), previous?.Transporter?.Name),
    },
    {
      label: t('Місто'),
      before: previous?.City || '',
      after: readStringField(item, 'City'),
      changed: isCarrierTextFieldChanged(readRawValue(item, 'City'), previous?.City),
    },
    {
      label: t('Відділення'),
      before: previous?.Department || '',
      after: readStringField(item, 'Department'),
      changed: isCarrierTextFieldChanged(readRawValue(item, 'Department'), previous?.Department),
    },
    {
      label: t('Дата відвантаження'),
      before: formatDateTimeOrEmpty(previous?.ShipmentDate),
      after: formatDateTimeOrEmpty(readRawValue(item, 'ShipmentDate')),
      changed: isShipmentDateTimeChanged(readRawValue(item, 'ShipmentDate'), previous?.ShipmentDate),
    },
    {
      label: t("Повне ім'я"),
      before: previous?.FullName || '',
      after: readStringField(item, 'FullName'),
      changed: isCarrierTextFieldChanged(readRawValue(item, 'FullName'), previous?.FullName),
    },
    {
      label: t('Мобільний телефон'),
      before: previous?.MobilePhone || '',
      after: readStringField(item, 'MobilePhone'),
      changed: isCarrierTextFieldChanged(readRawValue(item, 'MobilePhone'), previous?.MobilePhone),
    },
    {
      label: t('Коментар'),
      before: previous?.Comment || '',
      after: readStringField(item, 'Comment'),
      changed: isCarrierFieldChanged(readStringField(item, 'Comment'), previous?.Comment),
    },
    {
      label: t('Накладений платіж'),
      before: formatBoolean(t, previous?.IsCashOnDelivery),
      after: formatBoolean(t, readBooleanField(item, 'IsCashOnDelivery')),
      changed: isCarrierFieldChanged(formatBoolean(t, readBooleanField(item, 'IsCashOnDelivery')), formatBoolean(t, previous?.IsCashOnDelivery)),
    },
    {
      label: t('Сума накладеного платежу'),
      before: formatAmount(previous?.CashOnDeliveryAmount),
      after: formatAmount(readNumberField(item, 'CashOnDeliveryAmount')),
      changed: isCarrierFieldChanged(formatAmount(readNumberField(item, 'CashOnDeliveryAmount')), formatAmount(previous?.CashOnDeliveryAmount)),
    },
    {
      label: t('Наявність документів'),
      before: formatBoolean(t, previous?.HasDocument),
      after: formatBoolean(t, readBooleanField(item, 'HasDocument')),
      changed: isCarrierFieldChanged(formatBoolean(t, readBooleanField(item, 'HasDocument')), formatBoolean(t, previous?.HasDocument)),
    },
    {
      label: t('ТТН'),
      before: previous?.Number || '',
      after: readStringField(item, 'Number'),
      changed: isCarrierFieldChanged(readStringField(item, 'Number'), previous?.Number),
    },
    {
      label: t('Документ'),
      before: previous?.TtnPDFPath || '',
      after: readStringField(item, 'TtnPDFPath'),
      changed: isCarrierFieldChanged(readStringField(item, 'TtnPDFPath'), previous?.TtnPDFPath ?? undefined),
    },
  ]
}

function getCarrierComparisonBase(item: EditingActItem): WarehouseUkraineShipmentDetails | WarehouseUkraineUpdateDataCarrier | undefined {
  const historyEntries = getCarrierHistoryEntries(item)
  const currentIndex = historyEntries.findIndex((entry) => isSameCarrierHistoryEntry(entry, item))

  if (currentIndex > 0) {
    return historyEntries[currentIndex - 1]
  }

  return item.Sale?.WarehousesShipment ?? undefined
}

function getCarrierHistoryEntries(item: EditingActItem): WarehouseUkraineUpdateDataCarrier[] {
  const saleEntries = Array.isArray(item.Sale?.UpdateDataCarrier) ? item.Sale.UpdateDataCarrier : []
  const entries = saleEntries.some((entry) => isSameCarrierHistoryEntry(entry, item))
    ? saleEntries
    : [...saleEntries, item]

  return entries.toSorted(compareCarrierHistoryEntries)
}

function isSameCarrierHistoryEntry(left: WarehouseUkraineUpdateDataCarrier, right: WarehouseUkraineUpdateDataCarrier): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (left.Id != null && right.Id != null) {
    return left.Id === right.Id
  }

  return left === right
}

function compareCarrierHistoryEntries(left: WarehouseUkraineUpdateDataCarrier, right: WarehouseUkraineUpdateDataCarrier): number {
  const dateCompare = getHistoryTime(left.Created) - getHistoryTime(right.Created)

  if (dateCompare !== 0) {
    return dateCompare
  }

  return getHistoryId(left) - getHistoryId(right)
}

function getHistoryTime(value?: Date | string): number {
  if (!value) {
    return 0
  }

  const time = new Date(value).getTime()

  return Number.isNaN(time) ? 0 : time
}

function getHistoryId(entry: WarehouseUkraineUpdateDataCarrier): number {
  const id = Number(entry.Id)

  return Number.isFinite(id) ? id : 0
}

function displayChangeValue(value: string): string {
  return value.trim() || '—'
}

function CarrierChangeSummary({ item }: { item: EditingActItem }) {
  const { t } = useI18n()
  const previous = getCarrierComparisonBase(item)

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      <Stack gap={4}>
        <Text fw={700} size="sm">
          {t('Попередні дані')}
        </Text>
        <SummaryLine
          label={t('Перевізник')}
          value={previous?.Transporter?.Name}
          icon={<TransporterIcon cssClass={previous?.Transporter?.CssClass} imageUrl={previous?.Transporter?.ImageUrl} name={previous?.Transporter?.Name} size={18} />}
        />
        <SummaryLine label={t('Місто')} value={previous?.City} />
        <SummaryLine label={t('Відділення')} value={previous?.Department} />
        <SummaryLine label={t('Дата відвантаження')} value={formatDateTimeOrEmpty(previous?.ShipmentDate)} />
        <SummaryLine label={t("Повне ім'я")} value={previous?.FullName} />
        <SummaryLine label={t('Мобільний телефон')} value={previous?.MobilePhone} />
        <SummaryLine label={t('Коментар')} value={previous?.Comment} />
        <SummaryLine label={t('Накладений платіж')} value={formatBoolean(t, previous?.IsCashOnDelivery)} />
        <SummaryLine label={t('Сума накладеного платежу')} value={formatAmount(previous?.CashOnDeliveryAmount)} />
        <SummaryLine label={t('Наявність документів')} value={formatBoolean(t, previous?.HasDocument)} />
        <SummaryLine label={t('ТТН')} value={previous?.Number} />
        <SummaryLine label={t('Відповідальний')} value={buildUserName(previous?.User)} />
        <SummaryLine label={t('Документ')} value={previous?.TtnPDFPath ?? undefined} link />
      </Stack>
      <Stack gap={4}>
        <Text fw={700} size="sm">
          {t('Нові дані')}
        </Text>
        <SummaryLine
          label={t('Перевізник')}
          value={readNestedString(item, ['Transporter', 'Name'])}
          changed={isCarrierTextFieldChanged(readNestedRaw(item, ['Transporter', 'Name']), previous?.Transporter?.Name)}
          icon={<TransporterIcon cssClass={item.Transporter?.CssClass} imageUrl={item.Transporter?.ImageUrl} name={item.Transporter?.Name} size={18} />}
        />
        <SummaryLine
          label={t('Місто')}
          value={readStringField(item, 'City')}
          changed={isCarrierTextFieldChanged(readRawValue(item, 'City'), previous?.City)}
        />
        <SummaryLine
          label={t('Відділення')}
          value={readStringField(item, 'Department')}
          changed={isCarrierTextFieldChanged(readRawValue(item, 'Department'), previous?.Department)}
        />
        <SummaryLine
          label={t('Дата відвантаження')}
          value={formatDateTimeOrEmpty(readRawValue(item, 'ShipmentDate'))}
          changed={isShipmentDateTimeChanged(readRawValue(item, 'ShipmentDate'), previous?.ShipmentDate)}
        />
        <SummaryLine
          label={t("Повне ім'я")}
          value={readStringField(item, 'FullName')}
          changed={isCarrierTextFieldChanged(readRawValue(item, 'FullName'), previous?.FullName)}
        />
        <SummaryLine
          label={t('Мобільний телефон')}
          value={readStringField(item, 'MobilePhone')}
          changed={isCarrierTextFieldChanged(readRawValue(item, 'MobilePhone'), previous?.MobilePhone)}
        />
        <SummaryLine
          label={t('Коментар')}
          value={readStringField(item, 'Comment')}
          changed={isCarrierFieldChanged(readStringField(item, 'Comment'), previous?.Comment)}
        />
        <SummaryLine
          label={t('Накладений платіж')}
          value={formatBoolean(t, readBooleanField(item, 'IsCashOnDelivery'))}
          changed={isCarrierFieldChanged(formatBoolean(t, readBooleanField(item, 'IsCashOnDelivery')), formatBoolean(t, previous?.IsCashOnDelivery))}
        />
        <SummaryLine
          label={t('Сума накладеного платежу')}
          value={formatAmount(readNumberField(item, 'CashOnDeliveryAmount'))}
          changed={isCarrierFieldChanged(formatAmount(readNumberField(item, 'CashOnDeliveryAmount')), formatAmount(previous?.CashOnDeliveryAmount))}
        />
        <SummaryLine
          label={t('Наявність документів')}
          value={formatBoolean(t, readBooleanField(item, 'HasDocument'))}
          changed={isCarrierFieldChanged(formatBoolean(t, readBooleanField(item, 'HasDocument')), formatBoolean(t, previous?.HasDocument))}
        />
        <SummaryLine
          label={t('ТТН')}
          value={readStringField(item, 'Number')}
          changed={isCarrierFieldChanged(readStringField(item, 'Number'), previous?.Number)}
        />
        <SummaryLine
          label={t('Відповідальний')}
          value={buildUserNameFromFields(readNestedString(item, ['User', 'FirstName']), readNestedString(item, ['User', 'LastName']))}
        />
        <SummaryLine label={t('Документ')} value={readStringField(item, 'TtnPDFPath')} link />
      </Stack>
    </SimpleGrid>
  )
}

function SummaryLine({ changed, icon, label, link, value }: { changed?: boolean; icon?: ReactNode; label: string; link?: boolean; value?: string }) {
  return (
    <Group
      gap={6}
      wrap="nowrap"
      align="flex-start"
      style={changed ? { backgroundColor: 'var(--mantine-color-red-1)', borderRadius: 4, padding: '1px 4px' } : undefined}
    >
      <Text c="dimmed" size="xs" miw={110}>
        {label}:
      </Text>
      {link && value ? (
        <Anchor href={upgradeHttpToHttps(value)} target="_blank" rel="noreferrer" size="xs">
          {translate('Завантажити')}
        </Anchor>
      ) : icon ? (
        <Group gap={4} wrap="nowrap" align="center" style={{ minWidth: 0 }}>
          {icon}
          <Text size="xs">{displayValue(value)}</Text>
        </Group>
      ) : (
        <Text size="xs">{displayValue(value)}</Text>
      )}
    </Group>
  )
}

// null/undefined and '' are equivalent (legacy null↔empty rule); everything else compared as trimmed strings.
// Used for Comment/ТТН/boolean/amount rows where legacy treats blank and missing as the same.
function isCarrierFieldChanged(nextValue?: string, previousValue?: string): boolean {
  return (nextValue ?? '').trim() !== (previousValue ?? '').trim()
}

// Plain text carrier fields: legacy keeps null and '' DISTINCT (raw loose compare), so a null→''
// edit still highlights. Compares the raw underlying values, not the stringified display value.
function isCarrierTextFieldChanged(nextRaw: unknown, previousRaw: unknown): boolean {
  const normalize = (value: unknown) => (value == null ? null : String(value).trim())

  return normalize(nextRaw) !== normalize(previousRaw)
}

function isShipmentDateTimeChanged(nextRaw: unknown, previousRaw?: Date | string): boolean {
  return formatDateTimeOrEmpty(nextRaw) !== formatDateTimeOrEmpty(previousRaw)
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

function readNestedRaw(item: EditingActItem, path: string[]): unknown {
  let value: unknown = item

  path.forEach((field) => {
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[field] : undefined
  })

  return value
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

function buildIndexMap(items: EditingActItem[], pageOffset: number): Map<EditingActItem, number> {
  return items.reduce((indexMap, item, index) => {
    indexMap.set(item, pageOffset + index + 1)

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
