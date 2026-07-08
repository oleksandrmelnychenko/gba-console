import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Select,
  Box,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Download, FileDown, Plus, RefreshCw, RotateCcw, Save, SquarePen, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { TransporterIcon, TransporterNameWithIcon } from '../../../shared/transporter-icons/TransporterIcon'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  getAllShipmentLists,
  getAutoShipmentList,
  getManualShipmentSales,
  getShipmentCreatePageDocument,
  getShipmentDocument,
  getShipmentListById,
  getShipmentListForSaleDocument,
  getShipmentTransporterTypes,
  getShipmentTransportersByType,
  updateDeliveryRecipient,
  updateDeliveryRecipientAddress,
  updateSaleComment,
  updateShipmentList,
} from '../api/shipmentsApi'
import type {
  ShipmentDeliveryRecipient,
  ShipmentDeliveryRecipientAddress,
  ShipmentList,
  ShipmentListItem,
  ShipmentSale,
  ShipmentTransporter,
  ShipmentTransporterType,
} from '../shipmentTypes'
import type { WarehouseUkraineExportDocument } from '../types'
import {
  appendManualShipmentSales,
  getShipmentSaleKey,
  isValidManualQtyPlaces,
  toManualShipmentQueryDate,
} from '../shipmentManualSelection'
import { ChangeCommentModal } from './ChangeCommentModal'
import { displayValue, formatDateTime, getDateShiftedByDays, toDateTimeQuery } from './dateHelpers'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { EditDeliveryAddressModal } from './EditDeliveryAddressModal'
import { EditDeliveryRecipientModal } from './EditDeliveryRecipientModal'
import {
  closePendingWarehouseDocumentWindow,
  getPreferredWarehousePrintUrl,
  hasWarehouseDocumentUrl,
  openPendingWarehouseDocumentWindow,
  openWarehouseDocumentInWindow,
} from './openWarehouseDocument'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['index', 'clientName'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

const ALL_SHIPMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['index', 'number'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

const EDIT_SHIPMENT_TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['client', 'saleNumber'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

const MANUAL_SHIPMENT_SALES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: { left: ['select', 'saleNumber'] },
  density: 'normal',
} satisfies DataTableDefaultLayout

const ALL_TRANSPORTERS_VALUE = '__all_transporters__'
const SHIPMENTS_TAB_ALL = 'all'
const SHIPMENTS_TAB_AUTO = 'auto'
const DEFAULT_SHIPMENT_LOOKBACK_DAYS = 7
const DEFAULT_ALL_SHIPMENTS_LIMIT = 20
const ALL_SHIPMENTS_PAGE_SIZE_OPTIONS = ['20', '50', '100']

type FilterDraft = {
  from: string
  to: string
}

type ActiveModal =
  | { kind: 'recipient'; item: ShipmentListItem }
  | { kind: 'address'; item: ShipmentListItem }
  | { kind: 'comment'; item: ShipmentListItem }
  | null

function getRowId(item: ShipmentListItem, index: number): string {
  return String(item.NetUid || item.Id || index)
}

function getShipmentListRowId(item: ShipmentList, index: number): string {
  return String(item.NetUid || item.Id || index)
}

function sumQtyPlaces(items: ShipmentListItem[]): number {
  return items.reduce(
    (total, item) => total + (typeof item.QtyPlaces === 'number' && Number.isFinite(item.QtyPlaces) ? item.QtyPlaces : 0),
    0,
  )
}

function getShipmentListTransporterName(shipmentList: ShipmentList): string {
  return shipmentList.Transporter?.Name || shipmentList.ShipmentListItems[0]?.Sale.Transporter?.Name || ''
}

function getShipmentListTransporterNetId(shipmentList: ShipmentList | null): string {
  return shipmentList?.Transporter?.NetUid || shipmentList?.ShipmentListItems[0]?.Sale.Transporter?.NetUid || ''
}

function getManualSaleRowId(sale: ShipmentSale, index: number): string {
  return getShipmentSaleKey(sale) || String(index)
}

function hasEditingMarker(shipmentList: ShipmentList): boolean {
  return shipmentList.ShipmentListItems.some(
    (item) => Boolean(item.Sale.HistoryInvoiceEdit?.length) || Boolean(item.Sale.UpdateDataCarrier?.length),
  )
}

function hasCarrierUpdateMarker(shipmentList: ShipmentList): boolean {
  return shipmentList.ShipmentListItems.some(
    (item) => Boolean(item.Sale.UpdateDataCarrier?.length) || Boolean(item.IsChangeTransporter),
  )
}

function isRecipientAddressReadOnly(item: ShipmentListItem): boolean {
  // Legacy gated recipient/address editing only on an existing WarehousesShipment (independent-save
  // model); IsDirty (pending qty edit) must not block it.
  return Boolean(item.Sale.WarehousesShipment)
}

function getChangedTransporterDecoration(item: ShipmentListItem): 'line-through' | undefined {
  return item.IsChangeTransporter ? 'line-through' : undefined
}

function cloneShipmentList(shipmentList: ShipmentList): ShipmentList {
  return {
    ...shipmentList,
    ShipmentListItems: shipmentList.ShipmentListItems.map((item) => ({
      ...item,
      Sale: {
        ...item.Sale,
        DeliveryRecipient: item.Sale.DeliveryRecipient ? { ...item.Sale.DeliveryRecipient } : item.Sale.DeliveryRecipient,
        DeliveryRecipientAddress: item.Sale.DeliveryRecipientAddress
          ? { ...item.Sale.DeliveryRecipientAddress }
          : item.Sale.DeliveryRecipientAddress,
        WarehousesShipment: item.Sale.WarehousesShipment
          ? { ...item.Sale.WarehousesShipment }
          : item.Sale.WarehousesShipment,
      },
    })),
  }
}

function getShipmentComparableState(shipmentList: ShipmentList | null) {
  if (!shipmentList) {
    return null
  }

  return {
    Comment: shipmentList.Comment || '',
    FromDate: shipmentList.FromDate || '',
    ShipmentListItems: shipmentList.ShipmentListItems.map((item, index) => ({
      key: getShipmentItemKey(item, index),
      IsDirty: Boolean(item.IsDirty),
      QtyPlaces: item.QtyPlaces ?? null,
      Sale: {
        Comment: item.Sale.Comment || '',
        DeliveryRecipient: item.Sale.DeliveryRecipient || null,
        DeliveryRecipientAddress: item.Sale.DeliveryRecipientAddress || null,
        ShippingAmount: item.Sale.ShippingAmount ?? null,
        TTN: item.Sale.TTN || '',
        WarehousesShipmentComment: item.Sale.WarehousesShipment?.Comment || '',
      },
    })),
  }
}

function hasShipmentListChanges(original: ShipmentList | null, draft: ShipmentList | null): boolean {
  if (!original || !draft) {
    return false
  }

  return JSON.stringify(getShipmentComparableState(original)) !== JSON.stringify(getShipmentComparableState(draft))
}

function getShipmentItemKey(item: ShipmentListItem, index = -1): string {
  return item.NetUid || (typeof item.Id === 'number' ? String(item.Id) : '') || item.Sale.NetUid || (index >= 0 ? String(index) : '')
}

function isSameShipmentItem(left: ShipmentListItem, right: ShipmentListItem): boolean {
  const leftKey = getShipmentItemKey(left)
  const rightKey = getShipmentItemKey(right)

  return Boolean(leftKey && rightKey && leftKey === rightKey) || left === right
}

function updateShipmentListItem(
  shipmentList: ShipmentList,
  item: ShipmentListItem,
  updater: (currentItem: ShipmentListItem) => ShipmentListItem,
): ShipmentList {
  return {
    ...shipmentList,
    ShipmentListItems: shipmentList.ShipmentListItems.map((currentItem) =>
      isSameShipmentItem(currentItem, item) ? updater(currentItem) : currentItem,
    ),
  }
}

function toDateTimeLocalValue(value: Date | string | undefined): string {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)

    // Only take the raw prefix for a naive (timezone-less) local value that came from the input; a
    // Z/offset-bearing instant from the server must be converted to browser-local below, otherwise
    // the field shows UTC as if it were local and jumps after each save round-trip.
    if (match && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
      return match[1]
    }
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)

  return localDate.toISOString().slice(0, 16)
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : undefined
}

function toTransporterOptions(items: Array<{ Name?: string; NetUid?: string }>) {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    if (item.NetUid) {
      options.push({ value: item.NetUid, label: item.Name || '' })
    }

    return options
  }, [])
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

function getClientName(sale: ShipmentSale): string {
  const client = sale.ClientAgreement?.Client

  if (!client) {
    return ''
  }

  const regionCode = client.RegionCode?.Value ? `${client.RegionCode.Value} ` : ''

  return client.FullName ? `${regionCode}${client.FullName}` : ''
}

function getResponsible(sale: ShipmentSale): string {
  const shipmentUser = sale.WarehousesShipment?.User

  if (shipmentUser?.Id && shipmentUser.Id > 0) {
    return shipmentUser.LastName || ''
  }

  if (sale.UpdateUser?.Id && sale.UpdateUser.Id > 0) {
    return sale.UpdateUser.LastName || ''
  }

  if (sale.User?.Id && sale.User.Id > 0) {
    return sale.User.LastName || ''
  }

  return ''
}

function getRecipientInfo(sale: ShipmentSale, t: (key: string) => string): string {
  const shipment = sale.WarehousesShipment

  if (shipment) {
    return joinParts([
      shipment.FullName ? `${t("Повне ім'я")}: ${shipment.FullName}` : '',
      shipment.MobilePhone ? `${t('Мобільний телефон')}: ${shipment.MobilePhone}` : '',
    ])
  }

  const recipient = sale.DeliveryRecipient

  if (!recipient) {
    return ''
  }

  return joinParts([
    recipient.FullName ? `${t("Повне ім'я")}: ${recipient.FullName}` : '',
    recipient.MobilePhone ? `${t('Мобільний телефон')}: ${recipient.MobilePhone}` : '',
  ])
}

