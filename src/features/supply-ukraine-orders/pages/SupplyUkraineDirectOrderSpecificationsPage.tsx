import {
  Alert,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CircleAlert, FileDown, FileInput, FileX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './supply-order-detail.css'
import { formatLocalDate, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  addOrUpdateProductSpecification,
  getPackingListSpecificationProducts,
  getSpecificationDownloadUrls,
  uploadProductSpecificationForInvoice,
} from '../../product-delivery-protocols/api/protocolSpecificationApi'
import {
  ProductSpecificationEditDrawer,
  type ProductSpecificationSubmitPayload,
} from '../../product-delivery-protocols/components/ProductSpecificationEditDrawer'
import { SpecificationDownloadModal } from '../../product-delivery-protocols/components/SpecificationDownloadModal'
import { SpecificationProductsGrid } from '../../product-delivery-protocols/components/SpecificationProductsGrid'
import { SpecificationTotals } from '../../product-delivery-protocols/components/SpecificationTotals'
import { UploadDeliveryDocumentsModal } from '../../product-delivery-protocols/components/UploadDeliveryDocumentsModal'
import { UploadProductSpecificationModal } from '../../product-delivery-protocols/components/UploadProductSpecificationModal'
import { UploadProductSpecificationResultModal } from '../../product-delivery-protocols/components/UploadProductSpecificationResultModal'
import type {
  DeliveryDocumentDraft,
  PackingListPackageOrderItem,
  ProductSpecificationParseConfiguration,
  SpecificationDownloadDocument,
  SpecificationPackingList,
  SpecificationSupplyInvoice,
  UploadProductSpecificationResult,
} from '../../product-delivery-protocols/specificationTypes'
import { useAuth } from '../../auth/useAuth'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import {
  addDeliveryDocumentsToDirectSupplyInvoice,
  getDirectSupplyOrderById,
  getSupplyInvoiceItems,
  searchSupplyOrderServiceOrganizations,
} from '../api/supplyUkraineOrdersApi'
import type {
  DirectSupplyOrder,
  SupplyInvoice,
  SupplyInvoiceDeliveryDocument,
  SupplyServiceOrganization,
} from '../types'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const PERMISSION_DOWNLOAD_SPECIFICATION = 'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadFilesFromTheApplication_PKEY'
const PERMISSION_EDIT_SPECIFICATION = 'SPECIFICATION_CODES_ordersUkraineAllEdit_History_PKEY'
const PERMISSION_SAVE_SPECIFICATION = 'SPECIFICATION_CODES_ordersUkraineAllEdit_SaveModalBtn_PKEY'
const PERMISSION_UPLOAD_DELIVERY_DOCUMENTS = 'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadingShippingDocuments_PKEY'
const PERMISSION_UPLOAD_SPECIFICATIONS = 'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadingSpecificationDocuments_PKEY'
const SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS = 300

export function SupplyUkraineDirectOrderSpecificationsPage() {
  const model = useSupplyUkraineDirectOrderSpecificationsPageModel()

  return <SupplyUkraineDirectOrderSpecificationsView model={model} />
}

function useSupplyUkraineDirectOrderSpecificationsPageModel() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<DirectSupplyOrder | null>(null)
  const [selectedInvoiceNetId, setSelectedInvoiceNetId] = useState<string | null>(null)
  const [selectedPackListNetId, setSelectedPackListNetId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<SupplyInvoice | null>(null)
  const [packingList, setPackingList] = useState<SpecificationPackingList | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isInvoiceLoading, setInvoiceLoading] = useState(false)
  const [isPackingListLoading, setPackingListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [packingListError, setPackingListError] = useState<string | null>(null)
  const [currencyIsEur, setCurrencyIsEur] = useState(true)
  const [withManagementServices, setWithManagementServices] = useState(false)

  const [isUploadOpen, setUploadOpen] = useState(false)
  const [isUploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadProductSpecificationResult | null>(null)

  const [isDocumentsOpen, setDocumentsOpen] = useState(false)
  const [isDocumentsCloseConfirmOpen, setDocumentsCloseConfirmOpen] = useState(false)
  const [isSavingDocuments, setSavingDocuments] = useState(false)
  const [existingDocuments, setExistingDocuments] = useState<DeliveryDocumentDraft[]>([])
  const [newDocuments, setNewDocuments] = useState<DeliveryDocumentDraft[]>([])
  const [numberCustomDeclaration, setNumberCustomDeclaration] = useState('')
  const [dateCustomDeclaration, setDateCustomDeclaration] = useState('')
  const [documentOrganizations, setDocumentOrganizations] = useState<SupplyServiceOrganization[]>([])
  const [documentOrganizationNetId, setDocumentOrganizationNetId] = useState<string | null>(null)
  const [documentAgreementNetId, setDocumentAgreementNetId] = useState<string | null>(null)
  const [documentOrganizationSearch, setDocumentOrganizationSearch] = useState('')
  const [debouncedDocumentOrganizationSearch] = useDebouncedValue(
    documentOrganizationSearch,
    SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS,
  )

  const [isDownloadOpen, setDownloadOpen] = useState(false)
  const [isDownloading, setDownloading] = useState(false)
  const [downloadDocument, setDownloadDocument] = useState<SpecificationDownloadDocument | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [editingSpecificationItem, setEditingSpecificationItem] = useState<PackingListPackageOrderItem | null>(null)
  const [isSavingSpecification, setSavingSpecification] = useState(false)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const [vendorCodeFilter, setVendorCodeFilter] = useState('')
  const uploadRequestRef = useRef(0)
  const documentsSaveRequestRef = useRef(0)
  const downloadRequestRef = useRef(0)
  const specificationSaveRequestRef = useRef(0)
  const invoices = order?.SupplyInvoices || []
  const canDownload = hasPermission(PERMISSION_DOWNLOAD_SPECIFICATION) && Boolean(packingList && (packingList.Id || 0) > 0)
  const canEditSpecification = hasPermission(PERMISSION_EDIT_SPECIFICATION)
  const canSaveSpecification = hasPermission(PERMISSION_SAVE_SPECIFICATION)
  const canUploadDocuments = hasPermission(PERMISSION_UPLOAD_DELIVERY_DOCUMENTS)
  const canUploadSpecifications = hasPermission(PERMISSION_UPLOAD_SPECIFICATIONS) && Boolean(selectedInvoice)
  const isActionBusy = isUploading || isSavingDocuments || isDownloading || isSavingSpecification || isInvoiceLoading
  const filteredPackingList = filterPackingListByVendorCode(packingList, vendorCodeFilter)
  const selectedDocumentOrganization =
    documentOrganizations.find((organization) => organization.NetUid === documentOrganizationNetId) ||
    (selectedInvoice?.SupplyOrganization?.NetUid === documentOrganizationNetId ? selectedInvoice.SupplyOrganization : null)
  const selectedDocumentAgreement =
    selectedDocumentOrganization?.SupplyOrganizationAgreements?.find(
      (agreement) => agreement.NetUid === documentAgreementNetId,
    ) || null
  const documentOrganizationForSave =
    selectedDocumentOrganization
    || (selectedInvoice?.SupplyOrganization?.NetUid === documentOrganizationNetId ? selectedInvoice.SupplyOrganization : null)
  const documentAgreementForSave =
    selectedDocumentAgreement
    || (selectedInvoice?.SupplyOrganizationAgreement?.NetUid === documentAgreementNetId
      ? selectedInvoice.SupplyOrganizationAgreement
      : null)

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
          const firstInvoice = nextOrder?.SupplyInvoices?.find((invoice) => (invoice.PackingLists?.length || 0) > 0)
            || nextOrder?.SupplyInvoices?.[0]
            || null
          setSelectedInvoiceNetId(firstInvoice?.NetUid || null)
          if (!firstInvoice) {
            setSelectedInvoice(null)
            setSelectedPackListNetId(null)
            setPackingList(null)
          }
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

  useEffect(() => {
    if (!selectedInvoiceNetId) {
      return
    }

    let cancelled = false

    async function loadInvoice(invoiceNetId: string) {
      setInvoiceLoading(true)

      try {
        const invoice = await getSupplyInvoiceItems(invoiceNetId)

        if (!cancelled) {
          setSelectedInvoice(invoice)
          const packListNetId = invoice?.PackingLists?.[0]?.NetUid || null
          setSelectedPackListNetId(packListNetId)
          if (!packListNetId) {
            setPackingList(null)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setSelectedInvoice(null)
          notifications.show({
            color: 'red',
            message: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити інвойс'),
          })
        }
      } finally {
        if (!cancelled) {
          setInvoiceLoading(false)
        }
      }
    }

    void loadInvoice(selectedInvoiceNetId)

    return () => {
      cancelled = true
    }
  }, [selectedInvoiceNetId, t])

  useEffect(() => {
    if (!selectedPackListNetId) {
      return
    }

    let cancelled = false

    async function loadPackingList(packListNetId: string) {
      setPackingListLoading(true)
      setPackingListError(null)

      try {
        const result = await getPackingListSpecificationProducts(packListNetId)

        if (!cancelled) {
          setPackingList(result)
        }
      } catch (loadError) {
        if (!cancelled) {
          setPackingList(null)
          setPackingListError(loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'))
        }
      } finally {
        if (!cancelled) {
          setPackingListLoading(false)
        }
      }
    }

    void loadPackingList(selectedPackListNetId)

    return () => {
      cancelled = true
    }
  }, [selectedPackListNetId, t])

  function selectInvoice(invoice: SupplyInvoice) {
    if (isActionBusy) {
      return
    }

    uploadRequestRef.current += 1
    documentsSaveRequestRef.current += 1
    downloadRequestRef.current += 1
    specificationSaveRequestRef.current += 1
    setUploading(false)
    setSavingDocuments(false)
    setDownloading(false)
    setSavingSpecification(false)
    setVendorCodeFilter('')
    setSelectedInvoiceNetId(invoice.NetUid || null)
  }

  function selectPackList(packList: { NetUid?: string }) {
    if (isActionBusy) {
      return
    }

    uploadRequestRef.current += 1
    downloadRequestRef.current += 1
    specificationSaveRequestRef.current += 1
    setUploading(false)
    setDownloading(false)
    setSavingSpecification(false)
    setVendorCodeFilter('')
    setSelectedPackListNetId(packList.NetUid || null)
  }

  useEffect(() => {
    if (!isDocumentsOpen) {
      return
    }

    const value = debouncedDocumentOrganizationSearch.trim()

    if (!value) {
      return
    }

    const currentOrganization =
      selectedInvoice?.SupplyOrganization?.NetUid === documentOrganizationNetId ? selectedInvoice.SupplyOrganization : null
    let cancelled = false

    async function loadDocumentOrganizations() {
      try {
        const organizations = await searchSupplyOrderServiceOrganizations(value)

        if (!cancelled) {
          setDocumentOrganizations(includeSupplyOrganization(organizations, currentOrganization))
        }
      } catch (lookupError) {
        if (!cancelled) {
          notifications.show({
            color: 'red',
            message: lookupError instanceof Error ? lookupError.message : t('Не вдалося завантажити постачальників послуг'),
          })
        }
      }
    }

    void loadDocumentOrganizations()

    return () => {
      cancelled = true
    }
  }, [debouncedDocumentOrganizationSearch, documentOrganizationNetId, isDocumentsOpen, selectedInvoice, t])

  function selectDocumentOrganization(netUid: string | null) {
    if (isSavingDocuments) {
      return
    }

    const organization = documentOrganizations.find((item) => item.NetUid === netUid) || null
    setDocumentOrganizationNetId(netUid)
    setDocumentAgreementNetId(organization?.SupplyOrganizationAgreements?.[0]?.NetUid || null)
  }

  async function submitUpload(parseConfiguration: ProductSpecificationParseConfiguration, file: File) {
    const invoiceNetId = selectedInvoice?.NetUid
    const packListNetId = selectedPackListNetId

    if (!invoiceNetId || isUploading) {
      return
    }

    const requestId = uploadRequestRef.current + 1
    uploadRequestRef.current = requestId
    const isCurrentUpload = () => uploadRequestRef.current === requestId

    setUploading(true)

    try {
      const result = await uploadProductSpecificationForInvoice(invoiceNetId, parseConfiguration, file)

      if (isCurrentUpload()) {
        setUploadOpen(false)
        setUploadResult(result)

        if (packListNetId) {
          const nextPackingList = await getPackingListSpecificationProducts(packListNetId)

          if (isCurrentUpload()) {
            setPackingList(nextPackingList)
          }
        }
      }
    } catch (uploadError) {
      if (isCurrentUpload()) {
        notifications.show({
          color: 'red',
          message: uploadError instanceof Error ? uploadError.message : t('Не вдалося виконати запит'),
        })
      }
    } finally {
      if (isCurrentUpload()) {
        setUploading(false)
      }
    }
  }

  function openDocuments() {
    if (!selectedInvoice || isSavingDocuments) {
      notifications.show({ color: 'red', message: t('Інвойс відсутній') })
      return
    }

    setNumberCustomDeclaration(selectedInvoice.NumberCustomDeclaration || '')
    setDateCustomDeclaration(getInvoiceCustomDeclarationDate(selectedInvoice))
    setExistingDocuments(
      (selectedInvoice.SupplyInvoiceDeliveryDocuments || []).map((document, index) => ({
        contentType: document.ContentType || '',
        deleted: Boolean(document.Deleted),
        documentUrl: document.DocumentUrl || '',
        file: null,
        fileName: document.FileName || '',
        id: getDeliveryDocumentDraftId(document, index),
      })),
    )
    setNewDocuments([])
    setDocumentOrganizations(includeSupplyOrganization([], selectedInvoice.SupplyOrganization || null))
    setDocumentOrganizationNetId(selectedInvoice.SupplyOrganization?.NetUid || null)
    setDocumentAgreementNetId(selectedInvoice.SupplyOrganizationAgreement?.NetUid || null)
    setDocumentOrganizationSearch('')
    setDocumentsOpen(true)
    setDocumentsCloseConfirmOpen(false)
  }

  function hasDeliveryDocumentDraftChanges(): boolean {
    const sourceDocuments = selectedInvoice?.SupplyInvoiceDeliveryDocuments || []

    if (!selectedInvoice) {
      return (
        newDocuments.length > 0 ||
        existingDocuments.some((document) => document.deleted) ||
        Boolean(numberCustomDeclaration || dateCustomDeclaration || documentOrganizationNetId || documentAgreementNetId)
      )
    }

    return (
      newDocuments.length > 0 ||
      existingDocuments.some((document, index) => {
        const sourceDocument = sourceDocuments.find(
          (source, sourceIndex) => getDeliveryDocumentDraftId(source, sourceIndex) === document.id,
        ) || sourceDocuments[index]

        return Boolean(document.deleted) !== Boolean(sourceDocument?.Deleted)
      }) ||
      numberCustomDeclaration !== (selectedInvoice.NumberCustomDeclaration || '') ||
      dateCustomDeclaration !== getInvoiceCustomDeclarationDate(selectedInvoice) ||
      documentOrganizationNetId !== (selectedInvoice.SupplyOrganization?.NetUid || null) ||
      documentAgreementNetId !== (selectedInvoice.SupplyOrganizationAgreement?.NetUid || null)
    )
  }

  function requestCloseDocuments() {
    if (isSavingDocuments) {
      return
    }

    if (hasDeliveryDocumentDraftChanges()) {
      setDocumentsCloseConfirmOpen(true)
      return
    }

    closeDocumentsDraft()
  }

  function closeDocumentsDraft() {
    setDocumentsCloseConfirmOpen(false)
    setDocumentsOpen(false)
    setNewDocuments([])
    setExistingDocuments([])
  }

  function addDocumentFiles(files: File[]) {
    if (isSavingDocuments) {
      return
    }

    setNewDocuments((current) => {
      const startId = current.length > 0 ? current[current.length - 1].id + 1 : 0

      return [
        ...current,
        ...files.map((file, index) => {
          const fileInfo = file.name.split('.')
          const contentType = fileInfo.length > 1 ? fileInfo.pop() || '' : ''

          return {
            contentType,
            deleted: false,
            documentUrl: '',
            file,
            fileName: fileInfo.join('.') || file.name,
            id: startId + index,
          }
        }),
      ]
    })
  }

  function removeNewDocument(document: DeliveryDocumentDraft) {
    if (isSavingDocuments) {
      return
    }

    setNewDocuments((current) => current.filter((item) => item.id !== document.id))
  }

  function removeExistingDocument(document: DeliveryDocumentDraft) {
    if (isSavingDocuments) {
      return
    }

    setExistingDocuments((current) =>
      current.map((item) => (item.id === document.id ? { ...item, deleted: !item.deleted } : item)),
    )
  }

  async function saveDocuments() {
    const invoice = selectedInvoice

    if (!invoice?.NetUid || isSavingDocuments) {
      return
    }

    if (dateCustomDeclaration && !isValidDateInputValue(dateCustomDeclaration)) {
      notifications.show({ color: 'yellow', message: t('Вкажіть коректну дату митної декларації') })
      return
    }

    const requestId = documentsSaveRequestRef.current + 1
    documentsSaveRequestRef.current = requestId
    const isCurrentDocumentsSave = () => documentsSaveRequestRef.current === requestId

    setSavingDocuments(true)

    try {
      const invoicePayload: SpecificationSupplyInvoice = {
        ...(invoice as unknown as SpecificationSupplyInvoice),
        DateCustomDeclaration: dateCustomDeclaration ? formatLocalInputDateTime(dateCustomDeclaration) : formatLocalInputDateTime(),
        NumberCustomDeclaration: numberCustomDeclaration,
        SupplyInvoiceDeliveryDocuments: (invoice.SupplyInvoiceDeliveryDocuments || []).map((document, index) => {
          const draft = existingDocuments.find((item) => item.id === getDeliveryDocumentDraftId(document, index))

          return draft ? { ...document, Deleted: draft.deleted } : document
        }),
        SupplyOrganization: documentOrganizationForSave,
        SupplyOrganizationAgreement: documentAgreementForSave,
      }
      const files = newDocuments.map((document) => document.file).filter((file): file is File => Boolean(file))

      const updatedOrder = await addDeliveryDocumentsToDirectSupplyInvoice(invoicePayload as unknown as SupplyInvoice, files)
      const updatedInvoice = await getSupplyInvoiceItems(invoice.NetUid)

      if (isCurrentDocumentsSave()) {
        if (updatedOrder) {
          setOrder(updatedInvoice ? mergeInvoiceIntoOrder(updatedOrder, updatedInvoice) : updatedOrder)
        } else if (updatedInvoice) {
          setOrder((current) => mergeInvoiceIntoOrder(current, updatedInvoice))
        }
        closeDocumentsDraft()
        setSelectedInvoice(updatedInvoice)
        notifications.show({ color: 'green', message: t('Документи збережено') })
      }
    } catch (saveError) {
      if (isCurrentDocumentsSave()) {
        notifications.show({
          color: 'red',
          message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'),
        })
      }
    } finally {
      if (isCurrentDocumentsSave()) {
        setSavingDocuments(false)
      }
    }
  }

  async function openDownload() {
    const packListNetId = selectedPackListNetId

    if (!packListNetId || isDownloading) {
      return
    }

    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId
    const isCurrentDownload = () => downloadRequestRef.current === requestId

    setDownloadOpen(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await getSpecificationDownloadUrls(packListNetId)

      if (isCurrentDownload()) {
        setDownloadDocument(document)
      }
    } catch (downloadFetchError) {
      if (isCurrentDownload()) {
        setDownloadError(downloadFetchError instanceof Error ? downloadFetchError.message : t('Документ недоступний для завантаження'))
      }
    } finally {
      if (isCurrentDownload()) {
        setDownloading(false)
      }
    }
  }

  async function saveSpecification(payload: ProductSpecificationSubmitPayload) {
    const invoiceNetId = selectedInvoiceNetId
    const packListNetId = selectedPackListNetId

    if (isSavingSpecification) {
      return
    }

    if (!invoiceNetId) {
      notifications.show({ color: 'red', message: t('Інвойс відсутній') })
      return
    }

    const requestId = specificationSaveRequestRef.current + 1
    specificationSaveRequestRef.current = requestId
    const isCurrentSpecificationSave = () => specificationSaveRequestRef.current === requestId

    setSavingSpecification(true)

    try {
      await addOrUpdateProductSpecification(invoiceNetId, payload)

      if (packListNetId) {
        const nextPackingList = await getPackingListSpecificationProducts(packListNetId)

        if (isCurrentSpecificationSave()) {
          setPackingList(nextPackingList)
        }
      }

      if (isCurrentSpecificationSave()) {
        setEditingSpecificationItem(null)
        notifications.show({ color: 'green', message: t('Зміни збережено') })
      }
    } catch (saveError) {
      if (isCurrentSpecificationSave()) {
        notifications.show({
          color: 'red',
          message: saveError instanceof Error ? saveError.message : t('Не вдалося змінити митний код'),
        })
      }
    } finally {
      if (isCurrentSpecificationSave()) {
        setSavingSpecification(false)
      }
    }
  }

  return {
    addDocumentFiles,
    canDownload,
    canEditSpecification,
    canSaveSpecification,
    canUploadDocuments,
    canUploadSpecifications,
    closeDocumentsDraft,
    currencyIsEur,
    dateCustomDeclaration,
    documentAgreementNetId,
    documentOrganizationNetId,
    documentOrganizationSearch,
    documentOrganizations,
    downloadDocument,
    downloadError,
    editingSpecificationItem,
    error,
    existingDocuments,
    filteredPackingList,
    goBack: () => navigate('/orders/ukraine/all', { replace: true }),
    invoices,
    isActionBusy,
    isDocumentsCloseConfirmOpen,
    isDocumentsOpen,
    isDownloadOpen,
    isDownloading,
    isInvoiceLoading,
    isLoading,
    isPackingListLoading,
    isSavingDocuments,
    isSavingSpecification,
    isUploadOpen,
    isUploading,
    newDocuments,
    numberCustomDeclaration,
    openDocuments,
    openDownload,
    order,
    packingList,
    packingListError,
    productCardNetId,
    removeExistingDocument,
    removeNewDocument,
    requestCloseDocuments,
    saveDocuments,
    saveSpecification,
    selectDocumentOrganization,
    selectInvoice,
    selectPackList,
    selectedInvoice,
    selectedInvoiceNetId,
    selectedPackListNetId,
    setCurrencyIsEur,
    setDateCustomDeclaration,
    setDocumentAgreementNetId,
    setDocumentOrganizationSearch,
    setDocumentsCloseConfirmOpen,
    setDownloadOpen,
    setEditingSpecificationItem,
    setNumberCustomDeclaration,
    setProductCardNetId,
    setUploadOpen,
    setUploadResult,
    setVendorCodeFilter,
    setWithManagementServices,
    submitUpload,
    uploadResult,
    vendorCodeFilter,
    withManagementServices,
  }
}

type DirectOrderSpecificationsPageModel = ReturnType<typeof useSupplyUkraineDirectOrderSpecificationsPageModel>

function SupplyUkraineDirectOrderSpecificationsView({ model }: { model: DirectOrderSpecificationsPageModel }) {
  const { t } = useI18n()
  const orderNumber = getOrderNumber(model.order)

  return (
    <AppDrawer
      className="supply-order-specifications-sheet"
      closeOnClickOutside={false}
      opened
      size="full"
      title={
        <span className="supply-order-spec-title">
          <span>{t('Специфікації')}</span>
          {orderNumber && <span className="app-role-pill is-yellow supply-order-spec-title-number">{orderNumber}</span>}
        </span>
      }
      onClose={model.goBack}
      footer={
        model.packingList && (model.packingList.Id || 0) > 0 ? (
          <Group className="supply-order-spec-footer" justify="flex-end" align="center" w="100%" wrap="nowrap" gap="md">
            <DirectOrderSpecificationTotals model={model} />
          </Group>
        ) : undefined
      }
    >
      <Stack gap="sm" className="supply-order-specifications-content">
        {model.error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {model.error}
          </Alert>
        )}

        <DirectOrderSpecificationsBody model={model} />
      </Stack>
      <DirectOrderSpecificationsModals model={model} />
    </AppDrawer>
  )
}

function DirectOrderSpecificationsBody({ model }: { model: DirectOrderSpecificationsPageModel }) {
  const { t } = useI18n()

  if (model.isLoading) {
    return <Group justify="center" py="xl"><Loader /></Group>
  }

  if (!model.order) {
    return <Text c="dimmed">{t('Замовлення не знайдено')}</Text>
  }

  return (
    <div className="supply-order-specifications-body">
      <SpecificationActionButtons model={model} />
      <InvoiceButtons model={model} />
      <PackListButtons model={model} />
      <SpecificationGridArea model={model} />
    </div>
  )
}

function SpecificationActionButtons({ model }: { model: DirectOrderSpecificationsPageModel }) {
  const { t } = useI18n()
  const hasTotals = Boolean(model.packingList && (model.packingList.Id || 0) > 0)

  return (
    <Group className="supply-order-spec-actions app-filter-bar" justify="space-between" gap="xs" wrap="nowrap">
      {hasTotals ? (
        <SpecificationViewTabs model={model} />
      ) : (
        <span className="supply-order-spec-tabs-spacer" />
      )}
      <Group className="supply-order-spec-action-buttons" justify="flex-end" gap="xs" wrap="wrap">
        {model.canUploadSpecifications && (
          <Button
            color={CREATE_ACTION_COLOR}
            className="supply-order-spec-action-button"
            disabled={model.isActionBusy}
            leftSection={<FileInput size={16} />}
            loading={model.isUploading}
            variant="outline"
            onClick={() => model.setUploadOpen(true)}
          >
            {t('Завантаження митних кодів')}
          </Button>
        )}
        {model.canUploadDocuments && (
          <Button
            color={CREATE_ACTION_COLOR}
            className="supply-order-spec-action-button"
            disabled={!model.selectedInvoice || model.isActionBusy}
            leftSection={<FileInput size={16} />}
            loading={model.isSavingDocuments}
            variant="outline"
            onClick={model.openDocuments}
          >
            {t('Завантаження документів доставки')}
          </Button>
        )}
        {model.canDownload && (
          <Button
            color={CREATE_ACTION_COLOR}
            className="supply-order-spec-action-button"
            disabled={model.isActionBusy}
            leftSection={<FileDown size={16} />}
            loading={model.isDownloading}
            variant="outline"
            onClick={model.openDownload}
          >
            {t('Друк PDF')}
          </Button>
        )}
      </Group>
    </Group>
  )
}

function SpecificationViewTabs({ model }: { model: DirectOrderSpecificationsPageModel }) {
  const { t } = useI18n()

  return (
    <Group className="supply-order-spec-tabs" gap="sm" wrap="nowrap">
      <div aria-label={t('Валюта')} className="supply-order-spec-tab-group" role="tablist">
        <button
          aria-selected={model.currencyIsEur}
          className={`supply-order-spec-tab${model.currencyIsEur ? ' is-active' : ''}`}
          disabled={model.isActionBusy}
          role="tab"
          type="button"
          onClick={() => model.setCurrencyIsEur(true)}
        >
          {t('EUR')}
        </button>
        <button
          aria-selected={!model.currencyIsEur}
          className={`supply-order-spec-tab${!model.currencyIsEur ? ' is-active' : ''}`}
          disabled={model.isActionBusy}
          role="tab"
          type="button"
          onClick={() => model.setCurrencyIsEur(false)}
        >
          {t('UAH')}
        </button>
      </div>
      <div aria-label={t('Тип обліку')} className="supply-order-spec-tab-group" role="tablist">
        <button
          aria-selected={model.withManagementServices}
          className={`supply-order-spec-tab${model.withManagementServices ? ' is-active' : ''}`}
          disabled={model.isActionBusy}
          role="tab"
          type="button"
          onClick={() => model.setWithManagementServices(true)}
        >
          УО
        </button>
        <button
          aria-selected={!model.withManagementServices}
          className={`supply-order-spec-tab${!model.withManagementServices ? ' is-active' : ''}`}
          disabled={model.isActionBusy}
          role="tab"
          type="button"
          onClick={() => model.setWithManagementServices(false)}
        >
          БО
        </button>
      </div>
    </Group>
  )
}

function InvoiceButtons({ model }: { model: DirectOrderSpecificationsPageModel }) {
  const { t } = useI18n()

  if (model.invoices.length === 0) {
    return null
  }

  return (
    <div className="supply-order-spec-selector">
      <Text className="app-section-title supply-order-spec-selector-title" fw={600}>{t('Інвойси')}</Text>
      <Group gap="xs" wrap="wrap">
        {model.invoices.map((invoice) => {
          const isActive = invoice.NetUid === model.selectedInvoiceNetId

          return (
            <Button
              key={invoice.NetUid || invoice.Id}
              className={`app-selector-chip supply-order-spec-chip${isActive ? ' is-selected' : ''}`}
              disabled={model.isActionBusy}
              loading={model.isInvoiceLoading && isActive}
              variant="default"
              onClick={() => model.selectInvoice(invoice)}
            >
              {t('Інвойс')} {invoice.Number || '-'} {t('Від')} {formatDate(invoice.DateFrom)}
            </Button>
          )
        })}
      </Group>
    </div>
  )
}

function PackListButtons({ model }: { model: DirectOrderSpecificationsPageModel }) {
  const { t } = useI18n()

  if (!model.selectedInvoice || (model.selectedInvoice.PackingLists?.length || 0) === 0) {
    return null
  }

  return (
    <div className="supply-order-spec-selector">
      <Text className="app-section-title supply-order-spec-selector-title" fw={600}>{t('Пак листи')}</Text>
      <Group gap="xs" wrap="wrap">
        {(model.selectedInvoice.PackingLists || []).map((packList) => {
          const isActive = packList.NetUid === model.selectedPackListNetId

          return (
            <Button
              key={packList.NetUid || packList.Id}
              className={`app-selector-chip supply-order-spec-chip${isActive ? ' is-selected' : ''}`}
              disabled={model.isActionBusy}
              size="xs"
              variant="default"
              onClick={() => model.selectPackList(packList)}
            >
              {t('Пак лист')} №: {packList.InvNo || packList.No || '-'} ({t('Від')} {formatDate(packList.FromDate)})
            </Button>
          )
        })}
      </Group>
    </div>
  )
}

function SpecificationGridArea({ model }: { model: DirectOrderSpecificationsPageModel }) {
  const { t } = useI18n()

  return (
    <div className="supply-order-spec-grid-block">
      {model.packingListError && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {model.packingListError}
        </Alert>
      )}

      {model.packingList && (model.packingList.PackingListPackageOrderItems?.length || 0) > 0 && (
        <div className="supply-order-spec-grid-toolbar">
          <TextInput
            className="supply-detail-search supply-order-spec-search"
            label={t('Пошук')}
            placeholder={t('Код товару')}
            disabled={model.isActionBusy}
            value={model.vendorCodeFilter}
            w={260}
            onChange={(event) => model.setVendorCodeFilter(event.currentTarget.value)}
          />
        </div>
      )}

      {model.isPackingListLoading ? (
        <Group justify="center" py="lg"><Loader /></Group>
      ) : model.filteredPackingList && (model.filteredPackingList.PackingListPackageOrderItems?.length || 0) > 0 ? (
        <SpecificationProductsGrid
          canEditSpecification={model.canEditSpecification}
          currencyIsEur={model.currencyIsEur}
          packingList={model.filteredPackingList}
          withManagementServices={model.withManagementServices}
          onEditSpecification={model.setEditingSpecificationItem}
          onOpenProductCard={model.setProductCardNetId}
        />
      ) : (
        <div className="supply-detail-state">
          <FileX size={18} />
          <span>{t('Немає даних')}</span>
        </div>
      )}
    </div>
  )
}

function DirectOrderSpecificationTotals({ model }: { model: DirectOrderSpecificationsPageModel }) {
  if (!model.packingList || (model.packingList.Id || 0) <= 0) {
    return null
  }

  return (
    <SpecificationTotals
      flat
      currencyIsEur={model.currencyIsEur}
      invoice={model.selectedInvoice as unknown as SpecificationSupplyInvoice}
      packingList={model.packingList}
    />
  )
}

function DirectOrderSpecificationsModals({ model }: { model: DirectOrderSpecificationsPageModel }) {
  const { t } = useI18n()

  return (
    <>
      <UploadProductSpecificationModal
        isLoading={model.isUploading}
        opened={model.isUploadOpen}
        onClose={() => {
          if (!model.isUploading) {
            model.setUploadOpen(false)
          }
        }}
        onSubmit={model.submitUpload}
      />
      <UploadProductSpecificationResultModal result={model.uploadResult} onClose={() => model.setUploadResult(null)} />
      <UploadDeliveryDocumentsModal
        dateCustomDeclaration={model.dateCustomDeclaration}
        existingDocuments={model.existingDocuments}
        isSaving={model.isSavingDocuments}
        newDocuments={model.newDocuments}
        numberCustomDeclaration={model.numberCustomDeclaration}
        opened={model.isDocumentsOpen}
        selectedSupplyOrganizationAgreementNetId={model.documentAgreementNetId}
        selectedSupplyOrganizationNetId={model.documentOrganizationNetId}
        supplyOrganizationSearchValue={model.documentOrganizationSearch}
        supplyOrganizations={model.documentOrganizations}
        onAddFiles={model.addDocumentFiles}
        onChangeDateCustomDeclaration={model.setDateCustomDeclaration}
        onChangeNumberCustomDeclaration={model.setNumberCustomDeclaration}
        onChangeSupplyOrganization={model.selectDocumentOrganization}
        onChangeSupplyOrganizationAgreement={model.setDocumentAgreementNetId}
        onClose={model.requestCloseDocuments}
        onRemoveExistingDocument={model.removeExistingDocument}
        onRemoveNewDocument={model.removeNewDocument}
        onSearchSupplyOrganizations={model.setDocumentOrganizationSearch}
        onSave={model.saveDocuments}
      />
      <AppModal
        centered
        opened={model.isDocumentsCloseConfirmOpen}
        title={t('Є незбережені зміни')}
        onClose={() => {
          if (!model.isSavingDocuments) {
            model.setDocumentsCloseConfirmOpen(false)
          }
        }}
      >
        <Stack gap="md">
          <Text>{t('Якщо закрити вікно, зміни по документах доставки не будуть збережені.')}</Text>
          <Group justify="flex-end">
            <Button
              color="gray"
              disabled={model.isSavingDocuments}
              variant="light"
              onClick={() => model.setDocumentsCloseConfirmOpen(false)}
            >
              {t('Залишитися')}
            </Button>
            <Button color="red" disabled={model.isSavingDocuments} onClick={model.closeDocumentsDraft}>
              {t('Закрити без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
      <SpecificationDownloadModal
        document={model.downloadDocument}
        error={model.downloadError}
        isLoading={model.isDownloading}
        opened={model.isDownloadOpen}
        onClose={() => model.setDownloadOpen(false)}
      />
      <ProductSpecificationEditDrawer
        canSave={model.canSaveSpecification}
        isSaving={model.isSavingSpecification}
        item={model.editingSpecificationItem}
        onClose={() => model.setEditingSpecificationItem(null)}
        onSave={model.saveSpecification}
      />
      <ProductCardModal productNetId={model.productCardNetId} onClose={() => model.setProductCardNetId(null)} />
    </>
  )
}

function getDeliveryDocumentDraftId(document: SupplyInvoiceDeliveryDocument, index: number): number {
  return document.Id ?? index
}

function getInvoiceCustomDeclarationDate(invoice: SupplyInvoice): string {
  return invoice.DateCustomDeclaration
    ? formatLocalDate(new Date(invoice.DateCustomDeclaration))
    : formatLocalDate(new Date())
}

function isValidDateInputValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value
}

function includeSupplyOrganization(
  organizations: SupplyServiceOrganization[],
  selectedOrganization: SupplyServiceOrganization | null,
): SupplyServiceOrganization[] {
  if (
    !selectedOrganization ||
    organizations.some((organization) => organization.NetUid === selectedOrganization.NetUid)
  ) {
    return organizations
  }

  return [selectedOrganization, ...organizations]
}

function filterPackingListByVendorCode(
  packingList: SpecificationPackingList | null,
  vendorCodeFilter: string,
): SpecificationPackingList | null {
  const value = vendorCodeFilter.trim().toLowerCase()

  if (!packingList || !value) {
    return packingList
  }

  return {
    ...packingList,
    PackingListPackageOrderItems: (packingList.PackingListPackageOrderItems || []).filter((item) =>
      (item.SupplyInvoiceOrderItem?.Product?.VendorCode || '').toLowerCase().includes(value),
    ),
  }
}

function getOrderNumber(order: DirectSupplyOrder | null): string {
  return order?.SupplyOrderNumber?.Number ? `№ ${order.SupplyOrderNumber.Number}` : ''
}

function mergeInvoiceIntoOrder(order: DirectSupplyOrder | null, invoice: SupplyInvoice): DirectSupplyOrder | null {
  if (!order) {
    return order
  }

  return {
    ...order,
    SupplyInvoices: (order.SupplyInvoices || []).map((orderInvoice) =>
      isSameInvoice(orderInvoice, invoice) ? { ...orderInvoice, ...invoice } : orderInvoice,
    ),
  }
}

function isSameInvoice(left: SupplyInvoice, right: SupplyInvoice): boolean {
  if (left.NetUid && right.NetUid) {
    return left.NetUid === right.NetUid
  }

  if (left.Id && right.Id) {
    return left.Id === right.Id
  }

  return false
}

function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return dateFormatter.format(date)
}
