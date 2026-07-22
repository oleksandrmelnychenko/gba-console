import { Group, Loader, Select, Stack, Text } from '@mantine/core'
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
import '../../../shared/ui/console-table-page.css'
import './pricing-page.css'

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
  const [productSearchResult, setProductSearchResult] = useState<{
    query: string
    items: SalesUkraineProduct[]
  }>({ query: '', items: [] })
  const [selectedProduct, setSelectedProduct] = useState<SalesUkraineProduct | null>(() => {
    const netId = searchParams.get('productNetId')
    return netId ? ({ NetUid: netId } as SalesUkraineProduct) : null
  })

  const [clientQuery, setClientQuery] = useState('')
  const [debouncedClientQuery] = useDebouncedValue(clientQuery, 400)
  const [clientSearchResult, setClientSearchResult] = useState<{
    query: string
    items: SalesUkraineClientOption[]
  }>({ query: '', items: [] })
  const [selectedClient, setSelectedClient] = useState<SalesUkraineClientOption | null>(null)

  const [agreementResult, setAgreementResult] = useState<{
    clientNetId: string
    items: SalesUkraineClientAgreement[]
  }>({ clientNetId: '', items: [] })
  const [selectedAgreementNetId, setSelectedAgreementNetId] = useState<string | null>(
    () => searchParams.get('clientAgreementNetId'),
  )

  const normalizedProductQuery = debouncedProductQuery.trim()
  const hasProductQuery = normalizedProductQuery.length >= MIN_QUERY_LENGTH
  const productResults = useMemo(
    () => hasProductQuery && productSearchResult.query === normalizedProductQuery
      ? productSearchResult.items
      : [],
    [hasProductQuery, normalizedProductQuery, productSearchResult],
  )
  const productLoading = hasProductQuery && productSearchResult.query !== normalizedProductQuery

  const normalizedClientQuery = debouncedClientQuery.trim()
  const hasClientQuery = normalizedClientQuery.length >= MIN_QUERY_LENGTH
  const clientResults = useMemo(
    () => hasClientQuery && clientSearchResult.query === normalizedClientQuery
      ? clientSearchResult.items
      : [],
    [clientSearchResult, hasClientQuery, normalizedClientQuery],
  )
  const clientLoading = hasClientQuery && clientSearchResult.query !== normalizedClientQuery

  const selectedClientNetId = selectedClient?.NetUid ?? ''
  const agreements = useMemo(
    () => selectedClientNetId && agreementResult.clientNetId === selectedClientNetId
      ? agreementResult.items
      : [],
    [agreementResult, selectedClientNetId],
  )
  const agreementsLoading = Boolean(selectedClientNetId) && agreementResult.clientNetId !== selectedClientNetId

  useEffect(() => {
    const value = normalizedProductQuery
    if (value.length < MIN_QUERY_LENGTH) {
      return
    }

    let cancelled = false
    searchSaleProducts(value)
      .then((list) => {
        if (!cancelled) {
          setProductSearchResult({ query: value, items: list })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProductSearchResult({ query: value, items: [] })
        }
      })

    return () => {
      cancelled = true
    }
  }, [normalizedProductQuery])

  useEffect(() => {
    const value = normalizedClientQuery
    if (value.length < MIN_QUERY_LENGTH) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    searchSalesUkraineClients(value, controller.signal)
      .then((list) => {
        if (!cancelled) {
          setClientSearchResult({ query: value, items: list })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClientSearchResult({ query: value, items: [] })
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [normalizedClientQuery])

  useEffect(() => {
    const clientNetId = selectedClientNetId

    if (!clientNetId) {
      // Keep any deep-linked agreement (?clientAgreementNetId=) when no client is picked yet.
      return
    }

    let cancelled = false
    getSaleClientAgreements(clientNetId)
      .then((list) => {
        if (cancelled) {
          return
        }
        setAgreementResult({ clientNetId, items: list })
        setSelectedAgreementNetId(list.find((agreement) => agreement.NetUid)?.NetUid ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setAgreementResult({ clientNetId, items: [] })
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedClientNetId])

  const productOptions = useMemo(
    () => toOptions(productResults, selectedProduct, productLabel),
    [productResults, selectedProduct],
  )
  const clientOptions = useMemo(
    () => toOptions(clientResults, selectedClient, clientLabel),
    [clientResults, selectedClient],
  )
  const agreementOptions = useMemo<SelectOption[]>(
    () => {
      const options: SelectOption[] = []

      for (const agreement of agreements) {
        if (agreement.NetUid) {
          options.push({ value: agreement.NetUid, label: agreementLabel(agreement) })
        }
      }

      return options
    },
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
    setSelectedAgreementNetId(null)
    setSelectedClient(found ?? (selectedClient?.NetUid === value ? selectedClient : null))
  }

  const productNetId = selectedProduct?.NetUid ?? ''
  const clientAgreementNetId = selectedAgreementNetId ?? ''

  return (
    <Stack className="pricing-page console-table-page" gap={6}>
      <div className="pricing-page__shell console-table-shell">
        <div className="app-filter-bar pricing-page__filter-bar">
          <Select
            className="pricing-page__filter"
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
            className="pricing-page__filter"
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
            className="pricing-page__filter"
            data={agreementOptions}
            disabled={!selectedClient || agreementOptions.length === 0}
            label={t('Угода клієнта')}
            nothingFoundMessage={agreementsLoading ? t('Завантаження…') : t('Немає угод')}
            onChange={setSelectedAgreementNetId}
            placeholder={agreementsLoading ? t('Завантаження…') : t('Оберіть угоду')}
            rightSection={agreementsLoading ? <Loader size="xs" /> : undefined}
            value={selectedAgreementNetId}
          />
        </div>

        <div className="pricing-page__content console-table-body">
          <section className="pricing-page__section">
            <Stack gap="sm">
              <Group align="center" gap="xs" wrap="nowrap">
                <Text className="app-section-title pricing-page__title" fw={600}>
                  {t('Рекомендація ціни')}
                </Text>
                <AiFeatureBadge size="sm" tooltip={t('AI-сервіс цінової оптимізації')} />
              </Group>

              {productNetId && clientAgreementNetId ? (
                <PriceHintPanel clientAgreementNetId={clientAgreementNetId} productNetId={productNetId} />
              ) : (
                <Text c="dimmed" size="sm">
                  {t('Оберіть товар, клієнта та угоду, щоб отримати рекомендацію ціни')}
                </Text>
              )}
            </Stack>
          </section>

          <section className="pricing-page__section">
            <CompetitorWebSearchPanel product={selectedProduct} />
          </section>
        </div>
      </div>
    </Stack>
  )
}
