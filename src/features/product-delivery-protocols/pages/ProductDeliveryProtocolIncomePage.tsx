import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconColumnInsertRight,
  IconDownload,
  IconFileTypePdf,
  IconHistory,
  IconTrash,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import type { ExportDocument } from '../../../shared/documents/exportDocument'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { useAuth } from '../../auth/useAuth'
import { getDirectSupplyOrderById } from '../../supply-ukraine-orders/api/supplyUkraineOrdersApi'
import type { DirectSupplyOrder } from '../../supply-ukraine-orders/types'
import { getProtocolByNetId } from '../api/productDeliveryProtocolsApi'
import {
  createProductIncomeFromPackingListDynamic,
  getOrganizationStorages,
  getPackingListSpecificationProducts,
  getPzDocumentBySupplyInvoiceId,
  getProductIncomeByDeliveryProtocolNetId,
  getProductIncomeBySupplyOrderNetId,
  getSupplyOrderItemAudit,
  getSupplyOrderInvoiceItems,
  markAllItemsReadyToPlace,
  markOrderItemReadyToPlace,
  recordProductIncomeFromPackingListDynamicHistory,
  updatePackingListPlacement,
  updateVatOfPackListInvoiceItems,
} from '../api/protocolProductIncomeApi'
import { NewIncomeDynamicColumnModal } from '../components/NewIncomeDynamicColumnModal'
import { ProtocolIncomePlacementDrawer } from '../components/ProtocolIncomePlacementDrawer'
import type {
  IncomeAuditEntity,
  DynamicProductPlacement,
  DynamicProductPlacementColumn,
  DynamicProductPlacementRow,
  IncomeGridRow,
  IncomePackingList,
  IncomeProductIncome,
  IncomeProtocol,
  IncomeStorage,
  IncomeSupplyInvoice,
  PackingListPackageOrderItem,
} from '../productIncomeTypes'
import { isInvoiceAllNotPlaced } from '../productIncomePlacementState'

const DEFAULT_VAT_PERCENT = 23
const PERMISSION_ADD_DYNAMIC_INCOME_COLUMN = 'PRODUCT_INCOME_ordersUkraineAllEdit_NewInvoiceBtn_PKEY'
const PERMISSION_CAPITALIZE_DYNAMIC_INCOME = 'PRODUCT_INCOME_ordersUkraineAllEdit_CapitalizeBtn_PKEY'
const PERMISSION_CARRY_OUT_DYNAMIC_INCOME = 'PRODUCT_INCOME_ordersUkraineAllEdit_CarryOutBtn_PKEY'
const PERMISSION_VIEW_WEIGHT_HISTORY = 'PRODUCT_INCOME_ordersUkraineAllEdit_historyOfChangesInWeight_PKEY'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function displayValue(value?: number | string | null): string {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '-'
  }

  return String(value)
}

