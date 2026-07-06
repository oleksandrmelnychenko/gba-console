import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconColumnInsertRight,
  IconFileTypePdf,
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
  addDynamicPlacementRow,
  createProductIncomeFromPackingListDynamic,
  getOrganizationStorages,
  getPackingListSpecificationProducts,
  getPzDocumentBySupplyInvoiceId,
  getProductIncomeByDeliveryProtocolNetId,
  getProductIncomeBySupplyOrderNetId,
  getSupplyOrderInvoiceItems,
  markAllItemsReadyToPlace,
  updateDynamicPlacementRow,
  updatePackingListInInvoice,
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
  IncomeProductIncome,
  IncomeProtocol,
  IncomeStorage,
  IncomeSupplyInvoice,
  PackingListPackageOrderItem,
} from '../productIncomeTypes'
import { isInvoiceAllNotPlaced } from '../productIncomePlacementState'
import './product-income-page.css'

const DEFAULT_VAT_PERCENT = 23
const PERMISSION_ADD_DYNAMIC_INCOME_COLUMN = 'PRODUCT_INCOME_ordersUkraineAllEdit_NewInvoiceBtn_PKEY'
const PERMISSION_CAPITALIZE_DYNAMIC_INCOME = 'PRODUCT_INCOME_ordersUkraineAllEdit_CapitalizeBtn_PKEY'
const PERMISSION_CARRY_OUT_DYNAMIC_INCOME = 'PRODUCT_INCOME_ordersUkraineAllEdit_CarryOutBtn_PKEY'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function formatIncomeNumber(value: number, fractionDigits = 2, minimumFractionDigits = fractionDigits): string {
  return new Intl.NumberFormat('uk-UA', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits,
  }).format(value)
}

function formatIncomeQty(value: number): string {
  return formatIncomeNumber(value, 3, 0)
}

