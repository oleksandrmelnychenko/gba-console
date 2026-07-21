import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { ArrowLeft, CircleAlert, FileInput as FileInputIcon, FileUp, Package, RefreshCw, Save, SquarePen, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState, type CSSProperties, type Dispatch, type SetStateAction, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './supply-order-detail.css'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { formatExcelArticleColumnError } from '../../../shared/excel/excelImportError'
import { useI18n } from '../../../shared/i18n/useI18n'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { EXCEL_FILE_ACCEPT, isExcelFile } from '../excelFiles'
import { getInvoiceAmountBreakdown, getPackingListAmountBreakdown } from '../orderAmountBreakdown'
import { createPackListMetadataSavePlan } from '../packListDocumentSavePlan'
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
  activeTab: string
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
  activeTab: 'products',
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
// The page lives inside the fixed-height console frame: tab panel and card stretch
// to the remaining height so the grid scrolls internally and totals stay pinned.
const PANEL_FILL_STYLE: CSSProperties = { display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }
const CARD_FILL_STYLE = PANEL_FILL_STYLE

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
  const { t } = useI18n()
  const navigate = useNavigate()
  const orderNumber = getOrderNumber(model.order)
  const sheetTitle = orderNumber ? `${t('Інвойси і пак листи')} ${orderNumber}` : t('Інвойси і пак листи')

  return (
    <AppDrawer
      closeOnClickOutside={false}
      opened
      size="full"
      title={<span className="supply-direct-invoices-sheet-title">{sheetTitle}</span>}
      onClose={() => navigate(-1)}
    >
      <SupplyUkraineDirectOrderInvoicesView embedded model={model} />
    </AppDrawer>
  )
}

