import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconDownload,
  IconFileImport,
  IconFilesOff,
  IconLayersIntersect,
} from '@tabler/icons-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { getProtocolByNetId } from '../api/productDeliveryProtocolsApi'
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
import type {
  DeliveryDocumentDraft,
  PackingListPackageOrderItem,
  ProductSpecificationParseConfiguration,
  SpecificationDownloadDocument,
  SpecificationPackingList,
  SpecificationProtocol,
  SpecificationSupplyInvoice,
  UploadProductSpecificationResult,
} from '../specificationTypes'

const invoiceDateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })
const CURRENCY_EUR = 'eur'
const CURRENCY_UAH = 'uah'
const SERVICES_MANAGEMENT = 'management'
const SERVICES_ACCOUNTING = 'accounting'
const PERMISSION_UPLOAD_SPECIFICATIONS = 'ProductDeliveryProtocols_specifications_download_exel_upload_PKEY'
const PERMISSION_UPLOAD_DELIVERY_DOCUMENTS =
  'ProductDeliveryProtocols_specifications_download_exel_upload_documents_PKEY'
const PERMISSION_DOWNLOAD_SPECIFICATION = 'ProductDeliveryProtocols_specifications_download_exel_PKEY'
const PERMISSION_EDIT_SPECIFICATION_CODE = 'SPECIFICATION_CODES_ordersUkraineAllEdit_SaveModalBtn_PKEY'

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

