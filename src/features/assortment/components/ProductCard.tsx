import { Badge, Card, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getProduct, getProductSubstitutes } from '../api/assortmentApi'
import type { ProductDetail, ProductSubstitutes } from '../types'

function healthColor(health: number): string {
  return health < 40 ? 'red' : health < 70 ? 'yellow' : 'green'
}

export function ProductCard({ productId, asOfDate }: { productId: number; asOfDate?: string }) {
  const { t } = useI18n()
  const [detail, setDetail] = useValueState<ProductDetail | null>(null)
  const [subs, setSubs] = useValueState<ProductSubstitutes | null>(null)
  const [loading, setLoading] = useValueState<boolean>(true)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        const [d, s] = await Promise.all([
          getProduct(productId, asOfDate),
          getProductSubstitutes(productId, asOfDate),
        ])
        if (!controller.signal.aborted) {
          setDetail(d)
          setSubs(s)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [productId, asOfDate, setDetail, setSubs, setLoading])

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    )
  }
  if (!detail?.found) {
    return (
      <Card withBorder>
        <Text c="dimmed">{t('Товар не знайдено')}</Text>
      </Card>
    )
  }

  return (
    <Stack gap="md">
      <Card radius="md" withBorder>
        <Group justify="space-between">
          <Stack gap={2}>
            <Text fw={700} size="lg">
              {detail.name ?? detail.product_id}
            </Text>
            <Text c="dimmed" size="sm">
              {detail.vendor_code}
            </Text>
          </Stack>
          <Badge color={healthColor(detail.health)} variant="light">
            {t('Здоровʼя')}: {Math.round(detail.health)}
          </Badge>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Stat label={t('Запас')} value={String(detail.qty_on_hand)} />
        <Stat label={t('Маржа %')} value={detail.margin_pct == null ? '—' : `${(detail.margin_pct * 100).toFixed(0)}%`} />
        <Stat label={t('Покриття, дн.')} value={detail.cover_days == null ? '—' : String(Math.round(detail.cover_days))} />
        <Stat label={t('Повернення')} value={`${(detail.return_rate * 100).toFixed(1)}%`} />
      </SimpleGrid>

      <Card radius="md" withBorder>
        <Stack gap="xs">
          <Text fw={600} size="sm">
            {t('Замінники')} ({subs?.in_stock_count ?? 0} {t('в наявності')})
          </Text>
          {(subs?.candidates ?? []).map((c) => (
            <Group key={c.product_id} justify="space-between">
              <Text size="sm">{c.name ?? c.product_id}</Text>
              <Badge variant="light">{Math.round(c.health)}</Badge>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md" withBorder>
      <Text c="dimmed" size="xs" tt="uppercase">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
    </Card>
  )
}