function getIncomeUserName(user?: IncomeProductIncome['User']): string {
  return [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ') || user?.Name || '-'
}

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

function sumPendingRowQty(row?: DynamicProductPlacementRow): number {
  if (!row) {
    return 0
  }

  return Math.max((row.Qty || 0) - sumAppliedPlacements(row.DynamicProductPlacements), 0)
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
  return getLastProductSpecification(item)?.[key] || ''
}

function lastSpecificationNumberProp(
  item: PackingListPackageOrderItem,
  key: 'CustomsValue' | 'DutyPercent',
): number | undefined {
  return getLastProductSpecification(item)?.[key]
}

function getLastProductSpecification(item: PackingListPackageOrderItem) {
  const specifications = item.SupplyInvoiceOrderItem?.Product?.ProductSpecifications || []

  return specifications.reduce<(typeof specifications)[number] | null>((latest, current) => {
    if (!latest) {
      return current
    }

    const currentTime = getDateTime(current.Created)
    const latestTime = getDateTime(latest.Created)

    if (currentTime > latestTime) {
      return current
    }

    if (currentTime === latestTime && (current.Id || 0) > (latest.Id || 0)) {
      return current
    }

    return latest
  }, null)
}

function getDateTime(value?: Date | string): number {
  if (!value) {
    return 0
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

type DrawerState = {
  item: PackingListPackageOrderItem
  row: DynamicProductPlacementRow
  columnId: string
}

type PendingDirtyAction =
  | { type: 'invoice'; netId: string | null }
  | { type: 'navigate'; path: string }
  | { type: 'pack-list'; netId: string }
  | { type: 'reload' }

type ProductIncomeSource = 'delivery-protocol' | 'direct-supply-order'

type DownloadState = {
  document: ExportDocument | null
  error: string | null
  isLoading: boolean
  opened: boolean
}

const CLOSED_DOWNLOAD_STATE: DownloadState = {
  document: null,
  error: null,
  isLoading: false,
  opened: false,
}

function normalizeProtocolIncomeSource(protocol: unknown): IncomeProtocol {
  const payload = protocol && typeof protocol === 'object' ? (protocol as Partial<IncomeProtocol>) : {}

  return {
    ...(payload as IncomeProtocol),
    SupplyInvoices: Array.isArray(payload.SupplyInvoices) ? payload.SupplyInvoices : [],
  }
}

function normalizeDirectSupplyOrderIncomeSource(order: DirectSupplyOrder | null): IncomeProtocol {
  if (!order) {
    return { SupplyInvoices: [] }
  }

  return {
    ...(order as unknown as IncomeProtocol),
    DeliveryProductProtocolNumber: null,
    FromDate: order.DateFrom,
    Organization: order.Organization as IncomeProtocol['Organization'],
    SupplyInvoices: Array.isArray(order.SupplyInvoices)
      ? (order.SupplyInvoices as unknown as IncomeSupplyInvoice[])
      : [],
    SupplyOrderNumber: order.SupplyOrderNumber || null,
  }
}

function getIncomeSourceNumber(source: ProductIncomeSource, protocol?: IncomeProtocol | null): string {
  if (source === 'direct-supply-order') {
    return protocol?.SupplyOrderNumber?.Number || protocol?.Number || ''
  }

  return protocol?.DeliveryProductProtocolNumber?.Number || ''
}

function isPlacementLocked(invoice: IncomeSupplyInvoice | null, packingList: IncomePackingList | null): boolean {
  return Boolean(invoice?.IsFullyPlaced || packingList?.IsPlaced)
}

function useProtocolIncomeModel(source: ProductIncomeSource) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [protocol, setProtocol] = useValueState<IncomeProtocol | null>(null)
  const [storages, setStorages] = useValueState<IncomeStorage[]>([])
  const [selectedStorageId, setSelectedStorageId] = useValueState<string | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useValueState<string | null>(null)
  const [invoice, setInvoice] = useValueState<IncomeSupplyInvoice | null>(null)
  const [packingList, setPackingList] = useValueState<IncomePackingList | null>(null)
  const [productIncome, setProductIncome] = useValueState<IncomeProductIncome | null>(null)
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
  const [pendingDirtyAction, setPendingDirtyAction] = useValueState<PendingDirtyAction | null>(null)
  const [pzDownload, setPzDownload] = useValueState<DownloadState>(CLOSED_DOWNLOAD_STATE)
  const packingListRequestRef = useRef(0)
  const pzDownloadRequestRef = useRef(0)

  useEffect(() => {
    if (!id) {
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [loadedSource, loadedProductIncome] = source === 'direct-supply-order'
          ? await Promise.all([
              getDirectSupplyOrderById(id as string).then(normalizeDirectSupplyOrderIncomeSource),
              getProductIncomeBySupplyOrderNetId(id as string),
            ])
          : await Promise.all([
              getProtocolByNetId(id as string).then(normalizeProtocolIncomeSource),
              getProductIncomeByDeliveryProtocolNetId(id as string),
            ])

        if (cancelled) {
          return
        }

        const organizationNetId = loadedSource.Organization?.NetUid
        const loadedStorages = organizationNetId ? await getOrganizationStorages(organizationNetId) : []

        if (!cancelled) {
          setProtocol(loadedSource)
          setProductIncome(loadedProductIncome)
          setStorages(loadedStorages)
          setSelectedStorageId((current) =>
            loadedStorages.some((storage) => storage.NetUid === current)
              ? current
              : loadedStorages[0]?.NetUid || null,
          )
          setSelectedInvoiceId((current) =>
            loadedSource.SupplyInvoices.some((invoice) => invoice.NetUid === current)
              ? current
              : loadedSource.SupplyInvoices[0]?.NetUid || null,
          )
          setDirty(false)
        }
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
    id, reloadKey, setDirty, setError, setLoading, setProductIncome, setProtocol, setSelectedInvoiceId,
    setSelectedStorageId, setStorages, source, t,
  ])

  const clearInvoiceAndPackingList = useCallback(() => {
    setInvoice(null)
    setPackingList(null)
  }, [setInvoice, setPackingList])

  const applyLoadedInvoice = useCallback(
    (loadedInvoice: IncomeSupplyInvoice) => {
      setInvoice(loadedInvoice)
      setDirty(false)
    },
    [setDirty, setInvoice],
  )

  const applyLoadedPackingList = useCallback(
    (loadedPackList: IncomePackingList) => {
      setPackingList(loadedPackList)
    },
    [setPackingList],
  )

  const failInvoiceLoad = useCallback(
    (loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
    },
    [setError, t],
  )

  useEffect(() => {
    if (!selectedInvoiceId) {
      packingListRequestRef.current += 1
      clearInvoiceAndPackingList()
      return
    }

    let cancelled = false
    const invoiceRequestId = packingListRequestRef.current + 1
    packingListRequestRef.current = invoiceRequestId
    clearInvoiceAndPackingList()

    async function loadInvoice(netId: string) {
      try {
        const loadedInvoice = await getSupplyOrderInvoiceItems(netId)

        if (cancelled || packingListRequestRef.current !== invoiceRequestId) {
          return
        }

        applyLoadedInvoice(loadedInvoice)

        const firstPackList = loadedInvoice.PackingLists[0]

        if (firstPackList?.NetUid) {
          const requestId = packingListRequestRef.current + 1
          packingListRequestRef.current = requestId
          const loadedPackList = await getPackingListSpecificationProducts(firstPackList.NetUid)

          if (!cancelled && packingListRequestRef.current === requestId) {
            applyLoadedPackingList(loadedPackList)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          failInvoiceLoad(loadError)
        }
      }
    }

    void loadInvoice(selectedInvoiceId)

    return () => {
      cancelled = true
    }
  }, [
    applyLoadedInvoice,
    applyLoadedPackingList,
    clearInvoiceAndPackingList,
    failInvoiceLoad,
    reloadKey,
    selectedInvoiceId,
  ])

  const selectPackingList = useCallback(
    async (netId: string) => {
      const requestId = packingListRequestRef.current + 1
      packingListRequestRef.current = requestId
      setPackingList(null)

      try {
        const loadedPackList = await getPackingListSpecificationProducts(netId)
        if (packingListRequestRef.current === requestId) {
          setPackingList(loadedPackList)
          setDirty(false)
        }
      } catch (loadError) {
        if (packingListRequestRef.current === requestId) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
        }
      }
    },
    [setDirty, setError, setPackingList, t],
  )

  const gridRows = useMemo(() => (packingList ? buildGridRows(packingList) : []), [packingList])

  const reloadFromServer = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [setReloadKey])

  const requestNavigate = useCallback(
    (path: string) => {
      if (isSaving) {
        return
      }

      if (isDirty) {
        setPendingDirtyAction({ type: 'navigate', path })
        return
      }

      navigate(path)
    },
    [isDirty, isSaving, navigate, setPendingDirtyAction],
  )

  const requestReloadFromServer = useCallback(() => {
    if (isSaving) {
      return
    }

    if (isDirty) {
      setPendingDirtyAction({ type: 'reload' })
      return
    }

    reloadFromServer()
  }, [isDirty, isSaving, reloadFromServer, setPendingDirtyAction])

  const requestSelectInvoiceId = useCallback(
    (netId: string | null) => {
      if (isSaving) {
        return
      }

      if (isDirty) {
        setPendingDirtyAction({ type: 'invoice', netId })
        return
      }

      setSelectedInvoiceId(netId)
    },
    [isDirty, isSaving, setPendingDirtyAction, setSelectedInvoiceId],
  )

  const requestSelectPackingList = useCallback(
    async (netId: string) => {
      if (isSaving) {
        return
      }

      if (isDirty) {
        setPendingDirtyAction({ type: 'pack-list', netId })
        return
      }

      await selectPackingList(netId)
    },
    [isDirty, isSaving, selectPackingList, setPendingDirtyAction],
  )

  const cancelDiscardChanges = useCallback(() => {
    setPendingDirtyAction(null)
  }, [setPendingDirtyAction])

  const confirmDiscardChanges = useCallback(() => {
    if (isSaving) {
      return
    }

    const action = pendingDirtyAction

    if (!action) {
      return
    }

    setPendingDirtyAction(null)
    setDirty(false)

    if (action.type === 'navigate') {
      navigate(action.path)
      return
    }

    if (action.type === 'invoice') {
      setSelectedInvoiceId(action.netId)
      return
    }

    if (action.type === 'pack-list') {
      void selectPackingList(action.netId)
      return
    }

    reloadFromServer()
  }, [
    isSaving,
    navigate,
    pendingDirtyAction,
    reloadFromServer,
    selectPackingList,
    setDirty,
    setPendingDirtyAction,
    setSelectedInvoiceId,
  ])

  const selectedStorage = useMemo(
    () => storages.find((storage) => storage.NetUid === selectedStorageId) || null,
    [selectedStorageId, storages],
  )
  const canUseIncome = source === 'direct-supply-order' || Boolean(protocol?.IsCompleted)

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
      if (!canUseIncome || isSaving || isPlacementLocked(invoice, packingList)) {
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
    [applyColumnRowQty, canUseIncome, invoice, isSaving, packingList, t],
  )

  const handleNetWeightChange = useCallback(
    (item: PackingListPackageOrderItem, value: number) => {
      if (!canUseIncome || isSaving || isPlacementLocked(invoice, packingList)) {
        return
      }

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
    [canUseIncome, invoice, isSaving, packingList, setDirty, setPackingList],
  )

  const handleReadyToPlace = useCallback(
    async (item: PackingListPackageOrderItem) => {
      if (!canUseIncome || item.IsReadyToPlaced || !item.NetUid || isSaving || isPlacementLocked(invoice, packingList)) {
        return
      }

      if (isDirty) {
        notifications.show({ color: 'red', message: t('Збережіть зміни перед дією') })
        return
      }

      setSaving(true)
      setError(null)

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
      } finally {
        setSaving(false)
      }
    },
    [canUseIncome, invoice, isDirty, isSaving, packingList, setError, setPackingList, setSaving, t],
  )

  const handleOpenPlacements = useCallback(
    (gridRow: IncomeGridRow, columnId: string, row: DynamicProductPlacementRow) => {
      if (!canUseIncome || isSaving) {
        return
      }

      if (isPlacementLocked(invoice, packingList)) {
        notifications.show({ color: 'red', message: t('Пак лист уже оприбуткований') })
        return
      }

      if (!row.Qty) {
        notifications.show({ color: 'red', message: t('Неможливо розмісти нульову кількість') })
        return
      }

      setDrawer({ item: gridRow.item, row, columnId })
    },
    [canUseIncome, invoice, isSaving, packingList, setDrawer, t],
  )

  const handleApplyPlacements = useCallback(
    (placements: DynamicProductPlacement[]) => {
      if (!canUseIncome || isSaving) {
        return
      }

      if (!drawer) {
        return
      }

      if (isPlacementLocked(invoice, packingList)) {
        notifications.show({ color: 'red', message: t('Пак лист уже оприбуткований') })
        setDrawer(null)
        return
      }

      applyColumnRowQty(drawer.columnId, drawer.item, sumPlacements(placements), placements)
      setDrawer(null)
    },
    [applyColumnRowQty, canUseIncome, drawer, invoice, isSaving, packingList, setDrawer, t],
  )

  const persistPackingList = useCallback(
    async (nextPackingList: IncomePackingList) => {
      if (!canUseIncome || !selectedInvoiceId || isSaving) {
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
    [canUseIncome, isSaving, selectedInvoiceId, setDirty, setError, setPackingList, setSaving, t],
  )

  const handleSave = useCallback(() => {
    if (packingList) {
      void persistPackingList(packingList)
    }
  }, [packingList, persistPackingList])

  const closePzDownload = useCallback(() => {
    pzDownloadRequestRef.current += 1
    setPzDownload(CLOSED_DOWNLOAD_STATE)
  }, [setPzDownload])

  const handleDownloadPzDocument = useCallback(async () => {
    const invoiceNetId = invoice?.NetUid

    if (!invoiceNetId) {
      notifications.show({ color: 'red', message: t('Виберіть накладну') })
      return
    }

    const requestId = pzDownloadRequestRef.current + 1
    pzDownloadRequestRef.current = requestId
    setPzDownload({
      document: null,
      error: null,
      isLoading: true,
      opened: true,
    })

    try {
      const document = await getPzDocumentBySupplyInvoiceId(invoiceNetId)

      if (pzDownloadRequestRef.current === requestId) {
        setPzDownload({
          document,
          error: null,
          isLoading: false,
          opened: true,
        })
      }
    } catch (downloadError) {
      if (pzDownloadRequestRef.current === requestId) {
        setPzDownload({
          document: null,
          error: downloadError instanceof Error ? downloadError.message : t('Документ PZ недоступний для завантаження'),
          isLoading: false,
          opened: true,
        })
      }
    }
  }, [invoice?.NetUid, setPzDownload, t])

  const handleAddColumn = useCallback(
    (columnFromDate: string) => {
      if (!canUseIncome || isSaving) {
        return
      }

      if (!packingList || isPlacementLocked(invoice, packingList)) {
        return
      }

      if (!isValidDateInputValue(columnFromDate)) {
        notifications.show({ color: 'yellow', message: t('Вкажіть коректну дату') })
        return
      }

      setColumnModalOpen(false)

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
    [canUseIncome, invoice, isSaving, packingList, persistPackingList, setColumnModalOpen, t],
  )

  const confirmRemoveColumn = useCallback(() => {
    if (
      !columnToRemove
      || !canUseIncome
      || !packingList
      || isPlacementLocked(invoice, packingList)
      || isDirty
      || isSaving
      || columnHasAppliedPlacements(columnToRemove)
    ) {
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
  }, [
    canUseIncome, columnToRemove, invoice, isDirty, isSaving, packingList, persistPackingList,
    setColumnToRemove, setPackingList,
  ])

  const handleMoveRemnants = useCallback(
    (column: DynamicProductPlacementColumn) => {
      if (!canUseIncome || isSaving || isPlacementLocked(invoice, packingList)) {
        return
      }

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
            const placedElsewhere = current.DynamicProductPlacementColumns.reduce((total, other) => {
              if (columnKey(other) === targetKey) {
                return total
              }

              return total + sumPendingRowQty(findRowForItem(other, item))
            }, 0)

            const qtyToSet = Math.max((item.Qty || 0) - (placedElsewhere + (item.PlacedQty || 0)), 0)
            const existing = findRowForItem(iterColumn, item)
            const placements = existing ? existing.DynamicProductPlacements.map((placement) => ({ ...placement })) : []
            const { appliedPlacements, appliedQty, draftPlacement } = splitPlacements(placements)
            const nextPlacements =
              qtyToSet > 0
                ? [
                    ...appliedPlacements,
                    {
                      ...(draftPlacement || { StorageNumber: 'N', RowNumber: 'N', CellNumber: 'N' }),
                      Qty: qtyToSet,
                      IsApplied: false,
                    },
                  ]
                : appliedPlacements
            const nextQty = appliedQty + qtyToSet

            return existing
              ? { ...existing, Qty: nextQty, DynamicProductPlacements: nextPlacements }
              : {
                  Qty: nextQty,
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
    [canUseIncome, invoice, isDirty, isSaving, packingList, setDirty, setPackingList, t],
  )

  const handleCalculateVat = useCallback(async () => {
    if (!canUseIncome || !packingList || !invoice || isSaving || isPlacementLocked(invoice, packingList)) {
      return
    }

    if (isDirty) {
      notifications.show({ color: 'red', message: t('Збережіть зміни перед розрахунком ПДВ') })
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
  }, [canUseIncome, invoice, isDirty, isSaving, packingList, selectPackingList, setError, setInvoice, setSaving, t, vatPercent])

  const recordDynamicIncomeHistory = useCallback(
    async (savedPackingList: IncomePackingList) => {
      try {
        await recordProductIncomeFromPackingListDynamicHistory(savedPackingList)
      } catch {
        notifications.show({
          color: 'yellow',
          message: t('Оприходування виконано, але історію руху не записано'),
        })
      }
    },
    [t],
  )

  const handleAllReadyToPlace = useCallback(async () => {
    if (!canUseIncome || !packingList?.NetUid || isSaving || isPlacementLocked(invoice, packingList)) {
      return
    }

    if (isDirty) {
      notifications.show({ color: 'red', message: t('Збережіть зміни перед дією') })
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
  }, [canUseIncome, invoice, isDirty, isSaving, packingList, setError, setPackingList, setSaving, t])

  const handleCarryOut = useCallback(async () => {
    setConfirmCarryOut(false)

    if (!canUseIncome || isSaving || isPlacementLocked(invoice, packingList)) {
      return
    }

    if (!packingList || !selectedStorage?.NetUid) {
      notifications.show({ color: 'red', message: t('Виберіть склад') })
      return
    }

    if (isDirty) {
      notifications.show({ color: 'red', message: t('Збережіть зміни перед проведенням') })
      return
    }

    if (!isValidDateInputValue(fromDate)) {
      notifications.show({ color: 'yellow', message: t('Вкажіть коректну дату') })
      return
    }

    setSaving(true)
    setError(null)

    try {
      const savedPackingList = await createProductIncomeFromPackingListDynamic(toIso(fromDate), selectedStorage.NetUid, {
        ...packingList,
        IsPlaced: true,
      })
      await recordDynamicIncomeHistory(savedPackingList)
      reloadFromServer()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }, [
    canUseIncome, fromDate, invoice, isDirty, isSaving, packingList, recordDynamicIncomeHistory, reloadFromServer,
    selectedStorage, setConfirmCarryOut, setError, setSaving, t,
  ])

  const handleProductIncome = useCallback(async () => {
    if (!canUseIncome || isSaving || isPlacementLocked(invoice, packingList)) {
      return
    }

    if (!packingList || !selectedStorage?.NetUid) {
      notifications.show({ color: 'red', message: t('Виберіть склад') })
      return
    }

    if (isDirty) {
      notifications.show({ color: 'red', message: t('Збережіть зміни перед оприходуванням') })
      return
    }

    if (!isValidDateInputValue(fromDate)) {
      notifications.show({ color: 'yellow', message: t('Вкажіть коректну дату') })
      return
    }

    setSaving(true)
    setError(null)

    try {
      const savedPackingList = await createProductIncomeFromPackingListDynamic(toIso(fromDate), selectedStorage.NetUid, packingList)
      await recordDynamicIncomeHistory(savedPackingList)
      reloadFromServer()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }, [
    canUseIncome, fromDate, invoice, isDirty, isSaving, packingList, recordDynamicIncomeHistory, reloadFromServer,
    selectedStorage, setError, setSaving, t,
  ])

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
    cancelDiscardChanges, columnModalOpen, columnToRemove, confirmCarryOut, confirmDiscardChanges, confirmRemoveColumn,
    drawer, error, fromDate, gridRows,
    closePzDownload, handleAddColumn, handleAllReadyToPlace, handleApplyPlacements, handleCalculateVat, handleCarryOut,
    handleCellChange, handleDownloadPzDocument, handleMoveRemnants, handleNetWeightChange, handleOpenPlacements,
    handleProductIncome, handleReadyToPlace,
    canUseIncome, handleSave, invoice, isDirty, isLoading, isSaving, navigate: requestNavigate, packingList, pendingDirtyAction,
    isInvoiceAllNotPlaced: isInvoiceAllNotPlaced(invoice, packingList),
    placementStatus, productIncome, protocol, pzDownload, reloadFromServer: requestReloadFromServer,
    selectPackingList: requestSelectPackingList, selectedInvoiceId, selectedStorage, selectedStorageId,
    setColumnModalOpen, setColumnToRemove, source,
    sourceId: id,
    setConfirmCarryOut, setDrawer, setFromDate, setSelectedInvoiceId: requestSelectInvoiceId, setSelectedStorageId,
    setVatPercent, storages,
    totalQty, vatPercent,
  }
}

function toIso(value: string): string {
  return formatLocalInputDateTime(value)
}

function isValidDateInputValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value
}

type WeightAuditDrawerProps = {
  item: PackingListPackageOrderItem | null
  opened: boolean
  onClose: () => void
}

type WeightAuditState = {
  entries: IncomeAuditEntity[]
  error: string | null
  isLoading: boolean
}

function WeightAuditDrawer({ item, opened, onClose }: WeightAuditDrawerProps) {
  const { t } = useI18n()
  const [auditState, setAuditState] = useValueState<WeightAuditState>({
    entries: [],
    error: null,
    isLoading: false,
  })
  const supplyOrderItemNetUid = item?.SupplyInvoiceOrderItem?.SupplyOrderItem?.NetUid?.trim()
  const productCode = item?.SupplyInvoiceOrderItem?.Product?.VendorCode || ''

  useEffect(() => {
    if (!opened) {
      setAuditState({ entries: [], error: null, isLoading: false })
      return
    }

    if (!supplyOrderItemNetUid) {
      setAuditState({ entries: [], error: t('Немає NetUid позиції замовлення для історії ваги'), isLoading: false })
      return
    }

    let cancelled = false

    async function loadAudit() {
      setAuditState({ entries: [], error: null, isLoading: true })

      try {
        const nextEntries = await getSupplyOrderItemAudit(supplyOrderItemNetUid as string)

        if (!cancelled) {
          setAuditState({ entries: nextEntries, error: null, isLoading: false })
        }
      } catch (loadError) {
        if (!cancelled) {
          setAuditState({
            entries: [],
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити історію ваги'),
            isLoading: false,
          })
        }
      }
    }

    void loadAudit()

    return () => {
      cancelled = true
    }
  }, [opened, setAuditState, supplyOrderItemNetUid, t])

  return (
    <AppDrawer
      opened={opened}
      size="md"
      title={`${t('Історія ваги')}${productCode ? ` ${productCode}` : ''}`}
      onClose={onClose}
    >
      <Stack gap="md">
        {auditState.error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {auditState.error}
          </Alert>
        )}
        {auditState.isLoading ? (
          <Group gap="xs">
            <Loader size="xs" />
            <Text c="dimmed" size="sm">
              {t('Завантаження історії ваги')}
            </Text>
          </Group>
        ) : auditState.entries.length === 0 && !auditState.error ? (
          <Text c="dimmed" size="sm">
            {t('Історію змін не знайдено')}
          </Text>
        ) : !auditState.error ? (
          <Stack gap="xs">
            {auditState.entries.map((entry, index) => (
              <Box
                key={`${entry.NetUid || entry.Id || index}`}
                style={{
                  border: '1px solid var(--mantine-color-gray-2)',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text fw={600} size="sm">
                    {displayValue(entry.Type)}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {formatDate(entry.Created)}
                  </Text>
                </Group>
                <Stack gap={2} mt={6}>
                  <Text c="dimmed" size="xs">
                    {t('Нові значення')}
                  </Text>
                  {(entry.NewValues || []).map((value, valueIndex) => (
                    <Text key={`${value.Name || 'new'}-${valueIndex}`} size="sm" style={{ overflowWrap: 'anywhere' }}>
                      {displayValue(value.Name)}: {displayValue(value.Value)}
                    </Text>
                  ))}
                  <Text c="dimmed" mt={4} size="xs">
                    {t('Старі значення')}
                  </Text>
                  {(entry.OldValues || []).map((value, valueIndex) => (
                    <Text key={`${value.Name || 'old'}-${valueIndex}`} size="sm" style={{ overflowWrap: 'anywhere' }}>
                      {displayValue(value.Name)}: {displayValue(value.Value)}
                    </Text>
                  ))}
                </Stack>
                <Text c="dimmed" mt={6} size="xs">
                  {t('Користувач')}: {displayValue(entry.UpdatedBy)}
                </Text>
              </Box>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </AppDrawer>
  )
}

type PzDocumentDownloadModalProps = {
  download: DownloadState
  onClose: () => void
}

function PzDocumentDownloadModal({
  download,
  onClose,
}: PzDocumentDownloadModalProps) {
  const { t } = useI18n()
  const { document, error, isLoading, opened } = download

  return (
    <AppModal centered opened={opened} size="sm" title={t('Документ PZ')} onClose={onClose}>
      <Stack gap="sm">
        {isLoading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : error ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        ) : document?.DocumentURL || document?.PdfDocumentURL ? (
          <>
            {document.DocumentURL && (
              <Anchor
                className="document-link"
                href={upgradeHttpToHttps(document.DocumentURL)}
                rel="noreferrer"
                target="_blank"
              >
                <span className="document-link-badge document-link-badge-excel">
                  <ExcelIcon size={22} />
                </span>
                <span>{t('Excel документ')}</span>
              </Anchor>
            )}
            {document.PdfDocumentURL && (
              <Anchor
                className="document-link"
                href={upgradeHttpToHttps(document.PdfDocumentURL)}
                rel="noreferrer"
                target="_blank"
              >
                <span className="document-link-badge document-link-badge-pdf">
                  <IconFileTypePdf size={22} stroke={1.8} />
                </span>
                <span>{t('PDF документ')}</span>
              </Anchor>
            )}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ PZ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}

type ProtocolIncomeModel = ReturnType<typeof useProtocolIncomeModel>

type ProductIncomeColumnsParams = {
  canUseIncome: boolean
  canViewWeightHistory: boolean
  isPlaced: boolean
  model: ProtocolIncomeModel
  setAuditItem: (item: PackingListPackageOrderItem | null) => void
}

function useProductIncomeColumns({
  canUseIncome,
  canViewWeightHistory,
  isPlaced,
  model,
  setAuditItem,
}: ProductIncomeColumnsParams): DataTableColumn<IncomeGridRow>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<IncomeGridRow>[]>(() => {
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
        id: 'measureUnit',
        header: t('Одиниця виміру'),
        width: 110,
        cell: (gridRow) => gridRow.item.SupplyInvoiceOrderItem?.Product?.MeasureUnit?.Name || '-',
      },
      {
        id: 'netWeight',
        header: t('Вага Нетто'),
        width: 150,
        align: 'right',
        enableSorting: false,
        cell: (gridRow) => (
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <NumberInput
              allowDecimal
              decimalScale={3}
              disabled={!canUseIncome || isPlaced || model.isSaving}
              hideControls
              size="xs"
              value={Number((gridRow.item.NetWeight || 0).toFixed(3))}
              w={92}
              onBlur={(event) => {
                const nextValue = Number(event.currentTarget.value)
                if (nextValue !== (gridRow.item.NetWeight || 0)) {
                  model.handleNetWeightChange(gridRow.item, nextValue)
                }
              }}
            />
            {canViewWeightHistory && (
              <Tooltip label={t('Історія ваги')}>
                <ActionIcon
                  aria-label={t('Історія ваги')}
                  color="gray"
                  disabled={model.isSaving || !gridRow.item.SupplyInvoiceOrderItem?.SupplyOrderItem?.NetUid}
                  size="sm"
                  variant="subtle"
                  onClick={() => setAuditItem(gridRow.item)}
                >
                  <IconHistory size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
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
        id: 'customsRate',
        header: t('Мито %'),
        width: 90,
        align: 'right',
        cell: (gridRow) => lastSpecificationNumberProp(gridRow.item, 'DutyPercent') ?? '-',
      },
      {
        id: 'customsValue',
        header: t('Митна вартість'),
        width: 130,
        align: 'right',
        cell: (gridRow) => lastSpecificationNumberProp(gridRow.item, 'CustomsValue') ?? '-',
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
            disabled={!canUseIncome || model.isDirty || model.isSaving || Boolean(gridRow.item.IsReadyToPlaced) || isPlaced}
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
        id: 'isImported',
        header: t('Імпорт'),
        width: 90,
        align: 'center',
        cell: (gridRow) => (gridRow.item.ProductIsImported ? t('Так') : '-'),
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
      const canDelete = canUseIncome && !isPlaced && !columnHasAppliedPlacements(column)

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
                  disabled={!canUseIncome || isPlaced || model.isDirty || model.isSaving}
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
                    disabled={!canUseIncome || isPlaced || model.isDirty || model.isSaving}
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
                disabled={!canUseIncome || isPlaced || model.isSaving}
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
                disabled={!canUseIncome || isPlaced || model.isSaving}
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
  }, [canUseIncome, canViewWeightHistory, isPlaced, model, setAuditItem, t])
}

export function ProductDeliveryProtocolIncomePage() {
  return <PackingListProductIncomePage source="delivery-protocol" />
}

export function SupplyUkraineDirectOrderProductIncomePage() {
  return <PackingListProductIncomePage source="direct-supply-order" />
}

function PackingListProductIncomePage({ source }: { source: ProductIncomeSource }) {
  const model = useProtocolIncomeModel(source)
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [auditItem, setAuditItem] = useValueState<PackingListPackageOrderItem | null>(null)
  const [vendorCodeFilter, setVendorCodeFilter] = useValueState('')

  const isPlaced = isPlacementLocked(model.invoice, model.packingList)
  const canUseIncome = model.canUseIncome
  const hasColumns = (model.packingList?.DynamicProductPlacementColumns.length || 0) > 0
  const hasItemsNotReadyToPlace = (model.packingList?.PackingListPackageOrderItems || []).some((item) => !item.IsReadyToPlaced)
  const canAddDynamicColumn = canUseIncome && hasPermission(PERMISSION_ADD_DYNAMIC_INCOME_COLUMN)
  const canCapitalizeDynamicIncome = canUseIncome && hasPermission(PERMISSION_CAPITALIZE_DYNAMIC_INCOME)
  const canCarryOutDynamicIncome = canUseIncome && hasPermission(PERMISSION_CARRY_OUT_DYNAMIC_INCOME)
  const canViewWeightHistory = hasPermission(PERMISSION_VIEW_WEIGHT_HISTORY)
  const filteredGridRows = useMemo(() => {
    const value = vendorCodeFilter.trim().toLowerCase()

    if (!value) {
      return model.gridRows
    }

    return model.gridRows.filter((gridRow) =>
      (gridRow.item.SupplyInvoiceOrderItem?.Product?.VendorCode || '').toLowerCase().includes(value),
    )
  }, [model.gridRows, vendorCodeFilter])

  const columns = useProductIncomeColumns({
    canUseIncome,
    canViewWeightHistory,
    isPlaced,
    model,
    setAuditItem,
  })

  return (
    <Stack gap="md">
      <ProductIncomePageHeader model={model} source={source} />
      <ProtocolIncomeSummaryCard model={model} source={source} />

      {!model.isLoading && model.protocol && !canUseIncome && (
        <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
          {t('Оприходування доступне після завершення протоколу')}
        </Alert>
      )}

      <PlacedProductIncomeCard isPlaced={isPlaced} model={model} />
      <ProductIncomeControlsCard
        model={model}
        permissions={{
          canAddDynamicColumn,
          canCapitalizeDynamicIncome,
          canCarryOutDynamicIncome,
        }}
        state={{
          canUseIncome,
          hasColumns,
          hasItemsNotReadyToPlace,
          isPlaced,
        }}
      />

      {model.error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {model.error}
        </Alert>
      )}

      <ProductIncomeGridCard
        columns={columns}
        filteredGridRows={filteredGridRows}
        model={model}
        setVendorCodeFilter={setVendorCodeFilter}
        vendorCodeFilter={vendorCodeFilter}
      />
      <ProductIncomeDialogs
        auditItem={auditItem}
        canUseIncome={canUseIncome}
        model={model}
        setAuditItem={setAuditItem}
      />
    </Stack>
  )
}

type ProductIncomePageSectionProps = {
  model: ProtocolIncomeModel
  source: ProductIncomeSource
}

function ProductIncomePageHeader({ model, source }: ProductIncomePageSectionProps) {
  const { t } = useI18n()
  const sourceNumber = getIncomeSourceNumber(source, model.protocol)
  const backPath = source === 'direct-supply-order' && model.sourceId
    ? `/orders/ukraine/all/edit/${model.sourceId}`
    : '/product-delivery-protocols'
  const title = source === 'direct-supply-order'
    ? t('Прихід товару по прямому замовленню')
    : t('Прихід товару згідно замовлення')

  return (
    <Group justify="space-between" align="center">
      <Button
        color="gray"
        disabled={model.isSaving}
        leftSection={<IconArrowLeft size={16} />}
        variant="subtle"
        onClick={() => model.navigate(backPath)}
      >
        {t('Назад')}
      </Button>
      <Text fw={700} size="lg">
        {`${title}: ${sourceNumber}`}
      </Text>
    </Group>
  )
}

function ProtocolIncomeSummaryCard({ model, source }: ProductIncomePageSectionProps) {
  const { t } = useI18n()
  const supplierName = model.protocol?.Client?.Name || model.protocol?.Client?.FullName || '-'
  const agreementName = model.protocol?.ClientAgreement?.Agreement?.Name || '-'
  const currencyCode = model.protocol?.ClientAgreement?.Agreement?.Currency?.Code || '-'

  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
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
        {source === 'direct-supply-order' && (
          <>
            <Stack gap={2}>
              <Text c="dimmed" size="xs">
                {t('Постачальник')}
              </Text>
              <Text size="sm">{supplierName}</Text>
            </Stack>
            <Stack gap={2}>
              <Text c="dimmed" size="xs">
                {t('Договір')}
              </Text>
              <Text size="sm">{agreementName}</Text>
            </Stack>
            <Stack gap={2}>
              <Text c="dimmed" size="xs">
                {t('Валюта')}
              </Text>
              <Text size="sm">{currencyCode}</Text>
            </Stack>
          </>
        )}
      </Group>
    </Card>
  )
}

function PlacedProductIncomeCard({ isPlaced, model }: { isPlaced: boolean; model: ProtocolIncomeModel }) {
  const { t } = useI18n()

  if (!isPlaced || !model.productIncome || (model.productIncome.Id || 0) <= 0) {
    return null
  }

  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Group gap="xl" wrap="wrap">
        <Stack gap={2}>
          <Text c="dimmed" size="xs">
            {t('Номер')}
          </Text>
          <Text size="sm">{model.productIncome.Number || '-'}</Text>
        </Stack>
        <Stack gap={2}>
          <Text c="dimmed" size="xs">
            {t('Дата оприходування')}
          </Text>
          <Text size="sm">{formatDate(model.productIncome.FromDate)}</Text>
        </Stack>
        <Stack gap={2}>
          <Text c="dimmed" size="xs">
            {t('Склад')}
          </Text>
          <Text size="sm">{model.productIncome.Storage?.Name || '-'}</Text>
        </Stack>
        <Stack gap={2}>
          <Text c="dimmed" size="xs">
            {t('Відповідальний')}
          </Text>
          <Text size="sm">{getIncomeUserName(model.productIncome.User)}</Text>
        </Stack>
      </Group>
    </Card>
  )
}

type ProductIncomeControlsPermissions = {
  canAddDynamicColumn: boolean
  canCapitalizeDynamicIncome: boolean
  canCarryOutDynamicIncome: boolean
}

type ProductIncomeControlsState = {
  canUseIncome: boolean
  hasColumns: boolean
  hasItemsNotReadyToPlace: boolean
  isPlaced: boolean
}

type ProductIncomeControlsCardProps = {
  model: ProtocolIncomeModel
  permissions: ProductIncomeControlsPermissions
  state: ProductIncomeControlsState
}

function ProductIncomeControlsCard({
  model,
  permissions,
  state,
}: ProductIncomeControlsCardProps) {
  const { t } = useI18n()
  const { canAddDynamicColumn, canCapitalizeDynamicIncome, canCarryOutDynamicIncome } = permissions
  const { canUseIncome, hasColumns, hasItemsNotReadyToPlace, isPlaced } = state

  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Group justify="space-between" align="end" wrap="wrap">
        <Group gap="sm" align="end">
          <Select
            data={(model.protocol?.SupplyInvoices || []).map((supplyInvoice) => ({
              value: supplyInvoice.NetUid || '',
              label: supplyInvoice.Number || supplyInvoice.NetUid || '',
            }))}
            disabled={model.isLoading || model.isSaving}
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
            disabled={model.isLoading || model.isSaving || !model.invoice}
            label={t('Пакувальний лист')}
            value={model.packingList?.NetUid || null}
            w={220}
            onChange={(value) => value && void model.selectPackingList(value)}
          />
          {!isPlaced && (
            <Select
              data={model.storages.map((storage) => ({ value: storage.NetUid || '', label: storage.Name || '' }))}
              disabled={!canUseIncome || model.isDirty || model.isSaving}
              label={t('Склад')}
              value={model.selectedStorageId}
              w={220}
              onChange={(value) => model.setSelectedStorageId(value)}
            />
          )}
          {model.isInvoiceAllNotPlaced && (
            <TextInput
              disabled={!canUseIncome || isPlaced || model.isDirty || model.isSaving}
              label={t('Від якої дати')}
              type="date"
              value={model.fromDate}
              onChange={(event) => model.setFromDate(event.currentTarget.value)}
            />
          )}
          <NumberInput
            disabled={!canUseIncome || isPlaced || model.isDirty || model.isSaving}
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
        <Button
          disabled={!model.invoice?.NetUid || model.pzDownload.isLoading}
          leftSection={<IconDownload size={16} />}
          variant="light"
          onClick={() => void model.handleDownloadPzDocument()}
        >
          {t('Документ PZ')}
        </Button>
        <Button
          disabled={!canUseIncome || isPlaced || model.isDirty || model.isSaving}
          variant="light"
          onClick={() => void model.handleCalculateVat()}
        >
          {t('Розрахувати ПДВ')}
        </Button>
        {!isPlaced && hasItemsNotReadyToPlace && (
          <Button
            disabled={!canUseIncome || model.isDirty || model.isSaving}
            variant="light"
            onClick={() => void model.handleAllReadyToPlace()}
          >
            {t('Всі готові до розміщення')}
          </Button>
        )}
        {!isPlaced && canAddDynamicColumn && (
          <Button
            disabled={!canUseIncome || model.isDirty || model.isSaving}
            variant="light"
            onClick={() => model.setColumnModalOpen(true)}
          >
            {t('Додати')}
          </Button>
        )}
        {!isPlaced && canCapitalizeDynamicIncome && (
          <Button
            disabled={!canUseIncome || model.isDirty || model.isSaving}
            variant="light"
            onClick={() => void model.handleProductIncome()}
          >
            {t('Оприходувати')}
          </Button>
        )}
        {!isPlaced && hasColumns && canCarryOutDynamicIncome && (
          <Button
            disabled={!canUseIncome || model.isDirty || model.isSaving}
            variant="light"
            onClick={() => model.setConfirmCarryOut(true)}
          >
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
            <Button color="gray" disabled={model.isSaving} variant="light" onClick={model.reloadFromServer}>
              {t('Скасувати')}
            </Button>
          )}
          <Button color={CREATE_ACTION_COLOR} disabled={!canUseIncome || !model.isDirty || model.isSaving} loading={model.isSaving} onClick={model.handleSave}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Group>
    </Card>
  )
}

type ProductIncomeGridCardProps = {
  columns: DataTableColumn<IncomeGridRow>[]
  filteredGridRows: IncomeGridRow[]
  model: ProtocolIncomeModel
  setVendorCodeFilter: (value: string) => void
  vendorCodeFilter: string
}

function ProductIncomeGridCard({
  columns,
  filteredGridRows,
  model,
  setVendorCodeFilter,
  vendorCodeFilter,
}: ProductIncomeGridCardProps) {
  const { t } = useI18n()

  return (
    <Card className="app-section-card" withBorder radius="md" padding="md">
      <Stack gap="md">
        <TextInput
          label={t('Пошук')}
          placeholder={t('Код товару')}
          value={vendorCodeFilter}
          w={260}
          onChange={(event) => setVendorCodeFilter(event.currentTarget.value)}
        />
        <DataTable
          columns={columns}
          data={filteredGridRows}
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
  )
}

type ProductIncomeDialogsProps = {
  auditItem: PackingListPackageOrderItem | null
  canUseIncome: boolean
  model: ProtocolIncomeModel
  setAuditItem: (item: PackingListPackageOrderItem | null) => void
}

function ProductIncomeDialogs({
  auditItem,
  canUseIncome,
  model,
  setAuditItem,
}: ProductIncomeDialogsProps) {
  const { t } = useI18n()

  return (
    <>
      <NewIncomeDynamicColumnModal
        disabled={!canUseIncome || model.isSaving}
        key={model.columnModalOpen ? 'income-column-open' : 'income-column-closed'}
        opened={model.columnModalOpen}
        onAdd={model.handleAddColumn}
        onClose={() => model.setColumnModalOpen(false)}
      />

      <ProtocolIncomePlacementDrawer
        columnId={model.drawer?.columnId || null}
        item={model.drawer?.item || null}
        opened={Boolean(model.drawer)}
        row={model.drawer?.row || null}
        selectedStorage={model.selectedStorage}
        onApply={model.handleApplyPlacements}
        onClose={() => model.setDrawer(null)}
      />

      <WeightAuditDrawer item={auditItem} opened={Boolean(auditItem)} onClose={() => setAuditItem(null)} />

      <PzDocumentDownloadModal download={model.pzDownload} onClose={model.closePzDownload} />

      <AppModal
        opened={Boolean(model.columnToRemove)}
        title={t('Ви впевнені, що хочете видалити?')}
        onClose={() => {
          if (!model.isSaving) {
            model.setColumnToRemove(null)
          }
        }}
      >
        <Group justify="flex-end">
          <Button color="gray" disabled={model.isSaving} variant="light" onClick={() => model.setColumnToRemove(null)}>
            {t('Скасувати')}
          </Button>
          <Button color="red" disabled={!canUseIncome || model.isSaving} loading={model.isSaving} onClick={model.confirmRemoveColumn}>
            {t('Видалити')}
          </Button>
        </Group>
      </AppModal>

      <AppModal
        opened={model.confirmCarryOut}
        title={t('Ви підтверджуєте дію?')}
        onClose={() => {
          if (!model.isSaving) {
            model.setConfirmCarryOut(false)
          }
        }}
      >
        <Group justify="flex-end">
          <Button color="gray" disabled={model.isSaving} variant="light" onClick={() => model.setConfirmCarryOut(false)}>
            {t('Скасувати')}
          </Button>
          <Button disabled={!canUseIncome || model.isSaving} loading={model.isSaving} onClick={() => void model.handleCarryOut()}>
            {t('Провести')}
          </Button>
        </Group>
      </AppModal>

      <AppModal
        opened={Boolean(model.pendingDirtyAction)}
        title={t('Є незбережені зміни')}
        onClose={() => {
          if (!model.isSaving) {
            model.cancelDiscardChanges()
          }
        }}
      >
        <Stack gap="md">
          <Text>{t('Якщо продовжити, незбережені розміщення та зміни кількості будуть втрачені.')}</Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={model.isSaving} variant="light" onClick={model.cancelDiscardChanges}>
              {t('Залишитися')}
            </Button>
            <Button color="red" disabled={model.isSaving} onClick={model.confirmDiscardChanges}>
              {t('Продовжити без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </>
  )
}
