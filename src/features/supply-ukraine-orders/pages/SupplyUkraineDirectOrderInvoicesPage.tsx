import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowBackUp,
  IconArrowLeft,
  IconDeviceFloppy,
  IconEdit,
  IconFileImport,
  IconFileUpload,
  IconPackage,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useMemo, useReducer, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import {
  deletePackingList,
  deleteSupplyInvoice,
  deleteSupplyInvoiceDocument,
  getDirectSupplyOrderById,
  getSupplyInformationDeliveryProtocolKeys,
  getSupplyInvoiceItems,
  getSupplyOrderInvoiceTotals,
  getSupplyOrderItems,
  getSupplyPaymentDeliveryProtocolKeys,
  getSupplyProtocolResponsibleUsers,
  updatePackingLists,
  updateSupplyInvoice,
  updateSupplyInvoiceItems,
  uploadPackingListDocuments,
  uploadPackingListFile,
  uploadSupplyInvoiceDocuments,
  uploadSupplyInvoiceFile,
} from '../api/supplyUkraineOrdersApi'
import type {
  DirectSupplyOrder,
  EntityFields,
  PackingList,
  Product,
  PackingListDocumentParseConfiguration,
  PackingListPackageOrderItem,
  SupplyInformationDeliveryProtocol,
  SupplyInformationDeliveryProtocolKey,
  SupplyInvoice,
  SupplyInvoiceDeliveryDocument,
  SupplyInvoiceOrderItem,
  SupplyOrderPaymentDeliveryProtocol,
  SupplyOrderPaymentDeliveryProtocolKey,
  SupplyOrderDocumentParseConfiguration,
  SupplyOrderInvoiceTotals,
  SupplyOrderItem,
  User,
} from '../types'

type NumberFieldValue = number | ''
type InvoiceUploadForm = {
  comment: string
  dateFrom: string
  file: File | null
  number: string
  productIsImported: boolean
  withTotalAmount: boolean
  endRow: NumberFieldValue
  qtyColumnNumber: NumberFieldValue
  startRow: NumberFieldValue
  totalAmountColumnNumber: NumberFieldValue
  unitPriceColumnNumber: NumberFieldValue
  vendorCodeColumnNumber: NumberFieldValue
}
type PackListUploadForm = {
  comment: string
  dateFrom: string
  file: File | null
  number: string
  isWeightPerUnit: boolean
  endRow: NumberFieldValue
  grossWeightColumnNumber: NumberFieldValue
  netWeightColumnNumber: NumberFieldValue
  qtyColumnNumber: NumberFieldValue
  startRow: NumberFieldValue
  unitPriceColumnNumber: NumberFieldValue
  vendorCodeColumnNumber: NumberFieldValue
}
type QuantityBalanceRow = {
  actualQty: number
  difference: number
  expectedQty: number
  isError: boolean
  key: string
}
type InvoiceBalanceRow = QuantityBalanceRow & {
  orderItem: SupplyOrderItem
}
type PackListBalanceRow = QuantityBalanceRow & {
  invoiceItem: SupplyInvoiceOrderItem
}
type PackListEditorState = {
  packList: PackingList | null
}
type InvoiceEditorState = {
  invoice: SupplyInvoice
}
type SelectOption = {
  label: string
  value: string
}
type PaymentProtocolDraft = {
  amount: NumberFieldValue
  comment: string
  discount: NumberFieldValue
  isAccounting: boolean
  keyId: string | null
  keyText: string
  payToDate: string
  userId: string | null
}
type InformationProtocolDraft = {
  keyId: string | null
  keyText: string
  userId: string | null
  value: NumberFieldValue
}
type InvoiceMetadataForm = {
  dateFrom: string
  deliveryAmount: NumberFieldValue
  discountAmount: NumberFieldValue
  documents: SupplyInvoiceDeliveryDocument[]
  files: File[]
  number: string
}
type PackListMetadataForm = {
  comment: string
  dateFrom: string
  documents: SupplyInvoiceDeliveryDocument[]
  files: File[]
  invNo: string
  markNumber: string
  no: string
  plNo: string
  refNo: string
}
type PageState = {
  deleteInvoiceCandidate: SupplyInvoice | null
  deletePackListCandidate: PackingList | null
  error: string | null
  invoiceDetailsByNetId: Record<string, SupplyInvoice>
  invoiceEditor: InvoiceEditorState | null
  invoiceUploadOpen: boolean
  informationProtocolKeys: SupplyInformationDeliveryProtocolKey[]
  isInvoiceLoading: boolean
  isLoading: boolean
  isProtocolDictionariesLoading: boolean
  isSaving: boolean
  order: DirectSupplyOrder | null
  orderItems: SupplyOrderItem[]
  packListEditor: PackListEditorState | null
  packListUploadOpen: boolean
  paymentProtocolKeys: SupplyOrderPaymentDeliveryProtocolKey[]
  responsibleUsers: User[]
  selectedInvoiceNetId: string | null
  selectedPackListNetId: string | null
  totals: SupplyOrderInvoiceTotals
}
type PageStateAction = Partial<PageState> | ((state: PageState) => Partial<PageState>)

const INITIAL_PAGE_STATE: PageState = {
  deleteInvoiceCandidate: null,
  deletePackListCandidate: null,
  error: null,
  invoiceDetailsByNetId: {},
  invoiceEditor: null,
  invoiceUploadOpen: false,
  informationProtocolKeys: [],
  isInvoiceLoading: false,
  isLoading: true,
  isProtocolDictionariesLoading: false,
  isSaving: false,
  order: null,
  orderItems: [],
  packListEditor: null,
  packListUploadOpen: false,
  paymentProtocolKeys: [],
  responsibleUsers: [],
  selectedInvoiceNetId: null,
  selectedPackListNetId: null,
  totals: {},
}

const EMPTY_INVOICE_FORM: InvoiceUploadForm = {
  comment: '',
  dateFrom: formatDateTimeInput(new Date()),
  endRow: '',
  file: null,
  number: '',
  productIsImported: true,
  qtyColumnNumber: '',
  startRow: '',
  totalAmountColumnNumber: '',
  unitPriceColumnNumber: '',
  vendorCodeColumnNumber: '',
  withTotalAmount: false,
}

const EMPTY_PACK_LIST_FORM: PackListUploadForm = {
  comment: '',
  dateFrom: formatDateTimeInput(new Date()),
  endRow: '',
  file: null,
  grossWeightColumnNumber: '',
  isWeightPerUnit: true,
  netWeightColumnNumber: '',
  number: '',
  qtyColumnNumber: '',
  startRow: '',
  unitPriceColumnNumber: '',
  vendorCodeColumnNumber: '',
}
const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const numberFormatter = new Intl.NumberFormat('uk-UA')
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const PERMISSION_ADD_INVOICE = 'SUPPLY_INVOICES_ordersUkraineAllEdit_NewInvoiceBtn_PKEY'
const PERMISSION_EDIT_INVOICE = 'LOGISTIC_WAY_ordersUkraineAllEdit_EditInvoice_PKEY'
const PERMISSION_ADD_PACK_LIST = 'SUPPLY_INVOICES_ordersUkraineAllEdit_NewPackListBtn_PKEY'
const PERMISSION_REMOVE_INVOICE = 'SUPPLY_INVOICES_ordersUkraineAllEdit_RemoveInvoiceBtn_PKEY'
const PERMISSION_REMOVE_PACK_LIST = 'SUPPLY_INVOICES_ordersUkraineAllEdit_RemovePackListBtn_PKEY'

function pageStateReducer(state: PageState, action: PageStateAction): PageState {
  const patch = typeof action === 'function' ? action(state) : action

  return { ...state, ...patch }
}

export function SupplyUkraineDirectOrderInvoicesPage() {
  const model = useSupplyUkraineDirectOrderInvoicesPageModel()

  return <SupplyUkraineDirectOrderInvoicesView model={model} />
}

