import { Group, Loader, Text, Tooltip } from '@mantine/core'
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useReducer } from 'react'
import { Link } from 'react-router-dom'
import { AiFeatureBadge } from '../../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getPriceRecommendation } from '../../../pricing/api/pricingApi'
import type { PriceRecommendation } from '../../../pricing/pricingTypes'

type WizardAiPriceHintProps = {
  productNetId?: string | null
  clientAgreementNetId?: string | null
  withVat?: boolean
}

type HintState = {
  isLoading: boolean
  failed: boolean
  recommendation: PriceRecommendation | null
}

type HintAction =
  | { type: 'loading' }
  | { type: 'loaded'; recommendation: PriceRecommendation }
  | { type: 'failed' }

const INITIAL_STATE: HintState = { isLoading: false, failed: false, recommendation: null }

function reducer(_state: HintState, action: HintAction): HintState {
  switch (action.type) {
    case 'loading':
      return { isLoading: true, failed: false, recommendation: null }
    case 'loaded':
      return { isLoading: false, failed: false, recommendation: action.recommendation }
    case 'failed':
      return { isLoading: false, failed: true, recommendation: null }
  }
}

function formatEur(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `€${value.toFixed(2)}`
}

export function WizardAiPriceHint({ productNetId, clientAgreementNetId, withVat = true }: WizardAiPriceHintProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const product = productNetId || ''
  const agreement = clientAgreementNetId || ''

  useEffect(() => {
    if (!product || !agreement) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    dispatch({ type: 'loading' })

    getPriceRecommendation(product, agreement, 'uk', withVat, controller.signal)
      .then((recommendation) => {
        if (!cancelled) {
          dispatch({ recommendation, type: 'loaded' })
        }
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          dispatch({ type: 'failed' })
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [product, agreement, withVat])

  if (!product || !agreement) {
    return null
  }

  if (state.isLoading) {
    return (
      <Group gap={6} wrap="nowrap">
        <AiFeatureBadge compact size="xs" tooltip={t('AI-рекомендація ціни')} />
        <Loader color="orange" size={12} />
      </Group>
    )
  }

  const recommendation = state.recommendation

  // Suppress silently on error or when the model is not confident enough to anchor a price —
  // the pricing screen is one click away for the full breakdown.
  if (state.failed || !recommendation || recommendation.confidence === 'low' || recommendation.recommended_price === null) {
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
      <Text fw={600} size="sm">
        {formatEur(recommendation.recommended_price)}
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
              {t('ринок')} {formatEur(median)}
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
