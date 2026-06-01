import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
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
import {
  IconAlertCircle,
  IconArrowLeft,
  IconFileImport,
  IconPackage,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { useAuth } from '../../auth/useAuth'
import {
  deletePackingList,
  deleteSupplyInvoice,
  getDirectSupplyOrderById,
  getSupplyInvoiceItems,
  getSupplyOrderInvoiceTotals,
  getSupplyOrderItems,
  uploadPackingListFile,
  uploadSupplyInvoiceFile,
} from '../api/supplyUkraineOrdersApi'
import type {
  DirectSupplyOrder,
  PackingList,
  PackingListDocumentParseConfiguration,
  PackingListPackageOrderItem,
  SupplyInvoice,
  SupplyInvoiceOrderItem,
  SupplyOrderDocumentParseConfiguration,
  SupplyOrderInvoiceTotals,
  SupplyOrderItem,
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
const PERMISSION_ADD_PACK_LIST = 'SUPPLY_INVOICES_ordersUkraineAllEdit_NewPackListBtn_PKEY'
const PERMISSION_REMOVE_INVOICE = 'SUPPLY_INVOICES_ordersUkraineAllEdit_RemoveInvoiceBtn_PKEY'
const PERMISSION_REMOVE_PACK_LIST = 'SUPPLY_INVOICES_ordersUkraineAllEdit_RemovePackListBtn_PKEY'

export function SupplyUkraineDirectOrderInvoicesPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<DirectSupplyOrder | null>(null)
  const [orderItems, setOrderItems] = useState<SupplyOrderItem[]>([])
  const [totals, setTotals] = useState<SupplyOrderInvoiceTotals>({})
  const [selectedInvoiceNetId, setSelectedInvoiceNetId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<SupplyInvoice | null>(null)
  const [selectedPackListNetId, setSelectedPackListNetId] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isInvoiceLoading, setInvoiceLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceUploadOpen, setInvoiceUploadOpen] = useState(false)
  const [packListUploadOpen, setPackListUploadOpen] = useState(false)
  const [deleteInvoiceCandidate, setDeleteInvoiceCandidate] = useState<SupplyInvoice | null>(null)
  const [deletePackListCandidate, setDeletePackListCandidate] = useState<PackingList | null>(null)

  const invoices = order?.SupplyInvoices || []
  const selectedPackList = useMemo(
    () => (selectedInvoice?.PackingLists || []).find((packList) => packList.NetUid === selectedPackListNetId) || null,
    [selectedInvoice, selectedPackListNetId],
  )
  const canAddInvoice = hasPermission(PERMISSION_ADD_INVOICE)
  const canAddPackList = hasPermission(PERMISSION_ADD_PACK_LIST)
  const canRemoveInvoice = hasPermission(PERMISSION_REMOVE_INVOICE)
  const canRemovePackList = hasPermission(PERMISSION_REMOVE_PACK_LIST)
  const canShowPackListUpload = Boolean(
    selectedInvoice && canAddPackList && (selectedInvoice.PackingLists?.length || 0) === 0,
  )

  const orderItemColumns = useOrderItemColumns()
  const invoiceItemColumns = useInvoiceItemColumns()
  const packListItemColumns = usePackListItemColumns()
  const orderTotalsToolbar = useMemo(() => <TotalsBadges totals={totals} />, [totals])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      if (!id) {
        setError(t('Не задано ідентифікатор замовлення'))
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const [nextOrder, nextItems, nextTotals] = await Promise.all([
          getDirectSupplyOrderById(id),
          getSupplyOrderItems(id),
          getSupplyOrderInvoiceTotals(id),
        ])

        if (!cancelled) {
          setOrder(nextOrder)
          setOrderItems(nextItems)
          setTotals(nextTotals)
          setSelectedInvoiceNetId((current) => current || nextOrder?.SupplyInvoices?.[0]?.NetUid || null)
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

    void loadData()

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
          setSelectedPackListNetId(invoice?.PackingLists?.[0]?.NetUid || null)
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

  async function reloadOrder(nextSelectedInvoiceNetId = selectedInvoiceNetId) {
    if (!id) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [nextOrder, nextItems, nextTotals] = await Promise.all([
        getDirectSupplyOrderById(id),
        getSupplyOrderItems(id),
        getSupplyOrderInvoiceTotals(id),
      ])

      setOrder(nextOrder)
      setOrderItems(nextItems)
      setTotals(nextTotals)
      const invoiceNetId = nextSelectedInvoiceNetId || nextOrder?.SupplyInvoices?.[0]?.NetUid || null
      setSelectedInvoiceNetId(invoiceNetId)
      if (!invoiceNetId) {
        setSelectedInvoice(null)
        setSelectedPackListNetId(null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'))
    } finally {
      setLoading(false)
    }
  }

  async function submitInvoice(form: InvoiceUploadForm) {
    if (!id) {
      return
    }

    const parseConfiguration = toInvoiceParseConfiguration(form)

    if (!form.file || !form.number.trim() || !parseConfiguration) {
      notifications.show({ color: 'red', message: t('Заповніть файл, номер і колонки імпорту') })
      return
    }

    setSaving(true)

    try {
      const invoice = await uploadSupplyInvoiceFile({
        file: form.file,
        invoice: {
          Comment: form.comment.trim(),
          DateFrom: normalizeDateTimeInput(form.dateFrom),
          Number: form.number.trim(),
        },
        parseConfiguration,
        supplyOrderNetId: id,
      })

      notifications.show({ color: 'green', message: t('Інвойс завантажено') })
      setInvoiceUploadOpen(false)
      await reloadOrder(invoice?.NetUid || selectedInvoiceNetId)
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит') })
    } finally {
      setSaving(false)
    }
  }

  async function submitPackList(form: PackListUploadForm) {
    if (!selectedInvoice?.NetUid) {
      notifications.show({ color: 'red', message: t('Оберіть інвойс') })
      return
    }

    const parseConfiguration = toPackListParseConfiguration(form)

    if (!form.file || !form.number.trim() || !parseConfiguration) {
      notifications.show({ color: 'red', message: t('Заповніть файл, номер і колонки імпорту') })
      return
    }

    setSaving(true)

    try {
      const packList = await uploadPackingListFile({
        file: form.file,
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
      setPackListUploadOpen(false)
      await reloadOrder(selectedInvoice.NetUid)
      setSelectedPackListNetId(packList?.NetUid || null)
    } catch (saveError) {
      notifications.show({ color: 'red', message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит') })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteInvoice() {
    if (!deleteInvoiceCandidate?.NetUid) {
      setDeleteInvoiceCandidate(null)
      return
    }

    setSaving(true)

    try {
      await deleteSupplyInvoice(deleteInvoiceCandidate.NetUid)
      notifications.show({ color: 'green', message: t('Інвойс видалено') })
      setDeleteInvoiceCandidate(null)
      setSelectedInvoiceNetId(null)
      setSelectedInvoice(null)
      setSelectedPackListNetId(null)
      await reloadOrder(null)
    } catch (deleteError) {
      notifications.show({ color: 'red', message: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити інвойс') })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeletePackList() {
    if (!deletePackListCandidate?.NetUid) {
      setDeletePackListCandidate(null)
      return
    }

    setSaving(true)

    try {
      await deletePackingList(deletePackListCandidate.NetUid)
      notifications.show({ color: 'green', message: t('Пак лист видалено') })
      setDeletePackListCandidate(null)
      await reloadOrder(selectedInvoiceNetId)
    } catch (deleteError) {
      notifications.show({ color: 'red', message: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити пак лист') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
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
            <Text fw={700} size="xl">{t('Інвойси і пак листи')} {getOrderNumber(order)}</Text>
            <Text c="dimmed" size="sm">{t('Постачальник')}: {getEntityName(order?.Client)}</Text>
          </Stack>
        </Group>
        <Group gap="xs">
          <Button leftSection={<IconRefresh size={16} />} loading={isLoading} variant="light" onClick={() => reloadOrder()}>
            {t('Оновити')}
          </Button>
          {canAddInvoice && (
            <Button leftSection={<IconFileImport size={16} />} variant="light" onClick={() => setInvoiceUploadOpen(true)}>
              {t('Додати інвойс')}
            </Button>
          )}
          {canShowPackListUpload && (
            <Button
              leftSection={<IconPackage size={16} />}
              variant="light"
              onClick={() => setPackListUploadOpen(true)}
            >
              {t('Додати пак лист')}
            </Button>
          )}
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
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
            <TotalCard label={t('Рядків замовлення')} value={String(orderItems.length)} />
            <TotalCard label={t('Інвойсів')} value={String(invoices.length)} />
            <TotalCard label={t('Кількість')} value={formatNumber(order.TotalQuantity)} />
            <TotalCard label={t('Сума')} value={formatMoney(order.TotalNetPrice)} />
          </SimpleGrid>

          <Tabs defaultValue="products" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="products">{t('Товари замовлення')}</Tabs.Tab>
              <Tabs.Tab value="invoices">{t('Інвойси')}</Tabs.Tab>
              <Tabs.Tab value="packlists" disabled={!selectedInvoice}>{t('Пак листи')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="products" pt="md">
              <Card withBorder radius="md" padding="md">
                <DataTable
                  columns={orderItemColumns}
                  data={orderItems}
                  emptyText={t('Товарів немає')}
                  getRowId={(item, index) => item.NetUid || String(item.Id || index)}
                  layoutVersion="supply-direct-order-items-1"
                  minWidth={980}
                  tableId="supply-direct-order-items"
                  toolbarLeft={orderTotalsToolbar}
                />
              </Card>
            </Tabs.Panel>

            <Tabs.Panel value="invoices" pt="md">
              <Card withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Group gap="xs" wrap="wrap">
                    {invoices.map((invoice) => (
                      <Group key={invoice.NetUid || invoice.Id} gap={4} wrap="nowrap">
                        <Button
                          color={invoice.NetUid === selectedInvoiceNetId ? 'blue' : 'gray'}
                          variant={invoice.NetUid === selectedInvoiceNetId ? 'filled' : 'light'}
                          onClick={() => setSelectedInvoiceNetId(invoice.NetUid || null)}
                        >
                          {invoice.Number || t('Інвойс')} ({formatDate(invoice.DateFrom)})
                        </Button>
                        {canRemoveInvoice && (
                          <Tooltip label={t('Видалити')}>
                            <ActionIcon
                              aria-label={t('Видалити')}
                              color="red"
                              size="xs"
                              variant="subtle"
                              onClick={() => setDeleteInvoiceCandidate(invoice)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    ))}
                  </Group>

                  {isInvoiceLoading ? (
                    <Group justify="center" py="md"><Loader size="sm" /></Group>
                  ) : (
                    <DataTable
                      columns={invoiceItemColumns}
                      data={selectedInvoice?.SupplyInvoiceOrderItems || []}
                      emptyText={t('Рядків інвойсу немає')}
                      getRowId={(item, index) => item.NetUid || String(item.Id || index)}
                      layoutVersion="supply-direct-invoice-items-1"
                      minWidth={980}
                      tableId="supply-direct-invoice-items"
                    />
                  )}
                </Stack>
              </Card>
            </Tabs.Panel>

            <Tabs.Panel value="packlists" pt="md">
              <Card withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Group gap="xs" wrap="wrap">
                    {(selectedInvoice?.PackingLists || []).map((packList) => (
                      <Group key={packList.NetUid || packList.Id} gap={4} wrap="nowrap">
                        <Button
                          color={packList.NetUid === selectedPackListNetId ? 'blue' : 'gray'}
                          variant={packList.NetUid === selectedPackListNetId ? 'filled' : 'light'}
                          onClick={() => setSelectedPackListNetId(packList.NetUid || null)}
                        >
                          {packList.No || packList.InvNo || t('Пак лист')} ({formatDate(packList.FromDate)})
                        </Button>
                        {canRemovePackList && (
                          <Tooltip label={t('Видалити')}>
                            <ActionIcon
                              aria-label={t('Видалити')}
                              color="red"
                              size="xs"
                              variant="subtle"
                              onClick={() => setDeletePackListCandidate(packList)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    ))}
                  </Group>

                  <DataTable
                    columns={packListItemColumns}
                    data={selectedPackList?.PackingListPackageOrderItems || []}
                    emptyText={t('Рядків пак листа немає')}
                    getRowId={(item, index) => item.NetUid || String(item.Id || index)}
                    layoutVersion="supply-direct-pack-list-items-1"
                    minWidth={980}
                    tableId="supply-direct-pack-list-items"
                  />
                </Stack>
              </Card>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      ) : (
        <Text c="dimmed">{t('Замовлення не знайдено')}</Text>
      )}

      <InvoiceUploadModal
        isSaving={isSaving}
        opened={invoiceUploadOpen}
        onClose={() => setInvoiceUploadOpen(false)}
        onSubmit={submitInvoice}
      />
      <PackListUploadModal
        isSaving={isSaving}
        opened={packListUploadOpen}
        onClose={() => setPackListUploadOpen(false)}
        onSubmit={submitPackList}
      />
      <DeleteModal
        isSaving={isSaving}
        opened={Boolean(deleteInvoiceCandidate)}
        title={t('Видалити інвойс')}
        value={deleteInvoiceCandidate?.Number || ''}
        onClose={() => setDeleteInvoiceCandidate(null)}
        onConfirm={confirmDeleteInvoice}
      />
      <DeleteModal
        isSaving={isSaving}
        opened={Boolean(deletePackListCandidate)}
        title={t('Видалити пак лист')}
        value={deletePackListCandidate?.No || deletePackListCandidate?.InvNo || ''}
        onClose={() => setDeletePackListCandidate(null)}
        onConfirm={confirmDeletePackList}
      />
    </Stack>
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
            onChange={(event) => setForm((current) => ({ ...current, number: event.currentTarget.value }))}
          />
          <TextInput
            disabled={isSaving}
            label={t('Дата')}
            type="datetime-local"
            value={form.dateFrom}
            onChange={(event) => setForm((current) => ({ ...current, dateFrom: event.currentTarget.value }))}
          />
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
          onChange={(event) => setForm((current) => ({ ...current, productIsImported: event.currentTarget.checked }))}
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
            onChange={(event) => setForm((current) => ({ ...current, number: event.currentTarget.value }))}
          />
          <TextInput
            disabled={isSaving}
            label={t('Дата')}
            type="datetime-local"
            value={form.dateFrom}
            onChange={(event) => setForm((current) => ({ ...current, dateFrom: event.currentTarget.value }))}
          />
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
          onChange={(event) => setForm((current) => ({ ...current, isWeightPerUnit: event.currentTarget.checked }))}
        />
        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={close}>{t('Скасувати')}</Button>
          <Button loading={isSaving} onClick={() => onSubmit(form)}>{t('Створити')}</Button>
        </Group>
      </Stack>
    </AppModal>
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

function useOrderItemColumns(): DataTableColumn<SupplyOrderItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyOrderItem>[]>(
    () => [
      { id: 'code', header: t('Код'), width: 130, accessor: (item) => item.Product?.VendorCode, cell: (item) => item.Product?.VendorCode || '-' },
      { id: 'name', header: t('Товар'), minWidth: 260, accessor: (item) => item.Product?.Name, cell: (item) => item.Product?.Name || item.Product?.NameUA || '-' },
      { id: 'qty', header: t('Кількість'), width: 120, align: 'right', accessor: (item) => item.Qty, cell: (item) => formatNumber(item.Qty) },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => formatMoney(item.UnitPrice) },
      { id: 'total', header: t('Сума'), width: 130, align: 'right', accessor: (item) => getOrderItemTotal(item), cell: (item) => formatMoney(getOrderItemTotal(item)) },
      { id: 'placed', header: t('Розміщено'), width: 120, accessor: (item) => item.IsPlaced, cell: (item) => <Badge color={item.IsPlaced ? 'green' : 'gray'} variant="light">{item.IsPlaced ? t('Так') : t('Ні')}</Badge> },
    ],
    [t],
  )
}

function useInvoiceItemColumns(): DataTableColumn<SupplyInvoiceOrderItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyInvoiceOrderItem>[]>(
    () => [
      { id: 'code', header: t('Код'), width: 130, accessor: (item) => item.Product?.VendorCode, cell: (item) => item.Product?.VendorCode || '-' },
      { id: 'name', header: t('Товар'), minWidth: 260, accessor: (item) => item.Product?.Name, cell: (item) => item.Product?.Name || item.Product?.NameUA || '-' },
      { id: 'qty', header: t('Кількість'), width: 120, align: 'right', accessor: (item) => item.Qty, cell: (item) => formatNumber(item.Qty) },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => formatMoney(item.UnitPrice) },
      { id: 'total', header: t('Сума'), width: 130, align: 'right', accessor: (item) => item.TotalAmount, cell: (item) => formatMoney(item.TotalAmount || (item.UnitPrice || 0) * (item.Qty || 0)) },
      { id: 'imported', header: t('Імпорт'), width: 110, accessor: (item) => item.ProductIsImported, cell: (item) => <Badge color={item.ProductIsImported ? 'green' : 'gray'} variant="light">{item.ProductIsImported ? t('Так') : t('Ні')}</Badge> },
    ],
    [t],
  )
}

function usePackListItemColumns(): DataTableColumn<PackingListPackageOrderItem>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<PackingListPackageOrderItem>[]>(
    () => [
      { id: 'code', header: t('Код'), width: 130, accessor: (item) => item.SupplyInvoiceOrderItem?.Product?.VendorCode, cell: (item) => item.SupplyInvoiceOrderItem?.Product?.VendorCode || '-' },
      { id: 'name', header: t('Товар'), minWidth: 260, accessor: (item) => item.SupplyInvoiceOrderItem?.Product?.Name, cell: (item) => item.SupplyInvoiceOrderItem?.Product?.Name || item.SupplyInvoiceOrderItem?.Product?.NameUA || '-' },
      { id: 'qty', header: t('Кількість'), width: 120, align: 'right', accessor: (item) => item.Qty, cell: (item) => formatNumber(item.Qty) },
      { id: 'net', header: t('Нетто'), width: 120, align: 'right', accessor: (item) => item.TotalNetWeight, cell: (item) => formatNumber(item.TotalNetWeight) },
      { id: 'gross', header: t('Брутто'), width: 120, align: 'right', accessor: (item) => item.TotalGrossWeight, cell: (item) => formatNumber(item.TotalGrossWeight) },
      { id: 'price', header: t('Ціна'), width: 120, align: 'right', accessor: (item) => item.UnitPrice, cell: (item) => formatMoney(item.UnitPrice) },
      { id: 'total', header: t('Сума'), width: 130, align: 'right', accessor: (item) => item.TotalGrossPrice, cell: (item) => formatMoney(item.TotalGrossPrice) },
    ],
    [t],
  )
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

function getEntityName(entity?: { FullName?: string, Name?: string } | null): string {
  return entity?.FullName || entity?.Name || '-'
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
