import { Grid, Loader, Select, Stack, Text } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getPredictionByClient,
  getPredictionByClientAndProduct,
  getPredictionByProduct,
  searchPredictionClients,
  searchPredictionProducts,
} from '../api/salesPredictionApi'
import { SalesPredictionChart } from '../components/SalesPredictionChart'
import type {
  SalesPredictionChartPoint,
  SalesPredictionClientOption,
  SalesPredictionPoint,
  SalesPredictionProductOption,
} from '../types'

function toChartPoints(points: SalesPredictionPoint[]): SalesPredictionChartPoint[] {
  return points.map((point) => ({
    amount: typeof point.SaleAmount === 'number' ? point.SaleAmount : 0,
    month: point.MonthNameUK || '',
  }))
}

function getClientLabel(client: SalesPredictionClientOption): string {
  return client.FullName?.trim() || client.NetUid || ''
}

function getProductLabel(product: SalesPredictionProductOption): string {
  return (
    [product.VendorCode, product.Name].filter((value) => value && value.trim()).join(' — ').trim()
    || product.NetUid
    || ''
  )
}

export function SalesPredictionPage() {
  const { t } = useI18n()

  const [clientQuery, setClientQuery] = useValueState('')
  const [clientOptions, setClientOptions] = useValueState<SalesPredictionClientOption[]>([])
  const [clientNetId, setClientNetId] = useValueState<string | null>(null)
  const [clientFullName, setClientFullName] = useValueState('')

  const [productQuery, setProductQuery] = useValueState('')
  const [productOptions, setProductOptions] = useValueState<SalesPredictionProductOption[]>([])
  const [productNetId, setProductNetId] = useValueState<string | null>(null)
  const [productVendorCode, setProductVendorCode] = useValueState('')

  const [byClient, setByClient] = useValueState<SalesPredictionChartPoint[]>([])
  const [byProduct, setByProduct] = useValueState<SalesPredictionChartPoint[]>([])
  const [combined, setCombined] = useValueState<SalesPredictionChartPoint[]>([])

  const [isLoadingClient, setLoadingClient] = useValueState(false)
  const [isLoadingProduct, setLoadingProduct] = useValueState(false)
  const [isLoadingCombined, setLoadingCombined] = useValueState(false)

  useEffect(() => {
    const value = clientQuery.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchPredictionClients(value)

        if (!cancelled) {
          setClientOptions(next)
        }
      } catch {
        if (!cancelled) {
          setClientOptions([])
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [clientQuery, setClientOptions])

  useEffect(() => {
    const value = productQuery.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchPredictionProducts(value)

        if (!cancelled) {
          setProductOptions(next)
        }
      } catch {
        if (!cancelled) {
          setProductOptions([])
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [productQuery, setProductOptions])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoadingClient(true)

      try {
        const next = await getPredictionByClient(id)

        if (!cancelled) {
          setByClient(toChartPoints(next))
        }
      } catch {
        if (!cancelled) {
          setByClient([])
        }
      } finally {
        if (!cancelled) {
          setLoadingClient(false)
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId, setByClient, setLoadingClient])

  useEffect(() => {
    if (!productNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoadingProduct(true)

      try {
        const next = await getPredictionByProduct(id)

        if (!cancelled) {
          setByProduct(toChartPoints(next))
        }
      } catch {
        if (!cancelled) {
          setByProduct([])
        }
      } finally {
        if (!cancelled) {
          setLoadingProduct(false)
        }
      }
    }

    void load(productNetId)

    return () => {
      cancelled = true
    }
  }, [productNetId, setByProduct, setLoadingProduct])

  useEffect(() => {
    if (!clientNetId || !productNetId) {
      return
    }

    let cancelled = false

    async function load(client: string, product: string) {
      setLoadingCombined(true)

      try {
        const next = await getPredictionByClientAndProduct(client, product)

        if (!cancelled) {
          setCombined(toChartPoints(next))
        }
      } catch {
        if (!cancelled) {
          setCombined([])
        }
      } finally {
        if (!cancelled) {
          setLoadingCombined(false)
        }
      }
    }

    void load(clientNetId, productNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId, productNetId, setCombined, setLoadingCombined])

  const clientData = clientOptions
    .filter((client) => client.NetUid)
    .map((client) => ({ label: getClientLabel(client), value: client.NetUid || '' }))
  const productData = productOptions
    .filter((product) => product.NetUid)
    .map((product) => ({ label: getProductLabel(product), value: product.NetUid || '' }))

  return (
    <Stack gap="lg">
      <Text fw={700} size="lg">
        {t('Прогноз продажів')}
      </Text>

      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Select
            clearable
            searchable
            data={clientData}
            label={t('Клієнт')}
            leftSection={<IconSearch size={16} />}
            nothingFoundMessage={
              clientQuery.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')
            }
            placeholder={t('Пошук клієнта')}
            rightSection={isLoadingClient ? <Loader size="xs" /> : null}
            searchValue={clientQuery}
            value={clientNetId}
            onChange={(value) => {
              setClientNetId(value)

              if (!value) {
                setClientFullName('')
                setByClient([])
                setCombined([])

                return
              }

              const selected = clientOptions.find((client) => client.NetUid === value)

              setClientFullName(selected ? getClientLabel(selected) : '')
            }}
            onSearchChange={setClientQuery}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Select
            clearable
            searchable
            data={productData}
            label={t('Товар')}
            leftSection={<IconSearch size={16} />}
            nothingFoundMessage={
              productQuery.trim().length < 2 ? t('Введіть мінімум 2 символи') : t('Нічого не знайдено')
            }
            placeholder={t('Пошук товару')}
            rightSection={isLoadingProduct ? <Loader size="xs" /> : null}
            searchValue={productQuery}
            value={productNetId}
            onChange={(value) => {
              setProductNetId(value)

              if (!value) {
                setProductVendorCode('')
                setByProduct([])
                setCombined([])

                return
              }

              const selected = productOptions.find((product) => product.NetUid === value)

              setProductVendorCode(selected?.VendorCode?.trim() || selected?.NetUid || '')
            }}
            onSearchChange={setProductQuery}
          />
        </Grid.Col>
      </Grid>

      {!clientNetId && !productNetId && (
        <Text c="dimmed" size="sm">
          {t('Для відображення прогнозу виберіть у відповідному полі')}
        </Text>
      )}

      {clientNetId && (
        <SalesPredictionChart
          data={byClient}
          title={t('Прогноз продажів по клієнту: {customer} на {monthCount} місяців', {
            customer: clientFullName,
            monthCount: byClient.length,
          })}
        />
      )}

      {productNetId && (
        <SalesPredictionChart
          data={byProduct}
          title={t('Прогноз продажів по продукту: {product} на {monthCount} місяців', {
            monthCount: byProduct.length,
            product: productVendorCode,
          })}
        />
      )}

      {clientNetId && productNetId && (
        <SalesPredictionChart
          data={combined}
          title={
            isLoadingCombined
              ? t('Завантаження')
              : t('Прогноз продажів по клієнту: {customer} та по продукту: {product} на {monthCount} місяців', {
                  customer: clientFullName,
                  monthCount: combined.length,
                  product: productVendorCode,
                })
          }
        />
      )}
    </Stack>
  )
}