function useSupplyUkraineDirectOrderInvoicesPageModel() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const [state, setPageState] = useReducer(pageStateReducer, INITIAL_PAGE_STATE)
  const {
    deleteInvoiceCandidate,
    deletePackListCandidate,
    error,
    invoiceDetailsByNetId,
    invoiceEditor,
    invoiceUploadOpen,
    informationProtocolKeys,
    isInvoiceLoading,
    isLoading,
    isProtocolDictionariesLoading,
    isSaving,
    order,
    orderItems,
    packListEditor,
    packListUploadOpen,
    paymentProtocolKeys,
    responsibleUsers,
    selectedInvoiceNetId,
    selectedPackListNetId,
    totals,
  } = state

  const invoices = useMemo(() => order?.SupplyInvoices || [], [order?.SupplyInvoices])
  const selectedInvoice = useMemo(
    () => getSelectedInvoice(selectedInvoiceNetId, invoiceDetailsByNetId, invoices),
    [invoiceDetailsByNetId, invoices, selectedInvoiceNetId],
  )
  const selectedPackList = useMemo(
    () => (selectedInvoice?.PackingLists || []).find((packList) => packList.NetUid === selectedPackListNetId) || null,
    [selectedInvoice, selectedPackListNetId],
  )
  const canAddInvoice = hasPermission(PERMISSION_ADD_INVOICE)
  const canEditInvoice = hasPermission(PERMISSION_EDIT_INVOICE)
  const canAddPackList = hasPermission(PERMISSION_ADD_PACK_LIST)
  const canRemoveInvoice = hasPermission(PERMISSION_REMOVE_INVOICE)
  const canRemovePackList = hasPermission(PERMISSION_REMOVE_PACK_LIST)
  const canShowPackListUpload = Boolean(selectedInvoice && canAddPackList)
  const isBusy = isSaving || isLoading || isInvoiceLoading

  const detailedInvoices = useMemo(
    () => invoices.map((invoice) => (invoice.NetUid ? invoiceDetailsByNetId[invoice.NetUid] || invoice : invoice)),
    [invoiceDetailsByNetId, invoices],
  )
  const invoiceBalanceRows = useMemo(
    () => buildInvoiceBalanceRows(orderItems, detailedInvoices),
    [detailedInvoices, orderItems],
  )
  const invoiceBalanceByOrderItemKey = useMemo(
    () => new Map(invoiceBalanceRows.map((row) => [row.key, row])),
    [invoiceBalanceRows],
  )
  const orderRows = useMemo(
    () => orderItems.map((item) => {
      const balance = invoiceBalanceByOrderItemKey.get(getSupplyOrderItemKey(item))

      return {
        ...item,
        IsError: balance?.isError || false,
        QtyDifference: balance?.difference || 0,
      }
    }),
    [invoiceBalanceByOrderItemKey, orderItems],
  )
  const selectedInvoiceItems = useMemo(
    () => buildEditableInvoiceItems(selectedInvoice, orderItems),
    [orderItems, selectedInvoice],
  )
  const packListBalanceRows = useMemo(
    () => (selectedInvoice ? buildPackListBalanceRows(selectedInvoice) : []),
    [selectedInvoice],
  )
  const packListBalanceByInvoiceItemKey = useMemo(
    () => new Map(packListBalanceRows.map((row) => [row.key, row])),
    [packListBalanceRows],
  )
  const selectedPackListItems = useMemo(
    () => buildEditablePackListItems(selectedPackList, selectedInvoice),
    [selectedInvoice, selectedPackList],
  )
  const hasInvoiceMismatch = invoiceBalanceRows.some((row) => row.isError)
  const hasPackListMismatch = packListBalanceRows.some((row) => row.isError)

  const orderItemColumns = useOrderItemColumns(setProductCardNetId)
  const invoiceItemColumns = useInvoiceItemColumns({
    balanceByOrderItemKey: invoiceBalanceByOrderItemKey,
    disabled: isBusy || !selectedInvoice || !canEditInvoice,
    onOpenProductCard: setProductCardNetId,
    onQtyChange: handleInvoiceQtyChange,
  })
  const packListItemColumns = usePackListItemColumns({
    balanceByInvoiceItemKey: packListBalanceByInvoiceItemKey,
    disabled: isBusy || !selectedPackList || !canAddPackList,
    onOpenProductCard: setProductCardNetId,
    onQtyChange: handlePackListQtyChange,
  })
  const orderTotalsToolbar = useMemo(() => <TotalsBadges totals={totals} />, [totals])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      if (!id) {
        setPageState({ error: t('Не задано ідентифікатор замовлення'), isLoading: false })
        return
      }

      setPageState({ error: null, isLoading: true })

      try {
        const [nextOrder, nextItems, nextTotals] = await Promise.all([
          getDirectSupplyOrderById(id),
          getSupplyOrderItems(id),
          getSupplyOrderInvoiceTotals(id),
        ])
        const invoiceDetails = await loadInvoiceDetails(nextOrder)

        if (!cancelled) {
          setPageState((current) => {
            const selectedInvoiceNetId = current.selectedInvoiceNetId || nextOrder?.SupplyInvoices?.[0]?.NetUid || null
            const invoice = getSelectedInvoice(selectedInvoiceNetId, invoiceDetails, nextOrder?.SupplyInvoices || [])

            return {
              invoiceDetailsByNetId: invoiceDetails,
              order: nextOrder,
              orderItems: nextItems,
              selectedInvoiceNetId,
              selectedPackListNetId: getValidPackListNetId(current.selectedPackListNetId, invoice),
              totals: nextTotals,
            }
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setPageState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'),
            order: null,
          })
        }
      } finally {
        if (!cancelled) {
          setPageState({ isLoading: false })
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [id, t])

  useEffect(() => {
    let cancelled = false

    async function loadProtocolDictionaries() {
      setPageState({ isProtocolDictionariesLoading: true })

      try {
        const [nextPaymentKeys, nextInformationKeys, nextUsers] = await Promise.all([
          getSupplyPaymentDeliveryProtocolKeys(),
          getSupplyInformationDeliveryProtocolKeys(),
          getSupplyProtocolResponsibleUsers(),
        ])

        if (!cancelled) {
          setPageState({
            informationProtocolKeys: nextInformationKeys,
            paymentProtocolKeys: nextPaymentKeys,
            responsibleUsers: nextUsers,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          notifications.show({
            color: 'red',
            message: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники протоколів'),
          })
        }
      } finally {
        if (!cancelled) {
          setPageState({ isProtocolDictionariesLoading: false })
        }
      }
    }

    void loadProtocolDictionaries()

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!selectedInvoiceNetId || invoiceDetailsByNetId[selectedInvoiceNetId]) {
      return
    }

    let cancelled = false

    async function loadInvoice(invoiceNetId: string) {
      setPageState({ isInvoiceLoading: true })

      try {
        const invoice = await getSupplyInvoiceItems(invoiceNetId)

        if (!cancelled) {
          setPageState((current) => ({
            invoiceDetailsByNetId: invoice?.NetUid
              ? { ...current.invoiceDetailsByNetId, [invoice.NetUid]: invoice }
              : current.invoiceDetailsByNetId,
            selectedPackListNetId: getValidPackListNetId(current.selectedPackListNetId, invoice),
          }))
        }
      } catch (loadError) {
        if (!cancelled) {
          notifications.show({
            color: 'red',
            message: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити інвойс'),
          })
        }
      } finally {
        if (!cancelled) {
          setPageState({ isInvoiceLoading: false })
        }
      }
    }

    void loadInvoice(selectedInvoiceNetId)

    return () => {
      cancelled = true
    }
  }, [invoiceDetailsByNetId, selectedInvoiceNetId, t])

  async function reloadOrder(nextSelectedInvoiceNetId = selectedInvoiceNetId) {
    if (!id) {
      return
    }

    setPageState({ error: null, isLoading: true })

    try {
      const [nextOrder, nextItems, nextTotals] = await Promise.all([
        getDirectSupplyOrderById(id),
        getSupplyOrderItems(id),
        getSupplyOrderInvoiceTotals(id),
      ])
      const invoiceDetails = await loadInvoiceDetails(nextOrder)

      const invoiceNetId = nextSelectedInvoiceNetId && nextOrder?.SupplyInvoices?.some((invoice) => invoice.NetUid === nextSelectedInvoiceNetId)
        ? nextSelectedInvoiceNetId
        : nextOrder?.SupplyInvoices?.[0]?.NetUid || null
      const invoice = invoiceNetId ? invoiceDetails[invoiceNetId] || null : null

      setPageState((current) => ({
        invoiceDetailsByNetId: invoiceDetails,
        order: nextOrder,
        orderItems: nextItems,
        selectedInvoiceNetId: invoiceNetId,
        selectedPackListNetId: getValidPackListNetId(current.selectedPackListNetId, invoice),
        totals: nextTotals,
      }))
    } catch (loadError) {
      setPageState({ error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення') })
    } finally {
      setPageState({ isLoading: false })
    }
  }

  async function submitInvoice(form: InvoiceUploadForm) {
    if (!canAddInvoice) {
      notifications.show({ color: 'red', message: t('Недостатньо прав для цієї дії') })
      return
    }

    if (!id) {
      return
    }

    const validationMessage = getInvoiceUploadValidationMessage(form)

    if (validationMessage) {
      notifications.show({ color: 'red', message: t(validationMessage) })
      return
    }

    const parseConfiguration = toInvoiceParseConfiguration(form)

    if (!parseConfiguration) {
      notifications.show({ color: 'red', message: t('Перевірте колонки імпорту') })
      return
    }

    const file = form.file

    if (!file) {
      return
    }

    setPageState({ isSaving: true })

    try {
      const invoice = await uploadSupplyInvoiceFile({
        file,
        invoice: {
          Comment: form.comment.trim(),
          DateFrom: normalizeDateTimeInput(form.dateFrom),
          Number: form.number.trim(),
        },
        parseConfiguration,
        supplyOrderNetId: id,
      })

      notifications.show({ color: 'green', message: t('Інвойс завантажено') })
      setPageState({ invoiceUploadOpen: false })
      await reloadOrder(invoice?.NetUid || selectedInvoiceNetId)
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  async function submitPackList(form: PackListUploadForm) {
    if (!canAddPackList) {
      notifications.show({ color: 'red', message: t('Недостатньо прав для цієї дії') })
      return
    }

    if (!selectedInvoice?.NetUid) {
      notifications.show({ color: 'red', message: t('Оберіть інвойс') })
      return
    }

    const validationMessage = getPackListUploadValidationMessage(form)

    if (validationMessage) {
      notifications.show({ color: 'red', message: t(validationMessage) })
      return
    }

    const parseConfiguration = toPackListParseConfiguration(form)

    if (!parseConfiguration) {
      notifications.show({ color: 'red', message: t('Перевірте колонки імпорту') })
      return
    }

    const file = form.file

    if (!file) {
      return
    }

    setPageState({ isSaving: true })

    try {
      const packList = await uploadPackingListFile({
        file,
        packingList: {
          Comment: form.comment.trim(),
          FromDate: normalizeDateTimeInput(form.dateFrom),
          InvNo: form.number.trim(),
          No: form.number.trim(),
        },
        parseConfiguration,
        supplyInvoiceNetId: selectedInvoice.NetUid,
      })

      notifications.show({ color: 'green', message: t('Пак лист завантажено') })
      setPageState({ packListUploadOpen: false })
      await reloadOrder(selectedInvoice.NetUid)
      if (packList?.NetUid) {
        setPageState({ selectedPackListNetId: packList.NetUid })
      }
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  async function confirmDeleteInvoice() {
    if (!deleteInvoiceCandidate?.NetUid) {
      setPageState({ deleteInvoiceCandidate: null })
      return
    }

    setPageState({ isSaving: true })

    try {
      await deleteSupplyInvoice(deleteInvoiceCandidate.NetUid)
      notifications.show({ color: 'green', message: t('Інвойс видалено') })
      setPageState({
        deleteInvoiceCandidate: null,
        selectedInvoiceNetId: null,
        selectedPackListNetId: null,
      })
      await reloadOrder(null)
    } catch (deleteError) {
      notifications.show({ color: 'red', message: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити інвойс') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  async function confirmDeletePackList() {
    if (!deletePackListCandidate?.NetUid) {
      setPageState({ deletePackListCandidate: null })
      return
    }

    setPageState({ isSaving: true })

    try {
      await deletePackingList(deletePackListCandidate.NetUid)
      notifications.show({ color: 'green', message: t('Пак лист видалено') })
      setPageState({ deletePackListCandidate: null })
      await reloadOrder(selectedInvoiceNetId)
    } catch (deleteError) {
      notifications.show({ color: 'red', message: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити пак лист') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  function handleInvoiceQtyChange(item: SupplyInvoiceOrderItem, value: number | string) {
    if (!canEditInvoice) {
      return
    }

    if (!selectedInvoice?.NetUid) {
      return
    }

    const qty = toNonNegativeNumber(value)

    setPageState((current) => {
      const invoice = current.invoiceDetailsByNetId[selectedInvoice.NetUid || ''] || selectedInvoice

      if (!invoice) {
        return {}
      }

      return {
        invoiceDetailsByNetId: {
          ...current.invoiceDetailsByNetId,
          [selectedInvoice.NetUid || '']: upsertInvoiceOrderItem(invoice, item, qty),
        },
      }
    })
  }

  function handlePackListQtyChange(item: PackingListPackageOrderItem, value: number | string) {
    if (!canAddPackList) {
      return
    }

    if (!selectedInvoice?.NetUid || !selectedPackList) {
      return
    }

    const qty = toNonNegativeNumber(value)

    setPageState((current) => {
      const invoice = current.invoiceDetailsByNetId[selectedInvoice.NetUid || ''] || selectedInvoice

      if (!invoice) {
        return {}
      }

      return {
        invoiceDetailsByNetId: {
          ...current.invoiceDetailsByNetId,
          [selectedInvoice.NetUid || '']: upsertPackListOrderItem(invoice, selectedPackList, item, qty),
        },
      }
    })
  }

  async function saveInvoiceItems() {
    if (!canEditInvoice) {
      notifications.show({ color: 'red', message: t('Недостатньо прав для цієї дії') })
      return
    }

    if (!selectedInvoice?.NetUid) {
      notifications.show({ color: 'red', message: t('Оберіть інвойс') })
      return
    }

    if (hasInvoiceMismatch) {
      notifications.show({ color: 'red', message: t('Кількості інвойсів не збігаються із замовленням') })
      return
    }

    setPageState({ isSaving: true })

    try {
      const updatedInvoice = await updateSupplyInvoiceItems(toSupplyInvoiceItemsPayload(selectedInvoice))
      const nextDetails = mergeInvoiceDetails(invoiceDetailsByNetId, [updatedInvoice])

      setPageState({ invoiceDetailsByNetId: nextDetails })
      notifications.show({ color: 'green', message: t('Рядки інвойсів збережено') })
      await reloadOrder(selectedInvoiceNetId)
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти інвойси') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  async function savePackingLists() {
    if (!canAddPackList) {
      notifications.show({ color: 'red', message: t('Недостатньо прав для цієї дії') })
      return
    }

    if (!selectedInvoice?.NetUid) {
      notifications.show({ color: 'red', message: t('Оберіть інвойс') })
      return
    }

    if (hasPackListMismatch) {
      notifications.show({ color: 'red', message: t('Кількості пак листів не збігаються з інвойсом') })
      return
    }

    setPageState({ isSaving: true })

    try {
      const updatedInvoice = await updatePackingLists(toPackingListsPayload(selectedInvoice))

      if (updatedInvoice?.NetUid) {
        setPageState((current) => ({
          invoiceDetailsByNetId: {
            ...current.invoiceDetailsByNetId,
            [updatedInvoice.NetUid || '']: updatedInvoice,
          },
        }))
      }

      notifications.show({ color: 'green', message: t('Пак листи збережено') })
      await reloadOrder(selectedInvoice.NetUid)
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти пак листи') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  async function saveInvoiceMetadata(form: InvoiceMetadataForm) {
    if (!canEditInvoice) {
      notifications.show({ color: 'red', message: t('Недостатньо прав для цієї дії') })
      return
    }

    if (!id || !selectedInvoice?.NetUid) {
      notifications.show({ color: 'red', message: t('Оберіть інвойс') })
      return
    }

    const validationMessage = getInvoiceMetadataValidationMessage(form, selectedInvoice)

    if (validationMessage) {
      notifications.show({ color: 'red', message: t(validationMessage) })
      return
    }

    const deletedDocumentNetIds = form.documents.reduce<string[]>((result, document) => {
      if (document.Deleted && document.NetUid) {
        result.push(document.NetUid)
      }

      return result
    }, [])
    const invoicePayload = createInvoiceMetadataPayload(selectedInvoice, form)

    setPageState({ isSaving: true })

    try {
      const updatedInvoice = await updateSupplyInvoice(id, invoicePayload)
      const invoiceForUpload = updatedInvoice || invoicePayload

      await Promise.all(deletedDocumentNetIds.map(deleteSupplyInvoiceDocument))

      if (form.files.length > 0) {
        await uploadSupplyInvoiceDocuments({
          files: form.files,
          invoice: invoiceForUpload,
          supplyOrderNetId: id,
        })
      }

      notifications.show({ color: 'green', message: t('Інвойс збережено') })
      setPageState({ invoiceEditor: null })
      await reloadOrder(selectedInvoice.NetUid)
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти інвойс') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  async function saveInvoiceProtocols(invoice: SupplyInvoice) {
    if (!canEditInvoice) {
      notifications.show({ color: 'red', message: t('Недостатньо прав для цієї дії') })
      return
    }

    if (!id || !selectedInvoice?.NetUid) {
      notifications.show({ color: 'red', message: t('Оберіть інвойс') })
      return
    }

    setPageState({ isSaving: true })

    try {
      const invoicePayload = createInvoiceProtocolsPayload(invoice)
      const updatedInvoice = await updateSupplyInvoice(id, invoicePayload)
      const invoiceForReload = updatedInvoice?.NetUid || invoice.NetUid || selectedInvoice.NetUid

      if (updatedInvoice) {
        setPageState((current) => ({
          invoiceDetailsByNetId: mergeInvoiceDetails(current.invoiceDetailsByNetId, [updatedInvoice]),
        }))
      }

      notifications.show({ color: 'green', message: t('Протоколи інвойса збережено') })
      await reloadOrder(invoiceForReload)
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти протоколи') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  async function savePackListMetadata(form: PackListMetadataForm) {
    if (!canAddPackList) {
      notifications.show({ color: 'red', message: t('Недостатньо прав для цієї дії') })
      return
    }

    if (!selectedInvoice?.NetUid) {
      notifications.show({ color: 'red', message: t('Оберіть інвойс') })
      return
    }

    const draft = createPackListMetadataDraft(packListEditor?.packList, form)
    const invoiceForMetadata = upsertPackListMetadata(selectedInvoice, draft)

    setPageState({ isSaving: true })

    try {
      const updatedInvoice = await updatePackingLists(toPackingListsPayload(invoiceForMetadata))
      const invoiceAfterMetadata = updatedInvoice || selectedInvoice
      const savedPackList = findSavedPackList(invoiceAfterMetadata, draft)

      if (form.files.length > 0) {
        if (!savedPackList) {
          throw new Error(t('Не вдалося знайти збережений пак лист для документів'))
        }

        await uploadPackingListDocuments(savedPackList, form.files)
      }

      notifications.show({ color: 'green', message: t('Пак лист збережено') })
      setPageState({ packListEditor: null })
      await reloadOrder(invoiceAfterMetadata.NetUid || selectedInvoice.NetUid)
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти пак лист') })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  return {
    canAddInvoice,
    canEditInvoice,
    canAddPackList,
    canRemoveInvoice,
    canRemovePackList,
    canShowPackListUpload,
    confirmDeleteInvoice,
    confirmDeletePackList,
    deleteInvoiceCandidate,
    deletePackListCandidate,
    error,
    invoiceBalanceByOrderItemKey,
    invoiceBalanceRows,
    invoiceDetailsByNetId,
    invoiceEditor,
    invoiceItemColumns,
    invoiceUploadOpen,
    invoices,
    informationProtocolKeys,
    isBusy,
    isInvoiceLoading,
    isLoading,
    isProtocolDictionariesLoading,
    isSaving,
    order,
    orderItemColumns,
    orderItems,
    orderRows,
    orderTotalsToolbar,
    packListBalanceByInvoiceItemKey,
    packListBalanceRows,
    packListItemColumns,
    packListEditor,
    packListUploadOpen,
    paymentProtocolKeys,
    productCardNetId,
    reloadOrder,
    responsibleUsers,
    saveInvoiceMetadata,
    saveInvoiceItems,
    saveInvoiceProtocols,
    savePackListMetadata,
    savePackingLists,
    selectedInvoice,
    selectedInvoiceItems,
    selectedInvoiceNetId,
    selectedPackList,
    selectedPackListItems,
    selectedPackListNetId,
    setPageState,
    setProductCardNetId,
    submitInvoice,
    submitPackList,
    goBack: () => navigate(`/orders/ukraine/all/edit/${id || ''}`),
  }
}

type DirectOrderInvoicesPageModel = ReturnType<typeof useSupplyUkraineDirectOrderInvoicesPageModel>

function SupplyUkraineDirectOrderInvoicesView({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Stack gap="lg">
      <DirectOrderInvoicesHeader model={model} />
      {model.error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {model.error}
        </Alert>
      )}
      {model.isLoading ? (
        <Group justify="center" py="xl"><Loader /></Group>
      ) : model.order ? (
        <DirectOrderInvoicesBody model={model} />
      ) : (
        <Text c="dimmed">{t('Замовлення не знайдено')}</Text>
      )}
      <DirectOrderInvoicesModals model={model} />
    </Stack>
  )
}

function DirectOrderInvoicesHeader({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Group justify="space-between" align="flex-start">
      <Group gap="sm">
        <Tooltip label={t('Назад')}>
          <ActionIcon aria-label={t('Назад')} color="gray" variant="light" onClick={model.goBack}>
            <IconArrowLeft size={18} />
          </ActionIcon>
        </Tooltip>
        <Stack gap={2}>
          <Text fw={700} size="xl">{t('Інвойси і пак листи')} {getOrderNumber(model.order)}</Text>
          <Text c="dimmed" size="sm">{t('Постачальник')}: {getEntityName(model.order?.Client)}</Text>
        </Stack>
      </Group>
      <Group gap="xs">
        <Button
          disabled={model.isSaving || model.isInvoiceLoading}
          leftSection={<IconRefresh size={16} />}
          loading={model.isLoading}
          variant="light"
          onClick={() => model.reloadOrder()}
        >
          {t('Оновити')}
        </Button>
        {model.canAddInvoice && (
          <Button
            disabled={model.isBusy}
            leftSection={<IconFileImport size={16} />}
            loading={model.isSaving}
            variant="light"
            onClick={() => model.setPageState({ invoiceUploadOpen: true })}
          >
            {t('Додати інвойс')}
          </Button>
        )}
        {model.canShowPackListUpload && (
          <Button
            disabled={model.isBusy}
            leftSection={<IconPackage size={16} />}
            loading={model.isSaving}
            variant="light"
            onClick={() => model.setPageState({ packListUploadOpen: true })}
          >
            {t('Додати пак лист')}
          </Button>
        )}
      </Group>
    </Group>
  )
}

function DirectOrderInvoicesBody({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  if (!model.order) {
    return null
  }

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
        <TotalCard label={t('Рядків замовлення')} value={String(model.orderItems.length)} />
        <TotalCard label={t('Інвойсів')} value={String(model.invoices.length)} />
        <TotalCard label={t('Кількість')} value={formatNumber(model.order.TotalQuantity)} />
        <TotalCard label={t('Сума')} value={formatMoney(model.order.TotalNetPrice)} />
      </SimpleGrid>
      <Tabs defaultValue="products" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="products">{t('Товари замовлення')}</Tabs.Tab>
          <Tabs.Tab value="invoices">{t('Інвойси')}</Tabs.Tab>
          <Tabs.Tab value="packlists" disabled={!model.selectedInvoice}>{t('Пак листи')}</Tabs.Tab>
        </Tabs.List>
        <ProductsPanel model={model} />
        <InvoicesPanel model={model} />
        <PackListsPanel model={model} />
      </Tabs>
    </Stack>
  )
}

function ProductsPanel({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Tabs.Panel value="products" pt="md">
      <Card withBorder radius="md" padding="md">
        <DataTable
          columns={model.orderItemColumns}
          data={model.orderRows}
          emptyText={t('Товарів немає')}
          getRowId={(item, index) => item.NetUid || String(item.Id || index)}
          layoutVersion="supply-direct-order-items-2"
          minWidth={980}
          rowClassName={(item) => item.IsError ? 'data-table-row-warning' : undefined}
          tableId="supply-direct-order-items"
          toolbarLeft={model.orderTotalsToolbar}
        />
      </Card>
    </Tabs.Panel>
  )
}

function InvoicesPanel({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Tabs.Panel value="invoices" pt="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <InvoiceSelector model={model} />
          {model.selectedInvoice && <InvoiceDocumentsSummary invoice={model.selectedInvoice} />}
          {model.selectedInvoice && (
            <InvoiceProtocolsSection
              key={[
                model.selectedInvoice.NetUid || model.selectedInvoice.Id || 'invoice',
                model.paymentProtocolKeys.length,
                model.informationProtocolKeys.length,
                model.responsibleUsers.length,
              ].join('-')}
              model={model}
            />
          )}
          {model.isInvoiceLoading ? (
            <Group justify="center" py="md"><Loader size="sm" /></Group>
          ) : (
            <Stack gap="sm">
              <QuantityBalanceSummary
                actualLabel={t('В інвойсах')}
                differenceLabel={t('Залишилось')}
                expectedLabel={t('У замовленні')}
                rows={model.invoiceBalanceRows}
              />
              <Group justify="flex-end">
                <Button
                  disabled={
                    model.isBusy
                    || !model.canEditInvoice
                    || !model.selectedInvoice
                    || model.invoiceBalanceRows.some((row) => row.isError)
                  }
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={model.isSaving}
                  onClick={model.saveInvoiceItems}
                >
                  {t('Зберегти інвойси')}
                </Button>
              </Group>
              <DataTable
                columns={model.invoiceItemColumns}
                data={model.selectedInvoiceItems}
                emptyText={t('Рядків інвойсу немає')}
                getRowId={getInvoiceOrderItemRowId}
                layoutVersion="supply-direct-invoice-items-2"
                minWidth={1080}
                rowClassName={(item) =>
                  model.invoiceBalanceByOrderItemKey.get(getInvoiceOrderItemOrderKey(item))?.isError
                    ? 'data-table-row-warning'
                    : undefined}
                tableId="supply-direct-invoice-items"
              />
            </Stack>
          )}
          {model.selectedInvoice && <InvoiceTotals invoice={model.selectedInvoice} />}
        </Stack>
      </Card>
    </Tabs.Panel>
  )
}

function InvoiceSelector({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Group gap="xs" wrap="wrap">
      {model.invoices.map((invoice) => (
        <Group key={invoice.NetUid || invoice.Id} gap={4} wrap="nowrap">
          <Button
            color={invoice.NetUid === model.selectedInvoiceNetId ? 'blue' : 'gray'}
            disabled={model.isBusy}
            variant={invoice.NetUid === model.selectedInvoiceNetId ? 'filled' : 'light'}
            onClick={() => {
              const invoiceNetId = invoice.NetUid || null
              const nextInvoice = getSelectedInvoice(invoiceNetId, model.invoiceDetailsByNetId, model.invoices)

              model.setPageState((current) => ({
                selectedInvoiceNetId: invoiceNetId,
                selectedPackListNetId: getValidPackListNetId(current.selectedPackListNetId, nextInvoice),
              }))
            }}
          >
            {invoice.Number || t('Інвойс')} ({formatDate(invoice.DateFrom)})
          </Button>
          {model.canEditInvoice && (
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                disabled={model.isBusy}
                size="xs"
                variant="subtle"
                onClick={() => {
                  const invoiceNetId = invoice.NetUid || null
                  const invoiceForEdit = getSelectedInvoice(invoiceNetId, model.invoiceDetailsByNetId, model.invoices) || invoice

                  model.setPageState({
                    invoiceEditor: { invoice: invoiceForEdit },
                    selectedInvoiceNetId: invoiceNetId,
                    selectedPackListNetId: getValidPackListNetId(model.selectedPackListNetId, invoiceForEdit),
                  })
                }}
              >
                <IconEdit size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {model.canRemoveInvoice && (
            <Tooltip label={t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={model.isBusy}
                size="xs"
                variant="subtle"
                onClick={() => model.setPageState({ deleteInvoiceCandidate: invoice })}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ))}
    </Group>
  )
}

function PackListsPanel({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Tabs.Panel value="packlists" pt="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <PackListSelector model={model} />
          <QuantityBalanceSummary
            actualLabel={t('У пак листах')}
            differenceLabel={t('Залишилось')}
            expectedLabel={t('В інвойсі')}
            rows={model.packListBalanceRows}
          />
          <Group justify="flex-end">
            {model.canAddPackList && (
              <Button
                disabled={model.isBusy || !model.selectedInvoice}
                leftSection={<IconPackage size={16} />}
                variant="light"
                onClick={() => model.setPageState({ packListEditor: { packList: null } })}
              >
                {t('Новий пак лист')}
              </Button>
            )}
            <Button
              disabled={
                model.isBusy
                || !model.canAddPackList
                || !model.selectedInvoice
                || !model.selectedPackList
                || model.packListBalanceRows.some((row) => row.isError)
              }
              leftSection={<IconDeviceFloppy size={16} />}
              loading={model.isSaving}
              onClick={model.savePackingLists}
            >
              {t('Зберегти пак листи')}
            </Button>
          </Group>
          <DataTable
            columns={model.packListItemColumns}
            data={model.selectedPackListItems}
            emptyText={t('Рядків пак листа немає')}
            getRowId={getPackListOrderItemRowId}
            layoutVersion="supply-direct-pack-list-items-2"
            minWidth={1260}
            rowClassName={(item) =>
              model.packListBalanceByInvoiceItemKey.get(getPackingListInvoiceItemKey(item))?.isError
                ? 'data-table-row-warning'
                : undefined}
            tableId="supply-direct-pack-list-items"
          />
          <PackListTotals invoice={model.selectedInvoice} packList={model.selectedPackList} />
        </Stack>
      </Card>
    </Tabs.Panel>
  )
}

function PackListSelector({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Group gap="xs" wrap="wrap">
      {(model.selectedInvoice?.PackingLists || []).map((packList) => (
        <Group key={packList.NetUid || packList.Id} gap={4} wrap="nowrap">
          <Button
            color={packList.NetUid === model.selectedPackListNetId ? 'blue' : 'gray'}
            disabled={model.isBusy}
            variant={packList.NetUid === model.selectedPackListNetId ? 'filled' : 'light'}
            onClick={() => model.setPageState({ selectedPackListNetId: packList.NetUid || null })}
          >
            {packList.No || packList.InvNo || t('Пак лист')} ({formatDate(packList.FromDate)})
          </Button>
          {model.canAddPackList && (
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                disabled={model.isBusy}
                size="xs"
                variant="subtle"
                onClick={() => model.setPageState({ packListEditor: { packList } })}
              >
                <IconEdit size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {model.canRemovePackList && (
            <Tooltip label={t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={model.isBusy}
                size="xs"
                variant="subtle"
                onClick={() => model.setPageState({ deletePackListCandidate: packList })}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ))}
    </Group>
  )
}

function DirectOrderInvoicesModals({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <>
      <InvoiceUploadModal
        isSaving={model.isSaving}
        opened={model.invoiceUploadOpen}
        onClose={() => model.setPageState({ invoiceUploadOpen: false })}
        onSubmit={model.submitInvoice}
      />
      <PackListUploadModal
        isSaving={model.isSaving}
        opened={model.packListUploadOpen}
        onClose={() => model.setPageState({ packListUploadOpen: false })}
        onSubmit={model.submitPackList}
      />
      <InvoiceMetadataModal
        editor={model.invoiceEditor}
        isSaving={model.isSaving}
        onClose={() => model.setPageState({ invoiceEditor: null })}
        onSubmit={model.saveInvoiceMetadata}
      />
      <PackListMetadataModal
        editor={model.packListEditor}
        isSaving={model.isSaving}
        onClose={() => model.setPageState({ packListEditor: null })}
        onSubmit={model.savePackListMetadata}
      />
      <DeleteModal
        isSaving={model.isSaving}
        opened={Boolean(model.deleteInvoiceCandidate)}
        title={t('Видалити інвойс')}
        value={model.deleteInvoiceCandidate?.Number || ''}
        onClose={() => model.setPageState({ deleteInvoiceCandidate: null })}
        onConfirm={model.confirmDeleteInvoice}
      />
      <DeleteModal
        isSaving={model.isSaving}
        opened={Boolean(model.deletePackListCandidate)}
        title={t('Видалити пак лист')}
        value={model.deletePackListCandidate?.No || model.deletePackListCandidate?.InvNo || ''}
        onClose={() => model.setPageState({ deletePackListCandidate: null })}
        onConfirm={model.confirmDeletePackList}
      />
      <ProductCardModal productNetId={model.productCardNetId} onClose={() => model.setProductCardNetId(null)} />
    </>
  )
}

function InvoiceUploadModal({
  isSaving,
  opened,
  onClose,
  onSubmit,
}: {
  isSaving: boolean
  opened: boolean
  onClose: () => void
  onSubmit: (form: InvoiceUploadForm) => void
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<InvoiceUploadForm>(EMPTY_INVOICE_FORM)

  function close() {
    setForm({ ...EMPTY_INVOICE_FORM, dateFrom: formatDateTimeInput(new Date()) })
    onClose()
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Додати інвойс')} onClose={close}>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            disabled={isSaving}
            label={t('Номер')}
            value={form.number}
            onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, number: nextValue })) }}
          />
          <TextInput
            disabled={isSaving}
            label={t('Дата')}
            type="datetime-local"
            value={form.dateFrom}
            onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, dateFrom: nextValue })) }}
          />
        </SimpleGrid>
        <Textarea
          autosize
          disabled={isSaving}
          label={t('Коментар')}
          minRows={2}
          value={form.comment}
          onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, comment: nextValue })) }}
        />
        <FileInput
          clearable
          accept=".xls,.xlsx"
          disabled={isSaving}
          label={t('Файл')}
          value={form.file}
          onChange={(file) => setForm((current) => ({ ...current, file }))}
        />
        <SegmentedControl
          data={[{ label: t('Ціна'), value: 'unit' }, { label: t('Сума'), value: 'total' }]}
          disabled={isSaving}
          value={form.withTotalAmount ? 'total' : 'unit'}
          onChange={(value) => setForm((current) => ({ ...current, withTotalAmount: value === 'total' }))}
        />
        <ParseGrid form={form} isSaving={isSaving} onChange={setForm} />
        <Checkbox
          checked={form.productIsImported}
          disabled={isSaving}
          label={t('Імпортний товар')}
          onChange={(event) => { const nextValue = event.currentTarget.checked; setForm((current) => ({ ...current, productIsImported: nextValue })) }}
        />
        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={close}>{t('Скасувати')}</Button>
          <Button loading={isSaving} onClick={() => onSubmit(form)}>{t('Створити')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function PackListUploadModal({
  isSaving,
  opened,
  onClose,
  onSubmit,
}: {
  isSaving: boolean
  opened: boolean
  onClose: () => void
  onSubmit: (form: PackListUploadForm) => void
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<PackListUploadForm>(EMPTY_PACK_LIST_FORM)

  function close() {
    setForm({ ...EMPTY_PACK_LIST_FORM, dateFrom: formatDateTimeInput(new Date()) })
    onClose()
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Додати пак лист')} onClose={close}>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            disabled={isSaving}
            label={t('Номер')}
            value={form.number}
            onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, number: nextValue })) }}
          />
          <TextInput
            disabled={isSaving}
            label={t('Дата')}
            type="datetime-local"
            value={form.dateFrom}
            onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, dateFrom: nextValue })) }}
          />
        </SimpleGrid>
        <Textarea
          autosize
          disabled={isSaving}
          label={t('Коментар')}
          minRows={2}
          value={form.comment}
          onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, comment: nextValue })) }}
        />
        <FileInput
          clearable
          accept=".xls,.xlsx"
          disabled={isSaving}
          label={t('Файл')}
          value={form.file}
          onChange={(file) => setForm((current) => ({ ...current, file }))}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput allowDecimal={false} disabled={isSaving} label={t('Код товару')} min={1} value={form.vendorCodeColumnNumber} onChange={(value) => setForm((current) => ({ ...current, vendorCodeColumnNumber: toPositiveNumber(value) }))} />
          <NumberInput allowDecimal={false} disabled={isSaving} label={t('Кількість')} min={1} value={form.qtyColumnNumber} onChange={(value) => setForm((current) => ({ ...current, qtyColumnNumber: toPositiveNumber(value) }))} />
          <NumberInput allowDecimal={false} disabled={isSaving} label={t('З рядка')} min={1} value={form.startRow} onChange={(value) => setForm((current) => ({ ...current, startRow: toPositiveNumber(value) }))} />
          <NumberInput allowDecimal={false} disabled={isSaving} label={t('До рядка')} min={1} value={form.endRow} onChange={(value) => setForm((current) => ({ ...current, endRow: toPositiveNumber(value) }))} />
          <NumberInput allowDecimal={false} disabled={isSaving} label={t('Ціна')} min={1} value={form.unitPriceColumnNumber} onChange={(value) => setForm((current) => ({ ...current, unitPriceColumnNumber: toPositiveNumber(value) }))} />
          <NumberInput allowDecimal={false} disabled={isSaving} label={t('Нетто')} min={1} value={form.netWeightColumnNumber} onChange={(value) => setForm((current) => ({ ...current, netWeightColumnNumber: toPositiveNumber(value) }))} />
          <NumberInput allowDecimal={false} disabled={isSaving} label={t('Брутто')} min={1} value={form.grossWeightColumnNumber} onChange={(value) => setForm((current) => ({ ...current, grossWeightColumnNumber: toPositiveNumber(value) }))} />
        </SimpleGrid>
        <Checkbox
          checked={form.isWeightPerUnit}
          disabled={isSaving}
          label={t('Вага на одиницю')}
          onChange={(event) => { const nextValue = event.currentTarget.checked; setForm((current) => ({ ...current, isWeightPerUnit: nextValue })) }}
        />
        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={close}>{t('Скасувати')}</Button>
          <Button loading={isSaving} onClick={() => onSubmit(form)}>{t('Створити')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function InvoiceMetadataModal({
  editor,
  isSaving,
  onClose,
  onSubmit,
}: {
  editor: InvoiceEditorState | null
  isSaving: boolean
  onClose: () => void
  onSubmit: (form: InvoiceMetadataForm) => void
}) {
  const { t } = useI18n()
  const opened = Boolean(editor)

  return (
    <AppModal centered opened={opened} size="lg" title={t('Редагувати інвойс')} onClose={onClose}>
      {editor && (
        <InvoiceMetadataModalBody
          key={editor.invoice.NetUid || editor.invoice.Id || 'invoice'}
          editor={editor}
          isSaving={isSaving}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </AppModal>
  )
}

function InvoiceMetadataModalBody({
  editor,
  isSaving,
  onClose,
  onSubmit,
}: {
  editor: InvoiceEditorState
  isSaving: boolean
  onClose: () => void
  onSubmit: (form: InvoiceMetadataForm) => void
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<InvoiceMetadataForm>(() => createInvoiceMetadataForm(editor.invoice))

  function addFiles(files: File[] | null) {
    if (!files?.length) {
      return
    }

    setForm((current) => ({
      ...current,
      documents: [
        ...current.documents,
        ...createNewInvoiceDocuments(files),
      ],
      files: [...current.files, ...files],
    }))
  }

  function removeDocument(document: SupplyInvoiceDeliveryDocument, index: number) {
    setForm((current) => {
      const documents = [...current.documents]

      if (document.Id || document.NetUid) {
        documents[index] = { ...document, Deleted: true }
      } else {
        documents.splice(index, 1)
      }

      return {
        ...current,
        documents,
        files: document.Id || document.NetUid
          ? current.files
          : removePendingFile(current.files, document),
      }
    })
  }

  function restoreDocument(document: SupplyInvoiceDeliveryDocument, index: number) {
    setForm((current) => {
      const documents = [...current.documents]

      documents[index] = { ...document, Deleted: false }

      return { ...current, documents }
    })
  }

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <TextInput
          disabled={isSaving}
          label={t('Номер')}
          value={form.number}
          onChange={(event) => setForm((current) => ({ ...current, number: event.currentTarget.value }))}
        />
        <TextInput
          disabled={isSaving}
          label={t('Дата')}
          type="datetime-local"
          value={form.dateFrom}
          onChange={(event) => setForm((current) => ({ ...current, dateFrom: event.currentTarget.value }))}
        />
        <NumberInput
          allowNegative={false}
          decimalScale={2}
          disabled={isSaving}
          label={t('Доставка')}
          min={0}
          value={form.deliveryAmount}
          onChange={(value) => setForm((current) => ({ ...current, deliveryAmount: toNonNegativeAmount(value) }))}
        />
        <NumberInput
          allowNegative={false}
          decimalScale={2}
          disabled={isSaving}
          label={t('Знижка')}
          min={0}
          value={form.discountAmount}
          onChange={(value) => setForm((current) => ({ ...current, discountAmount: toNonNegativeAmount(value) }))}
        />
      </SimpleGrid>
      <FileInput
        clearable
        multiple
        disabled={isSaving}
        label={t('Документи інвойсу')}
        leftSection={<IconFileUpload size={16} />}
        value={[]}
        onChange={addFiles}
      />
      <PackListDocumentsList
        documents={form.documents}
        onRemove={removeDocument}
        onRestore={restoreDocument}
      />
      <Divider />
      <Group justify="flex-end">
        <Button disabled={isSaving} leftSection={<IconX size={16} />} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
        <Button leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} onClick={() => onSubmit(form)}>{t('Зберегти')}</Button>
      </Group>
    </Stack>
  )
}

function PackListMetadataModal({
  editor,
  isSaving,
  onClose,
  onSubmit,
}: {
  editor: PackListEditorState | null
  isSaving: boolean
  onClose: () => void
  onSubmit: (form: PackListMetadataForm) => void
}) {
  const { t } = useI18n()
  const opened = Boolean(editor)

  return (
    <AppModal centered opened={opened} size="lg" title={editor?.packList ? t('Редагувати пак лист') : t('Новий пак лист')} onClose={onClose}>
      {editor && (
        <PackListMetadataModalBody
          key={editor.packList?.NetUid || editor.packList?.Id || 'new'}
          editor={editor}
          isSaving={isSaving}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </AppModal>
  )
}

function PackListMetadataModalBody({
  editor,
  isSaving,
  onClose,
  onSubmit,
}: {
  editor: PackListEditorState
  isSaving: boolean
  onClose: () => void
  onSubmit: (form: PackListMetadataForm) => void
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<PackListMetadataForm>(() => createPackListMetadataForm(editor.packList))

  function addFiles(files: File[] | null) {
    if (!files?.length) {
      return
    }

    setForm((current) => ({
      ...current,
      documents: [
        ...current.documents,
        ...createNewInvoiceDocuments(files),
      ],
      files: [...current.files, ...files],
    }))
  }

  function removeDocument(document: SupplyInvoiceDeliveryDocument, index: number) {
    setForm((current) => {
      const documents = [...current.documents]

      if (document.Id) {
        documents[index] = { ...document, Deleted: true }
      } else {
        documents.splice(index, 1)
      }

      return {
        ...current,
        documents,
        files: document.Id
          ? current.files
          : current.files.filter((file) => file.name !== document.FileName),
      }
    })
  }

  function restoreDocument(document: SupplyInvoiceDeliveryDocument, index: number) {
    setForm((current) => {
      const documents = [...current.documents]

      documents[index] = { ...document, Deleted: false }

      return { ...current, documents }
    })
  }

  return (
    <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput disabled={isSaving} label="INV.NO" value={form.invNo} onChange={(event) => setForm((current) => ({ ...current, invNo: event.currentTarget.value }))} />
          <TextInput disabled={isSaving} label="REF.NO" value={form.refNo} onChange={(event) => setForm((current) => ({ ...current, refNo: event.currentTarget.value }))} />
          <TextInput disabled={isSaving} label="PL.NO" value={form.plNo} onChange={(event) => setForm((current) => ({ ...current, plNo: event.currentTarget.value }))} />
          <TextInput disabled={isSaving} label="Mark" value={form.markNumber} onChange={(event) => setForm((current) => ({ ...current, markNumber: event.currentTarget.value }))} />
          <TextInput disabled={isSaving} label="No" value={form.no} onChange={(event) => setForm((current) => ({ ...current, no: event.currentTarget.value }))} />
          <TextInput disabled={isSaving} label={t('Дата')} type="datetime-local" value={form.dateFrom} onChange={(event) => setForm((current) => ({ ...current, dateFrom: event.currentTarget.value }))} />
        </SimpleGrid>
        <Textarea
          autosize
          disabled={isSaving}
          label={t('Коментар')}
          minRows={2}
          value={form.comment}
          onChange={(event) => setForm((current) => ({ ...current, comment: event.currentTarget.value }))}
        />
        <FileInput
          clearable
          multiple
          disabled={isSaving}
          label={t('Документи')}
          leftSection={<IconFileUpload size={16} />}
          value={[]}
          onChange={addFiles}
        />
        <PackListDocumentsList
          documents={form.documents}
          onRemove={removeDocument}
          onRestore={restoreDocument}
        />
        <Divider />
        <Group justify="flex-end">
          <Button disabled={isSaving} leftSection={<IconX size={16} />} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} onClick={() => onSubmit(form)}>{t('Зберегти')}</Button>
        </Group>
    </Stack>
  )
}

function PackListDocumentsList({
  documents,
  onRemove,
  onRestore,
}: {
  documents: SupplyInvoiceDeliveryDocument[]
  onRemove: (document: SupplyInvoiceDeliveryDocument, index: number) => void
  onRestore: (document: SupplyInvoiceDeliveryDocument, index: number) => void
}) {
  const { t } = useI18n()

  if (documents.length === 0) {
    return <Text c="dimmed" size="sm">{t('Документів немає')}</Text>
  }

  return (
    <Stack gap="xs">
      {documents.map((document, index) => (
        <Group key={document.NetUid || document.Id || `${document.FileName}-${index}`} justify="space-between" wrap="nowrap">
          <Stack gap={0}>
            {getDocumentUrl(document) && !document.Deleted ? (
              <Anchor href={upgradeHttpToHttps(getDocumentUrl(document))} rel="noreferrer" size="sm" target="_blank">
                {document.FileName || document.GeneratedName || t('Документ')}
              </Anchor>
            ) : (
              <Text c={document.Deleted ? 'dimmed' : undefined} size="sm" td={document.Deleted ? 'line-through' : undefined}>
                {document.FileName || document.GeneratedName || t('Документ')}
              </Text>
            )}
            {document.Deleted && <Text c="red" size="xs">{t('Буде видалено')}</Text>}
          </Stack>
          {document.Deleted ? (
            <Tooltip label={t('Відновити')}>
              <ActionIcon aria-label={t('Відновити')} color="gray" variant="subtle" onClick={() => onRestore(document, index)}>
                <IconArrowBackUp size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label={t('Видалити')}>
              <ActionIcon aria-label={t('Видалити')} color="red" variant="subtle" onClick={() => onRemove(document, index)}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ))}
    </Stack>
  )
}

function ParseGrid({
  form,
  isSaving,
  onChange,
}: {
  form: InvoiceUploadForm
  isSaving: boolean
  onChange: Dispatch<SetStateAction<InvoiceUploadForm>>
}) {
  const { t } = useI18n()

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      <NumberInput allowDecimal={false} disabled={isSaving} label={t('Код товару')} min={1} value={form.vendorCodeColumnNumber} onChange={(value) => onChange((current) => ({ ...current, vendorCodeColumnNumber: toPositiveNumber(value) }))} />
      <NumberInput allowDecimal={false} disabled={isSaving} label={t('Кількість')} min={1} value={form.qtyColumnNumber} onChange={(value) => onChange((current) => ({ ...current, qtyColumnNumber: toPositiveNumber(value) }))} />
      <NumberInput allowDecimal={false} disabled={isSaving} label={t('З рядка')} min={1} value={form.startRow} onChange={(value) => onChange((current) => ({ ...current, startRow: toPositiveNumber(value) }))} />
      <NumberInput allowDecimal={false} disabled={isSaving} label={t('До рядка')} min={1} value={form.endRow} onChange={(value) => onChange((current) => ({ ...current, endRow: toPositiveNumber(value) }))} />
      <NumberInput allowDecimal={false} disabled={isSaving || form.withTotalAmount} label={t('Ціна')} min={1} value={form.unitPriceColumnNumber} onChange={(value) => onChange((current) => ({ ...current, unitPriceColumnNumber: toPositiveNumber(value) }))} />
      <NumberInput allowDecimal={false} disabled={isSaving || !form.withTotalAmount} label={t('Сума')} min={1} value={form.totalAmountColumnNumber} onChange={(value) => onChange((current) => ({ ...current, totalAmountColumnNumber: toPositiveNumber(value) }))} />
    </SimpleGrid>
  )
}

function DeleteModal({
  isSaving,
  opened,
  title,
  value,
  onClose,
  onConfirm,
}: {
  isSaving: boolean
  opened: boolean
  title: string
  value: string
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <Stack gap="md">
        <Text>{t('Видалити')} <Text span fw={700}>{value || '-'}</Text>?</Text>
        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={onConfirm}>{t('Видалити')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function useOrderItemColumns(onOpenProductCard: (productNetId: string) => void): DataTableColumn<SupplyOrderItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyOrderItem>[]>(
    () => [
      { id: 'code', header: t('Код'), width: 130, accessor: (item) => item.Product?.VendorCode, cell: (item) => <ProductCodeCell product={item.Product} onOpenProductCard={onOpenProductCard} /> },
      { id: 'name', header: t('Товар'), minWidth: 260, accessor: (item) => item.Product?.Name, cell: (item) => <ProductNameCell product={item.Product} onOpenProductCard={onOpenProductCard} /> },
      { id: 'qty', header: t('Кількість'), width: 120, align: 'right', accessor: (item) => item.Qty, cell: (item) => formatNumber(item.Qty) },
      { id: 'leftToInvoice', header: t('Залишок'), width: 120, align: 'right', accessor: (item) => item.QtyDifference, cell: (item) => <BalanceBadge value={item.QtyDifference || 0} /> },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => formatMoney(item.UnitPrice) },
      { id: 'total', header: t('Сума'), width: 130, align: 'right', accessor: (item) => getOrderItemTotal(item), cell: (item) => formatMoney(getOrderItemTotal(item)) },
      { id: 'placed', header: t('Розміщено'), width: 120, accessor: (item) => item.IsPlaced, cell: (item) => <Badge color={item.IsPlaced ? 'green' : 'gray'} variant="light">{item.IsPlaced ? t('Так') : t('Ні')}</Badge> },
    ],
    [onOpenProductCard, t],
  )
}

function useInvoiceItemColumns({
  balanceByOrderItemKey,
  disabled,
  onOpenProductCard,
  onQtyChange,
}: {
  balanceByOrderItemKey: Map<string, InvoiceBalanceRow>
  disabled: boolean
  onOpenProductCard: (productNetId: string) => void
  onQtyChange: (item: SupplyInvoiceOrderItem, value: number | string) => void
}): DataTableColumn<SupplyInvoiceOrderItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyInvoiceOrderItem>[]>(
    () => [
      { id: 'code', header: t('Код'), width: 130, accessor: (item) => getInvoiceItemProduct(item)?.VendorCode, cell: (item) => <ProductCodeCell product={getInvoiceItemProduct(item)} onOpenProductCard={onOpenProductCard} /> },
      { id: 'name', header: t('Товар'), minWidth: 260, accessor: (item) => getInvoiceItemProduct(item)?.Name, cell: (item) => <ProductNameCell product={getInvoiceItemProduct(item)} onOpenProductCard={onOpenProductCard} /> },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 150,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => (
          <NumberInput
            allowNegative={false}
            decimalScale={3}
            disabled={disabled}
            hideControls
            min={0}
            value={toNumberInputValue(item.Qty)}
            onChange={(value) => onQtyChange(item, value)}
          />
        ),
      },
      {
        id: 'leftToInvoice',
        header: t('Залишок'),
        width: 120,
        align: 'right',
        accessor: (item) => balanceByOrderItemKey.get(getInvoiceOrderItemOrderKey(item))?.difference,
        cell: (item) => <BalanceBadge value={balanceByOrderItemKey.get(getInvoiceOrderItemOrderKey(item))?.difference || 0} />,
      },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => formatMoney(item.UnitPrice) },
      { id: 'total', header: t('Сума'), width: 130, align: 'right', accessor: (item) => item.TotalAmount, cell: (item) => formatMoney(item.TotalAmount || (item.UnitPrice || 0) * (item.Qty || 0)) },
      { id: 'imported', header: t('Імпорт'), width: 110, accessor: (item) => item.ProductIsImported, cell: (item) => <Badge color={item.ProductIsImported ? 'green' : 'gray'} variant="light">{item.ProductIsImported ? t('Так') : t('Ні')}</Badge> },
    ],
    [balanceByOrderItemKey, disabled, onOpenProductCard, onQtyChange, t],
  )
}

function usePackListItemColumns({
  balanceByInvoiceItemKey,
  disabled,
  onOpenProductCard,
  onQtyChange,
}: {
  balanceByInvoiceItemKey: Map<string, PackListBalanceRow>
  disabled: boolean
  onOpenProductCard: (productNetId: string) => void
  onQtyChange: (item: PackingListPackageOrderItem, value: number | string) => void
}): DataTableColumn<PackingListPackageOrderItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<PackingListPackageOrderItem>[]>(
    () => [
      { id: 'code', header: t('Код'), width: 130, accessor: (item) => item.SupplyInvoiceOrderItem?.Product?.VendorCode, cell: (item) => <ProductCodeCell product={item.SupplyInvoiceOrderItem?.Product} onOpenProductCard={onOpenProductCard} /> },
      { id: 'name', header: t('Товар'), minWidth: 260, accessor: (item) => item.SupplyInvoiceOrderItem?.Product?.Name, cell: (item) => <ProductNameCell product={item.SupplyInvoiceOrderItem?.Product} onOpenProductCard={onOpenProductCard} /> },
      { id: 'netUnit', header: t('Нетто од.'), width: 120, align: 'right', accessor: (item) => item.NetWeight, cell: (item) => formatNumber(item.NetWeight) },
      { id: 'grossUnit', header: t('Брутто од.'), width: 120, align: 'right', accessor: (item) => item.GrossWeight, cell: (item) => formatNumber(item.GrossWeight) },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 150,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => (
          <NumberInput
            allowNegative={false}
            decimalScale={3}
            disabled={disabled}
            hideControls
            min={0}
            value={toNumberInputValue(item.Qty)}
            onChange={(value) => onQtyChange(item, value)}
          />
        ),
      },
      {
        id: 'leftToPack',
        header: t('Залишок'),
        width: 120,
        align: 'right',
        accessor: (item) => balanceByInvoiceItemKey.get(getPackingListInvoiceItemKey(item))?.difference,
        cell: (item) => <BalanceBadge value={balanceByInvoiceItemKey.get(getPackingListInvoiceItemKey(item))?.difference || 0} />,
      },
      { id: 'net', header: t('Нетто'), width: 120, align: 'right', accessor: (item) => item.TotalNetWeight, cell: (item) => formatNumber(item.TotalNetWeight) },
      { id: 'gross', header: t('Брутто'), width: 120, align: 'right', accessor: (item) => item.TotalGrossWeight, cell: (item) => formatNumber(item.TotalGrossWeight) },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => formatMoney(item.UnitPrice) },
      { id: 'total', header: t('Сума'), width: 130, align: 'right', accessor: (item) => item.TotalGrossPrice, cell: (item) => formatMoney(item.TotalGrossPrice) },
    ],
    [balanceByInvoiceItemKey, disabled, onOpenProductCard, onQtyChange, t],
  )
}

function ProductCodeCell({
  onOpenProductCard,
  product,
}: {
  onOpenProductCard: (productNetId: string) => void
  product?: Product | null
}) {
  const netId = product?.NetUid
  const code = product?.VendorCode || '-'

  return netId ? (
    <Anchor
      component="button"
      fw={600}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpenProductCard(netId)
      }}
    >
      {code}
    </Anchor>
  ) : (
    <Text fw={600} size="sm">{code}</Text>
  )
}

function ProductNameCell({
  onOpenProductCard,
  product,
}: {
  onOpenProductCard: (productNetId: string) => void
  product?: Product | null
}) {
  const netId = product?.NetUid
  const name = product?.Name || product?.NameUA || '-'

  return netId ? (
    <Anchor
      component="button"
      size="sm"
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpenProductCard(netId)
      }}
    >
      {name}
    </Anchor>
  ) : (
    <Text size="sm">{name}</Text>
  )
}

