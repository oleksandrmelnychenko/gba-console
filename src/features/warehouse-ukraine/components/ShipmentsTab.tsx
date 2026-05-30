import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconDownload,
  IconEdit,
  IconPrinter,
  IconRefresh,
  IconTruckDelivery,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { translate } from '../../../shared/i18n/translate'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  getAutoShipmentList,
  getShipmentCreatePageDocument,
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
    if (!shipmentList.NetUid) {
      return
    }

    setDocOpened(true)
    setDocLoading(true)
    setDocError(null)
    setPrintDoc(null)

    try {
      const result = await getShipmentCreatePageDocument(shipmentList.NetUid)
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
  const model = useShipmentsTabModel()
  const { t } = useI18n()
  const columns = useShipmentColumns(model)

  const typeOptions = model.transporterTypes
    .filter((type) => type.NetUid)
    .map((type) => ({ value: type.NetUid as string, label: type.Name || '' }))
  const transporterOptions = model.transporters
    .filter((transporter) => transporter.NetUid)
    .map((transporter) => ({ value: transporter.NetUid as string, label: transporter.Name || '' }))

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
              disabled={!model.shipmentList.NetUid}
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
