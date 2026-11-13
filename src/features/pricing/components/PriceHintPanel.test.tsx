import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getPriceRecommendation } from '../api/pricingApi'
import type { PriceRecommendation } from '../pricingTypes'
import { PriceHintPanel } from './PriceHintPanel'

vi.mock('../api/pricingApi', () => ({ getPriceRecommendation: vi.fn() }))

const recommendation: PriceRecommendation = {
  product_id: 1, product_net_uid: 'product', client_agreement_netuid: 'agreement', recommended_price: 20,
  currency: 'EUR', confidence: 'high', margin_pct_at_recommended: 12.5, peer_band: { p25: 18, p50: 19, p75: 21, n: 6 },
  baseline_price: 22, baseline_source: 'agreement', price_floor: 17, unit_cost_eur: 15,
  suggested_discount_pct: 10, discount_band: { min_pct: 5, target_pct: 10, max_pct: 15 }, elasticity: null, elasticity_source: null,
  elastic_optimal_price: null, rationale: '', requested_start: '2026-01-01', history_fingerprint: 'history', model_fingerprint: 'model',
  as_of_date: '2026-10-25', model_version: 'test', source_history_start: '2026-01-01', effective_start: '2026-01-01', history_complete: true,
}

function show(value: PriceRecommendation) {
  vi.mocked(getPriceRecommendation).mockResolvedValue(value)
  return render(<MantineProvider env="test"><I18nProvider>
    <PriceHintPanel productNetId="product" clientAgreementNetId="agreement" />
  </I18nProvider></MantineProvider>)
}

it('states the price basis once and names own sales instead of the market', async () => {
  show(recommendation)
  expect(await screen.findByText(/EUR за одиницю, як у накладних/)).toBeTruthy()
  expect(screen.getByText(/маржа від ціни/)).toBeTruthy()
  expect(screen.getByText(/знижка від прайсу 10/)).toBeTruthy()
  expect(screen.getByText(/діапазон знижки від прайсу \(мін\. \/ ціль \/ макс\.\)/)).toBeTruthy()
  expect(screen.getByText('Позиція серед наших цін продажу за 12 міс.')).toBeTruthy()
  expect(screen.getByText(/вибірка, договорів/)).toBeTruthy()
  expect(screen.queryByText(/ринк/)).toBeNull()
})

it('labels the fallback baseline as the client sales median', async () => {
  const view = show({ ...recommendation, baseline_source: 'client_world_fallback' })
  await screen.findByText(/EUR за одиницю, як у накладних/)
  expect(view.container.textContent).toContain('медіана продажів клієнту')
  expect(view.container.textContent).not.toContain('ціна договору')
})

it('explains the recommendation in Ukrainian and prints money and percents with a decimal comma', async () => {
  const view = show({ ...recommendation, recommended_price: 16.83, rationale: 'at-baseline' })
  expect(await screen.findByText('Рекомендовано ціну договору: підстав для знижки немає')).toBeTruthy()
  const text = view.container.textContent!
  expect(text).not.toContain('at-baseline')
  expect(text).toContain('16,83\u00a0€')
  expect(text).toContain('12,5\u00a0%')
  expect(text).not.toContain('€16.83')
  expect(text).not.toContain('12.5%')
})

it('never shows an unknown rationale code', async () => {
  const view = show({ ...recommendation, rationale: 'new-engine-code' })
  expect(await screen.findByText('Підстава рекомендації потребує перевірки')).toBeTruthy()
  expect(view.container.textContent).not.toContain('new-engine-code')
})