function InvoiceDocumentsSummary({ invoice }: { invoice: SupplyInvoice }) {
  const { t } = useI18n()
  const documents = getActiveInvoiceDocuments(invoice.InvoiceDocuments || [])

  if (documents.length === 0) {
    return null
  }

  return (
    <Group gap="xs" wrap="wrap">
      <Text c="dimmed" size="sm">{t('Документи інвойсу')}:</Text>
      {documents.map((document, index) => {
        const documentUrl = getDocumentUrl(document)
        const label = document.FileName || document.GeneratedName || t('Документ')

        return documentUrl ? (
          <Anchor
            key={document.NetUid || document.Id || `${label}-${index}`}
            href={upgradeHttpToHttps(documentUrl)}
            rel="noreferrer"
            size="sm"
            target="_blank"
          >
            {label}
          </Anchor>
        ) : (
          <Badge key={document.NetUid || document.Id || `${label}-${index}`} color="gray" variant="light">
            {label}
          </Badge>
        )
      })}
    </Group>
  )
}

function InvoiceProtocolsSection({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()
  const invoice = model.selectedInvoice
  const [paymentDraft, setPaymentDraft] = useState<PaymentProtocolDraft>(() =>
    createEmptyPaymentProtocolDraft(model.paymentProtocolKeys, model.responsibleUsers),
  )
  const [informationDraft, setInformationDraft] = useState<InformationProtocolDraft>(() =>
    createEmptyInformationProtocolDraft(model.informationProtocolKeys, model.responsibleUsers),
  )
  const [editingPaymentIndex, setEditingPaymentIndex] = useState<number | null>(null)
  const [editingInformationIndex, setEditingInformationIndex] = useState<number | null>(null)

  const paymentKeyOptions = useMemo(
    () => toSelectOptions(model.paymentProtocolKeys, (key) => key.Key || t('Форма')),
    [model.paymentProtocolKeys, t],
  )
  const informationKeyOptions = useMemo(
    () => toSelectOptions(model.informationProtocolKeys, (key) => key.Key || t('Протокол')),
    [model.informationProtocolKeys, t],
  )
  const userOptions = useMemo(
    () => toSelectOptions(model.responsibleUsers, getUserName),
    [model.responsibleUsers],
  )
  const paymentRows = useMemo(() => getActivePaymentProtocolRows(invoice), [invoice])
  const informationRows = useMemo(() => getActiveInformationProtocolRows(invoice), [invoice])
  const isDisabled = model.isBusy || !model.canEditInvoice

  if (!invoice) {
    return null
  }

  const currentInvoice = invoice

  function selectPaymentKey(keyId: string | null) {
    const key = findEntityBySelectValue(model.paymentProtocolKeys, keyId)

    setPaymentDraft((current) => ({
      ...current,
      keyId,
      keyText: key?.Key || current.keyText,
    }))
  }

  function selectInformationKey(keyId: string | null) {
    const key = findEntityBySelectValue(model.informationProtocolKeys, keyId)

    setInformationDraft((current) => ({
      ...current,
      keyId,
      keyText: key?.Key || current.keyText,
    }))
  }

  function resetPaymentDraft() {
    setPaymentDraft(createEmptyPaymentProtocolDraft(model.paymentProtocolKeys, model.responsibleUsers))
    setEditingPaymentIndex(null)
  }

  function resetInformationDraft() {
    setInformationDraft(createEmptyInformationProtocolDraft(model.informationProtocolKeys, model.responsibleUsers))
    setEditingInformationIndex(null)
  }

  function editPaymentProtocol(protocol: SupplyOrderPaymentDeliveryProtocol, index: number) {
    setPaymentDraft(createPaymentProtocolDraft(protocol, model.paymentProtocolKeys, model.responsibleUsers))
    setEditingPaymentIndex(index)
  }

  function editInformationProtocol(protocol: SupplyInformationDeliveryProtocol, index: number) {
    setInformationDraft(createInformationProtocolDraft(protocol, model.informationProtocolKeys, model.responsibleUsers))
    setEditingInformationIndex(index)
  }

  function savePaymentProtocol() {
    const validationMessage = getPaymentProtocolValidationMessage(paymentDraft)

    if (validationMessage) {
      notifications.show({ color: 'red', message: t(validationMessage) })
      return
    }

    const nextInvoice = upsertPaymentProtocol(currentInvoice, paymentDraft, {
      key: getPaymentProtocolKeyFromDraft(paymentDraft, model.paymentProtocolKeys),
      protocolIndex: editingPaymentIndex,
      user: getUserFromDraft(paymentDraft.userId, model.responsibleUsers),
    })

    resetPaymentDraft()
    void model.saveInvoiceProtocols(nextInvoice)
  }

  function saveInformationProtocol() {
    const validationMessage = getInformationProtocolValidationMessage(informationDraft)

    if (validationMessage) {
      notifications.show({ color: 'red', message: t(validationMessage) })
      return
    }

    const nextInvoice = upsertInformationProtocol(currentInvoice, informationDraft, {
      key: getInformationProtocolKeyFromDraft(informationDraft, model.informationProtocolKeys),
      protocolIndex: editingInformationIndex,
      user: getUserFromDraft(informationDraft.userId, model.responsibleUsers),
    })

    resetInformationDraft()
    void model.saveInvoiceProtocols(nextInvoice)
  }

  return (
    <Stack gap="md">
      <Divider />
      <Group justify="space-between" align="center">
        <Text fw={700}>{t('Протоколи інвойса')}</Text>
        {model.isProtocolDictionariesLoading && <Loader size="xs" />}
      </Group>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600} size="sm">{t('Платіжні протоколи')}</Text>
            <Badge color="gray" variant="light">{paymentRows.length}</Badge>
          </Group>
          {paymentRows.length === 0 ? (
            <Text c="dimmed" size="sm">{t('Платіжних протоколів немає')}</Text>
          ) : (
            <Stack gap="xs">
              {paymentRows.map(({ index, protocol }) => (
                <Group key={getProtocolRowKey(protocol, index)} justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs" wrap="wrap">
                      <Badge variant="light">{getPaymentProtocolKeyText(protocol)}</Badge>
                      <Text fw={700} size="sm">{formatMoney(protocol.Value)}</Text>
                      {protocol.Discount ? <Text c="dimmed" size="sm">{formatNumber(protocol.Discount)}%</Text> : null}
                      {protocol.IsAccounting && <Badge color="teal" variant="light">{t('Бухгалтерія')}</Badge>}
                    </Group>
                    <Text c="dimmed" size="xs">
                      {t('Оплатити до')}: {formatDate(protocol.SupplyPaymentTask?.PayToDate)}
                      {' · '}
                      {t('Відповідальний')}: {getUserName(protocol.SupplyPaymentTask?.User || protocol.User)}
                    </Text>
                    {protocol.SupplyPaymentTask?.Comment && (
                      <Text size="xs">{protocol.SupplyPaymentTask.Comment}</Text>
                    )}
                  </Stack>
                  {model.canEditInvoice && (
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label={t('Редагувати')}>
                        <ActionIcon
                          aria-label={t('Редагувати')}
                          disabled={isDisabled}
                          size="sm"
                          variant="subtle"
                          onClick={() => editPaymentProtocol(protocol, index)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={t('Видалити')}>
                        <ActionIcon
                          aria-label={t('Видалити')}
                          color="red"
                          disabled={isDisabled}
                          size="sm"
                          variant="subtle"
                          onClick={() => model.saveInvoiceProtocols(markPaymentProtocolDeleted(currentInvoice, index))}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )}
                </Group>
              ))}
            </Stack>
          )}
          {model.canEditInvoice && (
            <Stack gap="xs">
              <Divider />
              <Text fw={600} size="sm">
                {editingPaymentIndex === null ? t('Новий платіжний протокол') : t('Редагувати платіжний протокол')}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                <Select
                  clearable
                  data={paymentKeyOptions}
                  disabled={isDisabled}
                  label={t('Шаблон форми')}
                  searchable
                  value={paymentDraft.keyId}
                  onChange={selectPaymentKey}
                />
                <TextInput
                  disabled={isDisabled}
                  label={t('Форма оплати')}
                  value={paymentDraft.keyText}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, keyText: event.currentTarget.value }))}
                />
                <NumberInput
                  allowNegative={false}
                  decimalScale={2}
                  disabled={isDisabled}
                  label={t('Відсоток')}
                  min={0}
                  value={paymentDraft.discount}
                  onChange={(value) => setPaymentDraft((current) => ({ ...current, discount: toNonNegativeAmount(value) }))}
                />
                <NumberInput
                  allowNegative={false}
                  decimalScale={2}
                  disabled={isDisabled}
                  label={t('Сума')}
                  min={0}
                  value={paymentDraft.amount}
                  onChange={(value) => setPaymentDraft((current) => ({ ...current, amount: toNonNegativeAmount(value) }))}
                />
                <TextInput
                  disabled={isDisabled}
                  label={t('Оплатити до')}
                  type="date"
                  value={paymentDraft.payToDate}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, payToDate: event.currentTarget.value }))}
                />
                <Select
                  data={userOptions}
                  disabled={isDisabled}
                  label={t('Відповідальний')}
                  searchable
                  value={paymentDraft.userId}
                  onChange={(value) => setPaymentDraft((current) => ({ ...current, userId: value }))}
                />
              </SimpleGrid>
              <Checkbox
                checked={paymentDraft.isAccounting}
                disabled={isDisabled}
                label={t('Бухгалтерський платіж')}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, isAccounting: event.currentTarget.checked }))}
              />
              <Textarea
                autosize
                disabled={isDisabled}
                label={t('Коментар')}
                minRows={2}
                value={paymentDraft.comment}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, comment: event.currentTarget.value }))}
              />
              <Group justify="flex-end">
                {editingPaymentIndex !== null && (
                  <Button disabled={isDisabled} variant="subtle" onClick={resetPaymentDraft}>{t('Скасувати')}</Button>
                )}
                <Button disabled={isDisabled} leftSection={<IconDeviceFloppy size={16} />} loading={model.isSaving} onClick={savePaymentProtocol}>
                  {t('Зберегти')}
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600} size="sm">{t('Інформаційні протоколи')}</Text>
            <Badge color="gray" variant="light">{informationRows.length}</Badge>
          </Group>
          {informationRows.length === 0 ? (
            <Text c="dimmed" size="sm">{t('Інформаційних протоколів немає')}</Text>
          ) : (
            <Stack gap="xs">
              {informationRows.map(({ index, protocol }) => (
                <Group key={getProtocolRowKey(protocol, index)} justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs" wrap="wrap">
                      <Badge variant="light">{getInformationProtocolKeyText(protocol)}</Badge>
                      <Text fw={700} size="sm">{protocol.Value || 0} {t('днів')}</Text>
                      {protocol.IsDefault && <Badge color="gray" variant="light">{t('За замовчуванням')}</Badge>}
                    </Group>
                    <Text c="dimmed" size="xs">
                      {t('Початок')}: {formatDate(protocol.Created)}
                      {' · '}
                      {t('Відповідальний')}: {getUserName(protocol.User)}
                    </Text>
                  </Stack>
                  {model.canEditInvoice && (
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label={t('Редагувати')}>
                        <ActionIcon
                          aria-label={t('Редагувати')}
                          disabled={isDisabled}
                          size="sm"
                          variant="subtle"
                          onClick={() => editInformationProtocol(protocol, index)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {!protocol.IsDefault && (
                        <Tooltip label={t('Видалити')}>
                          <ActionIcon
                            aria-label={t('Видалити')}
                            color="red"
                            disabled={isDisabled}
                            size="sm"
                            variant="subtle"
                            onClick={() => model.saveInvoiceProtocols(markInformationProtocolDeleted(currentInvoice, index))}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  )}
                </Group>
              ))}
            </Stack>
          )}
          {model.canEditInvoice && (
            <Stack gap="xs">
              <Divider />
              <Text fw={600} size="sm">
                {editingInformationIndex === null ? t('Новий інформаційний протокол') : t('Редагувати інформаційний протокол')}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                <Select
                  clearable
                  data={informationKeyOptions}
                  disabled={isDisabled}
                  label={t('Шаблон протоколу')}
                  searchable
                  value={informationDraft.keyId}
                  onChange={selectInformationKey}
                />
                <TextInput
                  disabled={isDisabled}
                  label={t('Назва протоколу')}
                  value={informationDraft.keyText}
                  onChange={(event) => setInformationDraft((current) => ({ ...current, keyText: event.currentTarget.value }))}
                />
                <NumberInput
                  allowNegative={false}
                  allowDecimal={false}
                  disabled={isDisabled}
                  label={t('Днів')}
                  min={0}
                  value={informationDraft.value}
                  onChange={(value) => setInformationDraft((current) => ({ ...current, value: toNonNegativeAmount(value) }))}
                />
                <Select
                  data={userOptions}
                  disabled={isDisabled}
                  label={t('Відповідальний')}
                  searchable
                  value={informationDraft.userId}
                  onChange={(value) => setInformationDraft((current) => ({ ...current, userId: value }))}
                />
              </SimpleGrid>
              <Group justify="flex-end">
                {editingInformationIndex !== null && (
                  <Button disabled={isDisabled} variant="subtle" onClick={resetInformationDraft}>{t('Скасувати')}</Button>
                )}
                <Button disabled={isDisabled} leftSection={<IconDeviceFloppy size={16} />} loading={model.isSaving} onClick={saveInformationProtocol}>
                  {t('Зберегти')}
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </SimpleGrid>
    </Stack>
  )
}

function InvoiceTotals({ invoice }: { invoice: SupplyInvoice }) {
  const { t } = useI18n()

  return (
    <SummaryLine
      items={[
        [t('Позицій у пак листах'), formatNumber(countPackingListItems(invoice))],
        [t('Кількість у пак листах'), formatNumber(sumPackingListQty(invoice))],
        [t('Сума інвойса'), formatMoney(invoice.TotalNetPrice)],
        [t('Нетто'), formatNumber(invoice.TotalNetWeight)],
        [t('Брутто'), formatNumber(invoice.TotalGrossWeight)],
      ]}
    />
  )
}

function PackListTotals({
  invoice,
  packList,
}: {
  invoice: SupplyInvoice | null
  packList: PackingList | null
}) {
  const { t } = useI18n()

  if (packList) {
    return (
      <SummaryLine
        items={[
          [t('Позицій'), formatNumber(packList.PackingListPackageOrderItems?.length || 0)],
          [t('Кількість'), formatNumber(packList.TotalQuantity)],
          [t('Сума'), formatMoney(packList.TotalNetPrice)],
          [t('Нетто'), formatNumber(packList.TotalNetWeight)],
          [t('Брутто'), formatNumber(packList.TotalGrossWeight)],
        ]}
      />
    )
  }

  if (!invoice) {
    return null
  }

  return (
    <SummaryLine
      items={[
        [t('Позицій у пак листах'), formatNumber(countPackingListItems(invoice))],
        [t('Кількість'), formatNumber(invoice.TotalQuantity)],
        [t('Сума інвойса'), formatMoney(invoice.TotalNetPrice)],
        [t('Нетто'), formatNumber(invoice.TotalNetWeight)],
        [t('Брутто'), formatNumber(invoice.TotalGrossWeight)],
      ]}
    />
  )
}

function SummaryLine({ items }: { items: Array<[string, string]> }) {
  return (
    <Group gap="lg" wrap="wrap">
      {items.map(([label, value]) => (
        <Stack key={label} gap={0}>
          <Text c="dimmed" size="xs">{label}</Text>
          <Text fw={700} size="sm">{value}</Text>
        </Stack>
      ))}
    </Group>
  )
}

function QuantityBalanceSummary({
  actualLabel,
  differenceLabel,
  expectedLabel,
  rows,
}: {
  actualLabel: string
  differenceLabel: string
  expectedLabel: string
  rows: QuantityBalanceRow[]
}) {
  const { t } = useI18n()
  const expectedQty = sumRows(rows, 'expectedQty')
  const actualQty = sumRows(rows, 'actualQty')
  const difference = roundQuantity(expectedQty - actualQty)
  const invalidRows = rows.filter((row) => row.isError).length

  return (
    <Alert color={invalidRows ? 'yellow' : 'green'} icon={<IconAlertCircle size={18} />} variant="light">
      <Group gap="lg" wrap="wrap">
        <Text fw={600}>{invalidRows ? t('Є розбіжності') : t('Кількості збігаються')}</Text>
        <Text size="sm">{expectedLabel}: <Text span fw={700}>{formatNumber(expectedQty)}</Text></Text>
        <Text size="sm">{actualLabel}: <Text span fw={700}>{formatNumber(actualQty)}</Text></Text>
        <Text size="sm">{differenceLabel}: <Text span fw={700}>{formatNumber(difference)}</Text></Text>
        {invalidRows > 0 && <Badge color="yellow" variant="filled">{invalidRows}</Badge>}
      </Group>
    </Alert>
  )
}

function BalanceBadge({ value }: { value: number }) {
  const isOk = isZeroQuantity(value)

  return (
    <Badge color={isOk ? 'green' : 'yellow'} variant={isOk ? 'light' : 'filled'}>
      {formatNumber(value)}
    </Badge>
  )
}

async function loadInvoiceDetails(order: DirectSupplyOrder | null): Promise<Record<string, SupplyInvoice>> {
  const invoices = order?.SupplyInvoices || []
  const details = await Promise.all(
    invoices.map(async (invoice) => {
      if (!invoice.NetUid) {
        return invoice
      }

      return await getSupplyInvoiceItems(invoice.NetUid) || invoice
    }),
  )

  return details.reduce<Record<string, SupplyInvoice>>((result, invoice) => {
    if (invoice.NetUid) {
      result[invoice.NetUid] = invoice
    }

    return result
  }, {})
}

function getSelectedInvoice(
  selectedInvoiceNetId: string | null,
  invoiceDetailsByNetId: Record<string, SupplyInvoice>,
  invoices: SupplyInvoice[],
): SupplyInvoice | null {
  if (!selectedInvoiceNetId) {
    return null
  }

  return invoiceDetailsByNetId[selectedInvoiceNetId]
    || invoices.find((invoice) => invoice.NetUid === selectedInvoiceNetId)
    || null
}

function getValidPackListNetId(
  currentPackListNetId: string | null,
  invoice: SupplyInvoice | null,
): string | null {
  if (!invoice) {
    return null
  }

  if (currentPackListNetId && invoice.PackingLists?.some((packList) => packList.NetUid === currentPackListNetId)) {
    return currentPackListNetId
  }

  return invoice.PackingLists?.[0]?.NetUid || null
}

function buildInvoiceBalanceRows(orderItems: SupplyOrderItem[], invoices: SupplyInvoice[]): InvoiceBalanceRow[] {
  const invoiceItems = invoices.flatMap((invoice) => invoice.SupplyInvoiceOrderItems || [])

  return orderItems.map((orderItem) => {
    const expectedQty = orderItem.Qty || 0
    const actualQty = invoiceItems.reduce(
      (total, invoiceItem) => total + (isInvoiceItemForOrderItem(invoiceItem, orderItem) ? invoiceItem.Qty || 0 : 0),
      0,
    )
    const difference = roundQuantity(expectedQty - actualQty)

    return {
      actualQty: roundQuantity(actualQty),
      difference,
      expectedQty: roundQuantity(expectedQty),
      isError: !isZeroQuantity(difference),
      key: getSupplyOrderItemKey(orderItem),
      orderItem,
    }
  })
}

function buildPackListBalanceRows(invoice: SupplyInvoice): PackListBalanceRow[] {
  const packListItems = (invoice.PackingLists || []).flatMap((packList) => packList.PackingListPackageOrderItems || [])

  return (invoice.SupplyInvoiceOrderItems || []).map((invoiceItem) => {
    const expectedQty = invoiceItem.Qty || 0
    const actualQty = packListItems.reduce(
      (total, packListItem) => total + (isPackListItemForInvoiceItem(packListItem, invoiceItem) ? packListItem.Qty || 0 : 0),
      0,
    )
    const difference = roundQuantity(expectedQty - actualQty)

    return {
      actualQty: roundQuantity(actualQty),
      difference,
      expectedQty: roundQuantity(expectedQty),
      invoiceItem,
      isError: !isZeroQuantity(difference),
      key: getSupplyInvoiceItemKey(invoiceItem),
    }
  })
}

function buildEditableInvoiceItems(invoice: SupplyInvoice | null, orderItems: SupplyOrderItem[]): SupplyInvoiceOrderItem[] {
  if (!invoice) {
    return []
  }

  const existingItems = invoice.SupplyInvoiceOrderItems || []
  const usedItemKeys = new Set<string>()
  const rows = orderItems.map((orderItem) => {
    const existingItem = existingItems.find((item) => isInvoiceItemForOrderItem(item, orderItem))
    const key = existingItem ? getSupplyInvoiceItemKey(existingItem) : ''

    if (key) {
      usedItemKeys.add(key)
    }

    return existingItem || createInvoiceOrderItem(orderItem, 0)
  })
  const extraRows = existingItems.filter((item) => !usedItemKeys.has(getSupplyInvoiceItemKey(item)))

  return [...rows, ...extraRows]
}

function buildEditablePackListItems(
  packList: PackingList | null,
  invoice: SupplyInvoice | null,
): PackingListPackageOrderItem[] {
  if (!packList || !invoice) {
    return []
  }

  const existingItems = packList.PackingListPackageOrderItems || []
  const usedItemKeys = new Set<string>()
  const rows = (invoice.SupplyInvoiceOrderItems || []).map((invoiceItem) => {
    const existingItem = existingItems.find((item) => isPackListItemForInvoiceItem(item, invoiceItem))
    const key = existingItem ? getPackingListPackageOrderItemKey(existingItem) : ''

    if (key) {
      usedItemKeys.add(key)
    }

    return existingItem || createPackListOrderItem(invoiceItem, 0)
  })
  const extraRows = existingItems.filter((item) => !usedItemKeys.has(getPackingListPackageOrderItemKey(item)))

  return [...rows, ...extraRows]
}

function upsertInvoiceOrderItem(
  invoice: SupplyInvoice,
  sourceItem: SupplyInvoiceOrderItem,
  qty: number,
): SupplyInvoice {
  const sourceKey = getInvoiceOrderItemOrderKey(sourceItem)
  const existingItems = invoice.SupplyInvoiceOrderItems || []
  const index = existingItems.findIndex((item) => getInvoiceOrderItemOrderKey(item) === sourceKey)
  const nextItem = updateInvoiceOrderItemQty(sourceItem, qty)
  const nextItems = [...existingItems]

  if (index >= 0) {
    nextItems[index] = nextItem
  } else {
    nextItems.push(nextItem)
  }

  return {
    ...invoice,
    SupplyInvoiceOrderItems: nextItems,
  }
}

function upsertPackListOrderItem(
  invoice: SupplyInvoice,
  targetPackList: PackingList,
  sourceItem: PackingListPackageOrderItem,
  qty: number,
): SupplyInvoice {
  const sourceKey = getPackingListInvoiceItemKey(sourceItem)
  const nextPackLists = (invoice.PackingLists || []).map((packList) => {
    if (!isSameEntity(packList, targetPackList)) {
      return packList
    }

    const existingItems = packList.PackingListPackageOrderItems || []
    const index = existingItems.findIndex((item) => getPackingListInvoiceItemKey(item) === sourceKey)
    const nextItem = updatePackListOrderItemQty(sourceItem, qty)
    const nextItems = [...existingItems]

    if (index >= 0) {
      nextItems[index] = nextItem
    } else {
      nextItems.push(nextItem)
    }

    return {
      ...packList,
      PackingListPackageOrderItems: nextItems,
    }
  })

  return {
    ...invoice,
    PackingLists: nextPackLists,
  }
}

function createInvoiceOrderItem(orderItem: SupplyOrderItem, qty: number): SupplyInvoiceOrderItem {
  return {
    Product: orderItem.Product || null,
    ProductIsImported: true,
    Qty: qty,
    SupplyOrderItem: orderItem,
    TotalAmount: (orderItem.UnitPrice || 0) * qty,
    UnitPrice: orderItem.UnitPrice,
  }
}

function updateInvoiceOrderItemQty(item: SupplyInvoiceOrderItem, qty: number): SupplyInvoiceOrderItem {
  const unitPrice = item.UnitPrice ?? item.SupplyOrderItem?.UnitPrice

  return {
    ...item,
    Product: getInvoiceItemProduct(item) || null,
    Qty: roundQuantity(qty),
    SupplyOrderItem: item.SupplyOrderItem || null,
    TotalAmount: typeof unitPrice === 'number' ? unitPrice * qty : item.TotalAmount,
    UnitPrice: unitPrice,
  }
}

function createPackListOrderItem(invoiceItem: SupplyInvoiceOrderItem, qty: number): PackingListPackageOrderItem {
  return {
    ProductIsImported: invoiceItem.ProductIsImported,
    Qty: qty,
    SupplyInvoiceOrderItem: invoiceItem,
    SupplyInvoiceOrderItemId: invoiceItem.Id,
    TotalGrossPrice: (invoiceItem.UnitPrice || 0) * qty,
    TotalNetPrice: (invoiceItem.UnitPrice || 0) * qty,
    UnitPrice: invoiceItem.UnitPrice,
  }
}

function createInvoiceMetadataForm(invoice: SupplyInvoice): InvoiceMetadataForm {
  return {
    dateFrom: formatDateTimeInput(invoice.DateFrom ? new Date(invoice.DateFrom) : new Date()),
    deliveryAmount: toNumberInputValue(invoice.DeliveryAmount),
    discountAmount: toNumberInputValue(invoice.DiscountAmount),
    documents: (invoice.InvoiceDocuments || []).map((document) => ({ ...document })),
    files: [],
    number: invoice.Number || '',
  }
}

function createInvoiceMetadataPayload(invoice: SupplyInvoice, form: InvoiceMetadataForm): SupplyInvoice {
  return {
    ...stripEntityGraph(invoice),
    DateFrom: normalizeDateTimeInput(form.dateFrom),
    DeliveryAmount: toAmountNumber(form.deliveryAmount),
    DiscountAmount: toAmountNumber(form.discountAmount),
    InformationDeliveryProtocols: invoice.InformationDeliveryProtocols || [],
    InvoiceDocuments: form.documents,
    Number: form.number.trim(),
    PackingLists: invoice.PackingLists || [],
    PaymentDeliveryProtocols: invoice.PaymentDeliveryProtocols || [],
    SupplyInvoiceDeliveryDocuments: invoice.SupplyInvoiceDeliveryDocuments || [],
    SupplyInvoiceOrderItems: invoice.SupplyInvoiceOrderItems || [],
    SupplyOrder: null,
  }
}

function createInvoiceProtocolsPayload(invoice: SupplyInvoice): SupplyInvoice {
  return {
    ...stripEntityGraph(invoice),
    InformationDeliveryProtocols: sanitizeInformationDeliveryProtocols(invoice),
    InvoiceDocuments: invoice.InvoiceDocuments || [],
    PackingLists: invoice.PackingLists || [],
    PaymentDeliveryProtocols: sanitizePaymentDeliveryProtocols(invoice),
    SupplyInvoiceDeliveryDocuments: invoice.SupplyInvoiceDeliveryDocuments || [],
    SupplyInvoiceOrderItems: invoice.SupplyInvoiceOrderItems || [],
    SupplyOrder: null,
  }
}

function sanitizePaymentDeliveryProtocols(invoice: SupplyInvoice): SupplyOrderPaymentDeliveryProtocol[] {
  return (invoice.PaymentDeliveryProtocols || []).map((protocol) => {
    const key = protocol.SupplyOrderPaymentDeliveryProtocolKey || null
    const task = protocol.SupplyPaymentTask || null
    const user = task?.User || protocol.User || null
    const value = protocol.Value || 0

    return {
      ...stripEntityGraph(protocol),
      IsAccounting: Boolean(protocol.IsAccounting),
      SupplyInvoiceId: protocol.SupplyInvoiceId || invoice.Id,
      SupplyOrderPaymentDeliveryProtocolKey: key,
      SupplyOrderPaymentDeliveryProtocolKeyId: protocol.SupplyOrderPaymentDeliveryProtocolKeyId || key?.Id,
      SupplyPaymentTask: task
        ? {
            ...stripEntityGraph(task),
            GrossPrice: task.GrossPrice ?? value,
            IsAccounting: protocol.IsAccounting ?? task.IsAccounting,
            NetPrice: task.NetPrice ?? value,
            User: user,
            UserId: task.UserId || user?.Id,
          }
        : null,
      SupplyPaymentTaskId: protocol.SupplyPaymentTaskId || task?.Id,
      User: protocol.User || user,
      UserId: protocol.UserId || user?.Id,
      Value: value,
    }
  })
}

function sanitizeInformationDeliveryProtocols(invoice: SupplyInvoice): SupplyInformationDeliveryProtocol[] {
  return (invoice.InformationDeliveryProtocols || []).map((protocol) => {
    const key = protocol.SupplyInformationDeliveryProtocolKey || null
    const user = protocol.User || null

    return {
      ...stripEntityGraph(protocol),
      Created: protocol.Created || invoice.DateFrom || new Date().toISOString(),
      SupplyInformationDeliveryProtocolKey: key,
      SupplyInformationDeliveryProtocolKeyId: protocol.SupplyInformationDeliveryProtocolKeyId || key?.Id,
      SupplyInvoiceId: protocol.SupplyInvoiceId || invoice.Id,
      User: user,
      UserId: protocol.UserId || user?.Id,
      Value: protocol.Value || '0',
    }
  })
}

function createEmptyPaymentProtocolDraft(
  keys: SupplyOrderPaymentDeliveryProtocolKey[],
  users: User[],
): PaymentProtocolDraft {
  const key = keys[0] || null
  const user = users[0] || null

  return {
    amount: '',
    comment: '',
    discount: '',
    isAccounting: false,
    keyId: toSelectValue(key),
    keyText: key?.Key || '',
    payToDate: formatDateInput(new Date()),
    userId: toSelectValue(user),
  }
}

function createPaymentProtocolDraft(
  protocol: SupplyOrderPaymentDeliveryProtocol,
  keys: SupplyOrderPaymentDeliveryProtocolKey[],
  users: User[],
): PaymentProtocolDraft {
  const key = protocol.SupplyOrderPaymentDeliveryProtocolKey
  const user = protocol.SupplyPaymentTask?.User || protocol.User || null
  const keyId = toSelectValue(key)
  const userId = toSelectValue(user)

  return {
    amount: toNumberInputValue(protocol.Value),
    comment: protocol.SupplyPaymentTask?.Comment || '',
    discount: toNumberInputValue(protocol.Discount),
    isAccounting: Boolean(protocol.IsAccounting),
    keyId: keyId && keys.some((item) => toSelectValue(item) === keyId) ? keyId : null,
    keyText: key?.Key || '',
    payToDate: formatDateInput(protocol.SupplyPaymentTask?.PayToDate ? new Date(protocol.SupplyPaymentTask.PayToDate) : new Date()),
    userId: userId && users.some((item) => toSelectValue(item) === userId) ? userId : null,
  }
}

function createEmptyInformationProtocolDraft(
  keys: SupplyInformationDeliveryProtocolKey[],
  users: User[],
): InformationProtocolDraft {
  const key = keys[0] || null
  const user = users[0] || null

  return {
    keyId: toSelectValue(key),
    keyText: key?.Key || '',
    userId: toSelectValue(user),
    value: '',
  }
}

function createInformationProtocolDraft(
  protocol: SupplyInformationDeliveryProtocol,
  keys: SupplyInformationDeliveryProtocolKey[],
  users: User[],
): InformationProtocolDraft {
  const key = protocol.SupplyInformationDeliveryProtocolKey
  const user = protocol.User || null
  const keyId = toSelectValue(key)
  const userId = toSelectValue(user)

  return {
    keyId: keyId && keys.some((item) => toSelectValue(item) === keyId) ? keyId : null,
    keyText: key?.Key || '',
    userId: userId && users.some((item) => toSelectValue(item) === userId) ? userId : null,
    value: toNumberInputValue(Number(protocol.Value || 0)),
  }
}

function upsertPaymentProtocol(
  invoice: SupplyInvoice,
  draft: PaymentProtocolDraft,
  options: {
    key: SupplyOrderPaymentDeliveryProtocolKey
    protocolIndex: number | null
    user: User
  },
): SupplyInvoice {
  const existingProtocols = invoice.PaymentDeliveryProtocols || []
  const protocol = options.protocolIndex === null ? null : existingProtocols[options.protocolIndex] || null
  const value = toAmountNumber(draft.amount)
  const nextProtocol: SupplyOrderPaymentDeliveryProtocol = {
    ...(protocol || {}),
    Deleted: false,
    Discount: toAmountNumber(draft.discount),
    IsAccounting: draft.isAccounting,
    SupplyInvoiceId: invoice.Id,
    SupplyOrderPaymentDeliveryProtocolKey: options.key,
    SupplyOrderPaymentDeliveryProtocolKeyId: options.key.Id,
    SupplyPaymentTask: {
      ...(protocol?.SupplyPaymentTask || {}),
      Comment: draft.comment.trim(),
      Deleted: false,
      GrossPrice: value,
      IsAccounting: draft.isAccounting,
      NetPrice: value,
      PayToDate: normalizeDateInput(draft.payToDate),
      User: options.user,
      UserId: options.user.Id,
    },
    User: options.user,
    UserId: options.user.Id,
    Value: value,
  }
  const nextProtocols = [...existingProtocols]

  if (options.protocolIndex === null) {
    nextProtocols.push(nextProtocol)
  } else {
    nextProtocols[options.protocolIndex] = nextProtocol
  }

  return {
    ...invoice,
    PaymentDeliveryProtocols: nextProtocols,
  }
}

function upsertInformationProtocol(
  invoice: SupplyInvoice,
  draft: InformationProtocolDraft,
  options: {
    key: SupplyInformationDeliveryProtocolKey
    protocolIndex: number | null
    user: User
  },
): SupplyInvoice {
  const existingProtocols = invoice.InformationDeliveryProtocols || []
  const protocol = options.protocolIndex === null ? null : existingProtocols[options.protocolIndex] || null
  const nextProtocol: SupplyInformationDeliveryProtocol = {
    ...(protocol || {}),
    Created: protocol?.Created || invoice.DateFrom || new Date().toISOString(),
    Deleted: false,
    IsDefault: protocol?.IsDefault || false,
    SupplyInformationDeliveryProtocolKey: options.key,
    SupplyInformationDeliveryProtocolKeyId: options.key.Id,
    SupplyInvoiceId: invoice.Id,
    User: options.user,
    UserId: options.user.Id,
    Value: String(toAmountNumber(draft.value)),
  }
  const nextProtocols = [...existingProtocols]

  if (options.protocolIndex === null) {
    nextProtocols.push(nextProtocol)
  } else {
    nextProtocols[options.protocolIndex] = nextProtocol
  }

  return {
    ...invoice,
    InformationDeliveryProtocols: nextProtocols,
  }
}

function markPaymentProtocolDeleted(invoice: SupplyInvoice, protocolIndex: number): SupplyInvoice {
  const nextProtocols = [...(invoice.PaymentDeliveryProtocols || [])]
  const protocol = nextProtocols[protocolIndex]

  if (!protocol) {
    return invoice
  }

  if (!protocol.Id && !protocol.NetUid) {
    nextProtocols.splice(protocolIndex, 1)
  } else {
    nextProtocols[protocolIndex] = {
      ...protocol,
      Deleted: true,
      SupplyPaymentTask: protocol.SupplyPaymentTask
        ? { ...protocol.SupplyPaymentTask, Deleted: true }
        : protocol.SupplyPaymentTask,
    }
  }

  return {
    ...invoice,
    PaymentDeliveryProtocols: nextProtocols,
  }
}

function markInformationProtocolDeleted(invoice: SupplyInvoice, protocolIndex: number): SupplyInvoice {
  const nextProtocols = [...(invoice.InformationDeliveryProtocols || [])]
  const protocol = nextProtocols[protocolIndex]

  if (!protocol) {
    return invoice
  }

  if (!protocol.Id && !protocol.NetUid) {
    nextProtocols.splice(protocolIndex, 1)
  } else {
    nextProtocols[protocolIndex] = { ...protocol, Deleted: true }
  }

  return {
    ...invoice,
    InformationDeliveryProtocols: nextProtocols,
  }
}

function getPaymentProtocolValidationMessage(draft: PaymentProtocolDraft): string | null {
  if (!draft.keyText.trim()) {
    return 'Вкажіть форму оплати'
  }

  if (!toAmountNumber(draft.amount)) {
    return 'Вкажіть суму'
  }

  if (!draft.payToDate) {
    return 'Вкажіть дату оплати'
  }

  if (!draft.userId) {
    return 'Оберіть відповідального'
  }

  return null
}

function getInformationProtocolValidationMessage(draft: InformationProtocolDraft): string | null {
  if (!draft.keyText.trim()) {
    return 'Вкажіть назву протоколу'
  }

  if (!draft.userId) {
    return 'Оберіть відповідального'
  }

  return null
}

function getPaymentProtocolKeyFromDraft(
  draft: PaymentProtocolDraft,
  keys: SupplyOrderPaymentDeliveryProtocolKey[],
): SupplyOrderPaymentDeliveryProtocolKey {
  const key = findEntityBySelectValue(keys, draft.keyId)

  return key || { Key: draft.keyText.trim() }
}

function getInformationProtocolKeyFromDraft(
  draft: InformationProtocolDraft,
  keys: SupplyInformationDeliveryProtocolKey[],
): SupplyInformationDeliveryProtocolKey {
  const key = findEntityBySelectValue(keys, draft.keyId)

  return key || { Key: draft.keyText.trim() }
}

function getUserFromDraft(userId: string | null, users: User[]): User {
  return findEntityBySelectValue(users, userId) || {}
}

function getActivePaymentProtocolRows(invoice: SupplyInvoice | null): Array<{ index: number, protocol: SupplyOrderPaymentDeliveryProtocol }> {
  return (invoice?.PaymentDeliveryProtocols || []).reduce<Array<{ index: number, protocol: SupplyOrderPaymentDeliveryProtocol }>>(
    (rows, protocol, index) => {
      if (!protocol.Deleted) {
        rows.push({ index, protocol })
      }

      return rows
    },
    [],
  )
}

function getActiveInformationProtocolRows(invoice: SupplyInvoice | null): Array<{ index: number, protocol: SupplyInformationDeliveryProtocol }> {
  return (invoice?.InformationDeliveryProtocols || []).reduce<Array<{ index: number, protocol: SupplyInformationDeliveryProtocol }>>(
    (rows, protocol, index) => {
      if (!protocol.Deleted) {
        rows.push({ index, protocol })
      }

      return rows
    },
    [],
  )
}

function getPaymentProtocolKeyText(protocol: SupplyOrderPaymentDeliveryProtocol): string {
  return protocol.SupplyOrderPaymentDeliveryProtocolKey?.Key || '-'
}

function getInformationProtocolKeyText(protocol: SupplyInformationDeliveryProtocol): string {
  return protocol.SupplyInformationDeliveryProtocolKey?.Key || '-'
}

function getProtocolRowKey(protocol: EntityFields, index: number): string {
  return protocol.NetUid || String(protocol.Id || index)
}

function toSelectOptions<T extends EntityFields>(
  items: T[],
  getLabel: (item: T) => string,
): SelectOption[] {
  return items.reduce<SelectOption[]>((options, item) => {
    const value = toSelectValue(item)

    if (value) {
      options.push({ label: getLabel(item), value })
    }

    return options
  }, [])
}

function findEntityBySelectValue<T extends EntityFields>(items: T[], value: string | null): T | null {
  if (!value) {
    return null
  }

  return items.find((item) => toSelectValue(item) === value) || null
}

function toSelectValue(entity?: EntityFields | null): string | null {
  if (entity?.NetUid) {
    return `net-${entity.NetUid}`
  }

  if (entity?.Id) {
    return `id-${entity.Id}`
  }

  return null
}

function createPackListMetadataForm(packList: PackingList | null): PackListMetadataForm {
  return {
    comment: packList?.Comment || '',
    dateFrom: formatDateTimeInput(packList?.FromDate ? new Date(packList.FromDate) : new Date()),
    documents: (packList?.InvoiceDocuments || []).map((document) => ({ ...document })),
    files: [],
    invNo: packList?.InvNo || '',
    markNumber: packList?.MarkNumber || '',
    no: packList?.No || '',
    plNo: packList?.PlNo || '',
    refNo: packList?.RefNo || '',
  }
}

function createPackListMetadataDraft(
  source: PackingList | null | undefined,
  form: PackListMetadataForm,
): PackingList {
  return {
    ...(source || {}),
    Comment: form.comment.trim(),
    FromDate: normalizeDateTimeInput(form.dateFrom),
    InvNo: form.invNo.trim(),
    InvoiceDocuments: form.documents,
    MarkNumber: form.markNumber.trim(),
    No: form.no.trim(),
    PackingListBoxes: source?.PackingListBoxes || [],
    PackingListPackageOrderItems: source?.PackingListPackageOrderItems || [],
    PackingListPallets: source?.PackingListPallets || [],
    PlNo: form.plNo.trim(),
    RefNo: form.refNo.trim(),
  }
}

function createNewInvoiceDocuments(files: File[]): SupplyInvoiceDeliveryDocument[] {
  return files.map((file) => ({
    ContentType: file.type,
    Deleted: false,
    FileName: file.name,
  }))
}

function upsertPackListMetadata(invoice: SupplyInvoice, packList: PackingList): SupplyInvoice {
  const packLists = invoice.PackingLists || []
  const index = packLists.findIndex((item) => isSameEntity(item, packList))
  const nextPackLists = [...packLists]

  if (index >= 0) {
    nextPackLists[index] = {
      ...nextPackLists[index],
      ...packList,
    }
  } else {
    nextPackLists.push(packList)
  }

  return {
    ...invoice,
    PackingLists: nextPackLists,
  }
}

function findSavedPackList(invoice: SupplyInvoice, draft: PackingList): PackingList | null {
  const packLists = invoice.PackingLists || []

  return (
    packLists.find((packList) => isSameEntity(packList, draft))
    || findUniquePackListByField(packLists, 'InvNo', draft.InvNo)
    || findUniquePackListByField(packLists, 'No', draft.No)
    || null
  )
}

function findUniquePackListByField(
  packLists: PackingList[],
  field: 'InvNo' | 'No',
  value?: string | null,
): PackingList | null {
  if (!value) {
    return null
  }

  const matches = packLists.filter((packList) => packList[field] === value)
  return matches.length === 1 ? matches[0] : null
}

function updatePackListOrderItemQty(
  item: PackingListPackageOrderItem,
  qty: number,
): PackingListPackageOrderItem {
  const unitPrice = item.UnitPrice ?? item.SupplyInvoiceOrderItem?.UnitPrice

  return {
    ...item,
    Qty: roundQuantity(qty),
    SupplyInvoiceOrderItem: item.SupplyInvoiceOrderItem || null,
    TotalGrossPrice: typeof unitPrice === 'number' ? unitPrice * qty : item.TotalGrossPrice,
    TotalNetPrice: typeof unitPrice === 'number' ? unitPrice * qty : item.TotalNetPrice,
    UnitPrice: unitPrice,
  }
}

function toSupplyInvoiceItemsPayload(invoice: SupplyInvoice): SupplyInvoice {
  return {
    ...stripEntityGraph(invoice),
    PackingLists: [],
    SupplyInvoiceDeliveryDocuments: invoice.SupplyInvoiceDeliveryDocuments || [],
    SupplyInvoiceOrderItems: sanitizeSupplyInvoiceOrderItems(invoice),
    SupplyOrder: null,
  }
}

function sanitizeSupplyInvoiceOrderItems(invoice: SupplyInvoice): SupplyInvoiceOrderItem[] {
  const sanitizedItems: SupplyInvoiceOrderItem[] = []

  for (const [index, item] of (invoice.SupplyInvoiceOrderItems || []).entries()) {
    if (!item.SupplyOrderItem) {
      continue
    }

    const product = getInvoiceItemProduct(item)
    const supplyOrderItem = item.SupplyOrderItem ? stripEntityGraph(item.SupplyOrderItem) : null

    sanitizedItems.push({
      ...stripEntityGraph(item),
      PackingListPackageOrderItems: [],
      Product: product || null,
      ProductId: item.ProductId || product?.Id,
      ProductIsImported: item.ProductIsImported ?? true,
      Qty: item.Qty || 0,
      RowNumber: item.RowNumber || index + 1,
      SupplyInvoice: null,
      SupplyInvoiceId: item.SupplyInvoiceId || invoice.Id,
      SupplyOrderItem: supplyOrderItem,
      SupplyOrderItemId: item.SupplyOrderItemId || supplyOrderItem?.Id,
      TotalAmount: item.TotalAmount,
      UnitPrice: item.UnitPrice ?? item.SupplyOrderItem?.UnitPrice,
    })
  }

  return sanitizedItems
}

function toPackingListsPayload(invoice: SupplyInvoice): SupplyInvoice {
  return {
    ...stripEntityGraph(invoice),
    PackingLists: (invoice.PackingLists || []).map((packList) => ({
      ...stripEntityGraph(packList),
      DynamicProductPlacementColumns: packList.DynamicProductPlacementColumns || [],
      InvoiceDocuments: packList.InvoiceDocuments || [],
      MergedPackingLists: [],
      PackingListBoxes: sanitizePackingListPackages(packList.PackingListBoxes),
      PackingListPackageOrderItems: sanitizePackListItems(packList.PackingListPackageOrderItems || []),
      PackingListPackages: sanitizePackingListPackages(packList.PackingListPackages),
      PackingListPallets: sanitizePackingListPackages(packList.PackingListPallets),
    })),
    SupplyInvoiceDeliveryDocuments: invoice.SupplyInvoiceDeliveryDocuments || [],
    SupplyInvoiceOrderItems: [],
    SupplyOrder: null,
  }
}

function sanitizePackingListPackages(packages: PackingList['PackingListPackages']): PackingList['PackingListPackages'] {
  return (packages || []).map((itemPackage) => ({
    ...stripEntityGraph(itemPackage),
    PackingListPackageOrderItems: sanitizePackListItems(itemPackage.PackingListPackageOrderItems || []),
  }))
}

function sanitizePackListItems(items: PackingListPackageOrderItem[]): PackingListPackageOrderItem[] {
  const sanitizedItems: PackingListPackageOrderItem[] = []

  for (const item of items) {
    if (!item.SupplyInvoiceOrderItem) {
      continue
    }

    sanitizedItems.push({
      ...stripEntityGraph(item),
      PackingList: null,
      PackingListPackageOrderItemSupplyServices: item.PackingListPackageOrderItemSupplyServices || [],
      Qty: item.Qty || 0,
      SupplyInvoiceOrderItem: item.SupplyInvoiceOrderItem
        ? sanitizeSupplyInvoiceOrderItemReference(item.SupplyInvoiceOrderItem)
        : null,
      SupplyInvoiceOrderItemId: item.SupplyInvoiceOrderItemId || item.SupplyInvoiceOrderItem?.Id,
    })
  }

  return sanitizedItems
}

function sanitizeSupplyInvoiceOrderItemReference(item: SupplyInvoiceOrderItem): SupplyInvoiceOrderItem {
  return {
    ...stripEntityGraph(item),
    PackingListPackageOrderItems: [],
    Product: getInvoiceItemProduct(item) || null,
    SupplyInvoice: null,
    SupplyOrderItem: item.SupplyOrderItem ? stripEntityGraph(item.SupplyOrderItem) : null,
  }
}

function mergeInvoiceDetails(
  current: Record<string, SupplyInvoice>,
  invoices: Array<SupplyInvoice | null>,
): Record<string, SupplyInvoice> {
  return invoices.reduce<Record<string, SupplyInvoice>>((result, invoice) => {
    if (invoice?.NetUid) {
      result[invoice.NetUid] = invoice
    }

    return result
  }, { ...current })
}

function stripEntityGraph<T extends object>(entity: T): T {
  const result = { ...entity } as Record<string, unknown>

  delete result.SupplyOrder
  delete result.SupplyInvoice
  delete result.PackingList
  delete result.PackingListPackage

  return result as T
}

function isInvoiceItemForOrderItem(invoiceItem: SupplyInvoiceOrderItem, orderItem: SupplyOrderItem): boolean {
  const invoiceOrderKey = getInvoiceOrderItemOrderKey(invoiceItem)
  const orderKey = getSupplyOrderItemKey(orderItem)

  if (invoiceOrderKey && orderKey && invoiceOrderKey === orderKey) {
    return true
  }

  return getProductKey(getInvoiceItemProduct(invoiceItem)) === getProductKey(orderItem.Product)
}

function isPackListItemForInvoiceItem(
  packListItem: PackingListPackageOrderItem,
  invoiceItem: SupplyInvoiceOrderItem,
): boolean {
  const packListInvoiceKey = getPackingListInvoiceItemKey(packListItem)
  const invoiceKey = getSupplyInvoiceItemKey(invoiceItem)

  if (packListInvoiceKey && invoiceKey && packListInvoiceKey === invoiceKey) {
    return true
  }

  return getProductKey(packListItem.SupplyInvoiceOrderItem?.Product) === getProductKey(getInvoiceItemProduct(invoiceItem))
}

function getInvoiceOrderItemOrderKey(item: SupplyInvoiceOrderItem): string {
  if (item.SupplyOrderItem?.NetUid) {
    return `order-net-${item.SupplyOrderItem.NetUid}`
  }

  if (item.SupplyOrderItem?.Id) {
    return `order-id-${item.SupplyOrderItem.Id}`
  }

  if (item.SupplyOrderItemId) {
    return `order-id-${item.SupplyOrderItemId}`
  }

  return getProductKey(getInvoiceItemProduct(item))
}

function getSupplyOrderItemKey(item: SupplyOrderItem): string {
  if (item.NetUid) {
    return `order-net-${item.NetUid}`
  }

  if (item.Id) {
    return `order-id-${item.Id}`
  }

  return getProductKey(item.Product)
}

function getSupplyInvoiceItemKey(item: SupplyInvoiceOrderItem): string {
  if (item.NetUid) {
    return `invoice-net-${item.NetUid}`
  }

  if (item.Id) {
    return `invoice-id-${item.Id}`
  }

  return getProductKey(getInvoiceItemProduct(item))
}

function getPackingListInvoiceItemKey(item: PackingListPackageOrderItem): string {
  if (item.SupplyInvoiceOrderItem?.NetUid) {
    return `invoice-net-${item.SupplyInvoiceOrderItem.NetUid}`
  }

  if (item.SupplyInvoiceOrderItem?.Id) {
    return `invoice-id-${item.SupplyInvoiceOrderItem.Id}`
  }

  if (item.SupplyInvoiceOrderItemId) {
    return `invoice-id-${item.SupplyInvoiceOrderItemId}`
  }

  return getProductKey(item.SupplyInvoiceOrderItem?.Product)
}

function getPackingListPackageOrderItemKey(item: PackingListPackageOrderItem): string {
  if (item.NetUid) {
    return `pack-item-net-${item.NetUid}`
  }

  if (item.Id) {
    return `pack-item-id-${item.Id}`
  }

  return getPackingListInvoiceItemKey(item)
}

function getInvoiceOrderItemRowId(item: SupplyInvoiceOrderItem, index: number): string {
  return item.NetUid || getInvoiceOrderItemOrderKey(item) || `invoice-row-${index}`
}

function getPackListOrderItemRowId(item: PackingListPackageOrderItem, index: number): string {
  return item.NetUid || getPackingListInvoiceItemKey(item) || `pack-list-row-${index}`
}

function getInvoiceItemProduct(item: SupplyInvoiceOrderItem) {
  return item.Product || item.SupplyOrderItem?.Product || null
}

function getProductKey(product: SupplyOrderItem['Product']): string {
  if (product?.NetUid) {
    return `product-net-${product.NetUid}`
  }

  if (product?.Id) {
    return `product-id-${product.Id}`
  }

  if (product?.VendorCode) {
    return `product-code-${product.VendorCode}`
  }

  return ''
}

function isSameEntity(left: PackingList, right: PackingList): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (left.Id && right.Id) {
    return left.Id === right.Id
  }

  return left === right
}

function toNonNegativeNumber(value: number | string): number {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0
}

function toNonNegativeAmount(value: number | string): NumberFieldValue {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : ''
}

function toAmountNumber(value: NumberFieldValue): number {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0
}

function toNumberInputValue(value?: number): number | '' {
  return typeof value === 'number' && Number.isFinite(value) ? value : ''
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

function isZeroQuantity(value: number): boolean {
  return Math.abs(value) < 0.0005
}

function sumRows<T extends QuantityBalanceRow, K extends 'actualQty' | 'expectedQty'>(
  rows: T[],
  key: K,
): number {
  return roundQuantity(rows.reduce((total, row) => total + row[key], 0))
}

function countPackingListItems(invoice: SupplyInvoice): number {
  return (invoice.PackingLists || []).reduce(
    (total, packList) => total + (packList.PackingListPackageOrderItems?.length || 0),
    0,
  )
}

function sumPackingListQty(invoice: SupplyInvoice): number {
  return (invoice.PackingLists || []).reduce(
    (total, packList) => total + (packList.PackingListPackageOrderItems || []).reduce(
      (packListTotal, item) => packListTotal + (item.Qty || 0),
      0,
    ),
    0,
  )
}

function getActiveInvoiceDocuments(documents: SupplyInvoiceDeliveryDocument[]): SupplyInvoiceDeliveryDocument[] {
  return documents.filter((document) => !document.Deleted)
}

function getDocumentUrl(document: SupplyInvoiceDeliveryDocument): string {
  return document.DocumentUrl || document.Url || ''
}

function removePendingFile(files: File[], document: SupplyInvoiceDeliveryDocument): File[] {
  const fileName = document.FileName

  if (!fileName) {
    return files
  }

  return files.filter((file) => file.name !== fileName)
}

function TotalsBadges({ totals }: { totals: SupplyOrderInvoiceTotals }) {
  const { t } = useI18n()
  const entries = Object.entries(totals).filter(([, value]) => typeof value === 'number' || typeof value === 'string')

  if (entries.length === 0) {
    return null
  }

  return (
    <Group gap="xs">
      {entries.slice(0, 6).map(([key, value]) => (
        <Badge key={key} color="gray" variant="light">
          {t(key)}: {String(value)}
        </Badge>
      ))}
    </Group>
  )
}

function TotalCard({ label, value }: { label: string, value: string }) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap={2}>
        <Text c="dimmed" size="xs">{label}</Text>
        <Text fw={700} size="lg">{value}</Text>
      </Stack>
    </Card>
  )
}

function toInvoiceParseConfiguration(form: InvoiceUploadForm): SupplyOrderDocumentParseConfiguration | null {
  if (!hasRequiredNumbers(form) || form.startRow > form.endRow) {
    return null
  }

  if (form.withTotalAmount && !form.totalAmountColumnNumber) {
    return null
  }

  if (!form.withTotalAmount && !form.unitPriceColumnNumber) {
    return null
  }

  return {
    EndRow: form.endRow,
    GrossWeightColumnNumber: 0,
    IsWeightPerUnit: false,
    NetWeightColumnNumber: 0,
    ProductIsImported: form.productIsImported,
    QtyColumnNumber: form.qtyColumnNumber,
    StartRow: form.startRow,
    TotalAmountColumnNumber: form.withTotalAmount ? Number(form.totalAmountColumnNumber) : 0,
    UnitPriceColumnNumber: form.withTotalAmount ? 0 : Number(form.unitPriceColumnNumber),
    VendorCodeColumnNumber: form.vendorCodeColumnNumber,
    WithGrossWeight: false,
    WithNetWeight: false,
    WithTotalAmount: form.withTotalAmount,
  }
}

function toPackListParseConfiguration(form: PackListUploadForm): PackingListDocumentParseConfiguration | null {
  if (
    !form.vendorCodeColumnNumber
    || !form.qtyColumnNumber
    || !form.startRow
    || !form.endRow
    || !form.unitPriceColumnNumber
    || !form.netWeightColumnNumber
    || !form.grossWeightColumnNumber
    || form.startRow > form.endRow
  ) {
    return null
  }

  return {
    EndRow: Number(form.endRow),
    GrossWeightColumnNumber: Number(form.grossWeightColumnNumber),
    IsWeightPerUnit: form.isWeightPerUnit,
    NetWeightColumnNumber: Number(form.netWeightColumnNumber),
    QtyColumnNumber: Number(form.qtyColumnNumber),
    StartRow: Number(form.startRow),
    TotalAmountColumnNumber: 0,
    UnitPriceColumnNumber: Number(form.unitPriceColumnNumber),
    VendorCodeColumnNumber: Number(form.vendorCodeColumnNumber),
    WithGrossWeight: true,
    WithNetWeight: true,
    WithTotalAmount: false,
  }
}

function getInvoiceUploadValidationMessage(form: InvoiceUploadForm): string | null {
  if (!form.file || !isExcelFile(form.file)) {
    return 'Оберіть Excel файл'
  }

  if (!form.number.trim()) {
    return 'Вкажіть номер інвойсу'
  }

  if (!hasRequiredNumbers(form)) {
    return 'Заповніть обовʼязкові колонки імпорту'
  }

  if (form.startRow > form.endRow) {
    return 'Кінцевий рядок не може бути меншим за початковий'
  }

  if (form.withTotalAmount && !form.totalAmountColumnNumber) {
    return 'Вкажіть колонку суми'
  }

  if (!form.withTotalAmount && !form.unitPriceColumnNumber) {
    return 'Вкажіть колонку ціни'
  }

  if (hasDuplicatePositiveNumbers([
    form.vendorCodeColumnNumber,
    form.qtyColumnNumber,
    form.withTotalAmount ? form.totalAmountColumnNumber : form.unitPriceColumnNumber,
  ])) {
    return 'Одна колонка не може використовуватись для кількох значень'
  }

  return null
}

function getInvoiceMetadataValidationMessage(form: InvoiceMetadataForm, invoice: SupplyInvoice): string | null {
  if (!form.number.trim()) {
    return 'Вкажіть номер інвойсу'
  }

  if (!form.dateFrom) {
    return 'Вкажіть дату інвойсу'
  }

  const deliveryAmount = toAmountNumber(form.deliveryAmount)
  const discountAmount = toAmountNumber(form.discountAmount)
  const invoiceNetPrice = invoice.NetPrice || invoice.TotalNetPrice || 0

  if (discountAmount > invoiceNetPrice + deliveryAmount) {
    return 'Некоректна сума знижки'
  }

  return null
}

function getPackListUploadValidationMessage(form: PackListUploadForm): string | null {
  if (!form.file || !isExcelFile(form.file)) {
    return 'Оберіть Excel файл'
  }

  if (!form.number.trim()) {
    return 'Вкажіть номер пак листа'
  }

  if (
    !form.vendorCodeColumnNumber
    || !form.qtyColumnNumber
    || !form.startRow
    || !form.endRow
    || !form.unitPriceColumnNumber
    || !form.netWeightColumnNumber
    || !form.grossWeightColumnNumber
  ) {
    return 'Заповніть обовʼязкові колонки імпорту'
  }

  if (form.startRow > form.endRow) {
    return 'Кінцевий рядок не може бути меншим за початковий'
  }

  if (hasDuplicatePositiveNumbers([
    form.vendorCodeColumnNumber,
    form.qtyColumnNumber,
    form.unitPriceColumnNumber,
    form.netWeightColumnNumber,
    form.grossWeightColumnNumber,
  ])) {
    return 'Одна колонка не може використовуватись для кількох значень'
  }

  return null
}

function isExcelFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase()

  return extension === 'xls' || extension === 'xlsx'
}

