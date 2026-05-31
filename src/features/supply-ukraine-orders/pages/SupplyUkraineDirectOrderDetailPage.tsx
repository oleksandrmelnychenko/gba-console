import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
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
  IconRefresh,
  IconRoute,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import {
  getDirectSupplyOrderById,
  updateDirectSupplyOrder,
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
  const hasInvoices = (order?.SupplyInvoices?.length || 0) > 0
  const documentColumns = useDeliveryDocumentColumns()

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити замовлення'))
    } finally {
      setLoading(false)
    }
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
      notifications.show({ color: 'green', message: successMessage })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти замовлення'))
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

function useDeliveryDocumentColumns(): DataTableColumn<SupplyOrderDeliveryDocument>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<SupplyOrderDeliveryDocument>[]>(
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
        minWidth: 220,
        accessor: (document) => document.Comment,
        cell: (document) => document.Comment || '-',
      },
    ],
    [t],
  )
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