function ProductIncomeNumericCell({ children }: { children: string | number }) {
  return <span className="product-income-number-cell">{children}</span>
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
  // Placement capacity for THIS column: item qty minus already-placed qty and
  // minus the qty pending in the other dynamic columns. The row qty is derived
  // from the placements sum (legacy contract), so the cap can't be row.Qty.
  maxQty: number
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

function useProtocolIncomeModel(source: ProductIncomeSource, sourceId?: string) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id: routeId } = useParams<{ id: string }>()
  const id = sourceId || routeId

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
            applyLoadedPackingList({
              ...loadedPackList,
              DynamicProductPlacementColumns: firstPackList.DynamicProductPlacementColumns || [],
            })
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
          const columns =
            invoice?.PackingLists.find((list) => list.NetUid === netId)?.DynamicProductPlacementColumns || []
          setPackingList({ ...loadedPackList, DynamicProductPlacementColumns: columns })
          setDirty(false)
        }
      } catch (loadError) {
        if (packingListRequestRef.current === requestId) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити дані'))
        }
      }
    },
    [invoice, setDirty, setError, setPackingList, t],
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

  const handleOpenPlacements = useCallback(
    (gridRow: IncomeGridRow, columnId: string, row: DynamicProductPlacementRow) => {
      if (!canUseIncome || isSaving) {
        return
      }

      if (isPlacementLocked(invoice, packingList)) {
        notifications.show({ color: 'red', message: t('Пак лист уже оприбуткований') })
        return
      }

      const itemQty = gridRow.item.Qty || 0
      const otherColumnsTotal = Array.from(gridRow.rowsByColumn.entries()).reduce(
        (total, [key, otherRow]) => total + (key === columnId ? 0 : otherRow.Qty || 0),
        0,
      )
      const maxQty = Math.max(itemQty - (gridRow.item.PlacedQty || 0) - otherColumnsTotal, 0)

      setDrawer({ item: gridRow.item, row, columnId, maxQty })
    },
    [canUseIncome, invoice, isSaving, packingList, setDrawer, t],
  )

  const persistPackingList = useCallback(
    async (nextPackingList: IncomePackingList) => {
      if (!canUseIncome || !selectedInvoiceId || !invoice || isSaving) {
        return
      }

      setSaving(true)
      setError(null)

      try {
        // Persist exactly like the legacy order flow: POST the whole invoice (with the
        // updated packing list embedded) to /supplies/packinglists/update. That endpoint
        // returns the FULL invoice — its packing list keeps PackingListPackageOrderItems —
        // so the grid is not wiped. (The placement-info endpoint returned a lean list and
        // cleared the grid on «Додати»/«Зберегти».)
        const hasMatchingPackList = invoice.PackingLists.some((list) => list.NetUid === nextPackingList.NetUid)
        const invoicePayload: IncomeSupplyInvoice = {
          ...invoice,
          PackingLists: hasMatchingPackList
            ? invoice.PackingLists.map((list) =>
                list.NetUid === nextPackingList.NetUid ? nextPackingList : list,
              )
            : [...invoice.PackingLists, nextPackingList],
        }

        await updatePackingListInInvoice(invoicePayload)

        // The update response omits DynamicProductPlacementColumns (the backend doesn't
        // re-hydrate them), so re-fetch: the invoice endpoint returns the persisted columns
        // (incl. the freshly-added one), the specification endpoint returns the full grid
        // items. Graft the columns onto the items so the new column actually appears.
        const [refreshedInvoice, refreshedPackList] = await Promise.all([
          getSupplyOrderInvoiceItems(selectedInvoiceId),
          getPackingListSpecificationProducts(nextPackingList.NetUid ?? ''),
        ])

        setInvoice(refreshedInvoice)

        const columns =
          refreshedInvoice.PackingLists.find((list) => list.NetUid === nextPackingList.NetUid)
            ?.DynamicProductPlacementColumns || []

        setPackingList({ ...refreshedPackList, DynamicProductPlacementColumns: columns })
        setDirty(false)
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти зміни'))
      } finally {
        setSaving(false)
      }
    },
    [canUseIncome, invoice, isSaving, selectedInvoiceId, setDirty, setError, setInvoice, setPackingList, setSaving, t],
  )

  const handleSave = useCallback(() => {
    if (packingList) {
      void persistPackingList(packingList)
    }
  }, [packingList, persistPackingList])

  const handleApplyPlacements = useCallback(
    async (placements: DynamicProductPlacement[]) => {
      if (!canUseIncome || isSaving || !drawer || !packingList) {
        return
      }

      if (isPlacementLocked(invoice, packingList)) {
        notifications.show({ color: 'red', message: t('Пак лист уже оприбуткований') })
        setDrawer(null)
        return
      }

      const column = packingList.DynamicProductPlacementColumns.find(
        (candidate) => columnKey(candidate) === drawer.columnId,
      )

      if (!column) {
        setDrawer(null)
        return
      }

      const { columnId, item, row } = drawer

      setDrawer(null)
      setSaving(true)
      setError(null)

      try {
        // Legacy contract: the placements panel persists IMMEDIATELY through the
        // dedicated rows endpoints (packinglists/update stores only the row qty,
        // so edited placements would be lost) — no page-level dirty state.
        const payload: DynamicProductPlacementRow = {
          ...row,
          Qty: sumPlacements(placements),
          PackingListPackageOrderItemId: item.Id,
          PackingListPackageOrderItem: item,
          DynamicProductPlacementColumnId: column.Id,
          DynamicProductPlacements: placements,
        }

        const savedRow = row.Id && row.Id > 0
          ? await updateDynamicPlacementRow(payload)
          : await addDynamicPlacementRow(payload)

        const nextRow: DynamicProductPlacementRow = {
          ...savedRow,
          PackingListPackageOrderItemId: savedRow.PackingListPackageOrderItemId || item.Id,
        }

        setPackingList((current) => {
          if (!current) {
            return current
          }

          const columns = current.DynamicProductPlacementColumns.map((iterColumn) => {
            if (columnKey(iterColumn) !== columnId) {
              return iterColumn
            }

            const hasRow = iterColumn.DynamicProductPlacementRows.some(
              (iterRow) => iterRow.PackingListPackageOrderItemId === item.Id,
            )
            const rows = hasRow
              ? iterColumn.DynamicProductPlacementRows.map((iterRow) =>
                  iterRow.PackingListPackageOrderItemId === item.Id ? nextRow : iterRow,
                )
              : [...iterColumn.DynamicProductPlacementRows, nextRow]

            return { ...iterColumn, DynamicProductPlacementRows: rows }
          })

          return { ...current, DynamicProductPlacementColumns: columns }
        })
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти розміщення'))
      } finally {
        setSaving(false)
      }
    },
    [canUseIncome, drawer, invoice, isSaving, packingList, setDrawer, setError, setPackingList, setSaving, t],
  )

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
        FromDate: toIso(columnFromDate),
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
              ? { ...existing, Qty: nextQty, DynamicProductPlacements: nextPlacements, PackingListPackageOrderItem: item }
              : {
                  Qty: nextQty,
                  PackingListPackageOrderItemId: item.Id,
                  PackingListPackageOrderItem: item,
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
      await createProductIncomeFromPackingListDynamic(toIso(fromDate), selectedStorage.NetUid, {
        ...packingList,
        IsPlaced: true,
      })
      reloadFromServer()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }, [
    canUseIncome, fromDate, invoice, isDirty, isSaving, packingList, reloadFromServer,
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
      await createProductIncomeFromPackingListDynamic(toIso(fromDate), selectedStorage.NetUid, packingList)
      reloadFromServer()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }, [
    canUseIncome, fromDate, invoice, isDirty, isSaving, packingList, reloadFromServer,
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
    handleDownloadPzDocument, handleMoveRemnants, handleOpenPlacements,
    handleProductIncome,
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
  isPlaced: boolean
  model: ProtocolIncomeModel
}