function getAddressInfo(sale: ShipmentSale, t: (key: string) => string): string {
  const shipment = sale.WarehousesShipment

  if (shipment) {
    return joinParts([
      shipment.City ? `${t('Місто')}: ${shipment.City}` : '',
      shipment.Department ? `${t('Відділення')}: ${shipment.Department}` : '',
    ])
  }

  const address = sale.DeliveryRecipientAddress

  if (!address) {
    return ''
  }

  return joinParts([
    address.City ? `${t('Місто')}: ${address.City}` : '',
    address.Department ? `${t('Відділення')}: ${address.Department}` : '',
    address.Value ? `${t('Адреса')}: ${address.Value}` : '',
  ])
}

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(', ')
}

function getTtnNumber(sale: ShipmentSale): string {
  return sale.WarehousesShipment?.TTN || sale.CustomersOwnTtn?.Number || ''
}

function getTtnPath(sale: ShipmentSale): string {
  return sale.WarehousesShipment?.TtnPDFPath || sale.CustomersOwnTtn?.TtnPDFPath || ''
}

function getCashOnDelivery(sale: ShipmentSale): boolean {
  return Boolean(sale.WarehousesShipment?.IsCashOnDelivery || sale.IsCashOnDelivery)
}

function getCashOnDeliveryAmount(sale: ShipmentSale): number | undefined {
  return sale.WarehousesShipment ? sale.WarehousesShipment.CashOnDeliveryAmount : sale.CashOnDeliveryAmount
}

type ShipmentsTabModelOptions = {
  onCarriedOut?: () => void
}

// Auto-panel («Підбір») filter/selection carried across the panel's unmount (toggle + carry-out).
let lastAutoShipmentFilters: FilterDraft | null = null
let lastAutoShipmentTypeNetId: string | null = null
let lastAutoShipmentTransporterNetId: string | null = null