function hasDuplicatePositiveNumbers(values: NumberFieldValue[]): boolean {
  const numbers = new Set<number>()

  for (const value of values) {
    const numberValue = typeof value === 'number' ? value : Number(value)

    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      continue
    }

    if (numbers.has(numberValue)) {
      return true
    }

    numbers.add(numberValue)
  }

  return false
}

function hasRequiredNumbers(form: InvoiceUploadForm): form is InvoiceUploadForm & {
  endRow: number
  qtyColumnNumber: number
  startRow: number
  vendorCodeColumnNumber: number
} {
  return Boolean(form.vendorCodeColumnNumber && form.qtyColumnNumber && form.startRow && form.endRow)
}

function toPositiveNumber(value: number | string): NumberFieldValue {
  const numberValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : ''
}

function formatDateInput(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeDateInput(value: string): string {
  return value ? `${value}T00:00:00` : ''
}

function formatDateTimeInput(date: Date): string {
  return formatLocalDateTime(date).slice(0, 16)
}

function normalizeDateTimeInput(value: string): string {
  return value.length === 16 ? `${value}:00` : value
}

function getOrderNumber(order: DirectSupplyOrder | null): string {
  return order?.SupplyOrderNumber?.Number ? `№ ${order.SupplyOrderNumber.Number}` : ''
}

function getEntityName(entity?: { FullName?: string, Name?: string } | null): string {
  return entity?.FullName || entity?.Name || '-'
}

function getUserName(user?: User | null): string {
  if (!user) {
    return '-'
  }

  return user.FullName || [user.LastName, user.FirstName, user.MiddleName].filter(Boolean).join(' ') || user.Name || '-'
}

function formatDate(value?: Date | string | null): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateFormatter.format(date)
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : '-'
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '-'
}

function getOrderItemTotal(item: SupplyOrderItem): number | undefined {
  if (typeof item.TotalAmount === 'number') {
    return item.TotalAmount
  }

  if (typeof item.TotalPrice === 'number') {
    return item.TotalPrice
  }

  if (typeof item.UnitPrice === 'number' && typeof item.Qty === 'number') {
    return item.UnitPrice * item.Qty
  }

  return undefined
}
