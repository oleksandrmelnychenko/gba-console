import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import { getSalesUkrainePriceRecommendation } from '../../../pricing/api/pricingApi'
import type { PriceRecommendation } from '../../../pricing/pricingTypes'
import { WizardAiPriceHint } from './WizardAiPriceHint'

vi.mock('../../../pricing/api/pricingApi', () => ({ getSalesUkrainePriceRecommendation: vi.fn() }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks() })
const recommendation = (price: number): PriceRecommendation => ({
  product_id: 1, product_net_uid: 'product', client_agreement_netuid: 'agreement', recommended_price: price,
  currency: 'EUR', confidence: 'high', margin_pct_at_recommended: null, peer_band: { p25: null, p50: null, p75: null, n: 0 },
  baseline_price: null, baseline_source: null, price_floor: null, unit_cost_eur: null,
  suggested_discount_pct: null, discount_band: null, elasticity: null, elasticity_source: null, elastic_optimal_price: null,
  rationale: '', requested_start: '2026-01-01', history_fingerprint: 'history', model_fingerprint: 'model',
  as_of_date: '2026-10-25', model_version: 'test', source_history_start: '2026-01-01', effective_start: '2026-01-01', history_complete: true,
})
const view = (id: string, agreement = 'agreement', vat = false) => <MantineProvider><I18nProvider><MemoryRouter>
  <WizardAiPriceHint productNetId={id} clientAgreementNetId={agreement} withVat={vat} />
</MemoryRouter></I18nProvider></MantineProvider>
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(240) })

it('requests only settled focus and aborts retired hints without showing another product price', async () => {
  vi.useFakeTimers()
  let finish!: (value: PriceRecommendation) => void
  vi.mocked(getSalesUkrainePriceRecommendation).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(recommendation(20))
  const { rerender, unmount } = render(view('first'))
  rerender(view('second'))
  rerender(view('third'))
  expect(getSalesUkrainePriceRecommendation).not.toHaveBeenCalled()
  await tick()
  expect(getSalesUkrainePriceRecommendation).toHaveBeenCalledExactlyOnceWith('third', 'agreement', 'uk', false, expect.any(AbortSignal))
  const signal = vi.mocked(getSalesUkrainePriceRecommendation).mock.calls[0][4]
  rerender(view('fourth'))
  expect(signal?.aborted).toBe(true)
  await act(async () => finish(recommendation(999)))
  expect(screen.queryByText(/999/)).toBeNull()
  await tick()
  expect(screen.getByText(/20,00/)).toBeTruthy()
  rerender(view('fourth', 'new-agreement', true))
  expect(screen.queryByText(/20,00/)).toBeNull()
  unmount()
  await tick()
  expect(getSalesUkrainePriceRecommendation).toHaveBeenCalledTimes(2)
})