function useSpecificationModel(netId: string | undefined) {
  const { t } = useI18n()
  const [protocol, setProtocol] = useValueState<SpecificationProtocol | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [selectedInvoiceNetId, setSelectedInvoiceNetId] = useValueState<string | null>(null)
  const [selectedPackListNetId, setSelectedPackListNetId] = useValueState<string | null>(null)
  const [packingList, setPackingList] = useValueState<SpecificationPackingList | null>(null)
  const [isPackingListLoading, setPackingListLoading] = useValueState(false)
  const [packingListError, setPackingListError] = useValueState<string | null>(null)
  const [currencyIsEur, setCurrencyIsEur] = useValueState(true)
  const [withManagementServices, setWithManagementServices] = useValueState(false)

  const [isUploadOpen, setUploadOpen] = useValueState(false)
  const [isUploading, setUploading] = useValueState(false)
  const [uploadResult, setUploadResult] = useValueState<UploadProductSpecificationResult | null>(null)

  const [isDocumentsOpen, setDocumentsOpen] = useValueState(false)
  const [isSavingDocuments, setSavingDocuments] = useValueState(false)
  const [existingDocuments, setExistingDocuments] = useValueState<DeliveryDocumentDraft[]>([])
  const [newDocuments, setNewDocuments] = useValueState<DeliveryDocumentDraft[]>([])
  const [numberCustomDeclaration, setNumberCustomDeclaration] = useValueState('')
  const [dateCustomDeclaration, setDateCustomDeclaration] = useValueState('')

  const [isMergeOpen, setMergeOpen] = useValueState(false)
  const [isMerging, setMerging] = useValueState(false)
  const [selectedMergeNetIds, setSelectedMergeNetIds] = useValueState<string[]>([])

  const [isDownloadOpen, setDownloadOpen] = useValueState(false)
  const [isDownloading, setDownloading] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<SpecificationDownloadDocument | null>(null)
  const [downloadError, setDownloadError] = useValueState<string | null>(null)
  const [editingSpecificationItem, setEditingSpecificationItem] = useValueState<PackingListPackageOrderItem | null>(null)
  const [isSavingSpecification, setSavingSpecification] = useValueState(false)

  const navigate = useNavigate()

  useEffect(() => {
    if (!netId) {
      setProtocol(null)
      setLoading(false)
      setError(t('Помилка'))

      return
    }

    let cancelled = false

    async function loadProtocol(currentNetId: string) {
      setLoading(true)
      setError(null)

      try {
        const result = await getProtocolByNetId(currentNetId)

        if (cancelled) {
          return
        }

        if (result) {
          const protocolResult = result as unknown as SpecificationProtocol
          setProtocol(protocolResult)
          setSelectedMergeNetIds(
            (protocolResult.SupplyInvoices || [])
              .map((invoice) => invoice.NetUid)
              .filter((value): value is string => Boolean(value)),
          )

          const firstInvoice = protocolResult.SupplyInvoices?.find(
            (invoice) => (invoice.PackingLists?.length || 0) > 0,
          )

          if (firstInvoice?.NetUid && firstInvoice.PackingLists?.[0]?.NetUid) {
            setSelectedInvoiceNetId(firstInvoice.NetUid)
            setSelectedPackListNetId(firstInvoice.PackingLists[0].NetUid || null)
          }
        } else {
          setProtocol(null)
          setError(t('Помилка'))
        }
      } catch (loadError) {
        if (!cancelled) {
          setProtocol(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити протокол'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProtocol(netId)

    return () => {
      cancelled = true
    }
  }, [
    netId,
    setError,
    setLoading,
    setProtocol,
    setSelectedInvoiceNetId,
    setSelectedMergeNetIds,
    setSelectedPackListNetId,
    t,
  ])

  useEffect(() => {
    if (!selectedPackListNetId) {
      setPackingList(null)

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
  }, [selectedPackListNetId, setPackingList, setPackingListError, setPackingListLoading, t])

  const selectedInvoice =
    protocol?.SupplyInvoices?.find((invoice) => invoice.NetUid === selectedInvoiceNetId) || null

  function selectInvoice(invoice: SpecificationSupplyInvoice) {
    if (!invoice.PackingLists || invoice.PackingLists.length === 0) {
      notifications.show({ color: 'red', message: t('В інвойсі відсутні пак лісти') })

      return
    }

    setSelectedInvoiceNetId(invoice.NetUid || null)
    setSelectedPackListNetId(invoice.PackingLists[0].NetUid || null)
  }

  function selectPackList(packList: SpecificationPackingList) {
    setSelectedPackListNetId(packList.NetUid || null)
  }

  async function reloadProtocol(): Promise<SpecificationProtocol | null> {
    if (!netId) {
      return null
    }

    const result = await getProtocolByNetId(netId)
    const protocolResult = result ? (result as unknown as SpecificationProtocol) : null
    setProtocol(protocolResult)

    return protocolResult
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
        const refreshed = await getPackingListSpecificationProducts(selectedPackListNetId)
        setPackingList(refreshed)
      }

      await reloadProtocol()
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

      const additions = files.map((file, index) => {
        const parts = file.name.split('.')

        return {
          contentType: parts.length > 1 ? parts[parts.length - 1] : '',
          deleted: false,
          documentUrl: '',
          file,
          fileName: parts[0],
          id: startId + index,
        }
      })

      return [...current, ...additions]
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
    if (!selectedInvoice?.NetUid || (selectedInvoice.PackingLists?.length || 0) === 0) {
      notifications.show({ color: 'red', message: t('В інвойсі відсутні пак лісти') })

      return
    }

    setSavingDocuments(true)

    try {
      const invoicePayload: SpecificationSupplyInvoice = {
        ...selectedInvoice,
        DateCustomDeclaration: dateCustomDeclaration
          ? new Date(dateCustomDeclaration).toISOString()
          : new Date().toISOString(),
        NumberCustomDeclaration: numberCustomDeclaration,
        SupplyInvoiceDeliveryDocuments: (selectedInvoice.SupplyInvoiceDeliveryDocuments || []).map((document) => {
          const draft = existingDocuments.find((item) => item.id === document.Id)

          return draft ? { ...document, Deleted: draft.deleted } : document
        }),
      }

      const files = newDocuments.map((document) => document.file).filter((file): file is File => Boolean(file))
      const updated = await addDeliveryDocumentsToInvoice(invoicePayload, files)

      if (updated) {
        setProtocol(updated)
      } else {
        await reloadProtocol()
      }

      setDocumentsOpen(false)
      setNewDocuments([])
      setExistingDocuments([])
      notifications.show({ color: 'green', message: t('Зберегти') })
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setSavingDocuments(false)
    }
  }

  function openMerge() {
    setSelectedMergeNetIds(
      (protocol?.SupplyInvoices || [])
        .map((invoice) => invoice.NetUid)
        .filter((value): value is string => Boolean(value)),
    )
    setMergeOpen(true)
  }

  function toggleMergeInvoice(invoiceNetId: string) {
    setSelectedMergeNetIds((current) =>
      current.includes(invoiceNetId)
        ? current.filter((value) => value !== invoiceNetId)
        : [...current, invoiceNetId],
    )
  }

  async function confirmMerge() {
    if (!netId) {
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
    if (!selectedPackListNetId) {
      return
    }

    setDownloadOpen(true)
    setDownloadDocument(null)
    setDownloadError(null)
    setDownloading(true)

    try {
      const document = await getSpecificationDownloadUrls(selectedPackListNetId)
      setDownloadDocument(document)
    } catch (downloadFetchError) {
      setDownloadError(
        downloadFetchError instanceof Error
          ? downloadFetchError.message
          : t('Документ недоступний для завантаження'),
      )
    } finally {
      setDownloading(false)
    }
  }

  function openSpecificationEditor(item: PackingListPackageOrderItem) {
    setEditingSpecificationItem(item)
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
        const refreshed = await getPackingListSpecificationProducts(selectedPackListNetId)
        setPackingList(refreshed)
      }

      await reloadProtocol()
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

  return {
    addDocumentFiles, confirmMerge, currencyIsEur, dateCustomDeclaration, downloadDocument, downloadError,
    editingSpecificationItem, error, existingDocuments, isDocumentsOpen, isDownloadOpen, isDownloading, isLoading,
    isMergeOpen, isMerging, isPackingListLoading, isSavingDocuments, isSavingSpecification, isUploading,
    isUploadOpen, newDocuments, numberCustomDeclaration, openDocuments, openDownload, openMerge,
    openSpecificationEditor, packingList, packingListError, protocol, removeExistingDocument,
    removeNewDocument, saveDocuments, selectInvoice, selectPackList, selectedInvoice, selectedInvoiceNetId,
    selectedMergeNetIds, selectedPackListNetId, setCurrencyIsEur, setDateCustomDeclaration, setDocumentsOpen,
    setDownloadOpen, setEditingSpecificationItem, setMergeOpen, setNumberCustomDeclaration, setUploadOpen,
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
  const invoices = model.protocol?.SupplyInvoices || []
  const canMerge = invoices.length > 1
  const canDownload =
    hasPermission(PERMISSION_DOWNLOAD_SPECIFICATION) && Boolean(model.packingList && (model.packingList.Id || 0) > 0)
  const canUpload =
    hasPermission(PERMISSION_UPLOAD_SPECIFICATIONS) && Boolean(model.selectedInvoice && (model.selectedInvoice.Id || 0) > 0)
  const canUploadDocuments = hasPermission(PERMISSION_UPLOAD_DELIVERY_DOCUMENTS)
  const canEditSpecification = hasPermission(PERMISSION_EDIT_SPECIFICATION_CODE)
  const currencyOptions = [
    { label: t('EUR'), value: CURRENCY_EUR },
    { label: t('UAH'), value: CURRENCY_UAH },
  ]
  const serviceModeOptions = [
    { label: 'УО', value: SERVICES_MANAGEMENT },
    { label: 'БО', value: SERVICES_ACCOUNTING },
  ]

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Group gap="sm" align="center">
          <Tooltip label={t('Назад')}>
            <ActionIcon
              aria-label={t('Назад')}
              color="gray"
              variant="light"
              onClick={() => navigate('/product-delivery-protocols')}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Text fw={700} size="lg">
            {t('Митні коди згідно протоколу')}
            {model.protocol?.DeliveryProductProtocolNumber?.Number
              ? ` (${model.protocol.DeliveryProductProtocolNumber.Number})`
              : ''}
          </Text>
        </Group>
        <Group gap="sm" align="center">
          <SegmentedControl
            data={currencyOptions}
            value={model.currencyIsEur ? CURRENCY_EUR : CURRENCY_UAH}
            onChange={(value) => model.setCurrencyIsEur(value === CURRENCY_EUR)}
          />
          <SegmentedControl
            data={serviceModeOptions}
            value={model.withManagementServices ? SERVICES_MANAGEMENT : SERVICES_ACCOUNTING}
            onChange={(value) => model.setWithManagementServices(value === SERVICES_MANAGEMENT)}
          />
        </Group>
      </Group>

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
        <Stack gap="lg">
          <Card withBorder radius="md" padding="md">
            <Stack gap="md">
              <Group justify="flex-end" gap="xs">
                {canUpload && (
                  <Button
                    color="violet"
                    leftSection={<IconFileImport size={16} />}
                    variant="light"
                    onClick={() => model.setUploadOpen(true)}
                  >
                    {t('Завантаження митних кодів')}
                  </Button>
                )}
                {canUploadDocuments && (
                  <Button
                    color="gray"
                    leftSection={<IconFileImport size={16} />}
                    variant="light"
                    onClick={model.openDocuments}
                  >
                    {t('Завантаження документів доставки')}
                  </Button>
                )}
                {canMerge && (
                  <Button
                    color="gray"
                    leftSection={<IconLayersIntersect size={16} />}
                    variant="light"
                    onClick={model.openMerge}
                  >
                    {t("Об'єднати інвойси?")}
                  </Button>
                )}
                {canDownload && (
                  <Button
                    color="gray"
                    leftSection={<IconDownload size={16} />}
                    variant="light"
                    onClick={model.openDownload}
                  >
                    {t('Завантажити')}
                  </Button>
                )}
              </Group>

              <Group gap="xs" wrap="wrap">
                {invoices.map((invoice) => (
                  <Button
                    key={invoice.NetUid || invoice.Id}
                    color={invoice.NetUid === model.selectedInvoiceNetId ? 'violet' : 'gray'}
                    variant={invoice.NetUid === model.selectedInvoiceNetId ? 'filled' : 'light'}
                    onClick={() => model.selectInvoice(invoice)}
                  >
                    <Stack gap={0} align="flex-start">
                      <Text size="sm">
                        {t('Інвойс')} {invoice.Number} {t('Від')} {invoiceDate(invoice.DateFrom)}
                        {(invoice.MergedSupplyInvoices || [])
                          .map((merged) => ` /${merged.Number} ${t('Від')} ${invoiceDate(merged.DateFrom)}`)
                          .join('')}
                      </Text>
                      <Text c="dimmed" size="xs">
                        {t('Постачальник')}: {invoice.SupplyOrder?.Client?.FullName || ''}
                      </Text>
                    </Stack>
                  </Button>
                ))}
              </Group>

              {model.selectedInvoice && (model.selectedInvoice.PackingLists?.length || 0) > 0 && (
                <Group gap="xs" wrap="wrap">
                  {(model.selectedInvoice.PackingLists || []).map((packList) => (
                    <Button
                      key={packList.NetUid || packList.Id}
                      color={packList.NetUid === model.selectedPackListNetId ? 'violet' : 'gray'}
                      size="xs"
                      variant={packList.NetUid === model.selectedPackListNetId ? 'outline' : 'subtle'}
                      onClick={() => model.selectPackList(packList)}
                    >
                      {t('Пак ліст')} №: {packList.InvNo} ({t('Від')} {invoiceDate(packList.FromDate)})
                      {(packList.MergedPackingLists || [])
                        .map((merged) => ` /${merged.No} (${t('Від')} ${invoiceDate(merged.FromDate)})`)
                        .join('')}
                    </Button>
                  ))}
                </Group>
              )}

              {model.packingListError && (
                <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                  {model.packingListError}
                </Alert>
              )}

              {model.isPackingListLoading ? (
                <Text c="dimmed" size="sm">
                  {t('Завантаження')}
                </Text>
              ) : model.packingList && (model.packingList.PackingListPackageOrderItems?.length || 0) > 0 ? (
                <SpecificationProductsGrid
                  canEditSpecification={canEditSpecification}
                  currencyIsEur={model.currencyIsEur}
                  packingList={model.packingList}
                  withManagementServices={model.withManagementServices}
                  onEditSpecification={model.openSpecificationEditor}
                />
              ) : (
                <Group gap="xs" c="dimmed">
                  <IconFilesOff size={18} />
                  <Text size="sm">{t('Немає даних')}</Text>
                </Group>
              )}
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

      <UploadProductSpecificationModal
        isLoading={model.isUploading}
        opened={model.isUploadOpen}
        onClose={() => model.setUploadOpen(false)}
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
        onAddFiles={model.addDocumentFiles}
        onChangeDateCustomDeclaration={model.setDateCustomDeclaration}
        onChangeNumberCustomDeclaration={model.setNumberCustomDeclaration}
        onClose={() => model.setDocumentsOpen(false)}
        onRemoveExistingDocument={model.removeExistingDocument}
        onRemoveNewDocument={model.removeNewDocument}
        onSave={model.saveDocuments}
      />

      <MergeInvoicesModal
        invoices={invoices}
        isMerging={model.isMerging}
        opened={model.isMergeOpen}
        selectedNetIds={model.selectedMergeNetIds}
        onClose={() => model.setMergeOpen(false)}
        onConfirm={model.confirmMerge}
        onToggle={model.toggleMergeInvoice}
      />

      <SpecificationDownloadModal
        document={model.downloadDocument}
        error={model.downloadError}
        isLoading={model.isDownloading}
        opened={model.isDownloadOpen}
        onClose={() => model.setDownloadOpen(false)}
      />

      <ProductSpecificationEditDrawer
        isSaving={model.isSavingSpecification}
        item={model.editingSpecificationItem}
        onClose={() => model.setEditingSpecificationItem(null)}
        onSave={model.saveSpecification}
      />
    </Stack>
  )
}