function useProductIncomeColumns({
  canUseIncome,
  isPlaced,
  model,
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
        cell: (gridRow) => <ProductIncomeNumericCell>{gridRow.index}</ProductIncomeNumericCell>,
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
        cell: (gridRow) => (
          <span className="app-role-pill is-gray product-income-code-pill">
            {gridRow.item.SupplyInvoiceOrderItem?.Product?.VendorCode || '-'}
          </span>
        ),
      },
      {
        id: 'qty',
        header: t('К-сть'),
        width: 80,
        align: 'right',
        cell: (gridRow) => <ProductIncomeNumericCell>{formatIncomeQty(gridRow.item.Qty || 0)}</ProductIncomeNumericCell>,
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
        width: 120,
        align: 'right',
        cell: (gridRow) => <ProductIncomeNumericCell>{formatIncomeNumber(gridRow.item.NetWeight || 0, 3)}</ProductIncomeNumericCell>,
      },
      {
        id: 'grossWeight',
        header: t('Вага Брутто'),
        width: 120,
        align: 'right',
        cell: (gridRow) => <ProductIncomeNumericCell>{formatIncomeNumber(gridRow.item.GrossWeight || 0, 3)}</ProductIncomeNumericCell>,
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
        cell: (gridRow) => {
          const value = lastSpecificationNumberProp(gridRow.item, 'DutyPercent')

          return value == null ? '-' : <ProductIncomeNumericCell>{formatIncomeNumber(value, 2)}</ProductIncomeNumericCell>
        },
      },
      {
        id: 'customsValue',
        header: t('Митна вартість'),
        width: 130,
        align: 'right',
        cell: (gridRow) => {
          const value = lastSpecificationNumberProp(gridRow.item, 'CustomsValue')

          return value == null ? '-' : <ProductIncomeNumericCell>{formatIncomeNumber(value, 2)}</ProductIncomeNumericCell>
        },
      },
      {
        id: 'unitPrice',
        header: t('Ціна за одиницю нетто'),
        width: 140,
        align: 'right',
        cell: (gridRow) => <ProductIncomeNumericCell>{formatIncomeNumber(gridRow.item.UnitPrice || 0, 2)}</ProductIncomeNumericCell>,
      },
      {
        id: 'isPlaced',
        header: t('Оприходуваний'),
        width: 120,
        align: 'center',
        cell: (gridRow) => (
          <span className={`app-role-pill ${gridRow.item.IsPlaced ? 'is-green' : 'is-gray'}`}>
            {gridRow.item.IsPlaced ? t('Так') : t('Ні')}
          </span>
        ),
      },
      {
        id: 'isImported',
        header: t('Імпорт'),
        width: 90,
        align: 'center',
        cell: (gridRow) => (
          <span className={`app-role-pill ${gridRow.item.ProductIsImported ? 'is-orange' : 'is-gray'}`}>
            {gridRow.item.ProductIsImported ? t('Так') : '-'}
          </span>
        ),
      },
      {
        id: 'totalNetPrice',
        header: t('Заг. вартість нетто'),
        width: 140,
        align: 'right',
        cell: (gridRow) => <ProductIncomeNumericCell>{formatIncomeNumber(gridRow.item.TotalNetPrice || 0, 2)}</ProductIncomeNumericCell>,
      },
      {
        id: 'placedQty',
        header: t('К-сть оприходуваних'),
        width: 160,
        align: 'right',
        cell: (gridRow) => <ProductIncomeNumericCell>{formatIncomeQty(gridRow.item.PlacedQty || 0)}</ProductIncomeNumericCell>,
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
          // Legacy contract: the cell does NOT edit the qty inline — clicking it
          // opens the placements panel (add/remove/edit cells + quantities) and
          // the row qty is derived from the placements sum. Items without a row
          // in this column get a synthetic empty row so placements can be added.
          const row: DynamicProductPlacementRow = gridRow.rowsByColumn.get(key) || {
            Qty: 0,
            PackingListPackageOrderItemId: gridRow.item.Id,
            DynamicProductPlacements: [],
          }
          const canOpen = canUseIncome && !isPlaced && !model.isSaving

          return (
            <UnstyledButton
              disabled={!canOpen}
              style={{ cursor: canOpen ? 'pointer' : 'default', display: 'block', width: '100%' }}
              onClick={() => canOpen && model.handleOpenPlacements(gridRow, key, row)}
            >
              <Stack gap={2}>
                <ProductIncomeNumericCell>{formatIncomeQty(row.Qty || 0)}</ProductIncomeNumericCell>
                {/* Legacy cell text: Storage-Row-Cell - Qty per placement */}
                {row.DynamicProductPlacements.map((placement, placementIndex) => (
                  <Text
                    key={placement.NetUid || placement.Id || placementIndex}
                    c={placement.IsApplied ? 'teal' : 'dimmed'}
                    size="xs"
                  >
                    {`${placement.StorageNumber || 'N'}-${placement.RowNumber ? `${placement.RowNumber}-` : ''}${placement.CellNumber || 'N'} - ${placement.Qty || 0}`}
                  </Text>
                ))}
              </Stack>
            </UnstyledButton>
          )
        },
      }
    })

    return [...fixedColumns, ...dynamicColumns]
  }, [canUseIncome, isPlaced, model, t])
}

