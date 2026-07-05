import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconDownload,
  IconFileImport,
  IconFilesOff,
  IconLayersIntersect,
} from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import { getProtocolByNetId } from '../api/productDeliveryProtocolsApi'
import { searchSupplyOrganizations } from '../api/protocolDetailApi'
import {
  addDeliveryDocumentsToInvoice,
  addOrUpdateProductSpecification,
  getPackingListSpecificationProducts,
  getSpecificationDownloadUrls,
  mergeSupplyInvoices,
  uploadProductSpecificationForInvoice,
} from '../api/protocolSpecificationApi'
import { MergeInvoicesModal } from '../components/MergeInvoicesModal'
import {
  ProductSpecificationEditDrawer,
  type ProductSpecificationSubmitPayload,
} from '../components/ProductSpecificationEditDrawer'
import { SpecificationDownloadModal } from '../components/SpecificationDownloadModal'
import { SpecificationProductsGrid } from '../components/SpecificationProductsGrid'
import { SpecificationTotals } from '../components/SpecificationTotals'
import { UploadDeliveryDocumentsModal } from '../components/UploadDeliveryDocumentsModal'
import { UploadProductSpecificationModal } from '../components/UploadProductSpecificationModal'
import { UploadProductSpecificationResultModal } from '../components/UploadProductSpecificationResultModal'
import type { SupplyOrganization } from '../detailTypes'
import type {
  DeliveryDocumentDraft,
  PackingListPackageOrderItem,
  ProductSpecificationParseConfiguration,
  SupplyInvoiceDeliveryDocument,
  SpecificationDownloadDocument,
  SpecificationPackingList,
  SpecificationProtocol,
  SpecificationSupplyInvoice,
  UploadProductSpecificationResult,
} from '../specificationTypes'
import './product-delivery-protocol-specification-page.css'

const invoiceDateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const CURRENCY_EUR = 'eur'
const CURRENCY_UAH = 'uah'
const SERVICES_MANAGEMENT = 'management'
const SERVICES_ACCOUNTING = 'accounting'
const PERMISSION_UPLOAD_SPECIFICATIONS = 'ProductDeliveryProtocols_specifications_download_exel_upload_PKEY'
const PERMISSION_UPLOAD_DELIVERY_DOCUMENTS =
  'ProductDeliveryProtocols_specifications_download_exel_upload_documents_PKEY'
const PERMISSION_DOWNLOAD_SPECIFICATION = 'ProductDeliveryProtocols_specifications_download_exel_PKEY'
const PERMISSION_OPEN_SPECIFICATION_CODE = 'ProductDeliveryProtocols_specifications_customs_codes_infoBtn_PKEY'
const PERMISSION_SAVE_SPECIFICATION_CODE = 'SPECIFICATION_CODES_ordersUkraineAllEdit_SaveModalBtn_PKEY'
const SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS = 300
const SPECIFICATION_CURRENCY_OPTIONS = [
  { label: 'EUR', value: CURRENCY_EUR },
  { label: 'UAH', value: CURRENCY_UAH },
]
const SERVICE_MODE_OPTIONS = [
  { label: 'УО', value: SERVICES_MANAGEMENT },
  { label: 'БО', value: SERVICES_ACCOUNTING },
]

type ProtocolSelectionState = {
  error: string | null
  isLoading: boolean
  protocol: SpecificationProtocol | null
  selectedInvoiceNetId: string | null
  selectedMergeNetIds: string[]
  selectedPackListNetId: string | null
}

type PackingListState = {
  error: string | null
  isLoading: boolean
  packingList: SpecificationPackingList | null
}

const INITIAL_PROTOCOL_SELECTION_STATE: ProtocolSelectionState = {
  error: null,
  isLoading: true,
  protocol: null,
  selectedInvoiceNetId: null,
  selectedMergeNetIds: [],
  selectedPackListNetId: null,
}

const EMPTY_PACKING_LIST_STATE: PackingListState = {
  error: null,
  isLoading: false,
  packingList: null,
}

function invoiceDate(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return invoiceDateFormatter.format(date)
}

function getMergeInvoiceNetIds(protocol: SpecificationProtocol | null): string[] {
  return (protocol?.SupplyInvoices || [])
    .map((invoice) => invoice.NetUid)
    .filter((value): value is string => Boolean(value))
}

