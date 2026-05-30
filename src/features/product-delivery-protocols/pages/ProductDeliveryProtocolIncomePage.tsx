import { ActionIcon, Alert, Button, Card, Checkbox, Group, NumberInput, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconColumnInsertRight, IconTrash } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getProtocolByNetId } from '../api/productDeliveryProtocolsApi'
import {
  createUkraineProductIncomeFromDynamic,
  getNonDefectiveStorages,
  getPackingListSpecificationProducts,
  getSupplyOrderInvoiceItems,
  markAllItemsReadyToPlace,
  markOrderItemReadyToPlace,
  updatePackingListPlacement,
  updateVatOfPackListInvoiceItems,
} from '../api/protocolProductIncomeApi'
import { NewIncomeDynamicColumnModal } from '../components/NewIncomeDynamicColumnModal'
import { ProtocolIncomePlacementDrawer } from '../components/ProtocolIncomePlacementDrawer'
import type {
  DynamicProductPlacement,
  DynamicProductPlacementColumn,
  DynamicProductPlacementRow,
  IncomeGridRow,
  IncomePackingList,
  IncomeProtocol,
  IncomeStorage,
  IncomeSupplyInvoice,
  PackingListPackageOrderItem,
} from '../productIncomeTypes'

const DEFAULT_VAT_PERCENT = 23

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function columnKey(column: DynamicProductPlacementColumn): string {
  return column.NetUid || String(column.Id || '')
}

function sumPlacements(placements: DynamicProductPlacement[]): number {
  return placements.reduce((total, placement) => total + (placement.Qty || 0), 0)
}

function findRowForItem(
  column: DynamicProductPlacementColumn,
  item: PackingListPackageOrderItem,
): DynamicProductPlacementRow | undefined {
  return column.DynamicProductPlacementRows.find((row) => row.PackingListPackageOrderItemId === item.Id)
}

function buildGridRows(packingList: IncomePackingList): IncomeGridRow[] {
  return packingList.PackingListPackageOrderItems.map((item, index) => {
    const rowsByColumn = new Map<string, DynamicProductPlacementRow>()

    packingList.DynamicProductPlacementColumns.forEach((column) => {
      const existing = findRowForItem(column, item)

      rowsByColumn.set(
        columnKey(column),
        existing || {
          Qty: 0,
          PackingListPackageOrderItemId: item.Id,
          DynamicProductPlacementColumnId: column.Id,
          DynamicProductPlacements: [],
        },
      )
    })

    return { index: index + 1, item, rowsByColumn }
  })
}

function columnHasAppliedPlacements(column: DynamicProductPlacementColumn): boolean {
  return column.DynamicProductPlacementRows.some((row) =>
    row.DynamicProductPlacements.some((placement) => placement.IsApplied),
  )
}

function lastSpecificationProp(item: PackingListPackageOrderItem, key: 'SpecificationCode'): string {
  const specs = item.SupplyInvoiceOrderItem?.Product?.ProductSpecifications || []

  if (specs.length === 0) {
    return ''
  }

  return specs[specs.length - 1][key] || ''
}

type DrawerState = {
  item: PackingListPackageOrderItem
  row: DynamicProductPlacementRow
  columnId: string
}

