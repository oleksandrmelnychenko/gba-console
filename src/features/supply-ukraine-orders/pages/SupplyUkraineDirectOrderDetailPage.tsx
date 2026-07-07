import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Check, CircleAlert, PackagePlus, Pencil, Plus, ReceiptText, Trash2, Upload } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './supply-order-detail.css'
import { formatLocalDate, formatLocalDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import {
  createSupplyCreditNote,
  getDirectSupplyOrderById,
  updateDirectSupplyOrder,
  uploadSupplyOrderDocument,
} from '../api/supplyUkraineOrdersApi'
import { DirectOrderPaymentTasksCard } from '../components/DirectOrderPaymentTasksCard'
import { DirectSupplyOrderProFormCard } from '../components/DirectSupplyOrderProFormCard'
import type {
  CreditNoteDocument,
  DirectSupplyOrder,
  SupplyOrderDeliveryDocument,
} from '../types'
import { hasSupplyProForm } from '../proFormHelpers'

const TRANSPORTATION_OPTIONS: Array<{ label: string, value: string }> = [
  { label: 'Авто', value: '0' },
  { label: 'Море', value: '1' },
  { label: 'Авіа', value: '2' },
]
const PERMISSION_APPROVE_ORDER = 'LOGISTIC_WAY_ordersUkraineAllEdit_ApprovedSupplyOrderStatus_PKEY'
const PERMISSION_CREDIT_NOTES = 'LOGISTIC_WAY_ordersUkraineAllEdit_CreditNotes_PKEY'
const PERMISSION_EDIT_ORDER_AMOUNT = 'LOGISTIC_WAY_ordersUkraineAllEdit_EditSupplyNewAmount_PKEY'
const PERMISSION_OPEN_DIRECT_INVOICES = 'UkraineAllOrders_SelectAnOption_Products_PKEY'
const PERMISSION_OPEN_DIRECT_PRODUCT_INCOME = 'UkraineAllOrders_SelectAnOption_PlacementSupplyOrder_PKEY'
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
const numberFormatter = new Intl.NumberFormat('uk-UA')
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type AmountEditState = {
  amountValue: number | string
  dateValue: string
  isEditingAmount: boolean
  transportationType: string
}

type AmountEditAction =
  | { type: 'setAmountValue', value: number | string }
  | { type: 'setDateValue', value: string }
  | { type: 'setTransportationType', value: string }
  | { type: 'startEditing' }
  | { type: 'syncAmountInputs', order: DirectSupplyOrder | null }

type StatusModalState = {
  comment: string
  document: SupplyOrderDeliveryDocument | null
  received: boolean
}

type StatusModalAction =
  | { type: 'close' }
  | { type: 'open', document: SupplyOrderDeliveryDocument }
  | { type: 'setComment', value: string }
  | { type: 'setReceived', value: boolean }

type CreditNoteState = {
  amount: number | string
  comment: string
  date: string
  file: File | null
  isDrawerOpen: boolean
  isModalOpen: boolean
  number: string
}

type CreditNoteAction =
  | { type: 'closeModal' }
  | { type: 'openModal' }
  | { type: 'setAmount', value: number | string }
  | { type: 'setComment', value: string }
  | { type: 'setDate', value: string }
  | { type: 'setDrawerOpen', open: boolean }
  | { type: 'setFile', value: File | null }
  | { type: 'setNumber', value: string }

const INITIAL_AMOUNT_EDIT_STATE: AmountEditState = {
  amountValue: '',
  dateValue: '',
  isEditingAmount: false,
  transportationType: '0',
}

const CLOSED_STATUS_MODAL_STATE: StatusModalState = {
  comment: '',
  document: null,
  received: true,
}

function createInitialCreditNoteState(): CreditNoteState {
  return {
    amount: '',
    comment: '',
    date: formatLocalDate(new Date()),
    file: null,
    isDrawerOpen: false,
    isModalOpen: false,
    number: '',
  }
}

function amountEditReducer(state: AmountEditState, action: AmountEditAction): AmountEditState {
  switch (action.type) {
    case 'setAmountValue':
      return { ...state, amountValue: action.value }
    case 'setDateValue':
      return { ...state, dateValue: action.value }
    case 'setTransportationType':
      return { ...state, transportationType: action.value }
    case 'startEditing':
      return { ...state, isEditingAmount: true }
    case 'syncAmountInputs':
      return {
        ...state,
        amountValue: typeof action.order?.NetPrice === 'number' ? action.order.NetPrice : '',
        dateValue: toDateTimeInput(action.order?.DateFrom),
        isEditingAmount: false,
      }
    default:
      return state
  }
}

function statusModalReducer(state: StatusModalState, action: StatusModalAction): StatusModalState {
  switch (action.type) {
    case 'close':
      return CLOSED_STATUS_MODAL_STATE
    case 'open':
      return {
        comment: action.document.Comment || '',
        document: action.document,
        received: action.document.IsReceived ?? true,
      }
    case 'setComment':
      return { ...state, comment: action.value }
    case 'setReceived':
      return { ...state, received: action.value }
    default:
      return state
  }
}

function creditNoteReducer(state: CreditNoteState, action: CreditNoteAction): CreditNoteState {
  switch (action.type) {
    case 'closeModal':
      return { ...state, file: null, isModalOpen: false }
    case 'openModal':
      return {
        ...state,
        amount: '',
        comment: '',
        date: formatLocalDate(new Date()),
        file: null,
        isModalOpen: true,
        number: '',
      }
    case 'setAmount':
      return { ...state, amount: action.value }
    case 'setComment':
      return { ...state, comment: action.value }
    case 'setDate':
      return { ...state, date: action.value }
    case 'setDrawerOpen':
      return { ...state, isDrawerOpen: action.open }
    case 'setFile':
      return { ...state, file: action.value }
    case 'setNumber':
      return { ...state, number: action.value }
    default:
      return state
  }
}

export function SupplyUkraineDirectOrderDetailPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<DirectSupplyOrder | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amountEditState, dispatchAmountEdit] = useReducer(amountEditReducer, INITIAL_AMOUNT_EDIT_STATE)
  const [statusModalState, dispatchStatusModal] = useReducer(statusModalReducer, CLOSED_STATUS_MODAL_STATE)
  const [creditNoteState, dispatchCreditNote] = useReducer(creditNoteReducer, undefined, createInitialCreditNoteState)
  const {
    amountValue,
    dateValue,
    isEditingAmount,
    transportationType,
  } = amountEditState
  const {
    comment: statusComment,
    document: statusDocument,
    received: statusReceived,
  } = statusModalState
  const {
    amount: creditNoteAmount,
    comment: creditNoteComment,
    date: creditNoteDate,
    file: creditNoteFile,
    isDrawerOpen: creditNotesOpen,
    isModalOpen: creditNoteModalOpen,
    number: creditNoteNumber,
  } = creditNoteState
  const hasInvoices = (order?.SupplyInvoices?.length || 0) > 0
  const isLocked = Boolean(order?.IsOrderShipped) || Boolean(order?.IsCompleted)
  const areDeliveryDocumentActionsLocked = Boolean(order?.IsCompleted)
  const canApproveOrder = hasPermission(PERMISSION_APPROVE_ORDER)
  const canOpenCreditNotes = hasPermission(PERMISSION_CREDIT_NOTES)
  const canEditAmount = hasPermission(PERMISSION_EDIT_ORDER_AMOUNT)
  const canOpenInvoices = hasPermission(PERMISSION_OPEN_DIRECT_INVOICES) && hasSupplyProForm(order)
  const canOpenProductIncome = hasPermission(PERMISSION_OPEN_DIRECT_PRODUCT_INCOME) && hasInvoices

  useEffect(() => {
    let cancelled = false

    async function loadOrder() {
      if (!id) {
        setError(t('Не задано ідентифікатор замовлення'))
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const nextOrder = await getDirectSupplyOrderById(id)

        if (!cancelled) {
          setOrder(nextOrder)
          dispatchAmountEdit({ type: 'setTransportationType', value: String(nextOrder?.TransportationType ?? 0) })
          syncAmountInputs(nextOrder)
        }
      } catch (loadError) {
        if (!cancelled) {
          setOrder(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOrder()

    return () => {
      cancelled = true
    }
  }, [id, t])

  async function reloadOrder() {
    if (!id) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const nextOrder = await getDirectSupplyOrderById(id)
      setOrder(nextOrder)
      dispatchAmountEdit({ type: 'setTransportationType', value: String(nextOrder?.TransportationType ?? 0) })
      syncAmountInputs(nextOrder)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'))
    } finally {
      setLoading(false)
    }
  }

  function syncAmountInputs(nextOrder: DirectSupplyOrder | null) {
    dispatchAmountEdit({ type: 'syncAmountInputs', order: nextOrder })
  }

  async function savePatch(patch: Partial<DirectSupplyOrder>, successMessage: string) {
    if (!order) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updated = await updateDirectSupplyOrder({ ...order, ...patch })
      setOrder(updated)
      if (updated) {
        dispatchAmountEdit({ type: 'setTransportationType', value: String(updated.TransportationType ?? 0) })
      }
      syncAmountInputs(updated)
      notifications.show({ color: 'green', message: successMessage })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти замовлення'))
    } finally {
      setSaving(false)
    }
  }

  function saveAmount() {
    const amount = Number(amountValue)

    if (!amount || amount <= 0) {
      setError(t('Введіть суму замовлення'))
      return
    }

    const isoDate = dateValue ? new Date(dateValue).toISOString() : undefined

    savePatch({ DateFrom: isoDate, NetPrice: amount }, t('Замовлення оновлено'))
  }

  function cancelAmountEdit() {
    syncAmountInputs(order)
  }

  async function uploadDocumentFile(document: SupplyOrderDeliveryDocument, file: File | null) {
    if (!file) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const formData = new FormData()

      formData.append('document', file)
      formData.append('entity', JSON.stringify({
        ...document,
        ContentType: file.type,
        FileName: file.name,
      }))

      await uploadSupplyOrderDocument(formData)
      await reloadOrder()
      notifications.show({ color: 'green', message: t('Документ завантажено') })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити документ'))
    } finally {
      setSaving(false)
    }
  }

  function openStatusModal(document: SupplyOrderDeliveryDocument) {
    dispatchStatusModal({ type: 'open', document })
  }

  function closeStatusModal() {
    dispatchStatusModal({ type: 'close' })
  }

  function openCreditNoteModal() {
    dispatchCreditNote({ type: 'openModal' })
  }

  function closeCreditNoteModal() {
    dispatchCreditNote({ type: 'closeModal' })
  }

  function saveDocumentStatus() {
    if (!order || !statusDocument) {
      return
    }

    const documents = (order.SupplyOrderDeliveryDocuments || []).map((document) =>
      isSameDocument(document, statusDocument)
        ? {
          ...document,
          Comment: statusComment,
          IsProcessed: true,
          IsReceived: statusReceived,
          ProcessedDate: new Date().toISOString(),
        }
        : document)

    closeStatusModal()
    savePatch({ SupplyOrderDeliveryDocuments: documents }, t('Зміна статуса документа'))
  }

  function clearDocumentFile(document: SupplyOrderDeliveryDocument) {
    if (!order) {
      return
    }

    const documents = (order.SupplyOrderDeliveryDocuments || []).map((current) =>
      isSameDocument(current, document)
        ? { ...current, ContentType: '', Deleted: false, DocumentUrl: '', FileName: '' }
        : current)

    savePatch({ SupplyOrderDeliveryDocuments: documents }, t('Файл видалено'))
  }

  async function saveCreditNote() {
    if (!order?.NetUid) {
      return
    }

    if (!creditNoteFile) {
      setError(t('Завантажте документ'))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const amount = Number(creditNoteAmount) || 0
      const creditNote: CreditNoteDocument = {
        Amount: amount,
        Comment: creditNoteComment,
        ContentType: creditNoteFile.type,
        FileName: creditNoteFile.name,
        FromDate: creditNoteDate ? new Date(creditNoteDate).toDateString() : new Date().toDateString(),
        Number: creditNoteNumber,
      }
      const formData = new FormData()

      formData.append('document', creditNoteFile)
      formData.append('creditNote', JSON.stringify(creditNote))

      const updated = await createSupplyCreditNote(order.NetUid, formData)

      if (updated) {
        setOrder(updated)
        dispatchAmountEdit({ type: 'setTransportationType', value: String(updated.TransportationType ?? 0) })
        syncAmountInputs(updated)
      } else {
        await reloadOrder()
      }

      closeCreditNoteModal()
      dispatchCreditNote({ type: 'setDrawerOpen', open: true })
      notifications.show({ color: 'green', message: t('Кредит ноту створено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося створити кредит ноту'))
    } finally {
      setSaving(false)
    }
  }

  function approveOrder() {
    savePatch({ IsApproved: true }, t('Замовлення погоджено'))
  }

  const documentColumns: DataTableColumn<SupplyOrderDeliveryDocument>[] = [
    {
      id: 'name',
      header: t('Документ'),
      minWidth: 220,
      accessor: (document) => document.Name || document.FileName,
      cell: (document) => document.DocumentUrl
        ? <a className="document-link" href={upgradeHttpToHttps(document.DocumentUrl)} rel="noreferrer" target="_blank">{document.Name || document.FileName || t('Документ')}</a>
        : document.Name || document.FileName || '',
    },
    {
      id: 'fileName',
      header: t('Файл'),
      minWidth: 220,
      accessor: (document) => document.FileName,
      cell: (document) => document.FileName || '',
    },
    {
      id: 'processed',
      header: t('Опрацьовано'),
      width: 130,
      accessor: (document) => document.IsProcessed,
      cell: (document) => yesNoPill(t, document.IsProcessed),
    },
    {
      id: 'received',
      header: t('Отримано'),
      width: 130,
      accessor: (document) => document.IsReceived,
      cell: (document) => yesNoPill(t, document.IsReceived),
    },
    {
      id: 'processedDate',
      header: t('Дата'),
      width: 150,
      accessor: (document) => document.ProcessedDate,
      cell: (document) => (
        <span className="supply-order-cell-num">{formatDateTime(document.ProcessedDate)}</span>
      ),
    },
    {
      id: 'comment',
      header: t('Коментар'),
      minWidth: 200,
      accessor: (document) => document.Comment,
      cell: (document) => document.Comment || '',
    },
    {
      id: 'actions',
      header: '',
      width: 200,
      accessor: (document) => document.NetUid,
      cell: (document) => (
        <Group gap={4} wrap="nowrap">
          <FileButton onChange={(file) => uploadDocumentFile(document, file)}>
            {(fileProps) => (
              <ActionIcon
                {...fileProps}
                aria-label={t('Завантажити файл')}
                color="gray"
                disabled={
                  isSaving ||
                  areDeliveryDocumentActionsLocked ||
                  document.Deleted ||
                  Boolean(document.IsProcessed && document.IsReceived)
                }
                title={t('Завантажити файл')}
                variant="light"
              >
                <Upload size={16} />
              </ActionIcon>
            )}
          </FileButton>
          <ActionIcon
            aria-label={t('Зміна статуса документа')}
            color="gray"
            disabled={
              isSaving ||
              areDeliveryDocumentActionsLocked ||
              document.Deleted ||
              Boolean(document.IsProcessed && document.IsReceived)
            }
            title={t('Зміна статуса документа')}
            variant="light"
            onClick={() => openStatusModal(document)}
          >
            <Check size={16} />
          </ActionIcon>
          {(document.FileName || document.DocumentUrl) && (
            <ActionIcon
              aria-label={t('Очистити файл')}
              color="red"
              disabled={isSaving || areDeliveryDocumentActionsLocked}
              title={t('Очистити файл')}
              variant="light"
              onClick={() => clearDocumentFile(document)}
            >
              <Trash2 size={16} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ]

  const creditNotesButton = order && canOpenCreditNotes ? (
    <Button
      leftSection={<ReceiptText size={16} />}
      variant="default"
      onClick={() => dispatchCreditNote({ type: 'setDrawerOpen', open: true })}
    >
      {t('Кредит ноти')}
    </Button>
  ) : null
  const approveButton = order && !order.IsApproved && canApproveOrder ? (
    <Button color={CREATE_ACTION_COLOR} leftSection={<Check size={16} />} loading={isSaving} onClick={approveOrder}>
      {t('Затвердити замовлення')}
    </Button>
  ) : null

  return (
    <AppDrawer
      className="supply-order-sheet"
      closeOnEscape={false}
      footer={creditNotesButton || approveButton ? (
        <>
          {creditNotesButton ?? <span />}
          {approveButton}
        </>
      ) : undefined}
      opened
      position="right"
      size="wide"
      title={
        <span className="supply-order-sheet-title">
          {t('Логістика замовлення')}
          {getOrderNumber(order) && (
            <Badge className="app-role-pill is-yellow" variant="light">
              {getOrderNumber(order)}
            </Badge>
          )}
        </span>
      }
      onClose={() => navigate('/orders/ukraine/all')}
    >
      <Stack gap="lg">
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : order ? (
        <Stack gap="lg">
          <Group gap="xs" wrap="wrap">
            {statusPill(t('Погоджено'), t, order.IsApproved)}
            {statusPill(t('Відправлено'), t, order.IsOrderShipped)}
            {statusPill(t('Прибуло'), t, order.IsOrderArrived)}
            {statusPill(t('Завершено'), t, order.IsCompleted)}
            {statusPill(t('Розміщено'), t, order.IsFullyPlaced)}
          </Group>

          {/* Block 1 — Вибір постачальника */}
          <Card className="supply-detail-card" withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Text className="app-section-title" fw={600} size="sm">
                {t('Вибір постачальника')}
              </Text>
              <div className="supply-order-fields">
                <LeaderField label={t('Постачальник')} value={getEntityName(order.Client)} />
                <LeaderField label={t('Отримувач товару')} value={getEntityName(order.Organization)} />
              </div>
              <Stack gap={4} align="flex-start">
                <Text fw={600} size="sm">{t('Тип доставки')}</Text>
                <SegmentedControl
                  data={TRANSPORTATION_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                  disabled
                  value={transportationType}
                />
              </Stack>
            </Stack>
          </Card>

          {/* Block 2 — Замовлення */}
          <Card className="supply-detail-card" withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Group gap="xs">
                <Text className="app-section-title" fw={600} size="sm">
                  {t('Замовлення')}
                </Text>
                {getOrderNumber(order) && (
                  <Text c="gray.7" className="supply-order-number-meta" size="sm">
                    {getOrderNumber(order)}
                  </Text>
                )}
              </Group>
              <Group align="flex-end" gap="sm" wrap="wrap">
                <NumberInput
                  allowNegative={false}
                  decimalScale={2}
                  disabled={!isEditingAmount || isSaving}
                  label={t('Сума замовлення')}
                  min={0}
                  value={amountValue}
                  onChange={(value) => dispatchAmountEdit({ type: 'setAmountValue', value })}
                />
                <TextInput
                  disabled={!isEditingAmount || isSaving}
                  label={t('Від якої дати')}
                  type="date"
                  value={dateValue ? dateValue.slice(0, 10) : ''}
                  onChange={(event) => dispatchAmountEdit({
                    type: 'setDateValue',
                    value: combineDateTimeInput(event.currentTarget.value, dateValue.slice(11, 16)),
                  })}
                />
                <TextInput
                  disabled={!isEditingAmount || isSaving}
                  label={t('Час')}
                  type="time"
                  value={dateValue.length >= 16 ? dateValue.slice(11, 16) : ''}
                  onChange={(event) => dispatchAmountEdit({
                    type: 'setDateValue',
                    value: combineDateTimeInput(dateValue.slice(0, 10), event.currentTarget.value),
                  })}
                />
                {isEditingAmount ? (
                  <Group gap="xs">
                    <Button disabled={isSaving} variant="default" onClick={cancelAmountEdit}>
                      {t('Скасувати')}
                    </Button>
                    <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={saveAmount}>
                      {t('Оновити')}
                    </Button>
                  </Group>
                ) : canEditAmount ? (
                  <Button
                    color={CREATE_ACTION_COLOR}
                    disabled={isLocked}
                    leftSection={<Pencil size={16} />}
                    variant="outline"
                    onClick={() => dispatchAmountEdit({ type: 'startEditing' })}
                  >
                    {t('Редагувати')}
                  </Button>
                ) : null}
              </Group>
            </Stack>
          </Card>

          <DirectSupplyOrderProFormCard
            canEdit={canEditAmount && !isLocked}
            order={order}
            onError={setError}
            onOrderUpdated={(updatedOrder) => {
              setOrder(updatedOrder)
              dispatchAmountEdit({ type: 'setTransportationType', value: String(updatedOrder.TransportationType ?? 0) })
              syncAmountInputs(updatedOrder)
            }}
            onReload={reloadOrder}
          />

          <DirectOrderPaymentTasksCard canEdit={!isLocked} order={order} onError={setError} />

          {/* Order metrics — kept below the three primary blocks */}
          <Card className="supply-detail-card" withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Text className="app-section-title" fw={600} size="sm">
                {t('Підсумок замовлення')}
              </Text>
              <div className="supply-order-fields">
                <LeaderField label={t('Договір')} value={order.ClientAgreement?.Agreement?.Name || ''} />
                <LeaderField
                  label={t('Валюта')}
                  mono
                  value={order.ClientAgreement?.Agreement?.Currency?.Code || order.ClientAgreement?.Agreement?.Currency?.Name || ''}
                />
                <LeaderField label={t('Відповідальний')} value={getUserName(order.Responsible)} />
                <LeaderField label={t('Кількість')} mono value={formatNumber(order.TotalQuantity)} />
                <LeaderField label={t('Сума нетто')} mono value={formatMoney(order.TotalNetPrice)} />
                <LeaderField label={t('ПДВ')} mono value={formatMoney(order.TotalVat)} />
              </div>
            </Stack>
          </Card>

          <Card className="supply-detail-card" withBorder radius="md" padding="lg">
            <Group gap="xs" wrap="wrap">
              {canOpenInvoices && (
                <Button
                  color={CREATE_ACTION_COLOR}
                  leftSection={<Plus size={16} />}
                  variant="outline"
                  onClick={() => navigate(`/orders/ukraine/all/edit/${order.NetUid}/supply-invoices`)}
                >
                  {t('Добавити новий інвойс')}
                </Button>
              )}
              {canOpenProductIncome && (
                <Button
                  leftSection={<PackagePlus size={16} />}
                  variant="default"
                  onClick={() => navigate(`/orders/ukraine/all/edit/${order.NetUid}/product-income`)}
                >
                  {t('Розміщення приходу')}
                </Button>
              )}
            </Group>
          </Card>

          <Card className="supply-detail-card" withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Text className="app-section-title" fw={600} size="sm">
                {t('Документи доставки')}
              </Text>
              <DataTable
                columns={documentColumns}
                data={order.SupplyOrderDeliveryDocuments || []}
                emptyText={t('Документів доставки немає')}
                getRowId={(document, index) => document.NetUid || String(document.Id || index)}
                layoutVersion="supply-direct-delivery-documents-1"
                minWidth={960}
                tableId="supply-direct-delivery-documents"
              />
            </Stack>
          </Card>
        </Stack>
      ) : (
        <Text c="dimmed">{t('Замовлення не знайдено')}</Text>
      )}
      </Stack>

      <AppDrawer
        className="supply-order-sheet"
        opened={creditNotesOpen}
        size="md"
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Кредит ноти')}</span>}
        onClose={() => dispatchCreditNote({ type: 'setDrawerOpen', open: false })}
      >
        <Stack gap="md">
          <Group justify="flex-end">
            <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={openCreditNoteModal}>
              {t('Створити')}
            </Button>
          </Group>
          {(order?.CreditNoteDocuments || []).length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Кредит нот немає')}
            </Text>
          ) : (
            <Stack gap="xs">
              {(order?.CreditNoteDocuments || []).map((creditNote, index) => (
                <Box
                  className="supply-order-credit-note"
                  key={creditNote.NetUid || creditNote.Id || `${creditNote.Number || 'credit-note'}-${index}`}
                >
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Text className="supply-order-credit-note-number" size="sm">
                      {creditNote.Number || ''}
                    </Text>
                    <Text c="dimmed" className="supply-order-credit-note-date" size="xs">
                      {formatDateTime(creditNote.FromDate)}
                    </Text>
                  </Group>
                  <Text size="sm">
                    {t('Сума')}: <span className="app-money">{formatMoney(creditNote.Amount)}</span>
                  </Text>
                  {creditNote.Comment && (
                    <Text c="dimmed" size="sm" style={{ overflowWrap: 'anywhere' }}>
                      {creditNote.Comment}
                    </Text>
                  )}
                  {creditNote.DocumentUrl && (
                    <a className="document-link" href={upgradeHttpToHttps(creditNote.DocumentUrl)} rel="noreferrer" target="_blank">
                      {creditNote.FileName || t('Документ')}
                    </a>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </AppDrawer>

      <AppModal
        className="supply-order-sheet"
        opened={creditNoteModalOpen}
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Кредит нота')}</span>}
        onClose={closeCreditNoteModal}
      >
        <Stack gap="md">
          <TextInput
            label={t('Номер')}
            value={creditNoteNumber}
            onChange={(event) => dispatchCreditNote({ type: 'setNumber', value: event.currentTarget.value })}
          />
          <NumberInput
            decimalScale={2}
            label={t('Сума')}
            min={0}
            value={creditNoteAmount}
            onChange={(value) => dispatchCreditNote({ type: 'setAmount', value })}
          />
          <TextInput
            label={t('Дата')}
            type="date"
            value={creditNoteDate}
            onChange={(event) => dispatchCreditNote({ type: 'setDate', value: event.currentTarget.value })}
          />
          <Textarea
            autosize
            label={t('Коментар')}
            minRows={3}
            value={creditNoteComment}
            onChange={(event) => dispatchCreditNote({ type: 'setComment', value: event.currentTarget.value })}
          />
          <Group gap="xs">
            <FileButton onChange={(file) => dispatchCreditNote({ type: 'setFile', value: file })}>
              {(fileProps) => (
                <Button {...fileProps} leftSection={<Upload size={16} />} variant="default">
                  {t('Завантажити файл')}
                </Button>
              )}
            </FileButton>
            {creditNoteFile && (
              <Group gap={4} wrap="nowrap">
                <Text size="sm">{creditNoteFile.name}</Text>
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  size="sm"
                  title={t('Видалити')}
                  variant="subtle"
                  onClick={() => dispatchCreditNote({ type: 'setFile', value: null })}
                >
                  <Trash2 size={16} />
                </ActionIcon>
              </Group>
            )}
          </Group>
          <Group justify="flex-end" gap="xs">
            <Button disabled={isSaving} variant="default" onClick={closeCreditNoteModal}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={() => void saveCreditNote()}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal
        className="supply-order-sheet"
        opened={Boolean(statusDocument)}
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Зміна статуса документа')}</span>}
        onClose={closeStatusModal}
      >
        <Stack gap="md">
          <Text fw={600} size="sm">
            {statusDocument?.Name || statusDocument?.FileName || t('Документ')}
          </Text>
          <Checkbox
            checked={statusReceived}
            label={t('Отримано')}
            onChange={(event) => dispatchStatusModal({ type: 'setReceived', value: event.currentTarget.checked })}
          />
          <Textarea
            autosize
            label={t('Коментар')}
            minRows={3}
            value={statusComment}
            onChange={(event) => dispatchStatusModal({ type: 'setComment', value: event.currentTarget.value })}
          />
          <Group justify="flex-end" gap="xs">
            <Button disabled={isSaving} variant="default" onClick={closeStatusModal}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={saveDocumentStatus}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </AppDrawer>
  )
}

/* §7.2 leader row: label ——— value; mono values for numbers/codes/sums. */
function LeaderField({ label, mono, value }: { label: string, mono?: boolean, value: string }) {
  return (
    <span className="supply-order-field">
      <span className="supply-order-field-label">{label}</span>
      <span className={`supply-order-field-value${mono ? ' is-mono' : ''}`}>{value}</span>
    </span>
  )
}

function isSameDocument(a: SupplyOrderDeliveryDocument, b: SupplyOrderDeliveryDocument): boolean {
  if (a.NetUid && b.NetUid) {
    return a.NetUid === b.NetUid
  }

  if (typeof a.Id === 'number' && typeof b.Id === 'number') {
    return a.Id === b.Id
  }

  return a === b
}

function toDateTimeInput(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? '' : formatLocalDateTime(date).slice(0, 16)
}

/** Recombine the split «Від якої дати» (date) + «Час» (time) inputs into one datetime-local value. */
function combineDateTimeInput(datePart: string, timePart: string): string {
  if (!datePart) {
    return ''
  }

  return `${datePart}T${timePart || '00:00'}`
}

/* §4 pills: green — success/active, gray — neutral/negative status. */
function statusPill(label: string, t: (key: string) => string, value?: boolean) {
  return (
    <Badge className={`app-role-pill ${value ? 'is-green' : 'is-gray'}`} variant="light">
      {label}: {t(value ? 'так' : 'ні')}
    </Badge>
  )
}

function yesNoPill(t: (key: string) => string, value?: boolean) {
  return (
    <Badge className={`app-role-pill ${value ? 'is-green' : 'is-gray'}`} variant="light">
      {t(value ? 'Так' : 'Ні')}
    </Badge>
  )
}

function getOrderNumber(order: DirectSupplyOrder | null): string {
  return order?.SupplyOrderNumber?.Number ? `№ ${order.SupplyOrderNumber.Number}` : ''
}

/* Empty values render blank (§5/§7.2) — never a dash. */
function getEntityName(entity?: { FullName?: string, Name?: string } | null): string {
  return entity?.FullName || entity?.Name || ''
}

function getUserName(user?: { FirstName?: string, FullName?: string, LastName?: string, MiddleName?: string, Name?: string } | null): string {
  return user?.FullName || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ') || user?.Name || ''
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : ''
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''
}
