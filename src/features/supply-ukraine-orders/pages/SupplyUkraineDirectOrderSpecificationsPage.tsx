import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconDownload,
  IconFileImport,
  IconFilesOff,
} from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate, formatLocalInputDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  addDeliveryDocumentsToInvoice,
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
import {
  getDirectSupplyOrderById,
  getSupplyInvoiceItems,
} from '../api/supplyUkraineOrdersApi'
import type { DirectSupplyOrder, SupplyInvoice, SupplyInvoiceDeliveryDocument } from '../types'

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const PERMISSION_DOWNLOAD_SPECIFICATION = 'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadFilesFromTheApplication_PKEY'
const PERMISSION_EDIT_SPECIFICATION = 'SPECIFICATION_CODES_ordersUkraineAllEdit_History_PKEY'
const PERMISSION_SAVE_SPECIFICATION = 'SPECIFICATION_CODES_ordersUkraineAllEdit_SaveModalBtn_PKEY'
const PERMISSION_UPLOAD_DELIVERY_DOCUMENTS = 'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadingShippingDocuments_PKEY'
const PERMISSION_UPLOAD_SPECIFICATIONS = 'SPECIFICATION_CODES_ordersUkraineAllEdit_DownloadingSpecificationDocuments_PKEY'

export function SupplyUkraineDirectOrderSpecificationsPage() {
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

  const [isDownloadOpen, setDownloadOpen] = useState(false)
  const [isDownloading, setDownloading] = useState(false)
  const [downloadDocument, setDownloadDocument] = useState<SpecificationDownloadDocument | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [editingSpecificationItem, setEditingSpecificationItem] = useState<PackingListPackageOrderItem | null>(null)
  const [isSavingSpecification, setSavingSpecification] = useState(false)
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
  const filteredPackingList = filterPackingListByVendorCode(packingList, vendorCodeFilter)

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
    if (isUploading || isSavingDocuments || isDownloading || isSavingSpecification) {
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
    setSelectedInvoiceNetId(invoice.NetUid || null)
  }

  function selectPackList(packList: { NetUid?: string }) {
    if (isUploading || isSavingDocuments || isDownloading || isSavingSpecification) {
      return
    }

    uploadRequestRef.current += 1
    downloadRequestRef.current += 1
    specificationSaveRequestRef.current += 1
    setUploading(false)
    setDownloading(false)
    setSavingSpecification(false)
    setSelectedPackListNetId(packList.NetUid || null)
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
    setDocumentsOpen(true)
    setDocumentsCloseConfirmOpen(false)
  }

  function hasDeliveryDocumentDraftChanges(): boolean {
    const sourceDocuments = selectedInvoice?.SupplyInvoiceDeliveryDocuments || []

    if (!selectedInvoice) {
      return (
        newDocuments.length > 0 ||
        existingDocuments.some((document) => document.deleted) ||
        Boolean(numberCustomDeclaration || dateCustomDeclaration)
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
      dateCustomDeclaration !== getInvoiceCustomDeclarationDate(selectedInvoice)
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
      }
      const files = newDocuments.map((document) => document.file).filter((file): file is File => Boolean(file))

      await addDeliveryDocumentsToInvoice(invoicePayload, files)
      const updatedInvoice = await getSupplyInvoiceItems(invoice.NetUid)

      if (isCurrentDocumentsSave()) {
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

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <Tooltip label={t('Назад')}>
            <ActionIcon
              aria-label={t('Назад')}
              color="gray"
              variant="light"
              onClick={() => navigate(`/orders/ukraine/all/edit/${id || ''}`)}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Stack gap={2}>
            <Text fw={700} size="xl">{t('Специфікації')} {getOrderNumber(order)}</Text>
            <Text c="dimmed" size="sm">{t('Постачальник')}: {order?.Client?.FullName || order?.Client?.Name || '-'}</Text>
          </Stack>
        </Group>
        <Group gap="sm" align="center">
          <SegmentedControl
            data={[
              { label: t('EUR'), value: 'eur' },
              { label: t('UAH'), value: 'uah' },
            ]}
            value={currencyIsEur ? 'eur' : 'uah'}
            onChange={(value) => setCurrencyIsEur(value === 'eur')}
          />
          <SegmentedControl
            data={[
              { label: 'УО', value: 'management' },
              { label: 'БО', value: 'base' },
            ]}
            value={withManagementServices ? 'management' : 'base'}
            onChange={(value) => setWithManagementServices(value === 'management')}
          />
        </Group>
      </Group>

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Group justify="center" py="xl"><Loader /></Group>
      ) : order ? (
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Group justify="flex-end" gap="xs">
	              {canUploadSpecifications && (
                <Button
                  disabled={isUploading || isSavingDocuments || isSavingSpecification}
                  leftSection={<IconFileImport size={16} />}
                  variant="light"
                  onClick={() => setUploadOpen(true)}
                >
                  {t('Завантаження митних кодів')}
                </Button>
              )}
	              {canUploadDocuments && (
                <Button
                  disabled={!selectedInvoice || isSavingDocuments || isUploading || isSavingSpecification}
                  leftSection={<IconFileImport size={16} />}
                  variant="light"
                  onClick={openDocuments}
                >
                  {t('Завантаження документів доставки')}
                </Button>
              )}
	              {canDownload && (
                <Button
                  disabled={isDownloading || isSavingDocuments || isUploading || isSavingSpecification}
                  leftSection={<IconDownload size={16} />}
                  loading={isDownloading}
                  variant="light"
                  onClick={openDownload}
                >
                  {t('Завантажити')}
                </Button>
              )}
            </Group>

            <Group gap="xs" wrap="wrap">
              {invoices.map((invoice) => (
	                <Button
	                  key={invoice.NetUid || invoice.Id}
	                  color={invoice.NetUid === selectedInvoiceNetId ? 'blue' : 'gray'}
	                  disabled={isUploading || isSavingDocuments || isDownloading || isSavingSpecification}
	                  loading={isInvoiceLoading && invoice.NetUid === selectedInvoiceNetId}
                  variant={invoice.NetUid === selectedInvoiceNetId ? 'filled' : 'light'}
                  onClick={() => selectInvoice(invoice)}
                >
                  {t('Інвойс')} {invoice.Number || '-'} {t('Від')} {formatDate(invoice.DateFrom)}
                </Button>
              ))}
            </Group>

            {selectedInvoice && (selectedInvoice.PackingLists?.length || 0) > 0 && (
              <Group gap="xs" wrap="wrap">
                {(selectedInvoice.PackingLists || []).map((packList) => (
	                  <Button
	                    key={packList.NetUid || packList.Id}
	                    color={packList.NetUid === selectedPackListNetId ? 'blue' : 'gray'}
	                    disabled={isUploading || isSavingDocuments || isDownloading || isSavingSpecification}
	                    size="xs"
                    variant={packList.NetUid === selectedPackListNetId ? 'outline' : 'subtle'}
                    onClick={() => selectPackList(packList)}
                  >
                    {t('Пак лист')} №: {packList.InvNo || packList.No || '-'} ({t('Від')} {formatDate(packList.FromDate)})
                  </Button>
                ))}
              </Group>
            )}

            {packingListError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {packingListError}
              </Alert>
            )}

            {packingList && (packingList.PackingListPackageOrderItems?.length || 0) > 0 && (
              <TextInput
                label={t('Пошук')}
                placeholder={t('Код товару')}
                value={vendorCodeFilter}
                w={260}
                onChange={(event) => setVendorCodeFilter(event.currentTarget.value)}
              />
            )}

            {isPackingListLoading ? (
              <Group justify="center" py="lg"><Loader /></Group>
            ) : filteredPackingList && (filteredPackingList.PackingListPackageOrderItems?.length || 0) > 0 ? (
              <SpecificationProductsGrid
                canEditSpecification={canEditSpecification}
                currencyIsEur={currencyIsEur}
                packingList={filteredPackingList}
                withManagementServices={withManagementServices}
                onEditSpecification={setEditingSpecificationItem}
              />
            ) : (
              <Group gap="xs" c="dimmed">
                <IconFilesOff size={18} />
                <Text size="sm">{t('Немає даних')}</Text>
              </Group>
            )}
          </Stack>
        </Card>
      ) : (
        <Text c="dimmed">{t('Замовлення не знайдено')}</Text>
      )}

      {packingList && (packingList.Id || 0) > 0 && (
        <SpecificationTotals
          currencyIsEur={currencyIsEur}
          invoice={selectedInvoice as unknown as SpecificationSupplyInvoice}
          packingList={packingList}
        />
      )}

      <UploadProductSpecificationModal
	        isLoading={isUploading}
        opened={isUploadOpen}
        onClose={() => {
          if (!isUploading) {
            setUploadOpen(false)
          }
        }}
        onSubmit={submitUpload}
      />
      <UploadProductSpecificationResultModal result={uploadResult} onClose={() => setUploadResult(null)} />
      <UploadDeliveryDocumentsModal
        dateCustomDeclaration={dateCustomDeclaration}
        existingDocuments={existingDocuments}
        isSaving={isSavingDocuments}
        newDocuments={newDocuments}
        numberCustomDeclaration={numberCustomDeclaration}
        opened={isDocumentsOpen}
        onAddFiles={addDocumentFiles}
        onChangeDateCustomDeclaration={setDateCustomDeclaration}
        onChangeNumberCustomDeclaration={setNumberCustomDeclaration}
        onClose={requestCloseDocuments}
        onRemoveExistingDocument={removeExistingDocument}
        onRemoveNewDocument={removeNewDocument}
        onSave={saveDocuments}
      />
      <AppModal
        centered
        opened={isDocumentsCloseConfirmOpen}
        title={t('Є незбережені зміни')}
        onClose={() => {
          if (!isSavingDocuments) {
            setDocumentsCloseConfirmOpen(false)
          }
        }}
      >
        <Stack gap="md">
          <Text>{t('Якщо закрити вікно, зміни по документах доставки не будуть збережені.')}</Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isSavingDocuments} variant="light" onClick={() => setDocumentsCloseConfirmOpen(false)}>
              {t('Залишитися')}
            </Button>
            <Button color="red" disabled={isSavingDocuments} onClick={closeDocumentsDraft}>
              {t('Закрити без збереження')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
      <SpecificationDownloadModal
        document={downloadDocument}
        error={downloadError}
        isLoading={isDownloading}
        opened={isDownloadOpen}
        onClose={() => setDownloadOpen(false)}
      />
      <ProductSpecificationEditDrawer
        canSave={canSaveSpecification}
        isSaving={isSavingSpecification}
        item={editingSpecificationItem}
        onClose={() => setEditingSpecificationItem(null)}
        onSave={saveSpecification}
      />
    </Stack>
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
