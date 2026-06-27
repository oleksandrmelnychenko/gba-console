import { Alert, Card, Grid, Loader, Select, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconSearch } from '@tabler/icons-react'
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
import { SalesPredictionChart, SalesPredictionComparisonChart } from '../components/SalesPredictionChart'
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

type SelectOption = {
  label: string
  value: string
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
  const [clientPredictionError, setClientPredictionError] = useValueState<string | null>(null)
  const [productPredictionError, setProductPredictionError] = useValueState<string | null>(null)
  const [combinedPredictionError, setCombinedPredictionError] = useValueState<string | null>(null)

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
      setClientPredictionError(null)

      try {
        const next = await getPredictionByClient(id)

        if (!cancelled) {
          setByClient(toChartPoints(next))
        }
      } catch (loadError) {
        if (!cancelled) {
          setByClient([])
          setClientPredictionError(
            loadError instanceof Error ? loadError.message : t('Прогноз по клієнту недоступний'),
          )
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
  }, [clientNetId, setByClient, setClientPredictionError, setLoadingClient, t])

  useEffect(() => {
    if (!productNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoadingProduct(true)
      setProductPredictionError(null)

      try {
        const next = await getPredictionByProduct(id)

        if (!cancelled) {
          setByProduct(toChartPoints(next))
        }
      } catch (loadError) {
        if (!cancelled) {
          setByProduct([])
          setProductPredictionError(
            loadError instanceof Error ? loadError.message : t('Прогноз по товару недоступний'),
          )
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
  }, [productNetId, setByProduct, setLoadingProduct, setProductPredictionError, t])

  useEffect(() => {
    if (!clientNetId || !productNetId) {
      return
    }

    let cancelled = false

    async function load(client: string, product: string) {
      setLoadingCombined(true)
      setCombinedPredictionError(null)

      try {
        const next = await getPredictionByClientAndProduct(client, product)

        if (!cancelled) {
          setCombined(toChartPoints(next))
        }
      } catch (loadError) {
        if (!cancelled) {
          setCombined([])
          setCombinedPredictionError(
            loadError instanceof Error ? loadError.message : t('Прогноз по клієнту і товару недоступний'),
          )
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
  }, [clientNetId, productNetId, setCombined, setCombinedPredictionError, setLoadingCombined, t])

  const clientData = clientOptions.reduce<{ label: string; value: string }[]>((acc, client) => {
    if (client.NetUid) {
      acc.push({ label: getClientLabel(client), value: client.NetUid || '' })
    }

    return acc
  }, [])
  const productData = productOptions.reduce<{ label: string; value: string }[]>((acc, product) => {
    if (product.NetUid) {
      acc.push({ label: getProductLabel(product), value: product.NetUid || '' })
    }

    return acc
  }, [])

  function handleClientChange(value: string | null) {
    setClientNetId(value)
    setByClient([])
    setCombined([])
    setClientPredictionError(null)
    setCombinedPredictionError(null)

    if (!value) {
      setClientFullName('')

      return
    }

    const selected = clientOptions.find((client) => client.NetUid === value)

    setClientFullName(selected ? getClientLabel(selected) : '')
  }

  function handleProductChange(value: string | null) {
    setProductNetId(value)
    setByProduct([])
    setCombined([])
    setProductPredictionError(null)
    setCombinedPredictionError(null)

    if (!value) {
      setProductVendorCode('')

      return
    }

    const selected = productOptions.find((product) => product.NetUid === value)

    setProductVendorCode(selected?.VendorCode?.trim() || selected?.NetUid || '')
  }

  return (
    <Stack gap="lg">
      <Text fw={700} size="lg">
        {t('Прогноз продажів')}
      </Text>

      <PredictionFilters
        clientData={clientData}
        clientNetId={clientNetId}
        clientQuery={clientQuery}
        isLoadingClient={isLoadingClient}
        isLoadingProduct={isLoadingProduct}
        productData={productData}
        productNetId={productNetId}
        productQuery={productQuery}
        onClientChange={handleClientChange}
        onClientSearchChange={setClientQuery}
        onProductChange={handleProductChange}
        onProductSearchChange={setProductQuery}
      />

      <PredictionCharts
        byClient={byClient}
        byProduct={byProduct}
        clientFullName={clientFullName}
        clientPredictionError={clientPredictionError}
        clientNetId={clientNetId}
        combinedPredictionError={combinedPredictionError}
        combined={combined}
        isLoadingClient={isLoadingClient}
        isLoadingCombined={isLoadingCombined}
        isLoadingProduct={isLoadingProduct}
        productPredictionError={productPredictionError}
        productNetId={productNetId}
        productVendorCode={productVendorCode}
      />
    </Stack>
  )
}

function PredictionFilters({
  clientData,
  clientNetId,
  clientQuery,
  isLoadingClient,
  isLoadingProduct,
  productData,
  productNetId,
  productQuery,
  onClientChange,
  onClientSearchChange,
  onProductChange,
  onProductSearchChange,
}: {
  clientData: SelectOption[]
  clientNetId: string | null
  clientQuery: string
  isLoadingClient: boolean
  isLoadingProduct: boolean
  productData: SelectOption[]
  productNetId: string | null
  productQuery: string
  onClientChange: (value: string | null) => void
  onClientSearchChange: (value: string) => void
  onProductChange: (value: string | null) => void
  onProductSearchChange: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <Card withBorder radius="md" padding={0} className="app-filter-card">
      <div className="app-filter-bar">
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
              onChange={onClientChange}
              onSearchChange={onClientSearchChange}
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
              onChange={onProductChange}
              onSearchChange={onProductSearchChange}
            />
          </Grid.Col>
        </Grid>
      </div>
    </Card>
  )
}

function PredictionCharts({
  byClient,
  byProduct,
  clientFullName,
  clientPredictionError,
  clientNetId,
  combined,
  combinedPredictionError,
  isLoadingClient,
  isLoadingCombined,
  isLoadingProduct,
  productPredictionError,
  productNetId,
  productVendorCode,
}: {
  byClient: SalesPredictionChartPoint[]
  byProduct: SalesPredictionChartPoint[]
  clientFullName: string
  clientPredictionError: string | null
  clientNetId: string | null
  combined: SalesPredictionChartPoint[]
  combinedPredictionError: string | null
  isLoadingClient: boolean
  isLoadingCombined: boolean
  isLoadingProduct: boolean
  productPredictionError: string | null
  productNetId: string | null
  productVendorCode: string
}) {
  const { t } = useI18n()
  const isLoadingPrediction = isLoadingClient || isLoadingProduct || isLoadingCombined

  if (!clientNetId && !productNetId) {
    return (
      <Text c="dimmed" size="sm">
        {t('Для відображення прогнозу виберіть у відповідному полі')}
      </Text>
    )
  }

  return (
    <>
      {clientNetId && clientPredictionError && (
        <Alert color="orange" icon={<IconAlertCircle size={18} />} variant="light">
          {clientPredictionError}
        </Alert>
      )}
      {productNetId && productPredictionError && (
        <Alert color="orange" icon={<IconAlertCircle size={18} />} variant="light">
          {productPredictionError}
        </Alert>
      )}
      {clientNetId && productNetId && combinedPredictionError && (
        <Alert color="orange" icon={<IconAlertCircle size={18} />} variant="light">
          {combinedPredictionError}
        </Alert>
      )}

      <SalesPredictionComparisonChart
        isLoading={isLoadingPrediction}
        series={[
          {
            color: 'blue.6',
            data: byClient,
            label: t('Клієнт'),
            name: 'clientAmount',
          },
          {
            color: 'orange.6',
            data: byProduct,
            label: t('Товар'),
            name: 'productAmount',
          },
          {
            color: 'teal.6',
            data: combined,
            label: t('Клієнт + товар'),
            name: 'combinedAmount',
          },
        ]}
        title={t('Прогноз продажів')}
      />

      {clientNetId && (
        <SalesPredictionChart
          color="blue.6"
          data={byClient}
          isLoading={isLoadingClient}
          title={t('Прогноз продажів по клієнту: {customer} на {monthCount} місяців', {
            customer: clientFullName,
            monthCount: byClient.length,
          })}
        />
      )}

      {productNetId && (
        <SalesPredictionChart
          color="orange.6"
          data={byProduct}
          isLoading={isLoadingProduct}
          title={t('Прогноз продажів по продукту: {product} на {monthCount} місяців', {
            monthCount: byProduct.length,
            product: productVendorCode,
          })}
        />
      )}

      {clientNetId && productNetId && (
        <SalesPredictionChart
          color="teal.6"
          data={combined}
          isLoading={isLoadingCombined}
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
    </>
  )
}
