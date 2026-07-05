import { Alert, Badge, Card, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getProduct, getProductRegions, getProductSubstitutes } from '../api/assortmentApi'
import type { ProductDetail, ProductRegions, ProductSubstitutes } from '../types'

const integer = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const money = new Intl.NumberFormat('uk-UA', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' })

function healthPill(health: number): string {
  return health < 40 ? 'is-red' : health < 70 ? 'is-yellow' : 'is-green'
}

export function ProductCard({
  productId,
  asOfDate,
  regionId,
  regionWindowDays = 365,
}: {
  productId: number
  asOfDate?: string
  regionId?: number
  regionWindowDays?: number
}) {
  const { t } = useI18n()
  const [detail, setDetail] = useValueState<ProductDetail | null>(null)
  const [subs, setSubs] = useValueState<ProductSubstitutes | null>(null)
  const [productRegions, setProductRegions] = useValueState<ProductRegions | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [subsError, setSubsError] = useValueState<string | null>(null)
  const [regionsError, setRegionsError] = useValueState<string | null>(null)
  const [loading, setLoading] = useValueState<boolean>(true)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      setSubsError(null)
      setRegionsError(null)
      setDetail(null)
      setSubs(null)
      setProductRegions(null)

      try {
        const d = await getProduct(productId, asOfDate, controller.signal)

        if (!controller.signal.aborted) {
          setDetail(d)
        }

        if (d.found && !controller.signal.aborted) {
          const [substitutesResult, regionsResult] = await Promise.allSettled([
            getProductSubstitutes(productId, asOfDate, 20, controller.signal),
            getProductRegions(productId, asOfDate, regionWindowDays, 8, controller.signal),
          ])

          if (!controller.signal.aborted) {
            if (substitutesResult.status === 'fulfilled') {
              setSubs(substitutesResult.value)
            } else {
              setSubsError(
                substitutesResult.reason instanceof Error ? substitutesResult.reason.message : t('Замінники недоступні'),
              )
            }

            if (regionsResult.status === 'fulfilled') {
              setProductRegions(regionsResult.value)
            } else {
              setRegionsError(
                regionsResult.reason instanceof Error ? regionsResult.reason.message : t('Регіональний попит недоступний'),
              )
            }
          }
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити товар'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [
    productId,
    asOfDate,
    regionWindowDays,
    setDetail,
    setError,
    setLoading,
    setProductRegions,
    setRegionsError,
    setSubs,
    setSubsError,
    t,
  ])

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
        {error ? (
          <Alert color="orange" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        ) : (
          <Text c="dimmed">{t('Товар не знайдено')}</Text>
        )}
      </Card>
    )
  }

  return (
    <Stack gap="md">
      <Card className="assort-product-hero" radius="md" withBorder>
        <Group justify="space-between">
          <Stack gap={2}>
            <Text className="assort-product-hero__name">{detail.name ?? detail.product_id}</Text>
            <Text className="assort-product-hero__code">{detail.vendor_code}</Text>
          </Stack>
          <Badge className={`app-role-pill ${healthPill(detail.health)}`} variant="light">
            {t('Здоровʼя')}: {Math.round(detail.health)}
          </Badge>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Stat label={t('Запас')} value={String(detail.qty_on_hand)} />
        <Stat label={t('Маржа %')} value={detail.margin_pct == null ? '' : `${(detail.margin_pct * 100).toFixed(0)}%`} />
        <Stat label={t('Покриття, дн.')} value={detail.cover_days == null ? '' : String(Math.round(detail.cover_days))} />
        <Stat label={t('Повернення')} value={`${(detail.return_rate * 100).toFixed(1)}%`} />
      </SimpleGrid>

      <Card radius="md" withBorder>
        <Stack gap="xs">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Замінники')} ({subs?.in_stock_count ?? 0} {t('в наявності')})
          </Text>
          {subsError ? (
            <Alert color="orange" icon={<IconAlertCircle size={16} />} variant="light">
              {subsError}
            </Alert>
          ) : (
            (subs?.candidates ?? []).map((c) => (
              <Group key={c.product_id} justify="space-between">
                <Text c="gray.8" fw={600} size="sm">
                  {c.name ?? c.product_id}
                </Text>
                <Badge className={`app-role-pill ${healthPill(c.health)}`} variant="light">
                  {Math.round(c.health)}
                </Badge>
              </Group>
            ))
          )}
        </Stack>
      </Card>

      <Card radius="md" withBorder>
        <Stack gap="xs">
          <Text className="app-section-title" fw={600} size="sm">
            {t('Попит за регіонами')}
          </Text>
          {regionsError ? (
            <Alert color="orange" icon={<IconAlertCircle size={16} />} variant="light">
              {regionsError}
            </Alert>
          ) : (productRegions?.regions ?? []).length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('Немає даних')}
            </Text>
          ) : (
            (productRegions?.regions ?? []).map((region) => {
              const isSelected = region.region_id === regionId
              return (
                <Group key={region.region_id} justify="space-between" wrap="nowrap">
                  <Stack gap={0} miw={0}>
                    {/* Selection reads as the orange accent (§6), not extra weight. */}
                    <Text
                      c={isSelected ? undefined : 'gray.8'}
                      fw={isSelected ? 600 : 500}
                      size="sm"
                      style={isSelected ? { color: 'var(--brand-orange)' } : undefined}
                      truncate
                    >
                      {region.region_name || `#${region.region_id}`}
                    </Text>
                    <Text c="dimmed" size="xs">
                      <b className="assort-meta-num">{integer.format(region.regional_order_count)}</b>{' '}
                      {t('замовлень')} ·{' '}
                      <b className="assort-meta-num">{integer.format(region.regional_client_count)}</b>{' '}
                      {t('клієнтів')}
                    </Text>
                  </Stack>
                  <Stack align="flex-end" gap={0}>
                    <Text className="app-money" size="sm">
                      {money.format(region.regional_revenue_eur)}
                    </Text>
                    <Text c="dimmed" size="xs">
                      <b className="assort-meta-num">{integer.format(region.regional_units)}</b> {t('шт.')}
                    </Text>
                  </Stack>
                </Group>
              )
            })
          )}
        </Stack>
      </Card>
    </Stack>
  )
}

/* §7.2 metric: gray mono label with the orange dot + a large mono value —
   no boxes around each number. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="assort-stat__label app-section-title">{label}</span>
      <span className="assort-stat__value">{value}</span>
    </div>
  )
}