export function ProductDeliveryProtocolIncomePage() {
  return <PackingListProductIncomePage source="delivery-protocol" />
}

export function ProductDeliveryProtocolIncomeSheet({ sourceId }: { sourceId: string }) {
  return <PackingListProductIncomePage embedded source="delivery-protocol" sourceId={sourceId} />
}

export function SupplyUkraineDirectOrderProductIncomePage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <AppDrawer
      closeOnClickOutside={false}
      opened
      size="full"
      title={<span className="product-delivery-protocol-income-sheet-title">{t('Розміщення приходу')}</span>}
      onClose={() => navigate(-1)}
    >
      <PackingListProductIncomePage embedded showHeader source="direct-supply-order" />
    </AppDrawer>
  )
}

function PackingListProductIncomePage({
  embedded = false,
  showHeader = !embedded,
  source,
  sourceId,
}: {
  embedded?: boolean
  showHeader?: boolean
  source: ProductIncomeSource
  sourceId?: string
}) {
  const model = useProtocolIncomeModel(source, sourceId)
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [vendorCodeFilter, setVendorCodeFilter] = useValueState('')

  const isPlaced = isPlacementLocked(model.invoice, model.packingList)
  const canUseIncome = model.canUseIncome
  const hasColumns = (model.packingList?.DynamicProductPlacementColumns.length || 0) > 0
  const hasItemsNotReadyToPlace = (model.packingList?.PackingListPackageOrderItems || []).some((item) => !item.IsReadyToPlaced)
  const canAddDynamicColumn = canUseIncome && hasPermission(PERMISSION_ADD_DYNAMIC_INCOME_COLUMN)
  const canCapitalizeDynamicIncome = canUseIncome && hasPermission(PERMISSION_CAPITALIZE_DYNAMIC_INCOME)
  const canCarryOutDynamicIncome = canUseIncome && hasPermission(PERMISSION_CARRY_OUT_DYNAMIC_INCOME)
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
    isPlaced,
    model,
  })

  return (
    <Stack className={`product-income-page${embedded ? ' is-sheet' : ''}`} gap={6}>
      {showHeader && <ProductIncomePageHeader model={model} source={source} />}
      <ProtocolIncomeSummaryCard model={model} source={source} />

      {!model.isLoading && model.protocol && !canUseIncome && (
        <Alert className="product-income-alert" color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
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
        <Alert className="product-income-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
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
        canUseIncome={canUseIncome}
        model={model}
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
  const title = source === 'direct-supply-order'
    ? t('Прихід товару по прямому замовленню')
    : t('Прихід товару згідно замовлення')
  const titleText = sourceNumber ? `${title}: ${sourceNumber}` : title

  return (
    <Group align="center" className="product-income-page-header">
      <Text className="product-income-page-title">
        {titleText}
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
    <Box className="product-income-summary-panel">
      <Text className="app-section-title" fw={600} size="sm">
        {t('Дані протоколу')}
      </Text>
      <div className="product-income-summary-grid">
        <ProductIncomeDetailItem label={t('Статус')} value={model.placementStatus} tone="orange" />
        <ProductIncomeDetailItem label={t('Від')} value={formatDate(model.protocol?.FromDate)} />
        <ProductIncomeDetailItem label={t('Організація')} value={model.protocol?.Organization?.Name || '-'} />
        {source === 'direct-supply-order' && (
          <>
            <ProductIncomeDetailItem label={t('Постачальник')} value={supplierName} />
            <ProductIncomeDetailItem label={t('Договір')} value={agreementName} />
            <ProductIncomeDetailItem label={t('Валюта')} value={currencyCode} tone="green" />
          </>
        )}
      </div>
    </Box>
  )
}

function PlacedProductIncomeCard({ isPlaced, model }: { isPlaced: boolean; model: ProtocolIncomeModel }) {
  const { t } = useI18n()

  if (!isPlaced || !model.productIncome || (model.productIncome.Id || 0) <= 0) {
    return null
  }

  return (
    <Box className="product-income-summary-panel is-placed">
      <Text className="app-section-title" fw={600} size="sm">
        {t('Оприбуткування')}
      </Text>
      <div className="product-income-summary-grid">
        <ProductIncomeDetailItem label={t('Номер')} value={model.productIncome.Number || '-'} tone="yellow" />
        <ProductIncomeDetailItem label={t('Дата оприходування')} value={formatDate(model.productIncome.FromDate)} />
        <ProductIncomeDetailItem label={t('Склад')} value={model.productIncome.Storage?.Name || '-'} />
        <ProductIncomeDetailItem label={t('Відповідальний')} value={getIncomeUserName(model.productIncome.User)} />
      </div>
    </Box>
  )
}

function ProductIncomeDetailItem({
  label,
  tone,
  value,
}: {
  label: string
  tone?: 'green' | 'orange' | 'yellow'
  value: string
}) {
  return (
    <div className="product-income-detail-item">
      <span className="product-income-detail-label">{label}</span>
      {tone ? (
        <span className={`app-role-pill is-${tone} product-income-detail-pill`}>{value}</span>
      ) : (
        <span className="product-income-detail-value">{value}</span>
      )}
    </div>
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
    <Box className="product-income-controls-panel">
      <Text className="app-section-title" fw={600} size="sm">
        {t('Параметри приходу')}
      </Text>
      <Group justify="space-between" align="end" wrap="wrap" gap="md">
        {/* Left: document controls (invoice / packing list / storage / date / VAT) */}
        <Group className="product-income-controls" gap="sm" align="end" wrap="wrap">
          <Select
            className="product-income-control"
            data={(model.protocol?.SupplyInvoices || []).map((supplyInvoice) => ({
              value: supplyInvoice.NetUid || '',
              label: supplyInvoice.Number || supplyInvoice.NetUid || '',
            }))}
            disabled={model.isLoading || model.isSaving}
            label={t('Накладна')}
            value={model.selectedInvoiceId}
            onChange={(value) => model.setSelectedInvoiceId(value)}
          />
          <Select
            className="product-income-control"
            data={(model.invoice?.PackingLists || []).map((list) => ({
              value: list.NetUid || '',
              label: list.No || list.PlNo || list.NetUid || '',
            }))}
            disabled={model.isLoading || model.isSaving || !model.invoice}
            label={t('Пакувальний лист')}
            value={model.packingList?.NetUid || null}
            onChange={(value) => value && void model.selectPackingList(value)}
          />
          {!isPlaced && (
            <Select
              className="product-income-control"
              data={model.storages.map((storage) => ({ value: storage.NetUid || '', label: storage.Name || '' }))}
              disabled={!canUseIncome || model.isDirty || model.isSaving}
              label={t('Склад')}
              value={model.selectedStorageId}
              onChange={(value) => model.setSelectedStorageId(value)}
            />
          )}
          {model.isInvoiceAllNotPlaced && (
            <TextInput
              className="product-income-control is-date"
              disabled={!canUseIncome || isPlaced || model.isDirty || model.isSaving}
              label={t('Від якої дати')}
              type="date"
              value={model.fromDate}
              onChange={(event) => model.setFromDate(event.currentTarget.value)}
            />
          )}
          <NumberInput
            className="product-income-control is-vat"
            disabled={!canUseIncome || isPlaced || model.isDirty || model.isSaving}
            label={t('Відсоток ПДВ')}
            min={0}
            suffix="%"
            value={model.vatPercent}
            onChange={(value) => model.setVatPercent(typeof value === 'number' ? value : Number(value) || 0)}
          />
        </Group>

        {/* Right: actions — secondary tools first, then the green primary actions (legacy look) */}
        <Group className="product-income-actions" gap="sm" align="end" justify="flex-end" wrap="wrap">
          {!isPlaced && hasItemsNotReadyToPlace && (
            <Button
              disabled={!canUseIncome || model.isDirty || model.isSaving}
              variant="default"
              onClick={() => void model.handleAllReadyToPlace()}
            >
              {t('Всі готові до розміщення')}
            </Button>
          )}
          {!isPlaced && canAddDynamicColumn && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!canUseIncome || model.isDirty || model.isSaving}
              variant="outline"
              onClick={() => model.setColumnModalOpen(true)}
            >
              {t('Додати')}
            </Button>
          )}
          {!isPlaced && canCapitalizeDynamicIncome && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!canUseIncome || model.isDirty || model.isSaving}
              variant="outline"
              onClick={() => void model.handleProductIncome()}
            >
              {t('Оприходувати')}
            </Button>
          )}
          {!isPlaced && hasColumns && canCarryOutDynamicIncome && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={!canUseIncome || model.isDirty || model.isSaving}
              variant="outline"
              onClick={() => model.setConfirmCarryOut(true)}
            >
              {t('Провести')}
            </Button>
          )}
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
    </Box>
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
    <Box className="product-income-grid-panel">
      <div className="product-income-grid-toolbar">
        <Text className="app-section-title product-income-grid-title" fw={600} size="sm">
          {t('Товари')}
        </Text>
        <TextInput
          className="product-income-search"
          label={t('Пошук')}
          placeholder={t('Код товару')}
          value={vendorCodeFilter}
          onChange={(event) => setVendorCodeFilter(event.currentTarget.value)}
        />
        <Group className="product-income-grid-summary" gap={10} justify="flex-end" wrap="wrap">
          <ProductIncomeSummaryMetric label={t('К-сть')} value={formatIncomeQty(model.totalQty)} />
          <ProductIncomeSummaryMetric label={t('Митна вартість')} value={formatIncomeNumber(model.packingList?.TotalCustomValue || 0, 2)} />
          <ProductIncomeSummaryMetric label={t('Заг. вартість нетто')} value={formatIncomeNumber(model.packingList?.TotalNetPrice || 0, 2)} />
          <ProductIncomeSummaryMetric label={t('Заг. вага нетто')} value={formatIncomeNumber(model.packingList?.TotalNetWeight || 0, 3)} />
          <ProductIncomeSummaryMetric label={t('Заг. вага брутто')} value={formatIncomeNumber(model.packingList?.TotalGrossWeight || 0, 3)} />
        </Group>
      </div>
      <Box className="income-grid-fill">
        <DataTable
          columns={columns}
          data={filteredGridRows}
          emptyText={t('Дані відсутні')}
          getRowId={(gridRow) => String(gridRow.item.NetUid || gridRow.item.Id || gridRow.index)}
          height="100%"
          isLoading={model.isLoading}
          layoutVersion="protocol-product-income-2"
          minWidth={1400}
          showLayoutControls
          tableId="protocol-product-income"
        />
      </Box>
    </Box>
  )
}

function ProductIncomeSummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="product-income-summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

type ProductIncomeDialogsProps = {
  canUseIncome: boolean
  model: ProtocolIncomeModel
}

function ProductIncomeDialogs({
  canUseIncome,
  model,
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
        maxQty={model.drawer?.maxQty || 0}
        opened={Boolean(model.drawer)}
        row={model.drawer?.row || null}
        selectedStorage={model.selectedStorage}
        onApply={model.handleApplyPlacements}
        onClose={() => model.setDrawer(null)}
      />

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
