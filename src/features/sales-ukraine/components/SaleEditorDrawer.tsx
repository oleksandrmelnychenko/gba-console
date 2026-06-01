import { Alert, Badge, Card, Group, Loader, Stack, Tabs, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { getSaleById } from '../api/salesUkraineApi'
import type { SalesUkraineOrderItem, SalesUkraineSale } from '../types'

const amountFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

export function SaleEditorDrawer({ sale, onClose }: { onClose: () => void; sale: SalesUkraineSale | null }) {
  const { t } = useI18n()

  return (
    <AppDrawer
      offset={8}
      opened={Boolean(sale)}
      padding="lg"
      position="right"
      radius="md"
      size="min(1080px, 100vw)"
      title={sale ? `${t('Продаж')} ${sale.SaleNumber?.Value || ''}`.trim() : t('Продаж')}
      onClose={onClose}
    >
      {sale && <SaleEditorContent key={sale.NetUid || sale.Id} initialSale={sale} />}
    </AppDrawer>
  )
}

function SaleEditorContent({ initialSale }: { initialSale: SalesUkraineSale }) {
  const { t } = useI18n()
  const [sale, setSale] = useValueState<SalesUkraineSale>(initialSale)
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    const netId = initialSale.NetUid

    if (!netId) {
      setLoading(false)

      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function load(id: string) {
      try {
        const next = await getSaleById(id)

        if (!cancelled && next) {
          setSale(next)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продаж'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load(netId)

    return () => {
      cancelled = true
    }
  }, [initialSale.NetUid, setError, setLoading, setSale, t])

  const orderItems = Array.isArray(sale.Order?.OrderItems) ? sale.Order.OrderItems : []
  const itemColumns = useItemColumns()

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Text fw={700} size="lg">
              {displayValue(getClientName(sale))}
            </Text>
            <Text size="sm" c="dimmed">
              {displayValue(sale.ClientAgreement?.Agreement?.Name)}
            </Text>
            <Text size="xs" c="dimmed">
              {displayValue(sale.ClientAgreement?.Agreement?.Organization?.Name)}
            </Text>
          </Stack>
          <Stack gap={4} align="flex-end">
            <Group gap="xs">
              {sale.IsVatSale && (
                <Badge color="blue" variant="light">
                  {t('ПДВ')}
                </Badge>
              )}
              {sale.IsLocked && (
                <Badge color="red" variant="light">
                  {t('Заблоковано')}
                </Badge>
              )}
              {isLoading && <Loader size="xs" />}
            </Group>
            <Text fw={700} size="lg">
              {amountFormatter.format(getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount) ?? 0)}{' '}
              {sale.ClientAgreement?.Agreement?.Currency?.Code || ''}
            </Text>
            <Text size="xs" c="dimmed">
              {t('ПДВ')}: {amountFormatter.format(getNumber(sale.Order?.TotalVat) ?? 0)}
            </Text>
          </Stack>
        </Group>
      </Card>

      <Tabs defaultValue="products">
        <Tabs.List>
          <Tabs.Tab value="products">
            {t('Товари')} ({orderItems.length})
          </Tabs.Tab>
          <Tabs.Tab value="client">{t('Клієнт')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="products" pt="md">
          <DataTable
            columns={itemColumns}
            data={orderItems}
            emptyText={t('Товарів не знайдено')}
            getRowId={(item, index) => String(item.NetUid || item.Id || index)}
            isLoading={isLoading}
            layoutVersion="sales-ukraine-editor-items-1"
            loadingText={t('Завантаження товарів')}
            maxHeight="calc(100vh - 320px)"
            minWidth={820}
            tableId="sales-ukraine-editor-items"
          />
        </Tabs.Panel>

        <Tabs.Panel value="client" pt="md">
          <Stack gap={6}>
            <DetailRow label={t('Клієнт')} value={getClientName(sale)} />
            <DetailRow label={t('Договір')} value={sale.ClientAgreement?.Agreement?.Name} />
            <DetailRow label={t('Організація')} value={sale.ClientAgreement?.Agreement?.Organization?.Name} />
            <DetailRow label={t('Валюта')} value={sale.ClientAgreement?.Agreement?.Currency?.Code} />
            <DetailRow label={t('Менеджер')} value={getUserName(sale)} />
            <DetailRow label={t('Перевізник')} value={sale.Transporter?.Name || sale.Transporter?.Title} />
            <DetailRow label={t('Коментар')} value={sale.Comment} />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

function useItemColumns(): DataTableColumn<SalesUkraineOrderItem>[] {
  const { t } = useI18n()

  return [
    {
      id: 'vendorCode',
      header: t('Код Виробника'),
      width: 140,
      accessor: (item) => item.Product?.VendorCode || item.Product?.Articul,
      cell: (item) => displayValue(item.Product?.VendorCode || item.Product?.Articul),
    },
    {
      id: 'name',
      header: t('Назва товару'),
      minWidth: 260,
      accessor: (item) => item.Product?.NameUA || item.Product?.Name,
      cell: (item) => displayValue(item.Product?.NameUA || item.Product?.Name),
    },
    {
      id: 'qty',
      header: t('К-сть'),
      width: 100,
      align: 'right',
      accessor: (item) => getNumber(item.Qty),
      cell: (item) => displayValue(getNumber(item.Qty)),
    },
    {
      id: 'price',
      header: t('Ціна'),
      width: 120,
      align: 'right',
      accessor: (item) => getNumber(item.PricePerItem),
      cell: (item) => formatAmount(getNumber(item.PricePerItem)),
    },
    {
      id: 'discount',
      header: t('Знижка'),
      width: 100,
      align: 'right',
      accessor: (item) => getNumber(item.OneTimeDiscount),
      cell: (item) => {
        const discount = getNumber(item.OneTimeDiscount)

        return discount ? `${amountFormatter.format(discount)} %` : '—'
      },
    },
    {
      id: 'total',
      header: t('Сума'),
      width: 130,
      align: 'right',
      accessor: (item) => getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount),
      cell: (item) => formatAmount(getNumber(item.TotalAmountLocal) ?? getNumber(item.TotalAmount)),
    },
  ]
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <Group justify="space-between" align="flex-start" gap="lg" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right">
        {displayValue(value)}
      </Text>
    </Group>
  )
}

function getClientName(sale: SalesUkraineSale): string {
  const client = sale.ClientAgreement?.Client

  return (
    client?.FullName?.trim()
    || [client?.LastName, client?.FirstName, client?.MiddleName].filter(Boolean).join(' ').trim()
    || ''
  )
}

function getUserName(sale: SalesUkraineSale): string {
  const user = sale.UpdateUser || sale.User

  return user?.FullName?.trim() || [user?.LastName, user?.FirstName].filter(Boolean).join(' ').trim() || ''
}

function formatAmount(value: number | null): string {
  return typeof value === 'number' ? amountFormatter.format(value) : '—'
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  return '—'
}
