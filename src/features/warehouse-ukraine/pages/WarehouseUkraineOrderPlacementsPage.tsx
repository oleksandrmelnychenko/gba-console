import { ActionIcon, Alert, Button, Card, Group, NumberInput, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconColumnInsertRight, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  createProductIncomeFromDynamicPlacements,
  getNonDefectiveStorages,
  getSupplyOrderUkraineById,
  recordProductIncomeFromDynamicPlacementsHistory,
  updateSupplyOrderUkraine,
} from '../api/orderPlacementsApi'
import { NewDynamicColumnModal } from '../components/NewDynamicColumnModal'
import { PlacementEditDrawer } from '../components/PlacementEditDrawer'
import { formatDate } from '../components/dateHelpers'
import type {
  DynamicProductPlacement,
  DynamicProductPlacementColumn,
  DynamicProductPlacementRow,
  PlacementGridRow,
  PlacementOrderItem,
  PlacementStorage,
  PlacementSupplyOrder,
} from '../placementsTypes'

const PLACEMENT_ADD_CANCEL_SAVE_PERMISSION = 'PlacementHeader_AddCancelSave_ordersUkrainePlacement_PKEY'
const PLACEMENT_CARRY_OUT_PERMISSION = 'PlacementHeader_CarryOut_ordersUkrainePlacement_PKEY'
const PLACEMENT_GET_UP_PERMISSION = 'PlacementHeader_GetUp_ordersUkrainePlacement_PKEY'

function columnKey(column: DynamicProductPlacementColumn): string {
  return column.NetUid || String(column.Id || '')
}

function sumPlacements(placements: DynamicProductPlacement[]): number {
  return placements.reduce((total, placement) => total + (placement.Qty || 0), 0)
}

function sumAppliedPlacements(placements: DynamicProductPlacement[]): number {
  return placements.reduce((total, placement) => total + (placement.IsApplied ? placement.Qty || 0 : 0), 0)
}

function splitPlacements(placements: DynamicProductPlacement[]) {
  return placements.reduce<{
    appliedPlacements: DynamicProductPlacement[]
    appliedQty: number
    draftPlacement?: DynamicProductPlacement
  }>(
    (result, placement) => {
      if (placement.IsApplied) {
        result.appliedPlacements.push(placement)
        result.appliedQty += placement.Qty || 0
      } else if (!result.draftPlacement) {
        result.draftPlacement = placement
      }

      return result
    },
    { appliedPlacements: [], appliedQty: 0 },
  )
}

function normalizePlacementsForQty(
  placements: DynamicProductPlacement[],
  requestedQty: number,
): DynamicProductPlacement[] {
  const { appliedPlacements, appliedQty, draftPlacement } = splitPlacements(placements)
  const qtyToSet = Math.max(requestedQty, appliedQty)
  const remainderQty = qtyToSet - appliedQty

  if (remainderQty <= 0) {
    return appliedPlacements
  }

  return [
    ...appliedPlacements,
    {
      ...(draftPlacement || { StorageNumber: 'N', RowNumber: 'N', CellNumber: 'N' }),
      Qty: remainderQty,
      IsApplied: false,
    },
  ]
}

function findRowForItem(
  column: DynamicProductPlacementColumn,
  item: PlacementOrderItem,
): DynamicProductPlacementRow | undefined {
  return column.DynamicProductPlacementRows.find((row) => row.SupplyOrderUkraineItemId === item.Id)
}

function buildGridRows(order: PlacementSupplyOrder): PlacementGridRow[] {
  return order.SupplyOrderUkraineItems.reduce<PlacementGridRow[]>((rows, item) => {
    if (item.NotOrdered) {
      return rows
    }

    const rowsByColumn = new Map<string, DynamicProductPlacementRow>()

    order.DynamicProductPlacementColumns.forEach((column) => {
      const existing = findRowForItem(column, item)

      rowsByColumn.set(
        columnKey(column),
        existing || {
          Qty: 0,
          SupplyOrderUkraineItemId: item.Id,
          DynamicProductPlacementColumnId: column.Id,
          DynamicProductPlacements: [],
        },
      )
    })

    rows.push({ index: rows.length + 1, item, rowsByColumn })
    return rows
  }, [])
}

function columnHasAppliedPlacements(column: DynamicProductPlacementColumn): boolean {
  return column.DynamicProductPlacementRows.some((row) =>
    row.DynamicProductPlacements.some((placement) => placement.IsApplied),
  )
}

