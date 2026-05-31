import {
  ActionIcon,
  Alert,
  Badge,
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
  IconRestore,
  IconRoute,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatLocalDateTime } from '../../../shared/date/dateTime'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  getDirectSupplyOrderById,
  updateDirectSupplyOrder,
  uploadSupplyOrderDocument,
} from '../api/supplyUkraineOrdersApi'
import type {
  DirectSupplyOrder,
  SupplyOrderDeliveryDocument,
  SupplyTransportationTypeValue,
} from '../types'

const TRANSPORTATION_OPTIONS: Array<{ label: string, value: string }> = [
  { label: 'Авто', value: '0' },
  { label: 'Море', value: '1' },
  { label: 'Авіа', value: '2' },
]
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
const numberFormatter = new Intl.NumberFormat('uk-UA')
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function SupplyUkraineDirectOrderDetailPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<DirectSupplyOrder | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transportationType, setTransportationType] = useState('0')
  const [isEditingAmount, setEditingAmount] = useState(false)
  const [amountValue, setAmountValue] = useState<number | string>('')
  const [dateValue, setDateValue] = useState('')
  const [statusDocument, setStatusDocument] = useState<SupplyOrderDeliveryDocument | null>(null)
  const [statusComment, setStatusComment] = useState('')
  const [statusReceived, setStatusReceived] = useState(true)
  const hasInvoices = (order?.SupplyInvoices?.length || 0) > 0
  const isLocked = Boolean(order?.IsOrderShipped) || Boolean(order?.IsCompleted)

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
          setTransportationType(String(nextOrder?.TransportationType ?? 0))
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
      setTransportationType(String(nextOrder?.TransportationType ?? 0))
      syncAmountInputs(nextOrder)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'))
    } finally {
      setLoading(false)
    }
  }

  function syncAmountInputs(nextOrder: DirectSupplyOrder | null) {
    setAmountValue(typeof nextOrder?.NetPrice === 'number' ? nextOrder.NetPrice : '')
    setDateValue(toDateTimeInput(nextOrder?.DateFrom))
    setEditingAmount(false)
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
        setTransportationType(String(updated.TransportationType ?? 0))
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
    setStatusDocument(document)
    setStatusComment(document.Comment || '')
    setStatusReceived(document.IsReceived ?? true)
  }

  function closeStatusModal() {
    setStatusDocument(null)
    setStatusComment('')
    setStatusReceived(true)
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

  function setDocumentDeleted(document: SupplyOrderDeliveryDocument, deleted: boolean) {
    if (!order) {
      return
    }

    const documents = (order.SupplyOrderDeliveryDocuments || []).map((current) =>
      isSameDocument(current, document) ? { ...current, Deleted: deleted } : current)

    savePatch(
      { SupplyOrderDeliveryDocuments: documents },
      deleted ? t('Документ видалено') : t('Документ відновлено'),
    )
  }

  function saveTransportationType() {
    savePatch({
      TransportationType: Number(transportationType) as SupplyTransportationTypeValue,
    }, t('Тип доставки збережено'))
  }

  function approveOrder() {
    savePatch({ IsApproved: true }, t('Замовлення погоджено'))
  }

  const documentColumns = useMemo<DataTableColumn<SupplyOrderDeliveryDocument>[]>(
    () => [
      {
        id: 'name',
        header: t('Документ'),
        minWidth: 220,
        accessor: (document) => document.Name || document.FileName,
        cell: (document) => document.DocumentUrl
          ? <a className="document-link" href={document.DocumentUrl} rel="noreferrer" target="_blank">{document.Name || document.FileName || t('Документ')}</a>
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
                    color="blue"
                    disabled={isSaving || isLocked || document.Deleted || Boolean(document.IsProcessed && document.IsReceived)}
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
                disabled={isSaving || isLocked || document.Deleted || Boolean(document.IsProcessed && document.IsReceived)}
                variant="light"
                onClick={() => openStatusModal(document)}
              >
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
            {document.Deleted ? (
              <Tooltip label={t('Відновити')}>
                <ActionIcon
                  aria-label={t('Відновити')}
                  color="gray"
                  disabled={isSaving || isLocked}
                  variant="light"
                  onClick={() => setDocumentDeleted(document, false)}
                >
                  <IconRestore size={16} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Tooltip label={t('Видалити')}>
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  disabled={isSaving || isLocked}
                  variant="light"
                  onClick={() => setDocumentDeleted(document, true)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, isSaving, isLocked, order],
  )

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm" align="center">
          <Tooltip label={t('Назад')}>
            <ActionIcon
              aria-label={t('Назад')}
              color="gray"
              variant="light"
              onClick={() => navigate('/orders/ukraine/all')}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Stack gap={2}>
            <Text fw={700} size="xl">
              {t('Логістика замовлення')} {getOrderNumber(order)}
            </Text>
            <Text c="dimmed" size="sm">
              {t('Постачальник')}: {getEntityName(order?.Client)}
            </Text>
          </Stack>
        </Group>
        <Group gap="xs" justify="flex-end">
          <Button leftSection={<IconRefresh size={16} />} loading={isLoading} variant="light" onClick={reloadOrder}>
            {t('Оновити')}
          </Button>
          {order && !order.IsApproved && (
            <Button leftSection={<IconCheck size={16} />} loading={isSaving} variant="light" onClick={approveOrder}>
              {t('Погодити')}
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
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : order ? (
        <Stack gap="lg">
          <Card withBorder radius="md" padding="lg">
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
                    disabled={isSaving || Boolean(order.IsOrderShipped)}
                    value={transportationType}
                    onChange={setTransportationType}
                  />
                </Stack>
                <Button
                  disabled={transportationType === String(order.TransportationType ?? 0) || Boolean(order.IsOrderShipped)}
                  loading={isSaving}
                  variant="light"
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
                  onChange={setAmountValue}
                />
                <TextInput
                  disabled={!isEditingAmount || isSaving}
                  label={t('Від якої дати')}
                  type="datetime-local"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.currentTarget.value)}
                />
                {isEditingAmount ? (
                  <Group gap="xs">
                    <Button color="gray" disabled={isSaving} variant="light" onClick={cancelAmountEdit}>
                      {t('Скасувати')}
                    </Button>
                    <Button loading={isSaving} variant="light" onClick={saveAmount}>
                      {t('Оновити')}
                    </Button>
                  </Group>
                ) : (
                  <Button
                    disabled={isLocked}
                    leftSection={<IconPencil size={16} />}
                    variant="light"
                    onClick={() => setEditingAmount(true)}
                  >
                    {t('Редагувати')}
                  </Button>
                )}
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="lg">
            <Group gap="xs" wrap="wrap">
              <Button
                leftSection={<IconFileInvoice size={16} />}
                variant="light"
                onClick={() => navigate(`/orders/ukraine/all/edit/${order.NetUid}/supply-invoices`)}
              >
                {t('Інвойси і пак листи')}
              </Button>
              {hasInvoices && (
                <Button
                  leftSection={<IconListDetails size={16} />}
                  variant="light"
                  onClick={() => navigate(`/orders/ukraine/all/edit/${order.NetUid}/specifications`)}
                >
                  {t('Специфікації')}
                </Button>
              )}
              {hasInvoices && (
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

          <Card withBorder radius="md" padding="lg">
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
            onChange={(event) => setStatusReceived(event.currentTarget.checked)}
          />
          <Textarea
            autosize
            label={t('Коментар')}
            minRows={3}
            value={statusComment}
            onChange={(event) => setStatusComment(event.currentTarget.value)}
          />
          <Group justify="flex-end" gap="xs">
            <Button color="gray" disabled={isSaving} variant="light" onClick={closeStatusModal}>
              {t('Скасувати')}
            </Button>
            <Button loading={isSaving} variant="light" onClick={saveDocumentStatus}>
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
