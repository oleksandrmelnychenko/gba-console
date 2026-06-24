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
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconFileInvoice,
  IconListDetails,
  IconPackageImport,
  IconPencil,
  IconRefresh,
  IconRoute,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
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
import { DirectSupplyOrderProFormCard } from '../components/DirectSupplyOrderProFormCard'
import type {
  CreditNoteDocument,
  DirectSupplyOrder,
  SupplyOrderDeliveryDocument,
  SupplyTransportationTypeValue,
} from '../types'

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
const PERMISSION_OPEN_DIRECT_SPECIFICATIONS = 'UkraineAllOrders_SelectAnOption_ProductSpecificationCodes_PKEY'
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
  const canOpenInvoices = hasPermission(PERMISSION_OPEN_DIRECT_INVOICES) && Boolean(order?.SupplyProFormId)
  const canOpenProductIncome = hasPermission(PERMISSION_OPEN_DIRECT_PRODUCT_INCOME) && hasInvoices
  const canOpenSpecifications = hasPermission(PERMISSION_OPEN_DIRECT_SPECIFICATIONS) && Boolean(order?.SupplyProFormId)

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

  function saveTransportationType() {
    savePatch({
      TransportationType: Number(transportationType) as SupplyTransportationTypeValue,
    }, t('Тип доставки збережено'))
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
        : document.Name || document.FileName || '-',
    },
    {
      id: 'fileName',
      header: t('Файл'),
      minWidth: 220,
      accessor: (document) => document.FileName,
      cell: (document) => document.FileName || '-',
    },
    {
      id: 'processed',
      header: t('Опрацьовано'),
      width: 130,
      accessor: (document) => document.IsProcessed,
      cell: (document) => statusBadge(t('Так'), document.IsProcessed),
    },
    {
      id: 'received',
      header: t('Отримано'),
      width: 130,
      accessor: (document) => document.IsReceived,
      cell: (document) => statusBadge(t('Так'), document.IsReceived),
    },
    {
      id: 'processedDate',
      header: t('Дата'),
      width: 150,
      accessor: (document) => document.ProcessedDate,
      cell: (document) => formatDateTime(document.ProcessedDate),
    },
    {
      id: 'comment',
      header: t('Коментар'),
      minWidth: 200,
      accessor: (document) => document.Comment,
      cell: (document) => document.Comment || '-',
    },
    {
      id: 'actions',
      header: t('Дії'),
      width: 200,
      accessor: (document) => document.NetUid,
      cell: (document) => (
        <Group gap={4} wrap="nowrap">
          <FileButton onChange={(file) => uploadDocumentFile(document, file)}>
            {(fileProps) => (
              <Tooltip label={t('Завантажити файл')}>
                <ActionIcon
                  {...fileProps}
                  aria-label={t('Завантажити файл')}
                  color="violet"
                  disabled={
                    isSaving ||
                    areDeliveryDocumentActionsLocked ||
                    document.Deleted ||
                    Boolean(document.IsProcessed && document.IsReceived)
                  }
                  variant="light"
                >
                  <IconUpload size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </FileButton>
          <Tooltip label={t('Зміна статуса документа')}>
            <ActionIcon
              aria-label={t('Зміна статуса документа')}
              color="teal"
              disabled={
                isSaving ||
                areDeliveryDocumentActionsLocked ||
                document.Deleted ||
                Boolean(document.IsProcessed && document.IsReceived)
              }
              variant="light"
              onClick={() => openStatusModal(document)}
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
          {(document.FileName || document.DocumentUrl) && (
            <Tooltip label={t('Очистити файл')}>
              <ActionIcon
                aria-label={t('Очистити файл')}
                color="red"
                disabled={isSaving || areDeliveryDocumentActionsLocked}
                variant="light"
                onClick={() => clearDocumentFile(document)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ]

  return (
    <Stack gap="lg">
      <header className="supply-detail-header">
        <div className="supply-detail-header-main">
          <Tooltip label={t('Назад')}>
            <ActionIcon
              aria-label={t('Назад')}
              className="supply-detail-back"
              variant="default"
              onClick={() => navigate('/orders/ukraine/all')}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <span className="supply-detail-icon">
            <IconRoute size={22} stroke={1.8} />
          </span>
          <div className="supply-detail-copy">
            <h1 className="supply-detail-title">
              {t('Логістика замовлення')}
              {getOrderNumber(order) && <span className="supply-detail-number">{getOrderNumber(order)}</span>}
            </h1>
            <p className="supply-detail-subtitle">
              {t('Постачальник')}: <strong>{getEntityName(order?.Client)}</strong>
            </p>
          </div>
        </div>
        <div className="supply-detail-header-actions">
          <Button leftSection={<IconRefresh size={16} />} loading={isLoading} variant="light" onClick={reloadOrder}>
            {t('Оновити')}
          </Button>
          {order && !order.IsApproved && canApproveOrder && (
            <Button color={CREATE_ACTION_COLOR} leftSection={<IconCheck size={16} />} loading={isSaving} onClick={approveOrder}>
              {t('Погодити')}
            </Button>
          )}
          {order && canOpenCreditNotes && (
            <Button leftSection={<IconFileInvoice size={16} />} variant="light" onClick={() => dispatchCreditNote({ type: 'setDrawerOpen', open: true })}>
              {t('Кредит ноти')}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : order ? (
        <Stack gap="lg">
          <Card className="supply-detail-card" withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Group gap="xs" wrap="wrap">
                {statusBadge(t('Погоджено'), order.IsApproved)}
                {statusBadge(t('Відправлено'), order.IsOrderShipped)}
                {statusBadge(t('Прибуло'), order.IsOrderArrived)}
                {statusBadge(t('Завершено'), order.IsCompleted)}
                {statusBadge(t('Розміщено'), order.IsFullyPlaced)}
              </Group>

              <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
                <InfoBlock label={t('Дата')} value={formatDateTime(order.DateFrom)} />
                <InfoBlock label={t('Організація')} value={getEntityName(order.Organization)} />
                <InfoBlock label={t('Договір')} value={order.ClientAgreement?.Agreement?.Name || '-'} />
                <InfoBlock
                  label={t('Валюта')}
                  value={order.ClientAgreement?.Agreement?.Currency?.Code || order.ClientAgreement?.Agreement?.Currency?.Name || '-'}
                />
                <InfoBlock label={t('Кількість')} value={formatNumber(order.TotalQuantity)} />
                <InfoBlock label={t('Сума нетто')} value={formatMoney(order.TotalNetPrice)} />
                <InfoBlock label={t('ПДВ')} value={formatMoney(order.TotalVat)} />
                <InfoBlock label={t('Відповідальний')} value={getUserName(order.Responsible)} />
              </SimpleGrid>

              <Group align="flex-end" gap="sm" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={600} size="sm">{t('Тип доставки')}</Text>
                  <SegmentedControl
                    data={TRANSPORTATION_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
                    disabled={!isEditingAmount || isSaving || Boolean(order.IsOrderShipped)}
                    value={transportationType}
                    onChange={(value) => dispatchAmountEdit({ type: 'setTransportationType', value })}
                  />
                </Stack>
                <Button
                  disabled={
                    !isEditingAmount ||
                    transportationType === String(order.TransportationType ?? 0) ||
                    Boolean(order.IsOrderShipped)
                  }
                  color={CREATE_ACTION_COLOR}
                  loading={isSaving}
                  onClick={saveTransportationType}
                >
                  {t('Зберегти')}
                </Button>
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
                  type="datetime-local"
                  value={dateValue}
                  onChange={(event) => dispatchAmountEdit({ type: 'setDateValue', value: event.currentTarget.value })}
                />
                {isEditingAmount ? (
                  <Group gap="xs">
                    <Button color="gray" disabled={isSaving} variant="light" onClick={cancelAmountEdit}>
                      {t('Скасувати')}
                    </Button>
                    <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={saveAmount}>
                      {t('Оновити')}
                    </Button>
                  </Group>
                ) : canEditAmount ? (
                  <Button
                    disabled={isLocked}
                    leftSection={<IconPencil size={16} />}
                    variant="light"
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

          <Card className="supply-detail-card" withBorder radius="md" padding="lg">
            <Group gap="xs" wrap="wrap">
              {canOpenInvoices && (
                <Button
                  leftSection={<IconFileInvoice size={16} />}
                  variant="light"
                  onClick={() => navigate(`/orders/ukraine/all/edit/${order.NetUid}/supply-invoices`)}
                >
                  {t('Інвойси і пак листи')}
                </Button>
              )}
              {canOpenSpecifications && (
                <Button
                  leftSection={<IconListDetails size={16} />}
                  variant="light"
                  onClick={() => navigate(`/orders/ukraine/all/edit/${order.NetUid}/specifications`)}
                >
                  {t('Специфікації')}
                </Button>
              )}
              {canOpenProductIncome && (
                <Button
                  leftSection={<IconPackageImport size={16} />}
                  variant="light"
                  onClick={() => navigate(`/orders/ukraine/all/edit/${order.NetUid}/product-income`)}
                >
                  {t('Розміщення приходу')}
                </Button>
              )}
            </Group>
          </Card>

          <Card className="supply-detail-card" withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Group gap="xs">
                <IconRoute size={18} />
                <Text fw={600}>{t('Документи доставки')}</Text>
              </Group>
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

      <AppDrawer opened={creditNotesOpen} size="md" title={t('Кредит ноти')} onClose={() => dispatchCreditNote({ type: 'setDrawerOpen', open: false })}>
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
                  key={creditNote.NetUid || creditNote.Id || `${creditNote.Number || 'credit-note'}-${index}`}
                  style={{
                    border: '1px solid var(--mantine-color-gray-2)',
                    borderRadius: 6,
                    padding: '8px 10px',
                  }}
                >
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Text fw={600} size="sm">
                      {creditNote.Number || '-'}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {formatDateTime(creditNote.FromDate)}
                    </Text>
                  </Group>
                  <Text size="sm">
                    {t('Сума')}: {formatMoney(creditNote.Amount)}
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

      <AppModal opened={creditNoteModalOpen} title={t('Кредит нота')} onClose={closeCreditNoteModal}>
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
                <Button {...fileProps} leftSection={<IconUpload size={16} />} variant="light">
                  {t('Завантажити файл')}
                </Button>
              )}
            </FileButton>
            {creditNoteFile && (
              <Group gap={4} wrap="nowrap">
                <Text size="sm">{creditNoteFile.name}</Text>
                <Tooltip label={t('Видалити')}>
                  <ActionIcon
                    aria-label={t('Видалити')}
                    color="red"
                    size="sm"
                    variant="subtle"
                    onClick={() => dispatchCreditNote({ type: 'setFile', value: null })}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>
          <Group justify="flex-end" gap="xs">
            <Button color="gray" disabled={isSaving} variant="light" onClick={closeCreditNoteModal}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={() => void saveCreditNote()}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal
        opened={Boolean(statusDocument)}
        title={t('Зміна статуса документа')}
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
            <Button color="gray" disabled={isSaving} variant="light" onClick={closeStatusModal}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={saveDocumentStatus}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function InfoBlock({ label, value }: { label: string, value: string }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="xs">{label}</Text>
      <Text fw={600} size="sm">{value}</Text>
    </Stack>
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

function statusBadge(label: string, value?: boolean) {
  return (
    <Badge color={value ? 'green' : 'gray'} variant="light">
      {label}: {value ? 'так' : 'ні'}
    </Badge>
  )
}

function getOrderNumber(order: DirectSupplyOrder | null): string {
  return order?.SupplyOrderNumber?.Number ? `№ ${order.SupplyOrderNumber.Number}` : ''
}

function getEntityName(entity?: { FullName?: string, Name?: string } | null): string {
  return entity?.FullName || entity?.Name || '-'
}

function getUserName(user?: { FirstName?: string, FullName?: string, LastName?: string, MiddleName?: string, Name?: string } | null): string {
  return user?.FullName || [user?.LastName, user?.FirstName, user?.MiddleName].filter(Boolean).join(' ') || user?.Name || '-'
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateTimeFormatter.format(date)
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}
