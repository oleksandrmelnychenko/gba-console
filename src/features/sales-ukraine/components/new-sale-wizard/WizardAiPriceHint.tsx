import { Group, Loader, Text, Tooltip } from '@mantine/core'
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useReducer } from 'react'
import { Link } from 'react-router-dom'
import { AiFeatureBadge } from '../../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSalesUkrainePriceRecommendation } from '../../../pricing/api/pricingApi'
import type { PriceRecommendation } from '../../../pricing/pricingTypes'

type WizardAiPriceHintProps = {
  productNetId?: string | null
  clientAgreementNetId?: string | null
  withVat?: boolean
}

type HintState = {
  scopeKey?: string
  isLoading: boolean
  failed: boolean
  recommendation: PriceRecommendation | null
}

type HintAction =
  | { type: 'loading'; scopeKey: string }
  | { type: 'loaded'; recommendation: PriceRecommendation; scopeKey: string }
  | { type: 'failed'; scopeKey: string }

const INITIAL_STATE: HintState = { isLoading: false, failed: false, recommendation: null }

function reducer(_state: HintState, action: HintAction): HintState {
  switch (action.type) {
    case 'loading':
      return { scopeKey: action.scopeKey, isLoading: true, failed: false, recommendation: null }
    case 'loaded':
      return { scopeKey: action.scopeKey, isLoading: false, failed: false, recommendation: action.recommendation }
    case 'failed':
      return { scopeKey: action.scopeKey, isLoading: false, failed: true, recommendation: null }
  }
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  try {
    return new Intl.NumberFormat('uk-UA', {
      currency: currency || 'EUR',
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: 'currency',
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency || 'EUR'}`
  }
}

export function WizardAiPriceHint({ productNetId, clientAgreementNetId, withVat = true }: WizardAiPriceHintProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const product = productNetId || ''
  const agreement = clientAgreementNetId || ''
  const scopeKey = JSON.stringify([product, agreement, withVat])
  const current = state.scopeKey === scopeKey ? state : { ...INITIAL_STATE, isLoading: true }

  useEffect(() => {
    if (!product || !agreement) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    dispatch({ type: 'loading', scopeKey })

    const timer = setTimeout(() => {
      void getSalesUkrainePriceRecommendation(product, agreement, 'uk', withVat, controller.signal)
        .then((recommendation) => {
          if (!cancelled) {
            dispatch({ recommendation, type: 'loaded', scopeKey })
          }
        })
        .catch(() => {
          if (!cancelled && !controller.signal.aborted) {
            dispatch({ type: 'failed', scopeKey })
          }
        })
    }, 240)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [product, agreement, withVat, scopeKey])

  if (!product || !agreement) {
    return null
  }

  if (current.isLoading) {
    return (
      <Group gap={6} wrap="nowrap">
        <AiFeatureBadge compact size="xs" tooltip={t('AI-рекомендація ціни')} />
        <Loader color="orange" size={12} />
      </Group>
    )
  }

  const recommendation = current.recommendation

  // Suppress silently on error or when the model is not confident enough to anchor a price —
  // the pricing screen is one click away for the full breakdown.
  if (current.failed || !recommendation || recommendation.confidence === 'low' || recommendation.recommended_price === null) {
    return null
  }

  const median = recommendation.peer_band?.p50 ?? null
  const belowMarket = median !== null && recommendation.recommended_price < median
  const aboveMarket = median !== null && recommendation.recommended_price > median
  const MarketIcon = belowMarket ? TrendingDown : aboveMarket ? TrendingUp : null

  const detailHref = `/pricing?productNetId=${encodeURIComponent(product)}&clientAgreementNetId=${encodeURIComponent(agreement)}`

  return (
    <Group gap={8} wrap="wrap">
      <AiFeatureBadge compact size="xs" tooltip={t('AI-рекомендація ціни')} />
      <Text className="app-money" fw={600} size="sm">
        {formatMoney(recommendation.recommended_price, recommendation.currency)}
      </Text>
      {recommendation.margin_pct_at_recommended !== null && (
        <Text c="dimmed" size="xs">
          {t('маржа')} {recommendation.margin_pct_at_recommended.toFixed(1)}%
        </Text>
      )}
      {median !== null && (
        <Tooltip label={t('Медіана ринку конкурентів')} openDelay={250}>
          <Group gap={2} wrap="nowrap">
            {MarketIcon && <MarketIcon color={belowMarket ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-red-6)'} size={13} />}
            <Text c="dimmed" size="xs">
              {t('ринок')} <span className="app-money app-money-meta">{formatMoney(median, recommendation.currency)}</span>
            </Text>
          </Group>
        </Tooltip>
      )}
      <Tooltip label={t('Відкрити цінову оптимізацію')} openDelay={250}>
        <Text c="orange.7" component={Link} size="xs" to={detailHref}>
          <Group gap={2} wrap="nowrap">
            {t('деталі')}
            <ArrowUpRight size={12} />
          </Group>
        </Text>
      </Tooltip>
    </Group>
  )
}