function getLoadedProtocolSelectionState(protocol: SpecificationProtocol): ProtocolSelectionState {
  const firstInvoice = protocol.SupplyInvoices?.find((invoice) => (invoice.PackingLists?.length || 0) > 0)

  return {
    error: null,
    isLoading: false,
    protocol,
    selectedInvoiceNetId: firstInvoice?.NetUid || null,
    selectedMergeNetIds: getMergeInvoiceNetIds(protocol),
    selectedPackListNetId: firstInvoice?.PackingLists?.[0]?.NetUid || null,
  }
}

function useSpecificationModel(netId: string | undefined) {
  const { t } = useI18n()
  const [protocolState, setProtocolState] = useValueState<ProtocolSelectionState>(INITIAL_PROTOCOL_SELECTION_STATE)
  const [packingListState, setPackingListState] = useValueState<PackingListState>(EMPTY_PACKING_LIST_STATE)
  const [currencyIsEur, setCurrencyIsEur] = useValueState(true)
  const [withManagementServices, setWithManagementServices] = useValueState(false)

  const [isUploadOpen, setUploadOpen] = useValueState(false)
  const [isUploading, setUploading] = useValueState(false)
  const [uploadResult, setUploadResult] = useValueState<UploadProductSpecificationResult | null>(null)

  const [isDocumentsOpen, setDocumentsOpen] = useValueState(false)
  const [isDocumentsCloseConfirmOpen, setDocumentsCloseConfirmOpen] = useValueState(false)
  const [isSavingDocuments, setSavingDocuments] = useValueState(false)
  const [existingDocuments, setExistingDocuments] = useValueState<DeliveryDocumentDraft[]>([])
  const [newDocuments, setNewDocuments] = useValueState<DeliveryDocumentDraft[]>([])
  const [numberCustomDeclaration, setNumberCustomDeclaration] = useValueState('')
  const [dateCustomDeclaration, setDateCustomDeclaration] = useValueState('')
  const [documentOrganizations, setDocumentOrganizations] = useValueState<SupplyOrganization[]>([])
  const [documentOrganizationNetId, setDocumentOrganizationNetId] = useValueState<string | null>(null)
  const [documentAgreementNetId, setDocumentAgreementNetId] = useValueState<string | null>(null)
  const [documentOrganizationSearch, setDocumentOrganizationSearch] = useValueState('')
  const [debouncedDocumentOrganizationSearch] = useDebouncedValue(
    documentOrganizationSearch,
    SUPPLY_ORGANIZATION_SEARCH_DEBOUNCE_MS,
  )

  const [isMergeOpen, setMergeOpen] = useValueState(false)
  const [isMerging, setMerging] = useValueState(false)

  const [isDownloadOpen, setDownloadOpen] = useValueState(false)
  const [isDownloading, setDownloading] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<SpecificationDownloadDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [editingSpecificationItem, setEditingSpecificationItem] = useValueState<PackingListPackageOrderItem | null>(null)
  const [isSavingSpecification, setSavingSpecification] = useValueState(false)
  const uploadRequestRef = useRef(0)
  const downloadRequestRef = useRef(0)
  const specificationSaveRequestRef = useRef(0)
  const documentsSaveRequestRef = useRef(0)
  const {
    error,
    isLoading,
    protocol,
    selectedInvoiceNetId,
    selectedMergeNetIds,
    selectedPackListNetId,
  } = protocolState
  const {
    error: packingListError,
    isLoading: isPackingListLoading,
    packingList,
  } = packingListState

  const navigate = useNavigate()

  useEffect(() => {
    uploadRequestRef.current += 1
    downloadRequestRef.current += 1
    specificationSaveRequestRef.current += 1
    documentsSaveRequestRef.current += 1
  }, [selectedInvoiceNetId, selectedPackListNetId])

  useEffect(() => {
    if (!netId) {
      setProtocolState({
        ...INITIAL_PROTOCOL_SELECTION_STATE,
        error: t('Помилка'),
        isLoading: false,
      })
      setPackingListState(EMPTY_PACKING_LIST_STATE)

      return
    }

    let cancelled = false

    async function loadProtocol(currentNetId: string) {
      setProtocolState((current) => ({
        ...current,
        error: null,
        isLoading: true,
      }))

      try {
        const result = await getProtocolByNetId(currentNetId)

        if (cancelled) {
          return
        }

        if (result) {
          const protocolResult = result as unknown as SpecificationProtocol
          const nextProtocolState = getLoadedProtocolSelectionState(protocolResult)

          setProtocolState(nextProtocolState)

          if (!nextProtocolState.selectedPackListNetId) {
            setPackingListState(EMPTY_PACKING_LIST_STATE)
          }
        } else {
          setProtocolState({
            ...INITIAL_PROTOCOL_SELECTION_STATE,
            error: t('Помилка'),
            isLoading: false,
          })
          setPackingListState(EMPTY_PACKING_LIST_STATE)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProtocolState({
            ...INITIAL_PROTOCOL_SELECTION_STATE,
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити протокол'),
            isLoading: false,
          })
          setPackingListState(EMPTY_PACKING_LIST_STATE)
        }
      }
    }

    void loadProtocol(netId)

    return () => {
      cancelled = true
    }
  }, [
    netId,
    setPackingListState,
    setProtocolState,
    t,
  ])

  useEffect(() => {
    if (!selectedPackListNetId) {
      setPackingListState(EMPTY_PACKING_LIST_STATE)

      return
    }

    let cancelled = false

    async function loadPackingList(packListNetId: string) {
      setPackingListState({
        error: null,
        isLoading: true,
        packingList: null,
      })

      try {
        const result = await getPackingListSpecificationProducts(packListNetId)

        if (!cancelled) {
          setPackingListState({
            error: null,
            isLoading: false,
            packingList: result,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setPackingListState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося виконати запит'),
            isLoading: false,
            packingList: null,
          })
        }
      }
    }

    void loadPackingList(selectedPackListNetId)

    return () => {
      cancelled = true
    }
  }, [selectedPackListNetId, setPackingListState, t])

  const selectedInvoice =
    protocol?.SupplyInvoices?.find((invoice) => invoice.NetUid === selectedInvoiceNetId) || null
  const selectedDocumentOrganization =
    documentOrganizations.find((organization) => organization.NetUid === documentOrganizationNetId) ||
    (selectedInvoice?.SupplyOrganization?.NetUid === documentOrganizationNetId ? selectedInvoice.SupplyOrganization : null)
  const selectedDocumentAgreement =
    selectedDocumentOrganization?.SupplyOrganizationAgreements?.find(
      (agreement) => agreement.NetUid === documentAgreementNetId,
    ) || null
  const isActionBusy =
    isUploading || isSavingDocuments || isMerging || isDownloading || isSavingSpecification

  useEffect(() => {
    if (!isDocumentsOpen) {
      return
    }

    const value = debouncedDocumentOrganizationSearch.trim()
    const currentOrganization =
      selectedInvoice?.SupplyOrganization?.NetUid === documentOrganizationNetId ? selectedInvoice.SupplyOrganization : null

    if (!value) {
      setDocumentOrganizations(includeSupplyOrganization([], currentOrganization))
      return
    }

    let cancelled = false

    async function loadDocumentOrganizations() {
      try {
        const organizations = await searchSupplyOrganizations(value)

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
  }, [
    debouncedDocumentOrganizationSearch,
    documentOrganizationNetId,
    isDocumentsOpen,
    selectedInvoice,
    setDocumentOrganizations,
    t,
  ])

  function selectDocumentOrganization(netUid: string | null) {
    if (isSavingDocuments) {
      return
    }

    const organization = documentOrganizations.find((item) => item.NetUid === netUid) || null
    setDocumentOrganizationNetId(netUid)
    setDocumentAgreementNetId(organization?.SupplyOrganizationAgreements?.[0]?.NetUid || null)
  }

  function selectInvoice(invoice: SpecificationSupplyInvoice) {
    if (isActionBusy) {
      return
    }

    if (!invoice.PackingLists || invoice.PackingLists.length === 0) {
      notifications.show({ color: 'red', message: t('В інвойсі відсутні пак лісти') })

      return
    }

    invalidateActionRequests()
    setProtocolState((current) => ({
      ...current,
      selectedInvoiceNetId: invoice.NetUid || null,
      selectedPackListNetId: invoice.PackingLists?.[0]?.NetUid || null,
    }))
  }

  function selectPackList(packList: SpecificationPackingList) {
    if (isActionBusy) {
      return
    }

    invalidateActionRequests()
    setProtocolState((current) => ({
      ...current,
      selectedPackListNetId: packList.NetUid || null,
    }))
  }

  function invalidateActionRequests() {
    uploadRequestRef.current += 1
    downloadRequestRef.current += 1
    specificationSaveRequestRef.current += 1
    documentsSaveRequestRef.current += 1
    setUploading(false)
    setDownloading(false)
    setSavingSpecification(false)
    setSavingDocuments(false)
  }

  async function reloadProtocol(isCurrent: () => boolean = () => true): Promise<SpecificationProtocol | null> {
    if (!netId || !isCurrent()) {
      return null
    }

    const result = await getProtocolByNetId(netId)
    const protocolResult = result ? (result as unknown as SpecificationProtocol) : null

    if (isCurrent()) {
      setProtocolState((current) => ({
        ...current,
        protocol: protocolResult,
      }))
    }

    return isCurrent() ? protocolResult : null
  }

  async function submitUpload(parseConfiguration: ProductSpecificationParseConfiguration, file: File) {
    const invoiceNetUid = selectedInvoice?.NetUid || null
    const packListNetUid = selectedPackListNetId

    if (!invoiceNetUid || isActionBusy) {
      return
    }

    const requestId = uploadRequestRef.current + 1
    uploadRequestRef.current = requestId
    const isCurrentUpload = () => uploadRequestRef.current === requestId

    setUploading(true)

    try {
      const result = await uploadProductSpecificationForInvoice(invoiceNetUid, parseConfiguration, file)

      if (isCurrentUpload()) {
        setUploadOpen(false)
        setUploadResult(result)
      }

      if (packListNetUid && isCurrentUpload()) {
        const refreshed = await getPackingListSpecificationProducts(packListNetUid)

        if (isCurrentUpload()) {
          setPackingListState({
            error: null,
            isLoading: false,
            packingList: refreshed,
          })
        }
      }

      if (isCurrentUpload()) {
        await reloadProtocol(isCurrentUpload)
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
    if (!selectedInvoice) {
      notifications.show({ color: 'red', message: t('Інвойс відсутній') })

      return
    }

    if (isActionBusy) {
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
    if (!selectedInvoice) {
      return newDocuments.length > 0 || existingDocuments.some((document) => document.deleted)
    }

    return (
      newDocuments.length > 0 ||
      existingDocuments.some((document, index) => {
        const sourceDocument = (selectedInvoice.SupplyInvoiceDeliveryDocuments || []).find(
          (source, sourceIndex) => getDeliveryDocumentDraftId(source, sourceIndex) === document.id,
        ) || selectedInvoice.SupplyInvoiceDeliveryDocuments?.[index]

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

  function cancelCloseDocuments() {
    if (isSavingDocuments) {
      return
    }

    setDocumentsCloseConfirmOpen(false)
  }

  function closeDocumentsDraft() {
    if (isSavingDocuments) {
      return
    }

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

      const additions = files.map((file, index) => {
        const parts = file.name.split('.')
        const contentType = parts.length > 1 ? parts.pop() || '' : ''

        return {
          contentType,
          deleted: false,
          documentUrl: '',
          file,
          fileName: parts.join('.') || file.name,
          id: startId + index,
        }
      })

      return [...current, ...additions]
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

    if (isSavingDocuments) {
      return
    }

    if (!invoice?.NetUid) {
      notifications.show({ color: 'red', message: t('Інвойс відсутній') })

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
        ...invoice,
        DateCustomDeclaration: dateCustomDeclaration ? formatLocalInputDateTime(dateCustomDeclaration) : null,
        NumberCustomDeclaration: numberCustomDeclaration,
        SupplyInvoiceDeliveryDocuments: (invoice.SupplyInvoiceDeliveryDocuments || []).map((document, index) => {
          const draft = existingDocuments.find((item) => item.id === getDeliveryDocumentDraftId(document, index))

          return draft ? { ...document, Deleted: draft.deleted } : document
        }),
        SupplyOrganization: selectedDocumentOrganization,
        SupplyOrganizationAgreement: selectedDocumentAgreement,
      }

      const files = newDocuments.map((document) => document.file).filter((file): file is File => Boolean(file))
      const updated = await addDeliveryDocumentsToInvoice(invoicePayload, files)

      if (isCurrentDocumentsSave()) {
        if (updated) {
          setProtocolState((current) => ({
            ...current,
            protocol: updated,
          }))
        } else {
          await reloadProtocol(isCurrentDocumentsSave)
        }
      }

      if (isCurrentDocumentsSave()) {
        setDocumentsOpen(false)
        setDocumentsCloseConfirmOpen(false)
        setNewDocuments([])
        setExistingDocuments([])
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

  function openMerge() {
    if (isActionBusy) {
      return
    }

    setProtocolState((current) => ({
      ...current,
      selectedMergeNetIds: getMergeInvoiceNetIds(protocol),
    }))
    setMergeOpen(true)
  }

  function toggleMergeInvoice(invoiceNetId: string) {
    if (isMerging) {
      return
    }

    setProtocolState((current) => ({
      ...current,
      selectedMergeNetIds: current.selectedMergeNetIds.includes(invoiceNetId)
        ? current.selectedMergeNetIds.filter((value) => value !== invoiceNetId)
        : [...current.selectedMergeNetIds, invoiceNetId],
    }))
  }

  async function confirmMerge() {
    if (!netId || isMerging) {
      return
    }

    if (selectedMergeNetIds.length < 2) {
      notifications.show({ color: 'red', message: t('Оберіть щонайменше два інвойси') })
      return
    }

    setMerging(true)

    try {
      await mergeSupplyInvoices(netId, selectedMergeNetIds)
      notifications.show({ color: 'green', message: t("Інвойси успішно об'єднані") })
      navigate('/product-delivery-protocols')
    } catch (mergeError) {
      notifications.show({
        color: 'red',
        message: mergeError instanceof Error ? mergeError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setMerging(false)
    }
  }

  async function openDownload() {
    const packListNetUid = selectedPackListNetId

    if (!packListNetUid || isActionBusy) {
      return
    }

    const requestId = downloadRequestRef.current + 1
    downloadRequestRef.current = requestId

    setDownloadOpen(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await getSpecificationDownloadUrls(packListNetUid)

      if (downloadRequestRef.current === requestId) {
        setDownloadDocument(document)
      }
    } catch (downloadFetchError) {
      if (downloadRequestRef.current === requestId) {
        setDownloadError(
          downloadFetchError instanceof Error
            ? downloadFetchError.message
            : t('Документ недоступний для завантаження'),
        )
      }
    } finally {
      if (downloadRequestRef.current === requestId) {
        setDownloading(false)
      }
    }
  }

  function openSpecificationEditor(item: PackingListPackageOrderItem) {
    if (isActionBusy) {
      return
    }

    setEditingSpecificationItem(item)
  }

  async function saveSpecification(payload: ProductSpecificationSubmitPayload) {
    const invoiceNetUid = selectedInvoiceNetId
    const packListNetUid = selectedPackListNetId

    if (!invoiceNetUid) {
      notifications.show({ color: 'red', message: t('Інвойс відсутній') })

      return
    }

    if (isSavingSpecification) {
      return
    }

    const requestId = specificationSaveRequestRef.current + 1
    specificationSaveRequestRef.current = requestId
    const isCurrentSpecificationSave = () => specificationSaveRequestRef.current === requestId

    setSavingSpecification(true)

    try {
      await addOrUpdateProductSpecification(invoiceNetUid, payload)

      if (packListNetUid && isCurrentSpecificationSave()) {
        const refreshed = await getPackingListSpecificationProducts(packListNetUid)

        if (isCurrentSpecificationSave()) {
          setPackingListState({
            error: null,
            isLoading: false,
            packingList: refreshed,
          })
        }
      }

      if (isCurrentSpecificationSave()) {
        await reloadProtocol(isCurrentSpecificationSave)
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
    addDocumentFiles, confirmMerge, currencyIsEur, dateCustomDeclaration, documentAgreementNetId,
    documentOrganizationNetId, documentOrganizationSearch, documentOrganizations, downloadDocument, downloadError, editingSpecificationItem,
    error, existingDocuments, isActionBusy, isDocumentsCloseConfirmOpen, isDocumentsOpen, isDownloadOpen, isDownloading, isLoading,
    isMergeOpen, isMerging, isPackingListLoading, isSavingDocuments, isSavingSpecification, isUploading,
    isUploadOpen, newDocuments, numberCustomDeclaration, openDocuments, openDownload, openMerge,
    openSpecificationEditor, packingList, packingListError, protocol, removeExistingDocument,
    removeNewDocument, requestCloseDocuments, cancelCloseDocuments, closeDocumentsDraft,
    saveDocuments, selectDocumentOrganization, selectInvoice, selectPackList, selectedInvoice, selectedInvoiceNetId,
    selectedMergeNetIds, selectedPackListNetId, setCurrencyIsEur, setDateCustomDeclaration, setDocumentOrganizationSearch, setDocumentsOpen,
    setDocumentAgreementNetId, setDownloadOpen, setEditingSpecificationItem, setMergeOpen, setNumberCustomDeclaration, setUploadOpen,
    setUploadResult, setWithManagementServices, saveSpecification, submitUpload, toggleMergeInvoice, uploadResult,
    withManagementServices,
  }
}

export function ProductDeliveryProtocolSpecificationPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const model = useSpecificationModel(id)
  const [vendorCodeFilter, setVendorCodeFilter] = useValueState('')
  const invoices = model.protocol?.SupplyInvoices || []
  const canMutateSpecification = Boolean(model.protocol?.IsShipped && !model.protocol?.IsCompleted)
  const specificationUnavailableMessage = getSpecificationUnavailableMessage(model.protocol, t)
  const canMerge = canMutateSpecification && invoices.length > 1
  const canDownload =
    hasPermission(PERMISSION_DOWNLOAD_SPECIFICATION) &&
    Boolean(model.packingList && (model.packingList.Id || 0) > 0)
  const canUpload =
    canMutateSpecification &&
    hasPermission(PERMISSION_UPLOAD_SPECIFICATIONS) &&
    Boolean(model.selectedInvoice && (model.selectedInvoice.Id || 0) > 0)
  const canUploadDocuments = canMutateSpecification && hasPermission(PERMISSION_UPLOAD_DELIVERY_DOCUMENTS)
  const canOpenDeliveryDocuments =
    canMutateSpecification && Boolean(model.selectedInvoice?.NetUid)
  const canEditSpecification = canMutateSpecification && hasPermission(PERMISSION_OPEN_SPECIFICATION_CODE)
  const canSaveSpecification = canMutateSpecification && hasPermission(PERMISSION_SAVE_SPECIFICATION_CODE)
  const filteredPackingList = filterPackingListByVendorCode(model.packingList, vendorCodeFilter)

  return (
    <AppDrawer
      className="app-form-sheet"
      opened
      keepMounted={false}
      position="right"
      size="min(1500px, 97vw)"
      title={
        <span className="app-sheet-title-mono">
          {t('Митні коди згідно протоколу')}
          {model.protocol?.DeliveryProductProtocolNumber?.Number && (
            <Badge className="app-role-pill is-yellow" variant="light">
              {model.protocol.DeliveryProductProtocolNumber.Number}
            </Badge>
          )}
        </span>
      }
      onClose={() => navigate('/product-delivery-protocols')}
    >
      <Stack className="product-specification-sheet" gap="md">
        {model.error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {model.error}
          </Alert>
        )}

        {model.isLoading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : model.protocol ? (
          <Stack gap="md">
            {specificationUnavailableMessage && (
              <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
                {specificationUnavailableMessage}
              </Alert>
            )}

            <Card className="app-section-card product-specification-sheet-card" withBorder radius="md" padding="md">
              <Stack gap="md">
                <div className="product-specification-sheet-header">
                  <div className="product-specification-sheet-switches">
                    <SegmentedControl
                      className="product-specification-sheet-segment"
                      data={SPECIFICATION_CURRENCY_OPTIONS}
                      disabled={model.isActionBusy}
                      size="xs"
                      value={model.currencyIsEur ? CURRENCY_EUR : CURRENCY_UAH}
                      onChange={(value) => model.setCurrencyIsEur(value === CURRENCY_EUR)}
                    />
                    <SegmentedControl
                      className="product-specification-sheet-segment"
                      data={SERVICE_MODE_OPTIONS}
                      disabled={model.isActionBusy}
                      size="xs"
                      value={model.withManagementServices ? SERVICES_MANAGEMENT : SERVICES_ACCOUNTING}
                      onChange={(value) => model.setWithManagementServices(value === SERVICES_MANAGEMENT)}
                    />
                  </div>

                  <Group className="product-specification-sheet-actions" justify="flex-end" gap="xs" wrap="wrap">
                    {canUpload && (
                      <Button
                        color={CREATE_ACTION_COLOR}
                        disabled={model.isActionBusy}
                        leftSection={<IconFileImport size={16} />}
                        loading={model.isUploading}
                        onClick={() => model.setUploadOpen(true)}
                      >
                        {t('Завантаження митних кодів')}
                      </Button>
                    )}
                    {canUploadDocuments && (
                      <Button
                        disabled={!canOpenDeliveryDocuments || model.isActionBusy}
                        leftSection={<IconFileImport size={16} />}
                        loading={model.isSavingDocuments}
                        variant="default"
                        onClick={model.openDocuments}
                      >
                        {t('Завантаження документів доставки')}
                      </Button>
                    )}
                    {canMerge && (
                      <Button
                        disabled={model.isActionBusy}
                        leftSection={<IconLayersIntersect size={16} />}
                        loading={model.isMerging}
                        variant="default"
                        onClick={model.openMerge}
                      >
                        {t("Об'єднати інвойси?")}
                      </Button>
                    )}
                    {canDownload && (
                      <Button
                        disabled={model.isActionBusy}
                        leftSection={<IconDownload size={16} />}
                        loading={model.isDownloading}
                        variant="default"
                        onClick={model.openDownload}
                      >
                        {t('Завантажити')}
                      </Button>
                    )}
                  </Group>
                </div>

                <div className="product-specification-tabs">
                  <div className="product-specification-tab-row">
                    <Text className="product-specification-tab-label" component="div">
                      {t('Інвойси')}
                    </Text>
                    <div className="product-specification-tab-list" role="tablist" aria-label={t('Інвойси')}>
                      {invoices.map((invoice) => {
                        const isSelected = invoice.NetUid === model.selectedInvoiceNetId
                        const mergedInvoices = (invoice.MergedSupplyInvoices || [])
                          .map((merged) => `/${merged.Number} ${t('Від')} ${invoiceDate(merged.DateFrom)}`)
                          .join(' ')

                        return (
                          <button
                            key={invoice.NetUid || invoice.Id}
                            aria-selected={isSelected}
                            className={`product-specification-tab${isSelected ? ' is-selected' : ''}`}
                            disabled={model.isActionBusy}
                            role="tab"
                            type="button"
                            onClick={() => model.selectInvoice(invoice)}
                          >
                            <span className="product-specification-tab-title">
                              {t('Інвойс')} {invoice.Number} {t('Від')} {invoiceDate(invoice.DateFrom)}
                              {mergedInvoices ? ` ${mergedInvoices}` : ''}
                            </span>
                            <span className="product-specification-tab-subtitle">
                              {t('Постачальник')}: {invoice.SupplyOrder?.Client?.FullName || t('Не вказано')}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {model.selectedInvoice && (model.selectedInvoice.PackingLists?.length || 0) > 0 && (
                    <div className="product-specification-tab-row">
                      <Text className="product-specification-tab-label" component="div">
                        {t('Пак листи')}
                      </Text>
                      <div className="product-specification-tab-list is-compact" role="tablist" aria-label={t('Пак листи')}>
                        {(model.selectedInvoice.PackingLists || []).map((packList) => {
                          const isSelected = packList.NetUid === model.selectedPackListNetId
                          const mergedPackLists = (packList.MergedPackingLists || [])
                            .map((merged) => `/${merged.No} ${t('Від')} ${invoiceDate(merged.FromDate)}`)
                            .join(' ')

                          return (
                            <button
                              key={packList.NetUid || packList.Id}
                              aria-selected={isSelected}
                              className={`product-specification-tab is-pack-list${isSelected ? ' is-selected' : ''}`}
                              disabled={model.isActionBusy}
                              role="tab"
                              type="button"
                              onClick={() => model.selectPackList(packList)}
                            >
                              <span className="product-specification-tab-title">
                                {t('Пак ліст')} № {packList.InvNo}
                              </span>
                              <span className="product-specification-tab-subtitle">
                                {t('Від')} {invoiceDate(packList.FromDate)}
                                {mergedPackLists ? ` ${mergedPackLists}` : ''}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {model.packingListError && (
                  <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                    {model.packingListError}
                  </Alert>
                )}

                {model.packingList && (model.packingList.PackingListPackageOrderItems?.length || 0) > 0 && (
                  <div className="product-specification-search-row">
                    <TextInput
                      className="product-specification-search-input"
                      label={t('Пошук')}
                      placeholder={t('Код товару')}
                      disabled={model.isActionBusy}
                      value={vendorCodeFilter}
                      onChange={(event) => setVendorCodeFilter(event.currentTarget.value)}
                    />
                  </div>
                )}

                <div className="product-specification-grid-slot">
                  {model.isPackingListLoading ? (
                    <Text c="dimmed" size="sm">
                      {t('Завантаження')}
                    </Text>
                  ) : filteredPackingList && (filteredPackingList.PackingListPackageOrderItems?.length || 0) > 0 ? (
                    <SpecificationProductsGrid
                      canEditSpecification={canEditSpecification}
                      currencyIsEur={model.currencyIsEur}
                      invoiceDeliveryAmount={model.selectedInvoice?.DeliveryAmount}
                      packingList={filteredPackingList}
                      withManagementServices={model.withManagementServices}
                      onEditSpecification={model.openSpecificationEditor}
                    />
                  ) : (
                    <Group gap="xs" c="dimmed">
                      <IconFilesOff size={18} />
                      <Text size="sm">{t('Немає даних')}</Text>
                    </Group>
                  )}
                </div>
              </Stack>
            </Card>

            {model.packingList && (model.packingList.Id || 0) > 0 && (
              <SpecificationTotals
                currencyIsEur={model.currencyIsEur}
                invoice={model.selectedInvoice}
                packingList={model.packingList}
              />
            )}
          </Stack>
        ) : null}

        <ProductDeliveryProtocolSpecificationModals
          canSaveSpecification={canSaveSpecification}
          invoices={invoices}
          model={model}
        />
      </Stack>
    </AppDrawer>
  )
}

function getSpecificationUnavailableMessage(
  protocol: SpecificationProtocol | null,
  t: (value: string) => string,
): string | null {
  if (!protocol) {
    return null
  }

  if (protocol.IsCompleted) {
    return t('Редагування специфікації недоступне після завершення протоколу')
  }

  if (!protocol.IsShipped) {
    return t('Редагування специфікації доступне після відвантаження протоколу')
  }

  return null
}

type SpecificationModel = ReturnType<typeof useSpecificationModel>

function ProductDeliveryProtocolSpecificationModals({
  canSaveSpecification,
  invoices,
  model,
}: {
  canSaveSpecification: boolean
  invoices: SpecificationSupplyInvoice[]
  model: SpecificationModel
}) {
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

      <MergeInvoicesModal
        invoices={invoices}
        isMerging={model.isMerging}
        opened={model.isMergeOpen}
        selectedNetIds={model.selectedMergeNetIds}
        onClose={() => {
          if (!model.isMerging) {
            model.setMergeOpen(false)
          }
        }}
        onConfirm={model.confirmMerge}
        onToggle={model.toggleMergeInvoice}
      />

      <SpecificationDownloadModal
        document={model.downloadDocument}
        error={model.downloadError}
        isLoading={model.isDownloading}
        opened={model.isDownloadOpen}
        onClose={() => {
          if (!model.isDownloading) {
            model.setDownloadOpen(false)
          }
        }}
      />

      <ProductSpecificationEditDrawer
        canSave={canSaveSpecification}
        isSaving={model.isSavingSpecification}
        item={model.editingSpecificationItem}
        onClose={() => model.setEditingSpecificationItem(null)}
        onSave={model.saveSpecification}
      />

      <AppModal
        centered
        className="app-form-sheet"
        opened={model.isDocumentsCloseConfirmOpen}
        title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Є незбережені зміни')}</span>}
        onClose={() => {
          if (!model.isSavingDocuments) {
            model.cancelCloseDocuments()
          }
        }}
      >
        <Stack gap="md">
          <Text>{t('Якщо закрити вікно, зміни по документах доставки не будуть збережені.')}</Text>
          <Group justify="flex-end">
            <Button disabled={model.isSavingDocuments} variant="default" onClick={model.cancelCloseDocuments}>
              {t('Залишитися')}
            </Button>
            <Button color="red" disabled={model.isSavingDocuments} onClick={model.closeDocumentsDraft}>
              {t('Закрити без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </>
  )
}

function getInvoiceCustomDeclarationDate(invoice: SpecificationSupplyInvoice): string {
  return invoice.DateCustomDeclaration ? formatLocalDate(new Date(invoice.DateCustomDeclaration)) : ''
}

function includeSupplyOrganization(
  organizations: SupplyOrganization[],
  selectedOrganization: SupplyOrganization | null,
): SupplyOrganization[] {
  if (
    !selectedOrganization ||
    organizations.some((organization) => organization.NetUid === selectedOrganization.NetUid)
  ) {
    return organizations
  }

  return [selectedOrganization, ...organizations]
}

function isValidDateInputValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00`)

  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value
}

function getDeliveryDocumentDraftId(document: SupplyInvoiceDeliveryDocument, index: number): number {
  return document.Id ?? index
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