function useProtocolIncomeModel() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [protocol, setProtocol] = useValueState<IncomeProtocol | null>(null)
  const [storages, setStorages] = useValueState<IncomeStorage[]>([])
  const [selectedStorageId, setSelectedStorageId] = useValueState<string | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useValueState<string | null>(null)
  const [invoice, setInvoice] = useValueState<IncomeSupplyInvoice | null>(null)
  const [packingList, setPackingList] = useValueState<IncomePackingList | null>(null)
  const [fromDate, setFromDate] = useValueState<string>(() => formatLocalDate(new Date()))
  const [vatPercent, setVatPercent] = useValueState<number>(DEFAULT_VAT_PERCENT)
  const [isDirty, setDirty] = useValueState(false)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [reloadKey, setReloadKey] = useValueState(0)
  const [columnModalOpen, setColumnModalOpen] = useValueState(false)
  const [columnToRemove, setColumnToRemove] = useValueState<DynamicProductPlacementColumn | null>(null)
  const [confirmCarryOut, setConfirmCarryOut] = useValueState(false)
  const [drawer, setDrawer] = useValueState<DrawerState | null>(null)

  useEffect(() => {
    if (!id) {
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [loadedProtocol, loadedStorages] = await Promise.all([
          getProtocolByNetId(id as string),
          getNonDefectiveStorages(),
        ])

        if (cancelled) {
          return
        }

        const normalizedProtocol: IncomeProtocol = {
          ...(loadedProtocol as unknown as IncomeProtocol),
          SupplyInvoices: Array.isArray(loadedProtocol?.SupplyInvoices)
            ? (loadedProtocol?.SupplyInvoices as unknown as IncomeSupplyInvoice[])
            : [],
        }

        setProtocol(normalizedProtocol)
        setStorages(loadedStorages)
        setSelectedStorageId((current) => current || loadedStorages[0]?.NetUid || null)
        setSelectedInvoiceId((current) => current || normalizedProtocol.SupplyInvoices[0]?.NetUid || null)
        setDirty(false)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
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
  }, [
    id, reloadKey, setDirty, setError, setLoading, setProtocol, setSelectedInvoiceId, setSelectedStorageId, setStorages, t,
  ])

  useEffect(() => {
    if (!selectedInvoiceId) {
      setInvoice(null)
      setPackingList(null)
      return
    }

    let cancelled = false

    async function loadInvoice(netId: string) {
      try {
        const loadedInvoice = await getSupplyOrderInvoiceItems(netId)

        if (cancelled) {
          return
        }

        setInvoice(loadedInvoice)
        setPackingList(null)
        setDirty(false)

        const firstPackList = loadedInvoice.PackingLists[0]

        if (firstPackList?.NetUid) {
          const loadedPackList = await getPackingListSpecificationProducts(firstPackList.NetUid)

          if (!cancelled) {
            setPackingList(loadedPackList)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
        }
      }
    }

    void loadInvoice(selectedInvoiceId)

    return () => {
      cancelled = true
    }
  }, [selectedInvoiceId, reloadKey, setDirty, setError, setInvoice, setPackingList, t])

  const selectPackingList = useCallback(
    async (netId: string) => {
      try {
        const loadedPackList = await getPackingListSpecificationProducts(netId)
        setPackingList(loadedPackList)
        setDirty(false)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
      }
    },
    [setDirty, setError, setPackingList, t],
  )

  const gridRows = useMemo(() => (packingList ? buildGridRows(packingList) : []), [packingList])

  const reloadFromServer = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [setReloadKey])

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === selectedStorageId) || null,
    [selectedStorageId, storages],
  )

  const applyColumnRowQty = useCallback(
    (columnId: string, item: PackingListPackageOrderItem, qty: number, placements: DynamicProductPlacement[]) => {
      setPackingList((current) => {
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
                PackingListPackageOrderItemId: item.Id,
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
    [setDirty, setPackingList],
  )

  const handleCellChange = useCallback(
    (gridRow: IncomeGridRow, columnId: string, value: number) => {
      const { item } = gridRow
      const qtyToSet = Math.trunc(value)
      const itemQty = item.Qty || 0

      const otherColumnsTotal = Array.from(gridRow.rowsByColumn.entries())
        .filter(([key]) => key !== columnId)
        .reduce((total, [, row]) => total + (row.Qty || 0), 0)

      if (!qtyToSet || otherColumnsTotal + qtyToSet > itemQty) {
        notifications.show({ color: 'red', message: t('Невірна кількість') })
        return
      }

      const currentRow = gridRow.rowsByColumn.get(columnId)
      const placements = currentRow ? currentRow.DynamicProductPlacements.map((placement) => ({ ...placement })) : []
      const placedQty = sumPlacements(placements)

      if (qtyToSet < placedQty) {
        notifications.show({
          color: 'red',
          message: t('Неможливо записати меншу кількість ніж розміщено. Для зменшення, необхідно видалити розміщення'),
        })
        return
      }

      let nextPlacements: DynamicProductPlacement[]

      if (placements[0] && !placements[0].IsApplied) {
        nextPlacements = placements.map((placement, index) =>
          index === 0 ? { ...placement, Qty: qtyToSet } : placement,
        )
      } else {
        nextPlacements = [
          ...placements,
          { StorageNumber: 'N', RowNumber: 'N', CellNumber: 'N', Qty: qtyToSet, IsApplied: false },
        ]
      }

      applyColumnRowQty(columnId, item, qtyToSet, nextPlacements)
    },
    [applyColumnRowQty, t],
  )

  const handleNetWeightChange = useCallback(
    (item: PackingListPackageOrderItem, value: number) => {
      setPackingList((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          PackingListPackageOrderItems: current.PackingListPackageOrderItems.map((entry) =>
            entry === item ? { ...entry, NetWeight: value } : entry,
          ),
        }
      })
      setDirty(true)
    },
    [setDirty, setPackingList],
  )

  const handleReadyToPlace = useCallback(
    async (item: PackingListPackageOrderItem) => {
      if (item.IsReadyToPlaced || !item.NetUid) {
        return
      }

      try {
        await markOrderItemReadyToPlace(item.NetUid, true)
        setPackingList((current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            PackingListPackageOrderItems: current.PackingListPackageOrderItems.map((entry) =>
              entry === item ? { ...entry, IsReadyToPlaced: true } : entry,
            ),
          }
        })
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати запит'))
      }
    },
    [setError, setPackingList, t],
  )

  const handleOpenPlacements = useCallback(
    (gridRow: IncomeGridRow, columnId: string, row: DynamicProductPlacementRow) => {
      if (!row.Qty) {
        notifications.show({ color: 'red', message: t('Неможливо розмісти нульову кількість') })
        return
      }

      setDrawer({ item: gridRow.item, row, columnId })
    },
    [setDrawer, t],
  )

  const handleApplyPlacements = useCallback(
    (placements: DynamicProductPlacement[]) => {
      if (!drawer) {
        return
      }

      applyColumnRowQty(drawer.columnId, drawer.item, sumPlacements(placements), placements)
      setDrawer(null)
    },
    [applyColumnRowQty, drawer, setDrawer],
  )

  const persistPackingList = useCallback(
    async (nextPackingList: IncomePackingList) => {
      if (!selectedInvoiceId) {
        return
      }

      setSaving(true)
      setError(null)

      try {
        const saved = await updatePackingListPlacement(selectedInvoiceId, nextPackingList)
        setPackingList(saved)
        setDirty(false)
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти зміни'))
      } finally {
        setSaving(false)
      }
    },
    [selectedInvoiceId, setDirty, setError, setPackingList, setSaving, t],
  )

  const handleSave = useCallback(() => {
    if (packingList) {
      void persistPackingList(packingList)
    }
  }, [packingList, persistPackingList])

  const handleAddColumn = useCallback(
    (columnFromDate: string) => {
      setColumnModalOpen(false)

      if (!packingList) {
        return
      }

      const nextColumn: DynamicProductPlacementColumn = {
        FromDate: columnFromDate,
        PackingListId: packingList.Id,
        DynamicProductPlacementRows: [],
      }

      void persistPackingList({
        ...packingList,
        DynamicProductPlacementColumns: [...packingList.DynamicProductPlacementColumns, nextColumn],
      })
    },
    [packingList, persistPackingList, setColumnModalOpen],
  )

  const confirmRemoveColumn = useCallback(() => {
    if (!columnToRemove || !packingList) {
      return
    }

    const nextColumns = packingList.DynamicProductPlacementColumns.filter((column) => column !== columnToRemove)
    const nextPackingList = { ...packingList, DynamicProductPlacementColumns: nextColumns }
    setColumnToRemove(null)

    if (columnToRemove.Id && columnToRemove.Id > 0) {
      void persistPackingList(nextPackingList)
    } else {
      setPackingList(nextPackingList)
    }
  }, [columnToRemove, packingList, persistPackingList, setColumnToRemove, setPackingList])

  const handleMoveRemnants = useCallback(
    (column: DynamicProductPlacementColumn) => {
      if (isDirty) {
        notifications.show({ color: 'red', message: t('Збережіть зміни перед переміщенням залишків') })
        return
      }

      setPackingList((current) => {
        if (!current) {
          return current
        }

        const targetKey = columnKey(column)

        const columns = current.DynamicProductPlacementColumns.map((iterColumn) => {
          if (columnKey(iterColumn) !== targetKey) {
            return iterColumn
          }

          const rows = current.PackingListPackageOrderItems.map((item) => {
            const placedElsewhere = current.DynamicProductPlacementColumns
              .filter((other) => columnKey(other) !== targetKey)
              .reduce((total, other) => {
                const otherRow = findRowForItem(other, item)
                return total + (otherRow?.Qty || 0)
              }, 0)

            const qtyToSet = (item.Qty || 0) - (placedElsewhere + (item.PlacedQty || 0))
            const existing = findRowForItem(iterColumn, item)
            const placements = existing ? existing.DynamicProductPlacements.map((placement) => ({ ...placement })) : []

            let nextPlacements: DynamicProductPlacement[]

            if (placements[0] && !placements[0].IsApplied) {
              nextPlacements = placements.map((placement, index) =>
                index === 0 ? { ...placement, Qty: qtyToSet } : placement,
              )
            } else {
              nextPlacements = [
                ...placements,
                { StorageNumber: 'N', RowNumber: 'N', CellNumber: 'N', Qty: qtyToSet, IsApplied: false },
              ]
            }

            return existing
              ? { ...existing, Qty: qtyToSet, DynamicProductPlacements: nextPlacements }
              : {
                  Qty: qtyToSet,
                  PackingListPackageOrderItemId: item.Id,
                  DynamicProductPlacementColumnId: iterColumn.Id,
                  DynamicProductPlacements: nextPlacements,
                }
          })

          return { ...iterColumn, DynamicProductPlacementRows: rows }
        })

        return { ...current, DynamicProductPlacementColumns: columns }
      })

      setDirty(true)
    },
    [isDirty, setDirty, setPackingList, t],
  )

  const handleCalculateVat = useCallback(async () => {
    if (!packingList || !invoice) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextInvoice: IncomeSupplyInvoice = {
        ...invoice,
        PackingLists: invoice.PackingLists.map((list) =>
          list.NetUid === packingList.NetUid
            ? {
                ...packingList,
                PackingListPackageOrderItems: packingList.PackingListPackageOrderItems.map((item) => ({
                  ...item,
                  VatPercent: vatPercent,
                })),
              }
            : list,
        ),
      }

      const saved = await updateVatOfPackListInvoiceItems(nextInvoice)
      setInvoice(saved)

      const savedPackList = saved.PackingLists.find((list) => list.NetUid === packingList.NetUid)

      if (savedPackList?.NetUid) {
        await selectPackingList(savedPackList.NetUid)
      }
    } catch (vatError) {
      setError(vatError instanceof Error ? vatError.message : t('Не вдалося зберегти зміни'))
    } finally {
      setSaving(false)
    }
  }, [invoice, packingList, selectPackingList, setError, setInvoice, setSaving, t, vatPercent])

  const handleAllReadyToPlace = useCallback(async () => {
    if (!packingList?.NetUid) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const saved = await markAllItemsReadyToPlace(packingList.NetUid)
      setPackingList(saved)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }, [packingList, setError, setPackingList, setSaving, t])

  const handleCarryOut = useCallback(async () => {
    setConfirmCarryOut(false)

    if (!packingList || !selectedStorage?.NetUid) {
      notifications.show({ color: 'red', message: t('Виберіть склад') })
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createUkraineProductIncomeFromDynamic(toIso(fromDate), selectedStorage.NetUid, {
        ...packingList,
        IsPlaced: true,
      })
      reloadFromServer()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }, [fromDate, packingList, reloadFromServer, selectedStorage, setConfirmCarryOut, setError, setSaving, t])

  const handleProductIncome = useCallback(async () => {
    if (!packingList || !selectedStorage?.NetUid) {
      notifications.show({ color: 'red', message: t('Виберіть склад') })
      return
    }

    setSaving(true)
    setError(null)

    try {
      await createUkraineProductIncomeFromDynamic(toIso(fromDate), selectedStorage.NetUid, packingList)
      reloadFromServer()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }, [fromDate, packingList, reloadFromServer, selectedStorage, setError, setSaving, t])

  const placementStatus = useMemo(() => {
    if (packingList?.IsPlaced || invoice?.IsFullyPlaced) {
      return t('Оприходуваний')
    }

    if (invoice?.IsPartiallyPlaced) {
      return t('Частково оприходуваний')
    }

    return t('Не оприходуваний')
  }, [invoice, packingList, t])

  const totalQty = useMemo(
    () =>
      (packingList?.PackingListPackageOrderItems || []).reduce((total, item) => total + (item.Qty || 0), 0),
    [packingList],
  )

  return {
    columnModalOpen, columnToRemove, confirmCarryOut, confirmRemoveColumn, drawer, error, fromDate, gridRows,
    handleAddColumn, handleAllReadyToPlace, handleApplyPlacements, handleCalculateVat, handleCarryOut, handleCellChange,
    handleMoveRemnants, handleNetWeightChange, handleOpenPlacements, handleProductIncome, handleReadyToPlace,
    handleSave, invoice, isDirty, isLoading, isSaving, navigate, packingList, placementStatus, protocol, reloadFromServer,
    selectPackingList, selectedInvoiceId, selectedStorage, selectedStorageId, setColumnModalOpen, setColumnToRemove,
    setConfirmCarryOut, setDrawer, setFromDate, setSelectedInvoiceId, setSelectedStorageId, setVatPercent, storages,
    totalQty, vatPercent,
  }
}

function toIso(value: string): string {
  if (!value) {
    return new Date().toISOString()
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export function ProductDeliveryProtocolIncomePage() {
  const model = useProtocolIncomeModel()
  const { t } = useI18n()

  const isPlaced = Boolean(model.packingList?.IsPlaced)
  const hasColumns = (model.packingList?.DynamicProductPlacementColumns.length || 0) > 0

  const columns = useMemo<DataTableColumn<IncomeGridRow>[]>(() => {
    const fixedColumns: DataTableColumn<IncomeGridRow>[] = [
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
        id: 'name',
        header: t('Назва'),
        minWidth: 220,
        cell: (gridRow) =>
          gridRow.item.SupplyInvoiceOrderItem?.Product?.Name ||
          gridRow.item.SupplyInvoiceOrderItem?.Product?.NameUA ||
          '-',
      },
      {
        id: 'vendorCode',
        header: t('Код Виробника'),
        width: 160,
        cell: (gridRow) => gridRow.item.SupplyInvoiceOrderItem?.Product?.VendorCode || '-',
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
        enableSorting: false,
        cell: (gridRow) => (
          <NumberInput
            allowDecimal
            decimalScale={3}
            disabled={isPlaced}
            hideControls
            size="xs"
            value={Number((gridRow.item.NetWeight || 0).toFixed(3))}
            w={100}
            onBlur={(event) => {
              const nextValue = Number(event.currentTarget.value)
              if (nextValue !== (gridRow.item.NetWeight || 0)) {
                model.handleNetWeightChange(gridRow.item, nextValue)
              }
            }}
          />
        ),
      },
      {
        id: 'grossWeight',
        header: t('Вага Брутто'),
        width: 120,
        align: 'right',
        cell: (gridRow) => (gridRow.item.GrossWeight || 0).toFixed(3),
      },
      {
        id: 'specificationCode',
        header: t('Митний код'),
        width: 140,
        cell: (gridRow) => lastSpecificationProp(gridRow.item, 'SpecificationCode') || '-',
      },
      {
        id: 'unitPrice',
        header: t('Ціна за одиницю нетто'),
        width: 140,
        align: 'right',
        cell: (gridRow) => (gridRow.item.UnitPrice || 0).toFixed(2),
      },
      {
        id: 'readyToPlace',
        header: t('Готовий до оприходування'),
        width: 120,
        align: 'center',
        enableSorting: false,
        cell: (gridRow) => (
          <Checkbox
            checked={Boolean(gridRow.item.IsReadyToPlaced)}
            disabled={Boolean(gridRow.item.IsReadyToPlaced) || isPlaced}
            onChange={() => model.handleReadyToPlace(gridRow.item)}
          />
        ),
      },
      {
        id: 'isPlaced',
        header: t('Оприходуваний'),
        width: 120,
        align: 'center',
        cell: (gridRow) => (gridRow.item.IsPlaced ? t('Так') : t('Ні')),
      },
      {
        id: 'totalNetPrice',
        header: t('Заг. вартість нетто'),
        width: 140,
        align: 'right',
        cell: (gridRow) => (gridRow.item.TotalNetPrice || 0).toFixed(2),
      },
      {
        id: 'placedQty',
        header: t('К-сть оприходуваних'),
        width: 160,
        align: 'right',
        cell: (gridRow) => gridRow.item.PlacedQty || 0,
      },
      {
        id: 'placement',
        header: t('Ячейка'),
        width: 160,
        cell: (gridRow) => gridRow.item.Placement || '-',
      },
    ]

    const dynamicColumns: DataTableColumn<IncomeGridRow>[] = (
      model.packingList?.DynamicProductPlacementColumns || []
    ).map((column) => {
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
                disabled={isPlaced}
                hideControls
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
    })

    return [...fixedColumns, ...dynamicColumns]
  }, [isPlaced, model, t])

  const protocolNumber = model.protocol?.DeliveryProductProtocolNumber?.Number || ''

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Button
          color="gray"
          leftSection={<IconArrowLeft size={16} />}
          variant="subtle"
          onClick={() => model.navigate('/product-delivery-protocols')}
        >
          {t('Назад')}
        </Button>
        <Text fw={700} size="lg">
          {`${t('Прихід товару згідно замовлення')}: ${protocolNumber}`}
        </Text>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Group gap="xl" wrap="wrap">
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              {t('Статус')}
            </Text>
            <Text size="sm">{model.placementStatus}</Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              {t('Від')}
            </Text>
            <Text size="sm">{formatDate(model.protocol?.FromDate)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              {t('Організація')}
            </Text>
            <Text size="sm">{model.protocol?.Organization?.Name || '-'}</Text>
          </Stack>
        </Group>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" align="end" wrap="wrap">
          <Group gap="sm" align="end">
            <Select
              data={(model.protocol?.SupplyInvoices || []).map((supplyInvoice) => ({
                value: supplyInvoice.NetUid || '',
                label: supplyInvoice.Number || supplyInvoice.NetUid || '',
              }))}
              label={t('Накладна')}
              value={model.selectedInvoiceId}
              w={220}
              onChange={(value) => model.setSelectedInvoiceId(value)}
            />
            <Select
              data={(model.invoice?.PackingLists || []).map((list) => ({
                value: list.NetUid || '',
                label: list.No || list.PlNo || list.NetUid || '',
              }))}
              label={t('Пакувальний лист')}
              value={model.packingList?.NetUid || null}
              w={220}
              onChange={(value) => value && void model.selectPackingList(value)}
            />
            {!isPlaced && (
              <Select
                data={model.storages.map((storage) => ({ value: storage.NetUid || '', label: storage.Name || '' }))}
                label={t('Склад')}
                value={model.selectedStorageId}
                w={220}
                onChange={(value) => model.setSelectedStorageId(value)}
              />
            )}
            <TextInput
              disabled={model.isDirty}
              label={t('Від якої дати')}
              type="date"
              value={model.fromDate}
              onChange={(event) => model.setFromDate(event.currentTarget.value)}
            />
            <NumberInput
              disabled={model.isDirty}
              label={t('Відсоток ПДВ')}
              min={0}
              suffix="%"
              value={model.vatPercent}
              w={120}
              onChange={(value) => model.setVatPercent(typeof value === 'number' ? value : Number(value) || 0)}
            />
          </Group>
        </Group>

        <Group gap="sm" mt="md" wrap="wrap">
          <Button disabled={model.isDirty} variant="light" onClick={() => void model.handleCalculateVat()}>
            {t('Розрахувати ПДВ')}
          </Button>
          {!isPlaced && (
            <Button disabled={model.isDirty} variant="light" onClick={() => model.setColumnModalOpen(true)}>
              {t('Додати')}
            </Button>
          )}
          {!isPlaced && (
            <Button disabled={model.isDirty} variant="light" onClick={() => void model.handleAllReadyToPlace()}>
              {t('Всі товари готові до оприходування')}
            </Button>
          )}
          {!isPlaced && hasColumns && (
            <Button disabled={model.isDirty} variant="light" onClick={() => void model.handleProductIncome()}>
              {t('Оприходувати')}
            </Button>
          )}
          {!isPlaced && hasColumns && (
            <Button disabled={model.isDirty} variant="light" onClick={() => model.setConfirmCarryOut(true)}>
              {t('Провести')}
            </Button>
          )}
          <Group gap="sm" ml="auto">
            {model.isDirty && (
              <Text c="orange" size="sm">
                {t('Є незбережені зміни')}
              </Text>
            )}
            {model.isDirty && (
              <Button color="gray" variant="light" onClick={model.reloadFromServer}>
                {t('Скасувати')}
              </Button>
            )}
            <Button disabled={!model.isDirty} loading={model.isSaving} onClick={model.handleSave}>
              {t('Зберегти')}
            </Button>
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
            emptyText={t('Дані відсутні')}
            getRowId={(gridRow) => String(gridRow.item.NetUid || gridRow.item.Id || gridRow.index)}
            isLoading={model.isLoading}
            layoutVersion="protocol-product-income-1"
            maxHeight="calc(100vh - 420px)"
            minWidth={1400}
            tableId="protocol-product-income"
          />

          <Group gap="xl" justify="flex-end">
            <Text size="sm">
              {t('К-сть')}: <Text span fw={700}>{model.totalQty}</Text>
            </Text>
            <Text size="sm">
              {t('Митна вартість')}: <Text span fw={700}>{(model.packingList?.TotalCustomValue || 0).toFixed(2)}</Text>
            </Text>
            <Text size="sm">
              {t('Заг. вартість нетто')}: <Text span fw={700}>{(model.packingList?.TotalNetPrice || 0).toFixed(2)}</Text>
            </Text>
            <Text size="sm">
              {t('Заг. вага нетто')}: <Text span fw={700}>{(model.packingList?.TotalNetWeight || 0).toFixed(3)}</Text>
            </Text>
            <Text size="sm">
              {t('Заг. вага брутто')}: <Text span fw={700}>{(model.packingList?.TotalGrossWeight || 0).toFixed(3)}</Text>
            </Text>
          </Group>
        </Stack>
      </Card>

      <NewIncomeDynamicColumnModal
        opened={model.columnModalOpen}
        onAdd={model.handleAddColumn}
        onClose={() => model.setColumnModalOpen(false)}
      />

      <ProtocolIncomePlacementDrawer
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
        onClose={() => model.setColumnToRemove(null)}
      >
        <Group justify="flex-end">
          <Button color="gray" variant="light" onClick={() => model.setColumnToRemove(null)}>
            {t('Скасувати')}
          </Button>
          <Button color="red" onClick={model.confirmRemoveColumn}>
            {t('Видалити')}
          </Button>
        </Group>
      </AppModal>

      <AppModal
        opened={model.confirmCarryOut}
        title={t('Ви підтверджуєте дію?')}
        onClose={() => model.setConfirmCarryOut(false)}
      >
        <Group justify="flex-end">
          <Button color="gray" variant="light" onClick={() => model.setConfirmCarryOut(false)}>
            {t('Скасувати')}
          </Button>
          <Button onClick={() => void model.handleCarryOut()}>{t('Провести')}</Button>
        </Group>
      </AppModal>
    </Stack>
  )
}
