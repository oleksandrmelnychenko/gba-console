import { Group, Loader, Select, SimpleGrid, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { AmountInput } from '../ui/AmountInput'
import {
  describeMissingSettlementRate,
  describeSettlementRateQuote,
  formatSettlementRate,
  getSupplierSettlementRateQuote,
  SETTLEMENT_RATE_KIND,
  type SettlementRateDocument,
  type SettlementRateOverride,
  type SupplierSettlementRateQuote,
} from './supplierSettlementRate'

export type SupplierSettlementRateQuoteParams = {
  clientAgreementNetId: string
  currencyNetId?: string | null
  date: string
  document: SettlementRateDocument
}

type QuoteState =
  | { status: 'idle' }
  | { key: string, quote: SupplierSettlementRateQuote | null, status: 'ready' }
  | { key: string, message: string, status: 'error' }

const DEFAULT_KIND_VALUE = 'default'

/**
 * «Курс розрахунків: НБУ 50,222 за 17.11.2026» for a supplier document that is about to be saved,
 * re-quoted whenever the agreement, the date, the currency or the chosen kind changes. A holder of the
 * override key can pick the other kind or type a rate; everybody else only sees the line. A failed
 * quote is shown but never blocks the save: the server decides the rate anyway.
 */
export function SupplierSettlementRateField({
  canOverride,
  disabled,
  label,
  override,
  params,
  onOverrideChange,
}: {
  canOverride: boolean
  disabled?: boolean
  label: string
  override: SettlementRateOverride
  params: SupplierSettlementRateQuoteParams | null
  onOverrideChange: (next: SettlementRateOverride) => void
}) {
  const { t } = useI18n()
  const [state, setState] = useState<QuoteState>({ status: 'idle' })
  const requestedKind = canOverride ? override.kind : null
  const requestKey = params
    ? [params.clientAgreementNetId, params.date, params.document, params.currencyNetId || '', requestedKind || ''].join('|')
    : ''

  useEffect(() => {
    if (!params || !requestKey) {
      return undefined
    }

    const controller = new AbortController()
    let cancelled = false

    void getSupplierSettlementRateQuote({
      clientAgreementNetId: params.clientAgreementNetId,
      currencyNetId: params.currencyNetId,
      date: params.date,
      document: params.document,
      kind: requestedKind,
      signal: controller.signal,
    })
      .then((quote) => {
        if (!cancelled) {
          setState({ key: requestKey, quote, status: 'ready' })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            key: requestKey,
            message: error instanceof Error && error.message ? error.message : t('Не вдалося отримати курс розрахунків.'),
            status: 'error',
          })
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
    // requestKey carries every input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  if (!params) {
    return null
  }

  const current = state.status !== 'idle' && state.key === requestKey ? state : null
  const quote = current?.status === 'ready' ? current.quote : null
  const isEuro = quote?.Source === 'eur'
  const manualRate = canOverride && override.rate > 0 ? formatSettlementRate(override.rate) : ''

  return (
    <Stack className="supplier-settlement-rate" gap={6}>
      <Group gap={6} wrap="wrap" data-testid="supplier-settlement-rate-line">
        <Text size="sm" c="dimmed">{t(label)}:</Text>
        {!current && <Loader size={14} aria-label={t('Завантаження курсу')} />}
        {current?.status === 'error' && (
          <Text size="sm" c="orange">{current.message}</Text>
        )}
        {current?.status === 'ready' && (
          manualRate
            ? <Text size="sm" fw={500}>{t('вручну')} {manualRate}</Text>
            : describeSettlementRateQuote(quote)
              ? <Text size="sm" fw={500}>{t(describeSettlementRateQuote(quote) as string)}</Text>
              : <Text size="sm" c="orange">{t(describeMissingSettlementRate(quote))}</Text>
        )}
      </Group>
      {canOverride && !isEuro && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            allowDeselect={false}
            data={[
              { label: t('Як у договорі'), value: DEFAULT_KIND_VALUE },
              { label: t('НБУ'), value: String(SETTLEMENT_RATE_KIND.Nbu) },
              { label: t('Комерційний'), value: String(SETTLEMENT_RATE_KIND.Commercial) },
            ]}
            disabled={disabled}
            label={t('Вид курсу')}
            value={override.kind ? String(override.kind) : DEFAULT_KIND_VALUE}
            onChange={(value) => onOverrideChange({
              ...override,
              kind: value === String(SETTLEMENT_RATE_KIND.Nbu)
                ? SETTLEMENT_RATE_KIND.Nbu
                : value === String(SETTLEMENT_RATE_KIND.Commercial)
                  ? SETTLEMENT_RATE_KIND.Commercial
                  : null,
            })}
          />
          <AmountInput
            decimalScale={6}
            description={t('Порожньо — курс з довідника')}
            disabled={disabled}
            label={t('Свій курс, за 1 EUR')}
            value={override.rate || ''}
            onChange={(value) => onOverrideChange({ ...override, rate: value > 0 ? value : 0 })}
          />
        </SimpleGrid>
      )}
    </Stack>
  )
}
