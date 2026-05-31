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
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
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
import type { DirectSupplyOrder, SupplyInvoice } from '../types'

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
    setSelectedInvoiceNetId(invoice.NetUid || null)
  }

  function selectPackList(packList: { NetUid?: string }) {
    setSelectedPackListNetId(packList.NetUid || null)
  }

  async function submitUpload(parseConfiguration: ProductSpecificationParseConfiguration, file: File) {
    if (!selectedInvoice?.NetUid) {
      return
    }

    setUploading(true)

    try {
      const result = await uploadProductSpecificationForInvoice(selectedInvoice.NetUid, parseConfiguration, file)
      setUploadOpen(false)
      setUploadResult(result)

      if (selectedPackListNetId) {
        setPackingList(await getPackingListSpecificationProducts(selectedPackListNetId))
      }
    } catch (uploadError) {
      notifications.show({
        color: 'red',
        message: uploadError instanceof Error ? uploadError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setUploading(false)
    }
  }

  function openDocuments() {
    if (!selectedInvoice) {
      notifications.show({ color: 'red', message: t('Інвойс відсутній') })
      return
    }

    setNumberCustomDeclaration(selectedInvoice.NumberCustomDeclaration || '')
    setDateCustomDeclaration(
      selectedInvoice.DateCustomDeclaration
        ? formatLocalDate(new Date(selectedInvoice.DateCustomDeclaration))
        : formatLocalDate(new Date()),
    )
    setExistingDocuments(
      (selectedInvoice.SupplyInvoiceDeliveryDocuments || []).map((document, index) => ({
        contentType: document.ContentType || '',
        deleted: false,
        documentUrl: document.DocumentUrl || '',
        file: null,
        fileName: document.FileName || '',
        id: document.Id || index,
      })),
    )
    setNewDocuments([])
    setDocumentsOpen(true)
  }

  function addDocumentFiles(files: File[]) {
    setNewDocuments((current) => {
      const startId = current.length > 0 ? current[current.length - 1].id + 1 : 0

      return [
        ...current,
        ...files.map((file, index) => {
          const fileInfo = file.name.split('.')

          return {
            contentType: fileInfo[1] || '',
            deleted: false,
            documentUrl: '',
            file,
            fileName: fileInfo[0] || file.name,
            id: startId + index,
          }
        }),
      ]
    })
  }

  function removeNewDocument(document: DeliveryDocumentDraft) {
    setNewDocuments((current) => current.filter((item) => item.id !== document.id))
  }

  function removeExistingDocument(document: DeliveryDocumentDraft) {
    setExistingDocuments((current) =>
      current.map((item) => (item.id === document.id ? { ...item, deleted: !item.deleted } : item)),
    )
  }

  async function saveDocuments() {
    if (!selectedInvoice?.NetUid) {
      return
    }

    setSavingDocuments(true)

    try {
      const invoicePayload: SpecificationSupplyInvoice = {
        ...(selectedInvoice as unknown as SpecificationSupplyInvoice),
        DateCustomDeclaration: dateCustomDeclaration ? new Date(dateCustomDeclaration).toISOString() : undefined,
        NumberCustomDeclaration: numberCustomDeclaration,
        SupplyInvoiceDeliveryDocuments: (selectedInvoice.SupplyInvoiceDeliveryDocuments || []).map((document) => {
          const draft = existingDocuments.find((item) => item.id === document.Id)

          return draft ? { ...document, Deleted: draft.deleted } : document
        }),
      }
      const files = newDocuments.map((document) => document.file).filter((file): file is File => Boolean(file))

      await addDeliveryDocumentsToInvoice(invoicePayload, files)
      setDocumentsOpen(false)
      setNewDocuments([])
      setExistingDocuments([])
      setSelectedInvoice(await getSupplyInvoiceItems(selectedInvoice.NetUid))
      notifications.show({ color: 'green', message: t('Документи збережено') })
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setSavingDocuments(false)
    }
  }

  async function openDownload() {
    if (!selectedPackListNetId) {
      return
    }

    setDownloadOpen(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      setDownloadDocument(await getSpecificationDownloadUrls(selectedPackListNetId))
    } catch (downloadFetchError) {
      setDownloadError(downloadFetchError instanceof Error ? downloadFetchError.message : t('Документ недоступний для завантаження'))
    } finally {
      setDownloading(false)
    }
  }

  async function saveSpecification(payload: ProductSpecificationSubmitPayload) {
    if (!selectedInvoiceNetId) {
      notifications.show({ color: 'red', message: t('Інвойс відсутній') })
      return
    }

    setSavingSpecification(true)

    try {
      await addOrUpdateProductSpecification(selectedInvoiceNetId, payload)

      if (selectedPackListNetId) {
        setPackingList(await getPackingListSpecificationProducts(selectedPackListNetId))
      }

      setEditingSpecificationItem(null)
      notifications.show({ color: 'green', message: t('Зміни збережено') })
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося змінити митний код'),
      })
    } finally {
      setSavingSpecification(false)
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
                  leftSection={<IconFileImport size={16} />}
                  variant="light"
                  onClick={() => setUploadOpen(true)}
                >
                  {t('Завантаження митних кодів')}
                </Button>
              )}
              {canUploadDocuments && (
                <Button
                  disabled={!selectedInvoice}
                  leftSection={<IconFileImport size={16} />}
                  variant="light"
                  onClick={openDocuments}
                >
                  {t('Завантаження документів доставки')}
                </Button>
              )}
              {canDownload && (
                <Button
                  leftSection={<IconDownload size={16} />}
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
                  color={invoice.NetUid === selectedInvoiceNetId ? 'violet' : 'gray'}
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
                    color={packList.NetUid === selectedPackListNetId ? 'violet' : 'gray'}
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
        onClose={() => setUploadOpen(false)}
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
        onClose={() => setDocumentsOpen(false)}
        onRemoveExistingDocument={removeExistingDocument}
        onRemoveNewDocument={removeNewDocument}
        onSave={saveDocuments}
      />
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