function useShipmentsTabModel({ onCarriedOut }: ShipmentsTabModelOptions = {}) {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () =>
      lastAutoShipmentFilters ?? { from: getDateShiftedByDays(-DEFAULT_SHIPMENT_LOOKBACK_DAYS), to: getDateShiftedByDays(0) },
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [transporterTypes, setTransporterTypes] = useValueState<ShipmentTransporterType[]>([])
  const [selectedTypeNetId, setSelectedTypeNetId] = useValueState<string | null>(lastAutoShipmentTypeNetId)
  const [transporters, setTransporters] = useValueState<ShipmentTransporter[]>([])
  const [selectedTransporterNetId, setSelectedTransporterNetId] = useValueState<string | null>(lastAutoShipmentTransporterNetId)

  // The auto («Підбір») panel unmounts on every Усі↔Підбір toggle and after carry-out, so persist
  // its date window + transporter selection module-scoped (mirrors legacy's in-memory store; lost
  // on hard reload, like legacy).
  useEffect(() => {
    lastAutoShipmentFilters = filterDraft
  }, [filterDraft])
  useEffect(() => {
    lastAutoShipmentTypeNetId = selectedTypeNetId
  }, [selectedTypeNetId])
  useEffect(() => {
    lastAutoShipmentTransporterNetId = selectedTransporterNetId
  }, [selectedTransporterNetId])
  const [shipmentList, setShipmentList] = useValueState<ShipmentList>({ ShipmentListItems: [] })
  const [qtyEdits, setQtyEdits] = useValueState<Record<string, string>>({})
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [confirmCarryOut, setConfirmCarryOut] = useState(false)
  const [docOpened, setDocOpened] = useState(false)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [printDoc, setPrintDoc] = useState<WarehouseUkraineExportDocument | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const filterError = getFilterError(filterDraft.from, filterDraft.to)
  const items = shipmentList.ShipmentListItems
  const itemIndexMap = useMemo(() => buildIndexMap(items), [items])
  const canEditShipment = !shipmentList.IsSent

  useEffect(() => {
    let cancelled = false

    async function loadTypes() {
      try {
        const types = await getShipmentTransporterTypes()

        if (cancelled) {
          return
        }

        setTransporterTypes(types)

        const firstType = types[0]

        if (firstType?.NetUid) {
          setSelectedTypeNetId(firstType.NetUid)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
        }
      }
    }

    void loadTypes()

    return () => {
      cancelled = true
    }
  }, [setError, setSelectedTypeNetId, setTransporterTypes, t])

  useEffect(() => {
    if (!selectedTypeNetId) {
      return
    }

    let cancelled = false

    async function loadTransporters(typeNetId: string) {
      try {
        const result = await getShipmentTransportersByType(typeNetId)

        if (cancelled) {
          return
        }

        setTransporters(result)
        setSelectedTransporterNetId(result[0]?.NetUid || null)
      } catch (loadError) {
        if (!cancelled) {
          setTransporters([])
          setSelectedTransporterNetId(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
        }
      }
    }

    void loadTransporters(selectedTypeNetId)

    return () => {
      cancelled = true
    }
  }, [selectedTypeNetId, setError, setSelectedTransporterNetId, setTransporters, t])

  useEffect(() => {
    if (!selectedTransporterNetId || filterError) {
      setShipmentList({ ShipmentListItems: [] })

      return
    }

    let cancelled = false
    const transporterNetId = selectedTransporterNetId
    const from = filterDraft.from
    const to = filterDraft.to

    async function loadList() {
      setLoading(true)
      setError(null)

      try {
        const result = await getAutoShipmentList({ transporterNetId, from, to })

        if (!cancelled) {
          setShipmentList(result)
          setQtyEdits({})
        }
      } catch (loadError) {
        if (!cancelled) {
          setShipmentList({ ShipmentListItems: [] })
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadList()

    return () => {
      cancelled = true
    }
  }, [
    selectedTransporterNetId,
    filterDraft.from,
    filterDraft.to,
    filterError,
    reloadKey,
    setError,
    setLoading,
    setQtyEdits,
    setShipmentList,
    t,
  ])

  function refreshList() {
    reload()
  }

  function resetFilters() {
    setFilterDraft(initialFilters)
    setQtyEdits({})
    refreshList()
  }

  function commitQtyPlaces(item: ShipmentListItem, rowId: string) {
    if (!canEditShipment) {
      return
    }

    const draft = qtyEdits[rowId]

    if (draft === undefined) {
      return
    }

    const parsed = Number.parseInt(draft, 10)

    if (!Number.isFinite(parsed)) {
      return
    }

    if (parsed < 0) {
      setError(t('Кількість місць не може бути від’ємною'))
      return
    }

    if (parsed === item.QtyPlaces) {
      return
    }

    const nextShipmentList = updateShipmentListItem(shipmentList, item, (currentItem) => ({
      ...currentItem,
      IsDirty: true,
      QtyPlaces: parsed,
    }))

    setShipmentList(nextShipmentList)
    void saveShipmentList(nextShipmentList)
  }

  async function saveShipmentList(nextShipmentList = shipmentList) {
    if (!canEditShipment) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateShipmentList(nextShipmentList, {
        from: toDateTimeQuery(filterDraft.from, 'start'),
        to: toDateTimeQuery(filterDraft.to, 'end'),
      })
      refreshList()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function carryOut() {
    if (!shipmentList.NetUid || shipmentList.IsSent || items.length === 0) {
      setConfirmCarryOut(false)
      return
    }

    setConfirmCarryOut(false)
    setSaving(true)
    setError(null)

    try {
      await updateShipmentList({ ...shipmentList, IsSent: true }, {
        from: toDateTimeQuery(filterDraft.from, 'start'),
        to: toDateTimeQuery(filterDraft.to, 'end'),
      })
      refreshList()
      onCarriedOut?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function saveRecipient(recipient: ShipmentDeliveryRecipient) {
    if (activeModal?.kind !== 'recipient') {
      return
    }

    if (!canEditShipment || isRecipientAddressReadOnly(activeModal.item)) {
      return
    }

    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateDeliveryRecipient(saleNetId, { ...recipient, SaleNetId: saleNetId })
      setActiveModal(null)
      refreshList()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function saveAddress(address: ShipmentDeliveryRecipientAddress) {
    if (activeModal?.kind !== 'address') {
      return
    }

    if (!canEditShipment || isRecipientAddressReadOnly(activeModal.item)) {
      return
    }

    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateDeliveryRecipientAddress(saleNetId, { ...address, SaleNetId: saleNetId })
      setActiveModal(null)
      refreshList()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function saveComment(comment: string) {
    if (activeModal?.kind !== 'comment') {
      return
    }

    if (!canEditShipment) {
      return
    }

    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await updateSaleComment(saleNetId, comment)
      setActiveModal(null)
      refreshList()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function printShipments() {
    if (!selectedTransporterNetId || filterError) {
      return
    }

    setDocOpened(true)
    setDocLoading(true)
    setDocError(null)
    setPrintDoc(null)
    const pendingWindow = openPendingWarehouseDocumentWindow()

    try {
      const result = await getShipmentCreatePageDocument({
        transporterNetId: selectedTransporterNetId,
        from: filterDraft.from,
        to: filterDraft.to,
      })
      const documentUrl = getPreferredWarehousePrintUrl(result)

      if (documentUrl && openWarehouseDocumentInWindow(pendingWindow, documentUrl)) {
        setDocOpened(false)
      } else {
        closePendingWarehouseDocumentWindow(pendingWindow)
        setPrintDoc(hasWarehouseDocumentUrl(result) ? result : null)
        setDocError(hasWarehouseDocumentUrl(result) ? null : t('Немає документів для завантаження'))
      }
    } catch (printError) {
      closePendingWarehouseDocumentWindow(pendingWindow)
      setDocError(printError instanceof Error ? printError.message : t('Не вдалося виконати запит'))
    } finally {
      setDocLoading(false)
    }
  }

  return {
    activeModal,
    canEditShipment,
    carryOut,
    commitQtyPlaces,
    confirmCarryOut,
    docError,
    docLoading,
    docOpened,
    error,
    filterDraft,
    filterError,
    isLoading,
    isSaving,
    items,
    itemIndexMap,
    printDoc,
    printShipments,
    qtyEdits,
    refreshList,
    resetFilters,
    saveAddress,
    saveComment,
    saveRecipient,
    selectedTransporterNetId,
    selectedTypeNetId,
    setActiveModal,
    setConfirmCarryOut,
    setDocOpened,
    setFilterDraft,
    setQtyEdits,
    setSelectedTransporterNetId,
    setSelectedTypeNetId,
    shipmentList,
    transporters,
    transporterTypes,
  }
}

export function ShipmentsTab() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<string | null>(SHIPMENTS_TAB_ALL)

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="pill-tabs">
        <button
          type="button"
          className={`pill-tab${activeTab === SHIPMENTS_TAB_ALL ? ' is-active' : ''}`}
          aria-pressed={activeTab === SHIPMENTS_TAB_ALL}
          onClick={() => setActiveTab(SHIPMENTS_TAB_ALL)}
        >
          {t('Усі')}
        </button>
        <button
          type="button"
          className={`pill-tab${activeTab === SHIPMENTS_TAB_AUTO ? ' is-active' : ''}`}
          aria-pressed={activeTab === SHIPMENTS_TAB_AUTO}
          onClick={() => setActiveTab(SHIPMENTS_TAB_AUTO)}
        >
          {t('Підбір')}
        </button>
      </div>

      <Box className="warehouse-ukraine-subtab-panel">
        {activeTab === SHIPMENTS_TAB_AUTO ? (
          <AutoShipmentsPanel onCarriedOut={() => setActiveTab(SHIPMENTS_TAB_ALL)} />
        ) : (
          <AllShipmentsPanel onCreate={() => setActiveTab(SHIPMENTS_TAB_AUTO)} />
        )}
      </Box>
    </Stack>
  )
}

type AutoShipmentsPanelProps = {
  onCarriedOut: () => void
}

function AutoShipmentsPanel({ onCarriedOut }: AutoShipmentsPanelProps) {
  const model = useShipmentsTabModel({ onCarriedOut })
  const { t } = useI18n()
  const columns = useShipmentColumns(model)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  const typeOptions = toTransporterOptions(model.transporterTypes)
  const transporterOptions = toTransporterOptions(model.transporters)

  const activeModal = model.activeModal
  const hasShipmentList = Boolean(model.shipmentList.NetUid)

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="app-filter-bar warehouse-ukraine-filter-bar is-auto-shipments">
            <Select
              className="warehouse-ukraine-filter-input"
              data={typeOptions}
              label={t('Перевізники')}
              placeholder={t('Перевізники')}
              value={model.selectedTypeNetId}
              w={220}
              onChange={(value) => model.setSelectedTypeNetId(value)}
            />
            <Select
              className="warehouse-ukraine-filter-input"
              data={transporterOptions}
              label={t('Перевізники')}
              placeholder={t('Перевізники')}
              value={model.selectedTransporterNetId}
              w={220}
              onChange={(value) => model.setSelectedTransporterNetId(value)}
            />
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Початкова дата')}
              max={model.filterDraft.to || undefined}
              type="date"
              value={model.filterDraft.from}
              onChange={(event) => model.setFilterDraft({ ...model.filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Кінцева дата')}
              min={model.filterDraft.from || undefined}
              type="date"
              value={model.filterDraft.to}
              onChange={(event) => model.setFilterDraft({ ...model.filterDraft, to: event.currentTarget.value })}
            />
            <div className="app-filter-actions warehouse-ukraine-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={model.resetFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  color="gray"
                  loading={model.isLoading}
                  size={34}
                  variant="light"
                  onClick={() => model.refreshList()}
                >
                  <RefreshCw size={17} />
                </ActionIcon>
              </Tooltip>
            </div>
            <div ref={setTableToolbarSlot} className="warehouse-ukraine-table-toolbar-slot" />
            <div className="warehouse-ukraine-command-actions">
              {hasShipmentList && (
                <Badge className={model.shipmentList.IsSent ? 'app-role-pill is-green' : 'app-role-pill is-gray'} variant="light">
                  {model.shipmentList.IsSent ? t('Проведено') : t('Не проведено')}
                </Badge>
              )}
              <Button
                color="green"
                disabled={!model.shipmentList.NetUid || !model.canEditShipment || model.items.length === 0}
                loading={model.isSaving}
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                onClick={() => model.setConfirmCarryOut(true)}
              >
                {t('Провести і закрити')}
              </Button>
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={!model.selectedTransporterNetId || Boolean(model.filterError)}
                leftSection={<FileDown size={18} />}
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
                variant="outline"
                onClick={() => model.printShipments()}
              >
                {t('Друк PDF')}
              </Button>
            </div>
          </div>

          {(model.error || model.filterError) && (
            <Alert className="console-table-alert" color={model.filterError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <div className="warehouse-ukraine-table console-table-body">
          <DataTable
            columns={columns}
            data={model.items}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={`${t('Відвантажень не знайдено')}. ${t('Дані можуть бути поза вибраним періодом. Розширте дати у фільтрі.')}`}
            getRowId={getRowId}
            height="100%"
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-shipments-2"
            minWidth={1800}
            showLayoutControls
            tableId="warehouse-ukraine-shipments"
            toolbarPortalTarget={tableToolbarSlot}
          />
          </div>
      </div>

      <EditDeliveryRecipientModal
        key={`recipient-${activeModal?.kind === 'recipient' ? activeModal.item.Sale.NetUid : 'idle'}`}
        isSaving={model.isSaving}
        opened={activeModal?.kind === 'recipient'}
        recipient={activeModal?.kind === 'recipient' ? activeModal.item.Sale.DeliveryRecipient || null : null}
        onClose={() => model.setActiveModal(null)}
        onSave={model.saveRecipient}
      />

      <EditDeliveryAddressModal
        key={`address-${activeModal?.kind === 'address' ? activeModal.item.Sale.NetUid : 'idle'}`}
        address={activeModal?.kind === 'address' ? activeModal.item.Sale.DeliveryRecipientAddress || null : null}
        isSaving={model.isSaving}
        opened={activeModal?.kind === 'address'}
        onClose={() => model.setActiveModal(null)}
        onSave={model.saveAddress}
      />

      <ChangeCommentModal
        comment={activeModal?.kind === 'comment' ? activeModal.item.Sale.Comment || '' : ''}
        isSaving={model.isSaving}
        opened={activeModal?.kind === 'comment'}
        onClose={() => model.setActiveModal(null)}
        onSave={model.saveComment}
      />

      <DownloadDocumentModal
        document={model.printDoc}
        error={model.docError}
        isLoading={model.docLoading}
        opened={model.docOpened}
        onClose={() => model.setDocOpened(false)}
      />

      <AppModal
        centered
        opened={model.confirmCarryOut}
        title={t('Чи дійсно ви бажаєте провести?')}
        onClose={() => model.setConfirmCarryOut(false)}
      >
        <Group justify="flex-end" gap="sm">
          <Button color="gray" variant="light" onClick={() => model.setConfirmCarryOut(false)}>
            {t('Ні')}
          </Button>
          <Button color="green" loading={model.isSaving} onClick={() => model.carryOut()}>
            {t('Так')}
          </Button>
        </Group>
      </AppModal>
    </Stack>
  )
}

type AllShipmentsPanelProps = {
  onCreate: () => void
}

function AllShipmentsPanel({ onCreate }: AllShipmentsPanelProps) {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-DEFAULT_SHIPMENT_LOOKBACK_DAYS), to: getDateShiftedByDays(0) }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [transporterTypes, setTransporterTypes] = useValueState<ShipmentTransporterType[]>([])
  const [selectedTypeNetId, setSelectedTypeNetId] = useValueState<string | null>(null)
  const [transporters, setTransporters] = useValueState<ShipmentTransporter[]>([])
  const [selectedTransporterNetId, setSelectedTransporterNetId] = useValueState<string>(ALL_TRANSPORTERS_VALUE)
  const [shipmentLists, setShipmentLists] = useValueState<ShipmentList[]>([])
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_ALL_SHIPMENTS_LIMIT)
  const [selectedShipment, setSelectedShipment] = useValueState<ShipmentList | null>(null)
  const [shipmentDraft, setShipmentDraft] = useValueState<ShipmentList | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [confirmCloseShipment, setConfirmCloseShipment] = useState(false)
  const [manualPickerOpen, setManualPickerOpen] = useState(false)
  const [manualFilterDraft, setManualFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [manualSales, setManualSales] = useValueState<ShipmentSale[]>([])
  const [manualSelectedSaleKeys, setManualSelectedSaleKeys] = useValueState<Record<string, boolean>>({})
  const [manualQtyPlaces, setManualQtyPlaces] = useValueState<Record<string, string>>({})
  const [manualError, setManualError] = useValueState<string | null>(null)
  const [isManualLoading, setManualLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [editError, setEditError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [docOpened, setDocOpened] = useState(false)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [printDoc, setPrintDoc] = useState<WarehouseUkraineExportDocument | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const filterError = getFilterError(filterDraft.from, filterDraft.to)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const listIndexMap = useMemo(() => buildShipmentListIndexMap(shipmentLists), [shipmentLists])
  const listColumns = useAllShipmentColumns(listIndexMap)
  const draftItems = useMemo(() => shipmentDraft?.ShipmentListItems || [], [shipmentDraft])
  const draftIndexMap = useMemo(() => buildIndexMap(draftItems), [draftItems])
  const draftSaleKeys = useMemo(
    () => new Set(draftItems.flatMap((item) => {
      const saleKey = getShipmentSaleKey(item.Sale)

      return saleKey ? [saleKey] : []
    })),
    [draftItems],
  )
  const manualSelectedCount = useMemo(
    () => Object.values(manualSelectedSaleKeys).filter(Boolean).length,
    [manualSelectedSaleKeys],
  )
  const manualFilterError = getFilterError(manualFilterDraft.from, manualFilterDraft.to)
  const hasShipmentDraftChanges = useMemo(
    () => hasShipmentListChanges(selectedShipment, shipmentDraft),
    [selectedShipment, shipmentDraft],
  )
  // Legacy kept carried-out (IsSent) shipments fully editable — post-dispatch TTN/declaration/qty
  // entry happens precisely on the «Усі» list — and the update endpoint persists regardless of IsSent.
  const canEditShipment = Boolean(shipmentDraft)

  useEffect(() => {
    let cancelled = false

    async function loadTypes() {
      try {
        const types = await getShipmentTransporterTypes()

        if (cancelled) {
          return
        }

        setTransporterTypes(types)
        setSelectedTypeNetId(types[0]?.NetUid || null)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
        }
      }
    }

    void loadTypes()

    return () => {
      cancelled = true
    }
  }, [setError, setSelectedTypeNetId, setTransporterTypes, t])

  useEffect(() => {
    if (!selectedTypeNetId) {
      setTransporters([])

      return
    }

    let cancelled = false

    async function loadTransporters(typeNetId: string) {
      try {
        const result = await getShipmentTransportersByType(typeNetId)

        if (cancelled) {
          return
        }

        setTransporters(result)
        setSelectedTransporterNetId(ALL_TRANSPORTERS_VALUE)
      } catch (loadError) {
        if (!cancelled) {
          setTransporters([])
          setSelectedTransporterNetId(ALL_TRANSPORTERS_VALUE)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
        }
      }
    }

    void loadTransporters(selectedTypeNetId)

    return () => {
      cancelled = true
    }
  }, [selectedTypeNetId, setError, setSelectedTransporterNetId, setTransporters, t])

  useEffect(() => {
    if (filterError) {
      setShipmentLists([])

      return
    }

    let cancelled = false
    const transporterNetId =
      selectedTransporterNetId === ALL_TRANSPORTERS_VALUE ? undefined : selectedTransporterNetId

    async function loadShipmentLists() {
      setLoading(true)
      setError(null)

      try {
        const result = await getAllShipmentLists({
          transporterNetId,
          from: filterDraft.from,
          to: filterDraft.to,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        })

        if (!cancelled) {
          setShipmentLists(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          setShipmentLists([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadShipmentLists()

    return () => {
      cancelled = true
    }
  }, [
    filterDraft.from,
    filterDraft.to,
    filterError,
    page,
    pageSize,
    reloadKey,
    selectedTransporterNetId,
    setError,
    setLoading,
    setShipmentLists,
    t,
  ])

  const editColumns = useEditShipmentColumns({
    canEdit: canEditShipment,
    indexMap: draftIndexMap,
    onEditAddress: (item) => {
      if (!item.Sale.DeliveryRecipient) {
        notifications.show({ color: 'yellow', message: t('Додайте одержувача для цієї накладної') })

        return
      }

      setActiveModal({ kind: 'address', item })
    },
    onEditComment: (item) => setActiveModal({ kind: 'comment', item }),
    onEditRecipient: (item) => setActiveModal({ kind: 'recipient', item }),
    onPrintSale: printShipmentForSale,
    onRemoveItem: removeDraftItem,
    updateItem: updateDraftItem,
  })
  const manualSelectableSaleKeys = useMemo(
    () =>
      manualSales
        .map((sale) => getShipmentSaleKey(sale))
        .filter((key): key is string => Boolean(key) && !draftSaleKeys.has(key)),
    [manualSales, draftSaleKeys],
  )

  const manualColumns = useManualShipmentSalesColumns({
    existingSaleKeys: draftSaleKeys,
    qtyPlaces: manualQtyPlaces,
    selectableSaleKeys: manualSelectableSaleKeys,
    selectedSaleKeys: manualSelectedSaleKeys,
    setQtyPlaces: setManualQtyPlaces,
    setSelectedSaleKeys: setManualSelectedSaleKeys,
  })

  const typeOptions = toTransporterOptions(transporterTypes)
  const transporterOptions = [
    { value: ALL_TRANSPORTERS_VALUE, label: t('Усі') },
    ...toTransporterOptions(transporters),
  ]
  const canMoveForward = shipmentLists.length === pageSize

  function refreshList() {
    reload()
  }

  function resetListFilters() {
    setPage(1)
    setFilterDraft(initialFilters)
    setSelectedTransporterNetId(ALL_TRANSPORTERS_VALUE)
  }

  function updateListFilter(nextFilter: FilterDraft) {
    setPage(1)
    setFilterDraft(nextFilter)
  }

  function changeTransporterType(value: string | null) {
    setPage(1)
    setSelectedTypeNetId(value)
  }

  function changeTransporter(value: string | null) {
    setPage(1)
    setSelectedTransporterNetId(value || ALL_TRANSPORTERS_VALUE)
  }

  function changePageSize(nextPageSize: number) {
    setPage(1)
    setPageSize(nextPageSize || DEFAULT_ALL_SHIPMENTS_LIMIT)
  }

  async function loadManualSales(
    nextFilter = manualFilterDraft,
    transporterNetId = getShipmentListTransporterNetId(shipmentDraft),
  ) {
    if (!transporterNetId) {
      setManualError(t('Не вдалося визначити перевізника відвантаження'))
      return
    }

    const nextFilterError = getFilterError(nextFilter.from, nextFilter.to)

    if (nextFilterError) {
      setManualError(nextFilterError)
      return
    }

    setManualLoading(true)
    setManualError(null)

    try {
      const result = await getManualShipmentSales({
        transporterNetId,
        from: toManualShipmentQueryDate(nextFilter.from),
        to: toManualShipmentQueryDate(nextFilter.to, 'end'),
      })

      setManualSales(result)
      setManualSelectedSaleKeys({})
      setManualQtyPlaces({})
    } catch (loadError) {
      setManualSales([])
      setManualError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
    } finally {
      setManualLoading(false)
    }
  }

  function openManualPicker() {
    if (!canEditShipment) {
      return
    }

    const transporterNetId = getShipmentListTransporterNetId(shipmentDraft)

    if (!transporterNetId) {
      setEditError(t('Не вдалося визначити перевізника відвантаження'))
      return
    }

    // Keep the operator's last-used manual date range across openings (first open uses the default
    // initialFilters the state was seeded with).
    setManualSales([])
    setManualSelectedSaleKeys({})
    setManualQtyPlaces({})
    setManualError(null)
    setManualPickerOpen(true)
    void loadManualSales(manualFilterDraft, transporterNetId)
  }

  function closeManualPicker() {
    if (isManualLoading) {
      return
    }

    setManualPickerOpen(false)
    setManualError(null)
  }

  function appendManualSelectedSalesToDraft() {
    if (!shipmentDraft || !canEditShipment) {
      return
    }

    const selectedSales = manualSales.filter((sale) => {
      const saleKey = getShipmentSaleKey(sale)

      return saleKey && manualSelectedSaleKeys[saleKey]
    })

    if (!selectedSales.length) {
      setManualError(t('Виберіть накладні для додавання'))
      return
    }

    const invalidQtySale = selectedSales.find((sale) => !isValidManualQtyPlaces(manualQtyPlaces[getShipmentSaleKey(sale)]))

    if (invalidQtySale) {
      setManualError(t('Кількість місць не може бути від’ємною'))
      return
    }

    const result = appendManualShipmentSales(shipmentDraft, selectedSales, manualQtyPlaces)

    if (!result.appendedCount) {
      setManualError(
        result.skippedDuplicateCount > 0
          ? t('Вибрані накладні вже є у відвантаженні')
          : t('Не вдалося додати накладні'),
      )
      return
    }

    setShipmentDraft(result.shipmentList)
    setManualPickerOpen(false)
    setManualError(null)
    notifications.show({
      color: result.skippedDuplicateCount > 0 ? 'yellow' : 'green',
      message: result.skippedDuplicateCount > 0
        ? t('Додано тільки нові накладні, дублікати пропущено')
        : t('Накладні додано до відвантаження'),
    })
  }

  function openShipment(shipmentList: ShipmentList) {
    const draft = cloneShipmentList(shipmentList)

    setEditError(null)
    setSelectedShipment(shipmentList)
    setShipmentDraft(draft)
  }

  function closeShipment() {
    setEditError(null)
    setConfirmCloseShipment(false)
    setManualPickerOpen(false)
    setManualError(null)
    setSelectedShipment(null)
    setShipmentDraft(null)
  }

  function requestCloseShipment() {
    if (isSaving) {
      return
    }

    if (hasShipmentDraftChanges) {
      setConfirmCloseShipment(true)
      return
    }

    closeShipment()
  }

  function updateDraftField(field: 'Comment' | 'FromDate', value: string) {
    if (!canEditShipment) {
      return
    }

    setShipmentDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function updateDraftItem(
    item: ShipmentListItem,
    updater: (currentItem: ShipmentListItem) => ShipmentListItem,
  ) {
    if (!canEditShipment) {
      return
    }

    setShipmentDraft((current) =>
      current
        ? {
            ...current,
            ShipmentListItems: current.ShipmentListItems.map((currentItem) =>
              currentItem === item ? updater(currentItem) : currentItem,
            ),
          }
        : current,
    )
  }

  function patchShipmentDraftItem(
    item: ShipmentListItem,
    updater: (currentItem: ShipmentListItem) => ShipmentListItem,
  ) {
    setShipmentDraft((current) => (current ? updateShipmentListItem(current, item, updater) : current))
    setSelectedShipment((current) => (current ? updateShipmentListItem(current, item, updater) : current))
  }

  function removeDraftItem(item: ShipmentListItem) {
    if (!canEditShipment) {
      return
    }

    setShipmentDraft((current) => {
      if (!current) {
        return current
      }

      if (current.ShipmentListItems.length <= 1) {
        setEditError(t('Відвантаження має містити хоча б одну накладну'))

        return current
      }

      setEditError(null)

      return {
        ...current,
        ShipmentListItems: current.ShipmentListItems.filter((currentItem) => currentItem !== item),
      }
    })
  }

  async function reloadSelectedShipment(shipmentNetId: string) {
    const result = await getShipmentListById(shipmentNetId)

    setSelectedShipment(result)
    setShipmentDraft(cloneShipmentList(result))
    refreshList()
  }

  async function saveSelectedShipment() {
    if (!shipmentDraft) {
      return
    }

    if (!canEditShipment) {
      setEditError(t('Відвантаження доступне тільки для перегляду'))

      return
    }

    if (
      shipmentDraft.ShipmentListItems.some(
        (item) => typeof item.QtyPlaces === 'number' && Number.isFinite(item.QtyPlaces) && item.QtyPlaces < 0,
      )
    ) {
      setEditError(t('Кількість місць не може бути від’ємною'))

      return
    }

    setSaving(true)
    setEditError(null)

    try {
      await updateShipmentList(shipmentDraft)

      if (shipmentDraft.NetUid) {
        await reloadSelectedShipment(shipmentDraft.NetUid)
      } else {
        closeShipment()
        refreshList()
      }
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function saveRecipient(recipient: ShipmentDeliveryRecipient) {
    if (activeModal?.kind !== 'recipient') {
      return
    }

    if (!canEditShipment || isRecipientAddressReadOnly(activeModal.item)) {
      return
    }

    const currentItem = activeModal.item
    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setEditError(null)

    try {
      await updateDeliveryRecipient(saleNetId, { ...recipient, SaleNetId: saleNetId })
      setActiveModal(null)
      patchShipmentDraftItem(currentItem, (item) => ({
        ...item,
        Sale: {
          ...item.Sale,
          DeliveryRecipient: { ...recipient, SaleNetId: saleNetId },
        },
      }))
      refreshList()
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function saveAddress(address: ShipmentDeliveryRecipientAddress) {
    if (activeModal?.kind !== 'address') {
      return
    }

    if (!canEditShipment || isRecipientAddressReadOnly(activeModal.item)) {
      return
    }

    const currentItem = activeModal.item
    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setEditError(null)

    try {
      await updateDeliveryRecipientAddress(saleNetId, { ...address, SaleNetId: saleNetId })
      setActiveModal(null)
      patchShipmentDraftItem(currentItem, (item) => ({
        ...item,
        Sale: {
          ...item.Sale,
          DeliveryRecipientAddress: { ...address, SaleNetId: saleNetId },
        },
      }))
      refreshList()
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function saveComment(comment: string) {
    if (activeModal?.kind !== 'comment') {
      return
    }

    if (!canEditShipment) {
      return
    }

    const currentItem = activeModal.item
    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setEditError(null)

    try {
      await updateSaleComment(saleNetId, comment)
      setActiveModal(null)
      patchShipmentDraftItem(currentItem, (item) => ({
        ...item,
        Sale: {
          ...item.Sale,
          Comment: comment,
          WarehousesShipment: item.Sale.WarehousesShipment
            ? {
                ...item.Sale.WarehousesShipment,
                Comment: comment,
              }
            : item.Sale.WarehousesShipment,
        },
      }))
      refreshList()
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function openDocument(loader: () => Promise<WarehouseUkraineExportDocument>) {
    setDocOpened(true)
    setDocLoading(true)
    setDocError(null)
    setPrintDoc(null)
    const pendingWindow = openPendingWarehouseDocumentWindow()

    try {
      const result = await loader()
      const documentUrl = getPreferredWarehousePrintUrl(result)

      if (documentUrl && openWarehouseDocumentInWindow(pendingWindow, documentUrl)) {
        setDocOpened(false)
      } else {
        closePendingWarehouseDocumentWindow(pendingWindow)
        setPrintDoc(hasWarehouseDocumentUrl(result) ? result : null)
        setDocError(hasWarehouseDocumentUrl(result) ? null : t('Немає документів для завантаження'))
      }
    } catch (printError) {
      closePendingWarehouseDocumentWindow(pendingWindow)
      setDocError(printError instanceof Error ? printError.message : t('Не вдалося виконати запит'))
    } finally {
      setDocLoading(false)
    }
  }

  function printSelectedShipment() {
    const shipmentNetId = shipmentDraft?.NetUid

    if (!shipmentNetId) {
      return
    }

    void openDocument(() => getShipmentDocument(shipmentNetId))
  }

  function printShipmentForSale(item: ShipmentListItem) {
    const saleNetId = item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    void openDocument(() => getShipmentListForSaleDocument(saleNetId))
  }

  const activeShipmentNumber = shipmentDraft?.Number || selectedShipment?.Number || ''
  const printSelectedShipmentDisabledReason = !shipmentDraft?.NetUid
    ? t('Збережіть відвантаження перед друком')
    : hasShipmentDraftChanges
      ? t('Збережіть зміни перед друком')
      : isSaving
        ? t('Дочекайтесь завершення операції')
        : null

  return (
    <Stack className="warehouse-ukraine-tab" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="app-filter-bar warehouse-ukraine-filter-bar is-all-shipments">
            <Select
              className="warehouse-ukraine-filter-input"
              data={typeOptions}
              label={t('Тип перевізника')}
              placeholder={t('Тип перевізника')}
              value={selectedTypeNetId}
              w={220}
              onChange={changeTransporterType}
            />
            <Select
              className="warehouse-ukraine-filter-input"
              data={transporterOptions}
              label={t('Перевізник')}
              placeholder={t('Перевізник')}
              value={selectedTransporterNetId}
              w={240}
              onChange={changeTransporter}
            />
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Початкова дата')}
              max={filterDraft.to || undefined}
              type="date"
              value={filterDraft.from}
              onChange={(event) => updateListFilter({ ...filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              className="warehouse-ukraine-filter-input"
              label={t('Кінцева дата')}
              min={filterDraft.from || undefined}
              type="date"
              value={filterDraft.to}
              onChange={(event) => updateListFilter({ ...filterDraft, to: event.currentTarget.value })}
            />
            <div className="app-filter-actions warehouse-ukraine-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon aria-label={t('Скинути')} color="gray" size={34} variant="light" onClick={resetListFilters}>
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Paginator
                hasNext={canMoveForward}
                isLoading={isLoading}
                page={page}
                pageSize={pageSize}
                pageSizeOptions={ALL_SHIPMENTS_PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={changePageSize}
                onRefresh={refreshList}
              />
            </div>
            <div ref={setTableToolbarSlot} className="warehouse-ukraine-table-toolbar-slot" />
            <div className="warehouse-ukraine-command-actions">
              <Button color={CREATE_ACTION_COLOR} size="sm" leftSection={<Plus size={18} />} onClick={onCreate}>
                {t('Створити')}
              </Button>
            </div>
          </div>

          {(error || filterError) && (
            <Alert className="console-table-alert" color={filterError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
              {filterError || error}
            </Alert>
          )}

          <div className="warehouse-ukraine-table console-table-body">
          <DataTable
            columns={listColumns}
            data={shipmentLists}
            defaultLayout={ALL_SHIPMENTS_TABLE_DEFAULT_LAYOUT}
            emptyText={`${t('Відвантажень не знайдено')}. ${t('Дані можуть бути поза вибраним періодом. Розширте дати у фільтрі.')}`}
            getRowId={getShipmentListRowId}
            height="100%"
            isLoading={isLoading}
            layoutVersion="warehouse-ukraine-all-shipments-2"
            minWidth={1100}
            showLayoutControls
            tableId="warehouse-ukraine-all-shipments"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={openShipment}
          />
          </div>
      </div>

      <AppDrawer
        opened={Boolean(shipmentDraft)}
        size="wide"
        title={
          <span className="warehouse-shipment-edit-title">
            {activeShipmentNumber ? `${t('Відвантаження')} ${activeShipmentNumber}` : t('Відвантаження')}
          </span>
        }
        onClose={requestCloseShipment}
      >
        <Stack className="warehouse-shipment-edit-shell" gap={8}>
          <div className="app-filter-bar warehouse-shipment-edit-toolbar">
            {shipmentDraft && (
              <Badge
                className={`app-role-pill warehouse-shipment-status-pill ${shipmentDraft.IsSent ? 'is-green' : 'is-gray'}`}
                variant="light"
              >
                {shipmentDraft.IsSent ? t('Проведено') : t('Не проведено')}
              </Badge>
            )}
            <TextInput
              className="warehouse-ukraine-filter-input warehouse-shipment-edit-comment"
              disabled={!canEditShipment || isSaving}
              label={t('Коментар')}
              value={shipmentDraft?.Comment || ''}
              onChange={(event) => updateDraftField('Comment', event.currentTarget.value)}
            />
            <TextInput
              className="warehouse-ukraine-filter-input warehouse-shipment-edit-date"
              disabled={!canEditShipment || isSaving}
              label={t('Дата від')}
              type="datetime-local"
              value={toDateTimeLocalValue(shipmentDraft?.FromDate)}
              onChange={(event) => updateDraftField('FromDate', event.currentTarget.value)}
            />
            <div className="warehouse-shipment-edit-actions">
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Plus size={18} />}
                variant="outline"
                onClick={openManualPicker}
                disabled={!canEditShipment || isSaving}
              >
                {t('Додати накладні')}
              </Button>
              <Tooltip disabled={!printSelectedShipmentDisabledReason} label={printSelectedShipmentDisabledReason || ''}>
                <Box component="span">
                  <Button
                    color={CREATE_ACTION_COLOR}
                    leftSection={<FileDown size={18} />}
                    variant="outline"
                    onClick={printSelectedShipment}
                    disabled={Boolean(printSelectedShipmentDisabledReason)}
                  >
                    {t('Друк PDF')}
                  </Button>
                </Box>
              </Tooltip>
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Save size={18} />}
                disabled={!canEditShipment || !hasShipmentDraftChanges}
                loading={isSaving}
                onClick={saveSelectedShipment}
              >
                {t('Зберегти')}
              </Button>
              <Button color="gray" leftSection={<X size={18} />} variant="light" onClick={requestCloseShipment}>
                {t('Скасувати')}
              </Button>
            </div>
          </div>

          {editError && (
            <Alert className="console-table-alert warehouse-shipment-edit-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
              {editError}
            </Alert>
          )}

          <div className="warehouse-shipment-edit-table console-table-body">
            <DataTable
              columns={editColumns}
              data={draftItems}
              defaultLayout={EDIT_SHIPMENT_TABLE_DEFAULT_LAYOUT}
              emptyText={t('Накладних не знайдено')}
              getRowId={getRowId}
              height="100%"
              layoutVersion="warehouse-ukraine-edit-shipment-2"
              minWidth={1650}
              tableId="warehouse-ukraine-edit-shipment"
            />
          </div>
        </Stack>
      </AppDrawer>

      <AppDrawer
        opened={manualPickerOpen}
        size="wide"
        title={t('Додати накладні до відвантаження')}
        onClose={closeManualPicker}
      >
        <Stack gap="md">
          <Card withBorder radius="md" padding="md">
            <Group align="end" gap="sm" wrap="wrap">
              <TextInput
                label={t('Початкова дата')}
                max={manualFilterDraft.to || undefined}
                type="date"
                value={manualFilterDraft.from}
                onChange={(event) => setManualFilterDraft({ ...manualFilterDraft, from: event.currentTarget.value })}
              />
              <TextInput
                label={t('Кінцева дата')}
                min={manualFilterDraft.from || undefined}
                type="date"
                value={manualFilterDraft.to}
                onChange={(event) => setManualFilterDraft({ ...manualFilterDraft, to: event.currentTarget.value })}
              />
              <Button
                disabled={Boolean(manualFilterError) || isManualLoading}
                leftSection={<RefreshCw size={18} />}
                loading={isManualLoading}
                variant="outline"
                onClick={() => void loadManualSales(manualFilterDraft)}
              >
                {t('Оновити')}
              </Button>
              <Text c="dimmed" size="sm">
                {t('Вибрано')}: {manualSelectedCount}
              </Text>
            </Group>
          </Card>

          {(manualError || manualFilterError) && (
            <Alert color={manualFilterError ? 'yellow' : 'red'} icon={<CircleAlert size={18} />} variant="light">
              {manualFilterError || manualError}
            </Alert>
          )}

          <DataTable
            columns={manualColumns}
            data={manualSales}
            defaultLayout={MANUAL_SHIPMENT_SALES_TABLE_DEFAULT_LAYOUT}
            emptyText={`${t('Накладних не знайдено')}. ${t('Дані можуть бути поза вибраним періодом. Розширте дати у фільтрі.')}`}
            getRowId={getManualSaleRowId}
            isLoading={isManualLoading}
            layoutVersion="warehouse-ukraine-manual-shipment-sales-1"
            maxHeight="calc(100vh - 360px)"
            minWidth={980}
            tableId="warehouse-ukraine-manual-shipment-sales"
            onRowClick={(sale) => {
              const saleKey = getShipmentSaleKey(sale)

              if (!saleKey || draftSaleKeys.has(saleKey)) {
                return
              }

              setManualSelectedSaleKeys((current) => ({ ...current, [saleKey]: !current[saleKey] }))
            }}
          />

          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isManualLoading} variant="light" onClick={closeManualPicker}>
              {t('Скасувати')}
            </Button>
            <Button
              disabled={isManualLoading || manualSelectedCount === 0}
              leftSection={<Plus size={18} />}
              onClick={appendManualSelectedSalesToDraft}
            >
              {t('Додати')}
            </Button>
          </Group>
        </Stack>
      </AppDrawer>

      <EditDeliveryRecipientModal
        isSaving={isSaving || !canEditShipment}
        opened={activeModal?.kind === 'recipient'}
        recipient={activeModal?.kind === 'recipient' ? activeModal.item.Sale.DeliveryRecipient || null : null}
        onClose={() => setActiveModal(null)}
        onSave={saveRecipient}
      />

      <EditDeliveryAddressModal
        address={activeModal?.kind === 'address' ? activeModal.item.Sale.DeliveryRecipientAddress || null : null}
        isSaving={isSaving || !canEditShipment}
        opened={activeModal?.kind === 'address'}
        onClose={() => setActiveModal(null)}
        onSave={saveAddress}
      />

      <ChangeCommentModal
        comment={activeModal?.kind === 'comment' ? activeModal.item.Sale.Comment || '' : ''}
        isSaving={isSaving || !canEditShipment}
        opened={activeModal?.kind === 'comment'}
        onClose={() => setActiveModal(null)}
        onSave={saveComment}
      />

      <DownloadDocumentModal
        document={printDoc}
        error={docError}
        isLoading={docLoading}
        opened={docOpened}
        onClose={() => setDocOpened(false)}
      />

      <AppModal
        centered
        opened={confirmCloseShipment}
        title={t('Закрити без збереження?')}
        onClose={() => setConfirmCloseShipment(false)}
      >
        <Stack gap="md">
          <Text size="sm">{t('Незбережені зміни у відвантаженні буде втрачено.')}</Text>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" variant="light" onClick={() => setConfirmCloseShipment(false)}>
              {t('Ні')}
            </Button>
            <Button color="red" onClick={closeShipment}>
              {t('Так')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function useAllShipmentColumns(indexMap: Map<ShipmentList, number>): DataTableColumn<ShipmentList>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ShipmentList>[]>(
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
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 160,
        minWidth: 140,
        accessor: (item) => item.FromDate,
        cell: (item) => formatDateTime(item.FromDate),
      },
      {
        id: 'editing',
        header: '',
        width: 70,
        minWidth: 60,
        align: 'center',
        accessor: (item) => hasEditingMarker(item),
        cell: (item) =>
          hasEditingMarker(item) ? (
            <Badge className="app-role-pill is-yellow" size="sm" variant="light">
              {t('Змінено')}
            </Badge>
          ) : (
            ''
          ),
      },
      {
        id: 'number',
        header: t('Номер'),
        width: 150,
        minWidth: 120,
        accessor: (item) => item.Number,
        cell: (item) => (
          <Text className="warehouse-shipment-cell-mono is-strong" fw={700}>
            {displayValue(item.Number).toLocaleUpperCase('uk-UA')}
          </Text>
        ),
      },
      {
        id: 'qtyPlaces',
        header: t('К-сть місць'),
        width: 130,
        minWidth: 100,
        align: 'right',
        accessor: (item) => sumQtyPlaces(item.ShipmentListItems),
        cell: (item) => (
          <Text className="warehouse-shipment-cell-mono" ta="right">
            {displayValue(sumQtyPlaces(item.ShipmentListItems))}
          </Text>
        ),
      },
      {
        id: 'transporter',
        header: t('Перевізник'),
        minWidth: 180,
        accessor: getShipmentListTransporterName,
        cell: (item) => {
          const transporterName = displayValue(getShipmentListTransporterName(item))
          // Icon from the shipment-list transporter (WarehouseUkraineTransporter carries CssClass/ImageUrl);
          // the leaner Sale.Transporter projection has no logo fields, so it is not used as an icon source.
          const transporterImageUrl = item.Transporter?.ImageUrl
          const transporterCssClass = item.Transporter?.CssClass

          if (!hasCarrierUpdateMarker(item)) {
            return <TransporterNameWithIcon cssClass={transporterCssClass} imageUrl={transporterImageUrl} name={transporterName} size={18} />
          }

          return (
            <Group gap={6} wrap="nowrap">
              <SquarePen size={14} />
              <TransporterIcon cssClass={transporterCssClass} imageUrl={transporterImageUrl} name={transporterName} size={18} />
              <Text size="sm" truncate>
                {transporterName}
              </Text>
            </Group>
          )
        },
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 240,
        accessor: (item) => item.Comment,
        cell: (item) => displayValue(item.Comment),
      },
      {
        id: 'status',
        header: t('Статус'),
        width: 150,
        minWidth: 120,
        accessor: (item) => item.IsSent,
        cell: (item) => (
          <Badge className={`app-role-pill ${item.IsSent ? 'is-green' : 'is-gray'}`} variant="light">
            {item.IsSent ? t('Проведено') : t('Не проведено')}
          </Badge>
        ),
      },
    ],
    [indexMap, t],
  )
}

type ManualShipmentSalesColumnsModel = {
  existingSaleKeys: Set<string>
  selectableSaleKeys: string[]
  qtyPlaces: Record<string, string>
  selectedSaleKeys: Record<string, boolean>
  setQtyPlaces: (updater: (current: Record<string, string>) => Record<string, string>) => void
  setSelectedSaleKeys: (updater: (current: Record<string, boolean>) => Record<string, boolean>) => void
}

function useManualShipmentSalesColumns(model: ManualShipmentSalesColumnsModel): DataTableColumn<ShipmentSale>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ShipmentSale>[]>(
    () => [
      {
        id: 'select',
        header: (() => {
          const selectableCount = model.selectableSaleKeys.length
          const selectedCount = model.selectableSaleKeys.filter((key) => model.selectedSaleKeys[key]).length
          const allSelected = selectableCount > 0 && selectedCount === selectableCount

          return (
            <Checkbox
              aria-label={t('Обрати всі')}
              checked={allSelected}
              disabled={selectableCount === 0}
              indeterminate={selectedCount > 0 && !allSelected}
              onChange={(event) => {
                const checked = event.currentTarget.checked

                model.setSelectedSaleKeys((current) => {
                  const next = { ...current }
                  model.selectableSaleKeys.forEach((key) => {
                    next[key] = checked
                  })

                  return next
                })
              }}
            />
          )
        })(),
        width: 54,
        minWidth: 48,
        align: 'center',
        enableSorting: false,
        accessor: getShipmentSaleKey,
        cell: (sale) => {
          const saleKey = getShipmentSaleKey(sale)
          const disabled = !saleKey || model.existingSaleKeys.has(saleKey)

          return (
            // Isolate from onRowClick — clicking the box must toggle only via its
            // own onChange, not also flip the row-click selection (double toggle).
            <div
              className="warehouse-shipment-select-wrap"
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <Checkbox
                checked={Boolean(saleKey && model.selectedSaleKeys[saleKey])}
                disabled={disabled}
                onChange={(event) => {
                  if (!saleKey) {
                    return
                  }

                  const checked = event.currentTarget.checked

                  model.setSelectedSaleKeys((current) => ({ ...current, [saleKey]: checked }))
                }}
              />
            </div>
          )
        },
      },
      {
        id: 'saleNumber',
        header: t('Номер'),
        width: 140,
        minWidth: 110,
        accessor: (sale) => sale.SaleNumber?.Value,
        cell: (sale) => (
          <Text
            className={`warehouse-shipment-cell-mono is-strong ${model.existingSaleKeys.has(getShipmentSaleKey(sale)) ? 'is-muted' : ''}`}
            fw={700}
          >
            {displayValue(sale.SaleNumber?.Value).toLocaleUpperCase('uk-UA')}
          </Text>
        ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 160,
        minWidth: 140,
        accessor: (sale) => sale.ChangedToInvoice,
        cell: (sale) => <span className="warehouse-shipment-cell-mono">{formatDateTime(sale.ChangedToInvoice)}</span>,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        minWidth: 220,
        accessor: getClientName,
        cell: (sale) => displayValue(getClientName(sale)),
      },
      {
        id: 'qtyPlaces',
        header: t('К-сть місць'),
        width: 120,
        minWidth: 100,
        enableSorting: false,
        accessor: getShipmentSaleKey,
        cell: (sale) => {
          const saleKey = getShipmentSaleKey(sale)
          const disabled = !saleKey || model.existingSaleKeys.has(saleKey)

          return (
            // Stop the click/focus from bubbling to the DataTable row's onRowClick
            // (which toggles selection) — otherwise focusing the field re-toggled
            // the row, the input jumped and the digit didn't register.
            <div
              className="warehouse-shipment-inline-number-wrap"
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <TextInput
                className="warehouse-shipment-inline-number"
                disabled={disabled}
                error={saleKey ? !isValidManualQtyPlaces(model.qtyPlaces[saleKey]) : false}
                size="xs"
                type="number"
                value={saleKey ? model.qtyPlaces[saleKey] || '' : ''}
                onChange={(event) => {
                  if (!saleKey) {
                    return
                  }

                  const value = event.currentTarget.value

                  model.setQtyPlaces((current) => ({ ...current, [saleKey]: value }))
                  model.setSelectedSaleKeys((current) => ({ ...current, [saleKey]: true }))
                }}
              />
            </div>
          )
        },
      },
      {
        id: 'totalAmount',
        header: t('Сума в EUR'),
        width: 120,
        minWidth: 100,
        align: 'right',
        accessor: (sale) => sale.TotalAmount,
        cell: (sale) => (
          <Text className="warehouse-shipment-cell-mono" ta="right">
            {displayValue(sale.TotalAmount)}
          </Text>
        ),
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 160,
        minWidth: 120,
        accessor: getResponsible,
        cell: (sale) => displayValue(getResponsible(sale)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 240,
        accessor: (sale) => sale.WarehousesShipment?.Comment || sale.Comment,
        cell: (sale) => displayValue(sale.WarehousesShipment?.Comment || sale.Comment),
      },
      {
        id: 'status',
        header: t('Стан'),
        width: 130,
        minWidth: 110,
        accessor: getShipmentSaleKey,
        cell: (sale) =>
          model.existingSaleKeys.has(getShipmentSaleKey(sale)) ? (
            <Badge className="app-role-pill is-gray" size="sm" variant="light">
              {t('Вже додано')}
            </Badge>
          ) : (
            ''
          ),
      },
    ],
    [model, t],
  )
}

type EditShipmentColumnsModel = {
  canEdit: boolean
  indexMap: Map<ShipmentListItem, number>
  onEditAddress: (item: ShipmentListItem) => void
  onEditComment: (item: ShipmentListItem) => void
  onEditRecipient: (item: ShipmentListItem) => void
  onPrintSale: (item: ShipmentListItem) => void
  onRemoveItem: (item: ShipmentListItem) => void
  updateItem: (item: ShipmentListItem, updater: (currentItem: ShipmentListItem) => ShipmentListItem) => void
}

function useEditShipmentColumns(model: EditShipmentColumnsModel): DataTableColumn<ShipmentListItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ShipmentListItem>[]>(
    () => [
      {
        id: 'client',
        header: t('Клієнт'),
        minWidth: 220,
        accessor: (item) => getClientName(item.Sale),
        cell: (item) => (
          <Text size="sm" td={getChangedTransporterDecoration(item)} truncate>
            {displayValue(getClientName(item.Sale))}
          </Text>
        ),
      },
      {
        id: 'recipient',
        header: t('Одержувач'),
        minWidth: 220,
        accessor: (item) => getRecipientInfo(item.Sale, t),
        cell: (item) => (
          <EditableTextCell
            disabled={!model.canEdit || isRecipientAddressReadOnly(item)}
            isCrossed={Boolean(getChangedTransporterDecoration(item))}
            text={getRecipientInfo(item.Sale, t)}
            onEdit={() => model.onEditRecipient(item)}
          />
        ),
      },
      {
        id: 'address',
        header: t('Адреса доставки'),
        minWidth: 220,
        accessor: (item) => getAddressInfo(item.Sale, t),
        cell: (item) => (
          <EditableTextCell
            disabled={!model.canEdit || isRecipientAddressReadOnly(item)}
            isCrossed={Boolean(getChangedTransporterDecoration(item))}
            text={getAddressInfo(item.Sale, t)}
            onEdit={() => model.onEditAddress(item)}
          />
        ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 160,
        minWidth: 140,
        accessor: (item) => item.Sale.ChangedToInvoice,
        cell: (item) => (
          <Text className="warehouse-shipment-cell-mono" size="sm" td={getChangedTransporterDecoration(item)}>
            {formatDateTime(item.Sale.ChangedToInvoice)}
          </Text>
        ),
      },
      {
        id: 'editing',
        header: '',
        width: 76,
        minWidth: 70,
        accessor: (item) => Boolean(item.Sale.HistoryInvoiceEdit?.length),
        cell: (item) =>
          item.Sale.HistoryInvoiceEdit?.length ? (
            <Badge className="app-role-pill is-yellow" size="sm" variant="light">
              {t('Змінено')}
            </Badge>
          ) : (
            ''
          ),
      },
      {
        id: 'saleNumber',
        header: t('Номер'),
        width: 140,
        minWidth: 110,
        accessor: (item) => item.Sale.SaleNumber?.Value,
        cell: (item) => (
          <Text className="warehouse-shipment-cell-mono is-strong" fw={700} td={getChangedTransporterDecoration(item)}>
            {displayValue(item.Sale.SaleNumber?.Value).toLocaleUpperCase('uk-UA')}
          </Text>
        ),
      },
      {
        id: 'qtyPlaces',
        header: t('К-сть місць'),
        width: 120,
        minWidth: 100,
        enableSorting: false,
        accessor: (item) => item.QtyPlaces,
        cell: (item) => (
          <TextInput
            className="warehouse-shipment-inline-number"
            size="xs"
            disabled={!model.canEdit}
            type="number"
            value={item.QtyPlaces == null ? '' : String(item.QtyPlaces)}
            onChange={(event) => {
              const value = event.currentTarget.value
              model.updateItem(item, (currentItem) => ({
                ...currentItem,
                IsDirty: true,
                QtyPlaces: parseOptionalNumber(value),
              }))
            }}
          />
        ),
      },
      {
        id: 'declarationAmount',
        header: t('Сума декларації'),
        width: 150,
        minWidth: 130,
        enableSorting: false,
        accessor: (item) => item.Sale.ShippingAmount,
        cell: (item) => (
          <TextInput
            className="warehouse-shipment-inline-number"
            size="xs"
            disabled={!model.canEdit}
            type="number"
            value={item.Sale.ShippingAmount == null ? '' : String(item.Sale.ShippingAmount)}
            onChange={(event) => {
              const value = event.currentTarget.value
              model.updateItem(item, (currentItem) => ({
                ...currentItem,
                IsDirty: true,
                Sale: {
                  ...currentItem.Sale,
                  ShippingAmount: parseOptionalNumber(value),
                },
              }))
            }}
          />
        ),
      },
      {
        id: 'declarationNumber',
        header: t('ТТН'),
        width: 150,
        minWidth: 120,
        enableSorting: false,
        accessor: (item) => item.Sale.TTN,
        cell: (item) => (
          <TextInput
            className="warehouse-shipment-inline-code"
            size="xs"
            disabled={!model.canEdit}
            value={item.Sale.TTN || ''}
            onChange={(event) => {
              const value = event.currentTarget.value
              model.updateItem(item, (currentItem) => ({
                ...currentItem,
                IsDirty: true,
                Sale: {
                  ...currentItem.Sale,
                  TTN: value,
                },
              }))
            }}
          />
        ),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 240,
        accessor: (item) => item.Sale.WarehousesShipment?.Comment || item.Sale.Comment,
        cell: (item) => (
          <EditableTextCell
            text={item.Sale.WarehousesShipment?.Comment || item.Sale.Comment || ''}
            disabled={!model.canEdit}
            isCrossed={Boolean(getChangedTransporterDecoration(item))}
            onEdit={() => model.onEditComment(item)}
          />
        ),
      },
      {
        id: 'print',
        header: '',
        width: 54,
        minWidth: 48,
        align: 'center',
        enableSorting: false,
        accessor: (item) => item.Sale.IsVatSale,
        cell: (item) =>
          item.Sale.IsVatSale ? (
            <Tooltip label={t('Друк PDF')}>
              <ActionIcon aria-label={t('Друк PDF')} color="gray" size="sm" variant="subtle" onClick={() => model.onPrintSale(item)}>
                <FileDown size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            ''
          ),
      },
      {
        id: 'remove',
        header: '',
        width: 54,
        minWidth: 48,
        align: 'center',
        enableSorting: false,
        accessor: (item) => model.indexMap.get(item),
        cell: (item) => (
          <Tooltip label={t('Видалити')}>
            <ActionIcon
              color="red"
              disabled={!model.canEdit}
              size="sm"
              variant="subtle"
              onClick={() => model.onRemoveItem(item)}
            >
              <Trash2 size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [model, t],
  )
}

type ShipmentColumnsModel = {
  canEditShipment: boolean
  commitQtyPlaces: (item: ShipmentListItem, rowId: string) => void
  itemIndexMap: Map<ShipmentListItem, number>
  qtyEdits: Record<string, string>
  setActiveModal: (modal: ActiveModal) => void
  setQtyEdits: (updater: (current: Record<string, string>) => Record<string, string>) => void
}

function useShipmentColumns(model: ShipmentColumnsModel): DataTableColumn<ShipmentListItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ShipmentListItem>[]>(() => {
    const rowId = (item: ShipmentListItem) => getRowId(item, (model.itemIndexMap.get(item) || 1) - 1)

    return [
      {
        id: 'index',
        header: '#',
        width: 52,
        minWidth: 44,
        align: 'right',
        enableSorting: false,
        accessor: (item) => model.itemIndexMap.get(item) || 0,
        cell: (item) => (
          <Text c="dimmed" size="sm">
            {model.itemIndexMap.get(item) || ''}
          </Text>
        ),
      },
      {
        id: 'clientName',
        header: t("Повне ім'я"),
        minWidth: 200,
        accessor: (item) => getClientName(item.Sale),
        cell: (item) => displayValue(getClientName(item.Sale)),
      },
      {
        id: 'deliveryRecipient',
        header: t('Одержувач'),
        minWidth: 220,
        accessor: (item) => getRecipientInfo(item.Sale, t),
        cell: (item) => (
          <EditableTextCell
            disabled={!model.canEditShipment || isRecipientAddressReadOnly(item)}
            text={getRecipientInfo(item.Sale, t)}
            onEdit={() => model.setActiveModal({ kind: 'recipient', item })}
          />
        ),
      },
      {
        id: 'deliveryAddress',
        header: t('Адреса доставки'),
        minWidth: 220,
        accessor: (item) => getAddressInfo(item.Sale, t),
        cell: (item) => (
          <EditableTextCell
            disabled={!model.canEditShipment || isRecipientAddressReadOnly(item)}
            text={getAddressInfo(item.Sale, t)}
            onEdit={() => {
              if (!item.Sale.DeliveryRecipient) {
                notifications.show({ color: 'yellow', message: t('Додайте одержувача для цієї накладної') })

                return
              }

              model.setActiveModal({ kind: 'address', item })
            }}
          />
        ),
      },
      {
        id: 'qtyPlaces',
        header: t('К-сть місць'),
        width: 110,
        minWidth: 90,
        enableSorting: false,
        accessor: (item) => item.QtyPlaces,
        cell: (item) => {
          const id = rowId(item)
          const draft = model.qtyEdits[id]
          const value = draft !== undefined ? draft : item.QtyPlaces === undefined ? '' : String(item.QtyPlaces)

          return (
            <TextInput
              disabled={!model.canEditShipment}
              size="xs"
              type="number"
              value={value}
              onBlur={() => model.commitQtyPlaces(item, id)}
              onChange={(event) => {
                const next = event.currentTarget.value
                model.setQtyEdits((current) => ({ ...current, [id]: next }))
              }}
            />
          )
        },
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 160,
        minWidth: 140,
        accessor: (item) => item.Sale.ChangedToInvoice,
        cell: (item) => <span className="warehouse-shipment-cell-mono">{formatDateTime(item.Sale.ChangedToInvoice)}</span>,
      },
      {
        id: 'saleNumber',
        header: t('Номер'),
        width: 120,
        minWidth: 90,
        accessor: (item) => item.Sale.SaleNumber?.Value,
        cell: (item) => (
          <Text className="warehouse-shipment-cell-mono is-strong" fw={700}>
            {displayValue(item.Sale.SaleNumber?.Value).toLocaleUpperCase('uk-UA')}
          </Text>
        ),
      },
      {
        id: 'totalAmount',
        header: t('Вся сума'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (item) => item.Sale.TotalAmountLocal,
        cell: (item) => (
          <Text className="warehouse-shipment-cell-mono" ta="right">
            {displayValue(item.Sale.TotalAmountLocal)}
          </Text>
        ),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 80,
        minWidth: 60,
        accessor: (item) => item.Sale.ClientAgreement?.Agreement?.Currency?.Code,
        cell: (item) => <span className="warehouse-shipment-cell-currency">{displayValue(item.Sale.ClientAgreement?.Agreement?.Currency?.Code)}</span>,
      },
      {
        id: 'responsible',
        header: t('Відповідальний'),
        width: 160,
        minWidth: 120,
        accessor: (item) => getResponsible(item.Sale),
        cell: (item) => displayValue(getResponsible(item.Sale)),
      },
      {
        id: 'comment',
        header: t('Коментар'),
        minWidth: 250,
        accessor: (item) => item.Sale.WarehousesShipment?.Comment || item.Sale.Comment,
        cell: (item) => (
          <EditableTextCell
            disabled={!model.canEditShipment}
            text={item.Sale.WarehousesShipment?.Comment || item.Sale.Comment || ''}
            onEdit={() => model.setActiveModal({ kind: 'comment', item })}
          />
        ),
      },
      {
        id: 'isCashOnDelivery',
        header: t('Наложений платіж'),
        width: 150,
        minWidth: 110,
        accessor: (item) => getCashOnDelivery(item.Sale),
        cell: (item) => (getCashOnDelivery(item.Sale) ? t('Так') : ''),
      },
      {
        id: 'cashOnDeliveryAmount',
        header: t('Сума НП'),
        width: 110,
        minWidth: 80,
        align: 'right',
        accessor: (item) => getCashOnDeliveryAmount(item.Sale),
        cell: (item) => {
          const amount = getCashOnDeliveryAmount(item.Sale)

          return amount === undefined || amount === null ? '' : (
            <Text className="warehouse-shipment-cell-mono" ta="right">
              {displayValue(amount)}
            </Text>
          )
        },
      },
      {
        id: 'ttnNumber',
        header: t('Номер ТТН'),
        width: 130,
        minWidth: 100,
        accessor: (item) => getTtnNumber(item.Sale),
        cell: (item) => <span className="warehouse-shipment-cell-mono">{displayValue(getTtnNumber(item.Sale)).toLocaleUpperCase('uk-UA')}</span>,
      },
      {
        id: 'ttn',
        header: t('Завантажити ТТН'),
        width: 150,
        minWidth: 120,
        align: 'center',
        enableSorting: false,
        accessor: (item) => getTtnPath(item.Sale),
        cell: (item) => {
          const path = getTtnPath(item.Sale)

          if (!path) {
            return ''
          }

          return (
            <Tooltip label={t('Завантажити ТТН')}>
              <Anchor href={upgradeHttpToHttps(path)} target="_blank" rel="noreferrer">
                <Download size={18} />
              </Anchor>
            </Tooltip>
          )
        },
      },
    ]
  }, [model, t])
}

type EditableTextCellProps = {
  disabled?: boolean
  isCrossed?: boolean
  text: string
  onEdit: () => void
}

function EditableTextCell({ disabled = false, isCrossed = false, onEdit, text }: EditableTextCellProps) {
  return (
    <Group gap={4} wrap="nowrap" align="center">
      <ActionIcon color="gray" disabled={disabled} size="sm" variant="subtle" onClick={onEdit}>
        <SquarePen size={14} />
      </ActionIcon>
      <Text size="sm" td={isCrossed ? 'line-through' : undefined} truncate>
        {text}
      </Text>
    </Group>
  )
}

function buildIndexMap(items: ShipmentListItem[]): Map<ShipmentListItem, number> {
  return items.reduce((indexMap, item, index) => {
    indexMap.set(item, index + 1)

    return indexMap
  }, new Map<ShipmentListItem, number>())
}

function buildShipmentListIndexMap(items: ShipmentList[]): Map<ShipmentList, number> {
  return items.reduce((indexMap, item, index) => {
    indexMap.set(item, index + 1)

    return indexMap
  }, new Map<ShipmentList, number>())
}
