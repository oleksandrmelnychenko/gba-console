import { Alert, Badge, Box, Card, Group, Loader, ScrollArea, Stack, Text, Title } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getRetailClientSales } from '../api/onlineShopClientsApi'
import type { RetailSale } from '../onlineShopTypes'
import { OnlineShopOrderItemsList } from './OnlineShopOrderItemsList'

const SHOP_ORDER_SOURCE = 0

const amountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

type OnlineShopSalesPanelProps = {
  netUid: string
}

export function OnlineShopSalesPanel({ netUid }: OnlineShopSalesPanelProps) {
  const { t } = useI18n()
  const [sales, setSales] = useState<RetailSale[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(Boolean(netUid))
  const shopSales = useMemo(
    () => sales.filter((sale) => Number(sale.Order?.OrderSource) === SHOP_ORDER_SOURCE),
    [sales],
  )

  useEffect(() => {
    if (!netUid) {
      return undefined
    }

    let cancelled = false

    async function loadSales() {
      setLoading(true)
      setError(null)

      try {
        const nextSales = await getRetailClientSales(netUid)

        if (!cancelled) {
          setSales(nextSales)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSales([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити продажі клієнта'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSales()

    return () => {
      cancelled = true
    }
  }, [netUid, t])

  if (!netUid) {
    return (
      <Text c="dimmed" py="xl" ta="center">
        {t('Клієнта не вибрано')}
      </Text>
    )
  }

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader color="orange" size="sm" />
        <Text size="sm" c="dimmed">
          {t('Завантаження продажів')}
        </Text>
      </Group>
    )
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          {t('Продажів інтернет-магазину')}: {shopSales.length}
        </Text>
      </Group>

      <ScrollArea.Autosize mah="calc(100vh - 220px)" type="auto">
        <Stack gap="sm">
          {shopSales.length > 0 ? (
            shopSales.map((sale, index) => (
              <Card key={sale.NetUid || String(sale.Id || index)} withBorder radius="md" padding="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Title order={5}>{displayValue(getSaleNumber(sale))}</Title>
                      <Text c="dimmed" size="sm">
                        {displayValue(formatDateTime(sale.Created || sale.FromDate))}
                      </Text>
                    </Box>
                    <Stack gap={4} align="flex-end">
                      <Badge className="app-role-pill" variant="light">
                        {t('Інтернет-магазин')}
                      </Badge>
                      <Text fw={700}>{formatAmount(getSaleTotal(sale))}</Text>
                    </Stack>
                  </Group>

                  <Group gap="xs">
                    <Badge color="blue" variant="light">
                      {displayValue(getStatusName(sale.BaseLifeCycleStatus))}
                    </Badge>
                    <Badge color="gray" variant="light">
                      {displayValue(getStatusName(sale.BaseSalePaymentStatus))}
                    </Badge>
                    <Text c="dimmed" size="sm">
                      {t('Позицій')}: {sale.Order?.OrderItems?.length || 0}
                    </Text>
                  </Group>

                  <OnlineShopOrderItemsList
                    emptyText="У продажі немає товарів"
                    items={sale.Order?.OrderItems || []}
                  />
                </Stack>
              </Card>
            ))
          ) : (
            <Text c="dimmed" py="xl" ta="center">
              {t('Продажів інтернет-магазину не знайдено')}
            </Text>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  )
}

function getSaleNumber(sale: RetailSale): string {
  return sale.SaleNumber?.Value?.trim() || ''
}

function getSaleTotal(sale: RetailSale): number {
  return getNumber(sale.TotalAmountLocal) ?? getNumber(sale.TotalAmount) ?? getNumber(sale.Order?.TotalAmountLocal) ?? getNumber(sale.Order?.TotalAmount) ?? 0
}

function getStatusName(status: RetailSale['BaseLifeCycleStatus']): string {
  if (!status) {
    return ''
  }

  return status.Name?.trim() || String(status.SaleLifeCycleType ?? status.Type ?? '')
}

function formatDateTime(value?: Date | string): string {
  const time = getDateTime(value)

  if (time === null) {
    return ''
  }

  return dateTimeFormatter.format(new Date(time))
}

function getDateTime(value?: Date | string): number | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }

  const time = Date.parse(value)

  return Number.isNaN(time) ? null : time
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

function formatAmount(value: number): string {
  return amountFormatter.format(value)
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return String(value)
  }

  const normalized = value?.trim()
  return normalized || '-'
}