function useSupplyUkraineDirectOrderInvoicesPageModel() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const [state, setPageState] = useReducer(pageStateReducer, INITIAL_PAGE_STATE)
  const {
    activeTab,
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
  // Show ONLY the selected invoice's own items (legacy contract: each invoice tab
  // click fetches /supplies/invoices/items/get and renders just that invoice).
  const selectedInvoiceItems = useMemo(
    () => selectedInvoice?.SupplyInvoiceOrderItems || [],
    [selectedInvoice],
  )
  const packListBalanceRows = useMemo(
    () => (selectedInvoice ? buildPackListBalanceRows(selectedInvoice) : []),
    [selectedInvoice],
  )
  const packListBalanceByInvoiceItemKey = useMemo(
    () => new Map(packListBalanceRows.map((row) => [row.key, row])),
    [packListBalanceRows],
  )
  // Show ONLY the loaded pack list's own rows (legacy contract) — no zero-qty
  // placeholders for invoice items that were not uploaded into the pack list.
  const selectedPackListItems = useMemo(
    () => selectedPackList?.PackingListPackageOrderItems || [],
    [selectedPackList],
  )
  const hasInvoiceMismatch = invoiceBalanceRows.some((row) => row.isError)
  const hasPackListMismatch = packListBalanceRows.some((row) => row.isError)

  const orderItemColumns = useOrderItemColumns(setProductCardNetId)
  const invoiceItemColumns = useInvoiceItemColumns({
    balanceByOrderItemKey: invoiceBalanceByOrderItemKey,
    onOpenProductCard: setProductCardNetId,
  })
  const packListItemColumns = usePackListItemColumns({
    balanceByInvoiceItemKey: packListBalanceByInvoiceItemKey,
    onOpenProductCard: setProductCardNetId,
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
      if (invoice) {
        mergeUploadedInvoice(invoice)
      }
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: formatExcelArticleColumnError(
          saveError,
          parseConfiguration.VendorCodeColumnNumber,
          t('Не вдалося виконати запит'),
        ),
      })
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
      if (packList) {
        mergeUploadedPackList(selectedInvoice.NetUid, packList)
      }
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: formatExcelArticleColumnError(
          saveError,
          parseConfiguration.VendorCodeColumnNumber,
          t('Не вдалося виконати запит'),
        ),
      })
    } finally {
      setPageState({ isSaving: false })
    }
  }

  function mergeUploadedInvoice(invoice: SupplyInvoice) {
    setPageState((current) => {
      const nextInvoice = invoice.NetUid && current.invoiceDetailsByNetId[invoice.NetUid]
        ? mergeSupplyInvoiceData(current.invoiceDetailsByNetId[invoice.NetUid], invoice)
        : invoice

      return {
        activeTab: 'invoices',
        invoiceDetailsByNetId: nextInvoice.NetUid
          ? { ...current.invoiceDetailsByNetId, [nextInvoice.NetUid]: nextInvoice }
          : current.invoiceDetailsByNetId,
        order: current.order
          ? { ...current.order, SupplyInvoices: upsertInvoice(current.order.SupplyInvoices || [], nextInvoice) }
          : current.order,
        selectedInvoiceNetId: nextInvoice.NetUid || current.selectedInvoiceNetId,
        selectedPackListNetId: getValidPackListNetId(current.selectedPackListNetId, nextInvoice),
      }
    })
  }

  function mergeUploadedPackList(invoiceNetUid: string, packList: PackingList) {
    setPageState((current) => {
      const currentInvoice = getSelectedInvoice(invoiceNetUid, current.invoiceDetailsByNetId, current.order?.SupplyInvoices || [])

      if (!currentInvoice) {
        return {
          activeTab: 'packlists',
          selectedPackListNetId: packList.NetUid || current.selectedPackListNetId,
        }
      }

      const nextInvoice = {
        ...currentInvoice,
        PackingLists: upsertPackList(currentInvoice.PackingLists || [], packList),
      }

      return {
        activeTab: 'packlists',
        invoiceDetailsByNetId: invoiceNetUid
          ? { ...current.invoiceDetailsByNetId, [invoiceNetUid]: nextInvoice }
          : current.invoiceDetailsByNetId,
        order: current.order
          ? { ...current.order, SupplyInvoices: upsertInvoice(current.order.SupplyInvoices || [], nextInvoice) }
          : current.order,
        selectedInvoiceNetId: invoiceNetUid || current.selectedInvoiceNetId,
        selectedPackListNetId: packList.NetUid || current.selectedPackListNetId,
      }
    })
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

    const savePlan = createPackListMetadataSavePlan(
      createPackListMetadataDraft(packListEditor?.packList, form),
    )
    const invoiceForMetadata = upsertPackListMetadata(selectedInvoice, savePlan.metadataDraft)

    setPageState({ isSaving: true })

    try {
      const updatedInvoice = await updatePackingLists(toPackingListsPayload(invoiceForMetadata))
      const invoiceAfterMetadata = updatedInvoice || selectedInvoice
      const savedPackList = findSavedPackList(invoiceAfterMetadata, savePlan.metadataDraft)

      if (form.files.length > 0) {
        if (!savedPackList) {
          throw new Error(t('Не вдалося знайти збережений пак лист для документів'))
        }

        if (savePlan.pendingDocuments.length !== form.files.length) {
          throw new Error(t('Не вдалося зіставити вибрані файли з документами пак листа'))
        }

        await uploadPackingListDocuments({
          ...savedPackList,
          InvoiceDocuments: savePlan.pendingDocuments.map((document) => ({
            ...document,
            PackingListId: savedPackList.Id,
          })),
        }, form.files)
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
    activeTab,
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

function SupplyUkraineDirectOrderInvoicesView({
  embedded = false,
  model,
}: {
  embedded?: boolean
  model: DirectOrderInvoicesPageModel
}) {
  const { t } = useI18n()

  return (
    // Fixed-height flex frame: grids scroll internally, no page-level scroll.
    <Stack gap={embedded ? 6 : 'lg'} h="100%" style={{ minHeight: 0, overflow: 'hidden' }}>
      <DirectOrderInvoicesHeader embedded={embedded} model={model} />
      {model.error && (
        <Alert color="red" icon={<CircleAlert size={18} />} style={{ flexShrink: 0 }} variant="light">
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

function DirectOrderInvoicesHeader({
  embedded = false,
  model,
}: {
  embedded?: boolean
  model: DirectOrderInvoicesPageModel
}) {
  const { t } = useI18n()

  return (
    <header className={`supply-detail-header${embedded ? ' is-sheet' : ''}`}>
      {!embedded && (
        <div className="supply-detail-header-main">
          <Tooltip label={t('Назад')}>
            <ActionIcon
              aria-label={t('Назад')}
              className="supply-detail-back"
              variant="default"
              onClick={model.goBack}
            >
              <ArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <div className="supply-detail-copy">
            <h1 className="supply-detail-title">
              {t('Інвойси і пак листи')}
              {getOrderNumber(model.order) && (
                <span className="supply-detail-number">{getOrderNumber(model.order)}</span>
              )}
            </h1>
          </div>
        </div>
      )}
      <div className="supply-detail-header-actions">
        <Button
          color="gray"
          disabled={model.isSaving || model.isInvoiceLoading}
          leftSection={<RefreshCw size={16} />}
          loading={model.isLoading}
          styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
          variant="light"
          onClick={() => model.reloadOrder()}
        >
          {t('Оновити')}
        </Button>
        {model.canAddInvoice && (
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={model.isBusy}
            leftSection={<FileInputIcon size={16} />}
            loading={model.isSaving}
            styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
            variant="outline"
            onClick={() => model.setPageState({ invoiceUploadOpen: true })}
          >
            {t('Додати інвойс')}
          </Button>
        )}
        {model.canShowPackListUpload && (
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={model.isBusy}
            leftSection={<Package size={16} />}
            loading={model.isSaving}
            styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
            variant="outline"
            onClick={() => model.setPageState({ packListUploadOpen: true })}
          >
            {t('Додати пак лист')}
          </Button>
        )}
      </div>
    </header>
  )
}

function DirectOrderInvoicesBody({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  if (!model.order) {
    return null
  }

  return (
    <Stack gap="lg" style={{ flex: 1, minHeight: 0 }}>
      {/* Controlled: the reload spinner unmounts this subtree, so an uncontrolled
          Tabs would snap back to «Товари замовлення» after add-invoice/pack-list. */}
      <Tabs
        keepMounted={false}
        style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}
        value={model.activeTab}
        onChange={(value) => model.setPageState({ activeTab: value || 'products' })}
      >
        <Tabs.List style={{ flexShrink: 0 }}>
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
  const totalQuantity = model.orderItems.reduce((sum, item) => sum + (typeof item.Qty === 'number' ? item.Qty : 0), 0)
  const totalSum = model.orderItems.reduce((sum, item) => sum + (getOrderItemTotal(item) || 0), 0)

  return (
    <Tabs.Panel style={PANEL_FILL_STYLE} value="products" pt="md">
      <Card className="app-section-card" withBorder radius="md" padding="md" style={CARD_FILL_STYLE}>
        <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
          <Box className="supply-grid-fill" style={{ flex: 1, minHeight: 0 }}>
            <DataTable
              columns={model.orderItemColumns}
              data={model.orderRows}
              emptyText={t('Товарів немає')}
              getRowId={(item, index) => item.NetUid || String(item.Id || index)}
              layoutVersion="supply-direct-order-items-2"
              minWidth={980}
              rowClassName={(item) => item.IsError ? 'data-table-row-warning' : undefined}
              tableId="supply-direct-order-items"
            />
          </Box>
          <SummaryLine
            items={[
              [t('Всього товарів'), formatNumber(model.orderItems.length)],
              [t('Вся кількість'), formatNumber(totalQuantity)],
              [t('Вся сума'), formatMoney(totalSum)],
            ]}
          />
        </Stack>
      </Card>
    </Tabs.Panel>
  )
}

function InvoicesPanel({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Tabs.Panel style={PANEL_FILL_STYLE} value="invoices" pt="md">
      <Card className="app-section-card" withBorder radius="md" padding="md" style={CARD_FILL_STYLE}>
        <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
          <InvoiceSelector model={model} />
          {model.isInvoiceLoading ? (
            <Group justify="center" py="md" style={{ flex: 1 }}><Loader size="sm" /></Group>
          ) : (
            <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
              <QuantityBalanceSummary
                actualLabel={t('В інвойсах')}
                differenceLabel={t('Залишилось')}
                expectedLabel={t('У замовленні')}
                rows={model.invoiceBalanceRows}
              />
              <Box className="supply-grid-fill" style={{ flex: 1, minHeight: 0 }}>
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
              </Box>
            </Stack>
          )}
          {model.selectedInvoice && <InvoiceTotals invoice={model.selectedInvoice} order={model.order} />}
        </Stack>
      </Card>
    </Tabs.Panel>
  )
}

function InvoiceSelector({
  model,
  showDelete = true,
}: {
  model: DirectOrderInvoicesPageModel
  showDelete?: boolean
}) {
  const { t } = useI18n()

  return (
    <Group gap="xs" wrap="wrap">
      {model.invoices.map((invoice) => {
        const currencyCode = getInvoiceCurrencyCode(invoice, model.order)

        return (
          <Group key={invoice.NetUid || invoice.Id} gap={4} wrap="nowrap">
            <Button
              color={invoice.NetUid === model.selectedInvoiceNetId ? CREATE_ACTION_COLOR : 'gray'}
              disabled={model.isBusy}
              styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
              variant={invoice.NetUid === model.selectedInvoiceNetId ? 'light' : 'subtle'}
              onClick={() => {
                const invoiceNetId = invoice.NetUid || null
                const nextInvoice = getSelectedInvoice(invoiceNetId, model.invoiceDetailsByNetId, model.invoices)

                model.setPageState((current) => {
                  // Evict the cached details so every click re-fetches
                  // /supplies/invoices/items/get, like the legacy client.
                  const nextDetails = { ...current.invoiceDetailsByNetId }

                  if (invoiceNetId) {
                    delete nextDetails[invoiceNetId]
                  }

                  return {
                    invoiceDetailsByNetId: nextDetails,
                    selectedInvoiceNetId: invoiceNetId,
                    selectedPackListNetId: getValidPackListNetId(current.selectedPackListNetId, nextInvoice),
                  }
                })
              }}
            >
              {invoice.Number || t('Інвойс')} ({formatDate(invoice.DateFrom)}){currencyCode ? ` ${currencyCode}` : ''}
            </Button>
            {showDelete && model.canRemoveInvoice && (
              <Tooltip label={t('Видалити')}>
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  disabled={model.isBusy}
                  size="xs"
                  variant="subtle"
                  onClick={() => model.setPageState({ deleteInvoiceCandidate: invoice })}
                >
                  <Trash2 size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )
      })}
    </Group>
  )
}

function PackListsPanel({ model }: { model: DirectOrderInvoicesPageModel }) {
  const { t } = useI18n()

  return (
    <Tabs.Panel style={PANEL_FILL_STYLE} value="packlists" pt="md">
      <Card className="app-section-card" withBorder radius="md" padding="md" style={CARD_FILL_STYLE}>
        <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
          {/* Legacy contract: pack lists are bound to an invoice, so the invoice
              selector is available here too (without the delete controls). */}
          <InvoiceSelector model={model} showDelete={false} />
          {model.isInvoiceLoading ? (
            <Group justify="center" py="md" style={{ flex: 1 }}><Loader size="sm" /></Group>
          ) : (
            <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
              <PackListSelector model={model} />
              <QuantityBalanceSummary
                actualLabel={t('У пак листах')}
                differenceLabel={t('Залишилось')}
                expectedLabel={t('В інвойсі')}
                rows={model.packListBalanceRows}
              />
              <Box className="supply-grid-fill" style={{ flex: 1, minHeight: 0 }}>
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
              </Box>
            </Stack>
          )}
          <PackListTotals invoice={model.selectedInvoice} order={model.order} packList={model.selectedPackList} />
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
            className={`app-selector-chip${packList.NetUid === model.selectedPackListNetId ? ' is-selected' : ''}`}
            disabled={model.isBusy}
            variant="default"
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
                <SquarePen size={14} />
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
                <Trash2 size={14} />
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
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Видалити інвойс')}</span>}
        value={model.deleteInvoiceCandidate?.Number || ''}
        onClose={() => model.setPageState({ deleteInvoiceCandidate: null })}
        onConfirm={model.confirmDeleteInvoice}
      />
      <DeleteModal
        isSaving={model.isSaving}
        opened={Boolean(model.deletePackListCandidate)}
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Видалити пак лист')}</span>}
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
    <AppModal centered opened={opened} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Додати інвойс')}</span>} onClose={close}>
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
          accept={EXCEL_FILE_ACCEPT}
          disabled={isSaving}
          label={t('Файл')}
          placeholder={t('Оберіть файл')}
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
          <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={() => onSubmit(form)}>{t('Створити')}</Button>
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
    <AppModal centered opened={opened} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Додати пак лист')}</span>} onClose={close}>
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
          accept={EXCEL_FILE_ACCEPT}
          disabled={isSaving}
          label={t('Файл')}
          placeholder={t('Оберіть файл')}
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
          <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={() => onSubmit(form)}>{t('Створити')}</Button>
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
    <AppModal centered opened={opened} size="lg" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Редагувати інвойс')}</span>} onClose={onClose}>
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
          onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, number: nextValue })) }}
        />
        <TextInput
          disabled={isSaving}
          label={t('Дата')}
          type="datetime-local"
          value={form.dateFrom}
          onChange={(event) => { const nextValue = event.currentTarget.value; setForm((current) => ({ ...current, dateFrom: nextValue })) }}
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
        leftSection={<FileUp size={16} />}
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
        <Button disabled={isSaving} leftSection={<X size={16} />} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
        <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} onClick={() => onSubmit(form)}>{t('Зберегти')}</Button>
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

export function PackListMetadataModalBody({
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

  function updateTextField(
    field: 'comment' | 'dateFrom' | 'invNo' | 'markNumber' | 'no' | 'plNo' | 'refNo',
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

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
          <TextInput disabled={isSaving} label="INV.NO" value={form.invNo} onChange={(event) => updateTextField('invNo', event.currentTarget.value)} />
          <TextInput disabled={isSaving} label="REF.NO" value={form.refNo} onChange={(event) => updateTextField('refNo', event.currentTarget.value)} />
          <TextInput disabled={isSaving} label="PL.NO" value={form.plNo} onChange={(event) => updateTextField('plNo', event.currentTarget.value)} />
          <TextInput disabled={isSaving} label="Mark" value={form.markNumber} onChange={(event) => updateTextField('markNumber', event.currentTarget.value)} />
          <TextInput disabled={isSaving} label="No" value={form.no} onChange={(event) => updateTextField('no', event.currentTarget.value)} />
          <TextInput disabled={isSaving} label={t('Дата')} type="datetime-local" value={form.dateFrom} onChange={(event) => updateTextField('dateFrom', event.currentTarget.value)} />
        </SimpleGrid>
        <Textarea
          autosize
          disabled={isSaving}
          label={t('Коментар')}
          minRows={2}
          value={form.comment}
          onChange={(event) => updateTextField('comment', event.currentTarget.value)}
        />
        <FileInput
          clearable
          multiple
          disabled={isSaving}
          label={t('Документи')}
          leftSection={<FileUp size={16} />}
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
          <Button disabled={isSaving} leftSection={<X size={16} />} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} onClick={() => onSubmit(form)}>{t('Зберегти')}</Button>
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
              <Anchor c="dark.6" href={upgradeHttpToHttps(getDocumentUrl(document))} rel="noreferrer" size="sm" target="_blank" underline="always">
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
                <Undo2 size={16} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label={t('Видалити')}>
              <ActionIcon aria-label={t('Видалити')} color="red" variant="subtle" onClick={() => onRemove(document, index)}>
                <Trash2 size={16} />
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
  title: ReactNode
  value: string
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <Stack gap="md">
        <Text>{t('Видалити')} <Text span fw={600} style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{value || ''}</Text>?</Text>
        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button color="red" leftSection={<Trash2 size={16} />} loading={isSaving} onClick={onConfirm}>{t('Видалити')}</Button>
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
      { id: 'qty', header: t('Кількість'), width: 120, align: 'right', accessor: (item) => item.Qty, cell: (item) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatNumber(item.Qty)}</Text> },
      { id: 'leftToInvoice', header: t('Залишок'), width: 120, align: 'right', accessor: (item) => item.QtyDifference, cell: (item) => <BalanceBadge value={item.QtyDifference || 0} /> },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatMoney(item.UnitPrice)}</Text> },
      { id: 'total', header: t('Сума нетто'), width: 130, align: 'right', accessor: (item) => getOrderItemTotal(item), cell: (item) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatMoney(getOrderItemTotal(item))}</Text> },
      { id: 'placed', header: t('Розміщено'), width: 120, accessor: (item) => item.IsPlaced, cell: (item) => <Badge className={item.IsPlaced ? 'app-role-pill is-green' : 'app-role-pill is-gray'} variant="light">{item.IsPlaced ? t('Так') : t('Ні')}</Badge> },
    ],
    [onOpenProductCard, t],
  )
}

function useInvoiceItemColumns({
  balanceByOrderItemKey,
  onOpenProductCard,
}: {
  balanceByOrderItemKey: Map<string, InvoiceBalanceRow>
  onOpenProductCard: (productNetId: string) => void
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
        cell: (item) => <NumberCell value={formatNumber(item.Qty)} />,
      },
      {
        id: 'leftToInvoice',
        header: t('Залишок'),
        width: 120,
        align: 'right',
        accessor: (item) => balanceByOrderItemKey.get(getInvoiceOrderItemOrderKey(item))?.difference,
        cell: (item) => <BalanceBadge value={balanceByOrderItemKey.get(getInvoiceOrderItemOrderKey(item))?.difference || 0} />,
      },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatMoney(item.UnitPrice)}</Text> },
      { id: 'total', header: t('Сума нетто'), width: 130, align: 'right', accessor: (item) => item.TotalAmount, cell: (item) => <NumberCell value={formatMoney(item.TotalAmount || (item.UnitPrice || 0) * (item.Qty || 0))} /> },
      { id: 'imported', header: t('Імпорт'), width: 110, accessor: (item) => item.ProductIsImported, cell: (item) => <Badge className={item.ProductIsImported ? 'app-role-pill is-green' : 'app-role-pill is-gray'} variant="light">{item.ProductIsImported ? t('Так') : t('Ні')}</Badge> },
    ],
    [balanceByOrderItemKey, onOpenProductCard, t],
  )
}

