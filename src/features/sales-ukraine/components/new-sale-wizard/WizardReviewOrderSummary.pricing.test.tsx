import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../../shared/i18n/I18nProvider'
import type { SalesUkraineOrderItem } from '../../types'
import { WizardReviewOrderSummary } from './WizardReviewOrderSummary'

const api = vi.hoisted(() => ({ getProductCalculatedPricingsByAgreement: vi.fn() }))
vi.mock('./newSaleWizardApi', () => api)
vi.mock('./WizardProductPhoto', () => ({ WizardProductPhoto: () => null }))

const items = [{ NetUid: 'line-1', Product: { NetUid: 'product-1', NameUA: 'Фільтр', VendorCode: 'F-1' }, Qty: 1 }] as unknown as SalesUkraineOrderItem[]

function renderSummary(agreementNetId: string | null) {
  render(
    <MantineProvider>
      <I18nProvider>
        <WizardReviewOrderSummary agreementNetId={agreementNetId} items={items} localCurrencyCode="UAH" useEurToUah={false} />
      </I18nProvider>
    </MantineProvider>,
  )
}

describe('review step order lines', () => {
  it('shows the agreement price types instead of «Типи цін недоступні»', async () => {
    api.getProductCalculatedPricingsByAgreement.mockResolvedValue([{ Pricing: { Name: 'QA ЦО2' }, PriceEUR: 12.96, DiscountPriceEUR: 12, RetailPriceEUR: 15, RetailPriceLocal: 700 }])

    renderSummary('agreement-1')

    expect(await screen.findByText('QA ЦО2')).toBeTruthy()
    expect(api.getProductCalculatedPricingsByAgreement).toHaveBeenCalledWith('product-1', 'agreement-1', expect.anything())
    expect(screen.queryByText('Типи цін недоступні')).toBeNull()
  })
})
