import { ActionIcon, Alert, Loader, Select, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, RotateCcw, Search } from 'lucide-react'
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
import './sales-prediction-page.css'

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

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
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

    const controller = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const next = await searchPredictionClients(value, controller.signal)

        if (!controller.signal.aborted) {
          setClientOptions(next)
        }
      } catch (searchError) {
        if (!controller.signal.aborted && !isAbortError(searchError)) {
          setClientOptions([])
        }
      }
    }, 300)

    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [clientQuery, setClientOptions])

  useEffect(() => {
    const value = productQuery.trim()

    if (value.length < 2) {
      return
    }

    const controller = new AbortController()
    const handle = setTimeout(async () => {
      try {
        const next = await searchPredictionProducts(value, controller.signal)

        if (!controller.signal.aborted) {
          setProductOptions(next)
        }
      } catch (searchError) {
        if (!controller.signal.aborted && !isAbortError(searchError)) {
          setProductOptions([])
        }
      }
    }, 300)

    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [productQuery, setProductOptions])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    const controller = new AbortController()

    async function load(id: string) {
      setLoadingClient(true)
      setClientPredictionError(null)

      try {
        const next = await getPredictionByClient(id, controller.signal)

        if (!controller.signal.aborted) {
          setByClient(toChartPoints(next))
        }
      } catch (loadError) {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          setByClient([])
          setClientPredictionError(
            loadError instanceof Error ? loadError.message : t('Прогноз по клієнту недоступний'),
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingClient(false)
        }
      }
    }

    void load(clientNetId)

    return () => {
      controller.abort()
    }
  }, [clientNetId, setByClient, setClientPredictionError, setLoadingClient, t])

  useEffect(() => {
    if (!productNetId) {
      return
    }

    const controller = new AbortController()

    async function load(id: string) {
      setLoadingProduct(true)
      setProductPredictionError(null)

      try {
        const next = await getPredictionByProduct(id, controller.signal)

        if (!controller.signal.aborted) {
          setByProduct(toChartPoints(next))
        }
      } catch (loadError) {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          setByProduct([])
          setProductPredictionError(
            loadError instanceof Error ? loadError.message : t('Прогноз по товару недоступний'),
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingProduct(false)
        }
      }
    }

    void load(productNetId)

    return () => {
      controller.abort()
    }
  }, [productNetId, setByProduct, setLoadingProduct, setProductPredictionError, t])

  useEffect(() => {
    if (!clientNetId || !productNetId) {
      return
    }

    const controller = new AbortController()

    async function load(client: string, product: string) {
      setLoadingCombined(true)
      setCombinedPredictionError(null)

      try {
        const next = await getPredictionByClientAndProduct(client, product, controller.signal)

        if (!controller.signal.aborted) {
          setCombined(toChartPoints(next))
        }
      } catch (loadError) {
        if (!controller.signal.aborted && !isAbortError(loadError)) {
          setCombined([])
          setCombinedPredictionError(
            loadError instanceof Error ? loadError.message : t('Прогноз по клієнту і товару недоступний'),
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCombined(false)
        }
      }
    }

    void load(clientNetId, productNetId)

    return () => {
      controller.abort()
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

  function handleResetFilters() {
    setClientQuery('')
    setClientOptions([])
    setClientNetId(null)
    setClientFullName('')
    setProductQuery('')
    setProductOptions([])
    setProductNetId(null)
    setProductVendorCode('')
    setByClient([])
    setByProduct([])
    setCombined([])
    setClientPredictionError(null)
    setProductPredictionError(null)
    setCombinedPredictionError(null)
    setLoadingClient(false)
    setLoadingProduct(false)
    setLoadingCombined(false)
  }

  return (
    <Stack className="sales-prediction-page" gap={0}>
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
        onReset={handleResetFilters}
      />

      <div className="sales-prediction-content">
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
      </div>
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
  onReset,
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
  onReset: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="sales-prediction-filter-card">
      <div className="app-filter-bar sales-prediction-filter-bar">
        <div className="sales-prediction-filter-row">
          <Select
            clearable
            searchable
            data={clientData}
            label={t('Клієнт')}
            leftSection={<Search size={16} />}
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
          <Select
            clearable
            searchable
            data={productData}
            label={t('Товар')}
            leftSection={<Search size={16} />}
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
        </div>
        <div className="app-filter-actions sales-prediction-filter-actions">
          <Tooltip label={t('Скинути')}>
            <ActionIcon
              aria-label={t('Скинути')}
              color="gray"
              size={34}
              variant="light"
              onClick={onReset}
            >
              <RotateCcw size={17} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    </div>
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
        <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
          {clientPredictionError}
        </Alert>
      )}
      {productNetId && productPredictionError && (
        <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
          {productPredictionError}
        </Alert>
      )}
      {clientNetId && productNetId && combinedPredictionError && (
        <Alert color="orange" icon={<CircleAlert size={18} />} variant="light">
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