function usePackListItemColumns({
  balanceByInvoiceItemKey,
  onOpenProductCard,
}: {
  balanceByInvoiceItemKey: Map<string, PackListBalanceRow>
  onOpenProductCard: (productNetId: string) => void
}): DataTableColumn<PackingListPackageOrderItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<PackingListPackageOrderItem>[]>(
    () => [
      { id: 'code', header: t('Код'), width: 130, accessor: (item) => item.SupplyInvoiceOrderItem?.Product?.VendorCode, cell: (item) => <ProductCodeCell product={item.SupplyInvoiceOrderItem?.Product} onOpenProductCard={onOpenProductCard} /> },
      { id: 'name', header: t('Товар'), minWidth: 260, accessor: (item) => item.SupplyInvoiceOrderItem?.Product?.Name, cell: (item) => <ProductNameCell product={item.SupplyInvoiceOrderItem?.Product} onOpenProductCard={onOpenProductCard} /> },
      { id: 'netUnit', header: t('Нетто од.'), width: 120, align: 'right', accessor: (item) => item.NetWeight, cell: (item) => <NumberCell value={formatNumber(item.NetWeight)} /> },
      { id: 'grossUnit', header: t('Брутто од.'), width: 120, align: 'right', accessor: (item) => item.GrossWeight, cell: (item) => <NumberCell value={formatNumber(item.GrossWeight)} /> },
      {
        id: 'qty',
        header: t('Кількість'),
        width: 150,
        align: 'right',
        accessor: (item) => item.Qty,
        cell: (item) => <NumberCell value={formatNumber(item.Qty)} />,
      },
      {
        id: 'leftToPack',
        header: t('Залишок'),
        width: 120,
        align: 'right',
        accessor: (item) => balanceByInvoiceItemKey.get(getPackingListInvoiceItemKey(item))?.difference,
        cell: (item) => <BalanceBadge value={balanceByInvoiceItemKey.get(getPackingListInvoiceItemKey(item))?.difference || 0} />,
      },
      { id: 'net', header: t('Нетто'), width: 120, align: 'right', accessor: (item) => item.TotalNetWeight, cell: (item) => <NumberCell value={formatNumber(item.TotalNetWeight)} /> },
      { id: 'gross', header: t('Брутто'), width: 120, align: 'right', accessor: (item) => item.TotalGrossWeight, cell: (item) => <NumberCell value={formatNumber(item.TotalGrossWeight)} /> },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatMoney(item.UnitPrice)}</Text> },
      { id: 'total', header: t('Сума нетто'), width: 130, align: 'right', accessor: (item) => getPackListItemAmount(item), cell: (item) => <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatMoney(getPackListItemAmount(item))}</Text> },
    ],
    [balanceByInvoiceItemKey, onOpenProductCard, t],
  )
}

