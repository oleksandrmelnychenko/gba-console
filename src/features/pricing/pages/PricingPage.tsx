import { Card, Group, Loader, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getSaleClientAgreements,
  searchSalesUkraineClients,
  searchSaleProducts,
} from '../../sales-ukraine/api/salesUkraineApi'
import type {
  SalesUkraineClientAgreement,
  SalesUkraineClientOption,
  SalesUkraineProduct,
} from '../../sales-ukraine/types'
import { CompetitorWebSearchPanel } from '../components/CompetitorWebSearchPanel'
import { PriceHintPanel } from '../components/PriceHintPanel'

const MIN_QUERY_LENGTH = 2

type SelectOption = { value: string; label: string }

function productLabel(product: SalesUkraineProduct): string {
  const name = (product.Name ?? product.NameUA ?? '').trim()
  const code = (product.VendorCode ?? product.MainOriginalNumber ?? '').trim()
  return [code, name].filter(Boolean).join(' · ') || (product.NetUid ?? '')
}

function clientLabel(client: SalesUkraineClientOption): string {
  const name = (
    client.FullName ??
    client.Name ??
    [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ')
  )?.trim()
  return name || (client.NetUid ?? '')
}

function agreementLabel(agreement: SalesUkraineClientAgreement): string {
  const parts = [agreement.Agreement?.Name, agreement.Agreement?.Organization?.Name, agreement.Agreement?.Currency?.Name]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
  return parts.join(' · ') || (agreement.NetUid ?? '')
}

function toOptions<T extends { NetUid?: string }>(
  items: T[],
  selected: T | null,
  label: (item: T) => string,
): SelectOption[] {
  const merged = selected ? [selected, ...items] : items
  const seen = new Set<string>()
  const options: SelectOption[] = []
  for (const item of merged) {
    const value = item.NetUid
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    options.push({ value, label: label(item) })
  }
  return options
}

export function PricingPage() {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()

  const [productQuery, setProductQuery] = useState('')
  const [debouncedProductQuery] = useDebouncedValue(productQuery, 400)
  const [productResults, setProductResults] = useState<SalesUkraineProduct[]>([])
  const [productLoading, setProductLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<SalesUkraineProduct | null>(() => {
    const netId = searchParams.get('productNetId')
    return netId ? ({ NetUid: netId } as SalesUkraineProduct) : null
  })

  const [clientQuery, setClientQuery] = useState('')
  const [debouncedClientQuery] = useDebouncedValue(clientQuery, 400)
  const [clientResults, setClientResults] = useState<SalesUkraineClientOption[]>([])
  const [clientLoading, setClientLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<SalesUkraineClientOption | null>(null)

  const [agreements, setAgreements] = useState<SalesUkraineClientAgreement[]>([])
  const [agreementsLoading, setAgreementsLoading] = useState(false)
  const [selectedAgreementNetId, setSelectedAgreementNetId] = useState<string | null>(
    () => searchParams.get('clientAgreementNetId'),
  )

  useEffect(() => {
    const value = debouncedProductQuery.trim()
    if (value.length < MIN_QUERY_LENGTH) {
      setProductResults([])
      return
    }

    let cancelled = false
    setProductLoading(true)
    searchSaleProducts(value)
      .then((list) => {
        if (!cancelled) {
          setProductResults(list)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProductResults([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProductLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedProductQuery])

  useEffect(() => {
    const value = debouncedClientQuery.trim()
    if (value.length < MIN_QUERY_LENGTH) {
      setClientResults([])
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setClientLoading(true)
    searchSalesUkraineClients(value, controller.signal)
      .then((list) => {
        if (!cancelled) {
          setClientResults(list)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClientResults([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setClientLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedClientQuery])

  useEffect(() => {
    const clientNetId = selectedClient?.NetUid
    setAgreements([])

    if (!clientNetId) {
      // Keep any deep-linked agreement (?clientAgreementNetId=) when no client is picked yet.
      return
    }

    setSelectedAgreementNetId(null)

    let cancelled = false
    setAgreementsLoading(true)
    getSaleClientAgreements(clientNetId)
      .then((list) => {
        if (cancelled) {
          return
        }
        setAgreements(list)
        setSelectedAgreementNetId(list.find((agreement) => agreement.NetUid)?.NetUid ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setAgreements([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAgreementsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedClient])

  const productOptions = useMemo(
    () => toOptions(productResults, selectedProduct, productLabel),
    [productResults, selectedProduct],
  )
  const clientOptions = useMemo(
    () => toOptions(clientResults, selectedClient, clientLabel),
    [clientResults, selectedClient],
  )
  const agreementOptions = useMemo<SelectOption[]>(
    () =>
      agreements
        .filter((agreement) => agreement.NetUid)
        .map((agreement) => ({ value: agreement.NetUid as string, label: agreementLabel(agreement) })),
    [agreements],
  )

  const handleProductChange = (value: string | null) => {
    if (!value) {
      setSelectedProduct(null)
      return
    }
    const found = productResults.find((product) => product.NetUid === value)
    setSelectedProduct(found ?? (selectedProduct?.NetUid === value ? selectedProduct : null))
  }

  const handleClientChange = (value: string | null) => {
    if (!value) {
      setSelectedClient(null)
      return
    }
    const found = clientResults.find((client) => client.NetUid === value)
    setSelectedClient(found ?? (selectedClient?.NetUid === value ? selectedClient : null))
  }

  const productNetId = selectedProduct?.NetUid ?? ''
  const clientAgreementNetId = selectedAgreementNetId ?? ''

  return (
    <Stack gap="md">
      <Group align="center" gap="xs">
        <Title order={3}>{t('Рекомендація ціни')}</Title>
        <AiFeatureBadge size="sm" tooltip={t('AI-сервіс цінової оптимізації')} />
      </Group>

      <Card className="app-section-card" padding="md" radius="md" withBorder>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <Select
            clearable
            data={productOptions}
            filter={({ options }) => options}
            label={t('Товар')}
            nothingFoundMessage={productLoading ? t('Пошук…') : t('Нічого не знайдено')}
            onChange={handleProductChange}
            onSearchChange={setProductQuery}
            placeholder={t('Пошук за назвою / артикулом')}
            rightSection={productLoading ? <Loader size="xs" /> : undefined}
            searchValue={productQuery}
            searchable
            value={selectedProduct?.NetUid ?? null}
          />

          <Select
            clearable
            data={clientOptions}
            filter={({ options }) => options}
            label={t('Клієнт')}
            nothingFoundMessage={clientLoading ? t('Пошук…') : t('Нічого не знайдено')}
            onChange={handleClientChange}
            onSearchChange={setClientQuery}
            placeholder={t('Пошук клієнта')}
            rightSection={clientLoading ? <Loader size="xs" /> : undefined}
            searchValue={clientQuery}
            searchable
            value={selectedClient?.NetUid ?? null}
          />

          <Select
            data={agreementOptions}
            disabled={!selectedClient || agreementOptions.length === 0}
            label={t('Угода клієнта')}
            nothingFoundMessage={agreementsLoading ? t('Завантаження…') : t('Немає угод')}
            onChange={setSelectedAgreementNetId}
            placeholder={agreementsLoading ? t('Завантаження…') : t('Оберіть угоду')}
            rightSection={agreementsLoading ? <Loader size="xs" /> : undefined}
            value={selectedAgreementNetId}
          />
        </SimpleGrid>
      </Card>

      <Card className="app-section-card" padding="md" radius="md" withBorder>
        {productNetId && clientAgreementNetId ? (
          <PriceHintPanel clientAgreementNetId={clientAgreementNetId} productNetId={productNetId} />
        ) : (
          <Text c="dimmed" size="sm">
            {t('Оберіть товар, клієнта та угоду, щоб отримати рекомендацію ціни')}
          </Text>
        )}
      </Card>

      <Card className="app-section-card" padding="md" radius="md" withBorder>
        <CompetitorWebSearchPanel product={selectedProduct} />
      </Card>
    </Stack>
  )
}
