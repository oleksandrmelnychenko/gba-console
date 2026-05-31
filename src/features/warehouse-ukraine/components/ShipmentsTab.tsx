import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleDashed,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconFileText,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconTrash,
  IconTruckDelivery,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getAllShipmentLists,
  getAutoShipmentList,
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
import { ChangeCommentModal } from './ChangeCommentModal'
import { displayValue, formatDateTime, getDateShiftedByDays } from './dateHelpers'
import { DownloadDocumentModal } from './DownloadDocumentModal'
import { EditDeliveryAddressModal } from './EditDeliveryAddressModal'
import { EditDeliveryRecipientModal } from './EditDeliveryRecipientModal'

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

const ALL_TRANSPORTERS_VALUE = '__all_transporters__'
const SHIPMENTS_TAB_ALL = 'all'
const SHIPMENTS_TAB_AUTO = 'auto'

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

function hasEditingMarker(shipmentList: ShipmentList): boolean {
  return shipmentList.ShipmentListItems.some(
    (item) => Boolean(item.Sale.HistoryInvoiceEdit?.length) || Boolean(item.Sale.UpdateDataCarrier?.length),
  )
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

function toDateTimeLocalValue(value: Date | string | undefined): string {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)

    if (match) {
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

function useShipmentsTabModel() {
  const { t } = useI18n()
  const initialFilters = useMemo<FilterDraft>(
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0) }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [transporterTypes, setTransporterTypes] = useValueState<ShipmentTransporterType[]>([])
  const [selectedTypeNetId, setSelectedTypeNetId] = useValueState<string | null>(null)
  const [transporters, setTransporters] = useValueState<ShipmentTransporter[]>([])
  const [selectedTransporterNetId, setSelectedTransporterNetId] = useValueState<string | null>(null)
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

  function commitQtyPlaces(item: ShipmentListItem, rowId: string) {
    const draft = qtyEdits[rowId]

    if (draft === undefined) {
      return
    }

    const parsed = Number.parseInt(draft, 10)

    if (!Number.isFinite(parsed) || parsed === item.QtyPlaces) {
      return
    }

    item.QtyPlaces = parsed
    item.IsDirty = true

    void saveShipmentList()
  }

  async function saveShipmentList() {
    setSaving(true)
    setError(null)

    try {
      await updateShipmentList(shipmentList)
      refreshList()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'))
    } finally {
      setSaving(false)
    }
  }

  async function carryOut() {
    setConfirmCarryOut(false)
    setSaving(true)
    setError(null)

    try {
      await updateShipmentList({ ...shipmentList, IsSent: true })
      refreshList()
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

    try {
      const result = await getShipmentCreatePageDocument({
        transporterNetId: selectedTransporterNetId,
        from: filterDraft.from,
        to: filterDraft.to,
      })
      setPrintDoc(result)
    } catch (printError) {
      setDocError(printError instanceof Error ? printError.message : t('Не вдалося виконати запит'))
    } finally {
      setDocLoading(false)
    }
  }

  return {
    activeModal,
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
    <Tabs value={activeTab} keepMounted={false} onChange={(value) => setActiveTab(value || SHIPMENTS_TAB_ALL)}>
      <Tabs.List>
        <Tabs.Tab value={SHIPMENTS_TAB_ALL} leftSection={<IconFileText size={16} />}>
          {t('Усі')}
        </Tabs.Tab>
        <Tabs.Tab value={SHIPMENTS_TAB_AUTO} leftSection={<IconTruckDelivery size={16} />}>
          {t('Підбір')}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value={SHIPMENTS_TAB_ALL} pt="md">
        <AllShipmentsPanel onCreate={() => setActiveTab(SHIPMENTS_TAB_AUTO)} />
      </Tabs.Panel>
      <Tabs.Panel value={SHIPMENTS_TAB_AUTO} pt="md">
        <AutoShipmentsPanel />
      </Tabs.Panel>
    </Tabs>
  )
}

function AutoShipmentsPanel() {
  const model = useShipmentsTabModel()
  const { t } = useI18n()
  const columns = useShipmentColumns(model)

  const typeOptions = toTransporterOptions(model.transporterTypes)
  const transporterOptions = toTransporterOptions(model.transporters)

  const activeModal = model.activeModal

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Відвантаження')}
        </Text>
        <Tooltip label={t('Оновити')}>
          <ActionIcon
            aria-label={t('Оновити')}
            color="gray"
            loading={model.isLoading}
            size={38}
            variant="light"
            onClick={() => model.refreshList()}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <Select
              data={typeOptions}
              label={t('Перевізники')}
              placeholder={t('Перевізники')}
              value={model.selectedTypeNetId}
              w={220}
              onChange={(value) => model.setSelectedTypeNetId(value)}
            />
            <Select
              data={transporterOptions}
              label={t('Перевізники')}
              placeholder={t('Перевізники')}
              value={model.selectedTransporterNetId}
              w={220}
              onChange={(value) => model.setSelectedTransporterNetId(value)}
            />
            <TextInput
              label={t('Початкова дата')}
              max={model.filterDraft.to || undefined}
              type="date"
              value={model.filterDraft.from}
              onChange={(event) => model.setFilterDraft({ ...model.filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              label={t('Кінцева дата')}
              min={model.filterDraft.from || undefined}
              type="date"
              value={model.filterDraft.to}
              onChange={(event) => model.setFilterDraft({ ...model.filterDraft, to: event.currentTarget.value })}
            />
            <Button
              color="green"
              disabled={!model.shipmentList.NetUid || model.items.length === 0}
              leftSection={<IconTruckDelivery size={18} />}
              loading={model.isSaving}
              variant="light"
              onClick={() => model.setConfirmCarryOut(true)}
            >
              {t('Провести і закрити')}
            </Button>
            <Button
              disabled={!model.selectedTransporterNetId || Boolean(model.filterError)}
              leftSection={<IconPrinter size={18} />}
              variant="light"
              onClick={() => model.printShipments()}
            >
              {t('Роздрукувати')}
            </Button>
          </Group>

          {(model.error || model.filterError) && (
            <Alert color={model.filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {model.filterError || model.error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={model.items}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Відвантажень не знайдено')}
            getRowId={getRowId}
            isLoading={model.isLoading}
            layoutVersion="warehouse-ukraine-shipments-1"
            maxHeight="calc(100vh - 420px)"
            minWidth={1800}
            tableId="warehouse-ukraine-shipments"
          />
        </Stack>
      </Card>

      <EditDeliveryRecipientModal
        isSaving={model.isSaving}
        opened={activeModal?.kind === 'recipient'}
        recipient={activeModal?.kind === 'recipient' ? activeModal.item.Sale.DeliveryRecipient || null : null}
        onClose={() => model.setActiveModal(null)}
        onSave={model.saveRecipient}
      />

      <EditDeliveryAddressModal
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
    () => ({ from: getDateShiftedByDays(-7), to: getDateShiftedByDays(0) }),
    [],
  )
  const [filterDraft, setFilterDraft] = useValueState<FilterDraft>(initialFilters)
  const [transporterTypes, setTransporterTypes] = useValueState<ShipmentTransporterType[]>([])
  const [selectedTypeNetId, setSelectedTypeNetId] = useValueState<string | null>(null)
  const [transporters, setTransporters] = useValueState<ShipmentTransporter[]>([])
  const [selectedTransporterNetId, setSelectedTransporterNetId] = useValueState<string>(ALL_TRANSPORTERS_VALUE)
  const [shipmentLists, setShipmentLists] = useValueState<ShipmentList[]>([])
  const [selectedShipment, setSelectedShipment] = useValueState<ShipmentList | null>(null)
  const [shipmentDraft, setShipmentDraft] = useValueState<ShipmentList | null>(null)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
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
  const listIndexMap = useMemo(() => buildShipmentListIndexMap(shipmentLists), [shipmentLists])
  const listColumns = useAllShipmentColumns(listIndexMap)
  const draftItems = useMemo(() => shipmentDraft?.ShipmentListItems || [], [shipmentDraft])
  const draftIndexMap = useMemo(() => buildIndexMap(draftItems), [draftItems])

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
          limit: 20,
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
    reloadKey,
    selectedTransporterNetId,
    setError,
    setLoading,
    setShipmentLists,
    t,
  ])

  const editColumns = useEditShipmentColumns({
    indexMap: draftIndexMap,
    onEditAddress: (item) => setActiveModal({ kind: 'address', item }),
    onEditComment: (item) => setActiveModal({ kind: 'comment', item }),
    onEditRecipient: (item) => setActiveModal({ kind: 'recipient', item }),
    onPrintSale: printShipmentForSale,
    onRemoveItem: removeDraftItem,
    updateItem: updateDraftItem,
  })

  const typeOptions = toTransporterOptions(transporterTypes)
  const transporterOptions = [
    { value: ALL_TRANSPORTERS_VALUE, label: t('Усі') },
    ...toTransporterOptions(transporters),
  ]

  function refreshList() {
    reload()
  }

  function openShipment(shipmentList: ShipmentList) {
    const draft = cloneShipmentList(shipmentList)

    setEditError(null)
    setSelectedShipment(shipmentList)
    setShipmentDraft(draft)
  }

  function closeShipment() {
    setEditError(null)
    setSelectedShipment(null)
    setShipmentDraft(null)
  }

  function updateDraftField(field: 'Comment' | 'FromDate', value: string) {
    setShipmentDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function updateDraftItem(
    item: ShipmentListItem,
    updater: (currentItem: ShipmentListItem) => ShipmentListItem,
  ) {
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

  function removeDraftItem(item: ShipmentListItem) {
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

    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setEditError(null)

    try {
      await updateDeliveryRecipient(saleNetId, { ...recipient, SaleNetId: saleNetId })
      setActiveModal(null)

      if (shipmentDraft?.NetUid) {
        await reloadSelectedShipment(shipmentDraft.NetUid)
      }
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

    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setEditError(null)

    try {
      await updateDeliveryRecipientAddress(saleNetId, { ...address, SaleNetId: saleNetId })
      setActiveModal(null)

      if (shipmentDraft?.NetUid) {
        await reloadSelectedShipment(shipmentDraft.NetUid)
      }
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

    const saleNetId = activeModal.item.Sale.NetUid

    if (!saleNetId) {
      return
    }

    setSaving(true)
    setEditError(null)

    try {
      await updateSaleComment(saleNetId, comment)
      setActiveModal(null)

      if (shipmentDraft?.NetUid) {
        await reloadSelectedShipment(shipmentDraft.NetUid)
      }
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

    try {
      const result = await loader()

      setPrintDoc(result)
    } catch (printError) {
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

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Усі відвантаження')}
        </Text>
        <Group gap="sm">
          <Button leftSection={<IconPlus size={18} />} variant="light" onClick={onCreate}>
            {t('Створити')}
          </Button>
          <Tooltip label={t('Оновити')}>
            <ActionIcon
              aria-label={t('Оновити')}
              color="gray"
              loading={isLoading}
              size={38}
              variant="light"
              onClick={refreshList}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <Select
              data={typeOptions}
              label={t('Тип перевізника')}
              placeholder={t('Тип перевізника')}
              value={selectedTypeNetId}
              w={220}
              onChange={(value) => setSelectedTypeNetId(value)}
            />
            <Select
              data={transporterOptions}
              label={t('Перевізник')}
              placeholder={t('Перевізник')}
              value={selectedTransporterNetId}
              w={240}
              onChange={(value) => setSelectedTransporterNetId(value || ALL_TRANSPORTERS_VALUE)}
            />
            <TextInput
              label={t('Початкова дата')}
              max={filterDraft.to || undefined}
              type="date"
              value={filterDraft.from}
              onChange={(event) => setFilterDraft({ ...filterDraft, from: event.currentTarget.value })}
            />
            <TextInput
              label={t('Кінцева дата')}
              min={filterDraft.from || undefined}
              type="date"
              value={filterDraft.to}
              onChange={(event) => setFilterDraft({ ...filterDraft, to: event.currentTarget.value })}
            />
          </Group>

          {(error || filterError) && (
            <Alert color={filterError ? 'yellow' : 'red'} icon={<IconAlertCircle size={18} />} variant="light">
              {filterError || error}
            </Alert>
          )}

          <DataTable
            columns={listColumns}
            data={shipmentLists}
            defaultLayout={ALL_SHIPMENTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Відвантажень не знайдено')}
            getRowId={getShipmentListRowId}
            isLoading={isLoading}
            layoutVersion="warehouse-ukraine-all-shipments-1"
            maxHeight="calc(100vh - 420px)"
            minWidth={1100}
            tableId="warehouse-ukraine-all-shipments"
            onRowClick={openShipment}
          />
        </Stack>
      </Card>

      <AppDrawer
        opened={Boolean(shipmentDraft)}
        size="min(1180px, 100vw)"
        title={activeShipmentNumber ? `${t('Відвантаження')} ${activeShipmentNumber}` : t('Відвантаження')}
        onClose={closeShipment}
      >
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="wrap">
            <TextInput
              label={t('Коментар')}
              value={shipmentDraft?.Comment || ''}
              w={280}
              onChange={(event) => updateDraftField('Comment', event.currentTarget.value)}
            />
            <TextInput
              label={t('Дата від')}
              type="datetime-local"
              value={toDateTimeLocalValue(shipmentDraft?.FromDate)}
              onChange={(event) => updateDraftField('FromDate', event.currentTarget.value)}
            />
            <Button
              leftSection={<IconPrinter size={18} />}
              variant="light"
              onClick={printSelectedShipment}
              disabled={!shipmentDraft?.NetUid}
            >
              {t('Роздрукувати')}
            </Button>
            <Button
              color="green"
              leftSection={<IconDeviceFloppy size={18} />}
              loading={isSaving}
              onClick={saveSelectedShipment}
            >
              {t('Зберегти')}
            </Button>
            <Button color="gray" leftSection={<IconX size={18} />} variant="light" onClick={closeShipment}>
              {t('Скасувати')}
            </Button>
          </Group>

          {editError && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {editError}
            </Alert>
          )}

          <Divider />

          <DataTable
            columns={editColumns}
            data={draftItems}
            defaultLayout={EDIT_SHIPMENT_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Накладних не знайдено')}
            getRowId={getRowId}
            layoutVersion="warehouse-ukraine-edit-shipment-1"
            maxHeight="calc(100vh - 330px)"
            minWidth={1650}
            tableId="warehouse-ukraine-edit-shipment"
          />
        </Stack>
      </AppDrawer>

      <EditDeliveryRecipientModal
        isSaving={isSaving}
        opened={activeModal?.kind === 'recipient'}
        recipient={activeModal?.kind === 'recipient' ? activeModal.item.Sale.DeliveryRecipient || null : null}
        onClose={() => setActiveModal(null)}
        onSave={saveRecipient}
      />

      <EditDeliveryAddressModal
        address={activeModal?.kind === 'address' ? activeModal.item.Sale.DeliveryRecipientAddress || null : null}
        isSaving={isSaving}
        opened={activeModal?.kind === 'address'}
        onClose={() => setActiveModal(null)}
        onSave={saveAddress}
      />

      <ChangeCommentModal
        comment={activeModal?.kind === 'comment' ? activeModal.item.Sale.Comment || '' : ''}
        isSaving={isSaving}
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
            <Badge color="yellow" size="sm" variant="light">
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
        cell: (item) => <Text fw={700}>{displayValue(item.Number)}</Text>,
      },
      {
        id: 'qtyPlaces',
        header: t('К-сть місць'),
        width: 130,
        minWidth: 100,
        align: 'right',
        accessor: (item) => sumQtyPlaces(item.ShipmentListItems),
        cell: (item) => displayValue(sumQtyPlaces(item.ShipmentListItems)),
      },
      {
        id: 'transporter',
        header: t('Перевізник'),
        minWidth: 180,
        accessor: getShipmentListTransporterName,
        cell: (item) => displayValue(getShipmentListTransporterName(item)),
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
          <Badge
            color={item.IsSent ? 'green' : 'gray'}
            leftSection={item.IsSent ? <IconCircleCheck size={12} /> : <IconCircleDashed size={12} />}
            variant="light"
          >
            {item.IsSent ? t('Проведено') : t('Не проведено')}
          </Badge>
        ),
      },
    ],
    [indexMap, t],
  )
}

type EditShipmentColumnsModel = {
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
        cell: (item) => displayValue(getClientName(item.Sale)),
      },
      {
        id: 'recipient',
        header: t('Одержувач'),
        minWidth: 220,
        accessor: (item) => getRecipientInfo(item.Sale, t),
        cell: (item) => (
          <EditableTextCell text={getRecipientInfo(item.Sale, t)} onEdit={() => model.onEditRecipient(item)} />
        ),
      },
      {
        id: 'address',
        header: t('Адреса доставки'),
        minWidth: 220,
        accessor: (item) => getAddressInfo(item.Sale, t),
        cell: (item) => (
          <EditableTextCell text={getAddressInfo(item.Sale, t)} onEdit={() => model.onEditAddress(item)} />
        ),
      },
      {
        id: 'fromDate',
        header: t('Від якої дати'),
        width: 160,
        minWidth: 140,
        accessor: (item) => item.Sale.ChangedToInvoice,
        cell: (item) => formatDateTime(item.Sale.ChangedToInvoice),
      },
      {
        id: 'editing',
        header: '',
        width: 76,
        minWidth: 70,
        accessor: (item) => Boolean(item.Sale.HistoryInvoiceEdit?.length),
        cell: (item) =>
          item.Sale.HistoryInvoiceEdit?.length ? (
            <Badge color="yellow" size="sm" variant="light">
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
        cell: (item) => <Text fw={700}>{displayValue(item.Sale.SaleNumber?.Value)}</Text>,
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
            size="xs"
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
            size="xs"
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
            size="xs"
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
            <Tooltip label={t('Роздрукувати')}>
              <ActionIcon color="gray" size="sm" variant="subtle" onClick={() => model.onPrintSale(item)}>
                <IconPrinter size={16} />
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
            <ActionIcon color="red" size="sm" variant="subtle" onClick={() => model.onRemoveItem(item)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [model, t],
  )
}

type ShipmentColumnsModel = {
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
            text={getAddressInfo(item.Sale, t)}
            onEdit={() => model.setActiveModal({ kind: 'address', item })}
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
        cell: (item) => formatDateTime(item.Sale.ChangedToInvoice),
      },
      {
        id: 'saleNumber',
        header: t('Номер'),
        width: 120,
        minWidth: 90,
        accessor: (item) => item.Sale.SaleNumber?.Value,
        cell: (item) => <Text fw={700}>{displayValue(item.Sale.SaleNumber?.Value)}</Text>,
      },
      {
        id: 'totalAmount',
        header: t('Вся сума'),
        width: 110,
        minWidth: 90,
        align: 'right',
        accessor: (item) => item.Sale.TotalAmountLocal,
        cell: (item) => displayValue(item.Sale.TotalAmountLocal),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 80,
        minWidth: 60,
        accessor: (item) => item.Sale.ClientAgreement?.Agreement?.Currency?.Code,
        cell: (item) => displayValue(item.Sale.ClientAgreement?.Agreement?.Currency?.Code),
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

          return amount === undefined || amount === null ? '' : displayValue(amount)
        },
      },
      {
        id: 'ttnNumber',
        header: t('Номер ТТН'),
        width: 130,
        minWidth: 100,
        accessor: (item) => getTtnNumber(item.Sale),
        cell: (item) => displayValue(getTtnNumber(item.Sale)),
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
              <Anchor href={path} target="_blank" rel="noreferrer">
                <IconDownload size={18} />
              </Anchor>
            </Tooltip>
          )
        },
      },
    ]
  }, [model, t])
}

type EditableTextCellProps = {
  text: string
  onEdit: () => void
}

function EditableTextCell({ onEdit, text }: EditableTextCellProps) {
  return (
    <Group gap={4} wrap="nowrap" align="center">
      <ActionIcon color="gray" size="sm" variant="subtle" onClick={onEdit}>
        <IconEdit size={14} />
      </ActionIcon>
      <Text size="sm" truncate>
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