type DrawerState = {
  item: PlacementOrderItem
  row: DynamicProductPlacementRow
  columnId: string
}

function useOrderPlacementsModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [order, setOrder] = useValueState<PlacementSupplyOrder | null>(null)
  const [storages, setStorages] = useValueState<PlacementStorage[]>([])
  const [selectedStorageId, setSelectedStorageId] = useValueState<string | null>(null)
  const [isDirty, setDirty] = useValueState(false)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [reloadKey, setReloadKey] = useValueState(0)
  const [columnModalOpen, setColumnModalOpen] = useValueState(false)
  const [columnToRemove, setColumnToRemove] = useValueState<DynamicProductPlacementColumn | null>(null)
  const [drawer, setDrawer] = useValueState<DrawerState | null>(null)
  const [incomeDate, setIncomeDate] = useValueState(() => formatLocalDate(new Date()))
  const [confirmPlacement, setConfirmPlacement] = useValueState<{ isFullPlaced: boolean } | null>(null)
  const [isPlacing, setPlacing] = useValueState(false)

  useEffect(() => {
    if (!id) {
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [loadedOrder, loadedStorages] = await Promise.all([
          getSupplyOrderUkraineById(id as string),
          getNonDefectiveStorages(),
        ])

        if (!cancelled) {
          setOrder(loadedOrder)
          setStorages(loadedStorages)
          setSelectedStorageId((current) => current || loadedStorages[0]?.NetUid || null)
          setDirty(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [id, reloadKey, setDirty, setError, setLoading, setOrder, setSelectedStorageId, setStorages, t])

  const gridRows = useMemo(() => (order ? buildGridRows(order) : []), [order])
  const isBusy = isSaving || isPlacing

  const reloadFromServer = useCallback(() => {
    if (isBusy) {
      return
    }

    setReloadKey((key) => key + 1)
  }, [isBusy, setReloadKey])

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === selectedStorageId) || null,
    [selectedStorageId, storages],
  )

  const persistOrder = useCallback(
    async (nextOrder: PlacementSupplyOrder, markClean: boolean) => {
      if (isBusy) {
        return
      }

      setSaving(true)
      setError(null)

      try {
        const saved = await updateSupplyOrderUkraine(nextOrder)
        setOrder(saved)

        if (markClean) {
          setDirty(false)
        }
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти зміни'))
      } finally {
        setSaving(false)
      }
    },
    [isBusy, setDirty, setError, setOrder, setSaving, t],
  )

  const applyColumnRowQty = useCallback(
    (columnId: string, item: PlacementOrderItem, qty: number, placements: DynamicProductPlacement[]) => {
      setOrder((current) => {
        if (!current) {
          return current
        }

        const columns = current.DynamicProductPlacementColumns.map((column) => {
          if (columnKey(column) !== columnId) {
            return column
          }

          const existing = findRowForItem(column, item)
          const nextRow: DynamicProductPlacementRow = existing
            ? { ...existing, Qty: qty, DynamicProductPlacements: placements }
            : {
                Qty: qty,
                SupplyOrderUkraineItemId: item.Id,
                DynamicProductPlacementColumnId: column.Id,
                DynamicProductPlacements: placements,
              }

          const rows = existing
            ? column.DynamicProductPlacementRows.map((row) => (row === existing ? nextRow : row))
            : [...column.DynamicProductPlacementRows, nextRow]

          return { ...column, DynamicProductPlacementRows: rows }
        })

        return { ...current, DynamicProductPlacementColumns: columns }
      })
      setDirty(true)
    },
    [setDirty, setOrder],
  )

  const handleCellChange = useCallback(
    (gridRow: PlacementGridRow, columnId: string, value: number) => {
      if (isBusy || order?.IsPlaced) {
        return
      }

      const { item } = gridRow
      const qtyToSet = Math.trunc(value)
      const itemQty = item.Qty || 0

      const otherColumnsTotal = Array.from(gridRow.rowsByColumn.entries()).reduce(
        (total, [key, row]) => total + (key === columnId ? 0 : row.Qty || 0),
        0,
      )

      if (!Number.isFinite(qtyToSet) || qtyToSet < 0 || otherColumnsTotal + qtyToSet > itemQty) {
        notifications.show({ color: 'red', message: t('Невірна кількість') })
        return
      }

      const currentRow = gridRow.rowsByColumn.get(columnId)
      const placements = currentRow ? currentRow.DynamicProductPlacements.map((placement) => ({ ...placement })) : []
      const appliedQty = sumAppliedPlacements(placements)

      if (qtyToSet < appliedQty) {
        notifications.show({
          color: 'red',
          message: t('Неможливо записати меншу кількість ніж розміщено. Для зменшення, необхідно видалити розміщення'),
        })
        return
      }

      applyColumnRowQty(columnId, item, qtyToSet, normalizePlacementsForQty(placements, qtyToSet))
    },
    [applyColumnRowQty, isBusy, order?.IsPlaced, t],
  )

  const handleOpenPlacements = useCallback(
    (gridRow: PlacementGridRow, columnId: string, row: DynamicProductPlacementRow) => {
      if (isBusy || order?.IsPlaced) {
        return
      }

      if (!row.Qty) {
        notifications.show({ color: 'red', message: t('Неможливо розмісти нульову кількість') })
        return
      }

      setDrawer({ item: gridRow.item, row, columnId })
    },
    [isBusy, order?.IsPlaced, setDrawer, t],
  )

  const handleApplyPlacements = useCallback(
    (placements: DynamicProductPlacement[]) => {
      if (!drawer || isBusy || order?.IsPlaced) {
        return
      }

      applyColumnRowQty(drawer.columnId, drawer.item, sumPlacements(placements), placements)
      setDrawer(null)
    },
    [applyColumnRowQty, drawer, isBusy, order?.IsPlaced, setDrawer],
  )

  const handleAddColumn = useCallback(
    (fromDate: string) => {
      if (isBusy) {
        return
      }

      if (!isValidDateInputValue(fromDate)) {
        notifications.show({ color: 'yellow', message: t('Вкажіть коректну дату') })
        return
      }

      if (!order) {
        return
      }

      setColumnModalOpen(false)

      const nextColumn: DynamicProductPlacementColumn = {
        FromDate: fromDate,
        SupplyOrderUkraineId: order.Id,
        DynamicProductPlacementRows: [],
      }

      void persistOrder(
        { ...order, DynamicProductPlacementColumns: [...order.DynamicProductPlacementColumns, nextColumn] },
        true,
      )
    },
    [isBusy, order, persistOrder, setColumnModalOpen, t],
  )

  const confirmRemoveColumn = useCallback(() => {
    if (!columnToRemove || !order || isBusy) {
      return
    }

    const nextColumns = order.DynamicProductPlacementColumns.filter((column) => column !== columnToRemove)
    const nextOrder = { ...order, DynamicProductPlacementColumns: nextColumns }
    setColumnToRemove(null)

    if (columnToRemove.Id && columnToRemove.Id > 0) {
      void persistOrder(nextOrder, true)
    } else {
      setOrder(nextOrder)
    }
  }, [columnToRemove, isBusy, order, persistOrder, setColumnToRemove, setOrder])

  const handleMoveRemnants = useCallback(
    (column: DynamicProductPlacementColumn) => {
      if (isBusy || order?.IsPlaced) {
        return
      }

      if (isDirty) {
        notifications.show({ color: 'red', message: t('Збережіть зміни перед переміщенням залишків') })
        return
      }

      setOrder((current) => {
        if (!current) {
          return current
        }

        const targetKey = columnKey(column)

        const columns = current.DynamicProductPlacementColumns.map((iterColumn) => {
          if (columnKey(iterColumn) !== targetKey) {
            return iterColumn
          }

          const rows = current.SupplyOrderUkraineItems.reduce<DynamicProductPlacementRow[]>((nextRows, item) => {
            if (item.NotOrdered) {
              return nextRows
            }

            const placedElsewhere = current.DynamicProductPlacementColumns.reduce((total, other) => {
              if (columnKey(other) === targetKey) {
                return total
              }

              const otherRow = findRowForItem(other, item)
              return total + (otherRow?.Qty || 0)
            }, 0)

            const qtyToSet = Math.max((item.Qty || 0) - placedElsewhere, 0)
            const existing = findRowForItem(iterColumn, item)
            const placements = existing ? existing.DynamicProductPlacements.map((placement) => ({ ...placement })) : []
            const nextPlacements = normalizePlacementsForQty(placements, qtyToSet)
            const nextQty = sumPlacements(nextPlacements)

            nextRows.push(
              existing
                ? { ...existing, Qty: nextQty, DynamicProductPlacements: nextPlacements }
                : {
                    Qty: nextQty,
                    SupplyOrderUkraineItemId: item.Id,
                    DynamicProductPlacementColumnId: iterColumn.Id,
                    DynamicProductPlacements: nextPlacements,
                  },
            )
            return nextRows
          }, [])

          return { ...iterColumn, DynamicProductPlacementRows: rows }
        })

        return { ...current, DynamicProductPlacementColumns: columns }
      })

      setDirty(true)
    },
    [isBusy, isDirty, order?.IsPlaced, setDirty, setOrder, t],
  )

  const handleSave = useCallback(() => {
    if (order && isDirty && !isBusy) {
      void persistOrder(order, true)
    }
  }, [isBusy, isDirty, order, persistOrder])

  const recordDynamicIncomeHistory = useCallback(
    async (savedOrder: PlacementSupplyOrder) => {
      try {
        await recordProductIncomeFromDynamicPlacementsHistory(savedOrder)
      } catch {
        notifications.show({
          color: 'yellow',
          message: t('Оприходування виконано, але історію руху не записано'),
        })
      }
    },
    [t],
  )

  const placeOrder = useCallback(
    async (isFullPlaced: boolean) => {
      const storageNetId = selectedStorageId

      if (isBusy) {
        return
      }

      if (!order || !storageNetId) {
        notifications.show({ color: 'red', message: t('Оберіть склад') })

        return
      }

      if (isDirty) {
        notifications.show({ color: 'red', message: t('Збережіть зміни перед оприходуванням') })
        return
      }

      if (!isValidDateInputValue(incomeDate)) {
        notifications.show({ color: 'yellow', message: t('Вкажіть коректну дату оприходування') })
        return
      }

      setPlacing(true)

      try {
        const savedOrder = await createProductIncomeFromDynamicPlacements(
          { ...order, IsPlaced: isFullPlaced },
          incomeDate,
          storageNetId,
        )
        notifications.show({ color: 'green', message: t('Оприходування виконано') })
        await recordDynamicIncomeHistory(savedOrder)
        setConfirmPlacement(null)
        setReloadKey((key) => key + 1)
      } catch {
        notifications.show({ color: 'red', message: t('Не вдалося виконати оприходування') })
      } finally {
        setPlacing(false)
      }
    },
    [
      incomeDate, isBusy, isDirty, order, recordDynamicIncomeHistory, selectedStorageId, setConfirmPlacement,
      setPlacing, setReloadKey, t,
    ],
  )

  const totalProductsCount = order ? order.SupplyOrderUkraineItems.length : 0
  const totalNetWeight = order?.TotalNetWeight || 0

  return {
    columnModalOpen, columnToRemove, confirmPlacement, confirmRemoveColumn, drawer, error, gridRows, handleAddColumn,
    handleApplyPlacements, handleCellChange, handleMoveRemnants, handleOpenPlacements, handleSave, incomeDate, isDirty,
    isBusy, isLoading, isPlacing, isSaving, navigate, order, placeOrder, reloadFromServer, selectedStorage, selectedStorageId,
    setColumnModalOpen, setColumnToRemove, setConfirmPlacement, setDrawer, setIncomeDate, setSelectedStorageId, storages,
    totalNetWeight, totalProductsCount,
  }
}

export function WarehouseUkraineOrderPlacementsPage() {
  const model = useOrderPlacementsModel()
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const canEditPlacement = hasPermission(PLACEMENT_ADD_CANCEL_SAVE_PERMISSION)
  const canCarryOut = hasPermission(PLACEMENT_CARRY_OUT_PERMISSION)
  const canGetUp = hasPermission(PLACEMENT_GET_UP_PERMISSION)

  const columns = useMemo<DataTableColumn<PlacementGridRow>[]>(() => {
    const fixedColumns: DataTableColumn<PlacementGridRow>[] = [
      {
        id: 'index',
        header: '#',
        width: 48,
        align: 'right',
        enableSorting: false,
        cell: (gridRow) => (
          <Text c="dimmed" size="sm">
            {gridRow.index}
          </Text>
        ),
      },
      {
        id: 'vendorCode',
        header: t('Код товару'),
        width: 160,
        cell: (gridRow) => gridRow.item.Product?.VendorCode || '-',
      },
      {
        id: 'name',
        header: t('Назва'),
        minWidth: 220,
        cell: (gridRow) => gridRow.item.Product?.Name || gridRow.item.Product?.NameUA || '-',
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 80,
        align: 'right',
        cell: (gridRow) => gridRow.item.Qty || 0,
      },
      {
        id: 'netWeight',
        header: t('Вага Нетто'),
        width: 120,
        align: 'right',
        cell: (gridRow) => (gridRow.item.NetWeight || 0).toFixed(3),
      },
      {
        id: 'placedQty',
        header: t('К-сть оприходуваних'),
        width: 160,
        align: 'right',
        cell: (gridRow) => gridRow.item.PlacedQty || 0,
      },
    ]

    const dynamicColumns: DataTableColumn<PlacementGridRow>[] = (model.order?.DynamicProductPlacementColumns || []).map(
      (column) => {
        const key = columnKey(column)
        const canDelete = !columnHasAppliedPlacements(column)

        return {
          id: `dynamic-${key}`,
          width: 220,
          minWidth: 180,
          enableSorting: false,
          header: (
            <Group gap="xs" justify="space-between" wrap="nowrap">
              <Text size="sm">{formatDate(column.FromDate)}</Text>
              <Group gap={4} wrap="nowrap">
                <Tooltip label={t('Перемістити залишки')}>
                  <ActionIcon
                    aria-label={t('Перемістити залишки')}
                    color="gray"
                    size="sm"
                    variant="subtle"
                    onClick={() => model.handleMoveRemnants(column)}
                  >
                    <IconColumnInsertRight size={16} />
                  </ActionIcon>
                </Tooltip>
                {canDelete && (
                  <Tooltip label={t('Видалити')}>
                    <ActionIcon
                      aria-label={t('Видалити')}
                      color="red"
                      size="sm"
                      variant="subtle"
                      onClick={() => model.setColumnToRemove(column)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Group>
          ),
          cell: (gridRow) => {
            const row = gridRow.rowsByColumn.get(key)

            if (!row) {
              return null
            }

            return (
              <Group gap="xs" wrap="nowrap">
                <NumberInput
                  allowDecimal={false}
                  hideControls
                  min={0}
                  size="xs"
                  value={row.Qty || 0}
                  w={80}
                  onBlur={(event) => {
                    const nextValue = Number(event.currentTarget.value)
                    if (nextValue !== (row.Qty || 0)) {
                      model.handleCellChange(gridRow, key, nextValue)
                    }
                  }}
                />
                <ActionIcon
                  aria-label={t('Оприходування')}
                  color="blue"
                  size="sm"
                  variant="subtle"
                  onClick={() => model.handleOpenPlacements(gridRow, key, row)}
                >
                  <IconColumnInsertRight size={16} />
                </ActionIcon>
              </Group>
            )
          },
        }
      },
    )

    return [...fixedColumns, ...dynamicColumns]
  }, [model, t])

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Button
          color="gray"
          disabled={model.isBusy}
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={() => model.navigate('/warehouse/ukraine')}
        >
          {t('Назад')}
        </Button>
        <Text fw={700} size="lg">
          {`${t('Замовлення на поставку в Україну')} #${model.order?.Number || ''} ${t('Від')} ${formatDate(
            model.order?.FromDate,
          )}`}
        </Text>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" align="end" wrap="wrap">
          <Group gap="sm" align="end">
            {!model.order?.IsPlaced && (
              <Select
                data={model.storages.map((storage) => ({ value: storage.NetUid || '', label: storage.Name || '' }))}
                label={t('Склад')}
                disabled={model.isBusy}
                value={model.selectedStorageId}
                w={240}
                onChange={(value) => model.setSelectedStorageId(value)}
              />
            )}
            {canEditPlacement && !model.order?.IsPlaced && (
              <Button disabled={model.isBusy} variant="light" onClick={() => model.setColumnModalOpen(true)}>
                {t('Додати колонку')}
              </Button>
            )}
          </Group>
          <Group gap="sm" align="end">
            {!model.order?.IsPlaced && (canCarryOut || canGetUp) && (
              <TextInput
                label={t('Дата оприходування')}
                disabled={model.isBusy || model.isDirty}
                type="date"
                value={model.incomeDate}
                w={170}
                onChange={(event) => model.setIncomeDate(event.currentTarget.value)}
              />
            )}
            {model.isDirty && (
              <Text c="orange" size="sm">
                {t('Є незбережені зміни')}
              </Text>
            )}
            {canEditPlacement && model.isDirty && (
              <Button color="gray" disabled={model.isBusy} variant="light" onClick={model.reloadFromServer}>
                {t('Скасувати')}
              </Button>
            )}
            {canEditPlacement && (
              <Button disabled={!model.isDirty || model.isBusy} loading={model.isSaving} onClick={model.handleSave}>
                {t('Зберегти')}
              </Button>
            )}
            {!model.order?.IsPlaced && canCarryOut && (
              <Button
                color="teal"
                disabled={model.isBusy || model.isDirty}
                onClick={() => model.setConfirmPlacement({ isFullPlaced: true })}
              >
                {t('Провести')}
              </Button>
            )}
            {!model.order?.IsPlaced && canGetUp && (
              <Button
                color="blue"
                disabled={model.isBusy || model.isDirty}
                variant="light"
                onClick={() => model.setConfirmPlacement({ isFullPlaced: false })}
              >
                {t('Оприходувати')}
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      {model.error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {model.error}
        </Alert>
      )}

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <DataTable
            columns={columns}
            data={model.gridRows}
            emptyText={t('Замовлень не знайдено')}
            getRowId={(gridRow) => String(gridRow.item.NetUid || gridRow.item.Id || gridRow.index)}
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-placements-1"
            maxHeight="calc(100vh - 360px)"
            minWidth={1100}
            tableId="warehouse-ukraine-placements"
          />

          <Group gap="xl" justify="flex-end">
            <Text size="sm">
              {t('Всього товарів')}: <Text span fw={700}>{model.totalProductsCount}</Text>
            </Text>
            <Text size="sm">
              {t('Заг. вага нетто')}: <Text span fw={700}>{model.totalNetWeight.toFixed(3)}</Text>
            </Text>
          </Group>
        </Stack>
      </Card>

      <NewDynamicColumnModal
        key={model.columnModalOpen ? 'warehouse-column-open' : 'warehouse-column-closed'}
        disabled={model.isBusy}
        opened={model.columnModalOpen}
        onAdd={model.handleAddColumn}
        onClose={() => model.setColumnModalOpen(false)}
      />

      <PlacementEditDrawer
        key={getDrawerKey(model.drawer)}
        item={model.drawer?.item || null}
        opened={Boolean(model.drawer)}
        row={model.drawer?.row || null}
        selectedStorage={model.selectedStorage}
        onApply={model.handleApplyPlacements}
        onClose={() => model.setDrawer(null)}
      />

      <AppModal
        opened={Boolean(model.columnToRemove)}
        title={t('Ви впевнені, що хочете видалити?')}
        onClose={() => {
          if (!model.isBusy) {
            model.setColumnToRemove(null)
          }
        }}
      >
        <Group justify="flex-end">
          <Button color="gray" disabled={model.isBusy} variant="light" onClick={() => model.setColumnToRemove(null)}>
            {t('Скасувати')}
          </Button>
          <Button color="red" disabled={model.isBusy} loading={model.isSaving} onClick={model.confirmRemoveColumn}>
            {t('Видалити')}
          </Button>
        </Group>
      </AppModal>

      <AppModal
        opened={Boolean(model.confirmPlacement)}
        title={t('Ви впевнені?')}
        onClose={() => (model.isBusy ? undefined : model.setConfirmPlacement(null))}
      >
        <Stack gap="md">
          <Text>
            {model.confirmPlacement?.isFullPlaced
              ? t('Провести замовлення повністю?')
              : t('Оприходувати замовлення?')}
          </Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={model.isBusy} variant="light" onClick={() => model.setConfirmPlacement(null)}>
              {t('Скасувати')}
            </Button>
            <Button
              color="teal"
              disabled={model.isBusy}
              loading={model.isPlacing}
              onClick={() => model.placeOrder(Boolean(model.confirmPlacement?.isFullPlaced))}
            >
              {t('Підтвердити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function getDrawerKey(drawer: DrawerState | null): string {
  if (!drawer) {
    return 'closed'
  }

  return `${drawer.columnId}-${drawer.item.NetUid || drawer.item.Id || 'item'}-${drawer.row.NetUid || drawer.row.Id || 'row'}`
}

function isValidDateInputValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value
}
