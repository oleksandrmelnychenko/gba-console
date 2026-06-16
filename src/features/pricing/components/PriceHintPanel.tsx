import { Alert, Badge, Group, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useReducer } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getPriceRecommendation } from '../api/pricingApi'
import type { PriceConfidence, PriceRecommendation } from '../pricingTypes'

type PriceHintPanelProps = {
  productNetId?: string
  clientAgreementNetId?: string
}

type PriceHintState = {
  error: string | null
  isLoading: boolean
  recommendation: PriceRecommendation | null
}

type PriceHintAction =
  | { type: 'failed'; error: string }
  | { type: 'loaded'; recommendation: PriceRecommendation }
  | { type: 'loading' }

const initialPriceHintState: PriceHintState = {
  error: null,
  isLoading: true,
  recommendation: null,
}

function priceHintReducer(state: PriceHintState, action: PriceHintAction): PriceHintState {
  switch (action.type) {
    case 'failed':
      return { ...state, error: action.error, isLoading: false, recommendation: null }
    case 'loaded':
      return { ...state, error: null, isLoading: false, recommendation: action.recommendation }
    case 'loading':
      return { ...state, error: null, isLoading: true }
  }
}

const CONFIDENCE_COLOR: Record<PriceConfidence, string> = {
  high: 'green',
  low: 'red',
  medium: 'yellow',
}

const CONFIDENCE_LABEL: Record<PriceConfidence, string> = {
  high: 'висока',
  low: 'низька',
  medium: 'середня',
}

export function PriceHintPanel({ productNetId, clientAgreementNetId }: PriceHintPanelProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(priceHintReducer, initialPriceHintState)
  const { error, isLoading, recommendation } = state

  const product = productNetId || ''
  const agreement = clientAgreementNetId || ''

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadRecommendation() {
      if (!product || !agreement) {
        return
      }

      dispatch({ type: 'loading' })

      try {
        const loaded = await getPriceRecommendation(product, agreement, 'uk', true, controller.signal)

        if (!cancelled) {
          dispatch({ recommendation: loaded, type: 'loaded' })
        }
      } catch (loadError) {
        if (!cancelled && controller.signal.aborted) {
          return
        }

        if (!cancelled) {
          dispatch({
            error: loadError instanceof Error ? loadError.message : t('Рекомендація недоступна'),
            type: 'failed',
          })
        }
      }
    }

    void loadRecommendation()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [product, agreement, t])

  if (!product || !agreement) {
    return (
      <Text c="dimmed" size="sm">
        {t('недоступно')}
      </Text>
    )
  }

  if (isLoading) {
    return (
      <Group justify="center" py="md">
        <Loader color="violet" size="sm" />
        <Text c="dimmed" size="sm">
          {t('Розрахунок ціни')}
        </Text>
      </Group>
    )
  }

  if (error || !recommendation) {
    return (
      <Alert color="orange" icon={<IconAlertCircle size={18} />} variant="light">
        {t('недоступно')}
      </Alert>
    )
  }

  return <PriceHintCard recommendation={recommendation} />
}

function PriceHintCard({ recommendation }: { recommendation: PriceRecommendation }) {
  const { t } = useI18n()

  const currency = recommendation.currency || 'EUR'
  const belowMargin = recommendation.rationale.toLowerCase().includes('below-margin')
  const showBaseline =
    recommendation.baseline_price !== null &&
    recommendation.recommended_price !== null &&
    !nearlyEqual(recommendation.baseline_price, recommendation.recommended_price)

  const band = recommendation.discount_band
  const peer = recommendation.peer_band

  return (
    <Stack gap="sm">
      <Group align="baseline" gap="xs" wrap="wrap">
        <Text fw={700} size="28px">
          {formatMoney(recommendation.recommended_price, currency)}
        </Text>
        {showBaseline && (
          <Text c="dimmed" size="sm" td="line-through">
            {formatMoney(recommendation.baseline_price, currency)}
          </Text>
        )}
        <Badge color={CONFIDENCE_COLOR[recommendation.confidence]} size="sm" variant="light">
          {t('впевненість')}: {t(CONFIDENCE_LABEL[recommendation.confidence])}
        </Badge>
      </Group>

      {recommendation.rationale && (
        <Text c="dimmed" size="sm">
          {recommendation.rationale}
        </Text>
      )}

      <Group gap="xs" wrap="wrap">
        {recommendation.margin_pct_at_recommended !== null && (
          <Badge color={belowMargin ? 'red' : 'teal'} size="sm" variant={belowMargin ? 'filled' : 'light'}>
            {t('маржа')} {formatPercent(recommendation.margin_pct_at_recommended)}
          </Badge>
        )}
        {recommendation.price_floor !== null && (
          <Badge color="gray" size="sm" variant="light">
            {t('мін. ціна')}: {formatMoney(recommendation.price_floor, currency)}
          </Badge>
        )}
        {recommendation.suggested_discount_pct !== null && (
          <Badge color="violet" size="sm" variant="light">
            {t('знижка')} {formatPercent(recommendation.suggested_discount_pct)}
          </Badge>
        )}
      </Group>

      {band && (
        <Text c="dimmed" size="xs">
          {t('діапазон знижки')}: {formatPercent(band.min_pct)} / {formatPercent(band.target_pct)} /{' '}
          {formatPercent(band.max_pct)}
        </Text>
      )}

      {peer.n > 0 && (peer.p25 !== null || peer.p75 !== null) && (
        <Text c="dimmed" size="xs">
          {t('ринок')}: {formatMoney(peer.p25, currency)}–{formatMoney(peer.p75, currency)} ({peer.n})
        </Text>
      )}
    </Stack>
  )
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  const symbol = currency === 'EUR' ? '€' : `${currency} `

  return `${symbol}${value.toFixed(2)}`
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  return `${value.toFixed(1)}%`
}