/* Bare mono number cell (§5.1). */
function NumberCell({ value }: { value: string }) {
  return (
    <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
      {value}
    </Text>
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
  const code = product?.VendorCode || ''

  return netId ? (
    <Anchor
      c="dark.6"
      component="button"
      fw={600}
      style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}
      type="button"
      underline="always"
      onClick={(event) => {
        event.stopPropagation()
        onOpenProductCard(netId)
      }}
    >
      {code}
    </Anchor>
  ) : (
    <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{code}</Text>
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
  const name = product?.Name || product?.NameUA || ''

  return netId ? (
    <Anchor
      c="dark.6"
      component="button"
      size="sm"
      type="button"
      underline="always"
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

function InvoiceTotals({
  invoice,
  order,
}: {
  invoice: SupplyInvoice
  order: DirectSupplyOrder | null
}) {
  const { t } = useI18n()
  const currencyCode = getInvoiceCurrencyCode(invoice, order)
  const amounts = getInvoiceDisplayAmounts(invoice)

  return (
    <SummaryLine
      items={[
        [t('Позицій у пак листах'), formatNumber(countPackingListItems(invoice))],
        [t('Кількість у пак листах'), formatNumber(sumPackingListQty(invoice))],
        [t('Сума нетто'), formatMoney(amounts.net, currencyCode)],
        [t('ПДВ'), formatMoney(amounts.vat, currencyCode)],
        [t('Сума з ПДВ'), formatMoney(amounts.withVat, currencyCode)],
        [t('Вага нетто'), formatNumber(invoice.TotalNetWeight)],
        [t('Вага брутто'), formatNumber(invoice.TotalGrossWeight)],
      ]}
    />
  )
}

function PackListTotals({
  invoice,
  order,
  packList,
}: {
  invoice: SupplyInvoice | null
  order: DirectSupplyOrder | null
  packList: PackingList | null
}) {
  const { t } = useI18n()
  const currencyCode = getInvoiceCurrencyCode(invoice, order)

  if (packList) {
    const amounts = getPackingListDisplayAmounts(packList)

    return (
      <SummaryLine
        items={[
          [t('Позицій'), formatNumber(packList.PackingListPackageOrderItems?.length || 0)],
          [t('Кількість'), formatNumber(packList.TotalQuantity)],
          [t('Сума нетто'), formatMoney(amounts.net, currencyCode)],
          [t('ПДВ'), formatMoney(amounts.vat, currencyCode)],
          [t('Сума з ПДВ'), formatMoney(amounts.withVat, currencyCode)],
          [t('Вага нетто'), formatNumber(packList.TotalNetWeight)],
          [t('Вага брутто'), formatNumber(packList.TotalGrossWeight)],
        ]}
      />
    )
  }

  if (!invoice) {
    return null
  }

  const amounts = getInvoiceDisplayAmounts(invoice)

  return (
    <SummaryLine
      items={[
        [t('Позицій у пак листах'), formatNumber(countPackingListItems(invoice))],
        [t('Кількість'), formatNumber(invoice.TotalQuantity)],
        [t('Сума нетто'), formatMoney(amounts.net, currencyCode)],
        [t('ПДВ'), formatMoney(amounts.vat, currencyCode)],
        [t('Сума з ПДВ'), formatMoney(amounts.withVat, currencyCode)],
        [t('Вага нетто'), formatNumber(invoice.TotalNetWeight)],
        [t('Вага брутто'), formatNumber(invoice.TotalGrossWeight)],
      ]}
    />
  )
}

function SummaryLine({ items }: { items: Array<[string, string]> }) {
  return (
    <Group gap="lg" wrap="wrap">
      {items.map(([label, value]) => (
        <Stack key={label} gap={2}>
          <Text className="app-section-title" fw={600} size="xs">{label}</Text>
          <Text fw={600} size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{value}</Text>
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
  const isOverage = difference < 0
  const differenceValue = isOverage ? Math.abs(difference) : difference
  const currentDifferenceLabel = isOverage ? t('Перевищено') : differenceLabel
  const invalidRows = rows.filter((row) => row.isError).length

  return (
    <Alert color={invalidRows ? 'yellow' : 'green'} icon={<CircleAlert size={18} />} variant="light">
      <Group gap="lg" wrap="wrap">
        <Text fw={600}>{invalidRows ? t('Є розбіжності') : t('Кількості збігаються')}</Text>
        <Text size="sm">{expectedLabel}: <Text span fw={600} style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatNumber(expectedQty)}</Text></Text>
        <Text size="sm">{actualLabel}: <Text span fw={600} style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatNumber(actualQty)}</Text></Text>
        <Text size="sm">{currentDifferenceLabel}: <Text span fw={600} style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>{formatNumber(differenceValue)}</Text></Text>
        {invalidRows > 0 && <Badge className="app-role-pill is-yellow" variant="light">{invalidRows}</Badge>}
      </Group>
    </Alert>
  )
}

function BalanceBadge({ value }: { value: number }) {
  const { t } = useI18n()
  const isOk = isZeroQuantity(value)
  const isOverage = value < 0
  const label = isOverage ? `${t('Перевищено')} ${formatNumber(Math.abs(value))}` : formatNumber(value)

  return (
    <Badge className={isOk ? 'app-role-pill is-green' : isOverage ? 'app-role-pill is-red' : 'app-role-pill is-yellow'} variant="light">
      {label}
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
    NetUid: createNetUid(),
  }))
}

function createNetUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0
    const value = character === 'x' ? random : (random & 0x3) | 0x8

    return value.toString(16)
  })
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

function upsertInvoice(invoices: SupplyInvoice[], invoice: SupplyInvoice): SupplyInvoice[] {
  return upsertEntity(invoices, invoice)
}

function upsertPackList(packLists: PackingList[], packList: PackingList): PackingList[] {
  return upsertEntity(packLists, packList)
}

function upsertEntity<T extends { Id?: number; NetUid?: string }>(items: T[], nextItem: T): T[] {
  const index = items.findIndex((item) => isSameEntity(item, nextItem))

  if (index < 0) {
    return [...items, nextItem]
  }

  const nextItems = [...items]
  nextItems[index] = { ...nextItems[index], ...nextItem }

  return nextItems
}

function mergeSupplyInvoiceData(current: SupplyInvoice, incoming: SupplyInvoice): SupplyInvoice {
  return {
    ...current,
    ...incoming,
    InformationDeliveryProtocols: keepFilledArray(incoming.InformationDeliveryProtocols, current.InformationDeliveryProtocols),
    InvoiceDocuments: keepFilledArray(incoming.InvoiceDocuments, current.InvoiceDocuments),
    PackingLists: keepFilledArray(incoming.PackingLists, current.PackingLists),
    PaymentDeliveryProtocols: keepFilledArray(incoming.PaymentDeliveryProtocols, current.PaymentDeliveryProtocols),
    SupplyInvoiceDeliveryDocuments: keepFilledArray(
      incoming.SupplyInvoiceDeliveryDocuments,
      current.SupplyInvoiceDeliveryDocuments,
    ),
    SupplyInvoiceOrderItems: keepFilledArray(incoming.SupplyInvoiceOrderItems, current.SupplyInvoiceOrderItems),
  }
}

function keepFilledArray<T>(incoming: T[] | undefined, current: T[] | undefined): T[] {
  return incoming?.length ? incoming : current || incoming || []
}

function isSameEntity(left: { Id?: number; NetUid?: string }, right: { Id?: number; NetUid?: string }): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (left.Id && right.Id) {
    return left.Id === right.Id
  }

  return left === right
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

function getInvoiceCurrencyCode(
  invoice: SupplyInvoice | null | undefined,
  order: DirectSupplyOrder | null | undefined,
): string {
  const currencyCode = invoice?.SupplyOrganizationAgreement?.Currency?.Code
    || invoice?.SupplyOrganizationAgreement?.Currency?.Name
    || invoice?.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Code
    || invoice?.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Name
    || getOrderCurrencyCode(order)

  if (currencyCode) {
    return currencyCode
  }

  for (const mergedInvoice of invoice?.MergedSupplyInvoices || []) {
    const mergedCurrencyCode = getInvoiceCurrencyCode(mergedInvoice, order)

    if (mergedCurrencyCode) {
      return mergedCurrencyCode
    }
  }

  return ''
}

function getOrderCurrencyCode(order: DirectSupplyOrder | null | undefined): string {
  return order?.ClientAgreement?.Agreement?.Currency?.Code
    || order?.ClientAgreement?.Agreement?.Currency?.Name
    || ''
}

function getInvoiceDisplayAmounts(invoice: SupplyInvoice): ReturnType<typeof getInvoiceAmountBreakdown> {
  const own = getInvoiceAmountBreakdown(invoice)
  const merged = invoice.MergedSupplyInvoices || []

  if (!merged.length) {
    const net = own.net ?? getSupplyInvoiceAmount(invoice)

    return {
      net,
      vat: own.vat,
      withVat: own.withVat ?? addOptionalAmounts(net, own.vat),
    }
  }

  const mergedAmounts = merged.map(getInvoiceDisplayAmounts)
  const net = own.net ?? sumOptionalAmounts(mergedAmounts.map((amounts) => amounts.net))
  const vat = own.vat ?? sumOptionalAmounts(mergedAmounts.map((amounts) => amounts.vat))

  return {
    net,
    vat,
    withVat:
      own.withVat
      ?? sumOptionalAmounts(mergedAmounts.map((amounts) => amounts.withVat))
      ?? addOptionalAmounts(net, vat),
  }
}

function getPackingListDisplayAmounts(packList: PackingList): ReturnType<typeof getPackingListAmountBreakdown> {
  const own = getPackingListAmountBreakdown(packList)
  const net = own.net ?? getPackingListAmount(packList)

  return {
    net,
    vat: own.vat,
    withVat: own.withVat ?? addOptionalAmounts(net, own.vat),
  }
}

function addOptionalAmounts(left: number | undefined, right: number | undefined): number | undefined {
  return left === undefined && right === undefined ? undefined : (left ?? 0) + (right ?? 0)
}

function sumOptionalAmounts(values: Array<number | undefined>): number | undefined {
  const definedValues = values.filter((value): value is number => value !== undefined)

  return definedValues.length ? definedValues.reduce((total, value) => total + value, 0) : undefined
}

function getSupplyInvoiceAmount(invoice: SupplyInvoice | null | undefined): number | undefined {
  const invoiceRecord = invoice as (SupplyInvoice & {
    TotalAmount?: number | string
    TotalValue?: number | string
  }) | null | undefined
  const amount =
    readFiniteNumber(invoiceRecord?.TotalNetPrice)
    ?? readFiniteNumber(invoiceRecord?.NetPrice)
    ?? readFiniteNumber(invoiceRecord?.TotalAmount)
    ?? readFiniteNumber(invoiceRecord?.TotalValue)
    ?? readFiniteNumber(invoiceRecord?.TotalValueWithVat)

  if (typeof amount === 'number') {
    return amount
  }

  const mergedAmount = (invoice?.MergedSupplyInvoices || []).reduce(
    (total, mergedInvoice) => total + (getSupplyInvoiceAmount(mergedInvoice) || 0),
    0,
  )

  return invoice?.MergedSupplyInvoices?.length ? mergedAmount : undefined
}

function getPackListItemAmount(item: PackingListPackageOrderItem): number {
  const direct = readFiniteNumber(item.TotalNetPrice) ?? readFiniteNumber(item.TotalGrossPrice)

  if (typeof direct === 'number' && direct !== 0) {
    return direct
  }

  // A 2nd packing list's items store UnitPrice=0 on the row; derive Qty*UnitPrice from the invoice
  // item (or its order item) so the per-item «Сума» and the pack-list total agree and aren't 0.
  const unitPrice =
    item.UnitPrice
    || item.SupplyInvoiceOrderItem?.UnitPrice
    || item.SupplyInvoiceOrderItem?.SupplyOrderItem?.UnitPrice
    || 0

  return unitPrice * (item.Qty || 0)
}

function getPackingListAmount(packList: PackingList | null | undefined): number | undefined {
  const direct = readFiniteNumber(packList?.TotalNetPrice) ?? readFiniteNumber(packList?.TotalGrossPrice)

  if (typeof direct === 'number' && direct !== 0) {
    return direct
  }

  // The backend populates the pack-list-level total for some pack lists but not
  // others (then Сума read 0). Fall back to summing each item's effective amount
  // so every pack list shows a sum.
  const summed = (packList?.PackingListPackageOrderItems || []).reduce(
    (total, item) => total + getPackListItemAmount(item),
    0,
  )

  return summed !== 0 ? summed : direct
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
        <Badge key={key} className="app-role-pill is-gray" variant="light">
          {t(key)}: {String(value)}
        </Badge>
      ))}
    </Group>
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
  const invoiceNetPrice = getSupplyInvoiceAmount(invoice) || 0

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

function formatDateTimeInput(date: Date): string {
  return formatLocalDateTime(date).slice(0, 16)
}

function normalizeDateTimeInput(value: string): string {
  return value.length === 16 ? `${value}:00` : value
}

function getOrderNumber(order: DirectSupplyOrder | null): string {
  return order?.SupplyOrderNumber?.Number ? `№ ${order.SupplyOrderNumber.Number}` : ''
}

/* Empty values render blank (§5/§7.2) — never a dash. */
function formatDate(value?: Date | string | null): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateFormatter.format(date)
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? numberFormatter.format(value) : ''
}

function formatMoney(value?: number, currencyCode?: string | null): string {
  const amount = typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : ''

  return amount && currencyCode ? `${amount} ${currencyCode}` : amount
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

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value.replace(/\s/g, '').replace(',', '.'))

    return Number.isFinite(parsedValue) ? parsedValue : undefined
  }

  return undefined
}
